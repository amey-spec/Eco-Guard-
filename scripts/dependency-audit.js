#!/usr/bin/env node
'use strict';

/*
 * EcoGuard dependency vulnerability policy checker.
 *
 * Wraps `npm audit` with an explicit, documented policy and turns it into a
 * CI gate. Usage:
 *
 *   node scripts/dependency-audit.js <client|server>
 *
 * POLICY
 * ------
 * 1. A run is BLOCKED (exit 1) when a HIGH or CRITICAL vulnerability exists in
 *    the PRODUCTION tree (npm audit --omit=dev) and is not covered by an
 *    unexpired entry in <package-dir>/dependency-audit-allowlist.json.
 * 2. High/critical findings that appear ONLY in the development tree are
 *    reported as loud warnings but do NOT block: dev/build tooling does not
 *    ship to the running service.
 * 3. LOW and MODERATE findings never block; they are printed as warnings so
 *    drift toward the high/critical threshold stays visible.
 * 4. Allowlist entries are scoped by package name and expire (`until`); an
 *    expired entry BLOCKS, forcing a re-review (e.g. "did sqlite3@6 land?").
 *    Optionally an entry lists specific `advisories` (GHSA ids); if the audit
 *    reports an advisory id for that package that is NOT listed, the run
 *    BLOCKS — so a NEW CVE in an already-known package still fails CI.
 *
 * The allowlist exists solely to track findings that are genuinely blocked by
 * upstream packages (no non-major fix exists). Re-adding an entry that npm
 * could actually fix non-major would be a policy violation.
 *
 * The two audits (full + --omit=dev) are compared by package name to decide
 * whether a finding lives in the production tree.
 */

const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const BLOCK_SEVERITIES = new Set(['high', 'critical']);
const ALLOWLIST_FILE = 'dependency-audit-allowlist.json';
const MAX_BUF = 32 * 1024 * 1024;

function npmCommand() {
  return process.platform === 'win32' ? 'npm.cmd' : 'npm';
}

function packageDir(dirArg) {
  const dir = path.resolve(process.cwd(), dirArg || '.');
  const pkgJson = path.join(dir, 'package.json');
  if (!fs.existsSync(pkgJson)) {
    console.error(`[dependency-audit] no package.json in ${dir}`);
    process.exit(2);
  }
  return dir;
}

function ensureLockfile(dir) {
  const lock = path.join(dir, 'package-lock.json');
  if (fs.existsSync(lock)) return;
  // No committed lockfile (this repo gitignores them): resolve one so the
  // audit runs against a real dependency tree rather than package.json alone.
  console.log('[dependency-audit] no package-lock.json present; resolving one with `npm install --package-lock-only`');
  const r = spawnSync(npmCommand(), ['install', '--package-lock-only', '--no-audit', '--no-fund'], {
    cwd: dir, stdio: 'inherit', shell: process.platform === 'win32',
  });
  if (r.status !== 0) {
    console.error('[dependency-audit] failed to resolve the dependency tree; aborting (fail closed).');
    process.exit(2);
  }
}

function runAudit(dir, extraArgs) {
  const r = spawnSync(npmCommand(), ['audit', '--json', ...extraArgs], {
    cwd: dir, encoding: 'utf8', maxBuffer: MAX_BUF, shell: process.platform === 'win32',
  });
  // npm audit exits non-zero when findings exist; that is expected here. What
  // matters is that stdout is parseable JSON describing the tree.
  try {
    return JSON.parse(r.stdout);
  } catch (e) {
    console.error('[dependency-audit] could not parse `npm audit --json` output. Aborting (fail closed).');
    if (r.stderr) console.error(r.stderr.slice(0, 4000));
    process.exit(2);
  }
}

function extractAdvisoryIds(vuln) {
  const ids = [];
  for (const via of vuln.via || []) {
    if (typeof via !== 'object' || !via.url) continue;
    const m = via.url.match(/GHSA-[a-z0-9-]+/i);
    if (m) ids.push(m[0].toUpperCase());
  }
  return [...new Set(ids)];
}

function summaryOf(audit) {
  return audit && audit.metadata && audit.metadata.vulnerabilities
    ? audit.metadata.vulnerabilities
    : null;
}

function loadAllowlist(dir) {
  const file = path.join(dir, ALLOWLIST_FILE);
  if (!fs.existsSync(file)) return { entries: [] };
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (e) {
    console.error(`[dependency-audit] ${ALLOWLIST_FILE} is not valid JSON: ${e.message}`);
    process.exit(2);
  }
}

function isExpired(until, today) {
  if (!until) return false;
  const d = new Date(until);
  if (Number.isNaN(d.getTime())) return true; // malformed date -> treat as expired
  return today >= d;
}

function todayUTC() {
  const t = new Date();
  return new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate()));
}

function main() {
  const dir = packageDir(process.argv[2]);
  ensureLockfile(dir);

  const full = runAudit(dir, []);
  const prod = runAudit(dir, ['--omit=dev']);

  const fullSummary = summaryOf(full);
  const prodSummary = summaryOf(prod);
  const prodNames = new Set(Object.keys(prod.vulnerabilities || {}));
  const allowlist = loadAllowlist(dir);
  const byName = new Map(allowlist.entries.map((e) => [e.package, e]));
  const today = todayUTC();

  const name = JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8')).name;
  console.log(`\n=== Dependency audit: ${name} (${path.basename(dir)}) ===`);
  console.log(`full tree: ${JSON.stringify(fullSummary)}`);
  console.log(`production tree (--omit=dev): ${JSON.stringify(prodSummary)}`);

  const blocked = [];
  const accepted = [];
  const warnings = [];

  for (const [pkg, vuln] of Object.entries(full.vulnerabilities || {})) {
    const severity = vuln.severity;
    const inProd = prodNames.has(pkg);
    const entry = byName.get(pkg);
    const where = inProd ? 'production' : 'development-only';

    if (BLOCK_SEVERITIES.has(severity)) {
      if (!inProd) {
        warnings.push(`[DEV-ONLY ${severity.toUpperCase()}] ${pkg}: dev/build-tooling finding, does not ship to the running service. Fix when convenient.`);
        continue;
      }
      if (!entry) {
        blocked.push(`[BLOCK ${severity.toUpperCase()}] ${pkg}: ${severity} vulnerability in the production tree with no allowlist entry.`);
        continue;
      }
      if (isExpired(entry.until, today)) {
        blocked.push(`[BLOCK ${severity.toUpperCase()}] ${pkg}: allowlist entry expired ${entry.until} — re-evaluate (upstream fix may now exist). Reason was: ${entry.reason || 'n/a'}`);
        continue;
      }
      if (Array.isArray(entry.advisories) && entry.advisories.length) {
        const known = new Set(entry.advisories.map((a) => a.toUpperCase()));
        const seen = extractAdvisoryIds(vuln);
        const unknown = seen.filter((id) => !known.has(id));
        if (unknown.length) {
          blocked.push(`[BLOCK ${severity.toUpperCase()}] ${pkg}: NEW advisory(ies) not in allowlist: ${unknown.join(', ')}`);
          continue;
        }
      }
      accepted.push(`[ACCEPTED ${severity.toUpperCase()}] ${pkg}: allowlisted until ${entry.until}. ${entry.reason || ''}`);
    } else {
      const viaDesc = (vuln.via || []).filter((x) => typeof x === 'string');
      warnings.push(`[WARN ${severity}] ${pkg} (${where}${vuln.isDirect ? ', direct' : ', transitive'}${viaDesc.length ? ', via ' + viaDesc.join('+') : ''}): below blocking threshold.`);
    }
  }

  for (const line of blocked) console.error(line);
  for (const line of accepted) console.log(line);
  for (const line of warnings) console.log(line);

  if (blocked.length) {
    console.error(`\n[dependency-audit] BLOCKED: ${blocked.length} high/critical finding(s) in the production tree exceed the policy threshold.`);
    console.error('[dependency-audit] Review the advisory, then either fix (prefer in-range `npm audit fix`, never --force) or add/update a dated allowlist entry in ' + ALLOWLIST_FILE + ' with justification.');
    process.exit(1);
  }

  console.log(`\n[dependency-audit] PASS — no unallowlisted high/critical findings in the production tree (${accepted.length} allowlisted known issue(s), ${warnings.length} non-blocking warning(s)).`);
  process.exit(0);
}

main();
