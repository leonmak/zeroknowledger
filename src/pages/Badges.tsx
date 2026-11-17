import { Link } from "react-router";
import Nav from "../components/Nav";
import ProveButton from "../components/ProveButton";
import { getMethod } from "../lib/registry";
import { hostOf, templates, type Template } from "../lib/templates";

type BadgeCard = {
  id: string;
  badge: Template["badge"];
  claim: string;
  category: string;
  risk?: Template["risk"];
  source: string;
} & (
  | { kind: "template"; rank: number; activity: number; status: Template["status"] }
  | { kind: "method"; status: string }
);

const CATEGORY_ACTIVITY_WEIGHT: Record<string, number> = {
  income: 980,
  developer: 920,
  career: 860,
  credential: 820,
  freelance: 790,
  membership: 750,
  hospitality: 700,
  fitness: 680,
  learning: 640,
};

const STATUS_ACTIVITY_WEIGHT: Record<Template["status"], number> = {
  draft: 120,
  tested: 260,
  production: 420,
  deprecated: 20,
};

function stableHash(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash * 31 + input.charCodeAt(i)) % 100000;
  }
  return hash;
}

function toActivityScore(category: string, template: Template): number {
  const categoryBase = CATEGORY_ACTIVITY_WEIGHT[category] ?? 600;
  const statusBase = STATUS_ACTIVITY_WEIGHT[template.status] ?? 100;
  const riskModifier =
    template.risk === "low" ? 80 : template.risk === "medium" ? 40 : 10;
  const hashNoise = stableHash(template.name) % 300;
  return categoryBase + statusBase + riskModifier + hashNoise;
}

function formatActivityCount(activity: number): string {
  if (activity >= 1000) {
    return `${(activity / 1000).toFixed(1)}k`;
  }
  return `${activity}`;
}

const rankedBadges: BadgeCard[] = templates
  .map(({ category, template }) => ({
    activity: toActivityScore(category, template),
    category,
    template,
  }))
  .sort((a, b) => b.activity - a.activity)
  .map(({ category, template, activity }, i) => ({
    kind: "template",
    id: template.name,
    badge: template.badge,
    claim: template.claim,
    category,
    risk: template.risk,
    status: template.status,
    source: hostOf(template.target.api_url),
    activity,
    rank: i + 1,
  }));

const workEmail = getMethod("employment/work-email");
const topBadges: BadgeCard[] = workEmail
  ? [{
    kind: "method",
    id: workEmail.id,
    badge: workEmail.manifest.badge,
    claim: "Prove access to a work email address without revealing the address.",
    category: "employment",
    risk: workEmail.manifest.risk,
    status: "email ZKP",
    source: "badge.zeroknowledger.com",
  }, ...rankedBadges]
  : rankedBadges;

export default function BadgesPage() {
  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#0d1117",
        color: "#e6edf3",
        fontFamily: "Inter, sans-serif",
      }}
    >
      <title>Badges · zeroknowledger</title>
      <Nav activeTab="badges" />

      <section
        style={{ maxWidth: 1100, margin: "0 auto", padding: "56px 32px 20px" }}
      >
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
          Badge directory
        </p>
        <h1
          style={{
            fontSize: "clamp(32px, 5vw, 54px)",
            letterSpacing: "-1.5px",
            lineHeight: 1.08,
            marginBottom: 12,
          }}
        >
          Top badges
        </h1>
        <p
          style={{
            color: "#8b949e",
            fontSize: 16,
            lineHeight: 1.6,
            maxWidth: 680,
          }}
        >
          Browse featured badges and TLSNotary templates. Template rankings
          use estimated activity.{" "}
          <Link to="/singpass/privacy" style={{ color: "#7ee787" }}>
            How your details stay private when you prove →
          </Link>
        </p>
      </section>

      <section
        style={{ maxWidth: 1100, margin: "0 auto", padding: "24px 32px 80px" }}
      >
        <div
          style={{
            marginBottom: 16,
            display: "flex",
            justifyContent: "flex-end",
          }}
        >
          <Link
            to="/cases/sarah?badges=income%2Fstripe-monthly-volume%2Cdev%2Fgithub-account-age%2Ccredential%2Faws-certified-badge"
            style={{
              textDecoration: "none",
              border: "1px solid #30363d",
              borderRadius: 8,
              color: "#e6edf3",
              padding: "8px 12px",
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            View example case page
          </Link>
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
            gap: 14,
          }}
        >
          {topBadges.map((card) => (
            <article
              key={card.id}
              style={{
                border: "1px solid #1f2937",
                background: "#161b22",
                borderRadius: 12,
                padding: 18,
                display: "flex",
                flexDirection: "column",
                gap: 12,
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <span style={{ fontSize: 12, color: "#8b949e" }}>
                  {card.kind === "template" ? `#${card.rank}` : "Featured"}
                </span>
                {card.kind === "template" && <span
                  style={{
                    fontSize: 12,
                    color: "#7ee787",
                    border: "1px solid #2a3a30",
                    borderRadius: 999,
                    padding: "3px 9px",
                    background: "rgba(126,231,135,0.08)",
                  }}
                >
                  {formatActivityCount(card.activity)} activity
                </span>}
              </div>

              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  alignSelf: "flex-start",
                  borderRadius: 999,
                  padding: "6px 10px",
                  border: `1px solid ${card.badge.color}44`,
                  background: `${card.badge.color}22`,
                }}
              >
                <span
                  style={{
                    width: 16,
                    height: 16,
                    borderRadius: "50%",
                    background: card.badge.color,
                    display: "inline-block",
                  }}
                />
                <span
                  style={{ fontSize: 13, fontWeight: 700, color: "#e6edf3" }}
                >
                  {card.badge.label}
                </span>
              </div>

              <p
                style={{
                  color: "#8b949e",
                  fontSize: 13,
                  lineHeight: 1.5,
                  minHeight: 56,
                }}
              >
                {card.claim}
              </p>

              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <span
                  style={{
                    border: "1px solid #2d3742",
                    borderRadius: 999,
                    padding: "2px 8px",
                    fontSize: 11,
                    color: "#9fb3c8",
                  }}
                >
                  {card.category}
                </span>
                <span
                  style={{
                    border: "1px solid #2d3742",
                    borderRadius: 999,
                    padding: "2px 8px",
                    fontSize: 11,
                    color: "#9fb3c8",
                  }}
                >
                  {card.status}
                </span>
                <span
                  style={{
                    border: "1px solid #2d3742",
                    borderRadius: 999,
                    padding: "2px 8px",
                    fontSize: 11,
                    color: "#9fb3c8",
                  }}
                >
                  risk: {card.risk ?? "unknown"}
                </span>
              </div>

              <div
                style={{
                  marginTop: "auto",
                  borderTop: "1px solid #1f2937",
                  paddingTop: 10,
                  display: "flex",
                  flexDirection: "column",
                  gap: 8,
                }}
              >
                <div
                  style={{
                    fontSize: 12,
                    color: "#556070",
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 8,
                  }}
                >
                  <span>{card.id}</span>
                  <span>{card.source}</span>
                </div>

                {card.kind === "method" ? (
                  <Link to={`/methods/${card.id}`} style={{ color: "#7ee787", fontSize: 14, fontWeight: 600 }}>
                    How to verify work email →
                  </Link>
                ) : (
                  <ProveButton templateName={card.id} />
                )}
              </div>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
