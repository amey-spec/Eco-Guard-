# EcoGuard — Master Project Document

> **The planet leaves signals. We help you read them.**
>
> Full-stack environmental intelligence & safety platform. Last updated: 2026-09-08.
> This document reflects the codebase AS IT EXISTS NOW. Code wins over old documentation.

---

## 1. Project Overview

### What EcoGuard is

EcoGuard is a community "neighborhood watch for the environment." People notice something wrong nearby (hazy air, polluted stream, plastic waste, flooding, burn scars), **report** it with a location and severity, **rangers** moderate it from first signal to resolution, and everyone can **learn** from a hazard atlas, field guides, safety guidance, and a quiz.

### Problem being solved

Environmental hazards often go unnoticed or unreported until they escalate. EcoGuard gives communities a structured way to notice, understand, report, and track environmental signals — turning quiet observation into collective action.

### Target users

- **Guardians** (`user` role) — community members who browse hazards, report signals, track their reports, and receive notifications.
- **Rangers** (`admin` role) — moderators who manage the report queue, update statuses, delete reports, manage users, and view audit/security logs.
- **Visitors** — anonymous browsing of the hazard atlas, dashboard, map, and safety guidance.

### Core purpose

Notice → Report → Resolve. A community signal starts as a report, moves through moderation (Submitted → Pending/Under Review → Verified → Resolved/Rejected), and the reporter gets notifications at each milestone. The map and dashboard update from the same database.

### Current project status

**🟡 Substantial core, production-readiness gaps remain.**

The application is a working full-stack demo with a complete backend API (all 7 route groups functional), a polished frontend with 15+ live pages, 9-table SQLite database with seed data, JWT authentication with strong security controls, a full admin moderation console, and a CI pipeline. It is **not** deployed to production and has several genuine gaps (password reset, account deletion, education/frontend wiring, E2E execution verification).

---

## 2. Architecture

### Frontend

- **Framework:** React 19 + Vite 8
- **Routing:** React Router 7 (`BrowserRouter`)
- **Styling:** Tailwind CSS v4 (CSS-first, `@theme` design tokens + custom CSS)
- **State:** React Context (AuthContext + ThemeContext); no Redux/MobX
- **Data fetching:** Native `fetch` via `client/src/services/api.js` (no axios)
- **Icons:** Lucide React
- **Charts:** Recharts (dashboard seasonal trends + reports-by-type pie)
- **Map:** Leaflet 1.9.4 with CartoDB Voyager tiles + custom severity pin SVGs

### Backend

- **Runtime:** Node.js (ES modules)
- **Framework:** Express 4.18.2
- **Structure:**
  - `server/index.js` — Express app setup (helmet, CORS, rate limits, body limits, static uploads, routes, health, JSON 404, central error handler, startServer)
  - `server/config/` — database.js (SQLite init), security.js (JWT + policy constants + validators), demoAdminProtection.js (production guard), securityLog.js (security event logger)
  - `server/middleware/auth.js` — authenticateToken + requireAdmin
  - `server/routes/` — auth.js, hazards.js, reports.js, education.js, quiz.js, notifications.js, admin.js (each is a thin HTTP adapter; no separate controllers/services layer)
  - `server/scripts/seed.js` — idempotent demo data seeding
  - `server/uploads/` — user-submitted images (git-ignored)
  - `server/test/` — api-smoke.test.js + production-guard.test.js

### Database

- **Technology:** SQLite 3 via `sqlite3` ^5.1.7 + `sqlite` ^5.1.1 (promise-based ES module wrapper)
- **File:** `server/database.sqlite` by default; `DATABASE_PATH` env var overrides (used by tests/CI for isolated throwaway DBs)
- **Connection:** One shared connection per process (`getDatabase()` caches a single `open()` promise)
- **Foreign keys:** Enabled (`PRAGMA foreign_keys = ON`)
- **Schema:** 9 tables (see Section 6)

### Authentication

- **Mechanism:** JWT (HS256 via `jsonwebtoken` ^9.0.2) stored in `localStorage` on the client (`ecoguard_token`)
- **Signing:** Per-user token with claims `{ id, email, role }` + issuer (`ecoguard-api`) + audience (`ecoguard-client`)
- **Expiry:** Per-role — admin 2h (`JWT_ADMIN_EXPIRES_IN`), user 7d (`JWT_EXPIRES_IN`)
- **Verification:** `authenticateToken` middleware verifies JWT + **reloads user from DB on every request** (deleted accounts & role changes take effect immediately; already-issued JWTs cannot bypass status changes)
- **Password hashing:** bcrypt 12 rounds (`BCRYPT_ROUNDS = 12`)
- **Timing-safe login:** Always runs `bcrypt.compare` (real hash if account exists, `DUMMY_HASH` if not) so response time cannot reveal whether an email is registered
- **Production enforcement:** `server/config/security.js` refuses to boot in production without strong `JWT_SECRET` (≥32 chars); dev uses explicit insecure fallback with warning
- **Demo admin production guard:** `server/config/demoAdminProtection.js` blocks production boot if default demo admin (`admin@ecoguard.com` / `admin123`) is still live with default password
- **Stats:** `NODE_ENV=production` required for production mode; default is `development`

### API architecture

- **Base URL:** `http://localhost:5000/api` (dev); configurable via `VITE_API_URL` env at build time for frontend
- **Content types:** `application/json` for most endpoints; `multipart/form-data` for report submission
- **Authentication:** Bearer token in `Authorization` header (stateless JWT)
- **Authorization:** `authenticateToken` on all protected routes; `requireAdmin` on all admin routes (checks DB-backed `req.user.role === 'admin'`, not token claims)
- **Rate limiting:** `express-rate-limit` — global API (300/15min), auth (20/15min), report submit (10/15min), per-admin operation limiters (keyed by DB-backed admin id, not IP)
- **CORS:** Scoped to allow-listed origins (`CORS_ORIGINS` env; default `http://localhost:5173,http://127.0.0.1:5173`)
- **Body limits:** 100kb JSON + URL-encoded; 5MB per file upload
- **Error handling:** Central error handler returns generic messages; stack traces logged server-side only; JSON 404 for unknown API paths
- **Health:** `GET /api/health` → `{ status: 'ok', message: 'EcoGuard API is running' }`

### File storage / uploads

- **Library:** Multer 1.4.5-lts.1, `diskStorage`
- **Destination:** `server/uploads/` (created on startup via `fs.mkdirSync`)
- **Types allowed:** JPG, PNG, WebP (both extension + MIME checked; SVG and other active formats rejected)
- **Size limit:** 5 MB per file; 1 file per submission
- **Filenames:** Randomized (timestamp + random suffix + original extension)
- **Serving:** Express static on `/uploads` with `dotfiles: 'ignore'`, `index: false`, `fallthrough: false`, `X-Content-Type-Options: nosniff`, `Cache-Control: public, max-age=31536000, immutable`
- **URLs:** Stored as `/uploads/filename`; frontend resolves via `mediaUrl()` to full API origin URL

### External services

**None.** EcoGuard is self-contained: no external APIs, no third-party auth, no email sending, no cloud storage, no payment processing. The only external network calls are:
- Google Fonts (Fraunces + Inter) — loaded in `client/index.html`
- Leaflet tile layer (CartoDB Voyager) — loaded by Leaflet at runtime
- CartoDB/OpenStreetMap attribution — displayed on map

### Overall data flow

1. Client renders pages; `AuthContext` restores session from localStorage (calls `GET /api/auth/profile`).
2. Pages fetch data via `api.js` (hazards, reports, notifications, admin data, quiz).
3. Report submission: form → `FormData` → `POST /api/reports/submit` (multipart) → server validates + inserts into `hazard_reports` + optionally notifies reporter.
4. Admin moderation: `AdminPage` → `api.admin` methods → `PUT /api/admin/reports/:id/status` or `DELETE /api/admin/reports/:id` → server updates report + creates audit entry + notifies reporter.
5. Notifications: created server-side on login success, report submission, report status changes; read via `GET /api/notifications`; marked read via `PUT /api/notifications/:id/read` or `PUT /api/notifications/read-all`.
6. Auth: register/login → JWT stored in localStorage → included in subsequent requests → `authenticateToken` reloads user from DB on every request.

---

## 3. Technology Stack

### Verified versions (from `package.json` files)

**Frontend (`client/package.json`):**
- react ^19.2.8
- react-dom ^19.2.8
- react-router-dom ^7.18.2
- tailwindcss ^4.3.3
- @tailwindcss/postcss ^4.3.3
- postcss ^8.5.26
- autoprefixer ^10.5.4
- vite ^8.2.2
- @vitejs/plugin-react ^6.1.0
- leaflet ^1.9.4
- lucide-react ^1.34.0
- recharts ^3.10.1
- @playwright/test ^1.62.1 (dev)
- oxlint ^1.79.0 (dev)

**Backend (`server/package.json`):**
- express ^4.18.2
- cors ^2.8.5
- dotenv ^16.3.1
- helmet ^8.3.0
- express-rate-limit ^8.7.0
- jsonwebtoken ^9.0.2
- bcryptjs ^2.4.3
- multer ^1.4.5-lts.1
- sqlite ^5.1.1
- sqlite3 ^5.1.7
- nodemon ^3.0.2 (dev)

**Root (`package.json`):**
- concurrently ^8.2.2 (dev)

### Build tooling

- **Frontend:** Vite 8 (dev server + production build)
- **Backend:** Node.js directly (ES modules; no build step); nodemon for dev
- **Dev orchestration:** `concurrently` runs server + client together via `npm run dev`

### Environment

- **Node.js:** 18+ required (CI uses Node 20)
- **npm:** package manager

---

## 4. Features

### Auth

| Feature | Status | Notes |
|---|---|---|
| Registration | ✅ Implemented | `POST /api/auth/register`; validated (name 2+ chars, valid email, password 8+ chars with letter+number); duplicate email → 409; returns user + JWT |
| Login | ✅ Implemented | `POST /api/auth/login`; timing-safe; 401 on bad creds; 403 if account not active; returns user + JWT |
| Logout | ✅ Implemented | Client-side token discard (stateless JWT; no server-side token store) |
| Profile (get) | ✅ Implemented | `GET /api/auth/profile`; returns public user columns (id, name, email, role, profile_image, theme, created_at) |
| Profile (update) | ✅ Implemented | `PUT /api/auth/profile`; updates name |
| Theme preference | ✅ Implemented | `PUT /api/auth/theme`; light/dark/system; synced with ThemeContext via ThemeAccountSync |
| Password change | ✅ Implemented | `PUT /api/auth/password`; requires current password; verifies it; rejects identical new password; same strength policy |
| Password reset/recovery | 🚫 Not implemented | No reset flow, no reset tokens, no email. Genuine gap. |

### Hazard Atlas

| Feature | Status | Notes |
|---|---|---|
| Browse hazards | ✅ Implemented | `GET /api/hazards`; filters: category, severity, search; rendered as HazardCard grid |
| Hazard detail | ✅ Implemented | `GET /api/hazards/:id`; shows causes/effects/prevention (JSON fields parsed) |
| Categories | ✅ Implemented | `GET /api/hazards/meta/categories`; used for filter dropdown |
| Hazard search | ✅ Implemented | Client-side filter by name/description/category + server-side `search` param (LIKE on name + description) |

### Reports

| Feature | Status | Notes |
|---|---|---|
| List reports | ✅ Implemented | `GET /api/reports`; filters: status, category, severity; joined with reporter name |
| Submit report | ✅ Implemented | `POST /api/reports/submit`; multipart; title, hazard_type, severity, location, description, optional image + coordinates + notes; generates ECO-YYYY-XXXXX ID; optional Bearer token associates report with user; anonymous submissions supported |
| My reports | ✅ Implemented | `GET /api/reports/my-reports`; protected; shown on ProfilePage |
| Track report | 🟡 Partial | `GET /api/reports/track/:id` exists and works; TrackReportPage shows hardcoded sample trail + GrowingSoon; UI not yet wired to live IDs |
| Image upload | ✅ Implemented | Multer; JPG/PNG/WebP; 5MB; randomized filename; stored in server/uploads; served with nosniff + immutable cache |
| Geolocation | ✅ Implemented | Browser geolocation API; optional; coordinates validated (lat -90..90, lng -180..180); both required together or neither |
| Report filters | ✅ Implemented | Severity + status filters on MapPage (RiskMap) and admin console |

### Dashboard (EcoPulse)

| Feature | Status | Notes |
|---|---|---|
| Stat cards | ✅ Implemented | Total reports, active issues, verified, resolved (CountUp animated) |
| Environmental meters | ✅ Implemented | 5 signals (air, water, heat, waste, habitat) scored from real community reports; fill on scroll |
| Seasonal trends chart | ✅ Implemented | Recharts LineChart; **sample data** (no historical API endpoint) |
| Reports by type chart | ✅ Implemented | Recharts PieChart; **live data** from reports |
| Recent signals | ✅ Implemented | List of 6 most recent reports |

### Risk Map

| Feature | Status | Notes |
|---|---|---|
| Interactive map | ✅ Implemented | Leaflet with CartoDB Voyager tiles; centered on NYC demo region |
| Custom severity pins | ✅ Implemented | Custom SVG pin per severity (Critical/High/Moderate/Low); pulse animation |
| Popups | ✅ Implemented | HTML popup with severity, status, title, location, hazard type, date |
| Filters | ✅ Implemented | Severity (All/Critical/High/Moderate/Low) + status (All/Submitted/Pending/Under Review/Verified/Resolved) dropdowns |
| Click to select | ✅ Implemented | Click pin → slide-out report card with details + link to track |
| Refit button | ✅ Implemented | Recenter on all visible signals |
| Mobile responsive | ✅ Implemented | Responsive height; filters reposition on small screens |

### Education

| Feature | Status | Notes |
|---|---|---|
| Backend API | ✅ Implemented | `GET /api/education` (filters: category, search); `GET /api/education/:id`; `GET /api/education/meta/categories` |
| Frontend page | 🟡 Partial | Static preview of 6 sample articles; backend API ready but **frontend not wired to it**; "full library is growing" ribbon acknowledges this |

### Quiz (EcoSense)

| Feature | Status | Notes |
|---|---|---|
| Fetch quizzes | ✅ Implemented | `GET /api/quiz`; uses first available quiz |
| Fetch quiz detail | ✅ Implemented | `GET /api/quiz/:id`; returns questions **without answer key** (answer key never leaves server) |
| Render questions | ✅ Implemented | One question at a time; option buttons with letter labels |
| Submit answers | ✅ Implemented | `POST /api/quiz/:id/submit`; sends full answer sheet; server-side grading |
| Results | ✅ Implemented | Score, total, percentage, per-question results with correct/incorrect marking + feedback text |
| Live data | ✅ Implemented | Wired to backend since 2026-09-08; no longer a hardcoded placeholder |

### Notifications

| Feature | Status | Notes |
|---|---|---|
| Inbox | ✅ Implemented | `GET /api/notifications`; protected; shows notifications with kind-based styling (received/investigation/confirmed/resolved/closed) |
| Mark read | ✅ Implemented | `PUT /api/notifications/:id/read`; per-notification |
| Mark all read | ✅ Implemented | `PUT /api/notifications/read-all` |
| Unread count | ✅ Implemented | Bell badge in navbar; refreshed on navigation |
| Empty state | ✅ Implemented | "No whispers yet" with CTA to report |

### Admin Console (Ranger Console)

| Feature | Status | Notes |
|---|---|---|
| Dashboard stats | ✅ Implemented | `GET /api/admin/stats`; total users, total reports, pending/verified/resolved, reports by category, reports by severity, recent activity |
| User list | ✅ Implemented | `GET /api/admin/users`; id, name, email, role, status, created_at |
| Report moderation queue | ✅ Implemented | Workflow buckets (awaiting/active/completed); search/filter; inline status editing; quick-move (one-click next step); full status dropdown with notes |
| Report status change | ✅ Implemented | `PUT /api/admin/reports/:id/status`; validates status enum; optional admin notes; notifies reporter; creates audit entry (only if status changed); per-admin rate limit 60/15min |
| Report deletion | ✅ Implemented | `DELETE /api/admin/reports/:id`; two-step confirmation; creates audit entry; per-admin rate limit 20/15min |
| User role management | ✅ Implemented | `PUT /api/admin/users/:id/role`; user/admin; self-demotion blocked; no-op if unchanged; creates audit entry; per-admin rate limit 10/15min |
| User status management | ✅ Implemented | `PUT /api/admin/users/:id/status`; active/suspended/disabled; self-lockout blocked; no-op if unchanged; creates audit entry; per-admin rate limit 20/15min |
| Administrators list | ✅ Implemented | `GET /api/admin/administrators`; id, name, email, role, created_at |
| Admin details | ✅ Implemented | `GET /api/admin/administrators/:id`; admin info + recent actions + recent role changes |
| Audit log | ✅ Implemented | `GET /api/admin/audit-log`; filtering (action/admin_id/target_type/target_id/start_date/end_date) + pagination (limit/offset); total count reflects filters |
| Security events | ✅ Implemented | `GET /api/admin/security-events`; read-only; type filter + pagination; parsed metadata (sensitive keys stripped) |
| Security overview | ✅ Implemented | `GET /api/admin/security-overview`; total admins, recent actions, recent role changes, recent destructive actions, audit log count |
| Toast notifications | ✅ Implemented | Inline success/error toasts for admin actions |
| Self-demotion protection | ✅ Implemented | Admin cannot change own role to user |
| Self-lockout protection | ✅ Implemented | Admin cannot suspend/disable own account |

### Profile (My EcoSpace)

| Feature | Status | Notes |
|---|---|---|
| Identity card | ✅ Implemented | Name, email, role badge, avatar initials |
| Name editing | ✅ Implemented | Inline edit + save; validates 2+ chars; updates via `PUT /api/auth/profile` |
| Password change | ✅ Implemented | Current + new + confirm; client + server validation |
| My reports | ✅ Implemented | List of user's reports with status/severity badges, description, date, image thumbnail |

### Theme

| Feature | Status | Notes |
|---|---|---|
| Light/dark/system | ✅ Implemented | ThemeContext; localStorage; OS signal for system; transition animation |
| Account sync | ✅ Implemented | ThemeAccountSync: sign in → adopt account theme; local changes → push back to account (debounced 500ms) |
| No-flash init | ✅ Implemented | Inline script in `client/index.html` applies saved/system theme before first paint |

### Legal pages

| Feature | Status | Notes |
|---|---|---|
| Privacy Policy | ✅ Implemented | Static page at `/privacy` |
| Terms & Conditions | ✅ Implemented | Static page at `/terms` |
| Cookie Policy | ✅ Implemented | Static page at `/cookies` |

### Navigation

| Feature | Status | Notes |
|---|---|---|
| Desktop navbar | ✅ Implemented | Auth-aware; theme picker; notification badge; admin shield; profile initials |
| Mobile menu | ✅ Implemented | Hamburger toggle; responsive links; auth actions |
| Protected routes | ✅ Implemented | `ProtectedRoute` component; redirects to /login with return-to destination; adminOnly variant |
| Active link highlighting | ✅ Implemented | Current route highlighted in navbar |

---

## 5. Security

### Authentication ✅ Verified

- JWT (HS256) via `jsonwebtoken`; stored in `localStorage` (`ecoguard_token`).
- Claims: `{ id, email, role }`.
- Issuer: `ecoguard-api`; Audience: `ecoguard-client`; both enforced on verify.
- Expiry: admin 2h, user 7d (configurable via `JWT_ADMIN_EXPIRES_IN` / `JWT_EXPIRES_IN`).
- **DB-backed re-verification on every request** — `authenticateToken` reloads user from DB; deleted accounts & role changes take effect immediately; already-issued JWTs cannot bypass status changes.
- Timing-safe login: always runs `bcrypt.compare` (real hash or `DUMMY_HASH` for unknown emails).
- Production JWT secret enforcement: `getJwtSecret()` throws in production if missing or <32 chars.

### Authorization ✅ Verified

- `authenticateToken` on all protected routes.
- `requireAdmin` on all admin routes — checks `req.user.role === 'admin'` from **DB-backed** user object, not token claims.
- Normal users blocked from all admin endpoints (403).
- Report deletion protected (admin only).
- User role/status changes protected (admin only).
- Self-demotion blocked; self-lockout blocked.
- Suspended users lose access immediately (DB-backed recheck).

### Password security ✅ Verified

- bcrypt 12 rounds.
- Registration: 8+ chars, at least one letter + one number.
- Password change: requires current password; verifies it; rejects identical new password; same strength policy.

### Rate limiting ✅ Verified

- Global API: 300 requests / 15 min per IP.
- Auth: 20 requests / 15 min per IP.
- Report submit: 10 requests / 15 min per IP.
- Admin operations: per-account limiters (keyed by DB-backed admin id, not IP):
  - Status changes: 60 / 15 min
  - Deletions: 20 / 15 min
  - Role changes: 10 / 15 min
  - Account status changes: 20 / 15 min

### Input validation ✅ Verified

- Enums: severity (Low/Moderate/High/Critical), report status (Submitted/Pending/Under Review/Verified/Resolved/Rejected), role (user/admin), account status (active/suspended/disabled), theme (light/dark/system).
- Coordinate ranges: lat -90..90, lng -180..180.
- Field-length caps: name 80, email 254, password 8-128, hazard_type 80, title 120, description 4000, location 160, notes 500.
- Email format validation.
- Password strength: 8+ chars, letter + number.
- Type validation: `isNonEmptyString`, coordinate number checks, enum membership, array checks (quiz answers).
- URL param validation: report IDs match `/^[A-Za-z0-9-]+$/`; notification IDs are positive integers; admin user IDs are positive integers.
- Query param validation: reports list validates status/category/severity against allow-lists; education validates category/search; hazards validates category/severity/search; audit log validates action/admin_id/target_type/target_id/start_date/end_date with regex + date parsing.
- Unexpected fields: Express only reads known fields; extra fields silently ignored; no `req.body` spread into DB queries.

### XSS protection ✅ Verified (code review)

- React renders all user content via JSX (no `dangerouslySetInnerHTML`, no `innerHTML=`, no `eval()`, no `<script>` injection in `client/src`).
- Server returns JSON only (no HTML rendering of user input).
- Content-Security-Policy header set by Helmet.
- Uploaded images served with `X-Content-Type-Options: nosniff`.
- The only inline script in HTML is the theme-init snippet, which uses `localStorage`, not user input.
- Report submission images are raster-only (JPG/PNG/WebP); SVG rejected.

### CSRF considerations ✅ Verified (code review)

- API is stateless JWT + CORS-scoped; no cookie-based auth, no server-side sessions.
- State-changing requests require `Authorization: Bearer` header (not automatable by third-party sites).
- CORS blocks cross-origin credentialed requests from non-allowed origins.
- Not a CSRF vector in current form.

### CORS ✅ Verified

- Scoped CORS with allow-listed origins (`CORS_ORIGINS` env; default `http://localhost:5173,http://127.0.0.1:5173`).
- Non-browser clients (no Origin header) pass.
- Preflight handled; `maxAge: 86400`.
- Methods: GET, POST, PUT, DELETE; allowed headers: Content-Type, Authorization.

### Helmet / security headers ✅ Verified

- Helmet with `crossOriginResourcePolicy: { policy: 'cross-origin' }` (so uploaded images can be embedded by frontend on another origin).
- `x-powered-by` disabled.

### File upload security ✅ Verified (code review)

- Allowed types: JPG, PNG, WebP (both extension + MIME checked).
- 5 MB limit per file; 1 file per submission.
- Randomized filenames (timestamp + random suffix + original extension).
- SVG and other active formats rejected.
- Stored in `server/uploads/`, served statically with `nosniff` + immutable cache.
- dotfiles ignored; `index: false`; `fallthrough: false`.
- Executable files restricted by allowed types.

### Database protections ✅ Verified

- Parameterized queries (`?` placeholders) — no string concatenation of user input into SQL.
- Foreign keys enabled (`PRAGMA foreign_keys = ON`).
- `security_events` table has no FK on `actor_user_id` (intentional — deletes never cascade security evidence).
- `saved_hazards` table removed from schema + dropped from DB (2026-09-08).
- Migration logic for `users.theme` and `users.status` columns (idempotent, `PRAGMA table_info` check + `ALTER TABLE ADD COLUMN` only if missing).

### Audit logging ✅ Verified

- **audit_log** — records admin actions: report status changes, report deletions, role changes, account status changes. Fields: admin_id, action, target_type, target_id, old_value, new_value, created_at. Admin_id + timestamp derived server-side (never trusted from client).
- **security_events** — records auth/authorization outcomes: login_failed, login_success, token_missing, token_invalid, token_account_deleted, token_account_inactive, admin_access_denied. Fields: event_type, actor_user_id, actor_role, success, target_type, target_id, ip, endpoint, reason, metadata, created_at. Sole writer: `securityLog.js` (trusted server code only). Sensitive keys (password, hash, secret, authorization, token, api key, cookie) stripped from metadata.
- Admin-only read endpoints: `GET /api/admin/audit-log`, `GET /api/admin/security-events`.
- Security overview: `GET /api/admin/security-overview` (summary of recent actions, role changes, destructive actions, audit log size).

### Account status controls ✅ Verified

- `status` column on users: `active | suspended | disabled`.
- Suspended/disabled accounts cannot log in (403).
- Existing tokens invalidated on next request (DB-backed recheck in `authenticateToken`).
- Admin can suspend/reenable users; self-lockout blocked.
- All status changes audited.

### Production guards ✅ Verified

- `server/config/security.js` — production refuses to boot without strong `JWT_SECRET`.
- `server/config/demoAdminProtection.js` — production refuses to boot if default demo admin (`admin@ecoguard.com` / `admin123`) is still live.
- `server/scripts/seed.js` — seeding disabled in production; production guard check at seed time (defense-in-depth).

### Items not verified / not implemented

- **Password reset/recovery** — not implemented (no reset flow, no reset tokens, no email). 🚫 Genuine gap.
- **Account deletion** — no endpoint for users to delete their own accounts. 🚫 Not implemented.
- **Graceful server shutdown** — no explicit `SIGTERM`/`SIGINT` handler with `server.close()` found. 🟡 Not verified.
- **Database connection lifecycle** — `getDatabase()` caches one connection; no explicit close/release on shutdown. 🟡 Not verified.
- **Git history secret scan** — blocked: no `.git` directory on disk. 🚫 Cannot verify.

---

## 6. Database

### Technology

- SQLite via `sqlite3` ^5.1.7 + `sqlite` ^5.1.1 (ES module, promise-based).
- File: `server/database.sqlite` by default; `DATABASE_PATH` env var overrides (used by tests/CI for isolated throwaway DBs).
- One shared connection per process (`getDatabase()` caches a single `open()` promise).

### Tables

| Table | Purpose | Key columns |
|---|---|---|
| **users** | Accounts (guardians + rangers) | id (INTEGER PK), name, email (UNIQUE), password, role (user/admin), status (active/suspended/disabled), profile_image, theme (light/dark/system), created_at |
| **hazards** | Hazard atlas entries | id (INTEGER PK), name (UNIQUE), category, description, severity, causes (JSON), effects (JSON), prevention (JSON) |
| **hazard_reports** | Community reports | id (TEXT PK, ECO-YYYY-XXXXX), user_id (FK → users ON DELETE SET NULL), hazard_type, title, description, location, latitude, longitude, severity, image_url, status, admin_notes, created_at, updated_at |
| **educational_resources** | Knowledge hub articles | id (INTEGER PK), title, category, content, author, created_at |
| **quizzes** | Quiz definitions | id (INTEGER PK), title, description |
| **questions** | Quiz questions | id (INTEGER PK), quiz_id (FK → quizzes ON DELETE CASCADE), question, options (JSON), correct_answer |
| **notifications** | User notifications | id (INTEGER PK), user_id (FK → users ON DELETE CASCADE), title, message, read_status (0/1), created_at |
| **audit_log** | Admin action audit trail | id (INTEGER PK), admin_id (FK → users ON DELETE CASCADE), action, target_type, target_id, old_value, new_value, created_at |
| **security_events** | Auth/security event log | id (INTEGER PK), event_type, actor_user_id (no FK — intentional), actor_role, success, target_type, target_id, ip, endpoint, reason, metadata, created_at |

### Important relationships

- `hazard_reports.user_id` → `users(id)` ON DELETE SET NULL (reports survive user deletion; become anonymous).
- `questions.quiz_id` → `quizzes(id)` ON DELETE CASCADE.
- `notifications.user_id` → `users(id)` ON DELETE CASCADE.
- `audit_log.admin_id` → `users(id)` ON DELETE CASCADE.
- `security_events` — no FK on `actor_user_id` (intentional; deletes never cascade security evidence).

### Constraints

- **UNIQUE:** users.email, hazards.name.
- **NOT NULL:** users (name, email, password, role, status); hazards (name, category, description, severity, causes, effects, prevention); hazard_reports (hazard_type, title, description, location, severity, status); educational_resources (title, category, content, author); questions (question, options, correct_answer); notifications (user_id, title, message); audit_log (admin_id, action, target_type, target_id); security_events (event_type, success).
- **DEFAULT:** users.role → 'user'; users.status → 'active'; users.theme → 'system'; hazard_reports.status → 'Submitted'; notifications.read_status → 0.

### Indexes

- `idx_security_events_created_at` on `security_events(created_at)`.
- Implicit indexes on PRIMARY KEY and UNIQUE columns.

### Migrations

- `initDatabase()` runs `CREATE TABLE IF NOT EXISTS` for all 9 tables + explicit column migration checks for `users.theme` and `users.status` (added after initial launch).
- Migration is idempotent: `PRAGMA table_info` check + `ALTER TABLE ADD COLUMN` only if missing.

### Backup / recovery

- **Not implemented.** No automated backups, no scheduled backups, no separate backup storage, no retention policy, no restore procedure. 🟡 Design-only.

### Known limitations

- SQLite is a single-file database — not suitable for high-concurrency production without careful locking handling.
- No RPO/RTO defined.
- No referential integrity audit for orphaned records (though ON DELETE SET NULL / ON DELETE CASCADE handle the known FK relationships).

---

## 7. API

### Auth

| Method | Path | Protected | Purpose |
|---|---|---|---|
| POST | `/api/auth/register` | No | Register a new user (name, email, password) |
| POST | `/api/auth/login` | No | Login (email, password) → JWT + user |
| GET | `/api/auth/profile` | Yes | Get current user's public profile |
| PUT | `/api/auth/profile` | Yes | Update current user's name |
| PUT | `/api/auth/theme` | Yes | Update current user's theme preference |
| PUT | `/api/auth/password` | Yes | Change password (requires current password) |

### Hazards

| Method | Path | Protected | Purpose |
|---|---|---|---|
| GET | `/api/hazards` | No | List hazards (filters: category, severity, search) |
| GET | `/api/hazards/:id` | No | Get hazard detail by ID |
| GET | `/api/hazards/meta/categories` | No | List distinct hazard categories |

### Reports

| Method | Path | Protected | Purpose |
|---|---|---|---|
| GET | `/api/reports` | No | List reports (filters: status, category, severity) |
| GET | `/api/reports/my-reports` | Yes | List current user's reports |
| POST | `/api/reports/submit` | Optional | Submit a report (multipart; optional image + coords; optional Bearer token) |
| GET | `/api/reports/track/:id` | No | Track a report by ID |

### Education

| Method | Path | Protected | Purpose |
|---|---|---|---|
| GET | `/api/education` | No | List resources (filters: category, search) |
| GET | `/api/education/:id` | No | Get resource detail by ID |
| GET | `/api/education/meta/categories` | No | List distinct resource categories |

### Quiz

| Method | Path | Protected | Purpose |
|---|---|---|---|
| GET | `/api/quiz` | No | List quizzes |
| GET | `/api/quiz/:id` | No | Get quiz detail + questions (answer key NOT included) |
| POST | `/api/quiz/:id/submit` | No | Submit answers → server-side grading (score, total, percentage, results) |

### Notifications

| Method | Path | Protected | Purpose |
|---|---|---|---|
| GET | `/api/notifications` | Yes | Get current user's notifications |
| PUT | `/api/notifications/:id/read` | Yes | Mark a notification as read |
| PUT | `/api/notifications/read-all` | Yes | Mark all current user's notifications as read |

### Admin (all protected + admin-only)

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/admin/stats` | Dashboard statistics (total users, total reports, pending/verified/resolved counts, reports by category, reports by severity, recent activity) |
| GET | `/api/admin/users` | List all users (id, name, email, role, status, created_at) |
| PUT | `/api/admin/reports/:id/status` | Update report status + optional admin notes (triggers notification to reporter + audit entry) |
| DELETE | `/api/admin/reports/:id` | Delete a report (audit entry created) |
| PUT | `/api/admin/users/:id/role` | Update user role (user/admin; self-demotion blocked; audit entry created) |
| PUT | `/api/admin/users/:id/status` | Update account status (active/suspended/disabled; self-lockout blocked; audit entry created) |
| GET | `/api/admin/administrators` | List administrators |
| GET | `/api/admin/administrators/:id` | Get admin details + recent actions + recent role changes |
| GET | `/api/admin/audit-log` | Get audit log entries with filtering (action/admin_id/target_type/target_id/start_date/end_date) + pagination (limit/offset) |
| GET | `/api/admin/security-events` | Get security events (read-only, admin-only) with type filter + pagination |
| GET | `/api/admin/security-overview` | Security overview summary (total admins, recent actions, recent role changes, recent destructive actions, audit log count) |

### Health

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/health` | Health check → `{ status: 'ok', message: 'EcoGuard API is running' }` |

---

## 8. Frontend

### Pages (all in `client/src/pages/`)

| Page | Route | Status | Notes |
|---|---|---|---|
| HomePage | `/` | ✅ Live | Hero with ForestSplit, marquee, EcoPulse signals, features, hazard atlas preview, how-it-works, community CTA with count-ups |
| DashboardPage | `/dashboard` | ✅ Live | EcoPulse stat cards, 5 environmental meters (scored from real reports), seasonal trends chart (sample data), reports-by-type pie chart (live data), recent signals |
| MapPage | `/map` | ✅ Live | RiskMap component + recent community signals list |
| HazardsPage | `/hazards` | ✅ Live | Search + category + severity filters, HazardCard grid |
| HazardDetailPage | `/hazards/:id` | ✅ Live | Full field note: causes/effects/prevention sections |
| ReportPage | `/report` | ✅ Live | Full submission form with image upload, geolocation, live hazard types |
| TrackReportPage | `/reports/:id` | 🟡 Partial | Shows sample trail + GrowingSoon; backend track/:id exists, UI not wired to live IDs |
| EducationPage | `/education` | 🟡 Partial | Static preview of articles; backend API ready, frontend not wired |
| SafetyPage | `/safety` | ✅ Live | Before/during/after guidance columns |
| QuizPage | `/quiz` | ✅ Live | Wired to backend: fetch quiz, render questions, submit, server-side grading, results |
| NotificationsPage | `/notifications` | ✅ Live | Protected; live inbox with mark-read, mark-all-read, kind-based styling |
| LoginPage | `/login` | ✅ Live | Demo credentials card; redirect to return-to destination |
| RegisterPage | `/register` | ✅ Live | Name/email/password/confirm; client + server validation |
| ProfilePage | `/profile` | ✅ Live | Protected; identity card, name editing, password change, my reports |
| AdminPage | `/admin` | ✅ Live | Protected + adminOnly; full moderation console + admin & security tab |
| PrivacyPolicyPage | `/privacy` | ✅ Live | Static |
| TermsPage | `/terms` | ✅ Live | Static |
| CookiePolicyPage | `/cookies` | ✅ Live | Static |
| NotFoundPage | `*` | ✅ Live | Branded 404 |

### Components (all in `client/src/components/`)

| Component | Purpose |
|---|---|
| Navbar | Responsive navbar with desktop links, mobile menu, auth-aware actions, theme picker, notification badge, admin shield |
| Footer | Multi-column link footer with disclaimer |
| ProtectedRoute | Guard for protected pages; redirects to /login (preserving destination); adminOnly variant |
| HazardCard | Hazard atlas card with icon, name, severity badge, description, causes count, link to detail |
| StatusBadge | Severity or status badge with color coding |
| ReportCard | Report listing card with title, hazard type, description, location, date, severity + status badges, link to track |
| RiskMap | Leaflet map with custom severity pins, popups, severity/status filters, click-to-select, selected report card |
| StatCard | Dashboard stat card with icon, count-up, optional trend |
| CountUp | Animated number count-up on scroll into view |
| Reveal | Scroll-reveal wrapper (fade/blur/slide in on viewport entry) |
| PageHeader | Shared hero/header for inner pages |
| ThemeAccountSync | Syncs theme preference with signed-in account (adopt on login, push back on change) |
| GrowingSoon | "Section being planted" premium state for in-progress pages |
| ForestSplit | Animated forest floor for home hero (living grove vs withered side) |
| Ornaments | Sprig, SproutMark, LeafSeal SVG ornaments |
| EcoLoader / eco-loading | Loading spinner + text states |

### Routing

- React Router 7 (`BrowserRouter`).
- `AuthProvider` wraps everything; `ThemeProvider` is the outer wrapper (in `main.jsx`).
- Protected routes use `ProtectedRoute` component; admin routes use `ProtectedRoute adminOnly`.
- Return-to-destination: login redirects to `location.state.from` or `/dashboard`.

### State / data flow

- **AuthContext** — user, loading, login, register, logout, updateUser, isAuthenticated, isAdmin. Token in `localStorage`; profile restored on load; token discard on logout.
- **ThemeContext** — theme (preference), isDark (resolved), setTheme, toggleTheme. localStorage + OS signal.
- **api.js** — all fetch calls; Bearer token injected automatically; `mediaUrl()` for upload URLs.

### UI functionality

- Dark mode via `.dark` class on `<html>` (Tailwind v4 `dark` variant).
- Theme transition animation (eased color properties, 380ms).
- Scroll-reveal animations (`Reveal` component + `useInView` hook + IntersectionObserver).
- Count-up animations (`CountUp` component).
- EcoPulse meters fill on scroll.
- Report form: client-side validation + server-side validation; image preview with revokeObjectURL; geolocation with fallback note.
- Admin console: inline editing, quick-move, two-step delete confirmation, toast notifications, search/filter.
- Notifications: unread count, mark-read, mark-all-read, kind-based icon + color.
- Mobile: hamburger menu, responsive layout.

### Current limitations

- TrackReportPage shows sample data, not live report tracking.
- EducationPage shows static preview, not live articles.
- Dashboard seasonal trends chart uses sample data (no historical API).
- No lazy loading / code splitting (single bundle; ~500KB+ JS expected for full React + Leaflet + Recharts).
- No skeleton loaders (uses spinner + text loading states).

---

## 9. Testing & CI

### Backend tests ✅ Verified

- **API smoke tests** (`server/test/api-smoke.test.js`) — 11/11 passing:
  1. Health endpoint responds.
  2. Demo admin + user can log in; wrong password rejected.
  3. Unauthenticated requests rejected with 401 (notifications, admin/users, admin/audit-log).
  4. Normal users cannot access admin endpoints (403; no client-role bypass).
  5. Admin can read users, audit log, security events.
  6. Suspended accounts cannot log in; reactivation restores access.
  7. Admin self-lockout prevented.
  8. Unknown API routes return JSON 404.
  Plus 3 more production-guard tests in `production-guard.test.js`.

- **Production guard tests** (`server/test/production-guard.test.js`) — 3/3 passing:
  1. Production refuses to boot without `JWT_SECRET`.
  2. Production refuses to boot while default demo admin is live.
  3. Production boots and serves with strong ephemeral secret on clean DB.

- Run via: `cd server && npm test` (which runs `node --test test/api-smoke.test.js test/production-guard.test.js`).

### Frontend tests 🔵 Not verified

- **Playwright E2E** — config + test runner exist (`npm run test:e2e` in `client/package.json`); CI has an `e2e` job that seeds a DB, boots the API, and runs the suite. **Local execution not verified in this session.** 🟡 Needs verification.
- **Component tests** — none found.
- **Unit tests** — none found (backend uses `node:test` for integration-style smoke + guard tests; no frontend unit tests).

### CI/CD ✅ Verified (from `.github/workflows/ci.yml`)

**4-job pipeline:**

1. **client** — `npm ci` + production build (`npm run build`) + lint (`npm run lint` with oxlint). Runs on push to main/master + PRs + workflow_dispatch.
2. **server** — `npm ci` + syntax check (`node --check` on all .js files) + backend test suite (`npm test` = API smoke + production guard tests).
3. **security** — dependency vulnerability audit (`npm run audit:deps` = `node scripts/dependency-audit.js client && node scripts/dependency-audit.js server`).
4. **e2e** — seeds throwaway DB, boots API on :5000 with ephemeral JWT secret, runs Playwright E2E suite (`npm run test:e2e`). Locates or installs a browser for Playwright.

**CI runs in development mode by default** (no production secrets committed). E2E job generates ephemeral JWT secret at runtime. Production startup guards verified with runtime-generated secrets only.

**What has actually been executed:** Backend tests (11/11 smoke + 3/3 guard) pass. Client build passes. CI pipeline exists and is configured.

**What remains unverified:** E2E suite execution (CI job exists but hasn't been run in this session); linting (configured but not run in this session); dependency audit (configured but not run in this session).

---

## 10. Deployment & Production Readiness

### ✅ Verified locally

- **Health endpoint** — `GET /api/health` returns 200.
- **Client production build** — `cd client && npm run build` passes (Vite produces `dist/`).
- **Server startup** — boots in development mode; database initializes; routes respond.
- **Production guards** — verified via tests: production refuses without JWT_SECRET; refuses with default demo admin live; boots with strong ephemeral secret.
- **CORS** — scoped to allow-listed origins; configurable via `CORS_ORIGINS` env.
- **JWT secret enforcement** — production refuses to boot without strong secret.
- **Demo admin production guard** — production refuses to boot if default demo admin is still live.

### 🟡 Requires follow-up

- **Production hosting** — not configured. No hosting provider, domain, or TLS set up.
- **Production database** — not configured. `DATABASE_PATH` env var exists but no production DB location established.
- **Production environment variables** — `server/.env.example` exists (template); `server/.env` is gitignored. Production needs: `JWT_SECRET` (required, ≥32 chars), `NODE_ENV=production`, `PORT`, `CORS_ORIGINS`, `DATABASE_PATH`, `TRUST_PROXY` (optional), `JWT_ADMIN_EXPIRES_IN` (optional), `JWT_EXPIRES_IN` (optional).
- **Production CORS** — configurable via `CORS_ORIGINS` env; needs actual production origin(s) set.
- **Production API URL** — frontend uses `VITE_API_URL` env var at build time; needs production API URL set at build.
- **Frontend deployment** — `netlify.toml` exists for frontend build (base = client, command = `npm ci && npm run build`, publish = dist). Not deployed.
- **HTTPS/TLS** — not configured (requires hosting + domain).
- **Monitoring & logging** — security event logging + admin audit logging exist. Application monitoring, error tracking, uptime monitoring, log aggregation — not configured.
- **Backup & disaster recovery** — not implemented.

### 🚫 Unavailable / not configured

- **Production environment** — does not exist.
- **Git history** — no `.git` directory on disk; cannot verify secret exposure in history.
- **CI runners** — CI workflow exists in `.github/workflows/ci.yml` but no live CI execution to verify.
- **E2E execution** — Playwright config + CI job exist; local execution not verified in this session.

---

## 11. Known Gaps

### Genuine application gaps

| Gap | Severity | Notes |
|---|---|---|
| **Password reset / recovery** | P0 | Not implemented. No reset flow, no reset tokens, no email. Requires email capability + reset token storage + expiration logic + UI flow. |

---

## 12. Security / Production Blockers

### Actual application problems (P0/P1)

1. **Password reset/recovery not implemented** — no reset flow, no reset tokens, no email capability. Users who forget their password have no recovery path. This is a product feature gap, not an environment blocker.

2. **No account deletion** — users cannot delete their own accounts. No endpoint exists. Would require an endpoint + audit trail + notification cleanup + related data handling.

### Things that cannot be verified because infrastructure doesn't exist

These are **not** application bugs — they're items that require a real `.git` repository, production environment, CI runners, or live database to verify:

- **Git history secret scan** — blocked: no `.git` directory on disk. Cannot verify whether JWT_SECRET, API keys, or other credentials were ever committed.
- **Production deployment verification** — blocked: no production environment exists. Cannot verify HTTPS, production CORS, production API URL, production startup, rollback.
- **CI execution verification** — blocked: no live CI runners. Cannot verify that the CI pipeline actually passes end-to-end (client build, server tests, security audit, E2E).
- **E2E suite execution** — 🟡 CI job exists but local execution not verified in this session.
- **Dependency vulnerability remediation** — `npm audit --omit=dev` in server/ found vulnerabilities (tar, qs). Remediation may require breaking changes (e.g., `sqlite3@6.0.1`). Not yet remediated.
- **Backup & disaster recovery** — no production database exists; backup procedures cannot be verified.

### Items that are simply not yet implemented (not blockers for current demo state)

- **Graceful server shutdown** — no SIGTERM/SIGINT handler found. Minor; doesn't affect demo/dev state.
- **Database connection lifecycle** — single shared connection cached; no explicit close on shutdown. Minor; SQLite handles this reasonably for the current scale.

---

## 13. Roadmap

### P0 — Security / critical blockers

1. **Password reset / recovery** — Add email capability (or a demo-mode placeholder), reset token storage with expiration, reset flow UI (request → email → reset → new password), and server endpoints. This is the one genuine auth surface gap.
2. **Git history secret scan** — Once a real `.git` clone is available, run `git log -S` / BFG to confirm no credentials were ever committed. If any found, rotate them.
3. **Production deployment** — Set up hosting (e.g., Render/Railway/Fly for backend, Netlify/Vercel for frontend), configure production environment variables, set up HTTPS/TLS, configure production CORS origins, test production startup.

### P1 — Important functionality

4. **Wire EducationPage to backend** — Call `GET /api/education` (with category/search filters), render live articles, link to `GET /api/education/:id` for full article view. Remove the "full library is growing" ribbon once live.
5. **Wire TrackReportPage to live data** — Read report ID from URL param, call `GET /api/reports/track/:id`, render the real status timeline from the report's status history. Remove the hardcoded sample trail + GrowingSoon.
6. **Account deletion** — Add `DELETE /api/auth/account` (or similar) for users to delete their own accounts, with audit trail, notification cleanup, and related data handling (e.g., anonymize their reports or cascade-delete).
7. **Backup & disaster recovery design** — Define RPO/RTO, implement automated SQLite backups (e.g., daily dump + rotate), store backups separately, document restore procedure.

### P2 — Quality / testing

8. **Run E2E suite** — Execute `npm run test:e2e` locally to verify the Playwright suite passes. Fix any failures.
9. **Pagination verification** — Test limit/offset on reports list, admin users, audit log, security events. Ensure consistent behavior.
10. **Orphaned records check** — Run a referential integrity audit: check for hazard_reports with invalid user_id, questions with invalid quiz_id, etc.
11. **Frontend tests** — Add component tests (Vitest + React Testing Library) for key components (Navbar, ProtectedRoute, forms, status badges).
12. **Accessibility audit** — Run axe/Lighthouse accessibility audit; fix heading hierarchy, keyboard navigation, focus states, form labels, alt text, contrast.
13. **Cross-browser testing** — Verify on Chrome, Edge, Firefox, Mobile Chrome at minimum.

### P3 — Production optimization

14. **Performance audit** — Lighthouse audit; analyze bundle size; consider code splitting (lazy load Leaflet, Recharts, admin page); image optimization.
15. **Privacy review** — Document data collection, retention policy, account deletion flow, sensitive-data minimization. Verify Privacy/Terms/Cookies pages are legally adequate.
16. **Dependency cleanup** — Run `npm audit` + `npm outdated`; remediate vulnerabilities where practical; remove unused dependencies.
17. **Graceful shutdown** — Add SIGTERM/SIGINT handler with `server.close()` + DB close.
18. **Monitoring** — Add application monitoring (e.g., structured logging, error tracking, uptime check), log aggregation for production.

### P4 — Future features

19. **Interactive map clustering** — When report count grows, cluster nearby pins on the map.
20. **Cookie-based auth option** — Alternative to localStorage JWT (httpOnly cookies) for improved security.
21. **Email notifications** — Send email at key milestones (in addition to in-app notifications).
22. **Saved hazards / watchlist** — Let users bookmark hazards they want to follow.
23. **Regional admins** — Scope admin moderation to specific regions.
24. **Report comments / discussion** — Allow threaded discussion on reports.
25. **Export / data portability** — Let users export their data (GDPR-style).

---

## 14. Current Status Summary

### What EcoGuard currently is

A **working full-stack environmental safety demo** with a complete backend REST API (7 route groups, ~30 endpoints), a polished React + Tailwind frontend with 15+ live pages, a 9-table SQLite database with rich seed data (2 users, 10 hazards, 5 educational resources, 1 quiz with 5 questions, 10 geo-pinned reports), JWT authentication with DB-backed re-verification, a full admin moderation console with audit logging, a Leaflet risk map with custom pins, and a 4-job CI pipeline.

### What is working ✅

- **All backend API routes** — auth (register/login/profile/theme/password), hazards (list/detail/categories), reports (list/my-reports/submit/track), education (list/detail/categories), quiz (list/detail/submit), notifications (list/mark-read/mark-all-read), admin (stats/users/report-status/delete/user-role/user-status/administrators/audit-log/security-events/security-overview).
- **Authentication** — registration, login (timing-safe), logout, profile management, theme sync, password change. JWT with DB-backed re-verification, issuer/audience binding, per-role expiry, production secret enforcement, demo admin production guard.
- **Authorization** — admin-only routes protected; self-demotion and self-lockout blocked; suspended users lose access immediately.
- **Report submission** — full form with image upload (JPG/PNG/WebP, 5MB), geolocation, validation, ECO-YYYY-XXXXX ID generation, optional auth association, anonymous support.
- **Admin console** — full moderation queue with workflow buckets, inline status changes, quick-move, two-step delete, user/role/status management, audit log with filtering + pagination, security overview.
- **Frontend pages** — Home, Dashboard (EcoPulse with live data), Map (Leaflet with live pins), Hazards (browse/search/filter), Hazard Detail, Report (submission form), Quiz (wired to backend), Notifications (live inbox), Login, Register, Profile (name editing + password change + my reports), Admin (full console), Safety, Privacy/Terms/Cookies, 404.
- **Security controls** — Helmet, scoped CORS, rate limiting (global + auth + submit + per-admin), input validation (enums, ranges, length caps, email format, password strength), parameterized queries, foreign keys, file upload validation (type + size + randomized names + nosniff + immutable cache), audit logging (audit_log + security_events), security event logging with sensitive key stripping.
- **CI pipeline** — 4 jobs: client build+lint, server syntax+tests, security dependency audit, E2E Playwright.
- **Backend tests** — 11/11 API smoke tests + 3/3 production guard tests passing.
- **Client production build** — passes.

### What is genuinely incomplete ⚠️

- **Education page** — backend API ready but frontend shows static preview; not wired to live articles.
- **Track report page** — backend `track/:id` works but UI shows hardcoded sample trail + GrowingSoon; not wired to live report IDs.
- **Password reset/recovery** — not implemented at all (no reset flow, no tokens, no email). Genuine auth surface gap.
- **Account deletion** — no endpoint for users to delete their own accounts.
- **E2E suite execution** — Playwright config + CI job exist; local execution not verified in this session.
- **Pagination** — implemented on some endpoints but not comprehensively tested across all list endpoints.

### What is blocked 🚫

- **Production deployment** — no hosting, domain, TLS, production database, or production environment variables configured.
- **Git history secret scan** — no `.git` directory on disk; cannot verify whether credentials were ever committed.
- **Backup & disaster recovery** — not implemented (design-only).
- **Monitoring & alerting** — security/audit logs exist; application monitoring, error tracking, uptime, alerts — not configured.
- **Cross-browser/device testing** — not done.
- **Accessibility audit** — not done.

### What should be done next (priority order)

1. **P0:** Decide on password reset approach (email service vs. demo-mode placeholder) and implement it — this is the one genuine auth gap.
2. **P0:** Once a real `.git` clone is available, run a git history secret scan to confirm no credentials were ever committed.
3. **P1:** Wire EducationPage to the backend API (call `GET /api/education`, render live articles, link to detail view).
4. **P1:** Wire TrackReportPage to live data (read ID from URL, call `GET /api/reports/track/:id`, render real timeline).
5. **P1:** Set up production deployment (hosting + environment variables + HTTPS + production CORS).
6. **P2:** Run the E2E suite locally (`npm run test:e2e`) and fix any failures.
7. **P2:** Verify pagination behavior across all list endpoints.
8. **P2:** Add a basic accessibility pass (heading hierarchy, keyboard navigation, focus states, form labels).

---

*Document generated from codebase audit on 2026-09-08. Reflects the repository as it exists now.*
</content>
</write_file>
</send_message>

The write_file tool is having trouble with the full document. Let me write it in parts. Let me finish the audit analysis first and then write the document in chunks.

Let me complete parts 11-14 and the deliverables now. Given the length, I'll write the Master Document file in sections.

<write_file
<write_file_params_example>
<write_file>
<write_file_params_example>{"path": "EcoGuard-Master-Document.md", "instructions": "EcoGuard Master Project Document - Part 1: Overview through Security", "content": "# EcoGuard — Master Project Document\n\n> **The planet leaves signals. We help you read them.**\n> Full-stack environmental intelligence & safety platform. Last updated: 2026-09-08.\n> This document reflects the codebase AS IT EXISTS NOW. Code wins over old documentation.\n\n---\n\n## 1. Project Overview\n\n### What EcoGuard is\n\nEcoGuard is a community \"neighborhood watch for the environment.\" People notice something wrong nearby (hazy air, polluted stream, plastic waste, flooding, burn scars), **report** it with a location and severity, **rangers** moderate it from first signal to resolution, and everyone can **learn** from a hazard atlas, field guides, safety guidance, and a quiz.\n\n### Problem being solved\n\nEnvironmental hazards often go unnoticed or unreported until they escalate. EcoGuard gives communities a structured way to notice, understand, report, and track environmental signals — turning quiet observation into collective action.\n\n### Target users\n\n- **Guardians** (`user` role) — community members who browse hazards, report signals, track their reports, and receive notifications.\n- **Rangers** (`admin` role) — moderators who manage the report queue, update statuses, delete reports, manage users, and view audit/security logs.\n- **Visitors** — anonymous browsing of the hazard atlas, dashboard, map, and safety guidance.\n\n### Core purpose\n\nNotice → Report → Resolve. A community signal starts as a report, moves through moderation (Submitted → Pending/Under Review → Verified → Resolved/Rejected), and the reporter gets notifications at each milestone. The map and dashboard update from the same database.\n\n### Current project status\n\n**🟡 Substantial core, production-readiness gaps remain.**\n\nThe application is a working full-stack demo with a complete backend API (all 7 route groups functional), a polished frontend with 15+ live pages, 9-table SQLite database with seed data, JWT authentication with strong security controls, a full admin moderation console, and a CI pipeline. It is **not** deployed to production and has several genuine gaps (password reset, account deletion, education/frontend wiring, E2E execution verification).\n\n---\n\n## 2. Architecture\n\n### Frontend\n\n- **Framework:** React 19 + Vite 8\n- **Routing:** React Router 7 (`BrowserRouter`)\n- **Styling:** Tailwind CSS v4 (CSS-first, `@theme` design tokens + custom CSS)\n- **State:** React Context (AuthContext + ThemeContext); no Redux/MobX\n- **Data fetching:** Native `fetch` via `client/src/services/api.js` (no axios)\n- **Icons:** Lucide React\n- **Charts:** Recharts (dashboard seasonal trends + reports-by-type pie)\n- **Map:** Leaflet 1.9.4 with CartoDB Voyager tiles + custom severity pin SVGs\n\n### Backend\n\n- **Runtime:** Node.js (ES modules)\n- **Framework:** Express 4.18.2\n- **Structure:**\n  - `server/index.js` — Express app setup (helmet, CORS, rate limits, body limits, static uploads, routes, health, JSON 404, central error handler, startServer)\n  - `server/config/` — database.js (SQLite init), security.js (JWT + policy constants + validators), demoAdminProtection.js (production guard), securityLog.js (security event logger)\n  - `server/middleware/auth.js` — authenticateToken + requireAdmin\n  - `server/routes/` — auth.js, hazards.js, reports.js, education.js, quiz.js, notifications.js, admin.js (thin HTTP adapters; no separate controllers/services layer)\n  - `server/scripts/seed.js` — idempotent demo data seeding\n  - `server/uploads/` — user-submitted images (git-ignored)\n  - `server/test/` — api-smoke.test.js + production-guard.test.js\n\n### Database\n\n- **Technology:** SQLite 3 via `sqlite3` ^5.1.7 + `sqlite` ^5.1.1 (promise-based ES module wrapper)\n- **File:** `server/database.sqlite` by default; `DATABASE_PATH` env var overrides (used by tests/CI for isolated throwaway DBs)\n- **Connection:** One shared connection per process (`getDatabase()` caches a single `open()` promise)\n- **Foreign keys:** Enabled (`PRAGMA foreign_keys = ON`)\n- **Schema:** 9 tables (see Section 6)\n\n### Authentication\n\n- **Mechanism:** JWT (HS256 via `jsonwebtoken` ^9.0.2) stored in `localStorage` on the client (`ecoguard_token`)\n- **Signing:** Per-user token with claims `{ id, email, role }` + issuer (`ecoguard-api`) + audience (`ecoguard-client`)\n- **Expiry:** Per-role — admin 2h (`JWT_ADMIN_EXPIRES_IN`), user 7d (`JWT_EXPIRES_IN`)\n- **Verification:** `authenticateToken` middleware verifies JWT + **reloads user from DB on every request** (deleted accounts & role changes take effect immediately; already-issued JWTs cannot bypass status changes)\n- **Password hashing:** bcrypt 12 rounds (`BCRYPT_ROUNDS = 12`)\n- **Timing-safe login:** Always runs `bcrypt.compare` (real hash if account exists, `DUMMY_HASH` if not) so response time cannot reveal whether an email is registered\n- **Production enforcement:** `server/config/security.js` refuses to boot in production without strong `JWT_SECRET` (≥32 chars); dev uses explicit insecure fallback with warning\n- **Demo admin production guard:** `server/config/demoAdminProtection.js` blocks production boot if default demo admin (`admin@ecoguard.com` / `admin123`) is still live with default password\n- **Modes:** `NODE_ENV=production` required for production mode; default is `development`\n\n### API architecture\n\n- **Base URL:** `http://localhost:5000/api` (dev); configurable via `VITE_API_URL` env at build time for frontend\n- **Content types:** `application/json` for most endpoints; `multipart/form-data` for report submission\n- **Authentication:** Bearer token in `Authorization` header (stateless JWT)\n- **Authorization:** `authenticateToken` on all protected routes; `requireAdmin` on all admin routes (checks DB-backed `req.user.role === 'admin'`, not token claims)\n- **Rate limiting:** `express-rate-limit` — global API (300/15min), auth (20/15min), report submit (10/15min), per-admin operation limiters (keyed by DB-backed admin id, not IP)\n- **CORS:** Scoped to allow-listed origins (`CORS_ORIGINS` env; default `http://localhost:5173,http://127.0.0.1:5173`)\n- **Body limits:** 100kb JSON + URL-encoded; 5MB per file upload\n- **Error handling:** Central error handler returns generic messages; stack traces logged server-side only; JSON 404 for unknown API paths\n- **Health:** `GET /api/health` → `{ status: 'ok', message: 'EcoGuard API is running' }`\n\n### File storage / uploads\n\n- **Library:** Multer 1.4.5-lts.1, `diskStorage`\n- **Destination:** `server/uploads/` (created on startup via `fs.mkdirSync`)\n- **Types allowed:** JPG, PNG, WebP (both extension + MIME checked; SVG and other active formats rejected)\n- **Size limit:** 5 MB per file; 1 file per submission\n- **Filenames:** Randomized (timestamp + random suffix + original extension)\n- **Serving:** Express static on `/uploads` with `dotfiles: 'ignore'`, `index: false`, `fallthrough: false`, `X-Content-Type-Options: nosniff`, `Cache-Control: public, max-age=31536000, immutable`\n- **URLs:** Stored as `/uploads/filename`; frontend resolves via `mediaUrl()` to full API origin URL\n\n### External services\n\n**None.** EcoGuard is self-contained: no external APIs, no third-party auth, no email sending, no cloud storage, no payment processing. The only external network calls are:\n- Google Fonts (Fraunces + Inter) — loaded in `client/index.html`\n- Leaflet tile layer (CartoDB Voyager) — loaded by Leaflet at runtime\n- CartoDB/OpenStreetMap attribution — displayed on map\n\n### Overall data flow\n\n1. Client renders pages; `AuthContext` restores session from localStorage (calls `GET /api/auth/profile`).\n2. Pages fetch data via `api.js` (hazards, reports, notifications, admin data, quiz).\n3. Report submission: form → `FormData` → `POST /api/reports/submit` (multipart) → server validates + inserts into `hazard_reports` + optionally notifies reporter.\n4. Admin moderation: `AdminPage` → `api.admin` methods → `PUT /api/admin/reports/:id/status` or `DELETE /api/admin/reports/:id` → server updates report + creates audit entry + notifies reporter.\n5. Notifications: created server-side on login success, report submission, report status changes; read via `GET /api/notifications`; marked read via `PUT /api/notifications/:id/read` or `PUT /api/notifications/read-all`.\n6. Auth: register/login → JWT stored in localStorage → included in subsequent requests → `authenticateToken` reloads user from DB on every request.\n\n---\n\n## 3. Technology Stack\n\n### Verified versions (from `package.json` files)\n\n**Frontend (`client/package.json`):**\n- react ^19.2.8\n- react-dom ^19.2.8\n- react-router-dom ^7.18.2\n- tailwindcss ^4.3.3\n- @tailwindcss/postcss ^4.3.3\n- postcss ^8.5.26\n- autoprefixer ^10.5.4\n- vite ^8.2.2\n- @vitejs/plugin-react ^6.1.0\n- leaflet ^1.9.4\n- lucide-react ^1.34.0\n- recharts ^3.10.1\n- @playwright/test ^1.62.1 (dev)\n- oxlint ^1.79.0 (dev)\n\n**Backend (`server/package.json`):**\n- express ^4.18.2\n- cors ^2.8.5\n- dotenv ^16.3.1\n- helmet ^8.3.0\n- express-rate-limit ^8.7.0\n- jsonwebtoken ^9.0.2\n- bcryptjs ^2.4.3\n- multer ^1.4.5-lts.1\n- sqlite ^5.1.1\n- sqlite3 ^5.1.7\n- nodemon ^3.0.2 (dev)\n\n**Root (`package.json`):**\n- concurrently ^8.2.2 (dev)\n\n### Build tooling\n\n- **Frontend:** Vite 8 (dev server + production build)\n- **Backend:** Node.js directly (ES modules; no build step); nodemon for dev\n- **Dev orchestration:** `concurrently` runs server + client together via `npm run dev`\n\n### Environment\n\n- **Node.js:** 18+ required (CI uses Node 20)\n- **npm:** package manager\n\n---\n\n## 4. Features\n\n### Auth\n\n| Feature | Status | Notes |\n|---|---|---|\n| Registration | ✅ Implemented | `POST /api/auth/register`; validated (name 2+ chars, valid email, password 8+ chars with letter+number); duplicate email → 409; returns user + JWT |\n| Login | ✅ Implemented | `POST /api/auth/login`; timing-safe; 401 on bad creds; 403 if account not active; returns user + JWT |\n| Logout | ✅ Implemented | Client-side token discard (stateless JWT; no server-side token store) |\n| Profile (get) | ✅ Implemented | `GET /api/auth/profile`; returns public user columns (id, name, email, role, profile_image, theme, created_at) |\n| Profile (update) | ✅ Implemented | `PUT /api/auth/profile`; updates name |\n| Theme preference | ✅ Implemented | `PUT /api/auth/theme`; light/dark/system; synced with ThemeContext via ThemeAccountSync |\n| Password change | ✅ Implemented | `PUT /api/auth/password`; requires current password; verifies it; rejects identical new password; same strength policy |\n| Password reset/recovery | 🚫 Not implemented | No reset flow, no reset tokens, no email. Genuine gap. |\n\n### Hazard Atlas\n\n| Feature | Status | Notes |\n|---|---|---|\n| Browse hazards | ✅ Implemented | `GET /api/hazards`; filters: category, severity, search; rendered as HazardCard grid |\n| Hazard detail | ✅ Implemented | `GET /api/hazards/:id`; shows causes/effects/prevention (JSON fields parsed) |\n| Categories | ✅ Implemented | `GET /api/hazards/meta/categories`; used for filter dropdown |\n| Hazard search | ✅ Implemented | Client-side filter by name/description/category + server-side `search` param (LIKE on name + description) |\n\n### Reports\n\n| Feature | Status | Notes |\n|---|---|---|\n| List reports | ✅ Implemented | `GET /api/reports`; filters: status, category, severity; joined with reporter name |\n| Submit report | ✅ Implemented | `POST /api/reports/submit`; multipart; title, hazard_type, severity, location, description, optional image + coordinates + notes; generates ECO-YYYY-XXXXX ID; optional Bearer token associates report with user; anonymous submissions supported |\n| My reports | ✅ Implemented | `GET /api/reports/my-reports`; protected; shown on ProfilePage |\n| Track report | 🟡 Partial | `GET /api/reports/track/:id` exists and works; TrackReportPage shows hardcoded sample trail + GrowingSoon; UI not yet wired to live IDs |\n| Image upload | ✅ Implemented | Multer; JPG/PNG/WebP; 5MB; randomized filename; stored in server/uploads; served with nosniff + immutable cache |\n| Geolocation | ✅ Implemented | Browser geolocation API; optional; coordinates validated (lat -90..90, lng -180..180); both required together or neither |\n| Report filters | ✅ Implemented | Severity + status filters on MapPage (RiskMap) and admin console |\n\n### Dashboard (EcoPulse)\n\n| Feature | Status | Notes |\n|---|---|---|\n| Stat cards | ✅ Implemented | Total reports, active issues, verified, resolved (CountUp animated) |\n| Environmental meters | ✅ Implemented | 5 signals (air, water, heat, waste, habitat) scored from real community reports; fill on scroll |\n| Seasonal trends chart | ✅ Implemented | Recharts LineChart; **sample data** (no historical API endpoint) |\n| Reports by type chart | ✅ Implemented | Recharts PieChart; **live data** from reports |\n| Recent signals | ✅ Implemented | List of 6 most recent reports |\n\n### Risk Map\n\n| Feature | Status | Notes |\n|---|---|---|\n| Interactive map | ✅ Implemented | Leaflet with CartoDB Voyager tiles; centered on NYC demo region |\n| Custom severity pins | ✅ Implemented | Custom SVG pin per severity (Critical/High/Moderate/Low); pulse animation |\n| Popups | ✅ Implemented | HTML popup with severity, status, title, location, hazard type, date |\n| Filters | ✅ Implemented | Severity (All/Critical/High/Moderate/Low) + status (All/Submitted/Pending/Under Review/Verified/Resolved) dropdowns |\n| Click to select | ✅ Implemented | Click pin → slide-out report card with details + link to track |\n| Refit button | ✅ Implemented | Recenter on all visible signals |\n| Mobile responsive | ✅ Implemented | Responsive height; filters reposition on small screens |\n\n### Education\n\n| Feature | Status | Notes |\n|---|---|---|\n| Backend API | ✅ Implemented | `GET /api/education` (filters: category, search); `GET /api/education/:id`; `GET /api/education/meta/categories` |\n| Frontend page | 🟡 Partial | Static preview of 6 sample articles; backend API ready but **frontend not wired to it**; \"full library is growing\" ribbon acknowledges this |\n\n### Quiz (EcoSense)\n\n| Feature | Status | Notes |\n|---|---|---|\n| Fetch quizzes | ✅ Implemented | `GET /api/quiz`; uses first available quiz |\n| Fetch quiz detail | ✅ Implemented | `GET /api/quiz/:id`; returns questions **without answer key** (answer key never leaves server) |\n| Render questions | ✅ Implemented | One question at a time; option buttons with letter labels |\n| Submit answers | ✅ Implemented | `POST /api/quiz/:id/submit`; sends full answer sheet; server-side grading |\n| Results | ✅ Implemented | Score, total, percentage, per-question results with correct/incorrect marking + feedback text |\n| Live data | ✅ Implemented | Wired to backend since 2026-09-08; no longer a hardcoded placeholder |\n\n### Notifications\n\n| Feature | Status | Notes |\n|---|---|---|\n| Inbox | ✅ Implemented | `GET /api/notifications`; protected; shows notifications with kind-based styling (received/investigation/confirmed/resolved/closed) |\n| Mark read | ✅ Implemented | `PUT /api/notifications/:id/read`; per-notification |\n| Mark all read | ✅ Implemented | `PUT /api/notifications/read-all` |\n| Unread count | ✅ Implemented | Bell badge in navbar; refreshed on navigation |\n| Empty state | ✅ Implemented | \"No whispers yet\" with CTA to report |\n\n### Admin Console (Ranger Console)\n\n| Feature | Status | Notes |\n|---|---|---|\n| Dashboard stats | ✅ Implemented | `GET /api/admin/stats`; total users, total reports, pending/verified/resolved, reports by category, reports by severity, recent activity |\n| User list | ✅ Implemented | `GET /api/admin/users`; id, name, email, role, status, created_at |\n| Report moderation queue | ✅ Implemented | Workflow buckets (awaiting/active/completed); search/filter; inline status editing; quick-move (one-click next step); full status dropdown with notes |\n| Report status change | ✅ Implemented | `PUT /api/admin/reports/:id/status`; validates status enum; optional admin notes; notifies reporter; creates audit entry (only if status changed); per-admin rate limit 60/15min |\n| Report deletion | ✅ Implemented | `DELETE /api/admin/reports/:id`; two-step confirmation; creates audit entry; per-admin rate limit 20/15min |\n| User role management | ✅ Implemented | `PUT /api/admin/users/:id/role`; user/admin; self-demotion blocked; no-op if unchanged; creates audit entry; per-admin rate limit 10/15min |\n| User status management | ✅ Implemented | `PUT /api/admin/users/:id/status`; active/suspended/disabled; self-lockout blocked; no-op if unchanged; creates audit entry; per-admin rate limit 20/15min |\n| Administrators list | ✅ Implemented | `GET /api/admin/administrators`; id, name, email, role, created_at |\n| Admin details | ✅ Implemented | `GET /api/admin/administrators/:id`; admin info + recent actions + recent role changes |\n| Audit log | ✅ Implemented | `GET /api/admin/audit-log`; filtering (action/admin_id/target_type/target_id/start_date/end_date) + pagination (limit/offset); total count reflects filters |\n| Security events | ✅ Implemented | `GET /api/admin/security-events`; read-only; type filter + pagination; parsed metadata (sensitive keys stripped) |\n| Security overview | ✅ Implemented | `GET /api/admin/security-overview`; total admins, recent actions, recent role changes, recent destructive actions, audit log count |\n| Toast notifications | ✅ Implemented | Inline success/error toasts for admin actions |\n| Self-demotion protection | ✅ Implemented | Admin cannot change own role to user |\n| Self-lockout protection | ✅ Implemented | Admin cannot suspend/disable own account |\n\n### Profile (My EcoSpace)\n\n| Feature | Status | Notes |\n|---|---|---|\n| Identity card | ✅ Implemented | Name, email, role badge, avatar initials |\n| Name editing | ✅ Implemented | Inline edit + save; validates 2+ chars; updates via `PUT /api/auth/profile` |\n| Password change | ✅ Implemented | Current + new + confirm; client + server validation |\n| My reports | ✅ Implemented | List of user's reports with status/severity badges, description, date, image thumbnail |\n\n### Theme\n\n| Feature | Status | Notes |\n|---|---|---|\n| Light/dark/system | ✅ Implemented | ThemeContext; localStorage; OS signal for system; transition animation |\n| Account sync | ✅ Implemented | ThemeAccountSync: sign in → adopt account theme; local changes → push back to account (debounced 500ms) |\n| No-flash init | ✅ Implemented | Inline script in `client/index.html` applies saved/system theme before first paint |\n\n### Legal pages\n\n| Feature | Status | Notes |\n|---|---|---|\n| Privacy Policy | ✅ Implemented | Static page at `/privacy` |\n| Terms & Conditions | ✅ Implemented | Static page at `/terms` |\n| Cookie Policy | ✅ Implemented | Static page at `/cookies` |\n\n### Navigation\n\n| Feature | Status | Notes |\n|---|---|---|\n| Desktop navbar | ✅ Implemented | Auth-aware; theme picker; notification badge; admin shield; profile initials |\n| Mobile menu | ✅ Implemented | Hamburger toggle; responsive links; auth actions |\n| Protected routes | ✅ Implemented | `ProtectedRoute` component; redirects to /login with return-to destination; adminOnly variant |\n| Active link highlighting | ✅ Implemented | Current route highlighted in navbar |\n\n---\n\n## 5. Security\n\n### Authentication ✅ Verified\n\n- JWT (HS256) via `jsonwebtoken`; stored in `localStorage` (`ecoguard_token`).\n- Claims: `{ id, email, role }`.\n- Issuer: `ecoguard-api`; Audience: `ecoguard-client`; both enforced on verify.\n- Expiry: admin 2h, user 7d (configurable via `JWT_ADMIN_EXPIRES_IN` / `JWT_EXPIRES_IN`).\n- **DB-backed re-verification on every request** — `authenticateToken` reloads user from DB; deleted accounts & role changes take effect immediately; already-issued JWTs cannot bypass status changes.\n- Timing-safe login: always runs `bcrypt.compare` (real hash or `DUMMY_HASH` for unknown emails).\n- Production JWT secret enforcement: `getJwtSecret()` throws in production if missing or <32 chars.\n\n### Authorization ✅ Verified\n\n- `authenticateToken` on all protected routes.\n- `requireAdmin` on all admin routes — checks `req.user.role === 'admin'` from **DB-backed** user object, not token claims.\n- Normal users blocked from all admin endpoints (403).\n- Report deletion protected (admin only).\n- User role/status changes protected (admin only).\n- Self-demotion blocked; self-lockout blocked.\n- Suspended users lose access immediately (DB-backed recheck).\n\n### Password security ✅ Verified\n\n- bcrypt 12 rounds.\n- Registration: 8+ chars, at least one letter + one number.\n- Password change: requires current password; verifies it; rejects identical new password; same strength policy.\n\n### Rate limiting ✅ Verified\n\n- Global API: 300 requests / 15 min per IP.\n- Auth: 20 requests / 15 min per IP.\n- Report submit: 10 requests / 15 min per IP.\n- Admin operations: per-account limiters (keyed by DB-backed admin id, not IP):\n  - Status changes: 60 / 15 min\n  - Deletions: 20 / 15 min\n  - Role changes: 10 / 15 min\n  - Account status changes: 20 / 15 min\n\n### Input validation ✅ Verified\n\n- Enums: severity (Low/Moderate/High/Critical), report status (Submitted/Pending/Under Review/Verified/Resolved/Rejected), role (user/admin), account status (active/suspended/disabled), theme (light/dark/system).\n- Coordinate ranges: lat -90..90, lng -180..180.\n- Field-length caps: name 80, email 254, password 8-128, hazard_type 80, title 120, description 4000, location 160, notes 500.\n- Email format validation.\n- Password strength: 8+ chars, letter + number.\n- Type validation: `isNonEmptyString`, coordinate number checks, enum membership, array checks.\n- URL param validation: report IDs match `/^[A-Za-z0-9-]+$/`; notification IDs are positive integers; admin user IDs are positive integers.\n- Query param validation: reports list validates status/category/severity against allow-lists; education validates category/search; hazards validates category/severity/search; audit log validates action/admin_id/target_type/target_id/start_date/end_date with regex + date parsing.\n- Unexpected fields: Express only reads known fields; extra fields silently ignored; no `req.body` spread into DB queries.\n\n### XSS protection ✅ Verified (code review)\n\n- React renders all user content via JSX (no `dangerouslySetInnerHTML`, no `innerHTML=`, no `eval()`, no `<script>` injection in `client/src`).\n- Server returns JSON only (no HTML rendering of user input).\n- Content-Security-Policy header set by Helmet.\n- Uploaded images served with `X-Content-Type-Options: nosniff`.\n- The only inline script in HTML is the theme-init snippet, which uses `localStorage`, not user input.\n- Report submission images are raster-only (JPG/PNG/WebP); SVG rejected.\n\n### CSRF considerations ✅ Verified (code review)\n\n- API is stateless JWT + CORS-scoped; no cookie-based auth, no server-side sessions.\n- State-changing requests require `Authorization: Bearer` header (not automatable by third-party sites).\n- CORS blocks cross-origin credentialed requests from non-allowed origins.\n- Not a CSRF vector in current form.\n\n### CORS ✅ Verified\n\n- Scoped CORS with allow-listed origins (`CORS_ORIGINS` env; default `http://localhost:5173,http://127.0.0.1:5173`).\n- Non-browser clients (no Origin header) pass.\n- Preflight handled; `maxAge: 86400`.\n- Methods: GET, POST, PUT, DELETE; allowed headers: Content-Type, Authorization.\n\n### Helmet / security headers ✅ Verified\n\n- Helmet with `crossOriginResourcePolicy: { policy: 'cross-origin' }` (so uploaded images can be embedded by frontend on another origin).\n- `x-powered-by` disabled.\n\n### File upload security ✅ Verified (code review)\n\n- Allowed types: JPG, PNG, WebP (both extension + MIME checked).\n- 5 MB limit per file; 1 file per submission.\n- Randomized filenames (timestamp + random suffix + original extension).\n- SVG and other active formats rejected.\n- Stored in `server/uploads/`, served statically with `nosniff` + immutable cache.\n- dotfiles ignored; `index: false`; `fallthrough: false`.\n- Executable files restricted by allowed types.\n\n### Database protections ✅ Verified\n\n- Parameterized queries (`?` placeholders) — no string concatenation of user input into SQL.\n- Foreign keys enabled (`PRAGMA foreign_keys = ON`).\n- `security_events` table has no FK on `actor_user_id` (intentional — deletes never cascade security evidence).\n- `saved_hazards` table removed from schema + dropped from DB (2026-09-08).\n- Migration logic for `users.theme` and `users.status` columns (idempotent, `PRAGMA table_info` check + `ALTER TABLE ADD COLUMN` only if missing).\n\n### Audit logging ✅ Verified\n\n- **audit_log** — records admin actions: report status changes, report deletions, role changes, account status changes. Fields: admin_id, action, target_type, target_id, old_value, new_value, created_at. Admin_id + timestamp derived server-side (never trusted from client).\n- **security_events** — records auth/authorization outcomes: login_failed, login_success, token_missing, token_invalid, token_account_deleted, token_account_inactive, admin_access_denied. Fields: event_type, actor_user_id, actor_role, success, target_type, target_id, ip, endpoint, reason, metadata, created_at. Sole writer: `securityLog.js` (trusted server code only). Sensitive keys (password, hash, secret, authorization, token, api key, cookie) stripped from metadata.\n- Admin-only read endpoints: `GET /api/admin/audit-log`, `GET /api/admin/security-events`.\n- Security overview: `GET /api/admin/security-overview` (summary of recent actions, role changes, destructive actions, audit log size).\n\n### Account status controls ✅ Verified\n\n- `status` column on users: `active | suspended | disabled`.\n- Suspended/disabled accounts cannot log in (403).\n- Existing tokens invalidated on next request (DB-backed recheck in `authenticateToken`).\n- Admin can suspend/reenable users; self-lockout blocked.\n- All status changes audited.\n\n### Production guards ✅ Verified\n\n- `server/config/security.js` — production refuses to boot without strong `JWT_SECRET`.\n- `server/config/demoAdminProtection.js` — production refuses to boot if default demo admin (`admin@ecoguard.com` / `admin123`) is still live.\n- `server/scripts/seed.js` — seeding disabled in production; production guard check at seed time (defense-in-depth).\n\n### Items not verified / not implemented\n\n- **Password reset/recovery** — not implemented (no reset flow, no reset tokens, no email). 🚫 Genuine gap.\n- **Account deletion** — no endpoint for users to delete their own accounts. 🚫 Not implemented.\n- **Graceful server shutdown** — no explicit `SIGTERM`/`SIGINT` handler with `server.close()` found. 🟡 Not verified.\n- **Database connection lifecycle** — `getDatabase()` caches one connection; no explicit close/release on shutdown. 🟡 Not verified.\n- **Git history secret scan** — blocked: no `.git` directory on disk. 🚫 Cannot verify.\n\n---\n\n## 6. Database\n\n### Technology\n\n- SQLite via `sqlite3` ^5.1.7 + `sqlite` ^5.1.1 (ES module, promise-based).\n- File: `server/database.sqlite` by default; `DATABASE_PATH` env var overrides (used by tests/CI for isolated throwaway DBs).\n- One shared connection per process (`getDatabase()` caches a single `open()` promise).\n\n### Tables\n\n| Table | Purpose | Key columns |\n|---|---|---|\n| **users** | Accounts (guardians + rangers) | id (INTEGER PK), name, email (UNIQUE), password, role (user/admin), status (active/suspended/disabled), profile_image, theme (light/dark/system), created_at |\n| **hazards** | Hazard atlas entries | id (INTEGER PK), name (UNIQUE), category, description, severity, causes (JSON), effects (JSON), prevention (JSON) |\n| **hazard_reports** | Community reports | id (TEXT PK, ECO-YYYY-XXXXX), user_id (FK → users ON DELETE SET NULL), hazard_type, title, description, location, latitude, longitude, severity, image_url, status, admin_notes, created_at, updated_at |\n| **educational_resources** | Knowledge hub articles | id (INTEGER PK), title, category, content, author, created_at |\n| **quizzes** | Quiz definitions | id (INTEGER PK), title, description |\n| **questions** | Quiz questions | id (INTEGER PK), quiz_id (FK → quizzes ON DELETE CASCADE), question, options (JSON), correct_answer |\n| **notifications** | User notifications | id (INTEGER PK), user_id (FK → users ON DELETE CASCADE), title, message, read_status (0/1), created_at |\n| **audit_log** | Admin action audit trail | id (INTEGER PK), admin_id (FK → users ON DELETE CASCADE), action, target_type, target_id, old_value, new_value, created_at |\n| **security_events** | Auth/security event log | id (INTEGER PK), event_type, actor_user_id (no FK — intentional), actor_role, success, target_type, target_id, ip, endpoint, reason, metadata, created_at |\n\n### Important relationships\n\n- `hazard_reports.user_id` → `users(id)` ON DELETE SET NULL (reports survive user deletion; become anonymous).\n- `questions.quiz_id` → `quizzes(id)` ON DELETE CASCADE.\n- `notifications.user_id` → `users(id)` ON DELETE CASCADE.\n- `audit_log.admin_id` → `users(id)` ON DELETE CASCADE.\n- `security_events` — no FK on `actor_user_id` (intentional; deletes never cascade security evidence).\n\n### Constraints\n\n- **UNIQUE:** users.email, hazards.name.\n- **NOT NULL:** users (name, email, password, role, status); hazards (name, category, description, severity, causes, effects, prevention); hazard_reports (hazard_type, title, description, location, severity, status); educational_resources (title, category, content, author); questions (question, options, correct_answer); notifications (user_id, title, message); audit_log (admin_id, action, target_type, target_id); security_events (event_type, success).\n- **DEFAULT:** users.role → 'user'; users.status → 'active'; users.theme → 'system'; hazard_reports.status → 'Submitted'; notifications.read_status → 0.\n\n### Indexes\n\n- `idx_security_events_created_at` on `security_events(created_at)`.\n- Implicit indexes on PRIMARY KEY and UNIQUE columns.\n\n### Migrations\n\n- `initDatabase()` runs `CREATE TABLE IF NOT EXISTS` for all 9 tables + explicit column migration checks for `users.theme` and `users.status` (added after initial launch).\n- Migration is idempotent: `PRAGMA table_info` check + `ALTER TABLE ADD COLUMN` only if missing.\n\n### Backup / recovery\n\n- **Not implemented.** No automated backups, no scheduled backups, no separate backup storage, no retention policy, no restore procedure. 🟡 Design-only.\n\n### Known limitations\n\n- SQLite is a single-file database — not suitable for high-concurrency production without careful locking handling.\n- No RPO/RTO defined.\n- No referential integrity audit for orphaned records (though ON DELETE SET NULL / ON DELETE CASCADE handle the known FK relationships).\n\n---\n\n## 7. API\n\n### Auth\n\n| Method | Path | Protected | Purpose |\n|---|---|---|---|\n| POST | `/api/auth/register` | No | Register a new user (name, email, password) |\n| POST | `/api/auth/login` | No | Login (email, password) → JWT + user |\n| GET | `/api/auth/profile` | Yes | Get current user's public profile |\n| PUT | `/api/auth/profile` | Yes | Update current user's name |\n| PUT | `/api/auth/theme` | Yes | Update current user's theme preference |\n| PUT | `/api/auth/password` | Yes | Change password (requires current password) |\n\n### Hazards\n\n| Method | Path | Protected | Purpose |\n|---|---|---|---|\n| GET | `/api/hazards` | No | List hazards (filters: category, severity, search) |\n| GET | `/api/hazards/:id` | No | Get hazard detail by ID |\n| GET | `/api/hazards/meta/categories` | No | List distinct hazard categories |\n\n### Reports\n\n| Method | Path | Protected | Purpose |\n|---|---|---|---|\n| GET | `/api/reports` | No | List reports (filters: status, category, severity) |\n| GET | `/api/reports/my-reports` | Yes | List current user's reports |\n| POST | `/api/reports/submit` | Optional | Submit a report (multipart; optional image + coords; optional Bearer token) |\n| GET | `/api/reports/track/:id` | No | Track a report by ID |\n\n### Education\n\n| Method | Path | Protected | Purpose |\n|---|---|---|---|\n| GET | `/api/education` | No | List resources (filters: category, search) |\n| GET | `/api/education/:id` | No | Get resource detail by ID |\n| GET | `/api/education/meta/categories` | No | List distinct resource categories |\n\n### Quiz\n\n| Method | Path | Protected | Purpose |\n|---|---|---|---|\n| GET | `/api/quiz` | No | List quizzes |\n| GET | `/api/quiz/:id` | No | Get quiz detail + questions (answer key NOT included) |\n| POST | `/api/quiz/:id/submit` | No | Submit answers → server-side grading (score, total, percentage, results) |\n\n### Notifications\n\n| Method | Path | Protected | Purpose |\n|---|---|---|---|\n| GET | `/api/notifications` | Yes | Get current user's notifications |\n| PUT | `/api/notifications/:id/read` | Yes | Mark a notification as read |\n| PUT | `/api/notifications/read-all` | Yes | Mark all current user's notifications as read |\n\n### Admin (all protected + admin-only)\n\n| Method | Path | Purpose |\n|---|---|---|\n| GET | `/api/admin/stats` | Dashboard statistics (total users, total reports, pending/verified/resolved counts, reports by category, reports by severity, recent activity) |\n| GET | `/api/admin/users` | List all users (id, name, email, role, status, created_at) |\n| PUT | `/api/admin/reports/:id/status` | Update report status + optional admin notes (triggers notification to reporter + audit entry) |\n| DELETE | `/api/admin/reports/:id` | Delete a report (audit entry created) |\n| PUT | `/api/admin/users/:id/role` | Update user role (user/admin; self-demotion blocked; audit entry created) |\n| PUT | `/api/admin/users/:id/status` | Update account status (active/suspended/disabled; self-lockout blocked; audit entry created) |\n| GET | `/api/admin/administrators` | List administrators |\n| GET | `/api/admin/administrators/:id` | Get admin details + recent actions + recent role changes |\n| GET | `/api/admin/audit-log` | Get audit log entries with filtering (action/admin_id/target_type/target_id/start_date/end_date) + pagination (limit/offset) |\n| GET | `/api/admin/security-events` | Get security events (read-only, admin-only) with type filter + pagination |\n| GET | `/api/admin/security-overview` | Security overview summary (total admins, recent actions, recent role changes, recent destructive actions, audit log count) |\n\n### Health\n\n| Method | Path | Purpose |\n|---|---|---|\n| GET | `/api/health` | Health check → `{ status: 'ok', message: 'EcoGuard API is running' }` |\n\n---\n\n## 8. Frontend\n\n### Pages (all in `client/src/pages/`)\n\n| Page | Route | Status | Notes |\n|---|---|---|---|\n| HomePage | `/` | ✅ Live | Hero with ForestSplit, marquee, EcoPulse signals, features, hazard atlas preview, how-it-works, community CTA with count-ups |\n| DashboardPage | `/dashboard` | ✅ Live | EcoPulse stat cards, 5 environmental meters (scored from real reports), seasonal trends chart (sample data), reports-by-type pie chart (live data), recent signals |\n| MapPage | `/map` | ✅ Live | RiskMap component + recent community signals list |\n| HazardsPage | `/hazards` | ✅ Live | Search + category + severity filters, HazardCard grid |\n| HazardDetailPage | `/hazards/:id` | ✅ Live | Full field note: causes/effects/prevention sections |\n| ReportPage | `/report` | ✅ Live | Full submission form with image upload, geolocation, live hazard types |\n| TrackReportPage | `/reports/:id` | 🟡 Partial | Shows sample trail + GrowingSoon; backend track/:id exists, UI not wired to live IDs |\n| EducationPage | `/education` | 🟡 Partial | Static preview of articles; backend API ready, frontend not wired |\n| SafetyPage | `/safety` | ✅ Live | Before/during/after guidance columns |\n| QuizPage | `/quiz` | ✅ Live | Wired to backend: fetch quiz, render questions, submit, server-side grading, results |\n| NotificationsPage | `/notifications` | ✅ Live | Protected; live inbox with mark-read, mark-all-read, kind-based styling |\n| LoginPage | `/login` | ✅ Live | Demo credentials card; redirect to return-to destination |\n| RegisterPage | `/register` | ✅ Live | Name/email/password/confirm; client + server validation |\n| ProfilePage | `/profile` | ✅ Live | Protected; identity card, name editing, password change, my reports |\n| AdminPage | `/admin` | ✅ Live | Protected + adminOnly; full moderation console + admin & security tab |\n| PrivacyPolicyPage | `/privacy` | ✅ Live | Static |\n| TermsPage | `/terms` | ✅ Live | Static |\n| CookiePolicyPage | `/cookies` | ✅ Live | Static |\n| NotFoundPage | `*` | ✅ Live | Branded 404 |\n\n### Components (all in `client/src/components/`)\n\n| Component | Purpose |\n|---|---|\n| Navbar | Responsive navbar with desktop links, mobile menu, auth-aware actions, theme picker, notification badge, admin shield |\n| Footer | Multi-column link footer with disclaimer |\n| ProtectedRoute | Guard for protected pages; redirects to /login (preserving destination); adminOnly variant |\n| HazardCard | Hazard atlas card with icon, name, severity badge, description, causes count, link to detail |\n| StatusBadge | Severity or status badge with color coding |\n| ReportCard | Report listing card with title, hazard type, description, location, date, severity + status badges, link to track |\n| RiskMap | Leaflet map with custom severity pins, popups, severity/status filters, click-to-select, selected report card |\n| StatCard | Dashboard stat card with icon, count-up, optional trend |\n| CountUp | Animated number count-up on scroll into view |\n| Reveal | Scroll-reveal wrapper (fade/blur/slide in on viewport entry) |\n| PageHeader | Shared hero/header for inner pages |\n| ThemeAccountSync | Syncs theme preference with signed-in account (adopt on login, push back on change) |\n| GrowingSoon | \"Section being planted\" premium state for in-progress pages |\n| ForestSplit | Animated forest floor for home hero (living grove vs withered side) |\n| Ornaments | Sprig, SproutMark, LeafSeal SVG ornaments |\n| EcoLoader / eco-loading | Loading spinner + text states |\n\n### Routing\n\n- React Router 7 (`BrowserRouter`).\n- `AuthProvider` wraps everything; `ThemeProvider` is the outer wrapper (in `main.jsx`).\n- Protected routes use `ProtectedRoute` component; admin routes use `ProtectedRoute adminOnly`.\n- Return-to-destination: login redirects to `location.state.from` or `/dashboard`.\n\n### State / data flow\n\n- **AuthContext** — user, loading, login, register, logout, updateUser, isAuthenticated, isAdmin. Token in `localStorage`; profile restored on load; token discard on logout.\n- **ThemeContext** — theme (preference), isDark (resolved), setTheme, toggleTheme. localStorage + OS signal.\n- **api.js** — all fetch calls; Bearer token injected automatically; `mediaUrl()` for upload URLs.\n\n### UI functionality\n\n- Dark mode via `.dark` class on `<html>` (Tailwind v4 `dark` variant).\n- Theme transition animation (eased color properties, 380ms).\n- Scroll-reveal animations (`Reveal` component + `useInView` hook + IntersectionObserver).\n- Count-up animations (`CountUp` component).\n- EcoPulse meters fill on scroll.\n- Report form: client-side validation + server-side validation; image preview with revokeObjectURL; geolocation with fallback note.\n- Admin console: inline editing, quick-move, two-step delete confirmation, toast notifications, search/filter.\n- Notifications: unread count, mark-read, mark-all-read, kind-based icon + color.\n- Mobile: hamburger menu, responsive layout.\n\n### Current limitations\n\n- TrackReportPage shows sample data, not live report tracking.\n- EducationPage shows static preview, not live articles.\n- Dashboard seasonal trends chart uses sample data (no historical API).\n- No lazy loading / code splitting (single bundle; ~500KB+ JS expected for full React + Leaflet + Recharts).\n- No skeleton loaders (uses spinner + text loading states).\n\n---\n\n## 9. Testing & CI\n\n### Backend tests ✅ Verified\n\n- **API smoke tests** (`server/test/api-smoke.test.js`) — 11/11 passing:\n  1. Health endpoint responds.\n  2. Demo admin + user can log in; wrong password rejected.\n  3. Unauthenticated requests rejected with 401 (notifications, admin/users, admin/audit-log).\n  4. Normal users cannot access admin endpoints (403; no client-role bypass).\n  5. Admin can read users, audit log, security events.\n  6. Suspended accounts cannot log in; reactivation restores access.\n  7. Admin self-lockout prevented.\n  8. Unknown API routes return JSON 404.\n  (Plus 3 more in the file: production refuses without JWT_SECRET, production refuses with default demo admin live, production boots with ephemeral secret on clean DB — these are in `production-guard.test.js`.)\n\n- **Production guard tests** (`server/test/production-guard.test.js`) — 3/3 passing:\n  1. Production refuses to boot without `JWT_SECRET`.\n  2. Production refuses to boot while default demo admin is live.\n  3. Production boots and serves with strong ephemeral secret on clean DB.\n\n- Run via: `cd server && npm test` (which runs `node --test test/api-smoke.test.js test/production-guard.test.js`).\n\n### Frontend tests 🔵 Not verified\n\n- **Playwright E2E** — config + test runner exist (`npm run test:e2e` in `client/package.json`); CI has an `e2e` job that seeds a DB, boots the API, and runs the suite. **Local execution not verified in this session.** 🟡 Needs verification.\n- **Component tests** — none found.\n- **Unit tests** — none found (backend uses `node:test` for integration-style smoke + guard tests; no frontend unit tests).\n\n### CI/CD ✅ Verified (from `.github/workflows/ci.yml`)\n\n**4-job pipeline:**\n\n1. **client** — `npm ci` + production build (`npm run build`) + lint (`npm run lint` with oxlint). Runs on push to main/master + PRs + workflow_dispatch.\n2. **server** — `npm ci` + syntax check (`node --check` on all .js files) + backend test suite (`npm test` = API smoke + production guard tests).\n3. **security** — dependency vulnerability audit (`npm run audit:deps` = `node scripts/dependency-audit.js client && node scripts/dependency-audit.js server`).\n4. **e2e** — seeds throwaway DB, boots API on :5000 with ephemeral JWT secret, runs Playwright E2E suite (`npm run test:e2e`). Locates or installs a browser for Playwright.\n\n**CI runs in development mode by default** (no production secrets committed). E2E job generates ephemeral JWT secret at runtime. Production startup guards verified with runtime-generated secrets only.\n\n**What has actually been executed:** Backend tests (11/11 smoke + 3/3 guard) pass. Client build passes. CI pipeline exists and is configured.\n\n**What remains unverified:** E2E suite execution (CI job exists but hasn't been run in this session); linting (configured but not run in this session); dependency audit (configured but not run in this session).\n\n---\n\n## 10. Deployment & Production Readiness\n\n### ✅ Verified locally\n\n- **Health endpoint** — `GET /api/health` returns 200.\n- **Client production build** — `cd client && npm run build` passes (Vite produces `dist/`).\n- **Server startup** — boots in development mode; database initializes; routes respond.\n- **Production guards** — verified via tests: production refuses without JWT_SECRET; refuses with default demo admin live; boots with strong ephemeral secret.\n- **CORS** — scoped to allow-listed origins; configurable via `CORS_ORIGINS` env.\n- **JWT secret enforcement** — production refuses to boot without strong secret.\n- **Demo admin production guard** — production refuses to boot if default demo admin is still live.\n\n### 🟡 Requires follow-up\n\n- **Production hosting** — not configured. No hosting provider, domain, or TLS set up.\n- **Production database** — not configured. `DATABASE_PATH` env var exists but no production DB location established.\n- **Production environment variables** — `server/.env.example` exists (template); `server/.env` is gitignored. Production needs: `JWT_SECRET` (required, ≥32 chars), `NODE_ENV=production`, `PORT`, `CORS_ORIGINS`, `DATABASE_PATH`, `TRUST_PROXY` (optional), `JWT_ADMIN_EXPIRES_IN` (optional), `JWT_EXPIRES_IN` (optional).\n- **Production CORS** — configurable via `CORS_ORIGINS` env; needs actual production origin(s) set.\n- **Production API URL** — frontend uses `VITE_API_URL` env var at build time; needs production API URL set at build.\n- **Frontend deployment** — `netlify.toml` exists for frontend build (base = client, command = `npm ci && npm run build`, publish = dist). Not deployed.\n- **HTTPS/TLS** — not configured (requires hosting + domain).\n- **Monitoring & logging** — security event logging + admin audit logging exist. Application monitoring, error tracking, uptime monitoring, log aggregation — not configured.\n- **Backup & disaster recovery** — not implemented.\n\n### 🚫 Unavailable / not configured\n\n- **Production environment** — does not exist.\n- **Git history** — no `.git` directory on disk; cannot verify secret exposure in history.\n- **CI runners** — CI workflow exists in `.github/workflows/ci.yml` but no live CI execution to verify.\n- **E2E execution** — Playwright config + CI job exist; local execution not verified in this session.\n\n---\n\n## 11. Known Gaps\n\n### Genuine application gaps\n\n| Gap | Severity | Notes |\n|---|---|---|\n| **Password reset / recovery** | P0 | Not implemented. No reset flow, no reset tokens, no email. Requires email capability + reset token storage + expiration logic + UI flow. |\n| **Account deletion** | P1 | No endpoint for users to delete their own accounts. Would require an endpoint + audit trail + notification cleanup. |\n| **Education page wired to backend** | P1 | Backend API is ready (`GET /api/education`, `GET /api/education/:id`, `GET /api/education/meta/categories`) but EducationPage.jsx shows hardcoded sample articles. Frontend needs to call the API and render live articles. |\n| **Track report page wired to live data** | P1 | `GET /api/reports/track/:id` exists and works. TrackReportPage shows a hardcoded sample trail (ECO-2026-0117) with a \"GrowingSoon\" component. Needs to fetch live report by ID from URL param. |\n\n### Quality / verification gaps\n\n| Gap | Severity | Notes |\n|---|---|---|\n| **E2E suite execution** | P2 | Playwright config + CI job exist; local execution not verified in this session. CI job seeds DB, boots API, runs `npm run test:e2e`. |\n| **Pagination on all list endpoints** | P2 | Reports list, admin users, audit log, security events accept limit/offset but pagination behavior not comprehensively tested across all endpoints. |\n| **Orphaned records check** | P2 | No referential integrity audit performed to check for orphaned hazard_reports, orphaned questions, etc. (though FK constraints handle the known cases). |\n| **Test coverage** | P2 | Backend has 14 integration tests (smoke + guard). No frontend unit/component tests. No comprehensive validation tests, DB tests, file-upload security tests, rate-limit tests. |\n| **Accessibility audit** | P2 | No tooling configured; no manual audit done. MD/HD/TH hierarchy, keyboard navigation, focus states, form labels, alt text, contrast — not verified. |\n| **Cross-browser/device testing** | P2 | No CI runners configured; no manual testing done across Chrome/Edge/Firefox/Mobile Chrome/Mobile Safari/devices. |\n| **Performance / Lighthouse audit** | P3 | No tooling configured. Bundle size, code splitting, lazy loading, image optimization, API performance, DB query performance — not audited. |\n| **Privacy review** | P3 | Privacy/Terms/Cookies pages exist. Data collection documentation, data retention policy, account deletion, sensitive-data minimization — not audited. |\n\n### Production / infrastructure gaps\n\n| Gap | Severity | Notes |\n|---|---|---|\n| **Production deployment** | P0 | No hosting, domain, TLS, production database, production env vars configured. Netlify.toml exists for frontend build but no actual deployment. |\n| **Backup & disaster recovery** | P1 | Not implemented. No automated backups, retention policy, restore procedure, RPO/RTO. |\n| **Monitoring & alerting** | P2 | Security/audit logs exist. Application monitoring, error tracking, uptime, CPU/memory/disk/DB monitoring, alerts — not configured. |\n| **Git history secret scan** | P2 | Blocked: no `.git` directory on disk. Cannot run `git log -S`, BFG, or any history-based credential scan. |\n| **Graceful shutdown** | P3 | No explicit `SIGTERM`/`SIGINT` handler with `server.close()` found. 🟡 Not verified. |\n\n---\n\n## 12. Security / Production Blockers\n\n### Actual application problems (P0/P1)\n\n1. **Password reset/recovery not implemented** — no reset flow, no reset tokens, no email capability. Users who forget their password have no recovery path. This is a product feature gap, not an environment blocker.\n\n2. **No account deletion** — users cannot delete their own accounts. No endpoint exists. Would require an endpoint + audit trail + notification cleanup + related data handling.\n\n### Things that cannot be verified because infrastructure doesn't exist\n\nThese are **not** application bugs — they're items that require a real `.git` repository, production environment, CI runners, or live database to verify:\n\n- **Git history secret scan** — blocked: no `.git` directory on disk. Cannot verify whether JWT_SECRET, API keys, or other credentials were ever committed.\n- **Production deployment verification** — blocked: no production environment exists. Cannot verify HTTPS, production CORS, production API URL, production startup, rollback.\n- **CI execution verification** — blocked: no live CI runners. Cannot verify that the CI pipeline actually passes end-to-end (client build, server tests, security audit, E2E).\n- **E2E suite execution** — 🟡 CI job exists but local execution not verified in this session.\n- **Dependency vulnerability remediation** — `npm audit --omit=dev` in server/ found vulnerabilities (tar, qs). Remediation may require breaking changes (e.g., `sqlite3@6.0.1`). Not yet remediated.\n- **Backup & disaster recovery** — no production database exists; backup procedures cannot be verified.\n\n### Items that are simply not yet implemented (not blockers for current demo state)\n\n- **Graceful server shutdown** — no SIGTERM/SIGINT handler found. Minor; doesn't affect demo/dev state.\n- **Database connection lifecycle** — single shared connection cached; no explicit close on shutdown. Minor; SQLite handles this reasonably for the current scale.\n\n---\n\n## 13. Roadmap\n\n### P0 — Security / critical blockers\n\n1. **Password reset / recovery** — Add email capability (or a demo-mode placeholder), reset token storage with expiration, reset flow UI (request → email → reset → new password), and server endpoints. This is the one genuine auth surface gap.\n2. **Git history secret scan** — Once a real `.git` clone is available, run `git log -S` / BFG to confirm no credentials were ever committed. If any found, rotate them.\n3. **Production deployment** — Set up hosting (e.g., Render/Railway/Fly for backend, Netlify/Vercel for frontend), configure production environment variables, set up HTTPS/TLS, configure production CORS origins, test production startup.\n\n### P1 — Important functionality\n\n4. **Wire EducationPage to backend** — Call `GET /api/education` (with category/search filters), render live articles, link to `GET /api/education/:id` for full article view. Remove the \"full library is growing\" ribbon once live.\n5. **Wire TrackReportPage to live data** — Read report ID from URL param, call `GET /api/reports/track/:id`, render the real status timeline from the report's status history. Remove the hardcoded sample trail + GrowingSoon.\n6. **Account deletion** — Add `DELETE /api/auth/account` (or similar) for users to delete their own accounts, with audit trail, notification cleanup, and related data handling (e.g., anonymize their reports or cascade-delete).\n7. **Backup & disaster recovery design** — Define RPO/RTO, implement automated SQLite backups (e.g., daily dump + rotate), store backups separately, document restore procedure.\n\n### P2 — Quality / testing\n\n8. **Run E2E suite** — Execute `npm run test:e2e` locally to verify the Playwright suite passes. Fix any failures.\n9. **Pagination verification** — Test limit/offset on reports list, admin users, audit log, security events. Ensure consistent behavior.\n10. **Orphaned records check** — Run a referential integrity audit: check for hazard_reports with invalid user_id, questions with invalid quiz_id, etc.\n11. **Frontend tests** — Add component tests (Vitest + React Testing Library) for key components (Navbar, ProtectedRoute, forms, status badges).\n12. **Accessibility audit** — Run axe/Lighthouse accessibility audit; fix heading hierarchy, keyboard navigation, focus states, form labels, alt text, contrast.\n13. **Cross-browser testing** — Verify on Chrome, Edge, Firefox, Mobile Chrome at minimum.\n\n### P3 — Production optimization\n\n14. **Performance audit** — Lighthouse audit; analyze bundle size; consider code splitting (lazy load Leaflet, Recharts, admin page); image optimization.\n15. **Privacy review** — Document data collection, retention policy, account deletion flow, sensitive-data minimization. Verify Privacy/Terms/Cookies pages are legally adequate.\n16. **Dependency cleanup** — Run `npm audit` + `npm outdated`; remediate vulnerabilities where practical; remove unused dependencies.\n17. **Graceful shutdown** — Add SIGTERM/SIGINT handler with `server.close()` + DB close.\n18. **Monitoring** — Add application monitoring (e.g., structured logging, error tracking, uptime check), log aggregation for production.\n\n### P4 — Future features\n\n19. **Interactive map clustering** — When report count grows, cluster nearby pins on the map.\n20. **Cookie-based auth option** — Alternative to localStorage JWT (httpOnly cookies) for improved security.\n21. **Email notifications** — Send email at key milestones (in addition to in-app notifications).\n22. **Saved hazards / watchlist** — Let users bookmark hazards they want to follow.\n23. **Regional admins** — Scope admin moderation to specific regions.\n24. **Report comments / discussion** — Allow threaded discussion on reports.\n25. **Export / data portability** — Let users export their data (GDPR-style).\n\n---\n\n## 14. Current Status Summary\n\n### What EcoGuard currently is\n\nA **working full-stack environmental safety demo** with a complete backend REST API (7 route groups, ~30 endpoints), a polished React + Tailwind frontend with 15+ live pages, a 9-table SQLite database with rich seed data (2 users, 10 hazards, 5 educational resources, 1 quiz with 5 questions, 10 geo-pinned reports), JWT authentication with DB-backed re-verification, a full admin moderation console with audit logging, a Leaflet risk map with custom pins, and a 4-job CI pipeline.\n\n### What is working ✅\n\n- **All backend API routes** — auth (register/login/profile/theme/password), hazards (list/detail/categories), reports (list/my-reports/submit/track), education (list/detail/categories), quiz (list/detail/submit), notifications (list/mark-read/mark-all-read), admin (stats/users/report-status/delete/user-role/user-status/administrators/audit-log/security-events/security-overview).\n- **Authentication** — registration, login (timing-safe), logout, profile management, theme sync, password change. JWT with DB-backed re-verification, issuer/audience binding, per-role expiry, production secret enforcement, demo admin production guard.\n- **Authorization** — admin-only routes protected; self-demotion and self-lockout blocked; suspended users lose access immediately.\n- **Report submission** — full form with image upload (JPG/PNG/WebP, 5MB), geolocation, validation, ECO-YYYY-XXXXX ID generation, optional auth association, anonymous support.\n- **Admin console** — full moderation queue with workflow buckets, inline status changes, quick-move, two-step delete, user/role/status management, audit log with filtering + pagination, security overview.\n- **Frontend pages** — Home, Dashboard (EcoPulse with live data), Map (Leaflet with live pins), Hazards (browse/search/filter), Hazard Detail, Report (submission form), Quiz (wired to backend), Notifications (live inbox), Login, Register, Profile (name editing + password change + my reports), Admin (full console), Safety, Privacy/Terms/Cookies, 404.\n- **Security controls** — Helmet, scoped CORS, rate limiting (global + auth + submit + per-admin), input validation (enums, ranges, length caps, email format, password strength), parameterized queries, foreign keys, file upload validation (type + size + randomized names + nosniff + immutable cache), audit logging (audit_log + security_events), security event logging with sensitive key stripping.\n- **CI pipeline** — 4 jobs: client build+lint, server syntax+tests, security dependency audit, E2E Playwright.\n- **Backend tests** — 11/11 API smoke tests + 3/3 production guard tests passing.\n- **Client production build** — passes.\n\n### What is genuinely incomplete ⚠️\n\n- **Education page** — backend API ready but frontend shows static preview; not wired to live articles.\n- **Track report page** — backend `track/:id` works but UI shows hardcoded sample trail + GrowingSoon; not wired to live report IDs.\n- **Password reset/recovery** — not implemented at all (no reset flow, no tokens, no email). Genuine auth surface gap.\n- **Account deletion** — no endpoint for users to delete their own accounts.\n- **E2E suite execution** — Playwright config + CI job exist; local execution not verified in this session.\n- **Pagination** — implemented on some endpoints but not comprehensively tested across all list endpoints.\n\n### What is blocked 🚫\n\n- **Production deployment** — no hosting, domain, TLS, production database, or production environment variables configured.\n- **Git history secret scan** — no `.git` directory on disk; cannot verify whether credentials were ever committed.\n- **Backup & disaster recovery** — not implemented (design-only).\n- **Monitoring & alerting** — security/audit logs exist; application monitoring, error tracking, uptime, alerts — not configured.\n- **Cross-browser/device testing** — not done.\n- **Accessibility audit** — not done.\n\n### What should be done next (priority order)\n\n1. **P0:** Decide on password reset approach (email service vs. demo-mode placeholder) and implement it — this is the one genuine auth gap.\n2. **P0:** Once a real `.git` clone is available, run a git history secret scan to confirm no credentials were ever committed.\n3. **P1:** Wire EducationPage to the backend API (call `GET /api/education`, render live articles, link to detail view).\n4. **P1:** Wire TrackReportPage to live data (read ID from URL, call `GET /api/reports/track/:id`, render real timeline).\n5. **P1:** Set up production deployment (hosting + environment variables + HTTPS + production CORS).\n6. **P2:** Run the E2E suite locally (`npm run test:e2e`) and fix any failures.\n7. **P2:** Verify pagination behavior across all list endpoints.\n8. **P2:** Add a basic accessibility pass (heading hierarchy, keyboard navigation, focus states, form labels).\n\n---\n\n*Document generated from codebase audit on 2026-09-08. Reflects the repository as it exists now.*\n"}