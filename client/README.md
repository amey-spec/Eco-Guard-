# EcoGuard — Frontend

The React frontend for **EcoGuard**, an environmental intelligence & safety
platform. See the [root README](../README.md) for the full project overview,
demo accounts and setup instructions.

## Stack

- **React 19 + Vite** with HMR
- **React Router 7** (15 pages, protected routes for profile/notifications/admin)
- **Tailwind CSS v4** — CSS-first design system in `src/index.css`
  (natural “old oak” palette, Fraunces/Inter fonts, motion keyframes, Leaflet skin)
- **Leaflet** — interactive Risk Map (`src/components/RiskMap.jsx`)
- **Recharts** — dashboard charts
- **Lucide React** — icons

## Structure

```
src/
├── components/     # Navbar, Footer, cards, RiskMap, Reveal, CountUp,
│                   # ProtectedRoute, PageHeader, GrowingSoon, ornaments…
├── pages/          # Home, EcoPulse dashboard, Risk Map, Hazard Atlas,
│                   # Auth, Admin console, Education/Safety/Quiz shells…
├── context/        # AuthContext (JWT in localStorage)
├── services/       # api.js — fetch client for the Express backend
├── hooks/          # useInView (drives scroll-reveal animations)
└── utils/          # hazardMeta.js (category → icon/tint mapping)
```

## Development

```bash
npm install
npm run dev        # http://localhost:5173  (expects the API on :5000)
npm run build
npm run lint       # oxlint
```

The API base URL defaults to `http://localhost:5000/api` (`src/services/api.js`).
Point it somewhere else with `VITE_API_URL` (e.g. a `.env.local` file or a build
environment variable). Run the backend from `../server` first, or the
demo-data-backed pages will show their empty states.
