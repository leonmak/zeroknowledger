# Fixture Format & Examples

**For validating template selectors and extraction logic before notarization.**

Last updated: 2026-04-26

## Fixture Structure

Each template should have at least 2 fixtures (success case + edge case). Store in a directory alongside the template:

```
docs/tlsnotary/fixtures/
  income/
    stripe-monthly-volume/
      2024-04-us-en.html          # Real captured page
      2024-04-us-en.extraction.json # Expected output
  dev/
    github-account-age/
      2024-04-account.html
      2024-04-account.extraction.json
```

## Fixture File Format

### HTML Fixture (`{name}.html`)

Captured from actual target site. Should include:

- Full page or representative DOM section
- All elements referenced by template's `extract.selector` and `redact[]`
- Real data (sanitized of personal info beyond what redaction strips)
- Meta: capture date, locale, browser, TLS version as HTML comment

Example: `stripe-monthly-volume/2024-04-us-en.html`

```html
<!-- FIXTURE META
  template: income/stripe-monthly-volume
  captured: 2024-04-20T10:45:00Z
  locale: en_US
  browser: Chrome 125
  tls_version: 1.3
  notes: Captured from live dashboard.stripe.com, PII redacted
-->

<html>
  <head>
    <meta charset="utf-8" />
    <title>Stripe Dashboard</title>
  </head>
  <body>
    <!-- ... Stripe page HTML ... -->
    <div class="BalanceSummary">
      <span data-testid="gross-volume">$142,500.00</span>
    </div>
    <!-- ... other page content ... -->

    <!-- REDACTED SECTIONS (these should be removed by template) -->
    <div data-testid="account-email">merchant@example.com</div>
    <div data-testid="bank-account-last4">•••• 1234</div>
    <meta name="csrf-token" content="token_abc123" />
  </body>
</html>
```

### Extraction Result (`{name}.extraction.json`)

Expected output after selector + regex + transform applied:

```json
{
  "success": true,
  "matched_text": "$142,500.00",
  "extracted_value": 142500,
  "claim": "stripe_monthly_volume_gte_10000",
  "passes_threshold": true,
  "notes": "Volume is $142,500, exceeds $10,000 threshold"
}
```

---

## Validation Flow

When a contributor updates a template:

1. **Extract** — Run selector against fixture HTML
2. **Validate** — Apply regex pattern to match
3. **Transform** — Apply JS transform function
4. **Compare** — Check result matches expected extraction
5. **Redact** — Remove all `redact[]` selectors
6. **Finalize** — Confirm only redacted data remains

### CLI Example

```bash
zk template-validate \
  --template docs/tlsnotary/templates/stripe-monthly-volume.json \
  --fixture docs/tlsnotary/fixtures/income/stripe-monthly-volume/2024-04-us-en.html \
  --expected docs/tlsnotary/fixtures/income/stripe-monthly-volume/2024-04-us-en.extraction.json
```

Expected output:

```
✓ Selector matched: 1 element
✓ Pattern matched: "$142,500.00"
✓ Transform result: 142500
✓ Extraction matches expected: true
✓ Redaction removed: 3/3 sensitive selectors
✓ Template validates
```

---

## Fixture Coverage Requirements

### Minimum (for `tested` status)

- 1 success fixture (positive case, data passes threshold)
- 1 edge fixture (data just above/below threshold)

### Recommended (for `production`)

- Success fixture (typical case)
- Edge case 1 (minimum passing value)
- Edge case 2 (maximum passing value)
- Failure fixture (data fails threshold, shows graceful rejection)
- Locale variant (if applicable)

---

## Storing Fixtures Securely

**Never commit real user data.** Sanitize fixtures:

```javascript
// ✗ Bad: Real email and account info
<div data-testid="account-email">john.doe@acme.com</div>

// ✓ Good: Sanitized while preserving selector validity
<div data-testid="account-email">user@example.com</div>
```

---

## Example: GitHub Account Age

### Fixture: `github-account-age/2024-04-account.html`

```html
<!-- FIXTURE META
  template: dev/github-account-age
  captured: 2024-04-20T15:30:00Z
  locale: en_US
  tls_version: 1.3
-->

<html>
  <body>
    <div class="vcard-fullname p-name vcard-fullname-content d-block">
      Alice Developer
    </div>

    <div class="js-profile-editable-area">
      <div class="d-flex gap-2">
        <time-ago prefix="joined">2019-03-15</time-ago>
      </div>
      <relative-time datetime="2019-03-15T00:00:00Z"
        >Mar 15, 2019</relative-time
      >
    </div>

    <!-- REDACTED -->
    <div class="vcard-username">alicedev</div>
    <div class="js-user-profile-bio">Senior engineer at TechCorp</div>
  </body>
</html>
```

### Expected Extraction: `github-account-age/2024-04-account.extraction.json`

```json
{
  "success": true,
  "matched_date": "2019-03-15",
  "days_since_created": 1862,
  "claim": "github_account_age_days_gte_365",
  "passes_threshold": true
}
```

---

## Updating Fixtures After Site Changes

When a site changes its HTML:

1. Capture new fixture from live site
2. Validate that template selectors still work
3. Update selector if needed
4. Commit new fixture with metadata about why it changed
5. Increment template version (patch version if selector unchanged)
6. Mark old fixture as archived but keep for history

Example commit message:

```
docs(templates): Update GitHub fixture after site redesign

- New relative-time element layout in profile
- Selector still matches after testing
- No version bump required (selector unchanged)

Template: dev/github-account-age
Fixture: 2024-04-20-redesign.html
Status: Tested
```
