import express from 'express';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { getDatabase } from '../config/database.js';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';
import { parseMetadata } from '../config/securityLog.js';
import {
  ALLOWED_ACCOUNT_STATUSES,
  ALLOWED_REPORT_STATUSES,
  ALLOWED_ROLES,
  LIMITS,
  normalizeText,
} from '../config/security.js';

const router = express.Router();

/**
 * Creates an audit log entry server-side. The admin_id and timestamp are never
 * trusted from the client — they are always derived from the authenticated
 * request and the database server clock.
 *
 * Sensitive data (passwords, hashes, tokens, secrets) must never be passed in
 * old_value/new_value. Callers are responsible for redacting before calling.
 */
async function createAuditEntry(db, adminId, action, targetType, targetId, oldValue = null, newValue = null) {
  await db.run(
    `INSERT INTO audit_log (admin_id, action, target_type, target_id, old_value, new_value)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [adminId, action, targetType, String(targetId), oldValue, newValue]
  );
}

/**
 * A friendly, stage-specific notification for the reporter whenever a ranger
 * moves their report. Optional ranger notes are appended verbatim.
 */
function statusNotification(reportId, status, notes = '') {
  const detail = notes ? ` ${notes}` : '';
  switch (status) {
    case 'Submitted':
      return { title: 'Report received', message: `Your report ${reportId} is on the record — thank you for reporting it.` };
    case 'Pending':
    case 'Under Review':
    case 'In Review':
      return { title: 'Under investigation', message: `Your report ${reportId} has been picked up and is now under investigation.${detail}` };
    case 'Verified':
      return { title: 'Signal confirmed', message: `Your report ${reportId} has been confirmed and is now under investigation by the field team.${detail}` };
    case 'Resolved':
      return { title: 'Resolved — thank you', message: `Good news: your report ${reportId} has been resolved.${detail} Thanks again for reporting it — it made a difference.` };
    case 'Rejected':
      return { title: 'Report closed', message: `Your report ${reportId} was closed.${detail}` };
    default:
      return { title: 'Report update', message: `Your report ${reportId} status changed to ${status}.` };
  }
}

/* ---------------- Admin-specific rate limiting ----------------
 *
 * The global API limiter (300 requests / 15 min per IP) still applies to
 * everything under /api, including admin reads, so normal dashboard usage
 * (stats, lists, audit/security views) keeps working unchanged.
 *
 * Privileged write operations get tighter per-account budgets so one admin
 * session (or a leaked/abused admin token) cannot churn moderation state,
 * mass-delete reports, or rapidly re-role users.
 *
 * These limiters are mounted on the specific routes BELOW the
 * authenticateToken + requireAdmin router guards, so they only ever count
 * verified admin sessions. The key is the DB-backed account id from req.user
 * (reloaded from the users table by authenticateToken) — never a
 * client-supplied role field or token claim — so a request cannot dodge the
 * limit by claiming to be an admin, and rotating IPs does not bypass it.
 * Unauthenticated and non-admin requests are denied by the guards before a
 * budget is consumed, so limiting behavior never reveals whether a target
 * account/report exists (it depends only on the caller).
 */

const ADMIN_LIMIT_WINDOW_MS = 15 * 60 * 1000;

// Per-account write budgets are env-tunable (mirroring LOGIN_RATE_LIMIT_*) so
// test suites exercising many admin mutations can raise them per-process.
// Production defaults stay at the documented values below.
const ADMIN_RATE_LIMIT_MAX = Number(process.env.ADMIN_RATE_LIMIT_MAX) || 0; // 0 = use per-route defaults

function adminKeyGenerator(req) {
  // Only reachable after authenticateToken + requireAdmin, so req.user is the
  // verified admin. Fall back to the IP defensively if that ever changes,
  // normalizing IPv6 through the package helper so addresses cannot be
  // trivially rotated to bypass the budget.
  if (req.user && Number.isInteger(req.user.id)) {
    return `admin:${req.user.id}`;
  }
  return `ip:${ipKeyGenerator(req.ip || 'unknown')}`;
}

function adminOperationLimiter(limit, label) {
  return rateLimit({
    windowMs: ADMIN_LIMIT_WINDOW_MS,
    limit: ADMIN_RATE_LIMIT_MAX > 0 ? ADMIN_RATE_LIMIT_MAX : limit,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    keyGenerator: adminKeyGenerator,
    message: { error: `Too many ${label} — please wait a few minutes and try again` },
  });
}

// Report status changes are the routine moderation write: a generous but still
// bounded per-admin budget.
const adminStatusChangeLimiter = adminOperationLimiter(60, 'report updates');
// Deleting reports is destructive and irreversible: far tighter budget.
const adminDeleteLimiter = adminOperationLimiter(20, 'report deletions');
// Re-roleing users changes privileges: tightest budget.
const adminRoleChangeLimiter = adminOperationLimiter(10, 'role changes');
// Suspending/reenabling accounts is a high-impact privilege change.
const adminAccountStatusLimiter = adminOperationLimiter(20, 'account status changes');

// All admin routes require authentication and admin role
router.use(authenticateToken);
router.use(requireAdmin);

// Get dashboard statistics
router.get('/stats', async (req, res) => {
  try {
    const db = await getDatabase();

    const totalUsers = await db.get('SELECT COUNT(*) as count FROM users');
    const totalReports = await db.get('SELECT COUNT(*) as count FROM hazard_reports');
    const pendingReports = await db.get("SELECT COUNT(*) as count FROM hazard_reports WHERE status = 'Submitted'");
    const verifiedReports = await db.get("SELECT COUNT(*) as count FROM hazard_reports WHERE status = 'Verified'");
    const resolvedReports = await db.get("SELECT COUNT(*) as count FROM hazard_reports WHERE status = 'Resolved'");

    const reportsByCategory = await db.all(`
      SELECT hazard_type, COUNT(*) as count
      FROM hazard_reports
      GROUP BY hazard_type
      ORDER BY count DESC
    `);

    const reportsBySeverity = await db.all(`
      SELECT severity, COUNT(*) as count
      FROM hazard_reports
      GROUP BY severity
      ORDER BY count DESC
    `);

    const recentActivity = await db.all(`
      SELECT r.*, u.name as reporter_name
      FROM hazard_reports r
      LEFT JOIN users u ON r.user_id = u.id
      ORDER BY r.created_at DESC
      LIMIT 10
    `);

    res.json({
      totalUsers: totalUsers.count,
      totalReports: totalReports.count,
      pendingReports: pendingReports.count,
      verifiedReports: verifiedReports.count,
      resolvedReports: resolvedReports.count,
      reportsByCategory,
      reportsBySeverity,
      recentActivity
    });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

// Get all users
router.get('/users', async (req, res) => {
  try {
    const db = await getDatabase();
    const users = await db.all('SELECT id, name, email, role, status, created_at FROM users ORDER BY created_at DESC');
    res.json(users);
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// Update report status
router.put('/reports/:id/status', adminStatusChangeLimiter, async (req, res) => {
  try {
    const status = typeof req.body?.status === 'string' ? req.body.status.trim() : '';
    const notes = normalizeText(req.body?.admin_notes, LIMITS.notes);
    const { id } = req.params;

    if (!id || !/^[A-Za-z0-9-]+$/.test(id)) {
      return res.status(400).json({ error: 'Invalid report id' });
    }
    if (!ALLOWED_REPORT_STATUSES.includes(status)) {
      return res.status(400).json({ error: `Status must be one of: ${ALLOWED_REPORT_STATUSES.join(', ')}` });
    }

    const db = await getDatabase();
    const existing = await db.get('SELECT id, status, user_id FROM hazard_reports WHERE id = ?', [id]);
    if (!existing) {
      return res.status(404).json({ error: 'Report not found' });
    }

    // Capture old status for audit
    const oldStatus = existing.status;

    await db.run(
      'UPDATE hazard_reports SET status = ?, admin_notes = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [status, notes, id]
    );

    const report = await db.get('SELECT * FROM hazard_reports WHERE id = ?', [id]);

    // Notify the reporter at every milestone, in language that matches the stage.
    if (report.user_id) {
      const { title, message } = statusNotification(report.id, report.status, notes);
      await db.run(
        'INSERT INTO notifications (user_id, title, message) VALUES (?, ?, ?)',
        [report.user_id, title, message]
      );
    }

    // Create audit entry (server-side, from authenticated admin)
    // Only audit if status actually changed
    if (oldStatus !== status) {
      await createAuditEntry(
        db,
        req.user.id,
        'report_status_change',
        'report',
        id,
        JSON.stringify({ status: oldStatus }),
        JSON.stringify({ status, notes: notes || undefined })
      );
    }

    res.json({ success: true, report });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Failed to update report' });
  }
});

// Delete report
router.delete('/reports/:id', adminDeleteLimiter, async (req, res) => {
  try {
    const { id } = req.params;
    if (!id || !/^[A-Za-z0-9-]+$/.test(id)) {
      return res.status(400).json({ error: 'Invalid report id' });
    }

    const db = await getDatabase();

    // Capture pre-delete state for audit
    const existing = await db.get('SELECT id, status, user_id FROM hazard_reports WHERE id = ?', [id]);
    if (!existing) {
      return res.status(404).json({ error: 'Report not found' });
    }

    await db.run('DELETE FROM hazard_reports WHERE id = ?', [id]);

    // Create audit entry (server-side, from authenticated admin)
    await createAuditEntry(
      db,
      req.user.id,
      'report_delete',
      'report',
      id,
      JSON.stringify({ id, status: existing.status, user_id: existing.user_id }),
      null
    );

    res.json({ success: true });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Failed to delete report' });
  }
});

// Update user role
router.put('/users/:id/role', adminRoleChangeLimiter, async (req, res) => {
  try {
    const role = typeof req.body?.role === 'string' ? req.body.role.trim() : '';
    const targetId = Number(req.params.id);

    if (!Number.isInteger(targetId) || targetId <= 0) {
      return res.status(400).json({ error: 'Invalid user id' });
    }
    if (!ALLOWED_ROLES.includes(role)) {
      return res.status(400).json({ error: 'Role must be one of: user, admin' });
    }

    // Security: prevent self-demotion (locking admin out of console)
    if (targetId === req.user.id && role !== 'admin') {
      return res.status(400).json({ error: 'You cannot change your own role' });
    }

    // Security: normal users cannot modify roles via any path
    // (requireAdmin middleware already blocks this, but defense-in-depth)
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const db = await getDatabase();
    const target = await db.get('SELECT id, role FROM users WHERE id = ?', [targetId]);
    if (!target) {
      return res.status(404).json({ error: 'User not found' });
    }

    const oldRole = target.role;
    const newRole = role;

    // No-op: role unchanged
    if (oldRole === newRole) {
      return res.json({ success: true, unchanged: true });
    }

    await db.run('UPDATE users SET role = ? WHERE id = ?', [newRole, targetId]);

    // Create audit entry (server-side, from authenticated admin)
    await createAuditEntry(
      db,
      req.user.id,
      'role_change',
      'user',
      targetId,
      JSON.stringify({ role: oldRole }),
      JSON.stringify({ role: newRole })
    );

    res.json({ success: true, role: newRole });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Failed to update user role' });
  }
});

// Update account status (active | suspended | disabled)
router.put('/users/:id/status', adminAccountStatusLimiter, async (req, res) => {
  try {
    const rawStatus = typeof req.body?.status === 'string' ? req.body.status.trim().toLowerCase() : '';
    const targetId = Number(req.params.id);

    if (!Number.isInteger(targetId) || targetId <= 0) {
      return res.status(400).json({ error: 'Invalid user id' });
    }
    if (!ALLOWED_ACCOUNT_STATUSES.includes(rawStatus)) {
      return res.status(400).json({ error: `Status must be one of: ${ALLOWED_ACCOUNT_STATUSES.join(', ')}` });
    }

    // Security: an admin must never suspend/disable their own account through
    // this endpoint (same principle as the self-demotion guard for roles) —
    // it would lock the console out with no one left to undo it.
    if (targetId === req.user.id) {
      return res.status(400).json({ error: 'You cannot change your own account status' });
    }

    const db = await getDatabase();
    const target = await db.get('SELECT id, status FROM users WHERE id = ?', [targetId]);
    if (!target) {
      return res.status(404).json({ error: 'User not found' });
    }

    const oldStatus = target.status;
    const newStatus = rawStatus;

    // No-op: status unchanged
    if (oldStatus === newStatus) {
      return res.json({ success: true, unchanged: true, status: newStatus });
    }

    await db.run('UPDATE users SET status = ? WHERE id = ?', [newStatus, targetId]);

    // Audit entry (server-side, from the authenticated admin). No sensitive
    // data is recorded — only the actor id, target id, and old/new statuses.
    await createAuditEntry(
      db,
      req.user.id,
      'account_status_change',
      'user',
      targetId,
      JSON.stringify({ status: oldStatus }),
      JSON.stringify({ status: newStatus })
    );

    res.json({ success: true, status: newStatus });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Failed to update account status' });
  }
});

// Get administrators list (for Admin & Security section)
router.get('/administrators', async (req, res) => {
  try {
    const db = await getDatabase();

    // Only return admin users with non-sensitive information
    const administrators = await db.all(`
      SELECT id, name, email, role, created_at
      FROM users
      WHERE role = 'admin'
      ORDER BY created_at ASC
    `);

    res.json({
      administrators,
      total: administrators.length
    });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Failed to fetch administrators' });
  }
});

// Get admin details for a specific user
router.get('/administrators/:id', async (req, res) => {
  try {
    const targetId = Number(req.params.id);

    if (!Number.isInteger(targetId) || targetId <= 0) {
      return res.status(400).json({ error: 'Invalid user id' });
    }

    const db = await getDatabase();

    // Get the target user (must be an admin)
    const user = await db.get(`
      SELECT id, name, email, role, created_at
      FROM users
      WHERE id = ? AND role = 'admin'
    `, [targetId]);

    if (!user) {
      return res.status(404).json({ error: 'Administrator not found' });
    }

    // Get recent audit entries for this admin (server-side, non-sensitive)
    const recentActions = await db.all(`
      SELECT id, action, target_type, target_id, created_at
      FROM audit_log
      WHERE admin_id = ?
      ORDER BY created_at DESC
      LIMIT 20
    `, [targetId]);

    // Get recent role changes (for activity summary)
    const recentRoleChanges = await db.all(`
      SELECT id, action, target_type, target_id, old_value, new_value, created_at
      FROM audit_log
      WHERE admin_id = ? AND action = 'role_change'
      ORDER BY created_at DESC
      LIMIT 10
    `, [targetId]);

    res.json({
      administrator: user,
      recent_actions: recentActions,
      recent_role_changes: recentRoleChanges,
      total_actions: recentActions.length
    });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Failed to fetch administrator details' });
  }
});

/* ---------------- Audit log filtering ----------------
 *
 * GET /api/admin/audit-log supports allow-listed, strictly validated filters:
 *   action        – exact audit action, e.g. role_change (a-z, digits, _)
 *   admin_id      – acting admin (actor) id, positive integer
 *   target_type   – e.g. user | report (lowercase letters)
 *   target_id     – e.g. 7 or ECO-2026-00010 (letters, digits, - and _)
 *   start_date    – inclusive lower bound on created_at (YYYY-MM-DD or
 *                   YYYY-MM-DD HH:MM:SS, UTC like SQLite's CURRENT_TIMESTAMP)
 *   end_date      – inclusive upper bound; date-only values expand to end of day
 *
 * Every value is validated before use and every WHERE clause is a fixed SQL
 * fragment bound with parameters — user input is never concatenated into SQL
 * text — so injection attempts fail closed with a 400 (or simply match nothing)
 * instead of reaching the query. Unknown params are ignored. Pagination
 * (limit/offset) is preserved and `total` reflects the active filters.
 */

const AUDIT_ACTION_RE = /^[a-z][a-z0-9_]{0,79}$/;
const AUDIT_TARGET_TYPE_RE = /^[a-z]{1,30}$/;
const AUDIT_TARGET_ID_RE = /^[A-Za-z0-9_-]{1,80}$/;
const AUDIT_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2}):(\d{2}))?$/;

function isValidDateParts(y, mo, d, hh, mi, ss) {
  const dt = new Date(Date.UTC(y, mo - 1, d, hh, mi, ss));
  return (
    dt.getUTCFullYear() === y &&
    dt.getUTCMonth() === mo - 1 &&
    dt.getUTCDate() === d &&
    dt.getUTCHours() === hh &&
    dt.getUTCMinutes() === mi &&
    dt.getUTCSeconds() === ss
  );
}

/**
 * Parses a user-supplied date filter into the exact 'YYYY-MM-DD HH:MM:SS'
 * text format SQLite stores in created_at (UTC). Date-only values expand to
 * 00:00:00 (start) or 23:59:59 (end). Returns null when invalid.
 */
function parseAuditDate(raw, endOfDay) {
  if (typeof raw !== 'string') return null;
  const m = raw.trim().match(AUDIT_DATE_RE);
  if (!m) return null;
  const [, y, mo, d, hh, mi, ss] = m;
  const hasTime = hh !== undefined;
  const H = hasTime ? Number(hh) : endOfDay ? 23 : 0;
  const M = hasTime ? Number(mi) : endOfDay ? 59 : 0;
  const S = hasTime ? Number(ss) : endOfDay ? 59 : 0;
  if (!isValidDateParts(Number(y), Number(mo), Number(d), H, M, S)) return null;
  if (!hasTime) return `${y}-${mo}-${d} ${String(H).padStart(2, '0')}:${String(M).padStart(2, '0')}:${String(S).padStart(2, '0')}`;
  return `${y}-${mo}-${d} ${hh}:${mi}:${ss}`;
}

// Get audit log entries
router.get('/audit-log', async (req, res) => {
  try {
    const db = await getDatabase();

    // Parse optional pagination/query params
    const limit = Math.min(Math.max(1, Number(req.query.limit) || 50), 100);
    const offset = Math.max(0, Number(req.query.offset) || 0);

    // Build the WHERE clause from fixed fragments only; all values are bound.
    const conditions = [];
    const params = [];

    if (req.query.action !== undefined) {
      const action = String(req.query.action).trim();
      if (!AUDIT_ACTION_RE.test(action)) {
        return res.status(400).json({ error: 'Invalid action filter' });
      }
      conditions.push('al.action = ?');
      params.push(action);
    }

    if (req.query.admin_id !== undefined && req.query.admin_id !== '') {
      const adminId = Number(req.query.admin_id);
      if (!Number.isInteger(adminId) || adminId <= 0) {
        return res.status(400).json({ error: 'Invalid admin_id filter' });
      }
      conditions.push('al.admin_id = ?');
      params.push(adminId);
    }

    if (req.query.target_type !== undefined) {
      const targetType = String(req.query.target_type).trim();
      if (!AUDIT_TARGET_TYPE_RE.test(targetType)) {
        return res.status(400).json({ error: 'Invalid target_type filter' });
      }
      conditions.push('al.target_type = ?');
      params.push(targetType);
    }

    if (req.query.target_id !== undefined) {
      const targetId = String(req.query.target_id).trim();
      if (!AUDIT_TARGET_ID_RE.test(targetId)) {
        return res.status(400).json({ error: 'Invalid target_id filter' });
      }
      conditions.push('al.target_id = ?');
      params.push(targetId);
    }

    if (req.query.start_date !== undefined && req.query.start_date !== '') {
      const from = parseAuditDate(req.query.start_date, false);
      if (!from) {
        return res.status(400).json({ error: 'Invalid start_date filter' });
      }
      conditions.push('al.created_at >= ?');
      params.push(from);
    }

    if (req.query.end_date !== undefined && req.query.end_date !== '') {
      const to = parseAuditDate(req.query.end_date, true);
      if (!to) {
        return res.status(400).json({ error: 'Invalid end_date filter' });
      }
      conditions.push('al.created_at <= ?');
      params.push(to);
    }

    const whereSql = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    // Get audit entries (most recent first; id breaks same-second ties)
    const entries = await db.all(
      `SELECT
        al.id,
        al.action,
        al.target_type,
        al.target_id,
        al.old_value,
        al.new_value,
        al.created_at,
        u.id as admin_id,
        u.name as admin_name,
        u.email as admin_email
      FROM audit_log al
      JOIN users u ON al.admin_id = u.id
      ${whereSql}
      ORDER BY al.created_at DESC, al.id DESC
      LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    // Get total count (respects the active filters)
    const countResult = await db.get(
      `SELECT COUNT(*) as total FROM audit_log al ${whereSql}`,
      params
    );

    res.json({
      entries,
      total: countResult.total,
      limit,
      offset
    });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Failed to fetch audit log' });
  }
});

// Get security events (read-only). This route sits behind the router-level
// authenticateToken + requireAdmin guards above, so only admins can read the
// log; there is intentionally no create/update/delete surface for it.
router.get('/security-events', async (req, res) => {
  try {
    const db = await getDatabase();

    const limit = Math.min(Math.max(1, Number(req.query.limit) || 50), 200);
    const offset = Math.max(0, Number(req.query.offset) || 0);
    const typeFilter = typeof req.query.type === 'string' ? req.query.type.trim().slice(0, 80) : '';

    let where = '';
    const params = [];
    if (typeFilter) {
      where = 'WHERE se.event_type = ?';
      params.push(typeFilter);
    }

    const rows = await db.all(
      `SELECT
        se.id,
        se.event_type,
        se.actor_user_id,
        se.actor_role,
        se.success,
        se.target_type,
        se.target_id,
        se.ip,
        se.endpoint,
        se.reason,
        se.metadata,
        se.created_at,
        u.name as actor_name,
        u.email as actor_email
      FROM security_events se
      LEFT JOIN users u ON se.actor_user_id = u.id
      ${where}
      ORDER BY se.created_at DESC, se.id DESC
      LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    const countResult = await db.get(
      `SELECT COUNT(*) as total FROM security_events se ${where}`,
      params
    );

    const events = rows.map((row) => ({
      id: row.id,
      event_type: row.event_type,
      success: Boolean(row.success),
      actor: row.actor_user_id
        ? {
            id: row.actor_user_id,
            name: row.actor_name ?? null,
            email: row.actor_email ?? null,
            role: row.actor_role ?? null,
          }
        : null,
      target_type: row.target_type ?? null,
      target_id: row.target_id ?? null,
      ip: row.ip ?? null,
      endpoint: row.endpoint ?? null,
      reason: row.reason ?? null,
      metadata: parseMetadata(row.metadata),
      created_at: row.created_at,
    }));

    res.json({
      events,
      total: countResult.total,
      limit,
      offset,
    });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Failed to fetch security events' });
  }
});

// Get security overview
router.get('/security-overview', async (req, res) => {
  try {
    const db = await getDatabase();

    // Total administrators
    const adminCount = await db.get('SELECT COUNT(*) as count FROM users WHERE role = \'admin\'');

    // Recent admin actions (last 24 hours if we had timestamps, but we use LIMIT)
    const recentActions = await db.all(`
      SELECT
        al.action,
        al.target_type,
        al.target_id,
        al.created_at,
        u.name as admin_name
      FROM audit_log al
      JOIN users u ON al.admin_id = u.id
      ORDER BY al.created_at DESC
      LIMIT 10
    `);

    // Recent role changes
    const recentRoleChanges = await db.all(`
      SELECT
        al.target_id,
        al.old_value,
        al.new_value,
        al.created_at,
        u.name as admin_name
      FROM audit_log al
      JOIN users u ON al.admin_id = u.id
      WHERE al.action = 'role_change'
      ORDER BY al.created_at DESC
      LIMIT 10
    `);

    // Recent destructive actions (deletions)
    const recentDestructive = await db.all(`
      SELECT
        al.action,
        al.target_type,
        al.target_id,
        al.created_at,
        u.name as admin_name
      FROM audit_log al
      JOIN users u ON al.admin_id = u.id
      WHERE al.action IN ('report_delete')
      ORDER BY al.created_at DESC
      LIMIT 10
    `);

    // Audit log size
    const auditLogSize = await db.get('SELECT COUNT(*) as count FROM audit_log');

    res.json({
      total_administrators: adminCount.count,
      recent_actions: recentActions,
      recent_role_changes: recentRoleChanges,
      recent_destructive_actions: recentDestructive,
      audit_log_entries: auditLogSize.count,
      // Note: "active admins" would require an is_active field which doesn't
      // exist. Security (authentication/authorization) events live in the
      // security_events table and are served by GET /api/admin/security-events.
    });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Failed to fetch security overview' });
  }
});

export default router;
