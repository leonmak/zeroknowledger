# Method registry

Every way to earn a badge on zeroknowledger is a **method**: "had an email at this company", "LinkedIn shows a current
role", "Stripe volume ≥ $10k". Methods are plain JSON, contributed and maintained through pull requests.

```
registry/
  proof-types.json                  audited core: circuit or protocol + verifier (dkim-email, tlsn, opencerts…)
  methods/<namespace>/<name>/
    <version>.json                  one published version: immutable once merged
    status.json                     health + soundness per version: updated as things change
  schema/                           method, status and badge JSON schemas
  index.json                        generated (npm run registry:check); what the site and API read
```

## Proof types vs. methods

A **proof type** owns the cryptography: the circuit or protocol and the verifier. There are few of them, the core team
maintains them, and they get audited. A **method** only configures one: which site or domain, what to reveal, what to
keep hidden. Anyone can propose a method; nobody ships their own verifier.

## Versions are immutable

A published `<version>.json` never changes (CI rejects edits and deletions). Badges record the exact version and its
hash, so what a badge means can't change after the fact. To fix something, publish a new version:

| Bump | When | May change |
|---|---|---|
| patch `0.1.1` | Extraction fixes: a selector, a regex, a size limit | Everything except the claim, `disclose.output`, `nullifier.scope`, `proof_type` |
| minor `0.2.0` | Adds optional disclosures or runtimes | Same as patch |
| major `1.0.0` | The claim means something different | Anything, including `nullifier.scope` (which lets every account claim again) |

## Status: health and soundness are different things

`status.json` holds two separate judgements per version:

| | **Health**: can users still make new proofs? | **Soundness**: can proofs be trusted? |
|---|---|---|
| Values | `untested`, `working`, `degraded`, `broken` | `unreviewed`, `reviewed`, `audited`, `revoked` |
| Changed by | Anyone's report, confirmed by a maintainer or a scheduled check | Maintainers after review, audit or a security report |
| Effect on badges already issued | **None.** A site changing its API doesn't make old proofs false | **`revoked` means don't trust them either** |

`deprecated` (a better version exists) is separate from both: a deprecated version may still work, and its badges stay
valid.

Accepting parties set their own policy against these fields, for example "`career/linkedin-current-role` ≥ 1.2,
soundness `reviewed` or better, badge younger than 60 days".

## Contributing

- **New method or new version:** add `methods/<namespace>/<name>/<version>.json` (plus `status.json` for a new method,
  with `"health": "untested", "soundness": "unreviewed"`), then run `npm run registry:check` and open a PR.
- **A method broke:** open a "Method broken or flaky" issue, or a PR with a patch version.
- **A method can prove something false:** report it privately (see [SECURITY.md](../SECURITY.md)). Never in a public issue.
