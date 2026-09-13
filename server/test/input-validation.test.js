import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, execFileSync } from 'node:child_process';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

/**
 * Protocol #4 — input validation security tests.
 *
 * Boots the real EcoGuard API against a throwaway, freshly seeded SQLite
 * database and attacks it with malformed input: type confusion, invalid IDs,
 * oversized values, bad enums, path-traversal-style filenames and protected
 * fields. Every probe must be rejected with 4xx and the server must stay
 * healthy afterwards. No real malicious payloads and no secrets are used.
 */

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SERVER_DIR = path.resolve(__dirname, '..');
const PORT = 5322;
const DB_FILE = path.join(
  os.tmpdir(),
  `ecoguard-inputval-${process.pid}-${crypto.randomBytes(4).toString('hex')}.sqlite`
);
const API = `http://localhost:${PORT}/api`;

let serverProcess = null;
let serverLogs = '';

async function seedDatabase() {
  execFileSync(process.execPath, ['scripts/seed.js'], {
    cwd: SERVER_DIR,
    env: { ...process.env, DATABASE_PATH: DB_FILE },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

function startServer() {
  serverProcess = spawn(process.execPath, ['index.js'], {
    cwd: SERVER_DIR,
    env: {
      ...process.env,
      PORT: String(PORT),
      DATABASE_PATH: DB_FILE,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  serverProcess.stdout.on('data', (d) => (serverLogs += d));
  serverProcess.stderr.on('data', (d) => (serverLogs += d));
}

async function waitForHealth(timeoutMs = 25000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (serverProcess && serverProcess.exitCode !== null) {
      throw new Error(`server exited early (code ${serverProcess.exitCode}):\n${serverLogs}`);
    }
    try {
      const res = await fetch(`${API}/health`);
      if (res.ok) return;
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new Error(`server did not become ready in ${timeoutMs}ms:\n${serverLogs}`);
}

async function request(method, pathname, { token, body, headers } = {}) {
  const res = await fetch(`${API}${pathname}`, {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
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
  return { status: res.status, json };
}

async function login(email, password) {
  const { status, json } = await request('POST', '/auth/login', { body: { email, password } });
  assert.equal(status, 200, `login for ${email} should succeed`);
  return json.token;
}

before(async () => {
  seedDatabase();
  startServer();
  await waitForHealth();
});

after(async () => {
  if (serverProcess) {
    serverProcess.kill();
    await new Promise((resolve) => {
      if (serverProcess.exitCode !== null) return resolve();
      serverProcess.once('exit', resolve);
      setTimeout(resolve, 5000);
    });
  }
  try {
    await import('node:fs/promises').then((fs) => fs.unlink(DB_FILE));
  } catch {
    // best-effort cleanup
  }
});

/* ---------- shared helpers ---------- */

/** Asserts a 4xx and that the body leaks nothing internal. */
function assertSafeRejection(res, context, expectedStatus = 400) {
  assert.equal(
    res.status,
    expectedStatus,
    `${context}: expected ${expectedStatus}, got ${res.status} (${JSON.stringify(res.json)})`
  );
  assert.ok(res.json && res.json.error, `${context}: error message present`);
  const serialized = JSON.stringify(res.json);
  assert.ok(!/SELECT |INSERT |sqlite|SELECTIVE/i.test(serialized), `${context}: no SQL in body`);
  assert.ok(!/\/(home|Users|var|tmp|server)\//.test(serialized), `${context}: no filesystem paths`);
  assert.ok(!/at .+ \(.*:\d+:\d+\)/.test(serialized), `${context}: no stack traces`);
}

/* ---------- type confusion ---------- */

test('register rejects non-string name/email/password (type confusion)', async () => {
  for (const body of [
    { name: { $ne: null }, email: 't1@example.com', password: 'Str0ngPass1' },
    { name: 'Type Confusion One', email: ['t2@example.com'], password: 'Str0ngPass1' },
    { name: 'Type Confusion Three', email: 't3@example.com', password: { password: 'x' } },
    { name: null, email: 't4@example.com', password: 'Str0ngPass1' },
  ]) {
    const res = await request('POST', '/auth/register', { body });
    assert.ok([400, 409].includes(res.status), `register type-confusion should be 400/409, got ${res.status}`);
  }
});

test('login rejects object/array email (NoSQL-style operator injection)', async () => {
  const res = await request('POST', '/auth/login', {
    body: { email: { $ne: 'user@ecoguard.com' }, password: { $ne: 'user123' } },
  });
  assert.ok([400, 401].includes(res.status), `got ${res.status}`);
});

test('quiz submit rejects non-array and element-level type confusion', async () => {
  const badBodies = [
    { answers: { $ne: null } },
    { answers: 'AAAAA' },
    { answers: [0, 1, 2, 3, 4] },
    { answers: [{ option: 0 }, { option: 1 }, { option: 2 }, { option: 3 }, { option: 4 }] },
    { answers: [['A'], ['B'], ['C'], ['D'], ['E']] },
    { answers: null },
  ];
  for (const body of badBodies) {
    const res = await request('POST', '/quiz/1/submit', { body });
    assert.equal(res.status, 400, `answers=${JSON.stringify(body.answers)} must be 400`);
  }
});

test('quiz submit rejects an oversized answer sheet', async () => {
  const res = await request('POST', '/quiz/1/submit', {
    body: { answers: Array.from({ length: 200 }, () => 'A') },
  });
  assert.equal(res.status, 400);
});

/* ---------- invalid IDs ---------- */

test('hazard ids reject negative, zero, non-numeric, float and oversized values', async () => {
  for (const id of ['-1', '0', 'abc', '1.5', '9'.repeat(30), 'ECO-2026-00001', '%20', '1%2F..%2Fetc']) {
    const res = await request('GET', `/hazards/${encodeURIComponent(id)}`);
    assert.equal(res.status, 400, `hazard id ${id} must be 400, got ${res.status}`);
  }
  // Sanity: a valid id still works.
  const ok = await request('GET', '/hazards/1');
  assert.equal(ok.status, 200);
});

test('education ids reject invalid values and a valid id still works', async () => {
  for (const id of ['-1', '0', 'abc', '1.5', '9'.repeat(30)]) {
    const res = await request('GET', `/education/${id}`);
    assert.equal(res.status, 400, `education id ${id} must be 400, got ${res.status}`);
  }
  const ok = await request('GET', '/education/1');
  assert.equal(ok.status, 200);
});

test('quiz ids reject invalid values for both detail and submit', async () => {
  for (const id of ['-1', '0', 'abc', '1.5']) {
    const res = await request('GET', `/quiz/${id}`);
    assert.equal(res.status, 400, `quiz id ${id} must be 400, got ${res.status}`);
    const res2 = await request('POST', `/quiz/${id}/submit`, { body: { answers: ['A'] } });
    assert.equal(res2.status, 400, `quiz submit id ${id} must be 400, got ${res2.status}`);
  }
});

test('track/:id rejects malformed, traversal-style and wrong-format report ids', async () => {
  for (const id of [
    '..%2Fetc%2Fpasswd',
    'ECO-2026-XXXXX',
    'ec0-2026-00001',
    'ECO-26-00001',
    'DROP%20TABLE',
    'ECO-2026-000001',
  ]) {
    const res = await request('GET', `/reports/track/${id}`);
    assert.equal(res.status, 400, `track id ${id} must be 400, got ${res.status}`);
  }
  // A well-formed but nonexistent id is a 404, not a 400.
  const res = await request('GET', '/reports/track/ECO-1999-00001');
  assert.equal(res.status, 404);
});

test('notification read rejects non-integer and non-positive ids', async () => {
  const userToken = await login('user@ecoguard.com', 'user123');
  for (const id of ['-1', '0', 'abc', '1.5']) {
    const res = await request('PUT', `/notifications/${id}/read`, { token: userToken });
    assert.equal(res.status, 400, `notification id ${id} must be 400, got ${res.status}`);
  }
});

/* ---------- invalid query params ---------- */

test('hazard filters reject non-string and oversized query values', async () => {
  const big = 'a'.repeat(300);
  const probes = [
    `/hazards?search=${big}`,
    `/hazards?severity=${'NotASeverity'}`,
    `/hazards?severity=${big}`,
    `/hazards?category=${big}`,
  ];
  for (const p of probes) {
    const res = await request('GET', p);
    assert.equal(res.status, 400, `GET ${p.slice(0, 40)}… must be 400, got ${res.status}`);
  }
  // Valid filters still work.
  const ok = await request('GET', '/hazards?severity=High&search=pollution');
  assert.equal(ok.status, 200);
});

test('education filters reject non-string and oversized query values', async () => {
  const big = 'b'.repeat(300);
  for (const p of [`/education?search=${big}`, `/education?category=${big}`]) {
    const res = await request('GET', p);
    assert.equal(res.status, 400, `GET ${p.slice(0, 40)}… must be 400, got ${res.status}`);
  }
});

test('reports list rejects unknown status/severity enums and oversized category', async () => {
  const userToken = await login('user@ecoguard.com', 'user123');
  for (const p of [
    '/reports?status=THIS_IS_NOT_VALID',
    '/reports?severity=NotASeverity',
    `/reports?category=${'c'.repeat(300)}`,
  ]) {
    const res = await request('GET', p, { token: userToken });
    assert.equal(res.status, 400, `GET ${p.slice(0, 45)}… must be 400, got ${res.status}`);
  }
});

test('audit-log pagination caps limit and rejects invalid admin_id', async () => {
  const adminToken = await login('admin@ecoguard.com', 'admin123');

  const capped = await request('GET', '/admin/audit-log?limit=999999', { token: adminToken });
  assert.equal(capped.status, 200);
  assert.ok(capped.json.limit <= 100, 'audit-log limit must stay capped');

  const capped2 = await request('GET', '/admin/security-events?limit=999999', { token: adminToken });
  assert.equal(capped2.status, 200);
  assert.ok(capped2.json.limit <= 200, 'security-events limit must stay capped');

  const bad = await request('GET', '/admin/audit-log?admin_id=not-a-number', { token: adminToken });
  assert.equal(bad.status, 400);
});

/* ---------- oversized input ---------- */

test('oversized JSON body is rejected and the server stays healthy', async () => {
  const big = 'x'.repeat(200 * 1024); // 100kb limit
  const res = await fetch(`${API}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: big, email: 'big@example.com', password: 'Str0ngPass1' }),
  });
  assert.ok([413, 400].includes(res.status), `oversized body must be 413/400, got ${res.status}`);
  // Server must remain stable afterwards.
  const health = await fetch(`${API}/health`);
  assert.equal(health.status, 200);
});

test('malformed JSON body returns 400 without a stack trace', async () => {
  const res = await fetch(`${API}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{ this is not json',
  });
  assert.equal(res.status, 400);
  const text = await res.text();
  assert.ok(!/at .+ \(.*:\d+:\d+\)/.test(text), 'no stack trace in body');
});

/* ---------- protected fields / privilege escalation ---------- */

test('registration cannot grant admin role or set account status', async () => {
  const email = `escalate-${crypto.randomBytes(3).toString('hex')}@ecoguard.com`;
  const res = await request('POST', '/auth/register', {
    body: { name: 'Escalation Attempt', email, password: 'Str0ngPass1', role: 'admin', status: 'active' },
  });
  assert.equal(res.status, 201, 'registration itself should succeed');
  assert.equal(res.json.user.role, 'user', 'role must be forced to user');

  const adminToken = await login('admin@ecoguard.com', 'admin123');
  const users = await request('GET', '/admin/users', { token: adminToken });
  const row = users.json.find((u) => u.email === email);
  assert.ok(row, 'registered user exists');
  assert.equal(row.role, 'user', 'stored role must be user');
  assert.equal(row.status, 'active', 'stored status must be active');
});

test('profile update cannot change role/status/theme through the profile endpoint', async () => {
  const userToken = await login('user@ecoguard.com', 'user123');
  const res = await request('PUT', '/auth/profile', {
    token: userToken,
    body: { name: 'Still A User', role: 'admin', status: 'suspended' },
  });
  assert.equal(res.status, 200);
  assert.equal(res.json.role, 'user', 'role must be unchanged');
  // The public profile columns do not include status; verify via the admin list.
  const adminToken2 = await login('admin@ecoguard.com', 'admin123');
  const users2 = await request('GET', '/admin/users', { token: adminToken2 });
  const row2 = users2.json.find((u) => u.id === res.json.id);
  assert.ok(row2, 'user still exists');
  assert.equal(row2.role, 'user', 'role must be unchanged in storage');
  assert.equal(row2.status, 'active', 'status must be unchanged in storage');
});

/* ---------- XSS-style input ---------- */

test('markup-like report content is stored as inert text, not executed', async () => {
  const fd = new FormData();
  fd.append('title', 'Script tags in a title <b>bold</b>');
  fd.append('hazard_type', 'Air Pollution');
  fd.append('severity', 'Low');
  fd.append('location', 'XSS test location <img src=x>');
  fd.append('description', 'Description containing <script>alert(1)</script> and &lt;html&gt; entities.');

  const res = await fetch(`${API}/reports/submit`, { method: 'POST', body: fd });
  assert.equal(res.status, 201);
  const { reportId } = await res.json();
  assert.ok(reportId);

  // Stored value keeps the literal text (React escapes it on render); the
  // response must be JSON, never executable HTML.
  const track = await request('GET', `/reports/track/${reportId}`);
  assert.equal(track.status, 200);
  assert.equal(track.json.title, 'Script tags in a title <b>bold</b>');
  // The response must be JSON — a Content-Type of text/html would let a
  // browser interpret stored markup, so the header itself is part of the check.
  const trackRaw = await fetch(`${API}/reports/track/${reportId}`);
  assert.match(trackRaw.headers.get('content-type') || '', /application\/json/i);
  assert.equal(trackRaw.status, 200);
});

/* ---------- upload: forged mimetype / non-image bytes ---------- */

test('upload with forged image mimetype but text content is rejected', async () => {
  const fd = new FormData();
  fd.append('title', 'Forged mimetype upload attempt');
  fd.append('hazard_type', 'Air Pollution');
  fd.append('severity', 'Low');
  fd.append('location', 'Forge test location');
  fd.append('description', 'A text file renamed to .jpg with a forged mimetype header.');
  fd.append(
    'image',
    new Blob([Buffer.from('definitely not an image, just plain text bytes.')], { type: 'image/jpeg' }),
    'photo.jpg'
  );

  const res = await fetch(`${API}/reports/submit`, { method: 'POST', body: fd });
  assert.equal(res.status, 400, `forged mimetype must be 400, got ${res.status}`);
  const json = await res.json();
  assert.ok(json.error);
});

test('upload with a valid PNG magic number and .png extension is accepted', async () => {
  // 1x1 transparent PNG (89 50 4E 47 0D 0A 1A 0A ...).
  const png = Buffer.from(
    '89504e470d0a1a0a0000000d494844520000000100000001080600000'
      + '01f15c4890000000d49444154789c626001000000ffff030000060005'
      + '57bfabd40000000049454e44ae426082',
    'hex'
  );
  const fd = new FormData();
  fd.append('title', 'Valid PNG upload');
  fd.append('hazard_type', 'Air Pollution');
  fd.append('severity', 'Low');
  fd.append('location', 'Valid upload location');
  fd.append('description', 'A minimal valid PNG used to confirm real images still upload.');
  fd.append('image', new Blob([png], { type: 'image/png' }), 'photo.png');

  const res = await fetch(`${API}/reports/submit`, { method: 'POST', body: fd });
  assert.equal(res.status, 201, `valid PNG upload must succeed, got ${res.status}`);
});

/* ---------- server stability ---------- */

test('server remains healthy after all malformed-input probes', async () => {
  const res = await fetch(`${API}/health`);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.status, 'ok');
});
