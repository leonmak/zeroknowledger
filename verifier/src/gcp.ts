// Starting and stopping the enclave VM from the Worker (enclaveControl.ts).
//
// Authenticates as a service account whose only permissions are
// compute.instances.{get,start,stop} on the enclave instance (gcp/deploy.sh
// control). It can't change the VM's image or metadata, so it can't affect
// what runs in the enclave or reach the person key.

export type GcpEnv = {
  /** The service account's JSON key (a Worker secret). */
  GCP_SERVICE_ACCOUNT?: string;
  /** projects/<p>/zones/<z>/instances/<name> */
  GCP_INSTANCE?: string;
};

/** What enclaveControl.ts needs from Compute Engine; faked in tests. */
export type Compute = {
  status(): Promise<string>; // RUNNING, TERMINATED, STOPPING, PROVISIONING, STAGING, …
  start(): Promise<void>;
  stop(): Promise<void>;
};

type ServiceAccount = { client_email: string; private_key: string; token_uri?: string };

const b64url = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const b64urlJson = (obj: unknown) => b64url(new TextEncoder().encode(JSON.stringify(obj)));

let cached: { token: string; expires: number } | null = null;

async function accessToken(sa: ServiceAccount): Promise<string> {
  if (cached && Date.now() < cached.expires - 60_000) return cached.token;
  const now = Math.floor(Date.now() / 1000);
  const tokenUri = sa.token_uri ?? "https://oauth2.googleapis.com/token";
  const unsigned = `${b64urlJson({ alg: "RS256", typ: "JWT" })}.${b64urlJson({
    iss: sa.client_email,
    scope: "https://www.googleapis.com/auth/compute",
    aud: tokenUri,
    iat: now,
    exp: now + 3600,
  })}`;
  const pem = sa.private_key.replace(/-----[^-]+-----/g, "").replace(/\s+/g, "");
  const key = await crypto.subtle.importKey(
    "pkcs8",
    Uint8Array.from(atob(pem), (c) => c.charCodeAt(0)),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = new Uint8Array(await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(unsigned)));
  const res = await fetch(tokenUri, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: `${unsigned}.${b64url(signature)}` }),
  });
  if (!res.ok) throw new Error(`google token ${res.status}`);
  const body = (await res.json()) as { access_token: string; expires_in: number };
  cached = { token: body.access_token, expires: Date.now() + body.expires_in * 1000 };
  return cached.token;
}

/** Compute Engine for the enclave instance, or undefined when not configured. */
export function gceCompute(env: GcpEnv): Compute | undefined {
  if (!env.GCP_SERVICE_ACCOUNT || !env.GCP_INSTANCE) return undefined;
  const sa = JSON.parse(env.GCP_SERVICE_ACCOUNT) as ServiceAccount;
  const url = `https://compute.googleapis.com/compute/v1/${env.GCP_INSTANCE}`;
  const call = async (method: string, path = "") => {
    const res = await fetch(url + path, { method, headers: { Authorization: `Bearer ${await accessToken(sa)}` } });
    if (!res.ok) throw new Error(`compute ${method} ${path || "get"} ${res.status}: ${(await res.text()).slice(0, 200)}`);
    return res.json() as Promise<{ status?: string }>;
  };
  return {
    status: async () => (await call("GET")).status ?? "UNKNOWN",
    start: async () => void (await call("POST", "/start")),
    stop: async () => void (await call("POST", "/stop")),
  };
}
