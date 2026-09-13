import { getDatabase } from './database.js';

/**
 * Trusted server-side security event logger.
 *
 * This is the ONLY writer for the security_events table. Callers are route
 * handlers and middleware running after an authorization decision has been
 * made; actors are always derived from the authenticated request / database,
 * never from client-supplied input. Normal users have no API surface to read
 * or modify these rows — the single reader is an admin-only endpoint.
 *
 * Hard rules enforced here:
 *   - Never accepts raw bodies, headers, or tokens — only a small allow-list
 *     of scalar fields plus a sanitized metadata object.
 *   - Keys that look sensitive (password, hash, secret, authorization, token,
 *     api key, cookie) are stripped from metadata as a defense-in-depth guard.
 *   - Never throws: a logging failure must not change the outcome of the
 *     request it is attached to (it must not turn a denied action into an
 *     allowed one, or crash an otherwise valid one).
 *   - Nothing sensitive is written to the console.
 */

// Keys that must never be stored, even if a future caller slips up. Applied
// recursively to the metadata object.
const SENSITIVE_KEY_PATTERN =
  /password|passwd|secret|authorization|token|api[_-]?key|apikey|cookie|hash/i;

// Individual metadata string cap and total serialized metadata cap.
const METADATA_STRING_CAP = 1000;
const METADATA_JSON_CAP = 2000;

/* ---------------- Retention ----------------
 *
 * security_events is append-only and never exposed to client writes, but it
 * grows with every login attempt and rejected token. Without retention it
 * becomes an unbounded disk-growth vector (every failed login inserts a row).
 * A rolling window keeps the evidence useful for triage while bounding the
 * table. The default window is 90 days; operators can tune or disable it (0).
 */
const RETENTION_DAYS = (() => {
  const raw = Number(process.env.SECURITY_EVENTS_RETENTION_DAYS);
  return Number.isFinite(raw) && raw >= 0 ? raw : 90;
})();

// Prune at most once per process hour — the DELETE is indexed by created_at
// and cheap, but there is no reason to run it on every insert.
const PRUNE_INTERVAL_MS = 60 * 60 * 1000;
let lastPruneAt = 0;

async function pruneOldEvents(db) {
  if (RETENTION_DAYS === 0) return; // retention disabled by config
  const now = Date.now();
  if (now - lastPruneAt < PRUNE_INTERVAL_MS) return;
  lastPruneAt = now;
  try {
    await db.run(
      'DELETE FROM security_events WHERE created_at < datetime(\'now\', ?)',
      [`-${RETENTION_DAYS} days`]
    );
  } catch {
    // Pruning is best-effort housekeeping; never affect request outcomes.
  }
}

function capString(value, maxLength) {
  if (value === null || value === undefined) return null;
  const text = typeof value === 'string' ? value : String(value);
  return text.slice(0, maxLength) || null;
}

function sanitizeValue(value, depth = 0) {
  if (value === null || value === undefined) return null;
  const type = typeof value;
  if (type === 'string') return value.slice(0, METADATA_STRING_CAP);
  if (type === 'number') return Number.isFinite(value) ? value : null;
  if (type === 'boolean') return value;
  if (Array.isArray(value)) {
    if (depth > 2) return null;
    const items = value.slice(0, 20).map((v) => sanitizeValue(v, depth + 1));
    return items.length ? items : null;
  }
  if (type === 'object') {
    if (depth > 2) return null;
    const out = {};
    for (const [key, val] of Object.entries(value)) {
      if (SENSITIVE_KEY_PATTERN.test(key)) continue; // drop, never store
      const safe = sanitizeValue(val, depth + 1);
      if (safe !== null) out[key] = safe;
    }
    return Object.keys(out).length ? out : null;
  }
  return null;
}

function parseMetadata(metadata) {
  if (typeof metadata !== 'string') return null;
  try {
    return JSON.parse(metadata);
  } catch {
    return null;
  }
}

/**
 * Captures the non-sensitive request context for an event. The endpoint is the
 * path only — never query strings (which can carry tokens/secrets).
 */
export function requestContext(req) {
  const originalUrl = req && (req.originalUrl || req.url) ? String(req.originalUrl || req.url) : '';
  const pathOnly = originalUrl.split('?')[0];
  return {
    ip: req && typeof req.ip === 'string' ? req.ip : null,
    endpoint: `${req && req.method ? req.method : ''} ${pathOnly}`.trim(),
  };
}

/**
 * Writes one security event. Resolves to the new row id (or null when the
 * write could not be performed). Never rejects and never logs sensitive data.
 *
 * @param {object} options
 * @param {string} options.eventType   e.g. 'login_failed', 'token_invalid'
 * @param {{id:number, role:string}|null} [options.actor]  verified server-side identity
 * @param {boolean} [options.success]  outcome of the event
 * @param {string|null} [options.targetType]
 * @param {string|number|null} [options.targetId]
 * @param {string|null} [options.ip]
 * @param {string|null} [options.endpoint]   e.g. 'POST /api/auth/login'
 * @param {string|null} [options.reason]
 * @param {object|null} [options.metadata]   safe, JSON-serializable extras
 */
export async function logSecurityEvent({
  eventType,
  actor = null,
  success = false,
  targetType = null,
  targetId = null,
  ip = null,
  endpoint = null,
  reason = null,
  metadata = null,
} = {}) {
  let db;
  try {
    if (!eventType || typeof eventType !== 'string' || !eventType.trim()) return null;

    db = await getDatabase();

    const actorId = actor && Number.isInteger(actor.id) ? actor.id : null;
    const actorRole =
      actor && (actor.role === 'admin' || actor.role === 'user') ? actor.role : null;

    let metadataJson = null;
    const sanitized = sanitizeValue(metadata);
    if (sanitized !== null) {
      const serialized = JSON.stringify(sanitized);
      if (serialized && serialized.length <= METADATA_JSON_CAP) {
        metadataJson = serialized;
      }
    }

    const result = await db.run(
      `INSERT INTO security_events
         (event_type, actor_user_id, actor_role, success, target_type, target_id,
          ip, endpoint, reason, metadata)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        capString(eventType, 80),
        actorId,
        actorRole,
        success ? 1 : 0,
        capString(targetType, 80),
        targetId === null || targetId === undefined ? null : capString(targetId, 255),
        capString(ip, 64),
        capString(endpoint, 255),
        capString(reason, 255),
        metadataJson,
      ]
    );

    await pruneOldEvents(db);

    return result && result.lastID ? result.lastID : null;
  } catch (error) {
    // Swallow after a generic console line. It carries no event payload — the
    // error text from SQLite is structural (e.g. 'database is locked') and the
    // event type is not sensitive.
    console.error(
      `Security event logging failed${eventType ? ` (${capString(eventType, 40)})` : ''}:`,
      error && error.message ? error.message : 'unknown error'
    );
    return null;
  }
}

export { parseMetadata };
