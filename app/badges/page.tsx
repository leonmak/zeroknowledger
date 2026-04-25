import fs from "node:fs/promises";
import path from "node:path";
import Link from "next/link";

type TemplateIndexEntry = {
  name: string;
  file: string;
  status: "draft" | "tested" | "production" | "deprecated";
  category: string;
};

type TemplateIndex = {
  templates: TemplateIndexEntry[];
};

type BadgeTemplate = {
  name: string;
  status: "draft" | "tested" | "production" | "deprecated";
  risk?: "low" | "medium" | "high";
  claim: string;
  target: {
    url: string;
    auth: string;
  };
  badge: {
    label: string;
    icon: string;
    color: string;
  };
  tags?: string[];
};

type BadgeCard = {
  rank: number;
  activity: number;
  category: string;
  template: BadgeTemplate;
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

const STATUS_ACTIVITY_WEIGHT: Record<BadgeTemplate["status"], number> = {
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

function toActivityScore(
  entry: TemplateIndexEntry,
  template: BadgeTemplate,
): number {
  const categoryBase = CATEGORY_ACTIVITY_WEIGHT[entry.category] ?? 600;
  const statusBase = STATUS_ACTIVITY_WEIGHT[template.status] ?? 100;
  const riskModifier =
    template.risk === "low" ? 80 : template.risk === "medium" ? 40 : 10;
  const hashNoise = stableHash(entry.name) % 300;
  return categoryBase + statusBase + riskModifier + hashNoise;
}

function formatActivityCount(activity: number): string {
  if (activity >= 1000) {
    return `${(activity / 1000).toFixed(1)}k`;
  }
  return `${activity}`;
}

function extractHost(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

async function loadTopBadges(): Promise<BadgeCard[]> {
  const templatesDir = path.join(
    process.cwd(),
    "docs",
    "tlsnotary",
    "templates",
  );
  const indexPath = path.join(templatesDir, "index.json");
  const indexRaw = await fs.readFile(indexPath, "utf8");
  const index = JSON.parse(indexRaw) as TemplateIndex;

  const cards = await Promise.all(
    index.templates.map(async (entry) => {
      const templatePath = path.join(templatesDir, entry.file);
      const templateRaw = await fs.readFile(templatePath, "utf8");
      const template = JSON.parse(templateRaw) as BadgeTemplate;

      return {
        rank: 0,
        activity: toActivityScore(entry, template),
        category: entry.category,
        template,
      };
    }),
  );

  const sorted = cards.sort((a, b) => b.activity - a.activity);
  return sorted.map((card, indexPosition) => ({
    ...card,
    rank: indexPosition + 1,
  }));
}

export default async function BadgesPage() {
  const topBadges = await loadTopBadges();

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#0d1117",
        color: "#e6edf3",
        fontFamily: "Inter, sans-serif",
      }}
    >
      <nav
        style={{
          position: "sticky",
          top: 0,
          zIndex: 30,
          padding: "12px 32px",
          borderBottom: "1px solid #1f2937",
          background: "rgba(13,17,23,0.92)",
          backdropFilter: "blur(12px)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div
            style={{
              width: 22,
              height: 22,
              borderRadius: 5,
              background: "linear-gradient(135deg, #7ee787, #56d364)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 13,
              fontWeight: 800,
              color: "#0d1117",
            }}
          >
            Z
          </div>
          <span
            style={{ fontWeight: 800, fontSize: 15, letterSpacing: "-0.3px" }}
          >
            zeroknowledger
          </span>
          <div
            style={{ display: "flex", gap: 16, marginLeft: 20, fontSize: 14 }}
          >
            <Link href="/" style={{ color: "#8b949e", textDecoration: "none" }}>
              Home
            </Link>
            <span style={{ color: "#e6edf3" }}>Badges</span>
            <Link
              href="/cases"
              style={{ color: "#8b949e", textDecoration: "none" }}
            >
              Cases
            </Link>
          </div>
        </div>
        <Link
          href="/"
          style={{
            textDecoration: "none",
            border: "1px solid #30363d",
            borderRadius: 8,
            color: "#e6edf3",
            padding: "8px 14px",
            fontSize: 13,
            fontWeight: 600,
          }}
        >
          Back to landing
        </Link>
      </nav>

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
          switch to live verification activity.
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
            href="/cases/sarah?badges=income%2Fstripe-monthly-volume%2Cdev%2Fgithub-account-age%2Ccredential%2Faws-certified-badge"
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
                  fontSize: 12,
                  color: "#556070",
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 8,
                }}
              >
                <span>{card.template.name}</span>
                <span>{extractHost(card.template.target.url)}</span>
              </div>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
