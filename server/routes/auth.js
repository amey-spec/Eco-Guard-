import express from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import { getDatabase } from '../config/database.js';
import { authenticateToken } from '../middleware/auth.js';
import { logSecurityEvent, requestContext } from '../config/securityLog.js';
import {
  BCRYPT_ROUNDS,
  IS_PRODUCTION,
  LIMITS,
  RESET_TOKEN_BYTES,
  RESET_TOKEN_EXPIRY_MS,
  createAuthToken,
  generateResetToken,
  verifyResetToken,
  isNonEmptyString,
  isValidEmail,
  normalizeEmail,
  normalizeText,
  validatePasswordStrength,
} from '../config/security.js';

const router = express.Router();

// Rate limiter for password reset requests (prevent abuse / email flooding).
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';

const resetRequestLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many reset requests — please wait a few minutes' },
});

const resetTokenLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many reset attempts — please wait a few minutes' },
});

/* Login attempts: 5 failed attempts per 15 minutes, keyed by the combination
 * of client IP and the normalized submitted email.
 *
 * Why this key (and not IP-only or email-only):
 *   - IP-only would put every browser behind one office/NAT address into a
 *     single shared bucket, locking legitimate users out, while an attacker can
 *     still rotate IPs to keep spraying one account.
 *   - Email-only would let anyone deny service to a chosen account simply by
 *     posting bad passwords for it (trivial lockout DoS).
 *   - IP+email stops per-source credential stuffing (5 tries per account per
 *     IP) without letting one user's failures lock out another. Distributed
 *     attacks from many IPs are still throttled by the IP-wide authLimiter on
 *     /api/auth in index.js (20 req / 15 min per IP).
 *
 * skipSuccessfulRequests: only failed logins consume the budget — a legitimate
 * user signing in correctly is never penalized (a successful response
 * decrements the counter), so shared-IP usage and normal retries stay safe.
 *
 * The email is normalized with the same helper the login handler uses, so
 * "User@Example.com " and "user@example.com" share one bucket. Only the email
 * string is used for the key (never the password), and it is only held in the
 * in-memory store of express-rate-limit — it is never logged.
 *
 * The window and cap are env-tunable so tests can exercise window expiry
 * quickly; the defaults are the production values (5 per 15 minutes).
 */
const LOGIN_RATE_LIMIT_WINDOW_MS =
  Number(process.env.LOGIN_RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000;
const LOGIN_RATE_LIMIT_MAX = Number(process.env.LOGIN_RATE_LIMIT_MAX) || 5;

const loginLimiter = rateLimit({
  windowMs: LOGIN_RATE_LIMIT_WINDOW_MS,
  limit: LOGIN_RATE_LIMIT_MAX,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  keyGenerator(req, res) {
    const email = normalizeEmail(req.body?.email);
    const ipPart = req.ip ? ipKeyGenerator(req.ip) : 'unknown-ip';
    return `${ipPart}:${email || 'unknown-email'}`;
  },
  // Generic message: reveals nothing about the submitted email (existence,
  // validity) or the reason for the failures. Retry-After + RateLimit headers
  // (draft-7) carry the retry information.
  message: { error: 'Too many failed login attempts — please wait before trying again' },
});

// A fixed, valid hash used purely so login latency stays uniform even when the
// email does not exist (avoids leaking which emails are registered). Rounded to
// BCRYPT_ROUNDS so timing matches real accounts exactly.
const DUMMY_HASH = bcrypt.hashSync('ecoguard-timing-equality-dummy', BCRYPT_ROUNDS);

const PUBLIC_USER_COLUMNS = 'id, name, email, role, profile_image, theme, created_at';

// Appearance preference values accepted from clients (mirrors ThemeContext).
const THEME_VALUES = new Set(['light', 'dark', 'system']);

// Register
router.post('/register', async (req, res) => {
  try {
    const rawName = req.body?.name;
    const rawEmail = req.body?.email;
    const rawPassword = req.body?.password;

    if (!isNonEmptyString(rawName) || !isNonEmptyString(rawEmail) || !isNonEmptyString(rawPassword)) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    const name = normalizeText(rawName, LIMITS.name);
    if (!name) {
      return res.status(400).json({ error: 'Please provide your name' });
    }
    if (name.length < 2) {
      return res.status(400).json({ error: 'Name must be at least 2 characters' });
    }

    const email = normalizeEmail(rawEmail);
    if (!isValidEmail(email) || email.length > LIMITS.email) {
      return res.status(400).json({ error: 'A valid email address is required' });
    }

    const passwordIssue = validatePasswordStrength(rawPassword);
    if (passwordIssue) {
      return res.status(400).json({ error: passwordIssue });
    }

    const db = await getDatabase();

    const existingUser = await db.get('SELECT id FROM users WHERE email = ?', [email]);
    if (existingUser) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    const hashedPassword = await bcrypt.hash(rawPassword, BCRYPT_ROUNDS);

    let lastID;
    try {
      const result = await db.run(
        'INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)',
        [name, email, hashedPassword, 'user'] // role is always forced to 'user' here
      );
      lastID = result.lastID;
    } catch (error) {
      // Race between the existence check and the insert (UNIQUE constraint)
      if (String(error.message || '').toLowerCase().includes('unique')) {
        return res.status(409).json({ error: 'Email already registered' });
      }
      throw error;
    }

    const user = await db.get(`SELECT ${PUBLIC_USER_COLUMNS} FROM users WHERE id = ?`, [lastID]);
    const token = createAuthToken(user);

    res.status(201).json({ user, token });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// Login: 5 failed attempts per 15 minutes per (IP, email) pair.
router.post('/login', loginLimiter, async (req, res) => {
  try {
    const rawEmail = req.body?.email;
    const password = typeof req.body?.password === 'string' ? req.body.password : '';

    if (!isNonEmptyString(rawEmail) || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }

    const email = normalizeEmail(rawEmail);
    const db = await getDatabase();
    const user = await db.get('SELECT * FROM users WHERE email = ?', [email]);

    // Always run a bcrypt comparison so response timing does not reveal
    // whether an email is registered.
    const validPassword = user
      ? await bcrypt.compare(password, user.password)
      : await bcrypt.compare(password, DUMMY_HASH);

    if (!user || !validPassword) {
      // Security event (server-side, admin-only visibility). Never records the
      // submitted password — only the normalized email used in the attempt and,
      // when the account exists, its id as the target.
      await logSecurityEvent({
        eventType: 'login_failed',
        success: false,
        reason: 'invalid_credentials',
        targetType: user ? 'user' : null,
        targetId: user ? user.id : null,
        ...requestContext(req),
        metadata: { attempted_email: email, account_exists: Boolean(user) },
      });
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Correct credentials but the account is no longer active: refuse to issue
    // a token. (The bcrypt comparison above already ran, so timing does not
    // reveal account status.) The target id is recorded for admins only.
    if (user.status !== 'active') {
      await logSecurityEvent({
        eventType: 'login_failed',
        success: false,
        reason: user.status, // 'suspended' | 'disabled'
        targetType: 'user',
        targetId: user.id,
        ...requestContext(req),
        metadata: { attempted_email: email, account_exists: true },
      });
      return res.status(403).json({ error: 'Your account is not active' });
    }

    const token = createAuthToken(user);

    await logSecurityEvent({
      eventType: 'login_success',
      actor: { id: user.id, role: user.role },
      success: true,
      reason: 'valid_credentials',
      ...requestContext(req),
    });

    const { password: _password, ...userWithoutPassword } = user;

    res.json({ user: userWithoutPassword, token });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// Get current user profile
router.get('/profile', authenticateToken, async (req, res) => {
  try {
    const db = await getDatabase();
    const user = await db.get(
      `SELECT ${PUBLIC_USER_COLUMNS} FROM users WHERE id = ?`,
      [req.user.id]
    );

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(user);
  } catch (error) {
    console.error('Profile fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

// Update user profile
router.put('/profile', authenticateToken, async (req, res) => {
  try {
    const name = normalizeText(req.body?.name, LIMITS.name);
    if (!name || name.length < 2) {
      return res.status(400).json({ error: 'Name must be at least 2 characters' });
    }

    const db = await getDatabase();
    await db.run('UPDATE users SET name = ? WHERE id = ?', [name, req.user.id]);

    const updatedUser = await db.get(
      `SELECT ${PUBLIC_USER_COLUMNS} FROM users WHERE id = ?`,
      [req.user.id]
    );

    if (!updatedUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(updatedUser);
  } catch (error) {
    console.error('Profile update error:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// Update the account's appearance preference (light / dark / follow system)
router.put('/theme', authenticateToken, async (req, res) => {
  try {
    const theme = req.body?.theme;
    if (!THEME_VALUES.has(theme)) {
      return res.status(400).json({ error: 'Theme must be one of: light, dark, system' });
    }

    const db = await getDatabase();
    await db.run('UPDATE users SET theme = ? WHERE id = ?', [theme, req.user.id]);
    res.json({ theme });
  } catch (error) {
    console.error('Theme update error:', error);
    res.status(500).json({ error: 'Failed to update theme preference' });
  }
});

// Change password (requires the current password)
router.put('/password', authenticateToken, async (req, res) => {
  try {
    const currentPassword = typeof req.body?.current_password === 'string' ? req.body.current_password : '';
    const newPassword = typeof req.body?.new_password === 'string' ? req.body.new_password : '';

    if (!currentPassword) {
      return res.status(400).json({ error: 'Current password is required' });
    }
    const issue = validatePasswordStrength(newPassword);
    if (issue) {
      return res.status(400).json({ error: issue });
    }
    if (currentPassword === newPassword) {
      return res.status(400).json({ error: 'New password must be different from the current one' });
    }

    const db = await getDatabase();
    const user = await db.get('SELECT id, password FROM users WHERE id = ?', [req.user.id]);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const matches = await bcrypt.compare(currentPassword, user.password);
    if (!matches) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
    await db.run('UPDATE users SET password = ? WHERE id = ?', [hashedPassword, req.user.id]);

    res.json({ success: true });
  } catch (error) {
    console.error('Password change error:', error);
    res.status(500).json({ error: 'Failed to change password' });
  }
});

/* ---------------- Password reset flow ----------------
 *
 * Two endpoints:
 *   POST /auth/forgot-password  — validate email, create a single-use reset
 *                                 token, return a generic response (never reveal
 *                                 whether the email exists).
 *   POST /auth/reset-password   — consume a reset token + new password,
 *                                 invalidate the token, update the password.
 *
 * No email is sent by this server (email delivery infrastructure is not
 * available). The reset token is returned in the response for development.
 * In production, replace the response with an email send and return only a
 * generic acknowledgement.
 */

// POST /auth/forgot-password
router.post('/forgot-password', resetRequestLimiter, async (req, res) => {
  try {
    const rawEmail = req.body?.email;

    if (!isNonEmptyString(rawEmail) || !isValidEmail(rawEmail)) {
      return res.status(400).json({ error: 'A valid email address is required' });
    }

    const email = normalizeEmail(rawEmail);
    const db = await getDatabase();

    // Always respond with the same shape. Never reveal whether the email is
    // registered (prevents user enumeration).
    const user = await db.get('SELECT id, email FROM users WHERE email = ?', [email]);

    if (user) {
      // Invalidate any existing unused tokens for this user before creating a
      // new one (single-use per request).
      await db.run(
        'UPDATE password_reset_tokens SET used_at = CURRENT_TIMESTAMP WHERE user_id = ? AND used_at IS NULL',
        [user.id]
      );

      const token = generateResetToken();
      await db.run(
        'INSERT INTO password_reset_tokens (user_id, token) VALUES (?, ?)',
        [user.id, token]
      );

      // SECURITY: In production with email delivery, send the token to the
      // user's email and return only a generic acknowledgement. Do NOT return
      // the token in the response. This development implementation returns the
      // token in the response so the flow can be tested without email
      // infrastructure.
      //
      // The reset token is a bearer-equivalent credential. The exposure below
      // (response field + server log line) is:
      //   - FORCE-OFF in production (IS_PRODUCTION): generic response only,
      //     nothing in logs.
      //   - ON in development by default, but explicitly disableable by
      //     setting DEV_EXPOSE_RESET_TOKEN=0 in server/.env.
      const devResetFlowEnabled =
        !IS_PRODUCTION && (process.env.DEV_EXPOSE_RESET_TOKEN ?? '1') !== '0';

      if (devResetFlowEnabled) {
        // eslint-disable-next-line no-console
        console.warn(`[DEV] Password reset token for ${email}: ${token} — replace with email delivery in production`);

        return res.json({
          message: 'If an account with that email exists, a reset link has been sent.',
          // Development-only: include the token so the flow can be tested.
          // Remove this field in production when email delivery is wired up.
          resetToken: token,
        });
      }

      // Production path (and development with DEV_EXPOSE_RESET_TOKEN=0):
      // generic acknowledgement — the token never reaches responses or logs.
      return res.json({
        message: 'If an account with that email exists, a reset link has been sent.',
      });
    }

    // Generic response for non-existent email — same shape, no enumeration.
    return res.json({
      message: 'If an account with that email exists, a reset link has been sent.',
    });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ error: 'Could not process reset request' });
  }
});

// POST /auth/reset-password
router.post('/reset-password', resetTokenLimiter, async (req, res) => {
  try {
    const token = req.body?.token;
    const newPassword = req.body?.new_password;

    if (!isNonEmptyString(token)) {
      return res.status(400).json({ error: 'A reset token is required' });
    }

    const verifiedToken = verifyResetToken(token);
    if (!verifiedToken) {
      return res.status(400).json({ error: 'That reset link is no longer valid — request a new one' });
    }

    const passwordIssue = validatePasswordStrength(newPassword);
    if (passwordIssue) {
      return res.status(400).json({ error: passwordIssue });
    }

    const db = await getDatabase();

    // Find the token — must be unused and not expired. created_at is written
    // by SQLite's CURRENT_TIMESTAMP ('YYYY-MM-DD HH:MM:SS' UTC); comparing it
    // against a JS ISO string ('...T...Z') would compare text in the wrong
    // format and never match, so the cutoff is computed by SQLite itself.
    const resetRow = await db.get(
      `SELECT prt.id, prt.user_id, prt.created_at, prt.used_at, u.email, u.name
       FROM password_reset_tokens prt
       JOIN users u ON prt.user_id = u.id
       WHERE prt.token = ? AND prt.used_at IS NULL
         AND prt.created_at >= datetime('now', ?)`,
      [verifiedToken, `-${Math.round(RESET_TOKEN_EXPIRY_MS / 1000)} seconds`]
    );

    if (!resetRow) {
      // Don't reveal whether the token was invalid, expired, or already used.
      return res.status(400).json({ error: 'That reset link is no longer valid — request a new one' });
    }

    // Hash the new password.
    const hashedPassword = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);

    // Update the password and invalidate the token in one transaction-like
    // sequence. Using a transaction here would be ideal but sqlite3's sqlite
    // wrapper supports transactions — keep it simple with sequential writes
    // that are both idempotent-safe.
    await db.run('UPDATE users SET password = ? WHERE id = ?', [hashedPassword, resetRow.user_id]);

    // Mark the token as used (single-use enforcement).
    await db.run(
      'UPDATE password_reset_tokens SET used_at = CURRENT_TIMESTAMP WHERE id = ?',
      [resetRow.id]
    );

    // Invalidate all other unused tokens for this user (defense-in-depth:
    // only the most recent reset link is valid).
    await db.run(
      'UPDATE password_reset_tokens SET used_at = CURRENT_TIMESTAMP WHERE user_id = ? AND used_at IS NULL AND id != ?',
      [resetRow.user_id, resetRow.id]
    );



    // Log a security event (never the new password).
    await logSecurityEvent({
      eventType: 'password_reset',
      actor: { id: resetRow.user_id, role: 'user' },
      success: true,
      targetType: 'user',
      targetId: resetRow.user_id,
      ...requestContext(req),
      metadata: { email: resetRow.email, name: resetRow.name },
    });

    return res.json({ success: true, message: 'Your password has been reset — use your new password to sign in.' });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ error: 'Could not reset password' });
  }
});

/* ---------------- Account deletion ----------------
 *
 * DELETE /auth/account — authenticated user deletes their own account.
 *
 * Requires the current password for re-authentication (prevents an attacker
 * with a stolen token from deleting the account without knowing the password).
 *
 * Behavior:
 *   - Verifies the current password.
 *   - Marks the user as 'disabled' and replaces the password with an
 *     unusable random hash (so the account can never be logged into again,
 *     but the row is preserved for audit).
 *   - Deletes the user's notifications.
 *   - Sets hazard_reports.user_id to NULL (reports become anonymous, per the
 *     ON DELETE SET NULL FK — but we do this explicitly for clarity).
 *   - Preserves audit_log and security_events rows (they reference the user
 *     via FK with ON DELETE CASCADE — we don't cascade, we keep the evidence).
 *   - Logs a security event.
 */

router.delete('/account', authenticateToken, async (req, res) => {
  try {
    const currentPassword = typeof req.body?.current_password === 'string' ? req.body.current_password : '';

    if (!currentPassword) {
      return res.status(400).json({ error: 'Current password is required to delete your account' });
    }

    const db = await getDatabase();

    // Fetch the user's current password hash.
    const user = await db.get('SELECT id, email, password, name FROM users WHERE id = ?', [req.user.id]);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Verify the current password.
    const matches = await bcrypt.compare(currentPassword, user.password);
    if (!matches) {
      // Log a failed deletion attempt.
      await logSecurityEvent({
        eventType: 'account_deletion_attempt',
        actor: { id: req.user.id, role: 'user' },
        success: false,
        targetType: 'user',
        targetId: req.user.id,
        ...requestContext(req),
        metadata: { reason: 'invalid_password' },
      });
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    const userId = user.id;
    const userEmail = user.email;
    const userName = user.name;

    // Delete the user's notifications.
    await db.run('DELETE FROM notifications WHERE user_id = ?', [userId]);

    // Disable the account and replace the password with an unusable value.
    // The column is NOT NULL (so it cannot be cleared), and a bcrypt hash of
    // freshly generated random bytes can never be matched by any submitted
    // password — combined with status='disabled', no login is possible.
    const unusablePassword = crypto.randomBytes(32).toString('hex');
    const unusableHash = await bcrypt.hash(unusablePassword, BCRYPT_ROUNDS);
    await db.run('UPDATE users SET status = ?, password = ? WHERE id = ?', [
      'disabled',
      unusableHash,
      userId,
    ]);

    // Log a successful deletion (never the password). The security event writes
    // before the response so the audit record is durable.
    await logSecurityEvent({
      eventType: 'account_deleted',
      actor: { id: userId, role: 'user' },
      success: true,
      targetType: 'user',
      targetId: userId,
      ...requestContext(req),
      metadata: { email: userEmail, name: userName },
    });

    // The caller's JWT is now invalid (status is 'disabled' and password is NULL).
    // Clear the token from the client.
    return res.json({ success: true, message: 'Your account has been deleted.' });
  } catch (error) {
    console.error('Account deletion error:', error);
    res.status(500).json({ error: 'Could not delete account' });
  }
});

export default router;
