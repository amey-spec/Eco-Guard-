import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { initDatabase } from './config/database.js';
import { getJwtSecret, IS_PRODUCTION } from './config/security.js';
import { assertNoLiveDefaultDemoAdminInProduction } from './config/demoAdminProtection.js';

import authRoutes from './routes/auth.js';
import hazardRoutes from './routes/hazards.js';
import reportRoutes from './routes/reports.js';
import educationRoutes from './routes/education.js';
import quizRoutes from './routes/quiz.js';
import notificationRoutes from './routes/notifications.js';
import adminRoutes from './routes/admin.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5000;

app.disable('x-powered-by');
// Only trust proxies when explicitly enabled (deployments behind a load balancer).
app.set('trust proxy', process.env.TRUST_PROXY === '1' ? 1 : false);

// Fail fast in production when the JWT secret is missing or weak.
if (IS_PRODUCTION) getJwtSecret();

// Security headers. cross-origin resource policy is opened so uploaded images
// (served from this API) can be embedded by the frontend on another origin.
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));

// Scoped CORS: browsers must come from an allow-listed origin.
const allowedOrigins = (process.env.CORS_ORIGINS || 'http://localhost:5173,http://127.0.0.1:5173')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

app.use(
  cors({
    origin(origin, callback) {
      // Non-browser clients (curl, servers) send no Origin header and pass.
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      console.warn(`Blocked request from origin: ${origin}`);
      return callback(new Error('Origin not allowed by CORS'));
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    maxAge: 86400,
  })
);

// Bounded request bodies. urlencoded is parsed in non-extended (query-string)
// mode so values are always plain strings — nested objects via qs syntax
// (user[role]=admin) are never materialized from the body.
app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ extended: false, limit: '100kb' }));

// Malformed or oversized bodies would otherwise surface as a generic 500 from
// the central handler. Map body-parser failures to their proper status codes
// with safe, non-revealing messages.
function isBodyParserError(err) {
  return err && (err.type === 'entity.parse.failed' || err.type === 'entity.too.large' || err.type === 'entity.verify.failed' || err.type === 'encoding.unsupported');
}

app.use((err, req, res, next) => {
  if (!isBodyParserError(err)) return next(err);
  const tooLarge = err.type === 'entity.too.large' || err.statusCode === 413;
  return res.status(tooLarge ? 413 : 400).json({
    error: tooLarge ? 'Request body is too large' : 'Malformed request body',
  });
});

/* ---------------- Rate limiting ----------------
 *
 * Budgets are env-tunable (mirroring LOGIN_RATE_LIMIT_*) so test suites that
 * legitimately exercise many auth round-trips from one source can raise them
 * per-process. Production defaults stay 300/15min (API) and 20/15min (auth).
 */
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: Number(process.env.API_RATE_LIMIT_MAX) || 300,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many requests — please slow down and try again shortly' },
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: Number(process.env.AUTH_RATE_LIMIT_MAX) || 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many sign-in attempts — please wait a few minutes' },
});

// Report submissions are the only write-heavy public surface (anonymous
// uploads included), so they get a tighter per-IP budget than the API default.
const submitLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many report submissions — please wait a few minutes and try again' },
});

app.use('/api', apiLimiter);
app.use('/api/auth', authLimiter);
app.use('/api/reports/submit', submitLimiter);

/* ---------------- Uploaded images ---------------- */
const uploadsDir = path.join(__dirname, 'uploads');
fs.mkdirSync(uploadsDir, { recursive: true });

app.use(
  '/uploads',
  express.static(uploadsDir, {
    dotfiles: 'ignore',
    index: false,
    fallthrough: false,
    setHeaders(res) {
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    },
  })
);

/* ---------------- API routes ---------------- */
app.use('/api/auth', authRoutes);
app.use('/api/hazards', hazardRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/education', educationRoutes);
app.use('/api/quiz', quizRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/admin', adminRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'EcoGuard API is running' });
});

// JSON 404 for unknown API paths
app.use('/api', (req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

/* ---------------- Central error handler ---------------- */
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  const status = err.status || err.statusCode || 500;

  if (status >= 500) {
    console.error('Unhandled error:', err);
  } else {
    console.warn(`Request error (${status}):`, err.message);
  }

  // Never leak stack traces or internals to the client.
  let message;
  if (status >= 500) {
    message = 'Something went wrong on the server';
  } else if (err.expose) {
    message = err.message || 'Request failed';
  } else if (status === 404) {
    message = 'Not found';
  } else {
    message = 'Request could not be completed';
  }
  res.status(status).json({ error: message });
});

// Initialize database and start server
async function startServer() {
  try {
    await initDatabase();
    console.log('✓ Database initialized');

    // Priority 2: production protection against leftover default demo admin.
    // This must happen after the database is opened but before the server begins
    // accepting traffic.
    await assertNoLiveDefaultDemoAdminInProduction();

    app.listen(PORT, () => {
      console.log(`✓ Server running on http://localhost:${PORT} (${IS_PRODUCTION ? 'production' : 'development'})`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();
