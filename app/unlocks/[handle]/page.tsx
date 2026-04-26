import Nav from "@/app/components/Nav";
import Link from "next/link";

type PageProps = {
  params: Promise<{ handle: string }>;
  searchParams: Promise<{
    badge?: string;
    type?: string;
    title?: string;
    desc?: string;
    url?: string;
  }>;
};

const TYPE_META: Record<
  string,
  { label: string; color: string; bg: string; border: string }
> = {
  defi: { label: "DeFi", color: "#79c0ff", bg: "#0d1f3c", border: "#1f3a5c" },
  perks: { label: "Perks", color: "#7ee787", bg: "#1a2e1a", border: "#2a4a2a" },
  access: {
    label: "Access",
    color: "#d2a8ff",
    bg: "#2a1a3a",
    border: "#3a2a5a",
  },
  airdrop: {
    label: "Airdrop",
    color: "#ffa657",
    bg: "#2e2200",
    border: "#4a3800",
  },
  signal: {
    label: "Signal",
    color: "#9fb3c8",
    bg: "#1a2530",
    border: "#2d3742",
  },
};

const NAV_LINK = { color: "#8b949e", textDecoration: "none" } as const;

export default async function UnlockClaimPage({
  params,
  searchParams,
}: PageProps) {
  const { handle } = await params;
  const {
    badge,
    type = "perks",
    title,
    desc,
    url: claimUrl,
  } = await searchParams;

  const typeMeta = TYPE_META[type] ?? TYPE_META.perks;
  const isValid = Boolean(badge && title);

  const badgeLabel = badge ? badge.split("/").pop()?.replace(/-/g, " ") : null;

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#0d1117",
        color: "#e6edf3",
        fontFamily: "Inter, sans-serif",
      }}
    >
      <Nav activeTab="unlocks" />
      <section
        style={{ maxWidth: 680, margin: "0 auto", padding: "56px 32px" }}
      >
        {!isValid ? (
          <div
            style={{
              border: "1px dashed #2d3742",
              borderRadius: 12,
              padding: 32,
              textAlign: "center",
              color: "#8b949e",
            }}
          >
            <div style={{ fontSize: 15, marginBottom: 8 }}>
              Invalid unlock link
            </div>
            <div style={{ fontSize: 13 }}>
              Missing required parameters. Go back to{" "}
              <Link href="/unlocks" style={{ color: "#7ee787" }}>
                /unlocks
              </Link>{" "}
              to create a valid offer.
            </div>
          </div>
        ) : (
          <>
            {/* Issuer */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                marginBottom: 24,
              }}
            >
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 8,
                  background: "linear-gradient(135deg, #7ee787, #56d364)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 16,
                  fontWeight: 800,
                  color: "#0d1117",
                  flexShrink: 0,
                }}
              >
                {handle[0]?.toUpperCase()}
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 15 }}>@{handle}</div>
                <div style={{ fontSize: 12, color: "#8b949e" }}>
                  is offering a reward
                </div>
              </div>
            </div>

            {/* Reward card */}
            <div
              style={{
                border: `1px solid ${typeMeta.border}`,
                borderRadius: 14,
                background: typeMeta.bg,
                padding: 28,
                marginBottom: 24,
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  marginBottom: 16,
                }}
              >
                <span
                  style={{
                    border: `1px solid ${typeMeta.border}`,
                    borderRadius: 999,
                    padding: "3px 10px",
                    fontSize: 11,
                    fontWeight: 700,
                    color: typeMeta.color,
                    textTransform: "uppercase",
                    letterSpacing: 0.7,
                  }}
                >
                  {typeMeta.label}
                </span>
              </div>
              <h1
                style={{
                  fontSize: "clamp(22px, 4vw, 32px)",
                  letterSpacing: "-0.8px",
                  lineHeight: 1.15,
                  marginBottom: 12,
                  marginTop: 0,
                }}
              >
                {title}
              </h1>
              {desc && (
                <p
                  style={{
                    color: "#8b949e",
                    fontSize: 15,
                    lineHeight: 1.6,
                    margin: "0 0 20px",
                  }}
                >
                  {desc}
                </p>
              )}

              {/* Required badge */}
              <div
                style={{
                  border: "1px solid #2d3742",
                  borderRadius: 10,
                  background: "#0d1117",
                  padding: "14px 16px",
                  marginBottom: 20,
                }}
              >
                <div
                  style={{ fontSize: 12, color: "#8b949e", marginBottom: 8 }}
                >
                  Required badge
                </div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 12,
                  }}
                >
                  <div>
                    <div
                      style={{
                        fontSize: 14,
                        fontWeight: 700,
                        textTransform: "capitalize",
                      }}
                    >
                      {badgeLabel}
                    </div>
                    <div
                      style={{ fontSize: 12, color: "#556070", marginTop: 2 }}
                    >
                      {badge}
                    </div>
                  </div>
                  <Link
                    href={`/badges`}
                    style={{
                      fontSize: 12,
                      color: "#7ee787",
                      textDecoration: "none",
                      border: "1px solid #2a4a2a",
                      borderRadius: 6,
                      padding: "5px 10px",
                      whiteSpace: "nowrap",
                    }}
                  >
                    Get badge →
                  </Link>
                </div>
              </div>

              {/* Claim button */}
              {claimUrl ? (
                <a
                  href={claimUrl}
                  rel="noopener noreferrer"
                  target="_blank"
                  style={{
                    display: "block",
                    textAlign: "center",
                    background: "#7ee787",
                    color: "#0d1117",
                    fontWeight: 700,
                    fontSize: 15,
                    borderRadius: 9,
                    padding: "13px 20px",
                    textDecoration: "none",
                  }}
                >
                  Claim reward →
                </a>
              ) : (
                <div
                  style={{
                    textAlign: "center",
                    color: "#556070",
                    fontSize: 13,
                    border: "1px solid #2d3742",
                    borderRadius: 9,
                    padding: "13px 20px",
                  }}
                >
                  No claim URL provided
                </div>
              )}
            </div>

            {/* How it works */}
            <div
              style={{
                border: "1px solid #1f2937",
                borderRadius: 12,
                background: "#161b22",
                padding: 20,
              }}
            >
              <h2 style={{ fontSize: 14, marginBottom: 12, marginTop: 0 }}>
                How to claim
              </h2>
              <ol
                style={{
                  color: "#8b949e",
                  paddingLeft: 20,
                  lineHeight: 1.85,
                  margin: 0,
                  fontSize: 13,
                }}
              >
                <li>
                  Generate a{" "}
                  <strong style={{ color: "#e6edf3" }}>TLSNotary proof</strong>{" "}
                  for the{" "}
                  <span
                    style={{ color: "#e6edf3", textTransform: "capitalize" }}
                  >
                    {badgeLabel}
                  </span>{" "}
                  badge using the browser extension.
                </li>
                <li>
                  The proof cryptographically confirms eligibility without
                  revealing your raw account data.
                </li>
                <li>
                  Click{" "}
                  <strong style={{ color: "#e6edf3" }}>Claim reward</strong>{" "}
                  above and present your proof at the destination.
                </li>
              </ol>
              <div
                style={{
                  marginTop: 14,
                  display: "flex",
                  gap: 10,
                  flexWrap: "wrap",
                }}
              >
                <Link
                  href={`/badges`}
                  style={{
                    fontSize: 13,
                    color: "#7ee787",
                    textDecoration: "none",
                    border: "1px solid #2a4a2a",
                    borderRadius: 7,
                    padding: "7px 12px",
                  }}
                >
                  Browse badges
                </Link>
                <Link
                  href="/unlocks"
                  style={{
                    fontSize: 13,
                    color: "#8b949e",
                    textDecoration: "none",
                    border: "1px solid #2d3742",
                    borderRadius: 7,
                    padding: "7px 12px",
                  }}
                >
                  All unlocks
                </Link>
              </div>
            </div>
          </>
        )}
      </section>
    </main>
  );
}
