import { Link } from "react-router";
import Nav from "../components/Nav";
import WorkEmailBadgeEmbed from "../components/WorkEmailProofBadge";

const contract = `// Proposed petition API. The supporter already holds an eligibility credential.
POST /api/endorsements/start
{ "petitionId": "support-letter" }
→ { "challenge": "...", "scope": "...", "expiresAt": "...", "groupId": "..." }

// The browser proves membership locally without sending another work email.
POST /api/endorsements/complete
{ "challenge": "...", "proof": "...", "nullifier": "..." }
→ { "accepted": true }

// Public output: aggregate counts only.
GET /api/petitions/support-letter/count
→ { "verifiedWorkEmailEndorsements": 42 }`;

const checks = `// Backend pseudocode. Load the challenge for this anonymous session.
const pending = await loadChallenge(session, request.challenge);
const group = trustedGroupFor(pending.requiredDomain);
const scope = petitionScope(configuredAppId, pending.petitionId);
await verifyMembershipProof(request.proof, {
  group, scope, challenge: pending.challenge, nullifier: request.nullifier,
}); // Must reject invalid proofs and roots outside the trusted group's policy.

// Reject expired or used challenges and duplicate endorsements atomically.
await database.transaction(async tx => {
  await tx.consumeLiveChallengeOnce(pending.id, Date.now());
  await tx.insertEndorsement({
    petitionId: pending.petitionId,
    nullifier: request.nullifier,
  }); // UNIQUE(petitionId, nullifier)
});`;

export default function EmailIntegration() {
  return <main style={{ minHeight: "100vh", background: "#0d1117", color: "#e6edf3", fontFamily: "Inter, sans-serif" }}>
    <title>Private work-email endorsements · Developer guide · zeroknowledger</title>
    <meta name="description" content="Integrate email zero-knowledge proofs into a petition: verification flow, server contract, duplicate prevention and privacy limits." />
    <Nav activeTab="developers" />
    <article style={{ maxWidth: 880, margin: "0 auto", padding: "48px 24px 80px", lineHeight: 1.75 }}>
      <Link to="/methods/employment/work-email" style={{ color: "#7ee787" }}>Employment / Work email</Link>
      <h1 style={{ fontSize: "clamp(28px, 5vw, 44px)", lineHeight: 1.15 }}>Let people support a cause without publishing their work email.</h1>
      <p style={{ color: "#b6c2cf", fontSize: 18 }}>A petition can accept a proof of access to a company mailbox and publish an aggregate endorsement count. The email address, LDAP username and original message do not need to appear on the petition.</p>
      <aside style={{ padding: 20, border: "1px solid #a87832", borderRadius: 12, background: "#241d13" }}>
        <strong>Available today: account-linked work email verification</strong>
        <p>Retrochat verifies mailbox access for room entry. The petition flow below is a proposed design that requires an issuer and a credential whose use cannot be linked to enrollment.</p>
      </aside>

      <WorkEmailBadgeEmbed />

      <h2>Company verification links</h2>
      <p>Send users to a company page such as <Link to="/company/acme" style={{ color: "#7ee787" }}>/company/acme</Link> for @acme.com. For other domains, use the full domain in the path. The prover requires a fresh email sent from an address at that exact domain. Once verified, users get a public link and an SVG embed.</p>
      <p>To suggest a statement, add a URL-encoded <code>message</code> parameter. For example, <Link to="/company/acme?message=I%20support%20an%20open%20employee%20forum." style={{ color: "#7ee787" }}>open the Acme example with a prefilled statement</Link>. Users can edit it and choose whether to publish after verifying.</p>

      <h2>A concrete use case</h2>
      <p>For example, a petition like <a href="https://standwithjensen.com/" style={{ color: "#7ee787" }}>Stand with Jensen</a> could accept an endorsement from someone with a verified company mailbox. Mailbox access is the eligibility check. Aliases and shared accounts can affect how many distinct people a count represents.</p>

      <h2>How Retrochat verifies a work email</h2>
      <ol>
        <li>Retrochat’s backend calls <code>POST /api/retrochat/start</code> with its account identifier and the required domain. The verifier creates an expiring link tied to both.</li>
        <li>The prover fetches the link’s details from <code>GET /api/challenge/:code</code> and displays the exact <code>emailSubject</code>. Retrochat subjects use 26–41 lowercase letters and digits. Supporting spaces or punctuation would require coordinated changes to the generator and circuit.</li>
        <li>The user sends an email with that subject from their work mailbox to an inbox they can access. They download the received <code>.eml</code> and open it in the prover. The browser uses the original email locally and sends a proof to <code>POST /api/claim</code>.</li>
        <li>The verifier validates the sender’s DKIM key, the signed subject, the domain and the live challenge. It stores a keyed digest of the email-derived identifier for duplicate prevention. Retrochat calls <code>POST /api/retrochat/status</code> for the account’s verified domain and expiry.</li>
      </ol>
      <p>The zkbadge implementation lives in <code>shared/company-bridge.mjs</code>, <code>shared/company-email-subject.mjs</code>, <code>server/claims.mjs</code> and <code>circuits/zksender/src/main.nr</code>. The Retrochat API credentials belong on the backend.</p>

      <h2>How a petition can use an anonymous credential</h2>
      <ol>
        <li><strong>Enroll separately.</strong> Use the sender proof to check mailbox access with an issuer that serves more than one petition. The supporter’s device generates a private secret and sends its commitment to the issuer before requesting the email challenge. The issuer ties that challenge to the commitment and registers it in a shared eligibility group only after checking the proof and enforcing one enrollment per eligible mailbox. The enrollment email and challenge carry no petition ID.</li>
        <li><strong>Sign later.</strong> After the supporter reviews the petition and chooses to sign, their device proves membership in the approved group without identifying their commitment. The proof binds the endorsement to the app, petition and fresh challenge. No work email is sent at signing time.</li>
        <li><strong>Count once.</strong> The proof discloses a nullifier derived from the private secret and the app and petition scope. Keep the scope stable across challenges so a second signature from the same credential is rejected. Publish aggregate counts.</li>
      </ol>

      <h2>Proposed petition API</h2>
      <p>This pseudocode assumes an anonymous membership verifier and a trusted group for the required domain. Configure the group and app identity on the server. Derive the proof scope there and bind each short-lived challenge to the anonymous session.</p>
      <pre style={codeStyle}><code>{contract}</code></pre>
      <pre style={codeStyle}><code>{checks}</code></pre>

      <h2>Privacy requirements before launch</h2>
      <ul>
        <li><strong>Keep enrollment identifiers at the issuer.</strong> The sender circuit exposes a deterministic identifier to the verifier. Retrochat’s keyed storage protects it against guessing from a database copy alone. The petition should receive only the anonymous membership proof and its petition-specific nullifier. Rehashing the existing email identifier with a public petition ID still permits guessing.</li>
        <li><strong>Preserve duplicate protection during recovery.</strong> Recover the same credential secret where possible. Issuing a fresh secret can give the mailbox a new nullifier and a second signature, even if the first credential is revoked. Define recovery and expiry before issuing credentials.</li>
        <li><strong>Limit metadata.</strong> Avoid named login, analytics, tracking cookies and retained IP logs in the endorsement flow. Use a no-referrer policy and exclude proof data, challenge codes and identifiers from logs. Delayed publication of aggregate counts reduces timing correlation.</li>
        <li><strong>Explain the boundary.</strong> Company mail administrators can see the sender, subject and timing of enrollment emails. Independent enrollment removes the signing-time email, but small groups, timing, network logs and managed devices can still reveal activity.</li>
      </ul>

      <h2>Acceptance checks for the adapter</h2>
      <p>Test bad DKIM signatures and the wrong company domain at enrollment. At signing, reject untrusted group roots, expired or reused challenges, proofs for another petition or app, and repeated nullifiers under concurrent submission. Confirm that signing works with the existing credential without contacting the email verifier and that the public API returns only aggregate counts.</p>
    </article>
  </main>;
}

const codeStyle = { background: "#161b22", border: "1px solid #30363d", borderRadius: 12, padding: 20, overflowX: "auto", fontSize: 13, lineHeight: 1.65 } as const;
