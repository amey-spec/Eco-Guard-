import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn, execFileSync } from 'node:child_process';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

/**
 * End-to-end tests for the login rate limiter (5 failed attempts per 15
 * minutes per (IP, email) pair). Each test boots its own throwaway server +
 * freshly seeded SQLite database, exactly like auth-features.test.js, so
 * in-memory rate-limit state never leaks between tests.
 *
 * The exact 5-attempt cutoff is asserted: responses 1-5 must be non-429 and
 * response 6 must be 429 — not merely "some request eventually got 429".
 */

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SERVER_DIR = path.resolve(__dirname, '..');

// Short window for the reset test, but comfortably longer than 6 bcrypt
// comparisons (rounds 12 ≈ 150-300ms each) plus HTTP round trips — otherwise
// the window would expire mid-test and the cutoff assertions would flake.
const TEST_WINDOW_MS = 10_000;

function scratchDb(label) {
  return path.join(
    os.tmpdir(),
    `ecoguard-loginrl-${label}-${process.pid}-${crypto.randomBytes(4).toString('hex')}.sqlite`
  );
}

function makeEmail(prefix) {
  return `${prefix}-${crypto.randomBytes(4).toString('hex')}@ecoguard.com`;
}

function seedDatabase(dbFile) {
  execFileSync(process.execPath, ['scripts/seed.js'], {
    cwd: SERVER_DIR,
    env: { ...process.env, DATABASE_PATH: dbFile },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

function startServer(dbFile, port, extraEnv = {}) {
  const serverProcess = spawn(process.execPath, ['index.js'], {
    cwd: SERVER_DIR,
    env: {
      ...process.env,
      PORT: String(port),
      DATABASE_PATH: dbFile,
      ...extraEnv,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let logs = '';
  serverProcess.stdout.on('data', (d) => (logs += d));
  serverProcess.stderr.on('data', (d) => (logs += d));
  return { serverProcess, logs };
}

async function waitForHealth(serverProcess, logs, port, timeoutMs = 25000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (serverProcess.exitCode !== null) {
      throw new Error(`server exited early (code ${serverProcess.exitCode}):\n${logs}`);
    }
    try {
      const res = await fetch(`http://localhost:${port}/api/health`);
      if (res.ok) return;
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new Error(`server did not become ready in ${timeoutMs}ms:\n${logs}`);
}

async function stopServer(serverProcess, dbFile) {
  serverProcess.kill();
  await new Promise((r) => {
    if (serverProcess.exitCode !== null) return r();
    serverProcess.once('exit', r);
    setTimeout(r, 5000);
  });
  try {
    await import('node:fs/promises').then((fs) => fs.unlink(dbFile));
  } catch {
    // best-effort cleanup
  }
}

// Fetch wrapper that returns status, JSON body and raw headers, with optional
// extra request headers (used to test IP isolation via X-Forwarded-For).
async function call(baseUrl, method, pathname, { body, headers } = {}) {
  const res = await fetch(`${baseUrl}${pathname}`, {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  let json = null;
  try {
    json = await res.json();
  } catch {
    // non-JSON body — leave null
  }
  return { status: res.status, json, headers: res.headers };
}

const login = (baseUrl, email, password, extra = {}) =>
  call(baseUrl, 'POST', '/api/auth/login', {
    body: { email, password },
    ...extra,
  });

const register = (baseUrl, name, email, password) =>
  call(baseUrl, 'POST', '/api/auth/register', { body: { name, email, password } });

function assertSafeRateLimitBody(json, context) {
  assert.ok(json && json.error, `${context}: 429 body has a JSON error message`);
  assert.match(json.error, /too many/i, `${context}: error mentions "too many"`);
  const serialized = JSON.stringify(json);
  assert.ok(!/password/i.test(serialized), `${context}: no password material in body`);
  assert.ok(!/token/i.test(serialized), `${context}: no token material in body`);
}

// Registers the given emails so wrong-password attempts exercise the full
// bcrypt comparison path (same timing as real logins).
async function registerUsers(baseUrl, emails) {
  for (const email of emails) {
    const res = await register(baseUrl, 'Rate Limit Test User', email, 'T3stP@ss123!');
    assert.equal(res.status, 201, `registration of ${email} should succeed`);
  }
}

test('login rate limit: first attempt is allowed and answered normally', async () => {
  const db = scratchDb('first');
  seedDatabase(db);
  const port = 5350;
  const { serverProcess, logs } = startServer(db, port);
  const base = `http://localhost:${port}`;
  await waitForHealth(serverProcess, logs, port);

  try {
    const email = makeEmail('rl-first');
    await registerUsers(base, [email]);

    // Single failed attempt: must be a normal 401, not throttled.
    const res = await login(base, email, 'definitely-wrong');
    assert.equal(res.status, 401, 'first failed attempt must be 401, not 429');
    assert.equal(res.json.error, 'Invalid credentials');
    assert.equal(res.headers.get('retry-after'), null, 'no Retry-After below the limit');
  } finally {
    await stopServer(serverProcess, db);
  }
});

test('login rate limit: exactly 5 failed attempts pass, the 6th gets 429', async () => {
  const db = scratchDb('cutoff');
  seedDatabase(db);
  const port = 5351;
  const { serverProcess, logs } = startServer(db, port, {
    LOGIN_RATE_LIMIT_WINDOW_MS: String(TEST_WINDOW_MS),
  });
  const base = `http://localhost:${port}`;
  await waitForHealth(serverProcess, logs, port);

  try {
    const email = makeEmail('rl-cutoff');
    await registerUsers(base, [email]);

    // Requests 1-5: normal failure responses, never 429.
    for (let i = 1; i <= 5; i++) {
      const res = await login(base, email, 'definitely-wrong');
      assert.equal(
        res.status,
        401,
        `attempt ${i} of 5 must be a normal 401 (got ${res.status})`
      );
      assert.equal(res.headers.get('retry-after'), null, `attempt ${i}: no Retry-After yet`);
    }

    // Request 6 within the same window: 429 with a safe message + headers.
    const res = await login(base, email, 'definitely-wrong');
    assert.equal(res.status, 429, '6th attempt within the window must be 429');
    assertSafeRateLimitBody(res.json, '6th attempt');

    const retryAfter = res.headers.get('retry-after');
    assert.ok(retryAfter !== null, '429 must include a Retry-After header');
    const seconds = Number(retryAfter);
    assert.ok(Number.isFinite(seconds) && seconds > 0, `Retry-After must be positive seconds (got ${retryAfter})`);
    assert.ok(seconds <= Math.ceil(TEST_WINDOW_MS / 1000), 'Retry-After must not exceed the window');

    // And it keeps rejecting while the window is still open.
    const res7 = await login(base, email, 'definitely-wrong');
    assert.equal(res7.status, 429, '7th attempt within the window stays throttled');
  } finally {
    await stopServer(serverProcess, db);
  }
});

test('login rate limit: successful logins are never blocked and do not consume the budget', async () => {
  const db = scratchDb('success');
  seedDatabase(db);
  const port = 5352;
  const { serverProcess, logs } = startServer(db, port, {
    LOGIN_RATE_LIMIT_WINDOW_MS: String(TEST_WINDOW_MS),
  });
  const base = `http://localhost:${port}`;
  await waitForHealth(serverProcess, logs, port);

  try {
    const email = makeEmail('rl-success');
    await registerUsers(base, [email]);

    // 3 failures, then a fully successful login in between.
    for (let i = 0; i < 3; i++) {
      const res = await login(base, email, 'definitely-wrong');
      assert.equal(res.status, 401);
    }
    const ok = await login(base, email, 'T3stP@ss123!');
    assert.equal(ok.status, 200, 'successful login must work while below the limit');
    assert.ok(ok.json.token, 'successful login returns a token');

    // 3 more failures. The success did not count, so this is counted failure
    // #4, #5, #6 — the 6th must be the first 429.
    for (let i = 4; i <= 5; i++) {
      const res = await login(base, email, 'definitely-wrong');
      assert.equal(res.status, 401, `counted failure ${i} of 5 must still pass`);
    }
    const res6 = await login(base, email, 'definitely-wrong');
    assert.equal(res6.status, 429, '6th counted failure must be 429');
    assertSafeRateLimitBody(res6.json, 'after interleaved success');

    // A correct login is still rejected with 429 while the window is open —
    // the limiter throttles the abusive source, not just bad credentials.
    const blocked = await login(base, email, 'T3stP@ss123!');
    assert.equal(blocked.status, 429, 'even a valid login is throttled once the limit is exceeded');
  } finally {
    await stopServer(serverProcess, db);
  }
});

test('login rate limit: counter resets after the configured window expires', async () => {
  const db = scratchDb('reset');
  seedDatabase(db);
  const port = 5353;
  const { serverProcess, logs } = startServer(db, port, {
    LOGIN_RATE_LIMIT_WINDOW_MS: String(TEST_WINDOW_MS),
  });
  const base = `http://localhost:${port}`;
  await waitForHealth(serverProcess, logs, port);

  try {
    const email = makeEmail('rl-reset');
    await registerUsers(base, [email]);

    for (let i = 0; i < 5; i++) {
      const res = await login(base, email, 'definitely-wrong');
      assert.equal(res.status, 401);
    }
    const throttled = await login(base, email, 'definitely-wrong');
    assert.equal(throttled.status, 429, 'limit is hit within the window');

    // Wait for the window to expire (plus a small margin).
    await new Promise((r) => setTimeout(r, TEST_WINDOW_MS + 1_000));

    const afterWindow = await login(base, email, 'definitely-wrong');
    assert.equal(
      afterWindow.status,
      401,
      'after the window expires attempts are allowed again (401, not 429)'
    );
    assert.equal(afterWindow.headers.get('retry-after'), null, 'no Retry-After after reset');

    // The fresh window again allows exactly 5: the 6th is throttled once more.
    for (let i = 0; i < 4; i++) {
      const res = await login(base, email, 'definitely-wrong');
      assert.equal(res.status, 401);
    }
    const throttledAgain = await login(base, email, 'definitely-wrong');
    assert.equal(throttledAgain.status, 429, 'a new window again rejects the 6th attempt');
  } finally {
    await stopServer(serverProcess, db);
  }
});

test('login rate limit: different emails from the same IP are isolated (no cross-account lockout)', async () => {
  const db = scratchDb('iso-email');
  seedDatabase(db);
  const port = 5354;
  const { serverProcess, logs } = startServer(db, port, {
    LOGIN_RATE_LIMIT_WINDOW_MS: String(TEST_WINDOW_MS),
  });
  const base = `http://localhost:${port}`;
  await waitForHealth(serverProcess, logs, port);

  try {
    const emailA = makeEmail('rl-iso-a');
    const emailB = makeEmail('rl-iso-b');
    await registerUsers(base, [emailA, emailB]);

    // Exhaust the budget for email A only.
    for (let i = 0; i < 5; i++) {
      const res = await login(base, emailA, 'definitely-wrong');
      assert.equal(res.status, 401);
    }
    const a6 = await login(base, emailA, 'definitely-wrong');
    assert.equal(a6.status, 429, '6th attempt for email A is throttled');

    // Email B from the same IP is untouched.
    const b1 = await login(base, emailB, 'definitely-wrong');
    assert.equal(b1.status, 401, 'a different account from the same IP is not throttled');
    const bOk = await login(base, emailB, 'T3stP@ss123!');
    assert.equal(bOk.status, 200, 'a different account from the same IP can still log in');
  } finally {
    await stopServer(serverProcess, db);
  }
});

test('login rate limit: same email from different IPs is isolated (no shared-IP lockout)', async () => {
  const db = scratchDb('iso-ip');
  seedDatabase(db);
  const port = 5355;
  // TRUST_PROXY=1 lets the test simulate different client IPs via
  // X-Forwarded-For (mirrors the documented production deployment behind a
  // load balancer).
  const { serverProcess, logs } = startServer(db, port, {
    TRUST_PROXY: '1',
    LOGIN_RATE_LIMIT_WINDOW_MS: String(TEST_WINDOW_MS),
  });
  const base = `http://localhost:${port}`;
  await waitForHealth(serverProcess, logs, port);

  try {
    const email = makeEmail('rl-iso-ip');
    await registerUsers(base, [email]);

    // Exhaust the budget for (203.0.113.10, email).
    for (let i = 0; i < 5; i++) {
      const res = await login(base, email, 'definitely-wrong', {
        headers: { 'X-Forwarded-For': '203.0.113.10' },
      });
      assert.equal(res.status, 401);
    }
    const sixth = await login(base, email, 'definitely-wrong', {
      headers: { 'X-Forwarded-For': '203.0.113.10' },
    });
    assert.equal(sixth.status, 429, '6th attempt from the same IP is throttled');

    // Same email, different client IP: a separate bucket.
    const otherIp = await login(base, email, 'definitely-wrong', {
      headers: { 'X-Forwarded-For': '203.0.113.99' },
    });
    assert.equal(otherIp.status, 401, 'the same email from another IP is not throttled');

    // And a legitimate user from the throttled IP can still sign in fine.
    const legit = await login(base, email, 'T3stP@ss123!', {
      headers: { 'X-Forwarded-For': '203.0.113.10' },
    });
    assert.equal(legit.status, 429, 'the exhausted (IP, email) bucket stays throttled');

    const otherUser = makeEmail('rl-iso-other');
    await registerUsers(base, [otherUser]);
    const legitOther = await login(base, otherUser, 'T3stP@ss123!', {
      headers: { 'X-Forwarded-For': '203.0.113.10' },
    });
    assert.equal(legitOther.status, 200, 'another account from the same IP logs in normally');
  } finally {
    await stopServer(serverProcess, db);
  }
});

test('login rate limit: missing/invalid bodies still count but never leak credentials', async () => {
  const db = scratchDb('safe');
  seedDatabase(db);
  const port = 5356;
  const { serverProcess, logs } = startServer(db, port, {
    LOGIN_RATE_LIMIT_WINDOW_MS: String(TEST_WINDOW_MS),
  });
  const base = `http://localhost:${port}`;
  await waitForHealth(serverProcess, logs, port);

  try {
    // A fixed email for every attempt so all five land in the same bucket.
    // (Missing password → 400 responses.) The 429 must never echo the
    // attempted email or any credential material.
    const probe = await call(base, 'POST', '/api/auth/login', { body: { email: makeEmail('rl-safe') } });
    assert.equal(probe.status, 400);

    const fixedEmail = makeEmail('rl-safe-x');
    for (let i = 0; i < 5; i++) {
      const res = await login(base, fixedEmail, 'definitely-wrong');
      assert.equal(res.status, 401);
    }
    const sixth = await login(base, fixedEmail, 'definitely-wrong');
    assert.equal(sixth.status, 429);
    assertSafeRateLimitBody(sixth.json, 'invalid-body probe');
  } finally {
    await stopServer(serverProcess, db);
  }
});
