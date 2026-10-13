import { useEffect, useState } from "react";
import { checkBrowserCompatibility, checkExtension, MIN_EXTENSION_VERSION } from "../lib/tlsn";
import { usePluginExecution } from "../hooks/usePluginExec";
import { buildPlugin } from "../lib/plugin";
import { getTemplateByStem } from "../lib/templates";
import { fetchBadges, holderId, holderSecret } from "../lib/holder";
import { Link } from "react-router";
import { newProofId, provePerson, submitPersonProof, wakeEnclave } from "../lib/personProof";

type ProveButtonProps = {
  templateName: string;
  /** Extra session data for the verifier, e.g. an app link code. */
  sessionData?: Record<string, string>;
  /** Called once the proof verifies. Replaces the default badge-issued check. */
  onProved?: () => void;
  label?: string;
};

type ExtensionState =
  | "checking"
  | "wrong_browser"
  | "not_installed"
  | "outdated"
  | "ready"
  | "proving"
  | "done"
  | "error";

export default function ProveButton({ templateName, sessionData, onProved, label = "Prove" }: ProveButtonProps) {
  const [state, setState] = useState<ExtensionState>("checking");
  const [error, setError] = useState<string | null>(null);
  // After a proof verifies, the verifier issues the badge in the background.
  const [issued, setIssued] = useState<{ holder: string } | "pending" | "not_issued" | null>(null);
  // Unique-person templates: the on-device zero-knowledge step, then sending the sealed proof.
  const [personStep, setPersonStep] = useState<"waking" | "proving" | "submitting" | null>(null);
  const {
    execute: execCode,
    isExecuting,
    result,
  } = usePluginExecution();

  useEffect(() => {
    async function init() {
      if (!checkBrowserCompatibility()) {
        setState("wrong_browser");
        return;
      }
      const status = await checkExtension();
      setState(status === "ready" ? "ready" : status === "missing" ? "not_installed" : "outdated");
    }
    init();
  }, []);

  async function handleProve() {
    setError(null);
    try {
      const template = getTemplateByStem(templateName);
      if (!template) throw new Error(`No TLSNotary template for ${templateName}`);
      setIssued(null);
      const personCircuit = template.issue_when?.person_proof?.circuit;
      const proofId = personCircuit ? newProofId() : undefined;
      if (proofId) {
        // The enclave only runs while proofs are queued: start it first if needed.
        await wakeEnclave(proofId, () => setPersonStep("waking"));
        setPersonStep(null);
      }
      const proof = await execCode(buildPlugin(template), {
        ...sessionData,
        holder: holderSecret(),
        ...(proofId ? { proof: proofId } : {}),
      });
      if (!proof.success) return;
      if (proofId && personCircuit) {
        setPersonStep("proving");
        const zk = await provePerson(personCircuit, proof.output ?? "");
        setPersonStep("submitting");
        const res = await submitPersonProof(proofId, zk);
        if (!res.ok) throw new Error(`Not issued: ${res.reason ?? "unknown reason"}`);
      }
      if (onProved) return onProved();
      setIssued("pending");
      setIssued(await waitForBadge(template.name));
    } catch (e) {
      console.error("[ProveButton] tlsn error:", e);
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setPersonStep(null);
    }
  }

  if (state === "checking") {
    return (
      <button disabled style={btnStyle("#30363d", "#8b949e")}>
        Checking…
      </button>
    );
  }

  if (state === "wrong_browser") {
    return (
      <a
        href="https://www.google.com/chrome/"
        target="_blank"
        rel="noreferrer"
        style={linkStyle}
      >
        Requires Chrome / Edge
      </a>
    );
  }

  if (state === "outdated") {
    return (
      <a
        href="https://chromewebstore.google.com/detail/tlsnotary/gnoglgpcamodhflknhmafmjdahcejcgg"
        target="_blank"
        rel="noreferrer"
        style={linkStyle}
        title={`Needs TLSNotary extension ${MIN_EXTENSION_VERSION} or newer`}
      >
        Update extension
      </a>
    );
  }

  if (state === "not_installed") {
    return (
      <a
        href="https://chromewebstore.google.com/detail/tlsnotary/gnoglgpcamodhflknhmafmjdahcejcgg"
        target="_blank"
        rel="noreferrer"
        style={linkStyle}
      >
        Install extension
      </a>
    );
  }

  if (personStep) {
    return (
      <button
        disabled
        style={btnStyle("#1f3a2a", "#7ee787")}
        title={
          personStep === "waking"
            ? "It only runs while someone is proving"
            : personStep === "proving"
              ? "Your Singpass ID and mobile stay on this device"
              : "Only the proof is sent, encrypted to the attested enclave"
        }
      >
        {personStep === "waking"
          ? "Starting the secure enclave (about a minute)…"
          : personStep === "proving"
            ? "Proving on this device…"
            : "Sending the proof…"}
      </button>
    );
  }

  if (error && !isExecuting) {
    return (
      <div>
        <button onClick={handleProve} style={btnStyle("#3a1f1f", "#f87171")}>
          Retry
        </button>
        <p style={{ color: "#f87171", fontSize: 12, marginTop: 6, lineHeight: 1.4 }}>{error}</p>
      </div>
    );
  }

  if (isExecuting) {
    return (
      <button disabled style={btnStyle("#1f3a2a", "#7ee787")}>
        Proving…
      </button>
    );
  }

  if (result?.success && issued === "pending") {
    return (
      <button disabled style={btnStyle("#1f3a2a", "#7ee787")}>
        Issuing badge…
      </button>
    );
  }

  if (result?.success && issued && typeof issued === "object") {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {/* /me, not /cases/<holder>: the holder id stays out of shareable URLs. */}
        <Link to="/me" style={{ ...linkStyle, color: "#7ee787", borderColor: "#7ee78744" }}>
          ✓ Badge issued · view
        </Link>
        {getTemplateByStem(templateName)?.issue_when?.person_proof && (
          <Link to="/example-app" style={{ ...linkStyle, color: "#d29922", borderColor: "#d2992244" }}>
            Link to Example App →
          </Link>
        )}
      </div>
    );
  }

  if (result?.success && issued === "not_issued") {
    return (
      <button
        onClick={handleProve}
        title="The proof verified, but it didn't meet this badge's requirements (or the badge has none yet)."
        style={btnStyle("#3a2f1f", "#d29922")}
      >
        Proved, not issued · retry
      </button>
    );
  }

  if (result?.success) {
    return (
      <button disabled style={btnStyle("#1a2f1a", "#7ee787")}>
        ✓ Proved {result?.output}
      </button>
    );
  }

  if (state === "error" || result?.error) {
    return (
      <button
        onClick={handleProve}
        title={error ?? undefined}
        style={btnStyle("#3a1f1f", "#f87171")}
      >
        Retry
      </button>
    );
  }

  return (
    <button onClick={handleProve} style={btnStyle("#1f3a2a", "#7ee787")}>
      {label}
    </button>
  );
}

function btnStyle(bg: string, color: string): React.CSSProperties {
  return {
    background: bg,
    color,
    border: `1px solid ${color}44`,
    borderRadius: 6,
    padding: "6px 14px",
    fontSize: 12,
    fontWeight: 600,
    cursor: "pointer",
    width: "100%",
  };
}

const linkStyle: React.CSSProperties = {
  display: "block",
  textAlign: "center",
  background: "#161b22",
  color: "#8b949e",
  border: "1px solid #30363d",
  borderRadius: 6,
  padding: "6px 14px",
  fontSize: 12,
  fontWeight: 600,
  textDecoration: "none",
};

/** Polls for the badge the verifier's webhook should have just issued. */
async function waitForBadge(template: string): Promise<{ holder: string } | "not_issued"> {
  const holder = await holderId();
  for (let attempt = 0; attempt < 8; attempt++) {
    await new Promise((resolve) => setTimeout(resolve, 750));
    try {
      const badges = await fetchBadges();
      if (badges.some((b) => b.template === template && Date.now() - b.issued_at < 60_000)) {
        return { holder };
      }
    } catch {
      // Keep polling; the issuer may be briefly unreachable.
    }
  }
  return "not_issued";
}
