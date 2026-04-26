import Link from "next/link";
import Nav from "../components/Nav";

const exampleBadges = [
  "income/stripe-monthly-volume",
  "dev/github-account-age",
  "credential/aws-certified-badge",
];

const exampleQuery = encodeURIComponent(exampleBadges.join(","));

export default function CasesIndexPage() {
  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#0d1117",
        color: "#e6edf3",
        fontFamily: "Inter, sans-serif",
      }}
    >
      <Nav activeTab="cases" />

      <section
        style={{ maxWidth: 900, margin: "0 auto", padding: "56px 32px" }}
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
          Shareable case links
        </p>
        <h1
          style={{
            fontSize: "clamp(32px, 5vw, 52px)",
            letterSpacing: "-1.3px",
            lineHeight: 1.08,
            marginBottom: 12,
          }}
        >
          Show what badges you have
        </h1>
        <p
          style={{
            color: "#8b949e",
            fontSize: 16,
            lineHeight: 1.65,
            maxWidth: 720,
          }}
        >
          Each badge on a case page is backed by a{" "}
          <strong style={{ color: "#e6edf3" }}>TLSNotary proof</strong> —
          cryptographic evidence generated from a real TLS session. Raw proof
          transcripts are never uploaded; only signed claim metadata is shared.
        </p>

        <div
          style={{
            marginTop: 30,
            border: "1px solid #1f2937",
            borderRadius: 12,
            background: "#161b22",
            padding: 20,
          }}
        >
          <h2 style={{ fontSize: 18, marginBottom: 10 }}>
            How to create and share a case
          </h2>
          <ol
            style={{
              color: "#8b949e",
              paddingLeft: 20,
              lineHeight: 1.8,
              margin: 0,
            }}
          >
            <li>
              <span style={{ color: "#e6edf3" }}>Browse templates</span> at{" "}
              <a href="/badges" style={{ color: "#7ee787" }}>
                /badges
              </a>{" "}
              and note the IDs of badges you want to prove.
            </li>
            <li>
              <span style={{ color: "#e6edf3" }}>
                Generate a TLSNotary proof
              </span>{" "}
              for each badge using the browser extension. The extension opens
              the target URL (e.g. dashboard.stripe.com), captures the TLS
              session, applies the template&apos;s redaction rules, and returns
              a signed proof file.
            </li>
            <li>
              <span style={{ color: "#e6edf3" }}>Choose a public handle</span>,
              for example: <code style={{ color: "#9fb3c8" }}>sarah</code>.
            </li>
            <li>
              <span style={{ color: "#e6edf3" }}>Build your link</span> by
              adding badge IDs as comma-separated values in the{" "}
              <code style={{ color: "#9fb3c8" }}>badges</code> query parameter.
            </li>
            <li>Share the generated link — no cloud upload required.</li>
          </ol>

          <div
            style={{
              marginTop: 16,
              padding: "12px 14px",
              borderRadius: 8,
              border: "1px solid #2d3742",
              background: "#0d1117",
              fontSize: 13,
              color: "#9fb3c8",
              overflowX: "auto",
            }}
          >
            /cases/sarah?badges={exampleQuery}
          </div>

          <div
            style={{
              marginTop: 16,
              display: "flex",
              gap: 10,
              flexWrap: "wrap",
            }}
          >
            <Link
              href={`/cases/sarah?badges=${exampleQuery}`}
              style={{
                textDecoration: "none",
                background: "#7ee787",
                color: "#0d1117",
                fontWeight: 700,
                fontSize: 14,
                borderRadius: 8,
                padding: "10px 14px",
              }}
            >
              Open example case
            </Link>
            <Link
              href="/badges"
              style={{
                textDecoration: "none",
                border: "1px solid #30363d",
                color: "#e6edf3",
                fontWeight: 600,
                fontSize: 14,
                borderRadius: 8,
                padding: "10px 14px",
              }}
            >
              Browse badge IDs
            </Link>
          </div>
        </div>

        <div
          style={{
            marginTop: 24,
            border: "1px solid #1f2937",
            borderRadius: 12,
            background: "#161b22",
            padding: 20,
          }}
        >
          <h2 style={{ fontSize: 18, marginBottom: 10 }}>
            How TLSNotary proofs work
          </h2>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
              gap: 14,
              marginTop: 12,
            }}
          >
            {(
              [
                [
                  "1. TLS Session",
                  "Extension intercepts your HTTPS connection to the target site using MPC-TLS.",
                ],
                [
                  "2. Extract",
                  "Template selector and regex pull only the relevant value from the page.",
                ],
                [
                  "3. Redact",
                  "All PII (emails, tokens, IDs) is stripped before the proof is finalised.",
                ],
                [
                  "4. Notarise",
                  "A TLSNotary notary co-signs the session, proving it came from a real site.",
                ],
                [
                  "5. Badge",
                  "You receive a compact signed proof file (~5 KB) — no server required.",
                ],
              ] as [string, string][]
            ).map(([title, desc]) => (
              <div
                key={title}
                style={{
                  border: "1px solid #2d3742",
                  borderRadius: 8,
                  padding: "12px 14px",
                  background: "#0d1117",
                }}
              >
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 700,
                    color: "#7ee787",
                    marginBottom: 4,
                  }}
                >
                  {title}
                </div>
                <div
                  style={{ fontSize: 12, color: "#8b949e", lineHeight: 1.5 }}
                >
                  {desc}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
