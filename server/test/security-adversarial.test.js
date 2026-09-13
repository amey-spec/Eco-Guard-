import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, execFileSync } from 'node:child_process';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

/**
 * Protocol #5 — adversarial security tests.
 *
 * Boots the real API against a throwaway seeded database and attempts to
 * bypass security controls: token tampering, authorization/IDOR bypasses,
 * suspended-account access, protected-field injection, upload bypasses,
 * prototype pollution and information-leak probes.
 *
 * All test data is harmless; nothing here attacks a third-party system.
 */

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SERVER_DIR = path.resolve(__dirname, '..');
const PORT = 5358;
const DB_FILE = path.join(
  os.tmpdir(),
  `ecoguard-adversarial-${process.pid}-${crypto.randomBytes(4).toString('hex')}.sqlite`
);
const API = `http://localhost:${PORT}/api`;

// 1x1 transparent PNG — a real image used for harmless upload-bypass probes.
const VALID_PNG = Buffer.from(
  '89504e470d0a1a0a0000000d494844520000000100000001080600000'
    + '01f15c4890000000d49444154789c626001000000ffff030000060005'
    + '57bfabd40000000049454e44ae426082',
  'hex'
);

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
      // The suite performs dozens of auth round-trips and admin mutations from
      // one source; raise the per-IP/per-account budgets for this process only
      // (production defaults hold).
      AUTH_RATE_LIMIT_MAX: '1000',
      API_RATE_LIMIT_MAX: '5000',
      ADMIN_RATE_LIMIT_MAX: '500',
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
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
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

/** Registers a fresh throwaway user and returns { email, token, id }. */
async function registerUser(namePrefix) {
  const email = `${namePrefix}-${crypto.randomBytes(4).toString('hex')}@ecoguard.com`;
  const res = await request('POST', '/auth/register', {
    body: { name: `Adversarial ${namePrefix}`, email, password: 'Str0ngPass1' },
  });
  assert.equal(res.status, 201, `registration of ${email} should succeed`);
  return { email, token: res.json.token, id: res.json.user.id };
}

/** Submits a harmless report, optionally with a bearer token. */
function submitReport(token, title) {
  const fd = new FormData();
  fd.append('title', title);
  fd.append('hazard_type', 'Air Pollution');
  fd.append('severity', 'Low');
  fd.append('location', 'Adversarial test area');
  fd.append('description', 'Harmless probe report created by the security test suite.');
  return fetch(`${API}/reports/submit`, {
    method: 'POST',
    body: fd,
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
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

/* ══════════════════ 1. Authentication bypass ══════════════════ */

test('auth: missing token is rejected on every protected surface', async () => {
  const probes = [
    ['GET', '/auth/profile'],
    ['GET', '/notifications'],
    ['GET', '/reports/my-reports'],
    ['GET', '/admin/users'],
    ['GET', '/admin/stats'],
    ['PUT', '/notifications/1/read'],
  ];
  for (const [method, p] of probes) {
    const res = await request(method, p);
    assert.ok([401, 403].includes(res.status), `${method} ${p} without token must be 401/403, got ${res.status}`);
    assert.ok(res.json && res.json.error, `${method} ${p}: JSON error body present`);
  }
});

test('auth: garbage and structurally-broken tokens are rejected', async () => {
  const garbage = ['not-a-jwt', 'a.b.c', '...', 'null', 'undefined', 'Bearer'];
  for (const token of garbage) {
    const res = await request('GET', '/auth/profile', { token });
    assert.equal(res.status, 403, `garbage token "${token}" must be 403, got ${res.status}`);
  }
});

test('auth: token signed with the wrong secret is rejected (signature check)', async () => {
  const { default: jwt } = await import('jsonwebtoken');
  const forged = jwt.sign(
    { id: 1, email: 'admin@ecoguard.com', role: 'admin' },
    'an-attacker-controlled-secret-that-is-long-enough',
    { issuer: 'ecoguard-api', audience: 'ecoguard-client', expiresIn: '1h' }
  );
  const res = await request('GET', '/auth/profile', { token: forged });
  assert.equal(res.status, 403, 'token signed with an attacker secret must be rejected');
});

test('auth: wrong issuer and wrong audience tokens are rejected', async () => {
  const { default: jwt } = await import('jsonwebtoken');
  const wrongIss = jwt.sign(
    { id: 1, role: 'admin' },
    'attacker-secret-for-issuer-test',
    { issuer: 'not-ecoguard', audience: 'ecoguard-client', expiresIn: '1h' }
  );
  const wrongAud = jwt.sign(
    { id: 1, role: 'admin' },
    'attacker-secret-for-audience-test',
    { issuer: 'ecoguard-api', audience: 'not-ecoguard', expiresIn: '1h' }
  );
  for (const token of [wrongIss, wrongAud]) {
    const res = await request('GET', '/auth/profile', { token });
    assert.equal(res.status, 403, 'wrong iss/aud token must be rejected');
  }
});

test('auth: expired token is rejected', async () => {
  const { default: jwt } = await import('jsonwebtoken');
  const expired = jwt.sign(
    { id: 1, email: 'admin@ecoguard.com', role: 'admin' },
    'expired-token-test-secret',
    { issuer: 'ecoguard-api', audience: 'ecoguard-client', expiresIn: '-10s' }
  );
  const res = await request('GET', '/auth/profile', { token: expired });
  assert.equal(res.status, 403, 'expired token must be rejected');
});

test('auth: alg=none token is rejected', async () => {
  const b64url = (obj) => Buffer.from(JSON.stringify(obj)).toString('base64url');
  const header = b64url({ alg: 'none', typ: 'JWT' });
  const payload = b64url({
    id: 1, email: 'admin@ecoguard.com', role: 'admin',
    iss: 'ecoguard-api', aud: 'ecoguard-client',
  });
  const token = `${header}.${payload}.`;
  const res = await request('GET', '/auth/profile', { token });
  assert.equal(res.status, 403, 'alg=none token must be rejected');
});

test('auth: HMAC token signed with an attacker-chosen key is rejected', async () => {
  const { createHmac } = await import('node:crypto');
  const b64url = (obj) => Buffer.from(JSON.stringify(obj)).toString('base64url');
  const header = b64url({ alg: 'HS256', typ: 'JWT' });
  const payload = b64url({
    id: 1, email: 'admin@ecoguard.com', role: 'admin',
    iss: 'ecoguard-api', aud: 'ecoguard-client',
  });
  const signingInput = `${header}.${payload}`;
  const sig = createHmac('sha256', 'attacker-chosen-key').update(signingInput).digest('base64url');
  const res = await request('GET', '/auth/profile', { token: `${signingInput}.${sig}` });
  assert.equal(res.status, 403, 'HMAC token with attacker key must fail signature verification');
});

test('auth: tampered payload (claims edited after signing) is rejected', async () => {
  // Take a real token, swap the payload for an admin claim, keep the original
  // signature — the signature check must catch it.
  const { token } = await registerUser('tamper');
  const [, , sig] = token.split('.');
  const b64url = (obj) => Buffer.from(JSON.stringify(obj)).toString('base64url');
  const header = b64url({ alg: 'HS256', typ: 'JWT' });
  const evilPayload = b64url({
    id: 1, email: 'admin@ecoguard.com', role: 'admin',
    iss: 'ecoguard-api', aud: 'ecoguard-client',
  });
  const res = await request('GET', '/auth/profile', { token: `${header}.${evilPayload}.${sig}` });
  assert.equal(res.status, 403, 'tampered payload must fail signature verification');
});

/* ══════════════════ 2. Authorization / IDOR ══════════════════ */

test('authz: normal user cannot reach any admin endpoint (vertical escalation)', async () => {
  const { token } = await registerUser('vert');
  const adminToken = await login('admin@ecoguard.com', 'admin123');

  const probes = [
    ['GET', '/admin/users'],
    ['GET', '/admin/stats'],
    ['GET', '/admin/audit-log'],
    ['GET', '/admin/security-events'],
    ['GET', '/admin/security-overview'],
    ['GET', '/admin/administrators'],
    ['GET', '/admin/administrators/1'],
    ['PUT', '/admin/reports/ECO-2026-00001/status', { status: 'Resolved' }],
    ['DELETE', '/admin/reports/ECO-2026-00001', {}],
    ['PUT', '/admin/users/1/role', { role: 'user' }],
    ['PUT', '/admin/users/2/status', { status: 'disabled' }],
  ];
  for (const [method, p, body] of probes) {
    const res = await request(method, p, { token, body });
    assert.equal(res.status, 403, `${method} ${p} as normal user must be 403, got ${res.status}`);
  }
  // Sanity: admin access is unaffected by the failed attempts above.
  const users = await request('GET', '/admin/users', { token: adminToken });
  assert.equal(users.status, 200);
});

test('authz: user A cannot read or mutate user B notifications (IDOR)', async () => {
  const a = await registerUser('idor-a');
  const b = await registerUser('idor-b');

  // Give user B a notification by submitting a report under their token.
  const submit = await submitReport(b.token, 'IDOR notification source');
  assert.equal(submit.status, 201);

  const bList = await request('GET', '/notifications', { token: b.token });
  assert.equal(bList.status, 200);
  assert.ok(bList.json.length > 0, 'user B should have a notification');

  for (const n of bList.json) {
    const read = await request('PUT', `/notifications/${n.id}/read`, { token: a.token });
    assert.equal(read.status, 404, `user A marking user B notification ${n.id} read must be 404`);
  }

  // User B can still manage their own notification.
  const bSelf = await request('PUT', `/notifications/${bList.json[0].id}/read`, { token: b.token });
  assert.equal(bSelf.status, 200);
});

test('authz: my-reports returns only the caller\'s own reports (ownership filter)', async () => {
  const a = await registerUser('mine-a');
  const b = await registerUser('mine-b');

  const submit = await submitReport(b.token, 'Ownership probe report');
  assert.equal(submit.status, 201);
  const { reportId } = await submit.json();

  const aList = await request('GET', '/reports/my-reports', { token: a.token });
  assert.equal(aList.status, 200);
  assert.ok(!aList.json.some((r) => r.id === reportId), 'user A must not see user B report in my-reports');

  const bList = await request('GET', '/reports/my-reports', { token: b.token });
  assert.equal(bList.status, 200);
  assert.ok(bList.json.some((r) => r.id === reportId), 'user B sees their own report');
});

/* ══════════════════ 3. Account status enforcement ══════════════════ */

test('account status: suspended user with a valid old token loses access immediately', async () => {
  const adminToken = await login('admin@ecoguard.com', 'admin123');
  const { email, token } = await registerUser('susp');

  // Before suspension the token works.
  assert.equal((await request('GET', '/auth/profile', { token })).status, 200);

  const suspend = await request('PUT', `/admin/users/${await userIdByEmail(adminToken, email)}/status`, {
    token: adminToken,
    body: { status: 'suspended' },
  });
  assert.equal(suspend.status, 200);

  const prof = await request('GET', '/auth/profile', { token });
  assert.equal(prof.status, 403, 'suspended account token must be rejected');
  assert.match(prof.json.error, /not active/i);

  assert.equal((await request('GET', '/notifications', { token })).status, 403);
  assert.equal((await request('GET', '/reports/my-reports', { token })).status, 403);

  // Relogin is refused for suspended accounts.
  const relogin = await request('POST', '/auth/login', { body: { email, password: 'Str0ngPass1' } });
  assert.equal(relogin.status, 403, 'suspended account cannot log in');
});

test('account status: suspended user\'s stale token must not attribute report submissions', async () => {
  const adminToken = await login('admin@ecoguard.com', 'admin123');
  const { email, token } = await registerUser('suspattr');
  const uid = await userIdByEmail(adminToken, email);

  const suspend = await request('PUT', `/admin/users/${uid}/status`, {
    token: adminToken,
    body: { status: 'suspended' },
  });
  assert.equal(suspend.status, 200);

  // Submission is a public endpoint; with a stale token it must proceed
  // anonymously — never attributed to the suspended account.
  const submit = await submitReport(token, 'Suspended attribution probe');
  assert.equal(submit.status, 201);
  const { reportId } = await submit.json();

  const track = await request('GET', `/reports/track/${reportId}`);
  assert.equal(track.status, 200);
  assert.equal(track.json.user_id, null, 'suspended user token must not attribute the report');
});

test('account status: disabled user cannot log in and old token fails', async () => {
  const adminToken = await login('admin@ecoguard.com', 'admin123');
  const { email, token } = await registerUser('dis');
  const uid = await userIdByEmail(adminToken, email);

  const disable = await request('PUT', `/admin/users/${uid}/status`, {
    token: adminToken,
    body: { status: 'disabled' },
  });
  assert.equal(disable.status, 200);

  const relogin = await request('POST', '/auth/login', { body: { email, password: 'Str0ngPass1' } });
  assert.equal(relogin.status, 403, 'disabled account cannot log in');

  const prof = await request('GET', '/auth/profile', { token });
  assert.equal(prof.status, 403, 'disabled account token must be rejected');
});

test('account status: reactivating a suspended account restores access', async () => {
  const adminToken = await login('admin@ecoguard.com', 'admin123');
  const { email, token } = await registerUser('react');
  const uid = await userIdByEmail(adminToken, email);

  await request('PUT', `/admin/users/${uid}/status`, { token: adminToken, body: { status: 'suspended' } });
  assert.equal((await request('GET', '/auth/profile', { token })).status, 403);

  const restore = await request('PUT', `/admin/users/${uid}/status`, {
    token: adminToken,
    body: { status: 'active' },
  });
  assert.equal(restore.status, 200);

  const prof = await request('GET', '/auth/profile', { token });
  assert.equal(prof.status, 200, 'restored account token works again');
});

async function userIdByEmail(adminToken, email) {
  const users = await request('GET', '/admin/users', { token: adminToken });
  const row = (users.json || []).find((u) => u.email === email);
  if (!row) throw new Error(`user ${email} not found`);
  return row.id;
}

/* ══════════════════ 4. Protected fields & admin input handling ══════════════════ */

test('admin: role change rejects invalid roles and unknown ids', async () => {
  const adminToken = await login('admin@ecoguard.com', 'admin123');
  for (const role of ['superadmin', 'root', 'ADMIN', 1, null, ['admin'], { role: 'admin' }]) {
    const res = await request('PUT', '/admin/users/2/role', { token: adminToken, body: { role } });
    assert.equal(res.status, 400, `role ${JSON.stringify(role)} must be 400, got ${res.status}`);
  }
  const missing = await request('PUT', '/admin/users/424242/role', {
    token: adminToken,
    body: { role: 'user' },
  });
  assert.equal(missing.status, 404);
});

test('admin: account status rejects unknown values and ids (case-insensitive for known values)', async () => {
  const adminToken = await login('admin@ecoguard.com', 'admin123');
  // Known statuses are lowercased before the allow-list check, so the
  // case-insensitive forms are accepted by design; unknown values are not.
  assert.equal(
    (await request('PUT', '/admin/users/2/status', { token: adminToken, body: { status: 'ACTIVE' } })).status,
    200,
    'ACTIVE is the lowercased known status and is accepted by design'
  );
  for (const status of ['banned', 'deleted', 'Disable', 1, null, ['suspended'], { status: 'active' }]) {
    const res = await request('PUT', '/admin/users/2/status', { token: adminToken, body: { status } });
    assert.equal(res.status, 400, `status ${JSON.stringify(status)} must be 400, got ${res.status}`);
  }
  const missing = await request('PUT', '/admin/users/424242/status', {
    token: adminToken,
    body: { status: 'suspended' },
  });
  assert.equal(missing.status, 404);
});

test('admin: self-demotion and self-suspension are blocked', async () => {
  const adminToken = await login('admin@ecoguard.com', 'admin123');
  const role = await request('PUT', '/admin/users/1/role', { token: adminToken, body: { role: 'user' } });
  assert.equal(role.status, 400, 'self role demotion must be blocked');

  const status = await request('PUT', '/admin/users/1/status', {
    token: adminToken,
    body: { status: 'disabled' },
  });
  assert.equal(status.status, 400, 'self suspension must be blocked');

  // Sanity: the admin account is untouched.
  const prof = await request('GET', '/auth/profile', { token: adminToken });
  assert.equal(prof.status, 200);
  assert.equal(prof.json.role, 'admin');
});

test('admin: report status change accepts only allow-listed statuses', async () => {
  const adminToken = await login('admin@ecoguard.com', 'admin123');
  for (const status of ['WEIRD', 'resolved', 1, null, ['Resolved'], { status: 'Resolved' }]) {
    const res = await request('PUT', '/admin/reports/ECO-2026-00001/status', {
      token: adminToken,
      body: { status },
    });
    assert.equal(res.status, 400, `status ${JSON.stringify(status)} must be 400, got ${res.status}`);
  }
  // Extra fields must not corrupt the update.
  const ok = await request('PUT', '/admin/reports/ECO-2026-00001/status', {
    token: adminToken,
    body: { status: 'Resolved', admin_notes: 'adversarial probe', role: 'admin', user_id: 999 },
  });
  assert.equal(ok.status, 200);
  assert.equal(ok.json.report.status, 'Resolved');
  assert.equal(ok.json.report.user_id, 2, 'protected user_id field must be unchanged');
});

test('admin: audit-log filters reject injection-style values', async () => {
  const adminToken = await login('admin@ecoguard.com', 'admin123');
  const probes = [
    '/admin/audit-log?action=role_change%27%20OR%201%3D1--',
    '/admin/audit-log?target_id=..%2F..%2Fetc',
    '/admin/audit-log?start_date=2030-13-45',
    '/admin/audit-log?admin_id=1%20OR%201%3D1',
    '/admin/audit-log?admin_id%5B%5D=1&admin_id%5B%5D=2',
  ];
  for (const p of probes) {
    const res = await request('GET', p, { token: adminToken });
    assert.equal(res.status, 400, `GET ${p.slice(0, 48)} must be 400, got ${res.status}`);
  }
});

/* ══════════════════ 5. Upload bypass ══════════════════ */

test('upload: traversal-style filename is stored under a safe generated name', async () => {
  const fd = new FormData();
  fd.append('title', 'Traversal filename attempt');
  fd.append('hazard_type', 'Air Pollution');
  fd.append('severity', 'Low');
  fd.append('location', 'Traversal area');
  fd.append('description', 'Client filename must never control the stored path.');
  fd.append('image', new Blob([VALID_PNG], { type: 'image/png' }), '....//....//etc%2Fpasswd.jpg');

  const res = await fetch(`${API}/reports/submit`, { method: 'POST', body: fd });
  assert.equal(res.status, 201, `upload with traversal-style name should be stored safely, got ${res.status}`);
  const { reportId } = await res.json();

  const track = await request('GET', `/reports/track/${reportId}`);
  assert.equal(track.status, 200);
  const imageUrl = track.json.image_url || '';
  assert.ok(!imageUrl.includes('..'), 'stored image_url must not contain traversal sequences');
  assert.match(imageUrl, /^\/uploads\/[^/]+$/, 'image_url must point inside /uploads with a flat filename');
});

test('upload: oversized image is rejected', async () => {
  const big = Buffer.alloc(6 * 1024 * 1024, 0x41); // 6 MB > 5 MB limit
  const fd = new FormData();
  fd.append('title', 'Oversized upload attempt');
  fd.append('hazard_type', 'Air Pollution');
  fd.append('severity', 'Low');
  fd.append('location', 'Size test area');
  fd.append('description', 'A 6 MB file must be rejected.');
  fd.append('image', new Blob([big], { type: 'image/jpeg' }), 'big.jpg');

  const res = await fetch(`${API}/reports/submit`, { method: 'POST', body: fd });
  assert.ok([400, 413].includes(res.status), `oversized upload must be 400/413, got ${res.status}`);
});

test('upload: extra unexpected file fields are rejected', async () => {
  const fd = new FormData();
  fd.append('title', 'Unexpected file field');
  fd.append('hazard_type', 'Air Pollution');
  fd.append('severity', 'Low');
  fd.append('location', 'Field test area');
  fd.append('description', 'Only the image field may carry a file.');
  fd.append('image', new Blob([VALID_PNG], { type: 'image/png' }), 'ok.png');
  fd.append('payload', new Blob([Buffer.from('not an image')], { type: 'application/octet-stream' }), 'evil.bin');

  const res = await fetch(`${API}/reports/submit`, { method: 'POST', body: fd });
  assert.equal(res.status, 400, 'unexpected file field must be rejected');
});

/* ══════════════════ 6. Prototype pollution / mass assignment ══════════════════ */

test('proto pollution: __proto__ keys in the body do not alter Object prototype', async () => {
  const payload = JSON.stringify({
    name: 'Proto Probe',
    email: `proto-${crypto.randomBytes(4).toString('hex')}@ecoguard.com`,
    password: 'Str0ngPass1',
    __proto__: { role: 'admin', admin: true },
  });
  const res = await fetch(`${API}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: payload,
  });
  assert.ok([201, 400].includes(res.status), `register with __proto__ must be 201/400, got ${res.status}`);
  if (res.status === 201) {
    const body = await res.json();
    assert.equal(body.user.role, 'user', 'role must stay user');
  }
  assert.equal(({}).role, undefined, 'Object prototype must not gain a role property');
  assert.equal(({}).admin, undefined, 'Object instances must not gain an admin flag');
});

test('proto pollution: qs-style nested query param is not materialized as an object', async () => {
  const res = await request('GET', '/reports?user%5Brole%5D=admin');
  assert.ok([200, 400].includes(res.status), `qs-style query must be handled safely, got ${res.status}`);
});

test('proto pollution: object elements in quiz answers are rejected', async () => {
  const res = await request('POST', '/quiz/1/submit', {
    body: { answers: [{ __proto__: { isAdmin: true } }] },
  });
  assert.equal(res.status, 400, 'object elements in answers must be 400');
});

test('mass assignment: registration cannot grant admin role or set status', async () => {
  const email = `massassign-${crypto.randomBytes(4).toString('hex')}@ecoguard.com`;
  const res = await request('POST', '/auth/register', {
    body: { name: 'Mass Assign Probe', email, password: 'Str0ngPass1', role: 'admin', status: 'active' },
  });
  assert.equal(res.status, 201);
  assert.equal(res.json.user.role, 'user', 'role must be forced to user');
});

/* ══════════════════ 7. Information leak / error handling ══════════════════ */

test('info leak: error responses never contain stack traces, SQL or filesystem paths', async () => {
  const adminToken = await login('admin@ecoguard.com', 'admin123');
  const probes = [
    ['GET', '/hazards/1%2F..%2F..%2Fetc%2Fpasswd'],
    ['GET', '/hazards/%00'],
    ['GET', '/admin/audit-log?start_date=not-a-date'],
    ['GET', '/reports/track/DROP%2520TABLE'],
  ];
  for (const [method, p] of probes) {
    const res = await request(method, p, { token: adminToken });
    const text = JSON.stringify(res.json || {});
    assert.ok(!/at .+ \(.*:\d+:\d+\)/.test(text), `no stack trace for ${p}`);
    assert.ok(!/SELECT |INSERT |UPDATE |DELETE FROM/i.test(text), `no SQL for ${p}`);
    assert.ok(!/[A-Za-z]:\\|\/home\/|\/Users\/|\/var\/www/.test(text), `no filesystem paths for ${p}`);
  }
});

test('info leak: login response never contains password material', async () => {
  const res = await request('POST', '/auth/login', {
    body: { email: 'user@ecoguard.com', password: 'user123' },
  });
  assert.equal(res.status, 200);
  assert.equal(res.json.user.password, undefined, 'password key absent from user object');
  assert.ok(!/\$2[aby]\$/.test(JSON.stringify(res.json)), 'no bcrypt hash in login response');
});

test('info leak: profile response contains only public columns', async () => {
  const { token } = await registerUser('pubcols');
  const res = await request('GET', '/auth/profile', { token });
  assert.equal(res.status, 200);
  const allowed = new Set(['id', 'name', 'email', 'role', 'profile_image', 'theme', 'created_at']);
  for (const key of Object.keys(res.json)) {
    assert.ok(allowed.has(key), `unexpected profile key: ${key}`);
  }
});

test('info leak: public reports list never includes hashes or tokens', async () => {
  const res = await request('GET', '/reports');
  assert.equal(res.status, 200);
  const serialized = JSON.stringify(res.json);
  assert.ok(!/\$2[aby]\$/.test(serialized), 'no bcrypt hashes in reports list');
  assert.ok(!/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\./.test(serialized), 'no JWTs in reports list');
});

test('info leak: suspended-admin probe — demoted admin loses admin access', async () => {
  const adminToken = await login('admin@ecoguard.com', 'admin123');
  const { email, token } = await registerUser('demote-target');

  // Promote, verify admin access, then demote: the DB-backed middleware must
  // cut access on the next request even though the token is untouched.
  const uid = await userIdByEmail(adminToken, email);
  const promote = await request('PUT', `/admin/users/${uid}/role`, {
    token: adminToken,
    body: { role: 'admin' },
  });
  assert.equal(promote.status, 200);
  assert.equal((await request('GET', '/admin/users', { token })).status, 200, 'new admin can read users');

  const demote = await request('PUT', `/admin/users/${uid}/role`, {
    token: adminToken,
    body: { role: 'user' },
  });
  assert.equal(demote.status, 200);
  assert.equal(
    (await request('GET', '/admin/users', { token })).status,
    403,
    'demoted admin must lose access immediately (stale token, new DB role)'
  );
});

/* ══════════════════ 8. Server stability after the assault ══════════════════ */

test('stability: server remains healthy after all adversarial probes', async () => {
  const res = await fetch(`${API}/health`);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.status, 'ok');
});
