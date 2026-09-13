import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, execFileSync } from 'node:child_process';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

/**
 * Boots the real EcoGuard API against a throwaway, freshly seeded SQLite
 * database (DATABASE_PATH) and verifies security-relevant behaviour end to end
 * over HTTP. Nothing here touches the development database, and no token,
 * password, hash or secret value is ever printed — only statuses/shapes.
 */

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SERVER_DIR = path.resolve(__dirname, '..');
const PORT = 5321;
const DB_FILE = path.join(
  os.tmpdir(),
  `ecoguard-smoke-${process.pid}-${crypto.randomBytes(4).toString('hex')}.sqlite`
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

async function request(method, pathname, { token, body } = {}) {
  const res = await fetch(`${API}${pathname}`, {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
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
  assert.ok(json && typeof json.token === 'string' && json.token.length > 0, 'login returns a token');
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

test('health endpoint responds', async () => {
  const res = await fetch(`${API}/health`);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.status, 'ok');
});

test('demo admin and user can log in; wrong password is rejected', async () => {
  await login('admin@ecoguard.com', 'admin123');
  await login('user@ecoguard.com', 'user123');

  const bad = await request('POST', '/auth/login', {
    body: { email: 'user@ecoguard.com', password: 'definitely-wrong' },
  });
  assert.equal(bad.status, 401);
});

test('unauthenticated requests are rejected with 401', async () => {
  for (const p of ['/notifications', '/admin/users', '/admin/audit-log']) {
    const { status } = await request('GET', p);
    assert.equal(status, 401, `${p} without a token should be 401`);
  }
});

test('normal users cannot access admin endpoints (403, no client-role bypass)', async () => {
  const userToken = await login('user@ecoguard.com', 'user123');
  for (const p of ['/admin/users', '/admin/audit-log', '/admin/security-events']) {
    const { status } = await request('GET', p, { token: userToken });
    assert.equal(status, 403, `${p} as a normal user should be 403`);
  }
  // Client-supplied role claims must not grant admin access.
  const { status } = await request('GET', '/admin/users', {
    token: userToken,
  });
  assert.equal(status, 403);
});

test('admin can read users, audit log and security events', async () => {
  const adminToken = await login('admin@ecoguard.com', 'admin123');

  const users = await request('GET', '/admin/users', { token: adminToken });
  assert.equal(users.status, 200);
  assert.ok(Array.isArray(users.json));

  const audit = await request('GET', '/admin/audit-log', { token: adminToken });
  assert.equal(audit.status, 200);
  assert.ok(Array.isArray(audit.json.entries));
  assert.equal(typeof audit.json.total, 'number');

  const events = await request('GET', '/admin/security-events', { token: adminToken });
  assert.equal(events.status, 200);
  assert.ok(Array.isArray(events.json.events));
  assert.equal(typeof events.json.total, 'number');
});

test('suspended accounts cannot log in; reactivation restores access', async () => {
  const adminToken = await login('admin@ecoguard.com', 'admin123');

  // user@ecoguard.com is seeded with id 2.
  const suspend = await request('PUT', '/admin/users/2/status', {
    token: adminToken,
    body: { status: 'suspended' },
  });
  assert.equal(suspend.status, 200);

  const denied = await request('POST', '/auth/login', {
    body: { email: 'user@ecoguard.com', password: 'user123' },
  });
  assert.equal(denied.status, 403, 'suspended account must not authenticate');

  const reactivate = await request('PUT', '/admin/users/2/status', {
    token: adminToken,
    body: { status: 'active' },
  });
  assert.equal(reactivate.status, 200);

  await login('user@ecoguard.com', 'user123');
});

test('admin self-lockout is prevented', async () => {
  const adminToken = await login('admin@ecoguard.com', 'admin123');
  const res = await request('PUT', '/admin/users/1/status', {
    token: adminToken,
    body: { status: 'disabled' },
  });
  assert.equal(res.status, 400, 'admin must not disable their own account');
});

test('unknown API routes return JSON 404', async () => {
  const res = await fetch(`${API}/no-such-endpoint`);
  assert.equal(res.status, 404);
  const body = await res.json();
  assert.ok(body.error);
});
