import { Link, useSearchParams } from "react-router";
import Nav from "../components/Nav";
import { HealthChip, SoundnessChip, Tag } from "../components/RegistryStatus";
import { methods, proofTypes, recommended, REPO, type Health } from "../lib/registry";

const HEALTH_FILTERS: Health[] = ["working", "degraded", "broken", "untested"];

function filterHref(current: { type?: string; health?: string }, change: { type?: string; health?: string }) {
  const next = { ...current, ...change };
  const qs = new URLSearchParams(Object.entries(next).filter(([, v]) => v) as [string, string][]).toString();
  return qs ? `/methods?${qs}` : "/methods";
}

export default function MethodsPage() {
  const [searchParams] = useSearchParams();
  const filters = { type: searchParams.get("type") ?? undefined, health: searchParams.get("health") ?? undefined };
  const shown = methods
    .map((m) => ({ m, v: recommended(m) ?? m.versions.at(-1)! }))
    .filter(({ m }) => !filters.type || m.manifest.proof_type === filters.type)
    .filter(({ v }) => !filters.health || v.health === filters.health)
    // working methods first, then by id
    .sort((a, b) => Number(b.v.health === "working") - Number(a.v.health === "working") || a.m.id.localeCompare(b.m.id));

  return (
    <main style={{ minHeight: "100vh", background: "#0d1117", color: "#e6edf3", fontFamily: "Inter, sans-serif" }}>
      <title>Methods · zeroknowledger</title>
      <Nav activeTab="methods" />

      <section style={{ maxWidth: 1100, margin: "0 auto", padding: "56px 32px 12px" }}>
        <p
          style={{
            fontSize: 13,
            fontWeight: 700,
            color: "#7ee787",
            letterSpacing: 1.4,
            textTransform: "uppercase",
            marginBottom: 10,
          }}
        >
          Method registry
        </p>
        <h1 style={{ fontSize: "clamp(32px, 5vw, 54px)", letterSpacing: "-1.5px", lineHeight: 1.08, marginBottom: 12 }}>
          Every way to earn a badge
        </h1>
        <p style={{ color: "#8b949e", fontSize: 16, lineHeight: 1.6, maxWidth: 700 }}>
          Each method is versioned JSON maintained through pull requests. <strong style={{ color: "#e6edf3" }}>Health</strong>{" "}
          says whether new proofs can be made today; <strong style={{ color: "#e6edf3" }}>soundness</strong> says whether
          proofs from a version can be trusted.{" "}
          <a href={`${REPO}/tree/main/registry`} className="nav-link" style={{ color: "#7ee787" }}>
            Contribute a method →
          </a>
        </p>
      </section>

      <section
        style={{ maxWidth: 1100, margin: "0 auto", padding: "20px 32px 8px", display: "flex", flexDirection: "column", gap: 10 }}
      >
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <span style={{ fontSize: 12, color: "#556070", width: 56 }}>Type</span>
          <Link to={filterHref(filters, { type: undefined })} className={`pill btn-link${filters.type ? "" : " on"}`}>
            All
          </Link>
          {proofTypes.map((t) => (
            <Link
              key={t.id}
              to={filterHref(filters, { type: t.id })}
              className={`pill btn-link${filters.type === t.id ? " on" : ""}`}
              title={t.description}
            >
              {t.name}
              {t.status !== "available" && <span style={{ opacity: 0.6, marginLeft: 6 }}>{t.status}</span>}
            </Link>
          ))}
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <span style={{ fontSize: 12, color: "#556070", width: 56 }}>Health</span>
          <Link to={filterHref(filters, { health: undefined })} className={`pill btn-link${filters.health ? "" : " on"}`}>
            All
          </Link>
          {HEALTH_FILTERS.map((h) => (
            <Link
              key={h}
              to={filterHref(filters, { health: h })}
              className={`pill btn-link${filters.health === h ? " on" : ""}`}
            >
              {h}
            </Link>
          ))}
        </div>
      </section>

      <section style={{ maxWidth: 1100, margin: "0 auto", padding: "16px 32px 80px" }}>
        {shown.length === 0 && (
          <p style={{ color: "#8b949e", fontSize: 14, padding: "40px 0" }}>
            No methods match these filters yet.
          </p>
        )}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 14 }}>
          {shown.map(({ m, v }) => (
            <Link key={m.id} to={`/methods/${m.id}`} style={{ textDecoration: "none", color: "inherit" }}>
              <article className="mc" style={{ display: "flex", flexDirection: "column", gap: 12, height: "100%" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                  <div
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 8,
                      borderRadius: 999,
                      padding: "5px 10px",
                      border: `1px solid ${m.manifest.badge.color}44`,
                      background: `${m.manifest.badge.color}22`,
                      minWidth: 0,
                    }}
                  >
                    <span
                      style={{ width: 12, height: 12, borderRadius: "50%", background: m.manifest.badge.color, flexShrink: 0 }}
                    />
                    <span style={{ fontSize: 13, fontWeight: 700 }}>{m.manifest.badge.label}</span>
                  </div>
                  <span style={{ fontSize: 12, color: "#556070", fontFamily: "'JetBrains Mono', monospace" }}>
                    v{v.version}
                  </span>
                </div>

                <p style={{ color: "#8b949e", fontSize: 13, lineHeight: 1.5, flexGrow: 1 }}>{m.manifest.claim}</p>

                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  <HealthChip health={v.health} />
                  <SoundnessChip soundness={v.soundness} />
                  <Tag>{m.manifest.proof_type}</Tag>
                </div>

                <div
                  style={{
                    borderTop: "1px solid #1f2937",
                    paddingTop: 10,
                    fontSize: 12,
                    color: "#556070",
                    fontFamily: "'JetBrains Mono', monospace",
                    overflowWrap: "anywhere",
                  }}
                >
                  {m.id}
                </div>
              </article>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
