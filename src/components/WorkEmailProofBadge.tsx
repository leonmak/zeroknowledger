import { useState } from "react";

const proverUrl = "https://badge.zeroknowledger.com/";
const imagePath = "/verify-work-email.svg";
const embedUrl = "https://zeroknowledger-web.leonmakansheng.workers.dev" + imagePath;
const markdown = `[![Verify work email](${embedUrl})](${proverUrl})`;
const html = `<a href="${proverUrl}" rel="noreferrer"><img src="${embedUrl}" alt="Verify work email" width="157" height="22"></a>`;

export function WorkEmailProofBadge() {
  return (
    <a href={proverUrl} rel="noreferrer">
      <img src={imagePath} alt="Verify work email" width={157} height={22} style={{ verticalAlign: "middle" }} />
    </a>
  );
}

export default function WorkEmailBadgeEmbed() {
  const [format, setFormat] = useState<"Markdown" | "HTML">("Markdown");
  const [copyStatus, setCopyStatus] = useState("");
  const snippet = format === "Markdown" ? markdown : html;

  async function copySnippet() {
    try {
      await navigator.clipboard.writeText(snippet);
      setCopyStatus("Copied.");
    } catch {
      setCopyStatus("Select the snippet to copy it.");
    }
  }

  return (
    <section aria-labelledby="work-email-badge">
      <h2 id="work-email-badge">Embed a work-email badge</h2>
      <p>Put this badge in a README or on your site. It opens the zkalumni prover, where visitors can start their own work-email verification.</p>
      <p><WorkEmailProofBadge /></p>
      <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
        <label htmlFor="work-email-badge-format">Embed format</label>
        <select
          id="work-email-badge-format"
          value={format}
          onChange={(event) => {
            setFormat(event.target.value === "HTML" ? "HTML" : "Markdown");
            setCopyStatus("");
          }}
          style={{ padding: 6, color: "#e6edf3", background: "#161b22", border: "1px solid #8b949e", borderRadius: 4 }}
        >
          <option>Markdown</option>
          <option>HTML</option>
        </select>
        <button type="button" className="btn2" onClick={copySnippet} style={{ borderRadius: 6 }}>
          Copy snippet
        </button>
        <span role="status">{copyStatus}</span>
      </div>
      <pre style={{ background: "#161b22", border: "1px solid #30363d", borderRadius: 12, padding: 20, overflowX: "auto", fontSize: 13 }}>
        <code>{snippet}</code>
      </pre>
      <p>The badge is a link to verification. It does not show someone’s verification status.</p>
    </section>
  );
}
