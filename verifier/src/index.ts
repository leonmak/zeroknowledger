// Front door for the TLSNotary verifier container, plus the badge issuer.
//
// The TLSNotary extension talks to the verifier with two WebSockets: /session
// (registration, reveal config, result) and /verifier?sessionId=… (the proof
// protocol itself). The server keeps sessions in memory, so both must reach
// the same process: every request goes to the one container named "main".
import { Container, ContainerProxy, getContainer } from "@cloudflare/containers";
import { deleteHolder, finishPersonProof, handleWebhook, holderId, listBadges, type SealedPersonProof } from "./issuer.ts";
import { handleAppsRequest, type AppsEnv } from "./apps.ts";
import { enclavePerson, signedByEnclave, type EnclaveEnv } from "./enclave.ts";
import { handleOpenCerts } from "./opencerts.ts";
import { dequeue, handleWake, sweep } from "./enclaveControl.ts";
import { handleDemo } from "./demo.ts";
import { gceCompute, type GcpEnv } from "./gcp.ts";
import { handleAge, type AgeEnv } from "./age.ts";
import templates from "./templates.json" with { type: "json" };

export { ContainerProxy };

interface Env extends AppsEnv, EnclaveEnv, GcpEnv, AgeEnv {
  VERIFIER: DurableObjectNamespace<VerifierContainer>;
}

export class VerifierContainer extends Container<Env> {
  defaultPort = 7047;
  sleepAfter = "10m";
  envVars = {
    // Reject MPC-TLS: this deployment only runs TLSNotary proxy mode.
    PROXY_ONLY: "1",
    // Only open TLS connections to hosts our badge templates prove against.
    ALLOWED_HOSTS: [...new Set(templates.map((t) => t.host))].join(","),
  };
}

// Person ids only come from the attested enclave (gcp/), when ENCLAVE_URL is
// set; without it, unique-person badges can't be issued.
const withProofVerifier = (env: Env) => ({
  ...env,
  derivePerson: env.ENCLAVE_URL ? (req: Parameters<typeof enclavePerson>[1]) => enclavePerson(env, req) : undefined,
});

// The server's webhook (config.yaml) posts every verified proof here. The
// hostname only resolves from inside this container. This must be an
// assignment, not a `static` class field: the library registers handlers in
// its `outboundByHost` setter, and a class field defines its own property
// without calling it.
VerifierContainer.outboundByHost = {
  "issuer.internal": (request: Request, env: Env) => handleWebhook(request, withProofVerifier(env)),
};

const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "POST", "Access-Control-Allow-Headers": "Content-Type" };
const VERIFIER_ROUTES = new Set(["/health", "/info", "/session", "/verifier"]);

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const { pathname } = new URL(request.url);

    const ageResponse = await handleAge(request, env);
    if (ageResponse) return ageResponse;

    // Your own badges: only with your holder secret. There's deliberately no
    // public lookup by holder id, which would let anyone who saw the id list them.
    if (pathname === "/holders/me/badges") {
      if (request.method === "OPTIONS") return new Response(null, { headers: CORS });
      if (request.method !== "POST") return new Response("Method not allowed", { status: 405, headers: CORS });
      const { secret } = ((await request.json().catch(() => null)) ?? {}) as { secret?: unknown };
      if (typeof secret !== "string" || secret.length < 32 || secret.length > 256) {
        return Response.json({ error: "holder secret required" }, { status: 400, headers: CORS });
      }
      return listBadges(await holderId(secret), env);
    }
    // "Forget this device" with "also delete": removes this holder's badges.
    // App links aren't touched: they're keyed per app, not by holder.
    if (pathname === "/holders/me/delete") {
      if (request.method === "OPTIONS") return new Response(null, { headers: CORS });
      if (request.method !== "POST") return new Response("Method not allowed", { status: 405, headers: CORS });
      const { secret } = ((await request.json().catch(() => null)) ?? {}) as { secret?: unknown };
      if (typeof secret !== "string" || secret.length < 32 || secret.length > 256) {
        return Response.json({ error: "holder secret required" }, { status: 400, headers: CORS });
      }
      return Response.json({ deleted: await deleteHolder(env.DB, await holderId(secret)) }, { headers: CORS });
    }

    // The browser's zero-knowledge person proof, after its TLS proof verified.
    const proofId = /^\/proofs\/([A-Za-z0-9_-]{16,64})$/.exec(pathname)?.[1];
    if (proofId && request.method === "OPTIONS") return new Response(null, { headers: CORS });
    if (proofId && request.method === "POST") {
      const body = (await request.json().catch(() => null)) as Partial<SealedPersonProof> | null;
      const { status, ...outcome } = await finishPersonProof(proofId, body, withProofVerifier(env));
      // Handled (not "retry later"): this proof no longer keeps the enclave up.
      if (status !== 404 && status !== 503) await dequeue(env.DB, proofId);
      return Response.json(outcome, { status, headers: CORS });
    }

    // Before a unique-person proof: queue it and start the enclave if stopped (enclaveControl.ts).
    if (pathname === "/enclave/wake" && env.ENCLAVE_URL) return handleWake(request, env, gceCompute(env));

    // The enclave's TLSNotary verifier reports verified sessions here, signed.
    if (pathname === "/enclave/webhook" && request.method === "POST" && env.ENCLAVE_URL) {
      const body = await request.text();
      if (!(await signedByEnclave(env, body, request.headers.get("X-Enclave-Signature")))) {
        return new Response("bad signature", { status: 401 });
      }
      return handleWebhook(new Request(request.url, { method: "POST", body }), withProofVerifier(env));
    }

    // OpenCerts selective disclosure (opencerts.ts): no container involved.
    if (pathname.startsWith("/opencerts/")) return handleOpenCerts(request, env);

    // The built-in Example App (demo.ts).
    const demoResponse = await handleDemo(request, env);
    if (demoResponse) return demoResponse;

    // App registration, challenges, bindings (apps.ts).
    const appsResponse = await handleAppsRequest(request, env);
    if (appsResponse) return appsResponse;

    // Anything else, including /proxy (the server's MPC-mode WebSocket-to-TCP
    // relay, which would be an open relay), stays unreachable.
    if (!VERIFIER_ROUTES.has(pathname)) {
      return new Response("Not found", { status: 404 });
    }
    return getContainer(env.VERIFIER, "main").fetch(request);
  },

  // Every minute (wrangler.jsonc triggers): stop the enclave once nothing is queued.
  async scheduled(_controller: ScheduledController, env: Env): Promise<void> {
    const result = await sweep(env, gceCompute(env));
    if (result === "stopped") console.log("enclave idle: stopped");
  },
} satisfies ExportedHandler<Env>;
