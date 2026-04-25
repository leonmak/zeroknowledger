# TLSNotary Template Registry

**Community-driven verification templates for TLSNotary-based zero-knowledge proofs.**

---

## Quick Links

- **For users creating badges:** See [How to Create a Badge](#how-to-create-a-badge)
- **For template authors:** See [Contributing Templates](#contributing-templates)
- **For integrators:** See [TLSNotary Workflow Guide](./TLSNOTARY_WORKFLOW.md)
- **Template specs:** [Schema](./schema/template.schema.json) | [Examples](./templates/)

---

## How to Create a Badge

1. Go to [zeroknowledger.com/badges](/badges) and browse available templates
2. Choose a template (e.g., "Stripe Merchant")
3. Click "Generate badge"
4. Install our browser extension (or use Reclaim/zkPass)
5. Log into the target site (e.g., dashboard.stripe.com)
6. The extension generates a cryptographic proof
7. Badge appears on your profile at zeroknowledger.com/@yourname
8. Share via [zeroknowledger.com/cases/@yourname](./cases)

---

## Contributing Templates

### Template Structure

All templates are JSON files in `templates/` following the schema in `schema/template.schema.json`.

Example:

```json
{
  "name": "category/service-claim",
  "version": "0.1.0",
  "status": "draft",
  "claim": "Human-readable claim",
  "target": {
    "url": "https://example.com/dashboard",
    "auth": "session"
  },
  "extract": {
    "selector": "CSS selector(s)",
    "pattern": "regex pattern",
    "transform": "optional JS expression"
  },
  "disclose": {
    "mode": "boolean|threshold|exact|range",
    "value": 10000,
    "comparison": "gte|lte|eq"
  },
  "redact": ["selector1", "selector2"],
  "badge": {
    "label": "Display name",
    "icon": "icon",
    "color": "#hex"
  },
  "freshness": {
    "max_age_days": 30,
    "stale_after_days": 45
  }
}
```

### Review Checklist

Before submitting a PR:

- [ ] Template validates against `schema/template.schema.json`
- [ ] Selector tested against current target site
- [ ] Fallback selectors provided for fragile DOM
- [ ] Pattern tested to avoid false positives
- [ ] Redaction removes all PII
- [ ] Freshness policy reflects reality
- [ ] 2+ fixtures included (see [Fixture Format](./FIXTURE_FORMAT.md))
- [ ] Status is `draft` (will be promoted by maintainers)

### Submitting

1. Fork zeroknowledger on GitHub
2. Add your template to `docs/tlsnotary/templates/{category}-{service}.json`
3. Add fixtures to `docs/tlsnotary/fixtures/{category}/{service}/`
4. Run validation: `node scripts/validate-template.js --template <path> --fixture <path>`
5. Open PR with description of what the template proves

---

## Template Status Lifecycle

### Draft

- Initial submission
- Selector not yet validated on live site
- Fixtures may not exist
- Do not use for real proofs

### Tested

- ✅ Selector works on current site
- ✅ 2+ fixtures provided and pass validation
- ✅ Redaction verified
- ✅ At least 1 successful notarization

### Production

- ✅ All "Tested" criteria met
- ✅ 10+ successful notarizations
- ✅ Monitored weekly for site changes
- ✅ Community-maintained

### Deprecated

- Site no longer supports proof generation
- Better alternative template exists
- Marked for removal in next major version

---

## Template Maintenance

### How Template Health is Monitored

1. **Weekly site checks** — Selectors tested against current HTML
2. **Notarization failures** — Track if proofs fail to generate
3. **Community reports** — GitHub issues from failed attempts
4. **DOM change tracking** — Subscribe to site change notifications

### If a Template Breaks

1. File an issue: `[template name] selector mismatch`
2. Maintainers test and publish fix within 24h
3. Version increments (0.1.1, 0.1.2, etc.)
4. Users re-generate badges with new template

---

## Current Seeded Templates

**Status:** All templates are currently `draft`. We are seeking:

- Fixture corpus for each template
- Testing against real TLSNotary sessions
- Promotion to `tested` and `production` status

| Template                               | Category    | Status | Added      |
| -------------------------------------- | ----------- | ------ | ---------- |
| income/stripe-monthly-volume           | Income      | draft  | 2026-04-25 |
| income/paypal-business-verified        | Income      | draft  | 2026-04-25 |
| dev/github-account-age                 | Developer   | draft  | 2026-04-25 |
| dev/github-contributions-90d           | Developer   | draft  | 2026-04-25 |
| dev/stackoverflow-reputation-tier      | Developer   | draft  | 2026-04-25 |
| career/linkedin-current-role           | Career      | draft  | 2026-04-25 |
| credential/aws-certified-badge         | Credential  | draft  | 2026-04-25 |
| freelance/upwork-top-rated             | Freelance   | draft  | 2026-04-25 |
| hospitality/airbnb-superhost           | Hospitality | draft  | 2026-04-25 |
| fitness/strava-active-athlete          | Fitness     | draft  | 2026-04-25 |
| learning/duolingo-streak-tier          | Learning    | draft  | 2026-04-25 |
| membership/netflix-active-subscription | Membership  | draft  | 2026-04-25 |

---

## Integration Guides

- **TLSNotary reference impl** → [TLSNOTARY_WORKFLOW.md](./TLSNOTARY_WORKFLOW.md)
- **Fixture format & examples** → [FIXTURE_FORMAT.md](./FIXTURE_FORMAT.md)
- **Template validation tool** → `scripts/validate-template.js`

---

## Roadmap

- [ ] Promote 5 templates to `tested` status (with fixtures)
- [ ] Integrate TLSNotary CLI for proof generation
- [ ] Build template health monitoring dashboard
- [ ] Add template editor UI
- [ ] Support Reclaim Protocol integration
- [ ] Multi-locale template variants

---

## Questions?

- **Template authors:** Check [SEED_TEMPLATE_LIBRARY.md](./SEED_TEMPLATE_LIBRARY.md)
- **Developers:** See [TLSNOTARY_WORKFLOW.md](./TLSNOTARY_WORKFLOW.md)
- **Issues:** [GitHub Issues](https://github.com/leonmak/zeroknowledger/issues)
- **Discussions:** [GitHub Discussions](https://github.com/leonmak/zeroknowledger/discussions)
