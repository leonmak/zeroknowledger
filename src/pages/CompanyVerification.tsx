import { Link, useParams, useSearchParams } from "react-router";
import Nav from "../components/Nav";
import "./company-verification.css";

const domainPattern = /^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,63}$/;

export default function CompanyVerification() {
  const { company = "" } = useParams();
  const [params] = useSearchParams();
  const message = params.get("message")?.trim() ?? "";
  const tooLong = message.length > 600;
  const statement = tooLong ? "" : message;
  const badgeCharacters = Array.from(statement.replace(/\s+/gu, " "));
  const badgeCaption = badgeCharacters.length > 32
    ? badgeCharacters.slice(0, 31).join("") + "…"
    : badgeCharacters.join("");
  const name = company.toLowerCase();
  const domain = name.includes(".") ? name : `${name}.com`;
  const valid = domain.length <= 64 && domainPattern.test(domain);
  const prover = new URL("https://badge.zeroknowledger.com/");
  if (valid) prover.searchParams.set("company", domain);
  if (message && !tooLong) prover.searchParams.set("message", message);

  return (
    <main className="company-page">
      <title>{valid ? `Verify @${domain} · zeroknowledger` : "Company email verification · zeroknowledger"}</title>
      <Nav />
      <section className="company-grid">
        <div className="company-hero">
          {valid && <p className="company-domain">@{domain}</p>}
          <h1>{valid ? `Sign with your @${domain} email` : "Enter a valid company domain"}</h1>
          {valid ? (
            <p className="company-lead">
              Sign a message and share it as a badge. The badge shows your verified work domain while keeping your email address private.
            </p>
          ) : (
            <p className="company-lead">
              Use a company name for a .com domain or enter the full domain, such as <Link to="/company/acme.com">acme.com</Link>.
            </p>
          )}
        </div>
        {valid && (
          <div className="company-verification">
            <section className="company-panel" aria-label="Work email verification">
              <a href={prover.href} rel="noreferrer" className="btn1 btn-link" style={{ borderRadius: 8 }}>
                Start @{domain} verification →
              </a>
              {tooLong && <p className="company-note">The linked message is longer than 600 characters. Enter a shorter statement in the verifier.</p>}
              <ol className="company-steps">
                <li><strong>Send.</strong> Copy the one-time subject and email it from @{domain} to an inbox you can access.</li>
                <li><strong>Verify.</strong> Open the received <code>.eml</code> in the verifier. Your browser generates the proof locally, and the email file stays on your device.</li>
                <li><strong>Share.</strong> Copy the public link, HTML badge, or Markdown.</li>
              </ol>
            </section>
            <aside className="company-result">
              <h2>Example badge</h2>
              <details open={message && !tooLong ? true : undefined}>
                <summary aria-label="Preview the public statement">
                  <span className="company-sample"><span>{badgeCaption || "Work email badge"}</span><strong>{domain}</strong></span>
                  <span className="company-disclosure">Preview the public page</span>
                </summary>
                {statement && <blockquote>{statement}</blockquote>}
                <p className="company-note">The public page shows the verified domain, verification date, and any statement you publish.</p>
              </details>
            </aside>
          </div>
        )}
      </section>
    </main>
  );
}
