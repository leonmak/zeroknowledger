import { useParams, useSearchParams } from "react-router";
import Nav from "../components/Nav";
import { getTemplate, hostOf, type Template } from "../lib/templates";

type CaseBadge = {
  category: string;
  template: Template;
};

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

export default function CaseProfilePage() {
  const { handle = "" } = useParams();
  const [searchParams] = useSearchParams();
  const badgesRaw = searchParams.get("badges") ?? undefined;

  // Holder ids show badges the verifier actually issued; handles below are
  // the older self-declared example pages.

  const selectedBadgeIds = parseBadges(badgesRaw);

  const badges = selectedBadgeIds
    .map((name) => getTemplate(name))
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
      <title>{`@${handle} · zeroknowledger`}</title>
      <Nav activeTab="cases" />

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
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            marginBottom: 8,
          }}
        >
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 5,
              border: "1px solid #238636",
              background: "#12261e",
              borderRadius: 999,
              padding: "3px 10px",
              fontSize: 12,
              color: "#7ee787",
              fontWeight: 600,
            }}
          >
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                background: "#7ee787",
                display: "inline-block",
              }}
            />
            TLSNotary
          </span>
        </div>
        <p
          style={{
            color: "#8b949e",
            fontSize: 16,
            lineHeight: 1.65,
            maxWidth: 720,
          }}
        >
          Each badge below is backed by a TLSNotary proof generated from a real
          TLS session. Raw proof transcripts and account data are not shared in
          this view.
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
                  <span
                    style={{
                      border: "1px solid #1a3a2a",
                      borderRadius: 999,
                      padding: "2px 8px",
                      fontSize: 11,
                      color: "#7ee787",
                      background: "#0d2018",
                    }}
                  >
                    TLS {template.target.tls_min ?? "1.2"}+
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
                    auth: {template.target.auth.strategy}
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
                  <span>{hostOf(template.target.api_url)}</span>
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
            How TLSNotary proofs are stored
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
              Raw TLS transcripts and session data{" "}
              <strong style={{ color: "#e6edf3" }}>
                never leave your device
              </strong>
              .
            </li>
            <li>
              The TLSNotary notary co-signs the session without seeing your
              plaintext data — only the redacted extract is shared.
            </li>
            <li>
              This page references badge IDs and signed claim metadata only. No
              proof material is exposed here.
            </li>
            <li>
              Optional: store encrypted attestations in the cloud for
              convenience. Plaintext proofs should never be uploaded.
            </li>
          </ul>
        </div>
      </section>
    </main>
  );
}
