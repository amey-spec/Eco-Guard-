import jwt from 'jsonwebtoken';
import { getDatabase } from '../config/database.js';
import { getJwtSecret, JWT_VERIFY_OPTIONS } from '../config/security.js';
import { logSecurityEvent, requestContext } from '../config/securityLog.js';

function extractBearerToken(req) {
  const header = req.headers['authorization'] || '';
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : null;
}

/**
 * Records a security event for a rejected request without ever changing the
 * outcome: the caller still responds with the same status it decided on. The
 * log write is awaited purely for ordering, and logSecurityEvent never throws.
 */
async function recordAuthEvent(req, eventType, reason, extra = {}) {
  await logSecurityEvent({
    eventType,
    success: false,
    reason,
    ...requestContext(req),
    ...extra,
  });
}

/**
 * Verifies the bearer token, then reloads the user from the database so that
 * deleted accounts and role changes (e.g. an admin demoted to user) take
 * effect immediately instead of trusting stale token claims.
 *
 * Rejections (missing / invalid / expired token, deleted account) are recorded
 * server-side as security events; the actor identity is never taken from the
 * client.
 */
export async function authenticateToken(req, res, next) {
  try {
    const token = extractBearerToken(req);
    if (!token) {
      await recordAuthEvent(req, 'token_missing', 'access token required');
      return res.status(401).json({ error: 'Access token required' });
    }

    let payload;
    try {
      payload = jwt.verify(token, getJwtSecret(), JWT_VERIFY_OPTIONS);
    } catch (err) {
      // jwt.sign never emits the token itself; err.message is a jwt library
      // classification (e.g. 'jwt expired', 'invalid signature'), which is not
      // sensitive.
      const reason =
        err && err.name === 'TokenExpiredError' ? 'expired' : 'invalid';
      await recordAuthEvent(req, 'token_invalid', reason);
      return res.status(403).json({ error: 'Invalid or expired token' });
    }

    if (!payload || !Number.isInteger(payload.id)) {
      await recordAuthEvent(req, 'token_invalid', 'malformed payload');
      return res.status(403).json({ error: 'Invalid or expired token' });
    }

    const db = await getDatabase();
    const user = await db.get(
      'SELECT id, name, email, role, status FROM users WHERE id = ?',
      [payload.id]
    );

    if (!user) {
      // The account behind the token is gone; keep the numeric id as a target
      // reference for triage, but never trust the token's other claims.
      await recordAuthEvent(req, 'token_account_deleted', 'token references deleted account', {
        targetType: 'user',
        targetId: payload.id,
      });
      return res.status(401).json({ error: 'Account no longer exists' });
    }

    // Account status is part of the DB-backed check on every request, so a
    // suspended/disabled account loses access the moment the status changes —
    // already-issued JWTs cannot bypass it (they are never trusted on their
    // own; the user row is reloaded here every time).
    if (user.status !== 'active') {
      await logSecurityEvent({
        eventType: 'token_account_inactive',
        success: false,
        reason: user.status, // 'suspended' | 'disabled'
        targetType: 'user',
        targetId: user.id,
        ...requestContext(req),
      });
      return res.status(403).json({ error: 'Your account is not active' });
    }

    // Attach the *current* database state, never raw token claims.
    req.user = user;
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    return res.status(500).json({ error: 'Authentication failed' });
  }
}

export async function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    // A real (non-admin) session reaching an admin surface: record who tried.
    const actor = req.user ? { id: req.user.id, role: req.user.role } : null;
    await logSecurityEvent({
      eventType: 'admin_access_denied',
      actor,
      success: false,
      reason: 'insufficient role',
      ...requestContext(req),
    });
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
}
