"use client";

import Link from "next/link";
import { useState } from "react";
import Nav from "../components/Nav";

const REWARD_TYPES = [
  {
    value: "access",
    label: "Access",
    desc: "Gated community or platform entry",
  },
  {
    value: "perks",
    label: "Perks",
    desc: "Discounts, deals, or exclusive offers",
  },
  {
    value: "defi",
    label: "DeFi",
    desc: "Loans, yield, or on-chain privileges",
  },
  { value: "airdrop", label: "Airdrop", desc: "Token or NFT distribution" },
  {
    value: "signal",
    label: "Signal",
    desc: "Verified status or reputation boost",
  },
];

const EXAMPLE_UNLOCKS = [
  {
    handle: "3jane",
    badge: { label: "Stripe Merchant", color: "#635bff", icon: "⚡" },
    requiredBadge: "income/stripe-monthly-volume",
    type: "defi",
    title: "Undercollateralized USDC loan",
    desc: "Prove $10k+ monthly Stripe revenue to borrow USDC without locking up assets.",
    claimUrl: "https://3jane.xyz/borrow",
  },
  {
    handle: "devdao",
    badge: { label: "Established GitHub", color: "#10B981", icon: "◆" },
    requiredBadge: "dev/github-account-age",
    type: "access",
    title: "DevDAO membership",
    desc: "Accounts older than 1 year get free entry to the developer DAO.",
    claimUrl: "https://devdao.xyz/join",
  },
  {
    handle: "awspartner",
    badge: { label: "AWS Certified", color: "#ff9900", icon: "☁" },
    requiredBadge: "credential/aws-certified-badge",
    type: "perks",
    title: "AWS partner credits",
    desc: "$500 in AWS credits for verified certification holders building on AWS.",
    claimUrl: "https://aws.amazon.com/partners",
  },
];

function TypeBadge({ type }: { type: string }) {
  const colors: Record<string, { bg: string; text: string; border: string }> = {
    defi: { bg: "#0d1f3c", text: "#79c0ff", border: "#1f3a5c" },
    perks: { bg: "#1a2e1a", text: "#7ee787", border: "#2a4a2a" },
    access: { bg: "#2a1a3a", text: "#d2a8ff", border: "#3a2a5a" },
    airdrop: { bg: "#2e2200", text: "#ffa657", border: "#4a3800" },
    signal: { bg: "#1a2530", text: "#9fb3c8", border: "#2d3742" },
  };
  const c = colors[type] ?? colors.signal;
  return (
    <span
      style={{
        border: `1px solid ${c.border}`,
        background: c.bg,
        color: c.text,
        borderRadius: 999,
        padding: "2px 9px",
        fontSize: 11,
        fontWeight: 600,
        textTransform: "uppercase",
        letterSpacing: 0.6,
      }}
    >
      {type}
    </span>
  );
}

function LinkBuilder() {
  const [handle, setHandle] = useState("");
  const [badge, setBadge] = useState("income/stripe-monthly-volume");
  const [type, setType] = useState("perks");
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [claimUrl, setClaimUrl] = useState("");

  const slug = handle.trim().toLowerCase().replace(/\s+/g, "-");
  const params = new URLSearchParams({
    badge,
    type,
    title,
    desc,
    url: claimUrl,
  });
  const generatedLink =
    slug && title
      ? `/unlocks/${encodeURIComponent(slug)}?${params.toString()}`
      : null;

  const inputStyle = {
    width: "100%",
    background: "#0d1117",
    border: "1px solid #30363d",
    borderRadius: 7,
    color: "#e6edf3",
    fontSize: 14,
    padding: "9px 12px",
    outline: "none",
    boxSizing: "border-box" as const,
  };
  const labelStyle = {
    display: "block",
    fontSize: 12,
    color: "#8b949e",
    marginBottom: 5,
  };

  return (
    <div
      style={{
        border: "1px solid #1f2937",
        borderRadius: 12,
        background: "#161b22",
        padding: 24,
        marginTop: 32,
      }}
    >
      <h2 style={{ fontSize: 18, marginBottom: 4 }}>Create an unlock offer</h2>
      <p
        style={{
          color: "#8b949e",
          fontSize: 13,
          marginBottom: 20,
          marginTop: 0,
        }}
      >
        Fill in the details below to generate a shareable claim link for badge
        holders.
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <div>
          <label style={labelStyle}>Your handle / company slug</label>
          <input
            style={inputStyle}
            placeholder="acme"
            value={handle}
            onChange={(e) => setHandle(e.target.value)}
          />
        </div>

        <div>
          <label style={labelStyle}>Required badge ID</label>
          <input
            style={inputStyle}
            placeholder="income/stripe-monthly-volume"
            value={badge}
            onChange={(e) => setBadge(e.target.value)}
          />
          <div style={{ fontSize: 11, color: "#556070", marginTop: 4 }}>
            Find IDs at{" "}
            <Link href="/badges" style={{ color: "#7ee787" }}>
              /badges
            </Link>
          </div>
        </div>

        <div>
          <label style={labelStyle}>Reward type</label>
          <select
            style={{ ...inputStyle, cursor: "pointer" }}
            value={type}
            onChange={(e) => setType(e.target.value)}
          >
            {REWARD_TYPES.map((rt) => (
              <option key={rt.value} value={rt.value}>
                {rt.label} — {rt.desc}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label style={labelStyle}>Reward title</label>
          <input
            style={inputStyle}
            placeholder="10% off annual plan"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>

        <div style={{ gridColumn: "1 / -1" }}>
          <label style={labelStyle}>Short description</label>
          <input
            style={inputStyle}
            placeholder="Exclusive discount for verified Stripe merchants."
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
          />
        </div>

        <div style={{ gridColumn: "1 / -1" }}>
          <label style={labelStyle}>
            Claim URL (where badge holders are sent)
          </label>
          <input
            style={inputStyle}
            placeholder="https://acme.com/redeem"
            value={claimUrl}
            onChange={(e) => setClaimUrl(e.target.value)}
          />
        </div>
      </div>

      {generatedLink ? (
        <div style={{ marginTop: 20 }}>
          <div style={{ fontSize: 12, color: "#8b949e", marginBottom: 6 }}>
            Shareable unlock link
          </div>
          <div
            style={{
              background: "#0d1117",
              border: "1px solid #2d3742",
              borderRadius: 8,
              padding: "10px 12px",
              fontSize: 12,
              color: "#9fb3c8",
              wordBreak: "break-all",
              marginBottom: 12,
            }}
          >
            {generatedLink}
          </div>
          <Link
            href={generatedLink}
            style={{
              display: "inline-block",
              background: "#7ee787",
              color: "#0d1117",
              fontWeight: 700,
              fontSize: 14,
              borderRadius: 8,
              padding: "10px 16px",
              textDecoration: "none",
            }}
          >
            Preview claim page →
          </Link>
        </div>
      ) : (
        <div
          style={{
            marginTop: 20,
            padding: "10px 12px",
            borderRadius: 8,
            background: "#0d1117",
            border: "1px solid #2d3742",
            fontSize: 12,
            color: "#556070",
          }}
        >
          Fill in your handle and reward title to generate a link.
        </div>
      )}
    </div>
  );
}

export default function UnlocksIndexPage() {
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
          Badge-gated rewards
        </p>
        <h1
          style={{
            fontSize: "clamp(32px, 5vw, 52px)",
            letterSpacing: "-1.3px",
            lineHeight: 1.08,
            marginBottom: 12,
          }}
        >
          Unlock rewards with your badges
        </h1>
        <p
          style={{
            color: "#8b949e",
            fontSize: 16,
            lineHeight: 1.65,
            maxWidth: 720,
            marginBottom: 0,
          }}
        >
          Creators and protocols can gate rewards, access, or perks behind
          verified TLSNotary badges. Badge holders visit the claim page and
          prove eligibility without revealing raw proof data.
        </p>

        {/* Example unlocks */}
        <div style={{ marginTop: 40 }}>
          <h2
            style={{
              fontSize: 16,
              color: "#8b949e",
              fontWeight: 600,
              marginBottom: 16,
            }}
          >
            Example unlocks
          </h2>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
              gap: 14,
            }}
          >
            {EXAMPLE_UNLOCKS.map((u) => (
              <Link
                key={u.handle}
                href={`/unlocks/${u.handle}?badge=${encodeURIComponent(u.requiredBadge)}&type=${u.type}&title=${encodeURIComponent(u.title)}&desc=${encodeURIComponent(u.desc)}&url=${encodeURIComponent(u.claimUrl)}`}
                style={{ textDecoration: "none", color: "inherit" }}
              >
                <article
                  style={{
                    border: "1px solid #1f2937",
                    borderRadius: 12,
                    background: "#161b22",
                    padding: 18,
                    cursor: "pointer",
                    transition: "border-color 0.15s",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                      marginBottom: 10,
                    }}
                  >
                    <div
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 6,
                        borderRadius: 999,
                        padding: "5px 10px",
                        border: `1px solid ${u.badge.color}44`,
                        background: `${u.badge.color}22`,
                        fontSize: 12,
                        fontWeight: 700,
                      }}
                    >
                      <span
                        style={{
                          width: 14,
                          height: 14,
                          borderRadius: "50%",
                          background: u.badge.color,
                          display: "inline-block",
                        }}
                      />
                      {u.badge.label}
                    </div>
                    <TypeBadge type={u.type} />
                  </div>
                  <div
                    style={{ fontSize: 15, fontWeight: 700, marginBottom: 6 }}
                  >
                    {u.title}
                  </div>
                  <div
                    style={{
                      fontSize: 13,
                      color: "#8b949e",
                      lineHeight: 1.55,
                      marginBottom: 10,
                    }}
                  >
                    {u.desc}
                  </div>
                  <div style={{ fontSize: 11, color: "#556070" }}>
                    by @{u.handle}
                  </div>
                </article>
              </Link>
            ))}
          </div>
        </div>

        {/* Link builder */}
        <LinkBuilder />
      </section>
    </main>
  );
}
