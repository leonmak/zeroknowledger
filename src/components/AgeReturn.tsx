import { useEffect, useState } from "react";
import ProveButton from "./ProveButton";
import { REGISTRY_URL } from "../lib/config";

/** The request id is a one-time link; the exchange verifier stays on Retrochat's backend. */
export default function AgeReturn({ id }: { id: string }) {
  const [result, setResult] = useState<{ ready: boolean; returnUrl: string } | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    const abort = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      try {
        const res = await fetch(`${REGISTRY_URL}/age/requests/${encodeURIComponent(id)}`, { signal: abort.signal });
        const body = await res.json();
        if (!res.ok) { setError(body.error ?? "Unable to check verification"); return; }
        setError("");
        setResult(body);
        if (!body.ready) timer = setTimeout(poll, 3000);
      } catch {
        if (!abort.signal.aborted) { setError("Connection interrupted. Retrying…"); timer = setTimeout(poll, 3000); }
      }
    };
    void poll();
    return () => { abort.abort(); clearTimeout(timer); };
  }, [id]);
  return <div>
    <p>Verify you’re 15 or older for Retrochat. Your date of birth and identity details are not shared with Retrochat.</p>
    {error && <p role="alert">{error}</p>}
    {result && !result.ready && <ProveButton templateName="identity/singpass-age-15-plus" sessionData={{ age_request: id }} label="Verify age for Retrochat" />}
    {result?.ready && <p role="status">✓ Age verified. Return to Retrochat to finish linking this result to your account.</p>}
    {result && <a href={result.returnUrl} rel="noreferrer">{result.ready ? "Return to Retrochat →" : "Cancel and return to Retrochat"}</a>}
  </div>;
}
