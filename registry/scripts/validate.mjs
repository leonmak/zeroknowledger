#!/usr/bin/env node
// Validates the method registry and (with --write) regenerates registry/index.json.
//
//   node registry/scripts/validate.mjs                  schemas, paths, versioning rules, status
//   node registry/scripts/validate.mjs --base main      + published versions are unchanged vs <ref> (CI on PRs)
//   node registry/scripts/validate.mjs --write          + write registry/index.json
import { readFileSync, readdirSync, writeFileSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { join, relative } from "node:path";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

const ROOT = new URL("..", import.meta.url).pathname;
const METHODS = join(ROOT, "methods");
const args = process.argv.slice(2);
const base = args.includes("--base") ? args[args.indexOf("--base") + 1] : null;
const write = args.includes("--write");

const readJson = (p) => JSON.parse(readFileSync(p, "utf8"));
const errors = [];
const fail = (where, msg) => errors.push(`${where}: ${msg}`);

const ajv = new Ajv2020({ allErrors: true, strict: false });
addFormats(ajv);
const checkMethod = ajv.compile(readJson(join(ROOT, "schema/method.schema.json")));
const checkStatus = ajv.compile(readJson(join(ROOT, "schema/status.schema.json")));
const schemaErrors = (check) => check.errors.map((e) => `${e.instancePath || "/"} ${e.message}`).join("; ");

/** Stable JSON (sorted keys), so the hash doesn't depend on formatting. */
const canonical = (v) =>
  Array.isArray(v)
    ? `[${v.map(canonical).join(",")}]`
    : v && typeof v === "object"
      ? `{${Object.keys(v)
          .filter((k) => k !== "$schema")
          .sort()
          .map((k) => `${JSON.stringify(k)}:${canonical(v[k])}`)
          .join(",")}}`
      : JSON.stringify(v);
const hash = (v) => createHash("sha256").update(canonical(v)).digest("hex");

const semver = (s) => s.split(".").map(Number);
const cmp = (a, b) => {
  const [x, y] = [semver(a), semver(b)];
  return x[0] - y[0] || x[1] - y[1] || x[2] - y[2];
};

const proofTypes = new Map(readJson(join(ROOT, "proof-types.json")).proof_types.map((t) => [t.id, t]));

// methods/<namespace>/<name>/{<version>.json, status.json}
const methodDirs = readdirSync(METHODS, { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .flatMap((ns) =>
    readdirSync(join(METHODS, ns.name), { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((m) => ({ id: `${ns.name}/${m.name}`, dir: join(METHODS, ns.name, m.name) })),
  );

const index = [];
for (const { id, dir } of methodDirs) {
  const files = readdirSync(dir).filter((f) => f.endsWith(".json"));
  const versions = files
    .filter((f) => f !== "status.json")
    .map((f) => f.slice(0, -5))
    .sort(cmp);
  if (!versions.length) {
    fail(id, "no versions");
    continue;
  }

  const manifests = {};
  for (const v of versions) {
    const where = `${id}@${v}`;
    const m = readJson(join(dir, `${v}.json`));
    manifests[v] = m;
    if (!checkMethod(m)) fail(where, schemaErrors(checkMethod));
    if (m.id !== id) fail(where, `id "${m.id}" doesn't match its directory`);
    if (m.version !== v) fail(where, `version "${m.version}" doesn't match its file name`);
    const type = proofTypes.get(m.proof_type);
    if (!type) fail(where, `unknown proof_type "${m.proof_type}"`);
    else if (type.status === "planned") fail(where, `proof_type "${m.proof_type}" isn't available yet`);
    else for (const r of m.runtime ?? []) if (!type.runtimes.includes(r)) fail(where, `${m.proof_type} doesn't support runtime "${r}"`);
  }

  // Only a major release may change what a proof means or reset uniqueness.
  for (let i = 1; i < versions.length; i++) {
    const [prev, next] = [manifests[versions[i - 1]], manifests[versions[i]]];
    if (semver(next.version)[0] !== semver(prev.version)[0]) continue;
    const where = `${id}@${next.version}`;
    if (next.proof_type !== prev.proof_type) fail(where, `proof_type changed from ${prev.version} without a major bump`);
    if (next.nullifier?.scope !== prev.nullifier?.scope)
      fail(where, `nullifier.scope changed from ${prev.version} without a major bump (accounts could claim twice)`);
    if (next.disclose.output !== prev.disclose.output) fail(where, `disclose.output changed from ${prev.version} without a major bump`);
  }

  const statusPath = join(dir, "status.json");
  if (!existsSync(statusPath)) {
    fail(id, "missing status.json");
    continue;
  }
  const status = readJson(statusPath);
  if (!checkStatus(status)) fail(`${id}/status.json`, schemaErrors(checkStatus));
  if (status.id !== id) fail(`${id}/status.json`, `id "${status.id}" doesn't match its directory`);
  for (const v of versions) if (!status.versions?.[v]) fail(`${id}/status.json`, `no entry for ${v}`);
  for (const [v, s] of Object.entries(status.versions ?? {})) {
    if (!manifests[v]) fail(`${id}/status.json`, `entry for ${v}, which isn't published`);
    const next = s.deprecated?.superseded_by;
    if (next && (!manifests[next] || cmp(next, v) <= 0)) fail(`${id}@${v}`, `superseded_by ${next} must be a later published version`);
  }

  index.push({
    id,
    latest: versions.at(-1),
    versions: versions.map((v) => ({
      version: v,
      sha256: hash(manifests[v]),
      ...status.versions?.[v],
    })),
    manifest: manifests[versions.at(-1)],
  });
}

// Published versions are immutable: fixes ship as a new version.
if (base) {
  const rel = relative(execFileSync("git", ["rev-parse", "--show-toplevel"], { encoding: "utf8" }).trim(), METHODS);
  const published = execFileSync("git", ["ls-tree", "-r", "--name-only", base, "--", rel], { encoding: "utf8" })
    .split("\n")
    .filter((p) => p.endsWith(".json") && !p.endsWith("/status.json"));
  for (const path of published) {
    const where = path.replace(`${rel}/`, "");
    const before = JSON.parse(execFileSync("git", ["show", `${base}:${path}`], { encoding: "utf8" }));
    const nowPath = join(METHODS, where);
    if (!existsSync(nowPath)) fail(where, `published version was deleted (mark it deprecated or revoked in status.json instead)`);
    else if (hash(readJson(nowPath)) !== hash(before)) fail(where, `published version was edited; publish a new version instead`);
  }
}

if (errors.length) {
  console.error(`✗ ${errors.length} problem(s):\n  ${errors.join("\n  ")}`);
  process.exit(1);
}
if (write) {
  writeFileSync(
    join(ROOT, "index.json"),
    JSON.stringify({ proof_types: [...proofTypes.values()], methods: index }, null, 2) + "\n",
  );
}
console.log(`✓ ${index.length} methods, ${index.reduce((n, m) => n + m.versions.length, 0)} versions${write ? " (wrote registry/index.json)" : ""}`);
