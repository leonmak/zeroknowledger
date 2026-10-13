// Writes src/templates.json: what the Worker needs from each badge template.
//  - host: the verifier may only connect to these (ALLOWED_HOSTS). The
//    extension proves against the hostname of api_url, so that's what the
//    verifier sees as server_name.
//  - method/path + issue_when: the issuer's rules for granting the badge.
//    Templates without issue_when can be proved but never issue a badge.
import { readFileSync, writeFileSync } from "node:fs";

const dir = new URL("../../docs/tlsnotary/templates/", import.meta.url);
const index = JSON.parse(readFileSync(new URL("index.json", dir), "utf8"));

const templates = index.templates.map((entry) => {
  const t = JSON.parse(readFileSync(new URL(entry.file, dir), "utf8"));
  const url = new URL(t.target.api_url);
  return {
    name: t.name,
    host: url.hostname,
    method: t.target.method,
    path: url.pathname + url.search,
    // Hash-committed fields, in order; a person_proof circuit opens exactly these.
    commit_fields: t.prove_params.commit_fields ?? [],
    issue_when: t.issue_when ?? null,
    badge: t.badge,
  };
});

writeFileSync(new URL("../src/templates.json", import.meta.url), JSON.stringify(templates, null, 2) + "\n");
const issuing = templates.filter((t) => t.issue_when).map((t) => t.name);
console.log(`${templates.length} templates, issuing: ${issuing.join(", ") || "none"}`);
