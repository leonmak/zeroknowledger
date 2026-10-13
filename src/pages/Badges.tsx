import { Link } from "react-router";
import Nav from "../components/Nav";
import ProveButton from "../components/ProveButton";
import { hostOf, templates, type Template } from "../lib/templates";

type BadgeCard = {
  rank: number;
  activity: number;
  category: string;
  template: Template;
};

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

const topBadges: BadgeCard[] = templates
  .map(({ category, template }) => ({
    rank: 0,
    activity: toActivityScore(category, template),
    category,
    template,
  }))
  .sort((a, b) => b.activity - a.activity)
  .map((card, i) => ({ ...card, rank: i + 1 }));

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
          Seeded from TLSNotary templates
        </p>
        <h1
          style={{
            fontSize: "clamp(32px, 5vw, 54px)",
            letterSpacing: "-1.5px",
            lineHeight: 1.08,
            marginBottom: 12,
          }}
        >
          Top badges by activity
        </h1>
        <p
          style={{
            color: "#8b949e",
            fontSize: 16,
            lineHeight: 1.6,
            maxWidth: 680,
          }}
        >
          Rankings are currently derived from your seeded template set and
          category demand weighting. As real proofs come in, this page can
          switch to live verification activity.{" "}
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
              key={card.template.name}
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
                  #{card.rank}
                </span>
                <span
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
                </span>
              </div>

              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  alignSelf: "flex-start",
                  borderRadius: 999,
                  padding: "6px 10px",
                  border: `1px solid ${card.template.badge.color}44`,
                  background: `${card.template.badge.color}22`,
                }}
              >
                <span
                  style={{
                    width: 16,
                    height: 16,
                    borderRadius: "50%",
                    background: card.template.badge.color,
                    display: "inline-block",
                  }}
                />
                <span
                  style={{ fontSize: 13, fontWeight: 700, color: "#e6edf3" }}
                >
                  {card.template.badge.label}
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
                {card.template.claim}
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
                  {card.template.status}
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
                  risk: {card.template.risk ?? "unknown"}
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
                  <span>{card.template.name}</span>
                  <span>{hostOf(card.template.target.api_url)}</span>
                </div>

                <ProveButton templateName={card.template.name} />
              </div>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
