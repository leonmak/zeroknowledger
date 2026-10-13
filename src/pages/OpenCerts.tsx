import { useState } from "react";
import { Link, useParams } from "react-router";
import Nav from "../components/Nav";
import { CertificateError, disclose, readCertificate, requestBadge, type Certificate, type IssueResult } from "../lib/opencerts";
import nusGraduate from "../../registry/methods/education/nus-graduate/0.1.0.json";

// Earn an OpenCerts badge (registry proof type "opencerts"): the certificate is
// read and hashed in this browser, and only the method's fields are sent.

type Method = typeof nusGraduate;
const METHODS: Record<string, Method> = { [nusGraduate.id]: nusGraduate };

const LABELS: Record<string, string> = {
  "issuers.0.certificateStore": "Issuer's certificate store",
  "issuers.0.name": "Issuer",
  "additionalData.degreeScroll.0.degreeTitle": "Degree",
  "additionalData.degreeScroll.0.dateConferred": "Date conferred",
};
const label = (path: string) => LABELS[path] ?? path.split(".").pop()!.replace(/([A-Z])/g, " $1").toLowerCase();

type Loaded = { name: string; cert: Certificate };

export default function OpenCertsPage() {
  const { namespace, name } = useParams();
  const method = METHODS[`${namespace}/${name}`];
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [optional, setOptional] = useState<Set<string>>(new Set());
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<IssueResult | null>(null);

  if (!method) {
    return (
      <Shell>
        <Card>
          <h1 style={h1}>Unknown method</h1>
          <p style={muted}>
            <Link to="/methods" style={{ color: "#7ee787" }}>
              Browse methods →
            </Link>
          </p>
        </Card>
      </Shell>
    );
  }
  const { config } = method;
  const required = config.reveal.required;
  const optionalPaths = config.reveal.optional ?? [];

  async function load(file: File) {
    setError(null);
    setResult(null);
    setLoaded(null);
    try {
      const cert = readCertificate(await file.text());
      const store = cert.fields.find((f) => f.path === "issuers.0.certificateStore")?.value;
      if (store?.toLowerCase() !== config.issuer.certificate_store.toLowerCase())
        throw new CertificateError(`This certificate wasn't issued by ${config.issuer.name}.`);
      const missing = required.filter((p) => !cert.fields.some((f) => f.path === p));
      if (missing.length) throw new CertificateError(`This certificate has no ${missing.map(label).join(" or ")}.`);
      setLoaded({ name: file.name, cert });
    } catch (e) {
      setError(e instanceof CertificateError ? e.message : "Couldn't read that file.");
    }
  }

  async function submit() {
    if (!loaded) return;
    setSending(true);
    try {
      setResult(await requestBadge(method.id, disclose(loaded.cert, new Set([...required, ...optional]))));
    } catch {
      setResult({ ok: false, reason: "Couldn't reach the verifier. Try again shortly.", retry: true });
    }
    setSending(false);
  }

  const sent = loaded?.cert.fields.filter((f) => required.includes(f.path) || optional.has(f.path)) ?? [];
  const hidden = loaded ? loaded.cert.fields.length - sent.length : 0;
  const count = (prefix: string) => loaded?.cert.fields.filter((f) => f.path.startsWith(prefix)).length ?? 0;

  return (
    <Shell>
      <title>{`${method.badge.label} · zeroknowledger`}</title>
      <Card>
        <p style={eyebrow}>OpenCerts · {method.id}</p>
        <h1 style={h1}>Get the {method.badge.label} badge</h1>
        <p style={muted}>{method.privacy.summary}</p>

        <label style={drop}>
          <input
            type="file"
            accept=".opencert,application/json"
            style={{ display: "none" }}
            onChange={(e) => e.target.files?.[0] && load(e.target.files[0])}
          />
          <strong>{loaded ? loaded.name : "Choose your .opencert file"}</strong>
          <span style={{ ...muted, fontSize: 13 }}>
            {loaded ? "Read in this browser. Choose another to replace it." : "It's read in this browser; nothing is uploaded yet."}
          </span>
        </label>
        {error && <div style={notice("#f85149")}>{error}</div>}

        {loaded && !result?.ok && (
          <>
            <h2 style={h2}>Sent to the verifier</h2>
            <dl style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "8px 16px", fontSize: 14, marginBottom: 14 }}>
              {loaded.cert.fields
                .filter((f) => required.includes(f.path) || optionalPaths.includes(f.path))
                .map((f) => (
                  <div key={f.path} style={{ display: "contents" }}>
                    <dt style={{ color: "#8b949e" }}>
                      {optionalPaths.includes(f.path) ? (
                        <label style={{ display: "inline-flex", gap: 6, alignItems: "center", cursor: "pointer" }}>
                          <input
                            type="checkbox"
                            checked={optional.has(f.path)}
                            onChange={(e) => {
                              const next = new Set(optional);
                              if (e.target.checked) next.add(f.path);
                              else next.delete(f.path);
                              setOptional(next);
                            }}
                          />
                          {label(f.path)}
                        </label>
                      ) : (
                        label(f.path)
                      )}
                    </dt>
                    <dd style={{ ...mono, color: required.includes(f.path) || optional.has(f.path) ? "#e6edf3" : "#556070" }}>
                      {required.includes(f.path) || optional.has(f.path) ? f.value : "not sent"}
                    </dd>
                  </div>
                ))}
            </dl>
            <h2 style={h2}>Stays in this browser</h2>
            <p style={{ ...muted, marginBottom: 18 }}>
              {hidden} fields, including your name, student ID and date of birth ({count("recipient.")} fields) and{" "}
              {count("transcript.")} course result fields. The verifier gets only their salted hashes, which can&apos;t be
              reversed or guessed.
            </p>
            <button onClick={submit} disabled={sending} style={button("#7ee787")}>
              {sending ? "Checking with NUS's certificate store…" : `Get the ${method.badge.label} badge`}
            </button>
          </>
        )}

        {result?.ok && (
          <div style={notice("#7ee787")}>
            ✓ {result.badge.label} badge added to this browser&apos;s badges. The verifier kept only the badge and a keyed
            hash of the certificate, not the degree title.
          </div>
        )}
        {result && !result.ok && <div style={notice(result.retry ? "#d29922" : "#f85149")}>Not issued: {result.reason}</div>}

        <details style={{ marginTop: 22 }}>
          <summary style={{ ...muted, cursor: "pointer" }}>What this does and doesn&apos;t hide</summary>
          <ul style={{ ...muted, paddingLeft: 20, marginTop: 10 }}>
            {[...method.privacy.guarantees, ...method.privacy.limits].map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
          <p style={{ ...muted, marginTop: 10 }}>
            <Link to={`/methods/${method.id}`} style={{ color: "#7ee787" }}>
              Method details, versions and status →
            </Link>
          </p>
        </details>
      </Card>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main style={{ minHeight: "100vh", background: "#0d1117", color: "#e6edf3", fontFamily: "Inter, sans-serif" }}>
      <Nav />
      <section style={{ maxWidth: 620, margin: "0 auto", padding: "56px 24px 80px" }}>{children}</section>
    </main>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return <div style={{ border: "1px solid #1f2937", borderRadius: 12, background: "#161b22", padding: 24 }}>{children}</div>;
}

const eyebrow = {
  fontSize: 13,
  fontWeight: 700,
  color: "#7ee787",
  letterSpacing: 1.4,
  textTransform: "uppercase",
  marginBottom: 10,
  overflowWrap: "anywhere",
} as const;
const h1 = { fontSize: "clamp(22px, 4vw, 30px)", letterSpacing: "-0.6px", lineHeight: 1.2, marginBottom: 12 } as const;
const h2 = { fontSize: 13, fontWeight: 700, color: "#8b949e", textTransform: "uppercase", letterSpacing: 1.2, margin: "22px 0 10px" } as const;
const muted = { color: "#8b949e", fontSize: 14, lineHeight: 1.65 } as const;
const mono = { fontFamily: "'JetBrains Mono', monospace", overflowWrap: "anywhere", margin: 0 } as const;
const drop = {
  display: "flex",
  flexDirection: "column",
  gap: 4,
  alignItems: "center",
  textAlign: "center",
  border: "1.5px dashed #30363d",
  borderRadius: 10,
  padding: "24px 16px",
  margin: "20px 0 12px",
  cursor: "pointer",
} as const;
const notice = (color: string) =>
  ({ border: `1px solid ${color}55`, background: `${color}12`, color: "#e6edf3", borderRadius: 10, padding: 16, fontSize: 14, lineHeight: 1.6, marginTop: 12 }) as const;
const button = (color: string) =>
  ({ background: color, color: "#0d1117", border: "none", borderRadius: 8, padding: "10px 16px", fontWeight: 700, cursor: "pointer" }) as const;
