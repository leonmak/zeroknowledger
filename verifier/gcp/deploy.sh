#!/bin/bash
# Deploys the enclave verifier to Google Confidential Space (Intel TDX).
# See gcp/README.md for the trust model. Subcommands, each safe to re-run:
#
#   tunnel   Cloudflare Tunnel for enclave.<domain> (needs `cloudflared tunnel login` once)
#   setup    APIs, Artifact Registry, KMS key, key bucket, workload identity pool, VM service account
#   build    build + push the enclave image; records its digest in gcp/published-digests.txt
#   allow    let exactly the published digests unseal the person key
#   vm       (re)create the VM running the latest published digest
#   control  let the Worker start/stop the VM on demand (only get/start/stop, on this VM)
#   stop | start   stop the VM when not in use (no compute charges while stopped);
#                  with `control`, the Worker does this itself

#
# Override any of these with environment variables.
set -euo pipefail
cd "$(dirname "$0")/.."

PROJECT=${PROJECT:-zeroknowledger}
REGION=${REGION:-asia-southeast1}
ZONE=${ZONE:-asia-southeast1-b}
MACHINE=${MACHINE:-c3-standard-4}
REPO=${REPO:-zk}
IMAGE=${IMAGE:-$REGION-docker.pkg.dev/$PROJECT/$REPO/enclave}
KEYRING=${KEYRING:-zk}
KEY=${KEY:-person-key}
MAILBOX_KEY=${MAILBOX_KEY:-mailbox-key} # a separate key, for standupfor.xyz mailbox fingerprints
BUCKET=${BUCKET:-$PROJECT-enclave-keys}
POOL=${POOL:-zk-enclave}
PROVIDER=${PROVIDER:-confidential-space}
SA=${SA:-zk-enclave-vm}
VM=${VM:-zk-enclave}
TUNNEL=${TUNNEL:-zk-enclave}
HOST=${HOST:-enclave.zeroknowledger.com}
WORKER_URL=${WORKER_URL:-https://api.zeroknowledger.com}
AUDIENCE=${AUDIENCE:-zeroknowledger-registry}
CONTROL_SA=${CONTROL_SA:-zk-enclave-control}
CONTROL_ROLE=${CONTROL_ROLE:-enclaveStartStop}
DIGESTS_FILE=gcp/published-digests.txt

step() { printf '\n==> %s\n' "$*"; }
number() { gcloud projects describe "$PROJECT" --format='value(projectNumber)'; }
pool_members() { echo "principalSet://iam.googleapis.com/projects/$(number)/locations/global/workloadIdentityPools/$POOL/*"; }
tunnel_id() { cloudflared tunnel list --output json | python3 -c "import json,sys; print(next(t['id'] for t in json.load(sys.stdin) if t['name']=='$TUNNEL'))"; }
allowed_hosts() { python3 -c "import json; print(','.join(sorted({t['host'] for t in json.load(open('src/templates.json'))})))"; }

tunnel() {
  step "Cloudflare Tunnel $TUNNEL -> $HOST"
  cloudflared tunnel list --output json | grep -q "\"name\":\"$TUNNEL\"" || cloudflared tunnel create "$TUNNEL"
  cloudflared tunnel route dns --overwrite-dns "$TUNNEL" "$HOST"
  echo "tunnel id: $(tunnel_id)"
}

setup() {
  step "APIs"
  gcloud services enable --project "$PROJECT" compute.googleapis.com confidentialcomputing.googleapis.com \
    cloudkms.googleapis.com artifactregistry.googleapis.com iamcredentials.googleapis.com sts.googleapis.com \
    storage.googleapis.com logging.googleapis.com

  step "Artifact Registry $REPO"
  gcloud artifacts repositories describe "$REPO" --project "$PROJECT" --location "$REGION" >/dev/null 2>&1 ||
    gcloud artifacts repositories create "$REPO" --project "$PROJECT" --location "$REGION" --repository-format docker

  step "KMS key $KEYRING/$KEY (seals the person key; only the attested enclave may use it)"
  gcloud kms keyrings describe "$KEYRING" --project "$PROJECT" --location "$REGION" >/dev/null 2>&1 ||
    gcloud kms keyrings create "$KEYRING" --project "$PROJECT" --location "$REGION"
  for k in "$KEY" "$MAILBOX_KEY"; do
    gcloud kms keys describe "$k" --keyring "$KEYRING" --project "$PROJECT" --location "$REGION" >/dev/null 2>&1 ||
      gcloud kms keys create "$k" --keyring "$KEYRING" --project "$PROJECT" --location "$REGION" --purpose encryption
  done

  step "Bucket gs://$BUCKET (holds only the KMS-sealed key)"
  gcloud storage buckets describe "gs://$BUCKET" >/dev/null 2>&1 ||
    gcloud storage buckets create "gs://$BUCKET" --project "$PROJECT" --location "$REGION" \
      --uniform-bucket-level-access --public-access-prevention

  step "Workload identity pool $POOL"
  gcloud iam workload-identity-pools describe "$POOL" --project "$PROJECT" --location global >/dev/null 2>&1 ||
    gcloud iam workload-identity-pools create "$POOL" --project "$PROJECT" --location global

  step "VM service account $SA (no data access; only attests and logs)"
  gcloud iam service-accounts describe "$SA@$PROJECT.iam.gserviceaccount.com" --project "$PROJECT" >/dev/null 2>&1 ||
    gcloud iam service-accounts create "$SA" --project "$PROJECT"
  for role in roles/confidentialcomputing.workloadUser roles/logging.logWriter; do
    gcloud projects add-iam-policy-binding "$PROJECT" --member "serviceAccount:$SA@$PROJECT.iam.gserviceaccount.com" \
      --role "$role" --condition None >/dev/null
  done
  # Pull the workload image (this repository only).
  gcloud artifacts repositories add-iam-policy-binding "$REPO" --project "$PROJECT" --location "$REGION" \
    --member "serviceAccount:$SA@$PROJECT.iam.gserviceaccount.com" --role roles/artifactregistry.reader >/dev/null
}

build() {
  step "Build + push $IMAGE (target gcp)"
  local dc
  dc=$(mktemp -d) # Keychain-free Docker config (see README)
  echo '{"currentContext":"desktop-linux"}' >"$dc/config.json"
  ln -s ~/.docker/contexts "$dc/contexts"
  ln -s ~/.docker/buildx "$dc/buildx"
  ln -s ~/.docker/cli-plugins "$dc/cli-plugins"
  gcloud auth print-access-token | DOCKER_CONFIG=$dc docker login -u oauth2accesstoken --password-stdin "https://$REGION-docker.pkg.dev"
  DOCKER_CONFIG=$dc docker buildx build --platform linux/amd64 --target gcp -t "$IMAGE:latest" --push .
  local digest
  digest=$(gcloud artifacts docker images describe "$IMAGE:latest" --format='value(image_summary.digest)')
  grep -qx "$digest" "$DIGESTS_FILE" 2>/dev/null || echo "$digest" >>"$DIGESTS_FILE"
  echo "published $digest (in $DIGESTS_FILE)"
}

allow() {
  local list condition
  list=$(sed '/^$/d' "$DIGESTS_FILE" | sed "s/.*/'&'/" | paste -sd, -)
  condition="assertion.swname == 'CONFIDENTIAL_SPACE' && 'STABLE' in assertion.submods.confidential_space.support_attributes && assertion.hwmodel == 'GCP_INTEL_TDX' && assertion.dbgstat == 'disabled-since-boot' && assertion.submods.container.image_digest in [$list]"
  step "Provider $PROVIDER: only these digests may unseal: $list"
  if gcloud iam workload-identity-pools providers describe "$PROVIDER" --project "$PROJECT" --location global \
    --workload-identity-pool "$POOL" >/dev/null 2>&1; then
    gcloud iam workload-identity-pools providers update-oidc "$PROVIDER" --project "$PROJECT" --location global \
      --workload-identity-pool "$POOL" --attribute-condition "$condition"
  else
    gcloud iam workload-identity-pools providers create-oidc "$PROVIDER" --project "$PROJECT" --location global \
      --workload-identity-pool "$POOL" --issuer-uri "https://confidentialcomputing.googleapis.com/" \
      --allowed-audiences "https://sts.googleapis.com" --attribute-mapping "google.subject=assertion.sub" \
      --attribute-condition "$condition"
  fi
  step "Grant the attested enclave (and only it) the keys and the bucket"
  for k in "$KEY" "$MAILBOX_KEY"; do
    gcloud kms keys add-iam-policy-binding "$k" --keyring "$KEYRING" --project "$PROJECT" --location "$REGION" \
      --member "$(pool_members)" --role roles/cloudkms.cryptoKeyEncrypterDecrypter >/dev/null
  done
  gcloud storage buckets add-iam-policy-binding "gs://$BUCKET" --member "$(pool_members)" \
    --role roles/storage.objectUser >/dev/null
}

vm() {
  local digest tid
  digest=$(tail -1 "$DIGESTS_FILE")
  tid=$(tunnel_id)
  step "VM $VM ($MACHINE, TDX) running $IMAGE@$digest"
  gcloud compute instances describe "$VM" --project "$PROJECT" --zone "$ZONE" >/dev/null 2>&1 &&
    gcloud compute instances delete "$VM" --project "$PROJECT" --zone "$ZONE" --quiet
  local audience="//iam.googleapis.com/projects/$(number)/locations/global/workloadIdentityPools/$POOL/providers/$PROVIDER"
  gcloud compute instances create "$VM" --project "$PROJECT" --zone "$ZONE" --machine-type "$MACHINE" \
    --confidential-compute-type TDX --maintenance-policy TERMINATE --shielded-secure-boot \
    --image-project confidential-space-images --image-family confidential-space \
    --service-account "$SA@$PROJECT.iam.gserviceaccount.com" --scopes cloud-platform \
    --metadata "^~^tee-image-reference=$IMAGE@$digest~tee-restart-policy=Always~tee-container-log-redirect=true~tee-env-WORKER_URL=$WORKER_URL~tee-env-WIF_AUDIENCE=$audience~tee-env-KMS_KEY=projects/$PROJECT/locations/$REGION/keyRings/$KEYRING/cryptoKeys/$KEY~tee-env-MAILBOX_KMS_KEY=projects/$PROJECT/locations/$REGION/keyRings/$KEYRING/cryptoKeys/$MAILBOX_KEY~tee-env-KEY_BUCKET=$BUCKET~tee-env-ALLOWED_HOSTS=$(allowed_hosts)~tee-env-ATTESTATION_AUDIENCE=$AUDIENCE~tee-env-TUNNEL_ID=$tid~tee-env-TUNNEL_CREDENTIALS=$(base64 <~/.cloudflared/"$tid".json | tr -d '\n')"
  echo "Set the Worker's ENCLAVE_IMAGE_DIGESTS to: $(sed '/^$/d' "$DIGESTS_FILE" | paste -sd, -)"
}

control() {
  local csa="$CONTROL_SA@$PROJECT.iam.gserviceaccount.com"
  local instance="projects/$PROJECT/zones/$ZONE/instances/$VM"
  step "Role $CONTROL_ROLE: compute.instances.get/start/stop only"
  gcloud iam roles describe "$CONTROL_ROLE" --project "$PROJECT" >/dev/null 2>&1 ||
    gcloud iam roles create "$CONTROL_ROLE" --project "$PROJECT" --title "Enclave start/stop" \
      --permissions compute.instances.get,compute.instances.start,compute.instances.stop >/dev/null
  step "Service account $CONTROL_SA, granted the role on $instance only"
  gcloud iam service-accounts describe "$csa" --project "$PROJECT" >/dev/null 2>&1 ||
    gcloud iam service-accounts create "$CONTROL_SA" --project "$PROJECT" --display-name "Worker: enclave start/stop"
  # Conditioned on the instance name, so it survives `vm` recreating the VM.
  gcloud projects add-iam-policy-binding "$PROJECT" --member "serviceAccount:$csa" \
    --role "projects/$PROJECT/roles/$CONTROL_ROLE" \
    --condition "title=enclave-only,expression=resource.name == '$instance'" >/dev/null
  step "New key -> Worker secret GCP_SERVICE_ACCOUNT (never written to disk)"
  gcloud iam service-accounts keys create /dev/stdout --iam-account "$csa" --project "$PROJECT" 2>/dev/null |
    npx wrangler secret put GCP_SERVICE_ACCOUNT
  echo "Old keys: gcloud iam service-accounts keys list --iam-account $csa (delete unused ones)"
}

case "${1:-}" in
  tunnel | setup | build | allow | vm | control) "$1" ;;
  stop) gcloud compute instances stop "$VM" --project "$PROJECT" --zone "$ZONE" ;;
  start) gcloud compute instances start "$VM" --project "$PROJECT" --zone "$ZONE" ;;
  *) sed -n 2,15p "$0"; exit 1 ;;
esac
