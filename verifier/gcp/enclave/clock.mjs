// Confidential Space VMs don't sync their clock, and ours boots ~5 s slow.
// MPC-TLS rejects a handshake whose time differs from the verifier's by more
// than 5 s, so the verifier runs under libfaketime shifted by the offset this
// script measures and writes to FAKETIME_TIMESTAMP_FILE (re-run periodically
// by start.sh to follow drift).
//
// Source: the Date header of an HTTPS response from Google, so the host can't
// forge it, only delay it (by at most the request timeout). The header has
// 1 s resolution, so we poll until it ticks over and take that moment.
import { writeFileSync } from "node:fs";

const URL_ = process.env.CLOCK_URL ?? "https://www.google.com/generate_204";
const out = process.env.FAKETIME_TIMESTAMP_FILE ?? "/tmp/faketime";

async function sample() {
  const sent = Date.now();
  const res = await fetch(URL_, { method: "HEAD", signal: AbortSignal.timeout(3000) });
  const got = Date.now();
  const date = Date.parse(res.headers.get("date") ?? "");
  if (Number.isNaN(date)) throw new Error("no Date header");
  return { date, local: (sent + got) / 2, rtt: got - sent };
}

async function measure() {
  let prev = await sample();
  for (let i = 0; i < 40; i++) {
    await new Promise((r) => setTimeout(r, 50));
    const s = await sample();
    // The remote second just ticked: real time is ~s.date at s.local.
    if (s.date > prev.date && s.rtt < 1000) return { offset: (s.date - s.local) / 1000, rtt: s.rtt };
    prev = s;
  }
  throw new Error("Date header never ticked");
}

try {
  const { offset, rtt } = await measure();
  writeFileSync(out, `${offset >= 0 ? "+" : ""}${offset.toFixed(2)}\n`);
  console.log(`clock offset ${offset.toFixed(2)} s (rtt ${rtt} ms) -> ${out}`);
} catch (e) {
  // Keep the last good offset, if any.
  console.error(`clock: ${e.message}`);
  process.exitCode = 1;
}
