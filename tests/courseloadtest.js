import autocannon from "autocannon";
import http from "http";
import { config } from "dotenv";
config();

// ─── CONFIG ────────────────────────────────────────────────────────────────
const BASE_URL = "http://localhost:5000/api/v1/courses";
const LOGIN_URL = "http://localhost:5000/api/auth/login";
const COURSE_ID = "690f6f35857961b447bb772a";
const CONTENT_ID = "69bfdbee7a8f25e8905a48fc";

// Add these to your .env  →  TEST_EMAIL / TEST_PASSWORD
const EMAIL = process.env.TEST_EMAIL || "babajaihoji2@gmail.com";
const PASSWORD = process.env.TEST_PASSWORD || "Aman700@";

// ─── AUTO LOGIN — fetches a fresh token every run ──────────────────────────
function login() {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ email: EMAIL, password: PASSWORD });
    const url = new URL(LOGIN_URL);

    const options = {
      hostname: url.hostname,
      port: url.port || 80,
      path: url.pathname,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(body),
      },
    };

    const req = http.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try {
          const json = JSON.parse(data);
          if (!json.accessToken) {
            return reject(new Error(`Login failed: ${data}`));
          }
          resolve(json.accessToken);
        } catch (e) {
          reject(new Error(`Could not parse login response: ${data}`));
        }
      });
    });

    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

// ─── HELPERS ────────────────────────────────────────────────────────────────
function printSeparator(title) {
  console.log("\n" + "═".repeat(60));
  console.log(`  ${title}`);
  console.log("═".repeat(60));
}

function printSummary(result) {
  const lat = result.latency;
  const req = result.requests;
  const errors = result.errors + result.timeouts + result["non2xx"];

  console.log(`\n  URL         : ${result.url}`);
  console.log(`  Duration    : ${result.duration}s`);
  console.log(`  Connections : ${result.connections}`);
  console.log(`\n  Throughput`);
  console.log(
    `    Req/sec   : avg=${req.average}  min=${req.min}  max=${req.max}`,
  );
  console.log(`\n  Latency (ms)`);
  console.log(`    avg=${lat.mean}  min=${lat.min}  max=${lat.max}`);
  console.log(`    p50=${lat.p50}  p90=${lat.p90}  p99=${lat.p99}`);
  console.log(`\n  Errors      : ${errors}`);
  console.log(`  Status 2xx  : ${result["2xx"]}`);
  console.log(`  Non-2xx     : ${result["non2xx"]}`);
  console.log(`  Timeouts    : ${result.timeouts}`);

  if (lat.p99 > 1000)
    console.log(
      `\n  ⚠  p99 latency is very high (${lat.p99}ms) — needs optimisation`,
    );
  else if (lat.p99 > 500)
    console.log(
      `\n  ⚠  p99 latency is high (${lat.p99}ms) — consider optimising`,
    );
  if (errors > 0)
    console.log(`\n  ✖  ${errors} errors detected — check your API logs`);
  if (lat.p99 <= 300 && errors === 0) console.log(`\n  ✔  Looks healthy!`);
}

// ─── RUN A SINGLE TEST ──────────────────────────────────────────────────────
function runTest(config) {
  return new Promise((resolve, reject) => {
    const instance = autocannon(config, (err, result) => {
      if (err) return reject(err);
      resolve(result);
    });
    autocannon.track(instance, { renderProgressBar: true });
  });
}

// ─── MAIN ───────────────────────────────────────────────────────────────────
async function main() {
  console.log("\n  Autocannon Load Test — Course API");
  console.log(`  Base URL : ${BASE_URL}`);

  // Auto-login — fresh token every single run, no manual copying
  console.log(`\n  Logging in as ${EMAIL}...`);
  const ACCESS_TOKEN = await login();
  const AUTH_TOKEN = `Bearer ${ACCESS_TOKEN}`;
  console.log(`  Token    : ${ACCESS_TOKEN.slice(0, 30)}...  (fresh)`);

  // ── 1. GET / — Public: all courses ───────────────────────────────────────
  printSeparator("1 / GET all courses  (public)");
  const r1 = await runTest({
    url: `${BASE_URL}/`,
    connections: 10,
    duration: 15,
    title: "GET /",
  });
  printSummary(r1);

  // ── 3. GET /:courseId/content — Protected + subscription ─────────────────
  printSeparator("3 / GET course content  (auth + subscription)");
  const r3 = await runTest({
    url: `${BASE_URL}/${COURSE_ID}/content`,
    connections: 10,
    duration: 15,
    title: "GET /:courseId/content",
    headers: { authorization: AUTH_TOKEN },
  });
  printSummary(r3);

  // ── 4. GET /:courseId/content/:contentId — Protected + subscription ───────
  printSeparator("4 / GET single content item  (auth + subscription)");
  const r4 = await runTest({
    url: `${BASE_URL}/${COURSE_ID}/content/${CONTENT_ID}`,
    connections: 10,
    duration: 15,
    title: "GET /:courseId/content/:contentId",
    headers: { authorization: AUTH_TOKEN },
  });
  printSummary(r4);

  // ── 5. GET /:courseId/content/:contentId/signed-url — Protected ───────────
  printSeparator("5 / GET signed URL  (auth only)");
  const r5 = await runTest({
    url: `${BASE_URL}/${COURSE_ID}/content/${CONTENT_ID}/signed-url`,
    connections: 10,
    duration: 15,
    title: "GET signed-url",
    headers: { authorization: AUTH_TOKEN },
  });
  printSummary(r5);

  // ── 2. GET /:courseId — Public: single course ─────────────────────────────
  printSeparator("2 / GET course by ID  (public)");
  const r2 = await runTest({
    url: `${BASE_URL}/${COURSE_ID}`,
    connections: 10,
    duration: 15,
    title: "GET /:courseId",
  });
  printSummary(r2);

  // ── Final comparison table ────────────────────────────────────────────────
  printSeparator("SUMMARY — all routes");
  const rows = [
    ["Route", "Req/s avg", "p99 (ms)", "Errors"],
    ["GET /", r1.requests.average, r1.latency.p99, r1.errors + r1["non2xx"]],
    [
      "GET /:courseId",
      r2.requests.average,
      r2.latency.p99,
      r2.errors + r2["non2xx"],
    ],
    [
      "GET /:courseId/content",
      r3.requests.average,
      r3.latency.p99,
      r3.errors + r3["non2xx"],
    ],
    [
      "GET /…/content/:contentId",
      r4.requests.average,
      r4.latency.p99,
      r4.errors + r4["non2xx"],
    ],
    [
      "GET /…/:contentId/signed-url",
      r5.requests.average,
      r5.latency.p99,
      r5.errors + r5["non2xx"],
    ],
  ];

  const colW = [36, 12, 12, 10];
  const fmt = (row) => row.map((v, i) => String(v).padEnd(colW[i])).join("  ");

  console.log("\n  " + fmt(rows[0]));
  console.log("  " + "-".repeat(76));
  rows.slice(1).forEach((r) => console.log("  " + fmt(r)));
  console.log("");
}

main().catch((err) => {
  console.error("\n  Test runner failed:", err.message);
  process.exit(1);
});
