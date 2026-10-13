# Reporting a soundness problem

If a method or proof type can be made to prove something false (a forged badge, a bypassable regex, a reused proof,
a way to claim twice), report it **privately** through
[GitHub security advisories](https://github.com/leonmak/zeroknowledger/security/advisories/new), not in a public issue.

What happens next:

1. Maintainers confirm it.
2. The affected versions are marked `"soundness": "revoked"` in the method's `status.json`, with a reason and an advisory
   link. Verifiers that check the registry then stop trusting badges from those versions, including ones already issued.
3. A fixed version is published, and the advisory is made public.
