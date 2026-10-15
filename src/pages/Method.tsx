import { Link, useParams } from "react-router";
import Nav from "../components/Nav";
import JsonHighlight from "../components/JsonHighlight";
import ProveButton from "../components/ProveButton";
import AgeReturn from "../components/AgeReturn";
import { HealthChip, SoundnessChip, Tag } from "../components/RegistryStatus";
import NotFound from "./NotFound";
import { getMethod, getProofType, recommended, REPO, type Method, type VersionStatus } from "../lib/registry";

const card = { border: "1px solid #1f2937", background: "#0d1117", borderRadius: 10, padding: 20 } as const;
const h2 = { fontSize: 13, fontWeight: 700, color: "#8b949e", textTransform: "uppercase", letterSpacing: 1.2, marginBottom: 14 } as const;
const mono = { fontFamily: "'JetBrains Mono', monospace" } as const;

function describeDisclosure(m: Method) {
  const d = m.manifest.disclose;
  const cmp = { gte: "≥", lte: "≤", eq: "=" }[d.comparison ?? ""] ?? "";
  switch (d.mode) {
    case "exact":
      return `The exact value of ${d.output}`;
    case "threshold":
      return `Only whether ${d.output} ${cmp} ${String(d.value)}`;
    case "range":
      return `Only which range ${d.output} falls in`;
    default:
      return `Only yes/no: ${d.output}`;
  }
}

function PrivacyList({ title, items, mark, color }: { title: string; items: string[]; mark: string; color: string }) {
  return (
    <div style={{ marginTop: 16 }}>
      <h3 style={{ fontSize: 13, fontWeight: 600, color: "#c9d1d9", marginBottom: 8 }}>{title}</h3>
      <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 8 }}>
        {items.map((item) => (
          <li key={item} style={{ display: "flex", gap: 10, fontSize: 14, lineHeight: 1.55, color: "#c9d1d9" }}>
            <span aria-hidden style={{ color, flexShrink: 0, width: 14, textAlign: "center" }}>
              {mark}
            </span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function issueUrl(template: string, title: string, fields: Record<string, string>) {
  const qs = new URLSearchParams({ template, title, ...fields });
  return `${REPO}/issues/new?${qs}`;
}

function VersionRow({ v, latest }: { v: VersionStatus; latest: boolean }) {
  return (
    <div style={{ padding: "14px 0", borderTop: "1px solid #1f2937", display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <span style={{ ...mono, fontSize: 14, fontWeight: 600 }}>v{v.version}</span>
        {latest && <Tag>latest</Tag>}
        <HealthChip health={v.health} />
        <SoundnessChip soundness={v.soundness} />
        {v.deprecated && <Tag>deprecated → v{v.deprecated.superseded_by}</Tag>}
        <span style={{ ...mono, fontSize: 11, color: "#556070", marginLeft: "auto" }} title={`sha256 ${v.sha256}`}>
          {v.sha256.slice(0, 12)}
        </span>
      </div>
      {v.revoked && (
        <p style={{ fontSize: 13, color: "#f85149", lineHeight: 1.5 }}>
          Revoked {v.revoked.date}: {v.revoked.reason}. Badges from this version shouldn&apos;t be trusted.
          {v.revoked.advisory && (
            <>
              {" "}
              <a href={v.revoked.advisory} style={{ color: "#f85149" }}>
                Advisory
              </a>
            </>
          )}
        </p>
      )}
      {v.health_note && <p style={{ fontSize: 13, color: "#8b949e", lineHeight: 1.5 }}>{v.health_note}</p>}
      <p style={{ fontSize: 12, color: "#556070" }}>
        {v.last_checked ? `Checked ${v.last_checked}` : "Never checked"}
        {v.reviewed_by?.length ? ` · reviewed by ${v.reviewed_by.join(", ")}` : ""}
        {v.audit && (
          <>
            {" · "}
            <a href={v.audit} style={{ color: "#58a6ff" }}>
              audit
            </a>
          </>
        )}
      </p>
    </div>
  );
}

export default function MethodPage() {
  const { namespace, name } = useParams();
  const m = getMethod(`${namespace}/${name}`);
  if (!m) return <NotFound />;

  const man = m.manifest;
  const rec = recommended(m);
  const type = getProofType(man.proof_type);
  const dir = `${REPO}/tree/main/registry/methods/${m.id}`;

  return (
    <main style={{ minHeight: "100vh", background: "#0d1117", color: "#e6edf3", fontFamily: "Inter, sans-serif" }}>
      <title>{`${man.badge.label} · zeroknowledger`}</title>
      <meta name="description" content={man.claim} />
      <Nav activeTab="methods" />

      <section style={{ maxWidth: 1100, margin: "0 auto", padding: "40px 32px 8px" }}>
        <Link to="/methods" className="nav-link" style={{ fontSize: 13 }}>
          ← All methods
        </Link>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 20, flexWrap: "wrap" }}>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              borderRadius: 999,
              padding: "6px 12px",
              border: `1px solid ${man.badge.color}44`,
              background: `${man.badge.color}22`,
            }}
          >
            <span style={{ width: 14, height: 14, borderRadius: "50%", background: man.badge.color }} />
            <span style={{ fontSize: 14, fontWeight: 700 }}>{man.badge.label}</span>
          </div>
          <span style={{ ...mono, fontSize: 14, color: "#8b949e" }}>{m.id}</span>
        </div>
        <p style={{ fontSize: 18, lineHeight: 1.55, maxWidth: 760, marginTop: 16 }}>{man.claim}</p>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 16 }}>
          <Tag>{type?.name ?? man.proof_type}</Tag>
          {man.runtime.map((r) => (
            <Tag key={r}>{r}</Tag>
          ))}
          {man.risk && <Tag>risk: {man.risk}</Tag>}
          {man.tags?.map((t) => (
            <Tag key={t}>#{t}</Tag>
          ))}
        </div>
      </section>

      <section
        style={{
          maxWidth: 1100,
          margin: "0 auto",
          padding: "28px 32px 80px",
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
          gap: 16,
          alignItems: "start",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={card}>
            <h2 style={h2}>What a badge reveals</h2>
            <dl style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "10px 16px", fontSize: 14, lineHeight: 1.5 }}>
              <dt style={{ color: "#8b949e" }}>Disclosed</dt>
              <dd>{describeDisclosure(m)}</dd>
              <dt style={{ color: "#8b949e" }}>One per</dt>
              <dd>{man.nullifier ? man.nullifier.derived_from : "No uniqueness check: one account can earn it repeatedly"}</dd>
              <dt style={{ color: "#8b949e" }}>Fresh for</dt>
              <dd>
                {man.freshness.max_age_days} days (stale after {man.freshness.stale_after_days})
              </dd>
            </dl>
          </div>

          {man.privacy && (
            <div style={card}>
              <h2 style={h2}>How it stays private</h2>
              {man.privacy.summary && <p style={{ fontSize: 14, lineHeight: 1.6 }}>{man.privacy.summary}</p>}
              <PrivacyList title="Guarantees" items={man.privacy.guarantees} mark="✓" color="#7ee787" />
              <PrivacyList title="Not yet" items={man.privacy.limits} mark="!" color="#d29922" />
              {man.privacy.trust && <PrivacyList title="You trust" items={man.privacy.trust} mark="·" color="#8b949e" />}
            </div>
          )}

          <div style={card}>
            <h2 style={h2}>Get this badge</h2>
            {!rec ? (
              <p style={{ fontSize: 14, color: "#f85149" }}>Every version is revoked or deprecated.</p>
            ) : rec.health === "broken" ? (
              <p style={{ fontSize: 14, color: "#8b949e", lineHeight: 1.5 }}>
                v{rec.version} is broken right now, so new proofs can&apos;t be made. Badges already issued are unaffected.
              </p>
            ) : man.proof_type === "tlsn" ? (
              m.id === "identity/singpass-age-15-plus" && new URLSearchParams(location.search).has("age_request")
                ? <AgeReturn id={new URLSearchParams(location.search).get("age_request")!} />
                : <ProveButton templateName={m.id} />
            ) : man.proof_type === "dkim-email" ? (
              <p style={{ fontSize: 14, color: "#8b949e", lineHeight: 1.6 }}>
                Run <code style={mono}>/verify</code> in a Discord server with the zeroknowledger bot, then drop an email
                sent to your work address into{" "}
                <a href="https://badge.zeroknowledger.com" style={{ color: "#7ee787" }}>
                  badge.zeroknowledger.com
                </a>
                . The email never leaves your device.
              </p>
            ) : null}
          </div>

          <div style={card}>
            <h2 style={h2}>Help maintain it</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: 10, fontSize: 14 }}>
              <a
                className="nav-link"
                href={issueUrl("method-broken.yml", `[broken] ${m.id}@${m.latest}`, { method: `${m.id}@${m.latest}` })}
              >
                Report it broken or flaky →
              </a>
              <a
                className="nav-link"
                href={issueUrl("better-version.yml", `[deprecate] ${m.id}@${m.latest}`, { method: `${m.id}@${m.latest}` })}
              >
                Suggest a better version →
              </a>
              <a className="nav-link" href={dir}>
                Publish a fix as a new version →
              </a>
              <a className="nav-link" href={`${REPO}/security/advisories/new`} style={{ color: "#f85149" }}>
                It can prove something false: report privately →
              </a>
            </div>
            <p style={{ fontSize: 12, color: "#556070", marginTop: 14 }}>Maintained by {man.maintainers.join(", ")}</p>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={card}>
            <h2 style={h2}>Versions</h2>
            <div style={{ marginBottom: -14 }}>
              {[...m.versions].reverse().map((v) => (
                <VersionRow key={v.version} v={v} latest={v.version === m.latest} />
              ))}
            </div>
          </div>

          {man.changelog && (
            <div style={card}>
              <h2 style={h2}>Changelog v{m.latest}</h2>
              <p style={{ fontSize: 14, color: "#c9d1d9", lineHeight: 1.6 }}>{man.changelog}</p>
            </div>
          )}

          <div style={card}>
            <h2 style={h2}>Configuration · {type?.name ?? man.proof_type}</h2>
            <JsonHighlight code={JSON.stringify(man.config, null, 2)} />
          </div>
        </div>
      </section>
    </main>
  );
}
