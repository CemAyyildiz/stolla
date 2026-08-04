#!/usr/bin/env node

/**
 * Development-server startup smoke test.
 *
 * Starts the Next.js dev server on a test port, waits for it to become
 * ready (bounded timeout), issues HTTP requests against known routes,
 * and exits with a non-zero code if anything fails. The child server
 * is always terminated before the process exits.
 *
 * Usage (from repository root):
 *   node scripts/smoke-dev-server.mjs
 *
 * Environment variables:
 *   SMOKE_PORT        – port to run the server on          (default: 3456)
 *   SMOKE_TIMEOUT_MS  – max milliseconds to wait for ready (default: 120_000)
 */

import { spawn } from "node:child_process";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const PORT = parseInt(process.env.SMOKE_PORT ?? "3456", 10);
const TIMEOUT = parseInt(process.env.SMOKE_TIMEOUT_MS ?? "120000", 10);
const BASE_URL = `http://localhost:${PORT}`;

const ROUTES = [
  { path: "/", label: "landing page" },
  { path: "/community", label: "community page" },
];

// ── Helpers ────────────────────────────────────────────────────────

function httpGet(url) {
  return new Promise((resolve, reject) => {
    const req = http.get(url, (res) => {
      let body = "";
      res.on("data", (chunk) => {
        body += chunk;
      });
      res.on("end", () => resolve({ status: res.statusCode, body }));
    });
    req.on("error", reject);
    req.setTimeout(10_000, () => {
      req.destroy();
      reject(new Error(`Request to ${url} timed out after 10 s`));
    });
  });
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// ── Main ───────────────────────────────────────────────────────────

async function main() {
  console.log(`[smoke] Starting dev server on port ${PORT} …`);

  const webDir = path.resolve(__dirname, "..", "apps", "web");

  const child = spawn(
    path.resolve(__dirname, "..", "node_modules", ".bin", "next"),
    ["dev", "--port", String(PORT)],
    {
      cwd: webDir,
      stdio: ["ignore", "pipe", "pipe"],
      env: {
        ...process.env,
        NEXT_PUBLIC_STELLAR_NETWORK: "testnet",
        NEXT_PUBLIC_STELLAR_RPC_URL: "https://soroban-testnet.stellar.org",
        // Avoid interactive prompts in CI-like environments
        NEXT_TELEMETRY_DISABLED: "1",
      },
    },
  );

  let killed = false;
  let forceKillTimer;

  function killServer() {
    if (killed) return;
    killed = true;

    if (child.exitCode !== null || child.signalCode !== null) return;

    child.kill("SIGTERM");
    // Force kill after a grace period if it hasn't stopped
    forceKillTimer = setTimeout(() => {
      try {
        child.kill("SIGKILL");
      } catch {
        // process already dead
      }
    }, 3000);
  }

  // Ensure the server is always cleaned up — on normal exit, signals, or
  // when the process is told to stop.
  process.on("exit", killServer);
  process.once("SIGINT", () => {
    process.exitCode = 1;
    killServer();
  });
  process.once("SIGTERM", () => {
    process.exitCode = 1;
    killServer();
  });

  // Collect server output for diagnostic messages
  let serverOutput = "";
  child.stdout.on("data", (d) => {
    serverOutput += d.toString();
  });
  child.stderr.on("data", (d) => {
    serverOutput += d.toString();
  });

  // Track unexpected server exit during startup
  let serverExited = false;
  child.on("exit", (code, signal) => {
    if (forceKillTimer) clearTimeout(forceKillTimer);
    serverExited = true;
    if (!killed) {
      serverOutput += `\n[smoke] Server exited unexpectedly (code=${code}, signal=${signal})`;
    }
  });

  // ── Wait for the dev server to become ready ─────────────────────
  const deadline = Date.now() + TIMEOUT;
  let ready = false;

  while (Date.now() < deadline) {
    if (serverExited) {
      console.error("[smoke] Dev server exited before becoming ready.");
      console.error(`[smoke] Last server output:\n${serverOutput.slice(-3000)}`);
      process.exit(1);
    }

    try {
      const res = await httpGet(`${BASE_URL}/`);
      // Accept any non-server-error status as "running"
      if (res.status !== undefined && res.status < 500) {
        ready = true;
        break;
      }
    } catch {
      // Server not ready yet — keep polling
    }

    await sleep(1000);
  }

  if (!ready) {
    console.error(`[smoke] Timed out after ${TIMEOUT / 1000} s waiting for dev server.`);
    console.error(`[smoke] Last server output:\n${serverOutput.slice(-3000)}`);
    killServer();
    process.exit(1);
  }

  console.log("[smoke] Dev server is ready.");

  // ── Verify each route ────────────────────────────────────────────
  let allPassed = true;

  for (const { path: routePath, label } of ROUTES) {
    try {
      const res = await httpGet(`${BASE_URL}${routePath}`);
      const ok = res.status === 200;
      console.log(`[smoke]   ${ok ? "PASS" : "FAIL"} ${label} (${routePath}) → ${res.status}`);
      if (!ok) allPassed = false;
    } catch (err) {
      console.error(`[smoke]   FAIL ${label} (${routePath}) → ${err.message}`);
      allPassed = false;
    }
  }

  // ── Clean up ────────────────────────────────────────────────────
  killServer();

  if (!allPassed) {
    console.error("[smoke] One or more routes returned a non-200 status.");
    process.exit(1);
  }

  console.log("[smoke] All routes passed.");
}

main().catch((err) => {
  console.error("[smoke] Unhandled error:", err);
  process.exit(1);
});
