import { useCallback, useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router";
import Nav from "../components/Nav";
import ProveButton from "../components/ProveButton";
import { REGISTRY_URL } from "../lib/config";
import { DEMO_APP } from "../lib/demo";

// An app (e.g. a Discord bot) sends its user here with a one-time code to
// link their account there to a unique Singpass person. See verifier/src/apps.ts.

const TEMPLATE = "identity/singpass-unique-person";

type Challenge = {
  app_id: string;
  app_name: string;
  subject: string;
  status: "pending" | "needs_confirmation" | "completed" | "rejected" | "expired";
  expires_at: number;
  move_from: string | null;
  reason: string | null;
};

async function fetchChallenge(code: string): Promise<Challenge | null> {
  const res = await fetch(`${REGISTRY_URL}/challenges/${encodeURIComponent(code)}`);
  return res.ok ? ((await res.json()) as Challenge) : null;
}

export default function BindPage() {
  const [params] = useSearchParams();
  const code = params.get("code") ?? "";
  const [challenge, setChallenge] = useState<Challenge | null | "missing">(null);
  const [waiting, setWaiting] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const refresh = useCallback(async () => {
    const ch = code ? await fetchChallenge(code) : null;
    setChallenge(ch ?? "missing");
    return ch;
  }, [code]);

  useEffect(() => {
    let cancelled = false;
    (code ? fetchChallenge(code) : Promise.resolve(null)).then((ch) => !cancelled && setChallenge(ch ?? "missing"));
    return () => {
      cancelled = true;
    };
  }, [code]);

  // The verifier completes the link in the background after the proof.
  async function waitForResult() {
    setWaiting(true);
    for (let i = 0; i < 20; i++) {
      await new Promise((r) => setTimeout(r, 1000));
      const ch = await refresh();
      if (ch && ch.status !== "pending") break;
    }
    setWaiting(false);
  }

  async function confirmMove() {
    setConfirming(true);
    await fetch(`${REGISTRY_URL}/challenges/${encodeURIComponent(code)}/confirm`, { method: "POST" });
    await refresh();
    setConfirming(false);
  }

  return (
    <main style={{ minHeight: "100vh", background: "#0d1117", color: "#e6edf3", fontFamily: "Inter, sans-serif" }}>
      <title>Link your account · zeroknowledger</title>
      <Nav />
      <section style={{ maxWidth: 620, margin: "0 auto", padding: "56px 24px 80px" }}>
        {challenge === null && <p style={{ color: "#8b949e" }}>Loading…</p>}
        {challenge === "missing" && (
          <Card>
            <h1 style={h1}>Link not found</h1>
            <p style={muted}>This link is invalid. Ask the app for a new one.</p>
          </Card>
        )}
        {challenge && challenge !== "missing" && (
          <Card>
            <p style={eyebrow}>Account link</p>
            <h1 style={h1}>
              {challenge.app_name} wants to confirm you&apos;re a unique person
            </h1>
            <p style={muted}>
              For its account <code style={code_}>{challenge.subject}</code>. You&apos;ll prove with TLSNotary that you hold a
              Singpass account. Your Singpass ID and mobile number stay on this device: your browser makes a zero-knowledge
              proof from them, and {challenge.app_name} receives only an app-specific ID. It never gets your Singpass ID, name,
              email or phone.
            </p>
            <ul style={{ ...muted, paddingLeft: 20, margin: "14px 0 20px" }}>
              <li>
                {challenge.app_name} learns you&apos;re a verified, unique Singpass holder. Not who you are, and not your
                accounts in other apps.
              </li>
              <li>
                One person (Singpass ID and current mobile number) can link one account in {challenge.app_name} at a time.
              </li>
              <li>Linking a different account later moves it, and the old one loses the link.</li>
              <li>
                <Link to="/singpass/privacy" style={{ color: "#7ee787" }}>
                  How your details stay private →
                </Link>
              </li>
            </ul>

            {challenge.status === "pending" &&
              (waiting ? (
                <p style={{ color: "#7ee787" }}>Proof verified, linking…</p>
              ) : (
                <div style={{ maxWidth: 280 }}>
                  <ProveButton
                    templateName={TEMPLATE}
                    // app: the enclave keys the person id per app (verifier/gcp/enclave).
                    sessionData={{ challenge: code, app: challenge.app_id }}
                    onProved={waitForResult}
                    label="Prove with Singpass"
                  />
                  <p style={{ ...muted, fontSize: 12, marginTop: 10 }}>
                    Singpass may ask you to log in again: it&apos;s the &ldquo;Manage your Singpass account&rdquo; area.
                  </p>
                </div>
              ))}

            {challenge.status === "needs_confirmation" && (
              <div style={notice("#d29922")}>
                <p style={{ marginBottom: 12 }}>
                  Your Singpass is already linked to <code style={code_}>{challenge.move_from}</code> in{" "}
                  {challenge.app_name}. Move it to <code style={code_}>{challenge.subject}</code>? The other account will
                  lose its link.
                </p>
                <button onClick={confirmMove} disabled={confirming} style={button("#d29922")}>
                  {confirming ? "Moving…" : "Move link"}
                </button>
              </div>
            )}

            {challenge.status === "completed" && (
              <div style={notice("#7ee787")}>
                ✓ Linked. You can go back to {challenge.app_name}.
                {challenge.app_id === DEMO_APP && (
                  <>
                    {" "}
                    <Link to="/example-app" style={{ color: "#7ee787", fontWeight: 600 }}>
                      Back to Example App →
                    </Link>
                  </>
                )}
              </div>
            )}
            {challenge.status === "rejected" && (
              <div style={notice("#f85149")}>Not linked: {challenge.reason ?? "the proof didn't qualify"}.</div>
            )}
            {challenge.status === "expired" && (
              <div style={notice("#8b949e")}>This link has expired. Ask {challenge.app_name} for a new one.</div>
            )}
          </Card>
        )}
      </section>
    </main>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return <div style={{ border: "1px solid #1f2937", borderRadius: 12, background: "#161b22", padding: 24 }}>{children}</div>;
}

const eyebrow = {
  fontSize: 13,
  fontWeight: 700,
  color: "#7ee787",
  letterSpacing: 1.4,
  textTransform: "uppercase",
  marginBottom: 10,
} as const;
const h1 = { fontSize: "clamp(22px, 4vw, 30px)", letterSpacing: "-0.6px", lineHeight: 1.2, marginBottom: 12 } as const;
const muted = { color: "#8b949e", fontSize: 14, lineHeight: 1.65 } as const;
const code_ = { color: "#9fb3c8", fontFamily: "'JetBrains Mono', monospace", overflowWrap: "anywhere" } as const;
const notice = (color: string) =>
  ({ border: `1px solid ${color}55`, background: `${color}12`, color: "#e6edf3", borderRadius: 10, padding: 16, fontSize: 14, lineHeight: 1.6 }) as const;
const button = (color: string) =>
  ({ background: color, color: "#0d1117", border: "none", borderRadius: 8, padding: "10px 16px", fontWeight: 700, cursor: "pointer" }) as const;
