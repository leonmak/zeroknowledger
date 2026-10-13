import { useEffect, useState } from "react";
import { Link } from "react-router";
import Nav from "../components/Nav";
import { fetchBadges, forgetDevice, type IssuedBadge } from "../lib/holder";

type Load =
  | { state: "loading" }
  | { state: "error" }
  | { state: "done"; badges: IssuedBadge[] };

/** This browser's issued badges, as recorded by the verifier (only its holder can list them). */
export default function HolderPage() {
  const [load, setLoad] = useState<Load>({ state: "loading" });

  useEffect(() => {
    let cancelled = false;
    fetchBadges()
      .then((badges) => !cancelled && setLoad({ state: "done", badges }))
      .catch(() => !cancelled && setLoad({ state: "error" }));
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#0d1117",
        color: "#e6edf3",
        fontFamily: "Inter, sans-serif",
      }}
    >
      <title>Badges on this device · zeroknowledger</title>
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
          Your verified badges
        </p>
        <h1
          style={{
            fontSize: "clamp(22px, 3.4vw, 34px)",
            letterSpacing: "-0.6px",
            lineHeight: 1.2,
            marginBottom: 12,
          }}
        >
          Badges on this device
        </h1>
        <p
          style={{
            color: "#8b949e",
            fontSize: 15,
            lineHeight: 1.65,
            maxWidth: 720,
          }}
        >
          Each badge here was issued by our verifier after checking a TLSNotary
          proof against the site it names. Only the fields the badge needs were
          revealed; the rest of the account data never left the holder&apos;s
          browser. Nobody else can open this page for you: it&apos;s listed with
          a secret kept in this browser.
        </p>
      </section>

      <section
        style={{ maxWidth: 1100, margin: "0 auto", padding: "12px 32px 80px" }}
      >
        {load.state === "loading" && (
          <p style={{ color: "#8b949e" }}>Loading…</p>
        )}
        {load.state === "error" && (
          <p style={{ color: "#f85149" }}>
            Couldn&apos;t reach the verifier. Try again shortly.
          </p>
        )}
        {load.state === "done" && load.badges.length === 0 && (
          <div
            style={{
              border: "1px dashed #2d3742",
              borderRadius: 12,
              padding: 22,
              color: "#8b949e",
            }}
          >
            No badges issued yet.{" "}
            <Link to="/badges" style={{ color: "#7ee787" }}>
              Prove one
            </Link>
            .
          </div>
        )}
        {load.state === "done" && load.badges.length > 0 && (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
              gap: 14,
            }}
          >
            {load.badges.map((b) => {
              const color = b.badge?.color ?? "#8b949e";
              return (
                <article
                  key={b.template}
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
                      border: `1px solid ${color}44`,
                      background: `${color}22`,
                    }}
                  >
                    <span
                      style={{
                        width: 16,
                        height: 16,
                        borderRadius: "50%",
                        background: color,
                        display: "inline-block",
                      }}
                    />
                    <span style={{ fontSize: 13, fontWeight: 700 }}>
                      {b.badge?.label ?? b.template}
                    </span>
                  </div>
                  <p
                    style={{
                      color: "#8b949e",
                      fontSize: 13,
                      lineHeight: 1.6,
                      margin: "12px 0 0",
                    }}
                  >
                    Proved {new Date(b.proved_at).toLocaleString()}
                  </p>
                  <div
                    style={{
                      borderTop: "1px solid #1f2937",
                      marginTop: 12,
                      paddingTop: 10,
                      fontSize: 12,
                      color: "#556070",
                    }}
                  >
                    {b.template}
                  </div>
                </article>
              );
            })}
          </div>
        )}
        {load.state === "done" && <ForgetDevice count={load.badges.length} onForgotten={() => setLoad({ state: "done", badges: [] })} />}
      </section>
    </main>
  );
}

/** Removes this browser's holder secret, optionally deleting its badges from the registry. */
function ForgetDevice({ count, onForgotten }: { count: number; onForgotten: () => void }) {
  const [open, setOpen] = useState(false);
  const [deleteBadges, setDeleteBadges] = useState(true);
  const [state, setState] = useState<"idle" | "working" | "done" | { error: string }>("idle");

  async function forget() {
    setState("working");
    try {
      await forgetDevice({ deleteBadges });
      setState("done");
      onForgotten();
    } catch (e) {
      setState({ error: e instanceof Error ? e.message : String(e) });
    }
  }

  const box = { marginTop: 28, border: "1px solid #30363d", borderRadius: 12, padding: 18, maxWidth: 620 } as const;
  const muted = { color: "#8b949e", fontSize: 13, lineHeight: 1.6 } as const;
  if (state === "done") {
    return (
      <div style={box}>
        <p style={{ fontSize: 14 }}>
          This device is forgotten{deleteBadges ? " and its badges are deleted" : ""}. Your next proof starts fresh.
        </p>
      </div>
    );
  }
  if (!open) {
    return (
      <button onClick={() => setOpen(true)} style={{ ...btn("#f85149"), marginTop: 28 }}>
        Forget this device
      </button>
    );
  }
  return (
    <div style={box}>
      <p style={{ fontSize: 14, marginBottom: 8 }}>Forget this device?</p>
      <p style={muted}>
        This removes the secret this browser uses for your badges, so this page will be empty and your next proof starts a
        new list. Accounts you&apos;ve linked in apps stay verified: those links are kept per app, not on this device.
      </p>
      <label style={{ ...muted, display: "flex", gap: 8, alignItems: "center", margin: "12px 0 14px", color: "#c9d1d9" }}>
        <input type="checkbox" checked={deleteBadges} onChange={(e) => setDeleteBadges(e.target.checked)} />
        Also delete {count === 1 ? "this badge" : `these ${count} badges`} from zeroknowledger
      </label>
      <div style={{ display: "flex", gap: 10 }}>
        <button onClick={forget} disabled={state === "working"} style={btn("#f85149")}>
          {state === "working" ? "Forgetting…" : "Forget this device"}
        </button>
        <button onClick={() => setOpen(false)} disabled={state === "working"} style={btn("#8b949e")}>
          Cancel
        </button>
      </div>
      {typeof state === "object" && <p style={{ color: "#f85149", fontSize: 13, marginTop: 10 }}>{state.error}</p>}
    </div>
  );
}

const btn = (color: string) =>
  ({
    padding: "8px 14px",
    borderRadius: 8,
    border: `1px solid ${color}66`,
    background: `${color}1a`,
    color,
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
  }) as const;
