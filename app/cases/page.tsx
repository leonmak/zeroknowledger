import Link from "next/link";

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
            <span style={{ color: "#e6edf3" }}>Cases</span>
          </div>
        </div>
      </nav>

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
          A case page is a public profile view generated from badge template IDs
          in the URL. For now, this is a privacy-first sharing model that does
          not require uploading raw proof files to the cloud.
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
          <h2 style={{ fontSize: 18, marginBottom: 10 }}>How to share</h2>
          <ol
            style={{
              color: "#8b949e",
              paddingLeft: 20,
              lineHeight: 1.8,
              margin: 0,
            }}
          >
            <li>Choose a public handle, for example: sarah.</li>
            <li>
              Add badge IDs as comma-separated values in the badges query
              parameter.
            </li>
            <li>Share the generated link.</li>
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
      </section>
    </main>
  );
}
