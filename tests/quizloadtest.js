import autocannon from "autocannon";
import fetch from "node-fetch";

// ─── Config ───────────────────────────────────────────────────────────────────
const BASE_URL = "http://localhost:5000";
const LOGIN_EMAIL = "babajaihoji2@gmail.com";
const LOGIN_PASSWORD = "Aman700@";
const LOGIN_PATH = "/api/auth/login";
const QUIZ_ID = "69b58bf34a8b1f3e807fd22f";
const COURSE_ID = "690f6f35857961b447bb772a";
const QUIZ_SLUG = "geopgraphy";

const DEFAULTS = {
  url: BASE_URL,
  connections: 10,
  duration: 10, // seconds per test
  pipelining: 1,
};

// ─── Results store (for final summary) ───────────────────────────────────────
const allResults = [];

// ─── Login ────────────────────────────────────────────────────────────────────

/**
 * Hits your auth endpoint once with node-fetch, extracts the JWT,
 * and returns ready-to-use header objects.
 */
async function login() {
  console.log(`\n🔐  Logging in as ${LOGIN_EMAIL} …`);

  const res = await fetch(`${BASE_URL}${LOGIN_PATH}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: LOGIN_EMAIL, password: LOGIN_PASSWORD }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Login failed [${res.status}]: ${text}`);
  }

  const data = await res.json();

  // ── Adapt this line to wherever your API puts the token ──────────────────
  // Common patterns:
  //   data.token | data.accessToken | data.data.token | data.user.token
  const token = data.token || data.accessToken || data?.data?.token;
  // ─────────────────────────────────────────────────────────────────────────

  if (!token) {
    throw new Error(
      `Could not find token in login response. Keys: ${Object.keys(data).join(", ")}`,
    );
  }

  console.log(`✅  Login successful. Token: ${token.slice(0, 20)}…`);

  return {
    authHeader: { Authorization: `Bearer ${token}` },
    jsonHeaders: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  };
}

// ─── Runner ───────────────────────────────────────────────────────────────────

function run(name, opts) {
  return new Promise((resolve, reject) => {
    console.log(`\n${"─".repeat(64)}`);
    console.log(`▶  ${name}`);
    console.log(`${"─".repeat(64)}`);

    const instance = autocannon({ ...DEFAULTS, ...opts }, (err, result) => {
      if (err) return reject(err);

      // Store for final summary
      allResults.push({ name, result });

      // Per-test inline summary
      printInlineSummary(result);
      resolve(result);
    });

    autocannon.track(instance, { renderProgressBar: true });
  });
}

function printInlineSummary(r) {
  const pass = r.non2xx === 0 && r.errors === 0;
  console.log(
    `  ${pass ? "✅" : "⚠️ "} ` +
      `Req/s avg=${r.requests.average}  ` +
      `p50=${r.latency.p50}ms  p99=${r.latency.p99}ms  ` +
      `errors=${r.errors}  non2xx=${r.non2xx}`,
  );
}

// ─── Test Scenarios ───────────────────────────────────────────────────────────

async function testPublicGetAllQuizzes() {
  await run("GET /api/v1/quizzes — public list", {
    requests: [{ method: "GET", path: "/api/v1/quizzes" }],
  });
}

async function testGlobalLeaderboard() {
  await run("GET /api/v1/quizzes/leaderboard/global — public", {
    requests: [{ method: "GET", path: "/api/v1/quizzes/leaderboard/global" }],
  });
}

async function testQuizLeaderboard() {
  await run(`GET /api/v1/quizzes/:quizId/leaderboard — public`, {
    requests: [
      { method: "GET", path: `/api/v1/quizzes/${QUIZ_ID}/leaderboard` },
    ],
  });
}

async function testGetQuizzesForCourse(authHeader) {
  await run("GET /api/v1/quizzes/course/:courseId — protected", {
    requests: [
      {
        method: "GET",
        path: `/api/v1/quizzes/course/${COURSE_ID}`,
        headers: authHeader,
      },
    ],
  });
}

async function testAttemptStatus(authHeader) {
  await run("GET /api/v1/quizzes/:quizId/attempt-status — protected", {
    requests: [
      {
        method: "GET",
        path: `/api/v1/quizzes/${QUIZ_ID}/attempt-status`,
        headers: authHeader,
      },
    ],
  });
}

async function testGetQuizQuestions(authHeader) {
  await run(
    "GET /api/v1/quizzes/:quizId/questions — protected + subscription",
    {
      requests: [
        {
          method: "GET",
          path: `/api/v1/quizzes/${QUIZ_ID}/questions`,
          headers: authHeader,
        },
      ],
    },
  );
}

async function testReviewQuiz(authHeader) {
  await run("GET /api/v1/quizzes/:quizId/review — protected", {
    requests: [
      {
        method: "GET",
        path: `/api/v1/quizzes/${QUIZ_ID}/review`,
        headers: authHeader,
      },
    ],
  });
}

async function testGetQuizById(authHeader) {
  await run("GET /api/v1/quizzes/:quizId — protected + subscription", {
    requests: [
      {
        method: "GET",
        path: `/api/v1/quizzes/${QUIZ_ID}`,
        headers: authHeader,
      },
    ],
  });
}

async function testSubmitQuiz(jsonHeaders) {
  const body = JSON.stringify({
    answers: [
      { questionId: "q1", selectedOption: "A" },
      { questionId: "q2", selectedOption: "C" },
      { questionId: "q3", selectedOption: "B" },
    ],
  });

  await run("POST /api/v1/quizzes/:quizId/submit — protected", {
    connections: 5, // lower concurrency for write ops
    requests: [
      {
        method: "POST",
        path: `/api/v1/quizzes/${QUIZ_ID}/submit`,
        headers: jsonHeaders,
        body,
      },
    ],
  });
}

async function testUnauthorizedAccess() {
  await run("GET /:quizId/questions — no token (expect 401)", {
    requests: [
      {
        method: "GET",
        path: `/api/v1/quizzes/${QUIZ_ID}/questions`,
        // intentionally no Authorization header
      },
    ],
  });
}

async function testMixedRealisticTraffic(authHeader, jsonHeaders) {
  await run("Mixed realistic traffic — all routes (30s)", {
    connections: 20,
    duration: 30,
    requests: [
      // ── Public (high frequency) ──────────────────────────────────────────
      { method: "GET", path: "/api/v1/quizzes" },
      { method: "GET", path: "/api/v1/quizzes/leaderboard/global" },
      { method: "GET", path: `/api/v1/quizzes/${QUIZ_ID}/leaderboard` },

      // ── Protected reads (medium frequency) ──────────────────────────────
      {
        method: "GET",
        path: `/api//v1quizzes/course/${COURSE_ID}`,
        headers: authHeader,
      },
      {
        method: "GET",
        path: `/api/v1/quizzes/${QUIZ_ID}/attempt-status`,
        headers: authHeader,
      },
      {
        method: "GET",
        path: `/api/v1/quizzes/${QUIZ_ID}/questions`,
        headers: authHeader,
      },
      {
        method: "GET",
        path: `/api/v1/quizzes/${QUIZ_ID}/review`,
        headers: authHeader,
      },
      {
        method: "GET",
        path: `/api/v1/quizzes/${QUIZ_ID}`,
        headers: authHeader,
      },

      // ── Write (low frequency) ────────────────────────────────────────────
      {
        method: "POST",
        path: `/api/v1/quizzes/${QUIZ_ID}/submit`,
        headers: jsonHeaders,
        body: JSON.stringify({
          answers: [{ questionId: "q1", selectedOption: "A" }],
        }),
      },
    ],
  });
}

// ─── Final Summary ────────────────────────────────────────────────────────────

function printFinalSummary() {
  const SEP = "═".repeat(116);
  const HEADER =
    "  Test Name".padEnd(52) +
    "Req/s avg".padStart(10) +
    "Req/s max".padStart(10) +
    "p50 (ms)".padStart(10) +
    "p99 (ms)".padStart(10) +
    "Errors".padStart(8) +
    "Non-2xx".padStart(9) +
    "Status".padStart(9);

  console.log(`\n\n${SEP}`);
  console.log("  FINAL SUMMARY — ALL LOAD TESTS");
  console.log(SEP);
  console.log(HEADER);
  console.log("─".repeat(116));

  let anyFailed = false;

  for (const { name, result: r } of allResults) {
    const pass = r.non2xx === 0 && r.errors === 0;
    const status = pass ? "✅  PASS" : "⚠️  WARN";
    if (!pass) anyFailed = true;

    const row =
      `  ${name.slice(0, 50).padEnd(50)}` +
      `${r.requests.average.toString().padStart(10)}` +
      `${r.requests.max.toString().padStart(10)}` +
      `${r.latency.p50.toString().padStart(10)}` +
      `${r.latency.p99.toString().padStart(10)}` +
      `${r.errors.toString().padStart(8)}` +
      `${r.non2xx.toString().padStart(9)}` +
      `  ${status}`;

    console.log(row);
  }

  console.log(SEP);

  // Aggregate stats across all tests
  const totalReq = allResults.reduce(
    (s, { result: r }) => s + r.requests.total,
    0,
  );
  const totalErr = allResults.reduce((s, { result: r }) => s + r.errors, 0);
  const totalNon2xx = allResults.reduce((s, { result: r }) => s + r.non2xx, 0);
  const avgP99 = Math.round(
    allResults.reduce((s, { result: r }) => s + r.latency.p99, 0) /
      allResults.length,
  );
  const bestReqS = Math.max(
    ...allResults.map(({ result: r }) => r.requests.average),
  );
  const worstP99 = Math.max(
    ...allResults.map(({ result: r }) => r.latency.p99),
  );
  const { name: slowestTest } = allResults.find(
    ({ result: r }) => r.latency.p99 === worstP99,
  );

  console.log(`
  Tests run      : ${allResults.length}
  Total requests : ${totalReq.toLocaleString()}
  Avg p99 latency: ${avgP99} ms
  Worst p99      : ${worstP99} ms  (${slowestTest.slice(0, 55)})
  Best req/s     : ${bestReqS}
  Total errors   : ${totalErr}
  Total non-2xx  : ${totalNon2xx}
  `);

  console.log(
    `  ${
      anyFailed
        ? "⚠️  Some tests had errors or non-2xx responses — review above."
        : "🎉  All tests passed cleanly."
    }`,
  );
  console.log(`${SEP}\n`);
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log("═".repeat(64));
  console.log("  AUTOCANNON LOAD TEST — Quiz API");
  console.log(`  Target  : ${BASE_URL}`);
  console.log(`  Quiz ID : ${QUIZ_ID}   Course ID: ${COURSE_ID}`);
  console.log("═".repeat(64));

  // 1. Authenticate once — all protected tests reuse this token
  const { authHeader, jsonHeaders } = await login();

  try {
    // ── Public routes ────────────────────────────────────────────────────────
    await testPublicGetAllQuizzes();
    await testGlobalLeaderboard();
    await testQuizLeaderboard();

    // ── Protected routes ─────────────────────────────────────────────────────
    await testGetQuizzesForCourse(authHeader);
    await testAttemptStatus(authHeader);
    await testGetQuizQuestions(authHeader);
    await testReviewQuiz(authHeader);
    await testGetQuizById(authHeader);
    await testSubmitQuiz(jsonHeaders);

    // ── Edge case ────────────────────────────────────────────────────────────
    await testUnauthorizedAccess();

    // ── Stress / mixed ───────────────────────────────────────────────────────
    await testMixedRealisticTraffic(authHeader, jsonHeaders);
  } catch (err) {
    console.error("\n❌  Test run aborted:", err.message);
    process.exit(1);
  }

  // 2. Print consolidated summary table across all tests
  printFinalSummary();
}

main();
