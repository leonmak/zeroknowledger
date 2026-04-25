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
  claim: string;
  status: "draft" | "tested" | "production" | "deprecated";
  risk?: "low" | "medium" | "high";
  badge: {
    label: string;
    icon: string;
    color: string;
  };
  target: {
    url: string;
    auth: string;
  };
};

type CaseBadge = {
  category: string;
  template: BadgeTemplate;
};

async function loadTemplateMap(): Promise<Map<string, CaseBadge>> {
  const templatesDir = path.join(
    process.cwd(),
    "docs",
    "tlsnotary",
    "templates",
  );
  const indexRaw = await fs.readFile(
    path.join(templatesDir, "index.json"),
    "utf8",
  );
  const index = JSON.parse(indexRaw) as TemplateIndex;

  const entries = await Promise.all(
    index.templates.map(async (entry) => {
      const templateRaw = await fs.readFile(
        path.join(templatesDir, entry.file),
        "utf8",
      );
      const template = JSON.parse(templateRaw) as BadgeTemplate;
      return [entry.name, { category: entry.category, template }] as const;
    }),
  );

  return new Map(entries);
}

function parseBadges(raw?: string): string[] {
  if (!raw) {
    return [
      "income/stripe-monthly-volume",
      "dev/github-account-age",
      "credential/aws-certified-badge",
    ];
  }

  return raw
    .split(",")
    .map((value) => decodeURIComponent(value.trim()))
    .filter(Boolean)
    .slice(0, 12);
}

function hostFromUrl(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

type PageProps = {
  params: Promise<{ handle: string }>;
  searchParams: Promise<{ badges?: string }>;
};

export default async function CaseProfilePage({
  params,
  searchParams,
}: PageProps) {
  const { handle } = await params;
  const { badges: badgesRaw } = await searchParams;

  const templateMap = await loadTemplateMap();
  const selectedBadgeIds = parseBadges(badgesRaw);

  const badges = selectedBadgeIds
    .map((name) => templateMap.get(name))
    .filter((entry): entry is CaseBadge => Boolean(entry));

  const shareQuery = encodeURIComponent(selectedBadgeIds.join(","));

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
          <span style={{ fontWeight: 800, fontSize: 15 }}>zeroknowledger</span>
          <div
            style={{ display: "flex", gap: 16, marginLeft: 20, fontSize: 14 }}
          >
            <Link href="/" style={{ color: "#8b949e", textDecoration: "none" }}>
              Home
            </Link>
            <Link
              href="/badges"
              style={{ color: "#8b949e", textDecoration: "none" }}
            >
              Badges
            </Link>
            <Link
              href="/cases"
              style={{ color: "#e6edf3", textDecoration: "none" }}
            >
              Cases
            </Link>
          </div>
        </div>
      </nav>

      <section
        style={{ maxWidth: 1100, margin: "0 auto", padding: "52px 32px 16px" }}
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
          Public case profile
        </p>
        <h1
          style={{
            fontSize: "clamp(30px, 4.8vw, 50px)",
            letterSpacing: "-1.2px",
            lineHeight: 1.1,
            marginBottom: 12,
          }}
        >
          @{handle}
        </h1>
        <p
          style={{
            color: "#8b949e",
            fontSize: 16,
            lineHeight: 1.65,
            maxWidth: 720,
          }}
        >
          This page shows badge claims selected by the user. Raw TLSNotary proof
          material is not exposed in this view.
        </p>
      </section>

      <section
        style={{ maxWidth: 1100, margin: "0 auto", padding: "12px 32px 48px" }}
      >
        <div
          style={{
            border: "1px solid #1f2937",
            borderRadius: 12,
            background: "#161b22",
            padding: 16,
            marginBottom: 20,
          }}
        >
          <div style={{ fontSize: 13, color: "#8b949e", marginBottom: 8 }}>
            Share link
          </div>
          <div
            style={{
              border: "1px solid #2d3742",
              borderRadius: 8,
              background: "#0d1117",
              padding: "10px 12px",
              fontSize: 12,
              color: "#9fb3c8",
              overflowX: "auto",
            }}
          >
            /cases/{handle}?badges={shareQuery}
          </div>
        </div>

        {badges.length === 0 ? (
          <div
            style={{
              border: "1px dashed #2d3742",
              borderRadius: 12,
              padding: 22,
              color: "#8b949e",
            }}
          >
            No valid badge IDs found in this link. Add a badges query parameter
            and try again.
          </div>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
              gap: 14,
            }}
          >
            {badges.map(({ category, template }) => (
              <article
                key={template.name}
                style={{
                  border: "1px solid #1f2937",
                  borderRadius: 12,
                  background: "#161b22",
                  padding: 18,
                }}
              >
                <div
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 8,
                    borderRadius: 999,
                    padding: "6px 10px",
                    border: `1px solid ${template.badge.color}44`,
                    background: `${template.badge.color}22`,
                  }}
                >
                  <span
                    style={{
                      width: 16,
                      height: 16,
                      borderRadius: "50%",
                      background: template.badge.color,
                      display: "inline-block",
                    }}
                  />
                  <span style={{ fontSize: 13, fontWeight: 700 }}>
                    {template.badge.label}
                  </span>
                </div>

                <p
                  style={{
                    color: "#8b949e",
                    fontSize: 13,
                    lineHeight: 1.6,
                    margin: "12px 0",
                  }}
                >
                  {template.claim}
                </p>

                <div
                  style={{
                    display: "flex",
                    gap: 8,
                    flexWrap: "wrap",
                    marginBottom: 10,
                  }}
                >
                  <span
                    style={{
                      border: "1px solid #2d3742",
                      borderRadius: 999,
                      padding: "2px 8px",
                      fontSize: 11,
                      color: "#9fb3c8",
                    }}
                  >
                    {category}
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
                    {template.status}
                  </span>
                </div>

                <div
                  style={{
                    borderTop: "1px solid #1f2937",
                    paddingTop: 10,
                    fontSize: 12,
                    color: "#556070",
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 8,
                  }}
                >
                  <span>{template.name}</span>
                  <span>{hostFromUrl(template.target.url)}</span>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section
        style={{ maxWidth: 1100, margin: "0 auto", padding: "0 32px 80px" }}
      >
        <div
          style={{
            border: "1px solid #1f2937",
            borderRadius: 12,
            background: "#0f1620",
            padding: 18,
          }}
        >
          <h2 style={{ fontSize: 16, marginBottom: 8 }}>
            Storage model for badges
          </h2>
          <ul
            style={{
              margin: 0,
              paddingLeft: 20,
              color: "#8b949e",
              lineHeight: 1.7,
            }}
          >
            <li>
              Users do not need to upload raw TLS transcripts to the cloud to
              share this page.
            </li>
            <li>
              This page can run from badge references and signed claim metadata
              only.
            </li>
            <li>
              Optional cloud sync can store encrypted attestations for
              convenience, not plaintext proofs.
            </li>
          </ul>
        </div>
      </section>
    </main>
  );
}
