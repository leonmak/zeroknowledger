import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router";
import Nav from "../components/Nav";
import { DEMO_APP, demoSubject, fetchDemoBinding, startDemoLink, type DemoBinding } from "../lib/demo";

// A mock third-party app ("Example App") showing what an app's users see: their
// profile with the Verified Person badge when linked, or a placeholder and a
// "Verify with zeroknowledger" button when not. The app only ever learns an
// app-specific id (pairwise_id), never who the person is.

export default function ExampleAppPage() {
  const navigate = useNavigate();
  const subject = demoSubject();
  const [binding, setBinding] = useState<DemoBinding | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchDemoBinding(subject)
      .then((b) => !cancelled && setBinding(b))
      .catch(() => !cancelled && setError("Couldn't reach the registry."));
    return () => {
      cancelled = true;
    };
  }, [subject]);

  async function verify() {
    setStarting(true);
    setError(null);
    try {
      navigate(`/bind?code=${await startDemoLink(subject)}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setStarting(false);
    }
  }

  return (
    <main style={{ minHeight: "100vh", background: "#0d1117", color: "#e6edf3", fontFamily: "Inter, sans-serif" }}>
      <title>Example App · zeroknowledger</title>
      <Nav />
      <section style={{ maxWidth: 560, margin: "0 auto", padding: "48px 24px 96px" }}>
        <p style={{ fontSize: 12, color: "#8b949e", textTransform: "uppercase", letterSpacing: 1.2, marginBottom: 10 }}>
          Demo · a third-party app
        </p>
        <div style={{ border: "1px solid #d29922", borderRadius: 14, overflow: "hidden", background: "#161b22" }}>
          <div style={{ padding: "12px 18px", background: "#d2992222", borderBottom: "1px solid #d2992255", fontWeight: 700, color: "#d29922" }}>
            Example App
          </div>
          <div style={{ padding: 20, display: "flex", gap: 16, alignItems: "center" }}>
            <div
              aria-hidden
              style={{ width: 56, height: 56, borderRadius: "50%", background: "#30363d", display: "grid", placeItems: "center", fontSize: 22 }}
            >
              🙂
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 13, color: "#8b949e" }}>Your profile</div>
              <code style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 14 }}>{subject}</code>
              <div style={{ marginTop: 10 }}>
                {binding === null && !error && <span style={{ color: "#8b949e", fontSize: 13 }}>Checking…</span>}
                {binding?.bound === true && (
                  <Link
                    to={`/singpass/verified/${DEMO_APP}/${binding.pairwise_id}`}
                    title="Open the check page"
                    style={chip("#9F1239", "#e6edf3")}
                  >
                    <span style={dot("#9F1239")}>✓</span> Verified Person - SG
                  </Link>
                )}
                {binding?.bound === false && (
                  <span style={chip("#30363d", "#8b949e")}>
                    <span style={dot("#30363d")}>?</span> Not verified
                  </span>
                )}
              </div>
            </div>
          </div>
          <div style={{ padding: "0 20px 20px" }}>
            {binding?.bound === false && (
              <button onClick={verify} disabled={starting} style={button}>
                {starting ? "Opening…" : "Verify with zeroknowledger"}
              </button>
            )}
            {binding?.bound === true && (
              <p style={{ fontSize: 13, color: "#8b949e", lineHeight: 1.6 }}>
                Example App knows this account belongs to a unique Singpass holder, by the id{" "}
                <code style={{ fontFamily: "'JetBrains Mono', monospace" }}>{binding.pairwise_id.slice(0, 12)}…</code>. It
                doesn&apos;t know who you are, and other apps get a different id.
              </p>
            )}
            {error && <p style={{ color: "#f85149", fontSize: 13, marginTop: 10 }}>{error}</p>}
          </div>
        </div>
        <p style={{ fontSize: 13, color: "#8b949e", lineHeight: 1.6, marginTop: 16 }}>
          This demo app is run by zeroknowledger so you can try the flow. A real app creates the link from its own server
          with its API key, and gets the result by webhook or by looking up its account.
        </p>
      </section>
    </main>
  );
}

const chip = (border: string, color: string) =>
  ({
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    padding: "5px 12px 5px 6px",
    borderRadius: 999,
    border: `1px solid ${border}`,
    background: `${border}33`,
    color,
    fontSize: 13,
    fontWeight: 600,
    textDecoration: "none",
  }) as const;
const dot = (bg: string) =>
  ({ width: 20, height: 20, borderRadius: "50%", background: bg, color: "#fff", display: "grid", placeItems: "center", fontSize: 12 }) as const;
const button = {
  padding: "10px 18px",
  borderRadius: 8,
  border: "none",
  background: "#7ee787",
  color: "#0d1117",
  fontWeight: 700,
  fontSize: 14,
  cursor: "pointer",
} as const;
