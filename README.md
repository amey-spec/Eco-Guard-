# EcoGuard — Environmental Intelligence & Safety Platform

> **The planet leaves signals. We help you read them.**

EcoGuard is a full-stack **community "neighborhood watch" for the environment**.
People notice something wrong nearby (hazy air, a polluted stream, plastic waste,
flooding, a burn scar…), **report** it with a location and severity, **rangers**
moderate it from first signal to resolution, and everyone can **learn** — from a
hazard atlas, field guides, safety guidance and a quiz.

Demo product: real working code, seeded demo data, fully self-contained.

---

## Tech Stack

**Frontend** — React 19 + Vite · React Router 7 · Tailwind CSS v4 (CSS-first) ·
Leaflet (risk map) · Recharts (charts) · Lucide icons
**Backend** — Node.js + Express · JWT auth (bcrypt) · Multer (image uploads)
**Database** — SQLite (relational, 8 tables)

**Design** — a custom “old oak” natural system: Fraunces editorial serif + Inter,
warm parchment & deep-forest palette, paper grain / contour textures, hand-drawn
sprig ornaments, scroll-reveal & SaaS-style animations, `prefers-reduced-motion`
support.

---

## What’s built

### Frontend (15 pages + shared UI, all one visual language)

- **Discover (Home)** — forest-canopy hero with drifting leaves, live field-note
  panel, marquee band, animated environmental signals, features, hazard atlas
  preview, 3-step “notice → report → resolve” cycle, community CTA with count-ups.
- **EcoPulse (Dashboard)** — region stats (animated counters), five environmental
  meters that fill on scroll, seasonal trends chart, reports-by-type chart,
  recent community signals. *Live data from the API.*
- **Risk Map** — interactive Leaflet map of community reports around a NYC demo
  region. Custom severity pins, styled popups, severity/status filters, click a
  pin for the field note with a link to the report trail. *Live data.*
- **Hazard Atlas** — 10 hazards with search/filter, and rich field-note detail
  pages (causes / effects / prevention). *Live data.*
- **Auth** — sign in / join, protected routes, premium demo-credentials card.
- **Ranger Console (Admin)** — live summary stats, severity balance, moderation
  queue (search/filter, inline status changes with field notes, two-step delete),
  user & role management (can’t demote yourself). *Live data, admin-only.*
- **Knowledge Hub** — styled library preview (backend articles can be wired in).
- **Safety Center** — before / during / after guidance.
- **EcoSense Quiz** — interactive sample field test.
- **Report / Track / Profile / Notifications** — premium shells ready for their
  live flows; Track shows the status timeline design, Notifications a sample inbox.

### Backend (full REST API)

- Auth (register / login / profile) with JWT
- Hazards (list / detail / categories)
- Reports (list w/ filters, submit w/ optional image + coordinates, track, my-reports)
- Education, Quiz (with scoring), Notifications (per-user)
- Admin (stats, users, report moderation, user roles)

---

## How it works (core loop)

1. **Browse** — anyone can read the atlas, dashboard, map and guides; everything
   is served from the API.
2. **Sign in** — guardian (`user`) or ranger (`admin`).
3. **Report** — title, hazard type, severity, location (+ optional coordinates &
   photo) → stored with an `ECO-YYYY-XXXXX` id.
4. **Moderate** — a ranger moves the report through
   `Submitted → Pending/Under Review → Verified → Resolved/Rejected` in the
   Ranger Console; optional field notes are kept on the record.
5. **Notify & reflect** — the reporter gets notifications at each milestone, and
   the map + dashboard update from the same database.

---

## Getting started

### Prerequisites
- Node.js 18+ and npm

### 1. Install dependencies

```bash
npm install            # root (concurrently)
cd server && npm install
cd ../client && npm install
```

### 2. Environment (server)

```bash
cd server
cp .env.example .env   # then set JWT_SECRET (a strong random value)
# Generate one with:
# node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

The API refuses to boot in production (`NODE_ENV=production`) without a strong
`JWT_SECRET`. Without one in development it logs a warning and uses a
development-only fallback.

### 3. Seed the database (optional — re-runnable & idempotent)

```bash
cd server && npm run seed
```

Current demo dataset: 2 users, 10 hazards, 10 geo-pinned reports across 9 hazard
types with mixed severity/status, 5 educational resources, 1 quiz with 5 questions.

### 4. Run

```bash
# Option A — both at once (from project root)
npm run dev

# Option B — separately
cd server && npm run dev     # API on http://localhost:5000
cd client && npm run dev     # App on  http://localhost:5173
```

### Demo accounts

| Role | Email | Password |
|---|---|---|
| Guardian (user) | `user@ecoguard.com` | `user123` |
| Ranger (admin) | `admin@ecoguard.com` | `admin123` |

Admin console: sign in as the ranger, then open **http://localhost:5173/admin**
(or the shield “Admin” item in the navbar).

---

## Project structure

```
ecoguard/
├── server/
│   ├── config/
│   │   ├── database.js        # SQLite schema + connection
│   │   └── security.js        # JWT secret policy, token helpers, validation rules
│   ├── middleware/auth.js     # JWT verify + DB-backed role check, requireAdmin
│   ├── routes/                # auth, hazards, reports, education, quiz,
│   │                          # notifications, admin
│   ├── scripts/seed.js        # idempotent demo-data seeding
│   ├── uploads/               # user-submitted images (git-ignored)
│   ├── .env.example           # env template (copy to .env)
│   └── index.js               # Express app (helmet, CORS, rate limits, errors)
├── client/
│   ├── index.html             # fonts + meta
│   ├── src/
│   │   ├── index.css          # Tailwind v4 design system (palette, motion, Leaflet skin)
│   │   ├── components/        # Navbar, Footer, cards, RiskMap, Reveal, CountUp,
│   │   │                      # ProtectedRoute, PageHeader, GrowingSoon, ornaments…
│   │   ├── pages/             # 15 pages incl. Admin console & Risk Map
│   │   ├── context/AuthContext.jsx
│   │   ├── services/api.js    # typed API client
│   │   ├── hooks/useInView.js
│   │   └── utils/hazardMeta.js
│   └── vite.config.js
└── database.sqlite            # SQLite file (git-ignored)
```

---

## API endpoints (summary)

**Auth** — `POST /api/auth/register` · `POST /api/auth/login` · `GET|PUT /api/auth/profile` (protected)
**Hazards** — `GET /api/hazards` · `GET /api/hazards/:id` · `GET /api/hazards/meta/categories`
**Reports** — `GET /api/reports` · `GET /api/reports/my-reports` (protected) ·
`POST /api/reports/submit` (multipart, optional image) · `GET /api/reports/track/:id`
**Education** — `GET /api/education` · `GET /api/education/:id`
**Quiz** — `GET /api/quiz` · `GET /api/quiz/:id` · `POST /api/quiz/:id/submit`
**Notifications** (protected) — `GET /api/notifications` · `PUT /api/notifications/:id/read` · `PUT /api/notifications/read-all`
**Admin** (protected, admin-only) — `GET /api/admin/stats` · `GET /api/admin/users` ·
`PUT /api/admin/reports/:id/status` · `DELETE /api/admin/reports/:id` · `PUT /api/admin/users/:id/role`

---

## Security & hardening

- **Headers & transport**: Helmet security headers, `x-powered-by` disabled, JSON 404s,
  leak-free central error handler, bounded request bodies (100 kb).
- **Rate limiting**: global API limiter + stricter limit on auth endpoints (brute-force).
- **AuthN**: JWT with issuer/audience binding; **DB-backed check on every request**
  (deleted accounts & demoted roles lose access immediately); bcrypt (12 rounds);
  timing-safe login; emails normalized; password policy (8+ chars, letter & number).
- **JWT secret**: enforced via `server/.env`; production fails fast on missing/weak values.
- **Input validation & whitelists**: severity/status enums, role whitelist, coordinate
  ranges, field-length caps — applied on reports, admin and auth routes.
- **Uploads**: raster images only (jpg/png/webp), 5 MB cap, safe random filenames,
  immutable cache + nosniff.
- **CORS**: allow-listed origins only.
- **Client**: `ProtectedRoute` guards (`/profile`, `/notifications`, `/admin`) and
  sign-in redirect with return-to-destination.

Verified with a 32-check automated security suite (headers, CORS, throttling,
authn/authz, validation).

---

## Design system (short)

- **Palette**: deep oak-forest greens, moss, walnut earth, warm parchment paper,
  sage greys, green-black ink. Organic severity tints (terracotta/ochre) instead
  of neon defaults.
- **Type**: Fraunces (display serif) + Inter (UI sans).
- **Motion**: scroll reveals (`Reveal`), count-ups (`CountUp`), floating/swaying
  leaves, marquee band, fill-on-scroll meters — all disabled under reduced motion.
- **Icons**: Lucide; map pins are custom SVG.

---

## Notes & roadmap

- The demo data is simulated (locations, readings) for education/showcase.
- In an emergency, always follow official local instructions.
- Ideas for the next iteration: live report form + tracking wiring, education/quiz
  wired to their APIs, cookie-based auth, interactive map clustering, deployment
  (client + API with HTTPS and `TRUST_PROXY=1`), notification inbox UI.

## License

MIT — demonstration project built for environmental awareness and community safety.
