import { useEffect, useState } from "react";
import { Link, useParams } from "react-router";
import Nav from "../components/Nav";
import { REGISTRY_URL } from "../lib/config";

// Where an app's "Unique Singpass Person" badge links to. The URL carries the
// app and the app's own nickname for the person, so it confirms only "this
// account in this app is linked to a unique Singpass holder".

type Result =
  | { state: "loading" }
  | { state: "missing" }
  | { state: "ok"; appName: string; since: number };

export default function VerifiedPage() {
  const { appId = "", pairwise = "" } = useParams();
  const [result, setResult] = useState<Result>({ state: "loading" });

  useEffect(() => {
    let cancelled = false;
    fetch(
      `${REGISTRY_URL}/verify/${encodeURIComponent(appId)}/${encodeURIComponent(pairwise)}`,
    )
      .then(async (res) => {
        const body = (await res.json()) as {
          verified: boolean;
          app_name?: string;
          since?: number;
        };
        if (cancelled) return;
        setResult(
          body.verified
            ? {
                state: "ok",
                appName: body.app_name ?? appId,
                since: body.since ?? 0,
              }
            : { state: "missing" },
        );
      })
      .catch(() => !cancelled && setResult({ state: "missing" }));
    return () => {
      cancelled = true;
    };
  }, [appId, pairwise]);

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#0d1117",
        color: "#e6edf3",
        fontFamily: "Inter, sans-serif",
      }}
    >
      <title>Verified Person - SG · zeroknowledger</title>
      <Nav />
      <section
        style={{ maxWidth: 560, margin: "0 auto", padding: "64px 24px 96px" }}
      >
        {result.state === "loading" && (
          <p style={{ color: "#8b949e" }}>Checking…</p>
        )}
        {result.state === "missing" && (
          <div style={card("#30363d")}>
            <h1 style={h1}>Not verified</h1>
            <p style={muted}>
              This link isn&apos;t linked to a unique Singpass person right now.
              It may have been moved to another account, or the link is wrong.
            </p>
          </div>
        )}
        {result.state === "ok" && (
          <div style={card("#9F1239")}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                marginBottom: 16,
              }}
            >
              <span style={badge}>✓</span>
              <div>
                <div style={{ fontSize: 13, color: "#8b949e" }}>
                  Verified by zeroknowledger
                </div>
                <h1 style={{ ...h1, marginBottom: 0 }}>Verified Person - SG</h1>
              </div>
            </div>
            <p style={{ ...muted, marginBottom: 12 }}>
              This account in{" "}
              <strong style={{ color: "#e6edf3" }}>{result.appName}</strong> is
              linked to a real person who holds a Singpass account, and that
              person has no other account linked in {result.appName}.
            </p>
            <p style={{ ...muted, fontSize: 13 }}>
              Linked since{" "}
              {new Date(result.since).toLocaleDateString(undefined, {
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
              . This page doesn&apos;t say who they are, and it can&apos;t be
              used to find their accounts in other apps.
            </p>
          </div>
        )}
        <p style={{ ...muted, fontSize: 13, marginTop: 20 }}>
          <Link to="/singpass/privacy" style={{ color: "#7ee787" }}>
            How their details stay private →
          </Link>
        </p>
      </section>
    </main>
  );
}

const h1 = { fontSize: 26, letterSpacing: "-0.5px", marginBottom: 12 } as const;
const muted = { color: "#8b949e", fontSize: 15, lineHeight: 1.6 } as const;
const card = (accent: string) =>
  ({
    border: `1px solid ${accent}`,
    background: "#161b22",
    borderRadius: 14,
    padding: 24,
  }) as const;
const badge = {
  width: 44,
  height: 44,
  borderRadius: "50%",
  background: "#9F1239",
  color: "#fff",
  display: "grid",
  placeItems: "center",
  fontSize: 22,
  fontWeight: 800,
} as const;
