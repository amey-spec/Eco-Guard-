import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, execFileSync } from 'node:child_process';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

/**
 * Tests for password reset and account deletion features.
 * Each test group uses its own throwaway server+DB to avoid rate limiter
 * state contamination across tests.
 */

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SERVER_DIR = path.resolve(__dirname, '..');

function scratchDb(label) {
  return path.join(
    os.tmpdir(),
    `ecoguard-auth-${label}-${process.pid}-${crypto.randomBytes(4).toString('hex')}.sqlite`
  );
}

function makeEmail(prefix) {
  return `${prefix}-${crypto.randomBytes(3).toString('hex')}@ecoguard.com`;
}

function makeApi(baseUrl) {
  return async function request(method, pathname, { token, body } = {}) {
    const res = await fetch(`${baseUrl}${pathname}`, {
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
  };
}

async function seedDatabase(dbFile) {
  execFileSync(process.execPath, ['scripts/seed.js'], {
    cwd: SERVER_DIR,
    env: { ...process.env, DATABASE_PATH: dbFile },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

function startServer(dbFile, port) {
  const serverProcess = spawn(process.execPath, ['index.js'], {
    cwd: SERVER_DIR,
    env: {
      ...process.env,
      PORT: String(port),
      DATABASE_PATH: dbFile,
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

async function login(api, email, password) {
  const { status, json } = await api('POST', '/auth/login', { body: { email, password } });
  assert.equal(status, 200, `login for ${email} should succeed`);
  assert.ok(json && typeof json.token === 'string' && json.token.length > 0, 'login returns a token');
  return json.token;
}

// ─── Password Reset Tests (own server instance) ──────────────────────────────

test('forgot-password with a registered email returns a reset token (dev mode)', async () => {
  const db = scratchDb('reset-email');
  seedDatabase(db);
  const port = 5330;
  const { serverProcess, logs } = startServer(db, port);
  const api = makeApi(`http://localhost:${port}/api`);
  await waitForHealth(serverProcess, logs, port);

  try {
    const email = makeEmail('reset-test');
    await api('POST', '/auth/register', {
      body: { name: 'Reset Test User', email, password: 'T3stP@ss123!' },
    });

    const { status, json } = await api('POST', '/auth/forgot-password', {
      body: { email },
    });
    assert.equal(status, 200);
    assert.equal(json.message, 'If an account with that email exists, a reset link has been sent.');
    assert.ok(json.resetToken, 'reset token should be present in dev mode');
    assert.equal(typeof json.resetToken, 'string');
    assert.ok(json.resetToken.length > 0);
  } finally {
    serverProcess.kill();
    await new Promise((r) => { if (serverProcess.exitCode !== null) return r(); serverProcess.once('exit', r); setTimeout(r, 5000); });
    try { await import('node:fs/promises').then((fs) => fs.unlink(db)); } catch {}
  }
});

test('forgot-password with an unregistered email returns a generic response (no enumeration)', async () => {
  const db = scratchDb('reset-enum');
  seedDatabase(db);
  const port = 5331;
  const { serverProcess, logs } = startServer(db, port);
  const api = makeApi(`http://localhost:${port}/api`);
  await waitForHealth(serverProcess, logs, port);

  try {
    const { status, json } = await api('POST', '/auth/forgot-password', {
      body: { email: 'noone@ecoguard.com' },
    });
    assert.equal(status, 200);
    assert.equal(json.message, 'If an account with that email exists, a reset link has been sent.');
    assert.equal(json.resetToken, undefined, 'no reset token for unregistered email');
  } finally {
    serverProcess.kill();
    await new Promise((r) => { if (serverProcess.exitCode !== null) return r(); serverProcess.once('exit', r); setTimeout(r, 5000); });
    try { await import('node:fs/promises').then((fs) => fs.unlink(db)); } catch {}
  }
});

test('forgot-password with an invalid email returns 400', async () => {
  const db = scratchDb('reset-invalid');
  seedDatabase(db);
  const port = 5332;
  const { serverProcess, logs } = startServer(db, port);
  const api = makeApi(`http://localhost:${port}/api`);
  await waitForHealth(serverProcess, logs, port);

  try {
    const { status, json } = await api('POST', '/auth/forgot-password', {
      body: { email: 'not-an-email' },
    });
    assert.equal(status, 400);
    assert.ok(json.error);
  } finally {
    serverProcess.kill();
    await new Promise((r) => { if (serverProcess.exitCode !== null) return r(); serverProcess.once('exit', r); setTimeout(r, 5000); });
    try { await import('node:fs/promises').then((fs) => fs.unlink(db)); } catch {}
  }
});

test('forgot-password with a missing email returns 400', async () => {
  const db = scratchDb('reset-missing');
  seedDatabase(db);
  const port = 5333;
  const { serverProcess, logs } = startServer(db, port);
  const api = makeApi(`http://localhost:${port}/api`);
  await waitForHealth(serverProcess, logs, port);

  try {
    const { status, json } = await api('POST', '/auth/forgot-password', {
      body: {},
    });
    assert.equal(status, 400);
    assert.ok(json.error);
  } finally {
    serverProcess.kill();
    await new Promise((r) => { if (serverProcess.exitCode !== null) return r(); serverProcess.once('exit', r); setTimeout(r, 5000); });
    try { await import('node:fs/promises').then((fs) => fs.unlink(db)); } catch {}
  }
});

test('reset-password with a valid token and new password succeeds', async () => {
  const db = scratchDb('reset-valid');
  seedDatabase(db);
  const port = 5334;
  const { serverProcess, logs } = startServer(db, port);
  const api = makeApi(`http://localhost:${port}/api`);
  await waitForHealth(serverProcess, logs, port);

  try {
    const email = makeEmail('reset-full');
    await api('POST', '/auth/register', {
      body: { name: 'Full Reset User', email, password: 'T3stP@ss123!' },
    });

    // Request a reset token.
    const forgotRes = await api('POST', '/auth/forgot-password', {
      body: { email },
    });
    assert.equal(forgotRes.status, 200);
    const token = forgotRes.json.resetToken;
    assert.ok(token);

    // Reset the password.
    const newPassword = 'N3wSecureP@ss!';
    const { status, json } = await api('POST', '/auth/reset-password', {
      body: { token, new_password: newPassword },
    });
    assert.equal(status, 200);
    assert.equal(json.success, true);
    assert.equal(json.message, 'Your password has been reset — use your new password to sign in.');
  } finally {
    serverProcess.kill();
    await new Promise((r) => { if (serverProcess.exitCode !== null) return r(); serverProcess.once('exit', r); setTimeout(r, 5000); });
    try { await import('node:fs/promises').then((fs) => fs.unlink(db)); } catch {}
  }
});

test('reset-password with the same token twice fails (single-use)', async () => {
  const db = scratchDb('reset-single');
  seedDatabase(db);
  const port = 5335;
  const { serverProcess, logs } = startServer(db, port);
  const api = makeApi(`http://localhost:${port}/api`);
  await waitForHealth(serverProcess, logs, port);

  try {
    const email = makeEmail('reset-single');
    await api('POST', '/auth/register', {
      body: { name: 'Single Use User', email, password: 'T3stP@ss123!' },
    });

    // Request a token.
    const forgotRes = await api('POST', '/auth/forgot-password', {
      body: { email },
    });
    const token = forgotRes.json.resetToken;

    // Use it once.
    const firstRes = await api('POST', '/auth/reset-password', {
      body: { token, new_password: 'F1rstN3wP@ss!' },
    });
    assert.equal(firstRes.status, 200);

    // Try to use it again.
    const { status, json } = await api('POST', '/auth/reset-password', {
      body: { token, new_password: 'S3condN3wP@ss!' },
    });
    assert.equal(status, 400);
    assert.ok(json.error);
    assert.match(json.error, /no longer valid/i);
  } finally {
    serverProcess.kill();
    await new Promise((r) => { if (serverProcess.exitCode !== null) return r(); serverProcess.once('exit', r); setTimeout(r, 5000); });
    try { await import('node:fs/promises').then((fs) => fs.unlink(db)); } catch {}
  }
});

test('reset-password with an invalid token fails', async () => {
  const db = scratchDb('reset-invalid-token');
  seedDatabase(db);
  const port = 5336;
  const { serverProcess, logs } = startServer(db, port);
  const api = makeApi(`http://localhost:${port}/api`);
  await waitForHealth(serverProcess, logs, port);

  try {
    const { status, json } = await api('POST', '/auth/reset-password', {
      body: { token: 'invalid-token-12345', new_password: 'N3wSecureP@ss!' },
    });
    assert.equal(status, 400);
    assert.ok(json.error);
    assert.match(json.error, /no longer valid/i);
  } finally {
    serverProcess.kill();
    await new Promise((r) => { if (serverProcess.exitCode !== null) return r(); serverProcess.once('exit', r); setTimeout(r, 5000); });
    try { await import('node:fs/promises').then((fs) => fs.unlink(db)); } catch {}
  }
});

test('reset-password with a weak password fails validation', async () => {
  const db = scratchDb('reset-weak');
  seedDatabase(db);
  const port = 5337;
  const { serverProcess, logs } = startServer(db, port);
  const api = makeApi(`http://localhost:${port}/api`);
  await waitForHealth(serverProcess, logs, port);

  try {
    const email = makeEmail('reset-weak');
    await api('POST', '/auth/register', {
      body: { name: 'Weak Pass User', email, password: 'T3stP@ss123!' },
    });

    const forgotRes = await api('POST', '/auth/forgot-password', {
      body: { email },
    });
    const token = forgotRes.json.resetToken;

    const { status, json } = await api('POST', '/auth/reset-password', {
      body: { token, new_password: 'weak' },
    });
    assert.equal(status, 400);
    assert.match(json.error, /password/i);
  } finally {
    serverProcess.kill();
    await new Promise((r) => { if (serverProcess.exitCode !== null) return r(); serverProcess.once('exit', r); setTimeout(r, 5000); });
    try { await import('node:fs/promises').then((fs) => fs.unlink(db)); } catch {}
  }
});

test('reset-password with a short password fails validation', async () => {
  const db = scratchDb('reset-short');
  seedDatabase(db);
  const port = 5338;
  const { serverProcess, logs } = startServer(db, port);
  const api = makeApi(`http://localhost:${port}/api`);
  await waitForHealth(serverProcess, logs, port);

  try {
    const email = makeEmail('reset-short');
    await api('POST', '/auth/register', {
      body: { name: 'Short Pass User', email, password: 'T3stP@ss123!' },
    });

    const forgotRes = await api('POST', '/auth/forgot-password', {
      body: { email },
    });
    const token = forgotRes.json.resetToken;

    const { status, json } = await api('POST', '/auth/reset-password', {
      body: { token, new_password: 'Ab1' },
    });
    assert.equal(status, 400);
    assert.match(json.error, /8 characters/i);
  } finally {
    serverProcess.kill();
    await new Promise((r) => { if (serverProcess.exitCode !== null) return r(); serverProcess.once('exit', r); setTimeout(r, 5000); });
    try { await import('node:fs/promises').then((fs) => fs.unlink(db)); } catch {}
  }
});

test('reset-password without a token fails', async () => {
  const db = scratchDb('reset-notoken');
  seedDatabase(db);
  const port = 5339;
  const { serverProcess, logs } = startServer(db, port);
  const api = makeApi(`http://localhost:${port}/api`);
  await waitForHealth(serverProcess, logs, port);

  try {
    const { status, json } = await api('POST', '/auth/reset-password', {
      body: { new_password: 'N3wSecureP@ss!' },
    });
    assert.equal(status, 400);
    assert.match(json.error, /reset token/i);
  } finally {
    serverProcess.kill();
    await new Promise((r) => { if (serverProcess.exitCode !== null) return r(); serverProcess.once('exit', r); setTimeout(r, 5000); });
    try { await import('node:fs/promises').then((fs) => fs.unlink(db)); } catch {}
  }
});

test('password reset invalidates the old password and allows login with new password', async () => {
  const db = scratchDb('reset-login');
  seedDatabase(db);
  const port = 5340;
  const { serverProcess, logs } = startServer(db, port);
  const api = makeApi(`http://localhost:${port}/api`);
  await waitForHealth(serverProcess, logs, port);

  try {
    const email = makeEmail('reset-login');
    const initialPassword = 'T3stP@ss123!';
    await api('POST', '/auth/register', {
      body: { name: 'Login Reset User', email, password: initialPassword },
    });

    // Request a reset token.
    const forgotRes = await api('POST', '/auth/forgot-password', {
      body: { email },
    });
    const token = forgotRes.json.resetToken;

    // Reset to a new password.
    const newPassword = 'N3wSecureP@ss!';
    await api('POST', '/auth/reset-password', {
      body: { token, new_password: newPassword },
    });

    // Old password should no longer work.
    const oldLogin = await api('POST', '/auth/login', {
      body: { email, password: initialPassword },
    });
    assert.equal(oldLogin.status, 401);

    // New password should work.
    const newLogin = await api('POST', '/auth/login', {
      body: { email, password: newPassword },
    });
    assert.equal(newLogin.status, 200);
    assert.ok(newLogin.json.token);
  } finally {
    serverProcess.kill();
    await new Promise((r) => { if (serverProcess.exitCode !== null) return r(); serverProcess.once('exit', r); setTimeout(r, 5000); });
    try { await import('node:fs/promises').then((fs) => fs.unlink(db)); } catch {}
  }
});

test('forgot-password rate limiting kicks in after 5 requests from same IP', async () => {
  const db = scratchDb('reset-ratelimit');
  seedDatabase(db);
  const port = 5341;
  const { serverProcess, logs } = startServer(db, port);
  const api = makeApi(`http://localhost:${port}/api`);
  await waitForHealth(serverProcess, logs, port);

  try {
    // Make 5 successful requests with unique, freshly registered emails.
    for (let i = 0; i < 5; i++) {
      const email = makeEmail(`rate-${i}`);
      await api('POST', '/auth/register', {
        body: { name: `Rate Test ${i}`, email, password: 'T3stP@ss123!' },
      });

      const { status } = await api('POST', '/auth/forgot-password', {
        body: { email },
      });
      assert.equal(status, 200);
    }

    // 6th request should be rate-limited.
    const { status, json } = await api('POST', '/auth/forgot-password', {
      body: { email: makeEmail('rate-limit') },
    });
    assert.equal(status, 429);
    assert.ok(json.error);
    assert.match(json.error, /too many/i);
  } finally {
    serverProcess.kill();
    await new Promise((r) => { if (serverProcess.exitCode !== null) return r(); serverProcess.once('exit', r); setTimeout(r, 5000); });
    try { await import('node:fs/promises').then((fs) => fs.unlink(db)); } catch {}
  }
});

// ─── Account Deletion Tests (own server instance) ────────────────────────────

test('authenticated user can delete their own account with correct password', async () => {
  const db = scratchDb('delete-own');
  seedDatabase(db);
  const port = 5342;
  const { serverProcess, logs } = startServer(db, port);
  const api = makeApi(`http://localhost:${port}/api`);
  await waitForHealth(serverProcess, logs, port);

  try {
    const email = makeEmail('delete-test');
    await api('POST', '/auth/register', {
      body: { name: 'Delete Test User', email, password: 'T3stP@ss123!' },
    });

    const token = await login(api, email, 'T3stP@ss123!');

    // Verify the user exists before deletion.
    const profileBefore = await api('GET', '/auth/profile', { token });
    assert.equal(profileBefore.status, 200);
    assert.equal(profileBefore.json.email, email);

    // Delete the account.
    const { status, json } = await api('DELETE', '/auth/account', {
      token,
      body: { current_password: 'T3stP@ss123!' },
    });
    assert.equal(status, 200);
    assert.equal(json.success, true);
    assert.match(json.message, /deleted/i);
  } finally {
    serverProcess.kill();
    await new Promise((r) => { if (serverProcess.exitCode !== null) return r(); serverProcess.once('exit', r); setTimeout(r, 5000); });
    try { await import('node:fs/promises').then((fs) => fs.unlink(db)); } catch {}
  }
});

test('account deletion requires current password', async () => {
  const db = scratchDb('delete-nopw');
  seedDatabase(db);
  const port = 5343;
  const { serverProcess, logs } = startServer(db, port);
  const api = makeApi(`http://localhost:${port}/api`);
  await waitForHealth(serverProcess, logs, port);

  try {
    const email = makeEmail('delete-no-pw');
    await api('POST', '/auth/register', {
      body: { name: 'No Password User', email, password: 'T3stP@ss123!' },
    });

    const token = await login(api, email, 'T3stP@ss123!');

    const { status, json } = await api('DELETE', '/auth/account', {
      token,
      body: {},
    });
    assert.equal(status, 400);
    assert.match(json.error, /current password/i);
  } finally {
    serverProcess.kill();
    await new Promise((r) => { if (serverProcess.exitCode !== null) return r(); serverProcess.once('exit', r); setTimeout(r, 5000); });
    try { await import('node:fs/promises').then((fs) => fs.unlink(db)); } catch {}
  }
});

test('account deletion fails with wrong password', async () => {
  const db = scratchDb('delete-wrongpw');
  seedDatabase(db);
  const port = 5344;
  const { serverProcess, logs } = startServer(db, port);
  const api = makeApi(`http://localhost:${port}/api`);
  await waitForHealth(serverProcess, logs, port);

  try {
    const email = makeEmail('delete-wrong-pw');
    await api('POST', '/auth/register', {
      body: { name: 'Wrong Password User', email, password: 'T3stP@ss123!' },
    });

    const token = await login(api, email, 'T3stP@ss123!');

    const { status, json } = await api('DELETE', '/auth/account', {
      token,
      body: { current_password: 'wrong-password' },
    });
    assert.equal(status, 401);
    assert.match(json.error, /incorrect/i);
  } finally {
    serverProcess.kill();
    await new Promise((r) => { if (serverProcess.exitCode !== null) return r(); serverProcess.once('exit', r); setTimeout(r, 5000); });
    try { await import('node:fs/promises').then((fs) => fs.unlink(db)); } catch {}
  }
});

test('deleted account cannot log in', async () => {
  const db = scratchDb('delete-login');
  seedDatabase(db);
  const port = 5345;
  const { serverProcess, logs } = startServer(db, port);
  const api = makeApi(`http://localhost:${port}/api`);
  await waitForHealth(serverProcess, logs, port);

  try {
    const email = makeEmail('delete-login');
    await api('POST', '/auth/register', {
      body: { name: 'Login Delete User', email, password: 'T3stP@ss123!' },
    });

    const token = await login(api, email, 'T3stP@ss123!');

    // Delete the account.
    await api('DELETE', '/auth/account', {
      token,
      body: { current_password: 'T3stP@ss123!' },
    });

    // Try to log in. The account's password hash was replaced with an
    // unusable random hash, so the credentials no longer verify and the
    // response is the generic 401 — identical to any unknown account, with
    // no hint that the account ever existed (no enumeration leak).
    const { status } = await api('POST', '/auth/login', {
      body: { email, password: 'T3stP@ss123!' },
    });
    assert.equal(status, 401);
  } finally {
    serverProcess.kill();
    await new Promise((r) => { if (serverProcess.exitCode !== null) return r(); serverProcess.once('exit', r); setTimeout(r, 5000); });
    try { await import('node:fs/promises').then((fs) => fs.unlink(db)); } catch {}
  }
});

test('deleted account profile is no longer accessible', async () => {
  const db = scratchDb('delete-profile');
  seedDatabase(db);
  const port = 5346;
  const { serverProcess, logs } = startServer(db, port);
  const api = makeApi(`http://localhost:${port}/api`);
  await waitForHealth(serverProcess, logs, port);

  try {
    const email = makeEmail('delete-profile');
    await api('POST', '/auth/register', {
      body: { name: 'Profile Delete User', email, password: 'T3stP@ss123!' },
    });

    const token = await login(api, email, 'T3stP@ss123!');

    // Delete the account.
    await api('DELETE', '/auth/account', {
      token,
      body: { current_password: 'T3stP@ss123!' },
    });

    // The old token should no longer work for profile access.
    const { status, json } = await api('GET', '/auth/profile', { token });
    assert.equal(status, 403);
    assert.match(json.error, /not active/i);
  } finally {
    serverProcess.kill();
    await new Promise((r) => { if (serverProcess.exitCode !== null) return r(); serverProcess.once('exit', r); setTimeout(r, 5000); });
    try { await import('node:fs/promises').then((fs) => fs.unlink(db)); } catch {}
  }
});

test('account deletion preserves user record for audit (admin can still see disabled user)', async () => {
  const db = scratchDb('delete-audit');
  seedDatabase(db);
  const port = 5347;
  const { serverProcess, logs } = startServer(db, port);
  const api = makeApi(`http://localhost:${port}/api`);
  await waitForHealth(serverProcess, logs, port);

  try {
    const demoAdminToken = await login(api, 'admin@ecoguard.com', 'admin123');

    const deleteEmail = makeEmail('delete-audit');
    await api('POST', '/auth/register', {
      body: { name: 'Audit Delete User', email: deleteEmail, password: 'T3stP@ss123!' },
    });

    const userToken = await login(api, deleteEmail, 'T3stP@ss123!');

    // Delete the account.
    const deleteRes = await api('DELETE', '/auth/account', {
      token: userToken,
      body: { current_password: 'T3stP@ss123!' },
    });
    assert.equal(deleteRes.status, 200);
    assert.equal(deleteRes.json.success, true);

    // Admin should still be able to see the user (as disabled) in the user list.
    const users = await api('GET', '/admin/users', { token: demoAdminToken });
    assert.equal(users.status, 200);
    const deletedUser = users.json.find((u) => u.email === deleteEmail);
    assert.ok(deletedUser);
    assert.equal(deletedUser.status, 'disabled');
  } finally {
    serverProcess.kill();
    await new Promise((r) => { if (serverProcess.exitCode !== null) return r(); serverProcess.once('exit', r); setTimeout(r, 5000); });
    try { await import('node:fs/promises').then((fs) => fs.unlink(db)); } catch {}
  }
});

test('account deletion records a security event (visible to admins)', async () => {
  const db = scratchDb('delete-audit-event');
  seedDatabase(db);
  const port = 5348;
  const { serverProcess, logs } = startServer(db, port);
  const api = makeApi(`http://localhost:${port}/api`);
  await waitForHealth(serverProcess, logs, port);

  try {
    const demoAdminToken = await login(api, 'admin@ecoguard.com', 'admin123');

    // Count existing account_deleted security events.
    const eventsBefore = await api('GET', '/admin/security-events?limit=200', { token: demoAdminToken });
    assert.equal(eventsBefore.status, 200);
    const deletedBefore = (eventsBefore.json.events || []).filter((e) => e.event_type === 'account_deleted').length;

    // Delete a fresh user.
    const deleteEmail = makeEmail('delete-audit-event');
    await api('POST', '/auth/register', {
      body: { name: 'Audit Event User', email: deleteEmail, password: 'T3stP@ss123!' },
    });

    const userToken = await login(api, deleteEmail, 'T3stP@ss123!');

    // Delete the account.
    await api('DELETE', '/auth/account', {
      token: userToken,
      body: { current_password: 'T3stP@ss123!' },
    });

    // Check the security event log has a new account_deleted entry.
    const eventsAfter = await api('GET', '/admin/security-events?limit=200', { token: demoAdminToken });
    assert.equal(eventsAfter.status, 200);
    const deletedAfter = (eventsAfter.json.events || []).filter((e) => e.event_type === 'account_deleted').length;
    assert.ok(
      deletedAfter >= deletedBefore + 1,
      'security_events should contain a new account_deleted entry'
    );
  } finally {
    serverProcess.kill();
    await new Promise((r) => { if (serverProcess.exitCode !== null) return r(); serverProcess.once('exit', r); setTimeout(r, 5000); });
    try { await import('node:fs/promises').then((fs) => fs.unlink(db)); } catch {}
  }
});
