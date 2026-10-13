import { Link } from "react-router";
import Nav from "../components/Nav";
import {
  AppNicknamesIllustration,
  VaultIllustration,
  LockedBoxIllustration,
  SealedEnvelopesIllustration,
} from "../components/privacy/Illustrations";

// User-facing account of what leaves the device for each Singpass badge.
// Keep in sync with docs/tlsnotary/templates/singpass-*.json and verifier/.

export default function PrivacyPage() {
  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#0d1117",
        color: "#e6edf3",
        fontFamily: "Inter, sans-serif",
      }}
    >
      <title>Your Singpass details stay with you · zeroknowledger</title>
      <meta
        name="description"
        content="Prove to an app that you're a real Singpass holder without telling it who you are: what stays on your device, who sees what, and what we store."
      />
      <Nav />

      <article
        style={{ maxWidth: 820, margin: "0 auto", padding: "56px 24px 96px" }}
      >
        <p style={eyebrow}>Privacy</p>
        <h1 style={h1}>Your Singpass details stay with you</h1>
        <p style={lead}>
          Prove to an app that you&apos;re a real Singpass holder without
          telling it who you are. Proving a badge means showing a fact about
          your account, not handing over the account. Here is exactly what
          leaves your device, who can see it, and what we keep.
        </p>

        <div style={callout}>
          <strong style={{ color: "#7ee787" }}>In short:</strong> apps, our
          verifier, and our registry do not receive your Singpass ID (your
          NRIC/FIN number), mobile number, email, name, or Singpass login
          cookie. In this version, website code running in your browser uses
          your Singpass ID and mobile number locally to make the zero-knowledge
          proof. The proof is then encrypted so only the attested enclave can
          open it.
        </div>
        <p style={{ ...muted, fontSize: 13, marginTop: 12 }}>
          <strong style={{ color: "#d29922" }}>Current trust boundary:</strong>{" "}
          making the proof requires you to trust the code served by this site,
          as well as the TLSNotary extension. The code is intended to keep these
          values in your browser and sends only the encrypted proof. A future
          extension-based prover would remove this trust in the website code.
        </p>

        <h2 style={h2}>What&apos;s in it for you</h2>
        <p style={{ ...muted, fontSize: 15, maxWidth: 680, marginBottom: 16 }}>
          Apps and communities want to know you&apos;re a real person, and that
          you haven&apos;t signed up ten times. Usually that means uploading
          your IC or a selfie, which they then keep. Here, they learn only that
          fact.
        </p>
        <div style={benefits}>
          <Benefit title="Prove you're real, stay anonymous">
            An app learns that your account belongs to a verified Singpass
            holder. It never learns your name, Singpass ID, phone number or
            email.
          </Benefit>
          <Benefit title="Nothing to upload, nothing to leak">
            No photo of your IC, no selfie, no copy of your documents sitting in
            some app&apos;s database waiting for a breach.
          </Benefit>
          <Benefit title="Can't be tracked across apps">
            Each app you link gets its own nickname for you, so two apps
            can&apos;t compare notes and work out they share a user.
          </Benefit>
          <Benefit title="Fewer bots and fake accounts">
            Each person can link only one account per app, so the communities
            you join have fewer scammers, bots and duplicate profiles.
          </Benefit>
          <Benefit title="You stay in control">
            You approve exactly what&apos;s shared each time, and you can move
            your link to a different account later.
          </Benefit>
        </div>
        <p style={{ ...muted, fontSize: 13, marginTop: 12 }}>
          Each app you link runs its own quick proof. That&apos;s deliberate:
          it&apos;s why apps get different nicknames and can&apos;t link you
          together. Singpass holders include FIN holders, so apps learn
          &ldquo;Singpass holder&rdquo;, not your nationality.
        </p>

        <h2 style={h2}>In four pictures</h2>
        <Picture
          n={1}
          title="Singpass's reply travels in a locked box"
          art={<LockedBoxIllustration />}
        >
          Your device asks Singpass for one page of your account, the same page
          you see when you log in. The reply is locked with the same encryption
          as any secure website. Our verifier carries the locked box and keeps a
          copy of it, so it can later confirm the reply really came from
          Singpass. It has no key, so it can&apos;t open it.
        </Picture>
        <Picture
          n={2}
          title="Your Singpass ID and mobile go into sealed envelopes"
          art={<SealedEnvelopesIllustration />}
        >
          Your device opens the reply. Your name, email and everything else
          simply stay there. Your Singpass ID and mobile number are each sealed
          in an envelope with a random sticker inside. Our verifier only gets
          each envelope&apos;s fingerprint: a one-way summary that can&apos;t be
          turned back into the contents, by us or anyone, and the random sticker
          stops anyone guessing them. The fingerprint also pins the contents, so
          they can&apos;t be swapped later. Our verifier confirms the
          fingerprints really came from Singpass&apos;s reply and remembers them
          for step 3.
        </Picture>
        <Picture
          n={3}
          title="Your browser makes a proof from your Singpass ID and mobile"
          art={<VaultIllustration />}
        >
          Website code running in your browser takes what&apos;s inside the
          envelopes and makes a short code, plus a certificate saying
          &ldquo;this code was made from the details in these sealed
          envelopes&rdquo;. This is a zero-knowledge proof: it can be checked,
          but reveals nothing about what&apos;s inside. Only the code and
          certificate leave, in a locked box that only our vault can open. The
          vault is an attested enclave: a locked-down machine whose memory
          nobody can read into, not even us, running code we publish, and your
          browser checks Google&apos;s signed proof of that code first. Our
          badge registry passes the box along without being able to open it. The
          vault checks the certificate against the fingerprints from step 2 and
          turns the code into this app&apos;s code with a secret key that never
          leaves it.
        </Picture>
        <Picture
          n={4}
          title="The same badge in every app, under a different nickname"
          art={<AppNicknamesIllustration />}
        >
          Each app you link shows the <em>Unique Singpass Person</em> badge on
          your account, and knows you by its own nickname. Tapping the badge
          opens a check page that says &ldquo;verified for this app&rdquo;, and
          nothing about who you are. The apps never see the code behind the
          nicknames, so they can&apos;t tell they share a user, and one app
          can&apos;t have the same person twice.
        </Picture>

        <h2 style={h2}>Step by step</h2>
        <Flow />

        <h2 style={h2}>One app-link example</h2>
        <p style={muted}>
          Imagine <strong>payroll.example</strong> wants to link its account{" "}
          <code style={code}>employee-842</code> to a unique person. It creates
          a short-lived link, then you prove with Singpass. The verified
          Singpass reply gives the enclave two sealed fingerprints, while your
          browser sends it a certificate that those fingerprints belong to one
          Singpass ID and mobile number. The enclave checks both match, then
          returns a different nickname just for
          <strong> payroll.example</strong>. We store that nickname with{" "}
          <code style={code}>employee-842</code>; the app never receives your
          Singpass ID, mobile number, or the code used to create its nickname.
        </p>

        <ol style={steps}>
          <Step n={1} title="You log in to Singpass, as usual">
            The TLSNotary extension opens the Singpass portal in a window. You
            log in there yourself; we never see your password or 2FA. The
            extension notices your logged-in session so it can repeat one
            request.
          </Step>
          <Step
            n={2}
            title="Your browser repeats one request to Singpass, end-to-end encrypted"
          >
            The extension asks Singpass for one page of your account data. The
            connection is TLS encrypted from your browser to Singpass. Our
            verifier forwards the encrypted bytes and records them, but has no
            key to read them.
          </Step>
          <Step n={3} title="You approve what gets shown">
            Before anything is disclosed, the extension lists exactly which
            parts will be revealed and which will only be committed (sealed).
            Nothing is sent to the verifier until you approve. This screen
            belongs to the extension, not to our site.
          </Step>
          <Step n={4} title="The verifier checks the proof">
            The verifier confirms the revealed parts really came from{" "}
            <code style={code}>portal.singpass.gov.sg</code> and learns only
            those parts. For sealed fields it gets a fingerprint (a salted hash)
            it can&apos;t reverse.
          </Step>
          <Step n={5} title="Your browser proves you're a unique person">
            Website code running in your browser opens the sealed Singpass ID
            and mobile number locally and computes a zero-knowledge proof that a
            code, <code style={code}>H</code>, was derived from exactly those
            sealed values. This means you trust the code this site serves not to
            send those values elsewhere. It checks the enclave&apos;s
            attestation (Google&apos;s signed statement of the exact code it
            runs, on Intel TDX with debugging off), then encrypts the proof and{" "}
            <code style={code}>H</code> to a key only that enclave holds. Our
            registry relays the ciphertext without being able to read it. The
            enclave verifies the proof against the fingerprints its verifier saw
            in step 4, and returns only a keyed code for this app (
            <code style={code}>HMAC</code> with a key that never leaves it). The
            proof protocol does not send your Singpass ID or mobile number to
            our servers or the app.
          </Step>
          <Step n={6} title="The badge is issued">
            We record that your browser&apos;s badge holder has the badge. If an
            app sent you here, it learns only that its account is linked to a
            unique person, via an ID specific to that app.
          </Step>
        </ol>

        <h2 style={h2}>What gets shared</h2>
        <div style={tableWrap}>
          <table style={table}>
            <thead>
              <tr>
                <th style={th}>Singpass data</th>
                <th style={th}>What happens to it</th>
              </tr>
            </thead>
            <tbody>
              <Row
                label="Request path and host"
                value="Revealed"
                note="So the verifier knows which Singpass page was proved"
              />
              <Row
                label="Response status and date"
                value="Revealed"
                note="To check the proof is recent"
              />
              <Row label={`"status": "SUCCESS"`} value="Revealed" />
              <Row
                label="Singpass ID (NRIC/FIN)"
                value="Used locally by the website prover; not sent to our servers or apps"
                strong
              />
              <Row
                label="Mobile number"
                value="Used locally by the website prover; not sent to our servers or apps"
                strong
              />
              <Row
                label="Name, email, address, photo"
                value="Stays on your device"
              />
              <Row
                label="Singpass login cookie"
                value="Stays on your device"
                note="Only ever sent to Singpass itself"
              />
            </tbody>
          </table>
        </div>

        <h2 style={h2}>Who sees what</h2>
        <div style={tableWrap}>
          <table style={table}>
            <thead>
              <tr>
                <th style={th}>Party</th>
                <th style={th}>Sees</th>
                <th style={th}>Never sees</th>
              </tr>
            </thead>
            <tbody>
              <Party
                who="You (your browser)"
                sees="Everything Singpass returns, as when you use the portal"
                never="—"
              />
              <Party
                who="This website's prover"
                sees="The committed Singpass ID and mobile number in your browser, to create the zero-knowledge proof"
                never="Your Singpass login cookie"
              />
              <Party
                who="Singpass"
                sees="A normal request from your session, sent from our verifier's network address"
                never="That this is a proof"
              />
              <Party
                who="Our verifier"
                sees="Encrypted traffic; the revealed parts above; your IP address and the time"
                never="Your cookie, name, email, Singpass ID, mobile number"
              />
              <Party
                who="Our badge registry"
                sees="The badge holder id and encrypted proof ciphertext"
                never="Your Singpass ID or mobile number"
              />
              <Party
                who="Apps you link"
                sees="That the account they named is linked to a unique person, via an app-specific id"
                never="Any Singpass data, or your ids in other apps"
              />
            </tbody>
          </table>
        </div>

        <h2 style={h2}>What we store</h2>
        <ul style={list}>
          <li>
            <strong>Badges:</strong> your badge holder id (a hash of a secret
            kept in your browser), which badge, and when it was proved.
          </li>
          <li>
            <strong>App links:</strong> for each app, a keyed hash of{" "}
            <code style={code}>H</code> and the app&apos;s account id. Moving a
            link replaces it; old links aren&apos;t kept, only a count of moves.
          </li>
          <li>
            <strong>Pending proofs:</strong> for up to 10 minutes between steps
            4 and 5, the two sealed fingerprints. Deleted once used.
          </li>
          <li>
            <strong>Attempt log:</strong> whether each proof issued a badge and,
            if not, why. Reasons never contain your data.
          </li>
        </ul>
        <p style={muted}>
          Our verifier doesn&apos;t log the revealed parts of proofs. None of
          the above contains your Singpass ID, mobile number, name or email.
        </p>

        <h2 style={h2}>What to know</h2>
        <ul style={list}>
          <li>
            <strong>
              Uniqueness follows your Singpass ID and current mobile number.
            </strong>{" "}
            If you change your Singpass mobile number, you&apos;ll look like a
            new person to apps and can link again.
          </li>
          <li>
            <strong>Current website-code trust.</strong> The TLSNotary extension
            returns the sealed-value openings to this site&apos;s code so it can
            make the proof in your browser. The intended proof protocol encrypts
            the proof before it leaves your device, but the website code can
            access your Singpass ID and mobile number while it proves. You must
            trust the version of this site you load. Moving proving into the
            extension would remove this requirement.
          </li>
          <li>
            <strong>
              The enclave receives a code derived from your Singpass ID and
              mobile.
            </strong>{" "}
            That code (<code style={code}>H</code>) is not your data, but it
            isn&apos;t secret-keyed: anyone who could read it and already knew
            your Singpass ID could try every mobile number to find yours. So
            it&apos;s only ever sent encrypted to the attested enclave, never
            stored or logged, and turned there into a per-app code with a key
            only the enclave holds.
          </li>
          <li>
            <strong>Singpass sees the request</strong> coming from our
            verifier&apos;s network address rather than yours.
          </li>
        </ul>

        <h2 style={h2}>Check it yourself</h2>
        <ul style={list}>
          <li>
            In the extension&apos;s approval screen, confirm that Singpass ID
            and mobile are marked as <em>hash</em> (sealed), not <em>reveal</em>
            .
          </li>
          <li>
            In your browser&apos;s developer tools (Network tab), the request to{" "}
            <code style={code}>/proofs/…</code> contains only a proof and a list
            of numbers, not your Singpass ID or phone number.
          </li>
        </ul>

        <p style={{ ...muted, marginTop: 32 }}>
          <Link to="/badges" style={{ color: "#7ee787" }}>
            ← Back to badges
          </Link>
        </p>
      </article>
    </main>
  );
}

function Benefit({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        border: "1px solid #1f2937",
        background: "#161b22",
        borderRadius: 12,
        padding: "14px 16px",
      }}
    >
      <div
        style={{
          fontWeight: 700,
          fontSize: 15,
          marginBottom: 6,
          color: "#7ee787",
        }}
      >
        {title}
      </div>
      <div style={{ ...muted, fontSize: 14 }}>{children}</div>
    </div>
  );
}

function Picture({
  n,
  title,
  art,
  children,
}: {
  n: number;
  title: string;
  art: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section style={{ margin: "8px 0 32px" }}>
      <h3
        style={{
          fontSize: 17,
          marginBottom: 12,
          display: "flex",
          gap: 10,
          alignItems: "baseline",
        }}
      >
        <span
          style={{
            color: "#7ee787",
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 14,
          }}
        >
          {n}
        </span>
        {title}
      </h3>
      <figure
        className="privacy-figure"
        style={{
          margin: 0,
          border: "1px solid #1f2937",
          borderRadius: 12,
          background: "#0d1117",
          padding: 12,
        }}
      >
        {art}
      </figure>
      <p style={{ ...muted, fontSize: 15, marginTop: 12, maxWidth: 680 }}>
        {children}
      </p>
    </section>
  );
}

function Flow() {
  const box = (title: string, lines: string[], color: string) => (
    <div
      style={{
        flex: "1 1 200px",
        border: `1px solid ${color}55`,
        background: `${color}10`,
        borderRadius: 10,
        padding: 14,
      }}
    >
      <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 6, color }}>
        {title}
      </div>
      {lines.map((l) => (
        <div
          key={l}
          style={{ fontSize: 13, color: "#c9d1d9", lineHeight: 1.5 }}
        >
          {l}
        </div>
      ))}
    </div>
  );
  const arrow = (label: string) => (
    <div
      style={{
        flex: "0 0 auto",
        alignSelf: "center",
        textAlign: "center",
        color: "#8b949e",
        fontSize: 12,
        padding: "0 4px",
      }}
    >
      <div style={{ fontSize: 18 }}>→</div>
      {label}
    </div>
  );
  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: 8,
        alignItems: "stretch",
        margin: "8px 0 24px",
      }}
    >
      {box(
        "Your device",
        [
          "Singpass login & cookie",
          "Singpass ID, mobile: sealed",
          "ZK proof made here",
        ],
        "#7ee787",
      )}
      {arrow("encrypted")}
      {box(
        "Our verifier",
        [
          "Forwards encrypted traffic",
          "Sees only revealed parts",
          "+ sealed fingerprints",
        ],
        "#58a6ff",
      )}
      {arrow("sealed proof + H")}
      {box(
        "Enclave + registry",
        [
          "Enclave checks the ZK proof",
          "Keys H per app",
          "No Singpass ID, no mobile",
        ],
        "#d2a8ff",
      )}
      {arrow("app id")}
      {box(
        "Apps you link",
        ["“Linked to a unique person”", "App-specific id only"],
        "#d29922",
      )}
    </div>
  );
}

function Step({
  n,
  title,
  children,
}: {
  n: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <li style={{ display: "flex", gap: 14, marginBottom: 18 }}>
      <span
        style={{
          flex: "0 0 28px",
          height: 28,
          borderRadius: "50%",
          background: "#161b22",
          border: "1px solid #30363d",
          display: "grid",
          placeItems: "center",
          fontSize: 13,
          fontWeight: 700,
          color: "#7ee787",
        }}
      >
        {n}
      </span>
      <div>
        <div style={{ fontWeight: 700, marginBottom: 4 }}>{title}</div>
        <div style={muted}>{children}</div>
      </div>
    </li>
  );
}

function Row({
  label,
  value,
  note,
  strong,
}: {
  label: string;
  value: string;
  note?: string;
  strong?: boolean;
}) {
  const tone = value.startsWith("Revealed")
    ? "#d29922"
    : value.startsWith("Sealed")
      ? "#7ee787"
      : "#8b949e";
  return (
    <tr>
      <td style={td}>
        <span style={{ fontWeight: strong ? 700 : 500 }}>{label}</span>
        {note && (
          <div style={{ fontSize: 12, color: "#556070", marginTop: 2 }}>
            {note}
          </div>
        )}
      </td>
      <td style={{ ...td, color: tone, fontWeight: strong ? 700 : 400 }}>
        {value}
      </td>
    </tr>
  );
}

function Party({
  who,
  sees,
  never,
}: {
  who: string;
  sees: string;
  never: string;
}) {
  return (
    <tr>
      <td style={{ ...td, fontWeight: 600 }}>{who}</td>
      <td style={td}>{sees}</td>
      <td style={{ ...td, color: "#7ee787" }}>{never}</td>
    </tr>
  );
}

const eyebrow = {
  fontSize: 13,
  fontWeight: 700,
  color: "#7ee787",
  letterSpacing: 1.4,
  textTransform: "uppercase",
  marginBottom: 10,
} as const;
const h1 = {
  fontSize: "clamp(30px, 5vw, 46px)",
  letterSpacing: "-1.2px",
  lineHeight: 1.1,
  marginBottom: 14,
} as const;
const h2 = {
  fontSize: 20,
  letterSpacing: "-0.3px",
  margin: "40px 0 14px",
} as const;
const lead = {
  color: "#8b949e",
  fontSize: 17,
  lineHeight: 1.65,
  maxWidth: 680,
} as const;
const muted = { color: "#8b949e", fontSize: 14, lineHeight: 1.65 } as const;
const code = {
  color: "#9fb3c8",
  fontFamily: "'JetBrains Mono', monospace",
  fontSize: "0.92em",
} as const;
const callout = {
  marginTop: 24,
  border: "1px solid #238636",
  background: "#12261e",
  borderRadius: 12,
  padding: "16px 18px",
  fontSize: 15,
  lineHeight: 1.6,
} as const;
const benefits = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))",
  gap: 12,
} as const;
const steps = { listStyle: "none", padding: 0, margin: "8px 0 0" } as const;
const list = { ...muted, paddingLeft: 20, display: "grid", gap: 8 } as const;
const tableWrap = {
  overflowX: "auto",
  border: "1px solid #1f2937",
  borderRadius: 12,
} as const;
const table = {
  width: "100%",
  borderCollapse: "collapse",
  fontSize: 14,
  minWidth: 560,
} as const;
const th = {
  textAlign: "left",
  padding: "10px 14px",
  background: "#161b22",
  color: "#8b949e",
  fontWeight: 600,
  fontSize: 13,
  borderBottom: "1px solid #1f2937",
} as const;
const td = {
  padding: "10px 14px",
  borderBottom: "1px solid #1f2937",
  verticalAlign: "top",
  lineHeight: 1.5,
} as const;
