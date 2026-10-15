# Retrochat age authorization

The age-only integration lives in `verifier/src/age.ts` and migration `0009_age_requests.sql`. It is separate from the unique-person account-binding API.

Set `RETROCHAT_AGE_SECRET` (32–256 characters, matching Retrochat's `ZK_AGE_SECRET`), `RETROCHAT_RETURN_URL` and `AGE_SITE_URL`. Apply the D1 migration and deploy the registry, this frontend and Retrochat together. No credentials or deployment were changed during implementation.

`POST /age/requests` and `POST /age/exchange` require the server-side bearer secret. The browser gets an opaque request id; the exchange verifier stays on Retrochat's backend. The trusted proof webhook binds a fresh `identity/singpass-age-15-plus` proof to `session.age_request`. Exchange is atomic and single-use. `GET /age/requests/:id` exposes only request status and the fixed return link, with no identity details.

The method page recognizes `?age_request=…` and offers Verify age for Retrochat plus Return to Retrochat. Retrochat can also invoke the same extension plugin directly, keeping the room open. Neither client-side success nor visiting the return link grants age.

Tests: `node --test --experimental-strip-types --no-warnings test/age.test.ts test/issuer.test.ts` from verifier/, followed by the TypeScript check. Existing unique-person tests assume the removed unique-person template; that prior template migration is separate from this age-only flow.
