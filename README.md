# Zeroknowledger — Product Requirements Document

**Domain:** zeroknowledger.com  
**Last updated:** April 25, 2026  
**Status:** Pre-launch, landing page built

---

## 1. One-Line Summary

An open, community-driven registry of zkTLS verification methods — think HuggingFace for proof recipes — where users earn cryptographic badges they can carry into DeFi, communities, job platforms, and brand offers.

---

## 2. Core Insight

The most defensible part of the zkTLS ecosystem isn't the proof engine (Reclaim, Opacity, TLSNotary already build those). It's the **schema layer** — the community-maintained library of _what_ can be verified and _how_. A "method" is a JSON spec that defines: which URL to hit, what to look for in the DOM, what constitutes a valid proof, and what to redact. Anyone can write one. The registry is where they all live.

This is the npm-for-verification-methods model. We don't build every method — we build the registry, the tooling, and the community. Contributors build everything else.

---

## 3. What a Method Looks Like

A method is a JSON file with four key sections:

- **target** — the URL and auth type (e.g., `dashboard.stripe.com/dashboard`, session-authenticated)
- **extract** — CSS selector and regex pattern to find the claim (e.g., gross volume number)
- **disclose** — what the proof actually reveals (boolean threshold, exact value, or range)
- **redact** — selectors for everything that must be stripped (account names, bank details, avatars, CSRF tokens)

Methods are versioned, forkable, and community-reviewed. When a website changes its HTML, someone updates the method.

---

## 4. The Badge Model

When a user generates a proof using a method, they earn a **badge** — a verified credential displayed on their profile. Badges are the user-facing value. The method is the infrastructure; the badge is the product.

Examples of badges: "Stripe Merchant," "OSS Contributor," "AWS Certified," "Active Athlete," "University Alumni," "Superhost."

Badges are cryptographically verified, carry zero personal data, and can be checked by any third party via API.

---

## 5. What Badges Unlock (The Value Prop)

Badges have three layers of value:

### Layer 1 — Access

Your badge is a key. DeFi protocols let you borrow with less collateral because you proved income. DAOs gate channels to verified developers. A freelance marketplace skips the verification queue because you already carry the proof.

### Layer 2 — Signal

A freelancer's profile shows "Verified Stripe Merchant · $10K+ monthly revenue." That's not a claim — it's cryptographic proof. Same for dating profiles, community membership, or job applications. The badge replaces "trust me" with "verify me."

### Layer 3 — Discovery

Businesses can offer perks to badge holders (opt-in only). A protein brand wants to reach verified gym members. An airline wants to poach members from a competitor's loyalty program. Your badges make you discoverable to relevant offers.

---

## 6. Target Audience Sequencing

### Phase 1: Developers (method creators)

Position it as a tool, not a service. "Build verification methods, publish them, see usage stats." Like publishing an npm package. The motivation is craft, reputation, and the intellectual challenge of reverse-engineering a website's DOM to prove something. These people exist in security, web scraping, and crypto communities.

### Phase 2: Dev-facing businesses (API consumers)

Once 200+ methods exist, first paying customers are startups — a fintech needing income verification, a hiring platform needing credential checks. Small teams where the CTO finds us on GitHub, integrates in an afternoon.

### Phase 3: Enterprise

Only after revenue, case studies, and a thick registry. The pitch becomes "40 companies already use this, here's the method you need."

**Key decision made:** Do NOT try to build a social network. The original idea included chat rooms where badge holders could interact. This was rejected because people don't socialize around what they can prove — they socialize around what they care about. Token-gated communities have already demonstrated this failure mode.

---

## 7. Competitive Landscape

### Infrastructure Layer (proof engines — we build on top of these)

| Project              | Approach                                                    | Status                                 |
| -------------------- | ----------------------------------------------------------- | -------------------------------------- |
| **Reclaim Protocol** | Proxy witness model, fast attestations, 3M+ verifications   | Leading in adoption, YC W21            |
| **Opacity**          | MPC + TEE + EigenLayer AVS, stronger security               | Leading in security posture            |
| **zkPass**           | Hybrid MPC/proxy, 200+ schemas, TransGate extension         | $12.5M Series A, $100M token valuation |
| **vlayer**           | "Solidity 2.0" — web proofs + email proofs + storage proofs | $10M pre-seed from a16z CSX            |
| **TLSNotary**        | Original MPC-TLS project, Ethereum Foundation supported     | Open-source reference implementation   |
| **DECO/Chainlink**   | Three-phase MPC protocol, licensed by Chainlink             | Research-stage                         |
| **Pado Labs**        | MPC-TLS optimization                                        | $3M seed                               |

### Application Layer (what's built on top)

| Project         | Use Case                                                                                       |
| --------------- | ---------------------------------------------------------------------------------------------- |
| **3Jane**       | Unsecured USDC lending using zkTLS credit verification. Uses Reclaim. $5.2M seed from Paradigm |
| **TransCrypts** | Automated background checks via zkTLS                                                          |
| **Bring ID**    | Proof of personhood using MPC-TLS (built on TLSNotary)                                         |
| **zkp2p**       | Fiat-crypto on/offramps using zkTLS payment verification                                       |
| **Sophon**      | Blockchain with zkTLS at protocol level for entertainment/gaming                               |

### The Gap We Fill

Nobody has built the **community-driven method registry**. Reclaim maintains ~200 schemas centrally. zkPass has ~200 schemas from 70 sources. But these are all internally maintained. The open, community-contributed, HuggingFace-style registry where anyone can publish a verification recipe is greenfield.

---

## 8. Key Product Decisions Made

### What we ARE building:

- Open registry of verification methods (the "npm for proofs")
- Badge system for users who generate proofs
- Profile pages showing verified badges
- Discovery layer where businesses can reach badge holders (opt-in)
- API for third-party verification
- CLI and SDK for method creation and testing
- Community features for method creators (likes, forks, versioning)

### What we are NOT building:

- A social network or chat rooms (rejected — people don't socialize around credentials)
- Our own proof engine (use Reclaim/Opacity/TLSNotary under the hood)
- A bounty marketplace (removed — felt too transactional, the value is community contribution)
- A token (at least not initially)

### Open questions:

- Which proof engine to build on first? Reclaim has most adoption; TLSNotary is most open-source and trust-minimized
- Revenue model: per-verification API fee? Freemium for users, paid for businesses? Revenue share with method authors or pure reputation?
- Should method authors earn money or just reputation? Current landing page is reputation-focused, but the money model was explored and is viable
- How to handle method quality/security review before methods go live (prevent malicious methods that exfiltrate data)
- Freshness/expiry policies for badges (a proof from January doesn't mean membership is still active)

---

## 9. Key Risks

### Cold start

Methods are useless without users, users won't come without methods. Plan: seed 20-30 high-value methods ourselves (Stripe, GitHub, LinkedIn, Netflix, Costco, AWS, Strava, university portals).

### Method fragility

Websites change their HTML constantly. Methods will break. Need: automated monitoring that methods still work, community maintenance loop, version control.

### Adversarial websites

Some sites will actively fight TLSNotary (anti-bot, DOM changes). Need a stance: neutral infrastructure tool, or arms race?

### UX gap

Proof generation requires a browser extension. The flow must be as simple as "click, log in normally, done." Any step involving key management or technical jargon kills adoption.

### Trust in notaries

The notary is a trust assumption. If one entity runs notaries, users trust that entity. Decentralized notary network is more credible but operationally complex.

---

## 10. Technical Architecture (High Level)

```
┌─────────────────────────────────────────────┐
│                  User Flow                   │
│                                              │
│  Browse Registry → Pick Method → Install     │
│  Extension → Log In to Target Site →         │
│  Proof Generated Locally → Badge Earned      │
└──────────────────┬──────────────────────────┘
                   │
┌──────────────────▼──────────────────────────┐
│              Zeroknowledger                   │
│                                              │
│  ┌────────────┐  ┌──────────┐  ┌──────────┐ │
│  │  Method     │  │  Badge   │  │  Profile │ │
│  │  Registry   │  │  Wallet  │  │  & API   │ │
│  └─────┬──────┘  └────┬─────┘  └────┬─────┘ │
│        │              │              │       │
│  ┌─────▼──────────────▼──────────────▼─────┐ │
│  │         Verification API                 │ │
│  │   (third parties verify badges here)     │ │
│  └──────────────────┬──────────────────────┘ │
└─────────────────────┼────────────────────────┘
                      │
┌─────────────────────▼────────────────────────┐
│          Proof Engine Layer                    │
│     (Reclaim / Opacity / TLSNotary)           │
│                                              │
│  Handles: TLS notarization, MPC/proxy,       │
│  cryptographic proof generation              │
└──────────────────────────────────────────────┘
```

---

## 11. Method Spec (Draft Schema)

```json
{
  "name": "namespace/method-name",
  "version": "semver",
  "claim": "Human-readable description of what this proves",

  "target": {
    "url": "https://example.com/dashboard",
    "auth": "session | oauth | api-key",
    "tls_min": "1.2"
  },

  "extract": {
    "selector": "CSS selector or XPath",
    "pattern": "regex to match the claim",
    "transform": "optional JS expression to parse the match"
  },

  "disclose": {
    "mode": "boolean | threshold | exact | range",
    "value": "threshold value if applicable",
    "comparison": "gte | lte | eq",
    "output": "what the verifier sees"
  },

  "redact": ["CSS selectors for elements to strip from the proof"],

  "badge": {
    "label": "Display name",
    "icon": "emoji or icon reference",
    "color": "hex color"
  }
}
```

---

## 12. Build Sequence

### Phase 1 — Registry MVP

- Method spec finalized
- Registry website with browse/search/filter
- CLI tool: `zk init`, `zk test`, `zk publish`
- 20-30 seeded methods (Stripe, GitHub, LinkedIn, Netflix, AWS, etc.)
- User profiles with badge display
- Built on Reclaim Protocol initially

### Phase 2 — API + Integration

- Verification API for third parties
- Embeddable badge widgets
- Documentation for businesses
- Method quality review process
- Automated method health monitoring

### Phase 3 — Discovery + Offers

- Opt-in discovery for badge holders
- Business dashboard for creating offers targeting badge holders
- Badge composition (combine multiple badges)

### Phase 4 — Expansion

- Multi-engine support (Reclaim + Opacity + TLSNotary)
- On-chain badge anchoring (optional)
- Interop with Verifiable Credentials, EAS attestations
- Mobile app with built-in browser for proof generation

---

## 13. Assets Built So Far

- **Landing page** (`zeroknowledger.jsx`): React component, HuggingFace-style registry with badge-first positioning. Includes: hero with profile card preview, "What badges unlock" interactive section, discovery/offers feed, method registry browser with search/filter, method spec showcase, community stats, and email capture. Dark theme, GitHub-inspired aesthetic.

---

## 14. Reference Material from Research

### Key insight on proof value

"A proof is valuable in exactly one situation: when a transaction that would benefit both parties is being blocked because one side can't verify a claim the other side is making."

But critically: **proofs only work when enforcement already exists.** A proof of creditworthiness doesn't help if the lender can't collect on default. The highest-value applications are where enforcement mechanisms exist but verification is the bottleneck (hiring, insurance underwriting, platform onboarding) — not where enforcement is missing (cross-border lending to strangers).

### Why social didn't work

People don't socialize around what they can prove. Token-gated Discord communities demonstrated this at scale — most became ghost towns because the gate was the entire value proposition. Social platforms succeed on entertainment, connection to people you already know, or daily utility. "Chat with verified strangers" hits none of those.

### The method registry is the moat

Network effect on the supply side of verifiability. More methods → more things people can prove → more useful the platform becomes. Community-created methods are the difference between a curated app store and npm.
