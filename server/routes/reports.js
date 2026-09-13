import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import jwt from 'jsonwebtoken';
import { getDatabase } from '../config/database.js';
import { authenticateToken } from '../middleware/auth.js';
import {
  ALLOWED_REPORT_STATUSES,
  ALLOWED_SEVERITIES,
  JWT_VERIFY_OPTIONS,
  LIMITS,
  detectImageMime,
  getJwtSecret,
  isNonEmptyString,
  isPositiveIntId,
  normalizeText,
  validateCoordinates,
} from '../config/security.js';

const router = express.Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '../uploads'));
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage,
  limits: { fileSize: LIMITS.imageBytes, files: 1, fields: 20 },
  fileFilter: (req, file, cb) => {
    // Only raster image types; SVG and other active formats are rejected.
    // Note: the generated filename comes from file.fieldname plus a random
    // suffix, and the extension is validated again after the bytes are
    // sniffed below — neither the client filename nor its mimetype is trusted.
    const filetypes = /jpeg|jpg|png|webp/;
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = filetypes.test(file.mimetype);
    if (extname && mimetype) {
      return cb(null, true);
    }
    cb(new Error('Please choose a JPG, PNG or WebP image.'));
  }
});

/**
 * Authoritative upload check: content-sniffs the stored file's leading bytes.
 * The client-supplied mimetype/extension alone can be forged, so after Multer
 * writes the file we verify it really is a JPEG/PNG/WebP and delete it from
 * disk when it is not. Everything stays inside the uploads directory.
 */
async function removeInvalidUpload(file) {
  if (!file) return;
  try {
    await fs.unlink(file.path);
  } catch {
    // best-effort cleanup
  }
}

function isAllowedUploadFile(file) {
  try {
    const fd = fs.openSync(file.path, 'r');
    try {
      const header = Buffer.alloc(12);
      const { bytesRead } = fs.readSync(fd, header, 0, 12, 0);
      return detectImageMime(header.subarray(0, bytesRead)) !== null;
    } finally {
      fs.closeSync(fd);
    }
  } catch {
    return false;
  }
}

/**
 * Builds the public report ID from a per-year sequence number.
 * Format: ECO-YYYY-NNNNN (unchanged; existing data keeps working).
 */
function formatReportId(year, seq) {
  return `ECO-${year}-${String(seq).padStart(5, '0')}`;
}

/**
 * F-01: concurrency-safe report ID allocation.
 *
 * The previous implementation read MAX(id)+1 in one query and INSERTed in a
 * second, unsynchronized step. Two concurrent requests could both read the
 * same "latest" ID, both compute the same next ID, and the loser hit
 * SQLITE_CONSTRAINT (UNIQUE hazard_reports.id) -> unexpected 500s (15/16 in
 * the reproduced audit).
 *
 * Fix: allocate the sequence inside a BEGIN IMMEDIATE transaction. IMMEDIATE
 * takes the database write lock up front, so read (current max) and insert
 * become one atomic unit — no two requests can ever compute the same ID.
 * The transaction is kept intentionally short: two statements, no side
 * effects inside, so writers queue briefly behind the write lock instead of
 * racing. Existing rows (e.g. seeded ECO-2026-00001..00010) are honoured by
 * scanning the actual stored IDs, so the next ID always continues from real
 * data regardless of what created it.
 *
 * A bounded retry (max 5 attempts) on SQLITE_BUSY covers lock hand-off during
 * very heavy contention. If an ID is somehow exhausted/invalid, the retry loop
 * stops and an Error is thrown; no unbounded loop, no swallowed constraint.
 */
const REPORT_ID_ALLOCATION_MAX_ATTEMPTS = 5;

async function allocateReportId(db, insertReport) {
  const currentYear = new Date().getFullYear();
  const prefix = `ECO-${currentYear}-`;

  let lastError = null;
  for (let attempt = 1; attempt <= REPORT_ID_ALLOCATION_MAX_ATTEMPTS; attempt++) {
    try {
      await db.exec('BEGIN IMMEDIATE');
    } catch (err) {
      // Lock hand-off: someone else holds the write lock. Bounded backoff then retry.
      if (attempt < REPORT_ID_ALLOCATION_MAX_ATTEMPTS) {
        await new Promise((resolve) => setTimeout(resolve, 25 * attempt));
        continue;
      }
      throw err;
    }

    try {
      const result = await db.get(
        "SELECT id FROM hazard_reports WHERE id LIKE ? ORDER BY id DESC LIMIT 1",
        [`${prefix}%`]
      );

      let nextSeq = 1;
      if (result) {
        const match = result.id.match(/ECO-\d{4}-(\d{5})$/);
        if (match) {
          nextSeq = parseInt(match[1], 10) + 1;
        } else {
          throw new Error('Report ID sequence is corrupted: cannot derive next sequence');
        }
      }

      const reportId = formatReportId(currentYear, nextSeq);
      await insertReport(reportId);
      await db.exec('COMMIT');
      return reportId;
    } catch (err) {
      // Roll back whatever part of the transaction ran; then decide whether to retry.
      try {
        await db.exec('ROLLBACK');
      } catch {
        // Already rolled back / connection not in a transaction — nothing to do.
      }

      const busy =
        err && (err.code === 'SQLITE_BUSY' || err.code === 'SQLITE_BUSY_SNAPSHOT');
      if (busy && attempt < REPORT_ID_ALLOCATION_MAX_ATTEMPTS) {
        await new Promise((resolve) => setTimeout(resolve, 25 * attempt));
        continue;
      }
      throw err;
    }
  }

  // Unreachable in practice: every loop iteration either returns or throws.
  throw lastError || new Error('Report ID allocation failed after retries');
}

router.get('/', async (req, res) => {
  try {
    const { status, category, severity } = req.query;

    if (status && !ALLOWED_REPORT_STATUSES.includes(status)) {
      return res.status(400).json({ error: 'Unknown status filter' });
    }
    if (severity && !ALLOWED_SEVERITIES.includes(severity)) {
      return res.status(400).json({ error: 'Unknown severity filter' });
    }
    if (category && (typeof category !== 'string' || category.length > LIMITS.hazardType)) {
      return res.status(400).json({ error: 'Invalid category filter' });
    }

    const db = await getDatabase();

    let query = 'SELECT r.*, u.name as reporter_name FROM hazard_reports r LEFT JOIN users u ON r.user_id = u.id WHERE 1=1';
    const params = [];

    if (status) {
      query += ' AND r.status = ?';
      params.push(status);
    }
    if (category) {
      query += ' AND r.hazard_type = ?';
      params.push(category);
    }
    if (severity) {
      query += ' AND r.severity = ?';
      params.push(severity);
    }

    // id DESC breaks ties: several reports can share the same created_at second.
    query += ' ORDER BY r.created_at DESC, r.id DESC';
    const reports = await db.all(query, params);
    res.json(reports);
  } catch (error) {
    console.error('Error fetching reports:', error);
    res.status(500).json({ error: 'Failed to fetch reports' });
  }
});

router.get('/my-reports', authenticateToken, async (req, res) => {
  try {
    const db = await getDatabase();
    const reports = await db.all(
      // id DESC breaks ties, same as the public list.
      'SELECT * FROM hazard_reports WHERE user_id = ? ORDER BY created_at DESC, id DESC',
      [req.user.id]
    );
    res.json(reports);
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Failed to fetch reports' });
  }
});

router.post('/submit', (req, res) => {
  upload.single('image')(req, res, async (err) => {
    if (err) {
      // Surface multer failures in plain language that matches the client form.
      const message = err.code === 'LIMIT_FILE_SIZE'
        ? 'Image is over the 5 MB limit — try a smaller one.'
        : err.code === 'LIMIT_FILE_COUNT'
        ? 'Only one image can be attached per report.'
        : err.code === 'LIMIT_UNEXPECTED_FILE'
        ? 'Unexpected file field — use the image field.'
        : err.message;
      return res.status(400).json({ error: message });
    }

    try {
      const body = req.body || {};

      // Content-sniff the stored upload: a forged mimetype (e.g. a script or
      // polyglot file renamed to .jpg) is caught here and deleted from disk.
      if (req.file) {
        if (!isAllowedUploadFile(req.file)) {
          await removeInvalidUpload(req.file);
          req.file = undefined;
          return res.status(400).json({ error: 'Please choose a JPG, PNG or WebP image.' });
        }
      }

      const hazard_type = normalizeText(body.hazard_type, LIMITS.hazardType);
      const title = normalizeText(body.title, LIMITS.title);
      const description = normalizeText(body.description, LIMITS.description);
      const location = normalizeText(body.location, LIMITS.location);
      const severity = typeof body.severity === 'string' ? body.severity.trim() : '';
      const notes = normalizeText(body.notes, LIMITS.notes);

      if (!hazard_type) {
        return res.status(400).json({ error: 'Hazard type is required' });
      }
      if (!title) {
        return res.status(400).json({ error: 'A short title is required' });
      }
      if (!description) {
        return res.status(400).json({ error: 'Please describe what you saw' });
      }
      if (!location) {
        return res.status(400).json({ error: 'Location is required' });
      }
      if (!isNonEmptyString(severity) || !ALLOWED_SEVERITIES.includes(severity)) {
        return res.status(400).json({ error: 'Severity must be one of: Low, Moderate, High, Critical' });
      }

      const hasLat = body.latitude !== undefined && body.latitude !== null && body.latitude !== '';
      const hasLng = body.longitude !== undefined && body.longitude !== null && body.longitude !== '';
      if (hasLat !== hasLng) {
        return res.status(400).json({ error: 'Both latitude and longitude are required together' });
      }
      if (hasLat) {
        const coordError = validateCoordinates(body.latitude, body.longitude);
        if (coordError) {
          return res.status(400).json({ error: coordError });
        }
      }
      const latitude = hasLat ? Number(body.latitude) : null;
      const longitude = hasLng ? Number(body.longitude) : null;

      const db = await getDatabase();

      // Optional auth: associates the report when a valid token is sent.
      // Attribution is DB-backed, mirroring authenticateToken: the token alone
      // is never trusted. Only an existing, currently-active account may be
      // associated with a submission, so a suspended/disabled/deleted account's
      // still-cryptographically-valid JWT silently degrades to an anonymous
      // report instead of exercising authenticated behavior (attribution and
      // the reporter notification) while suspended.
      let userId = null;
      const authHeader = req.headers['authorization'];
      const match = authHeader ? authHeader.match(/^Bearer\s+(.+)$/i) : null;
      if (match) {
        try {
          const decoded = jwt.verify(match[1].trim(), getJwtSecret(), JWT_VERIFY_OPTIONS);
          if (decoded && Number.isInteger(decoded.id)) {
            const account = await db.get('SELECT id, status FROM users WHERE id = ?', [decoded.id]);
            if (account && account.status === 'active') userId = decoded.id;
          }
        } catch (e) {
          // invalid token on an anonymous submission is simply ignored
        }
      }
      const imageUrl = req.file ? `/uploads/${req.file.filename}` : null;

      // F-01: the report row (including its freshly allocated ID) is inserted
      // inside the same transaction that allocates the ID. The notification is
      // deliberately written AFTER the transaction commits — it is not part of
      // ID allocation, and keeping it outside keeps the write lock held for the
      // minimum time.
      const reportId = await allocateReportId(db, async (allocatedId) => {
        await db.run(
          `INSERT INTO hazard_reports (
            id, user_id, hazard_type, title, description, location,
            latitude, longitude, severity, image_url, status, admin_notes
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            allocatedId, userId, hazard_type, title, description, location,
            latitude, longitude, severity, imageUrl, 'Submitted', notes
          ]
        );
      });

      if (userId) {
        await db.run(
          'INSERT INTO notifications (user_id, title, message) VALUES (?, ?, ?)',
          [userId, 'Report received', `Thanks for reporting this. ${reportId} is on the record, and a ranger will review it soon.`]
        );
      }

      res.status(201).json({ success: true, reportId });
    } catch (error) {
      console.error('Error:', error);
      res.status(500).json({ error: 'Failed to submit report' });
    }
  });
});

router.get('/track/:id', async (req, res) => {
  try {
    // Report ids are server-generated (ECO-YYYY-#####). Reject anything with
    // another shape — including traversal characters such as / or \. — before
    // it reaches a query. The LIKE-prefix below is for the admin list only.
    const reportId = String(req.params.id || '');
    if (!/^ECO-\d{4}-\d{5}$/.test(reportId)) {
      return res.status(400).json({ error: 'Invalid report id' });
    }

    const db = await getDatabase();
    const report = await db.get(
      'SELECT r.*, u.name as reporter_name FROM hazard_reports r LEFT JOIN users u ON r.user_id = u.id WHERE r.id = ?',
      [reportId]
    );

    if (!report) {
      return res.status(404).json({ error: 'Report not found' });
    }

    res.json(report);
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Failed to track report' });
  }
});

export default router;
