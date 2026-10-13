// The built-in Example App (verifier/src/demo.ts): a stand-in third-party app
// whose account for this browser is a random demo-* id, kept in localStorage.
import { REGISTRY_URL } from "./config";

const KEY = "zk.demoSubject";
let memorySubject: string | null = null;

export const DEMO_APP = "demo:example";

/** Drops the Example App account id from this browser (Forget this device). */
export function forgetDemoSubject() {
  memorySubject = null;
  try {
    localStorage.removeItem(KEY);
  } catch {
    // Nothing stored.
  }
}

/** This browser's account id in the Example App. */
export function demoSubject(): string {
  try {
    const stored = localStorage.getItem(KEY);
    if (stored) return stored;
  } catch {
    // Storage blocked: one per tab.
  }
  const subject =
    memorySubject ?? "demo-" + [...crypto.getRandomValues(new Uint8Array(6))].map((b) => b.toString(16).padStart(2, "0")).join("");
  memorySubject = subject;
  try {
    localStorage.setItem(KEY, subject);
  } catch {
    // Not persisted.
  }
  return subject;
}

export type DemoBinding = { bound: false } | { bound: true; pairwise_id: string; bound_at: number };

/** What the Example App knows about its account: linked or not, and its app-specific id. */
export async function fetchDemoBinding(subject = demoSubject()): Promise<DemoBinding> {
  const res = await fetch(`${REGISTRY_URL}/demo/subjects/${encodeURIComponent(subject)}`);
  return (await res.json()) as DemoBinding;
}

/** Has the Example App create a link for its account, as a real app would with its API key. Returns the bind code. */
export async function startDemoLink(subject = demoSubject()): Promise<string> {
  const res = await fetch(`${REGISTRY_URL}/demo/challenges`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ subject }),
  });
  if (!res.ok) throw new Error(`couldn't start the link (${res.status})`);
  return ((await res.json()) as { code: string }).code;
}
