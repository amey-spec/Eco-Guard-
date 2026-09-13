import jwt from 'jsonwebtoken';
import crypto from 'crypto';

export const NODE_ENV = process.env.NODE_ENV || 'development';
export const IS_PRODUCTION = NODE_ENV === 'production';

// Development-only fallback. Production refuses to boot without a real secret.
const DEV_FALLBACK_SECRET = 'ecoguard-dev-only-insecure-secret-do-not-use-in-production';

const TOKEN_ISSUER = 'ecoguard-api';
const TOKEN_AUDIENCE = 'ecoguard-client';

let cachedSecret = null;

export function getJwtSecret() {
  if (cachedSecret) return cachedSecret;

  const secret = process.env.JWT_SECRET;

  if (IS_PRODUCTION) {
    if (!secret || secret === DEV_FALLBACK_SECRET) {
      throw new Error('JWT_SECRET must be set to a strong random value in production');
    }
    if (secret.length < 32) {
      throw new Error('JWT_SECRET must be at least 32 characters in production');
    }
  }

  if (!secret) {
    console.warn('⚠ JWT_SECRET is not set — using an insecure development-only secret. Set JWT_SECRET in server/.env.');
    cachedSecret = DEV_FALLBACK_SECRET;
    return cachedSecret;
  }

  cachedSecret = secret;
  return cachedSecret;
}

// Signing base; the actual expiry is chosen per role in createAuthToken so that
// admin (ranger) sessions are shorter-lived than ordinary guardian sessions.
export const JWT_OPTIONS = {
  issuer: TOKEN_ISSUER,
  audience: TOKEN_AUDIENCE,
};

export const JWT_VERIFY_OPTIONS = { issuer: TOKEN_ISSUER, audience: TOKEN_AUDIENCE };

/** Signs a token for a user row that has at least { id, email, role }. */
export function createAuthToken(user) {
  const expiresIn =
    user.role === 'admin'
      ? process.env.JWT_ADMIN_EXPIRES_IN || '2h'
      : process.env.JWT_EXPIRES_IN || '7d';
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    getJwtSecret(),
    { ...JWT_OPTIONS, expiresIn }
  );
}

/* ---------- Application-level policy constants ---------- */

export const BCRYPT_ROUNDS = 12;

export const ALLOWED_SEVERITIES = ['Low', 'Moderate', 'High', 'Critical'];
export const ALLOWED_REPORT_STATUSES = ['Submitted', 'Pending', 'Under Review', 'Verified', 'Resolved', 'Rejected'];
export const ALLOWED_ROLES = ['user', 'admin'];

// Account lifecycle states. 'active' is the default for new/registered users;
// 'suspended' and 'disabled' accounts cannot log in and existing tokens stop
// working immediately (the status is re-checked from the database on every
// authenticated request). This allow-list is the ONLY source of truth for
// valid statuses — never accept one from the client without checking it here.
export const ALLOWED_ACCOUNT_STATUSES = ['active', 'suspended', 'disabled'];

export const LIMITS = {
  name: 80,
  email: 254,
  passwordMin: 8,
  passwordMax: 128,
  hazardType: 80,
  title: 120,
  description: 4000,
  location: 160,
  notes: 500,
  search: 100,
  answerItems: 100,
  imageBytes: 5 * 1024 * 1024,
};

/**
 * True when the value is a positive, safe integer (or a decimal-free numeric
 * string such as a URL parameter). Used for every /:id route param so that
 * 'abc', '-1', '0', '1.5' and overflowing numerics are rejected with 400
 * instead of reaching a database query.
 */
export function isPositiveIntId(value) {
  const n =
    typeof value === 'string' && value.trim() !== ''
      ? Number(value)
      : value;
  return Number.isInteger(n) && Number.isSafeInteger(n) && n > 0;
}

/**
 * Content-sniffs the leading bytes of an upload. The client-supplied mimetype
 * and extension are never trusted on their own; this is the authoritative
 * check for the raster image formats EcoGuard supports.
 */
export function detectImageMime(buf) {
  if (!Buffer.isBuffer(buf)) return null;
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    return 'image/jpeg';
  }
  if (buf.length >= 4 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) {
    return 'image/png';
  }
  if (
    buf.length >= 12 &&
    buf.toString('latin1', 0, 4) === 'RIFF' &&
    buf.toString('latin1', 8, 12) === 'WEBP'
  ) {
    return 'image/webp';
  }
  return null;
}

export const RESET_TOKEN_BYTES = 32;
export const RESET_TOKEN_EXPIRY_MS = 60 * 60 * 1000; // 60 minutes

export function generateResetToken() {
  const bytes = new Uint8Array(RESET_TOKEN_BYTES);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

export function verifyResetToken(token) {
  if (typeof token !== 'string') return null;
  // Must be exactly RESET_TOKEN_BYTES * 2 hex characters.
  if (token.length !== RESET_TOKEN_BYTES * 2) return null;
  if (!/^[0-9a-f]+$/.test(token)) return null;
  return token;
}

/* ---------- Tiny shared validators ---------- */

export function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

export function normalizeEmail(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : value;
}

export function normalizeText(value, maxLength) {
  if (typeof value !== 'string') return '';
  return value.trim().slice(0, maxLength);
}

export function isValidEmail(value) {
  return typeof value === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value.trim());
}

/** Loose but useful: at least one letter and one digit, within allowed length. */
export function validatePasswordStrength(password) {
  const p = typeof password === 'string' ? password : '';
  if (p.length < LIMITS.passwordMin) {
    return `Password must be at least ${LIMITS.passwordMin} characters`;
  }
  if (p.length > LIMITS.passwordMax) {
    return `Password must be at most ${LIMITS.passwordMax} characters`;
  }
  if (!/[A-Za-z]/.test(p) || !/[0-9]/.test(p)) {
    return 'Password must include at least one letter and one number';
  }
  return null;
}

/**
 * Validates one URL query-string parameter. Query values are always strings,
 * so anything else (an array from ?x=a&x=b, or an object from a crafted
 * extended-syntax query) is rejected. Caps length so oversized query
 * parameters fail closed with a 400.
 */
export function isPlainQueryValue(value, maxLength = LIMITS.search) {
  return typeof value === 'string' && value.length <= maxLength;
}

/** Returns a human message, or null when the coordinates are acceptable. */
export function validateCoordinates(latitude, longitude) {
  const lat = Number(latitude);
  const lng = Number(longitude);
  const latOk = Number.isFinite(lat) && lat >= -90 && lat <= 90;
  const lngOk = Number.isFinite(lng) && lng >= -180 && lng <= 180;
  if (!latOk || !lngOk) {
    return 'Location coordinates must be valid numbers (latitude -90..90, longitude -180..180)';
  }
  return null;
}
