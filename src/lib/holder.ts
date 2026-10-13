// Badges are issued to a holder: a random secret kept in this browser, sent
// with each proof. The registry keys badges by a hash of it (holderId) and only
// lists them for someone presenting the secret, so the id never needs to be
// shown or shared. Clearing site data loses the secret, and with it access to
// those badges.
import { REGISTRY_URL } from "./config";
import { forgetDemoSubject } from "./demo";

const KEY = "zk.holderSecret";
let memorySecret: string | null = null;

export function holderSecret(): string {
  try {
    const stored = localStorage.getItem(KEY);
    if (stored) return stored;
  } catch {
    // Storage blocked: fall back to a per-tab secret.
  }
  const secret =
    memorySecret ??
    [...crypto.getRandomValues(new Uint8Array(32))].map((b) => b.toString(16).padStart(2, "0")).join("");
  memorySecret = secret;
  try {
    localStorage.setItem(KEY, secret);
  } catch {
    // Not persisted; badges still issue for this tab.
  }
  return secret;
}

/** Must match holderId() in verifier/src/issuer.ts. */
export async function holderId(secret = holderSecret()): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(secret));
  return [...new Uint8Array(digest).slice(0, 16)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export type IssuedBadge = {
  template: string;
  issued_at: number;
  proved_at: number;
  badge: { label: string; icon: string; color: string } | null;
};

/** This browser's badges. Sends the secret, so only its holder can list them. */
export async function fetchBadges(): Promise<IssuedBadge[]> {
  const res = await fetch(`${REGISTRY_URL}/holders/me/badges`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ secret: holderSecret() }),
  });
  if (!res.ok) throw new Error(`badges request failed: ${res.status}`);
  return ((await res.json()) as { badges: IssuedBadge[] }).badges;
}

/**
 * Forget this device: drops the holder secret (and the Example App's demo
 * account) from this browser, optionally deleting this holder's badges from the
 * registry first. App links aren't affected: they're kept per app, not by holder.
 * The next proof starts a new holder.
 */
export async function forgetDevice({ deleteBadges }: { deleteBadges: boolean }): Promise<void> {
  if (deleteBadges) {
    const res = await fetch(`${REGISTRY_URL}/holders/me/delete`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ secret: holderSecret() }),
    });
    if (!res.ok) throw new Error(`couldn't delete badges (${res.status})`);
  }
  memorySecret = null;
  try {
    localStorage.removeItem(KEY);
  } catch {
    // Nothing stored.
  }
  forgetDemoSubject();
}
