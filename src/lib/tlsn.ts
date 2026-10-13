import { VERIFIER_URL } from "./config";

export function checkBrowserCompatibility(): boolean {
  const isChrome =
    /Chrome/.test(navigator.userAgent) && /Google Inc/.test(navigator.vendor);
  const isEdge = /Edg/.test(navigator.userAgent);
  const isBrave =
    (navigator as Navigator & { brave?: { isBrave: () => boolean } }).brave
      ?.isBrave instanceof Function;
  const isChromium = /Chromium/.test(navigator.userAgent);
  return isChrome || isEdge || isBrave || isChromium;
}

// First extension release with proxy mode on tlsn v0.1.0-alpha.15, the version
// our verifier runs. Older provers can't talk to it.
export const MIN_EXTENSION_VERSION = "0.1.0.1500";

export type ExtensionStatus = "missing" | "outdated" | "ready";

export async function checkExtension(): Promise<ExtensionStatus> {
  // Content scripts inject window.tlsn asynchronously after page load
  await new Promise((resolve) => setTimeout(resolve, 1000));
  if (typeof window.tlsn === "undefined") return "missing";
  const version = window.tlsn.version;
  return version && compareVersions(version, MIN_EXTENSION_VERSION) >= 0 ? "ready" : "outdated";
}

function compareVersions(a: string, b: string): number {
  const pa = a.split(".").map(Number);
  const pb = b.split(".").map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d !== 0) return d;
  }
  return 0;
}

export async function checkVerifier(): Promise<boolean> {
  const base = VERIFIER_URL.replace(/^ws/, "http");
  try {
    const res = await fetch(`${base}/health`);
    return res.ok && (await res.text()) === "ok";
  } catch {
    return false;
  }
}
