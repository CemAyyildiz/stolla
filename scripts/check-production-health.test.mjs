import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import http from "node:http";
import { after, before, test } from "node:test";
import { fileURLToPath } from "node:url";

const scriptPath = fileURLToPath(
  new URL("./check-production-health.mjs", import.meta.url),
);

let server;
let baseUrl;

before(async () => {
  server = http.createServer((request, response) => {
    if (request.url.startsWith("/ok")) {
      response.writeHead(200, { "content-type": "application/json" });
      response.end(JSON.stringify({ status: "ok" }));
      return;
    }

    if (request.url === "/http-error") {
      response.writeHead(503, { "content-type": "application/json" });
      response.end(JSON.stringify({ status: "degraded" }));
      return;
    }

    if (request.url === "/degraded") {
      response.writeHead(200, { "content-type": "application/json" });
      response.end(JSON.stringify({ status: "degraded" }));
      return;
    }

    if (request.url === "/slow") {
      setTimeout(() => {
        response.writeHead(200, { "content-type": "application/json" });
        response.end(JSON.stringify({ status: "ok" }));
      }, 200);
      return;
    }

    response.writeHead(404);
    response.end();
  });

  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  baseUrl = `http://127.0.0.1:${address.port}`;
});

after(async () => {
  await new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
});

function runHealthCheck(environment = {}) {
  const childEnvironment = { ...process.env };
  delete childEnvironment.HEALTH_URL;
  delete childEnvironment.HEALTH_TIMEOUT_MS;
  Object.assign(childEnvironment, environment);

  return new Promise((resolve) => {
    const child = spawn(process.execPath, [scriptPath], {
      env: childEnvironment,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("close", (code) => resolve({ code, stdout, stderr }));
  });
}

test("accepts a healthy payload and redacts URL details", async () => {
  const result = await runHealthCheck({
    HEALTH_URL: `${baseUrl}/ok?token=do-not-log#private`,
  });

  assert.equal(result.code, 0);
  assert.match(result.stdout, /\[health-check\] OK:/);
  assert.doesNotMatch(result.stdout, /do-not-log|private/);
});

test("classifies an unhealthy HTTP status", async () => {
  const result = await runHealthCheck({
    HEALTH_URL: `${baseUrl}/http-error`,
  });

  assert.equal(result.code, 1);
  assert.match(result.stderr, /\[health-check\] HTTP:.*HTTP 503/);
});

test("does not expose URL credentials in network failures", async () => {
  const result = await runHealthCheck({
    HEALTH_URL: `http://username:password@127.0.0.1:${server.address().port}/ok?token=secret`,
  });

  assert.equal(result.code, 1);
  assert.match(result.stderr, /\[health-check\] NETWORK:/);
  assert.doesNotMatch(result.stderr, /username|password|token|secret/);
});

test("classifies an unhealthy response payload", async () => {
  const result = await runHealthCheck({
    HEALTH_URL: `${baseUrl}/degraded`,
  });

  assert.equal(result.code, 1);
  assert.match(result.stderr, /\[health-check\] PAYLOAD:.*degraded/);
});

test("classifies a bounded request timeout", async () => {
  const result = await runHealthCheck({
    HEALTH_URL: `${baseUrl}/slow`,
    HEALTH_TIMEOUT_MS: "25",
  });

  assert.equal(result.code, 1);
  assert.match(result.stderr, /\[health-check\] TIMEOUT:.*25ms/);
});

test("fails clearly when the target URL is not configured", async () => {
  const result = await runHealthCheck();

  assert.equal(result.code, 1);
  assert.match(result.stderr, /\[health-check\] CONFIGURATION:/);
});
