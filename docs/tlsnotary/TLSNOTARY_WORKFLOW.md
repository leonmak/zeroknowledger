# TLSNotary Template Guide

**For contributors and verifiers using these templates with TLSNotary.**

Last updated: 2026-04-26

## TLSNotary Workflow

```
User → Browser Extension → TLS Intercept → Extract Data → Apply Template →
Redaction → Create Proof → Notary Attestation → Signed Proof → Share Badge
```

### Step 1: User Initiates Proof

1. User clicks "Generate badge" on zeroknowledger.com
2. Selects a template (e.g., "Stripe Merchant")
3. Extension opens target URL (dashboard.stripe.com) in secure context

### Step 2: TLS Session Capture

1. Extension intercepts HTTPS session between user and Stripe
2. TLS session key obtained (via notary protocol or MPC)
3. Raw HTML page captured

### Step 3: Template Extraction

1. CSS selector from `extract.selector` applied to page DOM
2. Regex pattern matches the target value
3. Optional `transform` function applies (e.g., `parseFloat()` for currency)

### Step 4: Redaction

1. All selectors in `redact[]` are removed from captured page
2. Sensitive fields stripped: emails, tokens, account IDs, avatars
3. Only data matching the claim remains

### Step 5: Notary & Attestation

1. Redacted page + extraction proof sent to TLSNotary notary
2. Notary verifies the TLS session and extraction logic
3. Proof is cryptographically signed
4. Signature proves: "This proof was generated from a real TLS session; redaction rules were applied; this claim is true."

### Step 6: Badge Created

1. User receives signed proof file (compact format: ~5KB)
2. Badge displayed on profile at zeroknowledger.com/@user
3. Badge can be shared via `/cases/user?badges=...` link
4. Third parties can verify badge by checking signature

---

## Template Quality Checklist for TLSNotary

### Before Publishing a Template

- [ ] **Selector tested on real site** — Run against live target URL, not mock HTML
- [ ] **Fallback selectors provided** — Include 2-3 selector alternatives in case DOM changes
- [ ] **Pattern is narrow** — Regex should not match unrelated page content
- [ ] **Redaction comprehensive** — All account-identifying data is removed
- [ ] **Freshness policy set** — `max_age_days` and `stale_after_days` reflect how often target changes

### Before Running a Notarization

- [ ] **Selector still works** — Test selector against current target site within 24h
- [ ] **User is logged in** — Auth method matches template (`session`/`oauth`/`api-key`)
- [ ] **Locale matches template** — If template specifies locales, ensure user's target matches
- [ ] **No VPN/proxy** — TLSNotary requires direct connection for valid session proof

### For Template Maintainers

- [ ] Monitor template health via notarization success/failure rates
- [ ] Update selectors when target DOM changes (track issue on GitHub)
- [ ] Add fixtures when selectors change (example HTML + expected extraction)
- [ ] Test extraction logic in isolation before merging

---

## Common Issues & Troubleshooting

### Selector Mismatch

**Problem:** Selector returns empty or wrong element after site update  
**Fix:**

1. Inspect target page live
2. Update selector to match current DOM
3. Add fallback selector
4. Increment `version` (0.1.0 → 0.1.1)
5. File PR with fixtures

### Redaction Too Aggressive

**Problem:** Extraction returns empty after applying redaction rules  
**Fix:**

1. Ensure redact selectors don't overlap with extract selector
2. Test extraction BEFORE redaction in template
3. Add `notes` explaining why specific fields are redacted

### Locale Mismatch

**Problem:** Template works in en_US but fails in fr_FR  
**Fix:**

1. Add locale-specific regex patterns: `(Present|Présent|Actualmente)`
2. Document supported locales in `notes`
3. Recommend users ensure browser locale matches tested locale
4. Create separate template versions if patterns differ too much

### False Positives

**Problem:** Regex pattern matches unrelated text on page  
**Fix:**

1. Tighten pattern with anchors: `\b(Present)\b` instead of `(Present)`
2. Require more context: `(on|at|since)\s+(Present|Current)`
3. Use selector to constrain where pattern searches

---

## Integration with TLSNotary Reference Implementation

### Using TLSNotary CLI

```bash
# Initialize a notarization session
tlsnotary start https://dashboard.stripe.com

# Apply template
tlsnotary apply-template income/stripe-monthly-volume

# Verify extraction
tlsnotary preview-extraction

# Apply redaction
tlsnotary apply-redaction

# Finalize proof
tlsnotary finalize-proof

# Share badge
zk badge-share --proof stripe-proof.json
```

### Using Reclaim Protocol (Alternative)

```bash
# Reclaim SDK makes this simpler for end users
npm install @reclaim-protocol/sdk

const proof = await reclaimProof.generateProof({
  template: "income/stripe-monthly-volume",
  user: "user@example.com"
});
```

---

## When to Update a Template

| Trigger                                              | Action                                         | Version |
| ---------------------------------------------------- | ---------------------------------------------- | ------- |
| New selector required after site redesign            | Update selector, add fixtures                  | 0.1.1   |
| Pattern too broad, causing false matches             | Tighten regex, document reason                 | 0.1.2   |
| Support for new language/locale                      | Add locale patterns, test                      | 0.2.0   |
| Significant claim change (e.g., $10k→$50k threshold) | Major version                                  | 1.0.0   |
| Security issue (overly permissive redaction)         | Patch immediately, mark old version deprecated | 0.1.3+  |

---

## Next Steps for Template Maturity

All seeded templates are currently `draft` status. To promote to `tested`:

1. ✅ Template passes schema validation
2. ⚠️ Selector validated against current site (NEEDED)
3. ⚠️ Fixture corpus created (NEEDED)
4. ⚠️ Redaction tested (NEEDED)
5. ⚠️ At least 1 successful notarization completed (NEEDED)

To promote to `production`:

1. ✅ All "tested" criteria met
2. ⚠️ 10+ successful notarizations
3. ⚠️ No issues reported in last 30 days
4. ⚠️ Monitored for site changes weekly
