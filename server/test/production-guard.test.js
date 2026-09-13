import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn, spawnSync, execFileSync } from 'node:child_process';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { unlinkSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/**
 * Verifies the server's production startup guards:
 *  1. NODE_ENV=production refuses to boot without a strong JWT_SECRET.
 *  2. NODE_ENV=production refuses to boot when the default demo admin account
 *     is still live with its predictable password (seed data).
 *  3. NODE_ENV=production boots and serves once a strong, ephemeral secret is
 *     provided against a clean database.
 *
 * Each scenario uses its own throwaway DATABASE_PATH, so the development
 * database is never touched. Secrets are generated at runtime — nothing is
 * committed or printed.
 */

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SERVER_DIR = path.resolve(__dirname, '..');
const HEALTH_PORT = 5324;
const HEALTH_URL = `http://localhost:${HEALTH_PORT}/api/health`;

function scratchDb(label) {
  return path.join(
    os.tmpdir(),
    `ecoguard-guard-${label}-${process.pid}-${crypto.randomBytes(4).toString('hex')}.sqlite`
  );
}

function strongSecret() {
  return crypto.randomBytes(48).toString('base64url');
}

function seedInto(dbFile) {
  execFileSync(process.execPath, ['scripts/seed.js'], {
    cwd: SERVER_DIR,
    env: { ...process.env, DATABASE_PATH: dbFile },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

/** Runs `node index.js` to completion and returns { status, stderr }. */
function runToExit(env) {
  const r = spawnSync(process.execPath, ['index.js'], {
    cwd: SERVER_DIR,
    env: { ...process.env, ...env },
    encoding: 'utf8',
    timeout: 20000,
  });
  return { status: r.status, stderr: r.stderr || '' };
}

async function waitForHealth(timeoutMs = 20000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(HEALTH_URL);
      if (res.ok) return;
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new Error('production server did not become healthy in time');
}

function cleanup(...files) {
  for (const f of files) {
    try {
      unlinkSync(f);
    } catch {
      // best-effort
    }
  }
}

test('production refuses to boot without a JWT_SECRET', () => {
  const db = scratchDb('nosecret');
  try {
    const { status, stderr } = runToExit({
      NODE_ENV: 'production',
      DATABASE_PATH: db,
      JWT_SECRET: '',
    });
    assert.notEqual(status, 0, 'boot without a secret must fail');
    assert.match(stderr, /JWT_SECRET/, 'error should mention JWT_SECRET');
  } finally {
    cleanup(db);
  }
});

test('production refuses to boot while the default demo admin is live', () => {
  const db = scratchDb('demoadmin');
  try {
    seedInto(db);
    const { status, stderr } = runToExit({
      NODE_ENV: 'production',
      DATABASE_PATH: db,
      JWT_SECRET: strongSecret(),
    });
    assert.notEqual(status, 0, 'boot with a live default demo admin must fail');
    assert.match(stderr, /demo admin/i, 'error should mention the demo admin');
  } finally {
    cleanup(db);
  }
});

test('production boots and serves with a strong ephemeral secret on a clean DB', async () => {
  const db = scratchDb('healthy');
  let child = null;
  try {
    child = spawn(process.execPath, ['index.js'], {
      cwd: SERVER_DIR,
      env: {
        ...process.env,
        NODE_ENV: 'production',
        PORT: String(HEALTH_PORT),
        DATABASE_PATH: db,
        JWT_SECRET: strongSecret(),
      },
      stdio: ['ignore', 'ignore', 'pipe'],
    });
    let stderr = '';
    child.stderr.on('data', (d) => (stderr += d));
    await waitForHealth();
    const res = await fetch(HEALTH_URL);
    assert.equal(res.status, 200);
    child.kill();
    await new Promise((resolve) => {
      if (child.exitCode !== null) return resolve();
      child.once('exit', resolve);
      setTimeout(resolve, 5000);
    });
    child = null;
    assert.doesNotMatch(stderr, /Failed to start server/, 'no startup errors expected');
  } finally {
    if (child) child.kill();
    cleanup(db);
  }
});
