"use client";
import { useState } from "react";
import Link from "next/link";

import Badge from "./Badge";
import Counter from "./Counter";
import FadeIn from "./FadeIn";
import TypeIcon from "./TypeIcon";

import {
  PROFILE_BADGES,
  UNLOCKS,
  CATEGORIES,
  METHODS,
  METHOD_SPEC,
} from "../data/home";

export default function ZeroKnowledger() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [filter, setFilter] = useState("All");
  const [search, setSearch] = useState("");
  const [hovered, setHovered] = useState(null);
  const [activeUnlock, setActiveUnlock] = useState(0);

  const filtered = METHODS.filter((m) => {
    const mc = filter === "All" || m.tags.includes(filter);
    const ms =
      !search ||
      m.name.toLowerCase().includes(search.toLowerCase()) ||
      m.desc.toLowerCase().includes(search.toLowerCase());
    return mc && ms;
  });

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#0d1117",
        color: "#e6edf3",
        fontFamily: "Inter, sans-serif",
      }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600&family=Inter:wght@400;500;600;700;800;900&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::selection { background: #7ee78844; color: #fff; }

        .mc { border: 1px solid #1f2937; background: #0d1117; border-radius: 8px; padding: 20px; transition: all 0.2s; cursor: pointer; }
        .mc:hover { border-color: #30363d; background: #161b22; transform: translateY(-2px); box-shadow: 0 8px 24px rgba(0,0,0,0.3); }

        .pill { border: 1px solid #1f2937; background: transparent; color: #8b949e; font-family: Inter; font-size: 13px; font-weight: 500; padding: 6px 14px; cursor: pointer; transition: all 0.15s; border-radius: 20px; }
        .pill:hover { border-color: #30363d; color: #e6edf3; }
        .pill.on { border-color: #7ee787; color: #7ee787; background: rgba(126,231,135,0.06); }

        .si { background: #161b22; border: 1px solid #1f2937; color: #e6edf3; font-family: Inter; font-size: 14px; padding: 10px 16px 10px 40px; width: 300px; outline: none; border-radius: 8px; transition: border-color 0.2s; }
        .si:focus { border-color: #30363d; }
        .si::placeholder { color: #30363d; }

        .ei { background: #161b22; border: 1px solid #30363d; color: #e6edf3; font-family: Inter; font-size: 14px; padding: 14px 18px; width: 300px; outline: none; border-radius: 8px 0 0 8px; transition: border-color 0.2s; }
        .ei:focus { border-color: #7ee787; }
        .ei::placeholder { color: #30363d; }

        .btn1 { background: #7ee787; color: #0d1117; border: none; font-family: Inter; font-weight: 700; font-size: 14px; padding: 14px 24px; cursor: pointer; transition: all 0.2s; border-radius: 0 8px 8px 0; }
        .btn1:hover { background: #56d364; }
        .btn2 { background: #161b22; color: #e6edf3; border: 1px solid #30363d; font-family: Inter; font-weight: 600; font-size: 14px; padding: 12px 24px; cursor: pointer; transition: all 0.2s; border-radius: 8px; }
        .btn2:hover { border-color: #484f58; background: #1f2937; }
        .btn-link { text-decoration: none; display: inline-flex; align-items: center; justify-content: center; }
        .nav-link { color: #8b949e; text-decoration: none; }
        .nav-link:hover { color: #e6edf3; }

        .unlock-tab { border: none; background: transparent; cursor: pointer; padding: 12px 16px; border-radius: 8px; transition: all 0.2s; text-align: left; width: 100%; }
        .unlock-tab:hover { background: #161b22; }
        .unlock-tab.on { background: #161b22; border: 1px solid #1f2937; }
      `}</style>

      {/* NAV */}
      <nav
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          zIndex: 50,
          padding: "10px 32px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          background: "rgba(13,17,23,0.85)",
          backdropFilter: "blur(16px)",
          borderBottom: "1px solid #1f2937",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 28 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
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
              style={{ fontWeight: 800, fontSize: 15, letterSpacing: "-0.5px" }}
            >
              zeroknowledger
            </span>
          </div>
          <div
            style={{
              display: "flex",
              gap: 20,
              fontSize: 14,
              color: "#8b949e",
              fontWeight: 500,
            }}
          >
            <span style={{ color: "#e6edf3", cursor: "pointer" }}>Methods</span>
            <Link href="/badges" className="nav-link">
              Badges
            </Link>
            <Link href="/cases" className="nav-link">
              Cases
            </Link>
            <span style={{ cursor: "pointer" }}>Unlocks</span>
            <span style={{ cursor: "pointer" }}>Docs</span>
          </div>
        </div>
        <div style={{ display: "flex", gap: 12 }}>
          <button
            className="btn2"
            style={{ padding: "7px 16px", fontSize: 13, borderRadius: 6 }}
          >
            Sign in
          </button>
          <button
            className="btn1"
            style={{ padding: "7px 16px", fontSize: 13, borderRadius: 6 }}
          >
            Sign up
          </button>
        </div>
      </nav>

      {/* HERO */}
      <section
        style={{
          padding: "140px 32px 80px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          position: "relative",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: "10%",
            left: "50%",
            transform: "translateX(-50%)",
            width: 900,
            height: 500,
            background:
              "radial-gradient(ellipse, rgba(126,231,135,0.03) 0%, transparent 60%)",
            pointerEvents: "none",
          }}
        />

        <FadeIn>
          <div
            style={{
              display: "flex",
              gap: 8,
              flexWrap: "wrap",
              justifyContent: "center",
              marginBottom: 32,
            }}
          >
            {PROFILE_BADGES.map((b) => (
              <Badge key={b.label} {...b} size="sm" />
            ))}
          </div>
        </FadeIn>

        <FadeIn delay={100}>
          <h1
            style={{
              fontSize: "clamp(36px, 5.5vw, 68px)",
              fontWeight: 900,
              textAlign: "center",
              lineHeight: 1.06,
              letterSpacing: "-3px",
              maxWidth: 700,
              marginBottom: 20,
            }}
          >
            Prove it once.
            <br />
            <span style={{ color: "#7ee787" }}>Unlock everywhere.</span>
          </h1>
        </FadeIn>

        <FadeIn delay={200}>
          <p
            style={{
              fontSize: 18,
              color: "#8b949e",
              textAlign: "center",
              maxWidth: 500,
              lineHeight: 1.6,
              marginBottom: 40,
            }}
          >
            Verify your memberships, credentials, and status with cryptographic
            proofs. Carry your badges into DeFi, communities, job platforms, and
            offers built for people like you.
          </p>
        </FadeIn>

        <FadeIn delay={300}>
          <div style={{ display: "flex", gap: 12, marginBottom: 48 }}>
            <Link
              href="/badges"
              className="btn1 btn-link"
              style={{ borderRadius: 8, padding: "14px 28px" }}
            >
              Get your first badge
            </Link>
            <Link href="/badges" className="btn2 btn-link">
              Browse top badges →
            </Link>
          </div>
        </FadeIn>

        {/* Profile Card */}
        <FadeIn delay={450}>
          <div
            style={{
              width: "min(580px, 90vw)",
              border: "1px solid #1f2937",
              borderRadius: 12,
              overflow: "hidden",
              background: "#161b22",
              boxShadow: "0 20px 60px rgba(0,0,0,0.4)",
            }}
          >
            <div
              style={{
                padding: "20px 24px",
                display: "flex",
                alignItems: "center",
                gap: 16,
                borderBottom: "1px solid #1f2937",
              }}
            >
              <div
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: "50%",
                  background: "linear-gradient(135deg, #30363d, #484f58)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 20,
                  fontWeight: 700,
                }}
              >
                🪪
              </div>
              <div>
                <div
                  style={{
                    fontWeight: 700,
                    fontSize: 16,
                    letterSpacing: "-0.3px",
                  }}
                >
                  Analyst #3 at XYZ
                </div>
                <div style={{ color: "#8b949e", fontSize: 13 }}>
                  5 verified badges ·{" "}
                  <span style={{ color: "#7ee787" }}>12 unlocks available</span>
                </div>
              </div>
            </div>
            <div
              style={{
                padding: "16px 24px 20px",
                display: "flex",
                gap: 8,
                flexWrap: "wrap",
              }}
            >
              {PROFILE_BADGES.map((b) => (
                <Badge key={b.label} {...b} size="md" />
              ))}
            </div>
            <div
              style={{
                padding: "12px 24px",
                borderTop: "1px solid #1f2937",
                fontSize: 12,
                color: "#30363d",
                display: "flex",
                justifyContent: "space-between",
              }}
            >
              <span>
                cryptographically verified · zero personal data shared
              </span>
              <span style={{ fontFamily: "'JetBrains Mono'" }}>
                zeroknowledger.com/@sarah.chen
              </span>
            </div>
          </div>
        </FadeIn>
      </section>

      {/* ═══ WHAT BADGES UNLOCK ═══ */}
      <section
        style={{ padding: "100px 32px", maxWidth: 960, margin: "0 auto" }}
      >
        <FadeIn>
          <h2
            style={{
              fontSize: 13,
              fontWeight: 700,
              color: "#7ee787",
              letterSpacing: 1.5,
              marginBottom: 10,
              textTransform: "uppercase",
            }}
          >
            What badges unlock
          </h2>
          <p
            style={{
              fontSize: 32,
              fontWeight: 900,
              letterSpacing: "-1.5px",
              marginBottom: 12,
              lineHeight: 1.15,
            }}
          >
            A badge is not a sticker.
            <br />
            <span style={{ color: "#8b949e" }}>{"It's a key."}</span>
          </p>
          <p
            style={{
              color: "#8b949e",
              fontSize: 16,
              lineHeight: 1.6,
              marginBottom: 48,
              maxWidth: 500,
            }}
          >
            Every badge you earn opens doors — DeFi protocols, exclusive
            communities, brand offers, and platform access that requires proof,
            not promises.
          </p>
        </FadeIn>

        <div
          style={{ display: "grid", gridTemplateColumns: "280px 1fr", gap: 24 }}
        >
          {/* Left: badge selector */}
          <FadeIn delay={100}>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {UNLOCKS.map((u, i) => (
                <button
                  key={i}
                  className={`unlock-tab ${activeUnlock === i ? "on" : ""}`}
                  onClick={() => setActiveUnlock(i)}
                  style={
                    activeUnlock === i
                      ? { border: "1px solid #1f2937" }
                      : { border: "1px solid transparent" }
                  }
                >
                  <Badge {...u.badge} size="sm" />
                </button>
              ))}
              <div
                style={{
                  marginTop: 12,
                  padding: "0 16px",
                  fontSize: 12,
                  color: "#30363d",
                }}
              >
                ↑ pick a badge to see what it unlocks
              </div>
            </div>
          </FadeIn>

          {/* Right: unlocks */}
          <FadeIn delay={200}>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {UNLOCKS[activeUnlock].unlocks.map((u, i) => (
                <div
                  key={i}
                  style={{
                    border: "1px solid #1f2937",
                    borderRadius: 10,
                    padding: "20px 24px",
                    background: "#0d1117",
                    transition: "all 0.2s",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      marginBottom: 8,
                    }}
                  >
                    <TypeIcon type={u.type} />
                    <span
                      style={{
                        fontWeight: 700,
                        fontSize: 15,
                        letterSpacing: "-0.3px",
                      }}
                    >
                      {u.title}
                    </span>
                  </div>
                  <p
                    style={{ color: "#8b949e", fontSize: 14, lineHeight: 1.55 }}
                  >
                    {u.desc}
                  </p>
                </div>
              ))}
              <div
                style={{
                  border: "1px dashed #1f2937",
                  borderRadius: 10,
                  padding: "16px 24px",
                  textAlign: "center",
                  color: "#30363d",
                  fontSize: 13,
                }}
              >
                + more unlocks added as partners integrate the API
              </div>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* ═══ DISCOVERY / OFFERS ═══ */}
      <section
        style={{ padding: "80px 32px", maxWidth: 960, margin: "0 auto" }}
      >
        <FadeIn>
          <h2
            style={{
              fontSize: 13,
              fontWeight: 700,
              color: "#7ee787",
              letterSpacing: 1.5,
              marginBottom: 10,
              textTransform: "uppercase",
            }}
          >
            Discovery
          </h2>
          <p
            style={{
              fontSize: 30,
              fontWeight: 800,
              letterSpacing: "-1px",
              marginBottom: 12,
            }}
          >
            Badges attract offers.
          </p>
          <p
            style={{
              color: "#8b949e",
              fontSize: 16,
              lineHeight: 1.6,
              marginBottom: 40,
              maxWidth: 520,
            }}
          >
            Businesses can reach badge holders with relevant perks — but only if
            you opt in. Your badges make you discoverable to things that are
            actually worth your time.
          </p>
        </FadeIn>

        <FadeIn delay={100}>
          <div
            style={{
              border: "1px solid #1f2937",
              borderRadius: 12,
              overflow: "hidden",
            }}
          >
            {/* Header */}
            <div
              style={{
                padding: "14px 24px",
                background: "#161b22",
                borderBottom: "1px solid #1f2937",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <span style={{ fontWeight: 700, fontSize: 14 }}>
                Offers for your badges
              </span>
              <span style={{ fontSize: 12, color: "#484f58" }}>
                3 new this week
              </span>
            </div>

            {[
              {
                from: "Whoop",
                offer: "3 months free for verified athletes",
                forBadge: {
                  label: "Active Athlete",
                  color: "#fc4c02",
                  icon: "◎",
                },
                tag: "fitness",
              },
              {
                from: "Vercel",
                offer: "Pro plan 50% off for OSS contributors",
                forBadge: {
                  label: "OSS Contributor",
                  color: "#7ee787",
                  icon: "◆",
                },
                tag: "developer",
              },
              {
                from: "Brex",
                offer:
                  "Startup credit card — fast-tracked for verified merchants",
                forBadge: {
                  label: "Stripe Merchant",
                  color: "#635bff",
                  icon: "⚡",
                },
                tag: "finance",
              },
              {
                from: "WeWork",
                offer: "Day pass for verified freelancers",
                forBadge: {
                  label: "Verified Employee",
                  color: "#0a66c2",
                  icon: "●",
                },
                tag: "workspace",
              },
            ].map((o, i) => (
              <div
                key={i}
                style={{
                  padding: "16px 24px",
                  borderBottom: i < 3 ? "1px solid #1f2937" : "none",
                  display: "grid",
                  gridTemplateColumns: "100px 1fr auto",
                  alignItems: "center",
                  gap: 16,
                  transition: "background 0.15s",
                  cursor: "pointer",
                }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.background = "#161b22")
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.background = "transparent")
                }
              >
                <span
                  style={{ fontWeight: 700, fontSize: 14, color: "#e6edf3" }}
                >
                  {o.from}
                </span>
                <div>
                  <div
                    style={{ fontSize: 14, color: "#8b949e", marginBottom: 4 }}
                  >
                    {o.offer}
                  </div>
                  <Badge {...o.forBadge} size="sm" />
                </div>
                <span
                  style={{
                    fontSize: 12,
                    color: "#484f58",
                    padding: "3px 10px",
                    border: "1px solid #1f2937",
                    borderRadius: 4,
                  }}
                >
                  {o.tag}
                </span>
              </div>
            ))}
          </div>
        </FadeIn>

        <FadeIn delay={200}>
          <div
            style={{
              marginTop: 20,
              padding: "20px 24px",
              border: "1px solid #1f2937",
              borderRadius: 10,
              background: "#0d1117",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <div>
              <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>
                Run offers for badge holders
              </div>
              <div style={{ color: "#8b949e", fontSize: 13 }}>
                Reach verified audiences. No PII exchanged. Users opt in.
              </div>
            </div>
            <button
              className="btn2"
              style={{ borderRadius: 6, fontSize: 13, whiteSpace: "nowrap" }}
            >
              Business API docs →
            </button>
          </div>
        </FadeIn>
      </section>

      {/* ═══ HOW IT WORKS ═══ */}
      <section
        style={{ padding: "80px 32px", maxWidth: 880, margin: "0 auto" }}
      >
        <FadeIn>
          <h2
            style={{
              fontSize: 13,
              fontWeight: 700,
              color: "#7ee787",
              letterSpacing: 1.5,
              marginBottom: 10,
              textTransform: "uppercase",
            }}
          >
            How it works
          </h2>
          <p
            style={{
              fontSize: 30,
              fontWeight: 800,
              letterSpacing: "-1px",
              marginBottom: 48,
            }}
          >
            Prove it. Badge it. Use it.
          </p>
        </FadeIn>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: 20,
          }}
        >
          {[
            {
              n: "1",
              t: "Find a method",
              d: "Browse the registry for what you want to prove — gym membership, job status, account tier, anything.",
              v: "🔍",
            },
            {
              n: "2",
              t: "Generate a proof",
              d: "Log in through our browser extension. The proof is generated locally, cryptographically. No data leaves your device.",
              v: "🔐",
            },
            {
              n: "3",
              t: "Use your badge",
              d: "It appears on your profile. Embed it anywhere. DeFi protocols and apps verify it via API. Offers find you.",
              v: "✓",
            },
          ].map((s, i) => (
            <FadeIn key={s.n} delay={i * 100}>
              <div
                style={{
                  border: "1px solid #1f2937",
                  borderRadius: 10,
                  padding: 24,
                  background: "#0d1117",
                }}
              >
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 8,
                    background: "rgba(126,231,135,0.08)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 18,
                    marginBottom: 16,
                    border: "1px solid rgba(126,231,135,0.15)",
                    color: "#7ee787",
                  }}
                >
                  {s.v === "✓" ? (
                    <svg width="18" height="18" viewBox="0 0 16 16" fill="none">
                      <path
                        d="M13.5 4.5L6.5 11.5L2.5 7.5"
                        stroke="#7ee787"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  ) : (
                    s.v
                  )}
                </div>
                <h3
                  style={{
                    fontSize: 17,
                    fontWeight: 700,
                    marginBottom: 8,
                    letterSpacing: "-0.3px",
                  }}
                >
                  {s.t}
                </h3>
                <p style={{ color: "#8b949e", fontSize: 14, lineHeight: 1.6 }}>
                  {s.d}
                </p>
              </div>
            </FadeIn>
          ))}
        </div>
      </section>

      {/* ═══ METHOD REGISTRY ═══ */}
      <section
        style={{ padding: "80px 32px", maxWidth: 960, margin: "0 auto" }}
      >
        <FadeIn>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-end",
              marginBottom: 24,
            }}
          >
            <div>
              <h2
                style={{
                  fontSize: 13,
                  fontWeight: 700,
                  color: "#7ee787",
                  letterSpacing: 1.5,
                  marginBottom: 10,
                  textTransform: "uppercase",
                }}
              >
                Registry
              </h2>
              <p
                style={{ fontSize: 28, fontWeight: 800, letterSpacing: "-1px" }}
              >
                Explore methods
              </p>
            </div>
            <div style={{ position: "relative" }}>
              <svg
                width="16"
                height="16"
                viewBox="0 0 16 16"
                fill="none"
                style={{
                  position: "absolute",
                  left: 14,
                  top: "50%",
                  transform: "translateY(-50%)",
                }}
              >
                <circle
                  cx="7"
                  cy="7"
                  r="5"
                  stroke="#484f58"
                  strokeWidth="1.5"
                />
                <path
                  d="M11 11l3 3"
                  stroke="#484f58"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
              </svg>
              <input
                className="si"
                placeholder="Search methods..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
        </FadeIn>

        <FadeIn delay={50}>
          <div
            style={{
              display: "flex",
              gap: 8,
              flexWrap: "wrap",
              marginBottom: 24,
            }}
          >
            {CATEGORIES.map((c) => (
              <button
                key={c}
                className={`pill ${filter === c ? "on" : ""}`}
                onClick={() => setFilter(c)}
              >
                {c}
              </button>
            ))}
          </div>
        </FadeIn>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(2, 1fr)",
            gap: 12,
          }}
        >
          {filtered.map((m, i) => (
            <FadeIn key={m.id} delay={i * 40}>
              <div
                className="mc"
                onMouseEnter={() => setHovered(m.id)}
                onMouseLeave={() => setHovered(null)}
              >
                <div style={{ marginBottom: 12 }}>
                  <Badge {...m.badge} size="sm" />
                </div>
                <div
                  style={{
                    fontFamily: "'JetBrains Mono'",
                    fontSize: 14,
                    fontWeight: 600,
                    color: hovered === m.id ? "#7ee787" : "#e6edf3",
                    transition: "color 0.15s",
                    marginBottom: 6,
                  }}
                >
                  {m.name}
                </div>
                <p
                  style={{
                    color: "#8b949e",
                    fontSize: 13,
                    lineHeight: 1.5,
                    marginBottom: 14,
                  }}
                >
                  {m.desc}
                </p>
                <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
                  {m.tags.map((t) => (
                    <span
                      key={t}
                      style={{
                        fontSize: 11,
                        padding: "2px 8px",
                        background: "#161b22",
                        borderRadius: 4,
                        color:
                          t === "trending"
                            ? "#d2a8ff"
                            : t === "popular"
                              ? "#7ee787"
                              : "#484f58",
                        border: `1px solid ${t === "trending" ? "#d2a8ff22" : t === "popular" ? "#7ee78722" : "#1f2937"}`,
                      }}
                    >
                      {t}
                    </span>
                  ))}
                </div>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    paddingTop: 12,
                    borderTop: "1px solid #1f2937",
                    fontSize: 12,
                    color: "#484f58",
                  }}
                >
                  <div
                    style={{ display: "flex", alignItems: "center", gap: 6 }}
                  >
                    <div
                      style={{
                        width: 18,
                        height: 18,
                        borderRadius: "50%",
                        background: "#1f2937",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 10,
                        fontWeight: 700,
                        color: "#8b949e",
                      }}
                    >
                      {m.avatar}
                    </div>
                    <span>{m.author}</span>
                  </div>
                  <div style={{ display: "flex", gap: 14 }}>
                    <span>♡ {m.likes}</span>
                    <span>↓ {m.downloads}</span>
                  </div>
                </div>
              </div>
            </FadeIn>
          ))}
        </div>

        <FadeIn delay={200}>
          <div style={{ textAlign: "center", marginTop: 32 }}>
            <button className="btn2" style={{ borderRadius: 8 }}>
              View all 847 methods →
            </button>
          </div>
        </FadeIn>
      </section>

      {/* ═══ FOR BUILDERS ═══ */}
      <section
        style={{ padding: "80px 32px", maxWidth: 960, margin: "0 auto" }}
      >
        <FadeIn>
          <h2
            style={{
              fontSize: 13,
              fontWeight: 700,
              color: "#7ee787",
              letterSpacing: 1.5,
              marginBottom: 10,
              textTransform: "uppercase",
            }}
          >
            For builders
          </h2>
          <p
            style={{
              fontSize: 30,
              fontWeight: 800,
              letterSpacing: "-1px",
              marginBottom: 10,
            }}
          >
            A method is just JSON.
          </p>
          <p
            style={{
              color: "#8b949e",
              fontSize: 16,
              lineHeight: 1.6,
              marginBottom: 32,
              maxWidth: 520,
            }}
          >
            Define the URL, selector, pattern, and redaction rules. Publish to
            the registry. Anyone can write one. The more methods exist, the more
            things people can prove.
          </p>
        </FadeIn>

        <FadeIn delay={100}>
          <div
            style={{
              border: "1px solid #1f2937",
              borderRadius: 10,
              overflow: "hidden",
              background: "#0d1117",
            }}
          >
            <div
              style={{
                padding: "12px 20px",
                borderBottom: "1px solid #1f2937",
                background: "#161b22",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <span style={{ fontFamily: "'JetBrains Mono'", fontSize: 13 }}>
                github/active-contributor/method.json
              </span>
              <Badge
                label="OSS Contributor"
                color="#7ee787"
                icon="◆"
                size="sm"
              />
            </div>
            <pre
              style={{
                padding: "16px 20px",
                margin: 0,
                fontSize: 12.5,
                lineHeight: 1.85,
                fontFamily: "'JetBrains Mono'",
                color: "#8b949e",
                overflowX: "auto",
              }}
            >
              {METHOD_SPEC.split("\n").map((line, i) => {
                let h = line.replace(
                  /("(?:[^"\\]|\\.)*")(\s*:)/g,
                  (_, k, c) => `\x01g${k}\x02${c}`,
                );
                h = h.replace(
                  /:(\s*)("(?:[^"\\]|\\.)*")/g,
                  (_, s, v) => `:${s}\x01b${v}\x02`,
                );
                h = h.replace(
                  /:(\s*)(\d+)/g,
                  (_, s, v) => `:${s}\x01p${v}\x02`,
                );
                const parts = h.split(/(\x01[gbp][^\x02]*\x02)/);
                return (
                  <div key={i} style={{ display: "flex" }}>
                    <span
                      style={{
                        color: "#30363d",
                        width: 28,
                        display: "inline-block",
                        textAlign: "right",
                        marginRight: 18,
                        userSelect: "none",
                        fontSize: 11,
                      }}
                    >
                      {i + 1}
                    </span>
                    <span>
                      {parts.map((p, j) => {
                        if (p.startsWith("\x01g"))
                          return (
                            <span key={j} style={{ color: "#7ee787" }}>
                              {p.slice(2, -1)}
                            </span>
                          );
                        if (p.startsWith("\x01b"))
                          return (
                            <span key={j} style={{ color: "#a5d6ff" }}>
                              {p.slice(2, -1)}
                            </span>
                          );
                        if (p.startsWith("\x01p"))
                          return (
                            <span key={j} style={{ color: "#d2a8ff" }}>
                              {p.slice(2, -1)}
                            </span>
                          );
                        return <span key={j}>{p}</span>;
                      })}
                    </span>
                  </div>
                );
              })}
            </pre>
            <div
              style={{
                borderTop: "1px solid #1f2937",
                padding: "10px 20px",
                display: "flex",
                justifyContent: "space-between",
                background: "#161b22",
                fontSize: 12,
                color: "#484f58",
              }}
            >
              <span>
                by <span style={{ color: "#8b949e" }}>devproof</span> · 891
                likes · 112K verifications
              </span>
              <span>
                This method grants the{" "}
                <span style={{ color: "#7ee787" }}>OSS Contributor</span> badge
              </span>
            </div>
          </div>
        </FadeIn>

        <FadeIn delay={200}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(4, 1fr)",
              gap: 12,
              marginTop: 20,
            }}
          >
            {[
              { l: "target", d: "Which URL to hit", c: "#7ee787" },
              { l: "extract", d: "What to look for", c: "#a5d6ff" },
              { l: "disclose", d: "What the proof reveals", c: "#d2a8ff" },
              { l: "redact", d: "What gets stripped", c: "#ff7b72" },
            ].map((f) => (
              <div
                key={f.l}
                style={{
                  border: "1px solid #1f2937",
                  borderRadius: 8,
                  padding: 16,
                  background: "#0d1117",
                }}
              >
                <div
                  style={{
                    fontFamily: "'JetBrains Mono'",
                    fontSize: 13,
                    color: f.c,
                    fontWeight: 600,
                    marginBottom: 4,
                  }}
                >
                  {f.l}
                </div>
                <div style={{ fontSize: 12, color: "#8b949e" }}>{f.d}</div>
              </div>
            ))}
          </div>
        </FadeIn>
      </section>

      {/* STATS */}
      <section
        style={{ padding: "60px 32px", maxWidth: 960, margin: "0 auto" }}
      >
        <FadeIn>
          <div
            style={{
              border: "1px solid #1f2937",
              borderRadius: 12,
              padding: "48px 32px",
              background:
                "linear-gradient(135deg, rgba(126,231,135,0.02) 0%, #0d1117 100%)",
              display: "grid",
              gridTemplateColumns: "repeat(4, 1fr)",
              gap: 32,
              textAlign: "center",
            }}
          >
            {[
              { v: 847, l: "methods" },
              { v: 2340, l: "contributors" },
              { v: 142, l: "verifications", s: "K" },
              { v: 98, l: "uptime", s: "%" },
            ].map((s) => (
              <div key={s.l}>
                <div
                  style={{
                    fontSize: 36,
                    fontWeight: 900,
                    letterSpacing: "-1px",
                    marginBottom: 4,
                  }}
                >
                  <Counter end={s.v} suffix={s.s || ""} />
                </div>
                <div
                  style={{ fontSize: 14, color: "#484f58", fontWeight: 500 }}
                >
                  {s.l}
                </div>
              </div>
            ))}
          </div>
        </FadeIn>
      </section>

      {/* CTA */}
      <section
        style={{
          padding: "80px 32px 120px",
          textAlign: "center",
          position: "relative",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: "30%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            width: 600,
            height: 400,
            background:
              "radial-gradient(circle, rgba(126,231,135,0.04) 0%, transparent 60%)",
            pointerEvents: "none",
          }}
        />
        <FadeIn>
          <div
            style={{
              display: "flex",
              gap: 8,
              flexWrap: "wrap",
              justifyContent: "center",
              marginBottom: 32,
            }}
          >
            {PROFILE_BADGES.slice(0, 3).map((b) => (
              <Badge key={b.label} {...b} size="lg" />
            ))}
          </div>
          <h2
            style={{
              fontSize: "clamp(28px, 4vw, 42px)",
              fontWeight: 900,
              letterSpacing: "-1.5px",
              marginBottom: 12,
              lineHeight: 1.15,
            }}
          >
            What will you prove?
          </h2>
          <p style={{ color: "#8b949e", fontSize: 16, marginBottom: 40 }}>
            Get your first badge or contribute a verification method.
          </p>
          {!submitted ? (
            <div style={{ display: "flex", gap: 0, justifyContent: "center" }}>
              <input
                className="ei"
                type="email"
                placeholder="you@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) =>
                  e.key === "Enter" && email.includes("@") && setSubmitted(true)
                }
              />
              <button
                className="btn1"
                onClick={() => email.includes("@") && setSubmitted(true)}
              >
                Join early access
              </button>
            </div>
          ) : (
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                padding: "14px 28px",
                borderRadius: 8,
                border: "1px solid #7ee78744",
                color: "#7ee787",
                background: "rgba(126,231,135,0.05)",
                fontSize: 14,
                fontWeight: 600,
              }}
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path
                  d="M13.5 4.5L6.5 11.5L2.5 7.5"
                  stroke="#7ee787"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              You are in. We will send your invite soon.
            </div>
          )}
          <div
            style={{
              display: "flex",
              gap: 24,
              justifyContent: "center",
              marginTop: 40,
              fontSize: 13,
              color: "#30363d",
            }}
          >
            <span>open source</span>
            <span>·</span>
            <span>built on TLSNotary</span>
            <span>·</span>
            <span>zero personal data stored</span>
          </div>
        </FadeIn>
      </section>

      {/* FOOTER */}
      <footer
        style={{
          padding: "20px 32px",
          borderTop: "1px solid #1f2937",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div
            style={{
              width: 18,
              height: 18,
              borderRadius: 4,
              background: "linear-gradient(135deg, #7ee787, #56d364)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 10,
              fontWeight: 800,
              color: "#0d1117",
            }}
          >
            Z
          </div>
          <span style={{ fontWeight: 700, fontSize: 13 }}>zeroknowledger</span>
        </div>
        <div
          style={{ display: "flex", gap: 20, fontSize: 13, color: "#30363d" }}
        >
          <span>GitHub</span>
          <span>Twitter</span>
          <span>Discord</span>
          <span>Blog</span>
        </div>
        <span style={{ fontSize: 11, color: "#1f2937" }}>© 2026</span>
      </footer>
    </div>
  );
}
