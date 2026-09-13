import { Link } from 'react-router-dom';
import { useState, useEffect } from 'react';
import {
  ArrowRight, Activity, Map, BookOpen, Shield,
  Eye, Send, CheckCircle2, AlertTriangle,
} from 'lucide-react';
import { api } from '../services/api';
import { computeEcoScores, groupSummary } from '../utils/ecoMetrics';
import Reveal from '../components/Reveal';
import CountUp from '../components/CountUp';
import HazardCard from '../components/HazardCard';
import useInView from '../hooks/useInView';
import { Sprig, LeafSeal } from '../components/Ornaments';
import ForestSplit from '../components/ForestSplit';

/* ------------------------------------------------------------------ */
/* Live signal tile (bar fills when scrolled into view)               */
/* ------------------------------------------------------------------ */
function SignalCard({ name, value, blurb, icon: Icon, tile, bar, delay }) {
  const [ref, inView] = useInView({ threshold: 0.35 });
  return (
    <Reveal direction="up" delay={delay} className="h-full">
      <div ref={ref} className="eco-card flex h-full flex-col p-6">
        <div className="flex items-center justify-between gap-3">
          <div className={`grid h-11 w-11 place-items-center rounded-xl ring-1 ring-black/[0.03] ${tile}`}>
            <Icon className="h-5 w-5" strokeWidth={1.9} />
          </div>
          <span className="font-display text-2xl font-medium leading-none text-charcoal-900">
            {value === null ? '–' : value}
            {value !== null && <span className="ml-0.5 text-sm font-sans text-mist-400">/100</span>}
          </span>
        </div>
        <h3 className="mt-4 text-[0.95rem] font-bold text-charcoal-900">{name}</h3>
        <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-cream-100 ring-1 ring-inset ring-black/[0.04]">
          <div
            className={`h-full rounded-full ${bar} transition-all duration-[1400ms] ease-out`}
            style={{ width: inView ? `${value ?? 0}%` : '0%' }}
          />
        </div>
        <p className="mt-3 text-xs leading-relaxed text-mist-500">{blurb}</p>
      </div>
    </Reveal>
  );
}

/* ------------------------------------------------------------------ */
/* Home                                                               */
/* ------------------------------------------------------------------ */
const MARQUEE = [
  'Live environmental signals', 'Community-verified reports', 'Hazard field atlas',
  'EcoSense education', 'Safety-first guidance', 'Act early, restore often',
];

const FEATURES = [
  {
    to: '/dashboard', icon: Activity, title: 'EcoPulse', color: 'bg-forest-700',
    text: 'A calm dashboard of air, water, heat and habitat signals for your region — one honest glance at how the land is doing.',
  },
  {
    to: '/map', icon: Map, title: 'Risk Map', color: 'bg-[#3f7d8a]',
    text: 'See where hazards gather on an evolving field map, drawn from community reports and field observations.',
  },
  {
    to: '/education', icon: BookOpen, title: 'Knowledge Hub', color: 'bg-[#6d7d3e]',
    text: 'Plain-language field notes on every hazard — causes, effects and the prevention that actually works.',
  },
  {
    to: '/safety', icon: Shield, title: 'Safety Center', color: 'bg-earth-600',
    text: 'Seasoned, safety-first guidance for before, during and after environmental events.',
  },
];

const STEPS = [
  {
    n: '01', icon: Eye, title: 'Notice the signal',
    text: 'Something looks off — discoloured water, odd air, a burn scar spreading. Trust what you see.',
  },
  {
    n: '02', icon: Send, title: 'Leave a report',
    text: 'Two minutes of detail, a photo if you have one. Your report joins the local field record.',
  },
  {
    n: '03', icon: CheckCircle2, title: 'Watch it resolve',
    text: 'Community and authorities track the case through review to resolution — and you stay in the loop.',
  },
];

export default function HomePage() {
  const [stats, setStats] = useState(null);
  const [hazards, setHazards] = useState([]);
  // Starts as all-null so the signal cards render “–” until real reports arrive.
  const [eco, setEco] = useState(() => computeEcoScores([]));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [hazardsRes, reportsRes] = await Promise.all([
          api.hazards.getAll(),
          api.reports.getAll(),
        ]);
        const hazardsList = Array.isArray(hazardsRes) ? hazardsRes : hazardsRes?.hazards || [];
        const reports = Array.isArray(reportsRes) ? reportsRes : reportsRes?.reports || [];
        if (cancelled) return;
        setHazards(hazardsList.slice(0, 6));
        setEco(computeEcoScores(reports));
        setStats({
          totalHazards: hazardsList.length,
          totalReports: reports.length,
          activeReports: reports.filter((r) => r.status !== 'Resolved').length,
        });
      } catch (error) {
        console.error('Failed to load data:', error);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Hero panel reads the air score up top, with three other groups below.
  const air = eco.find((g) => g.key === 'air');
  const heroRows = ['water', 'heat', 'habitat']
    .map((key) => eco.find((g) => g.key === key))
    .filter(Boolean);

  return (
    <div>
      {/* ============ HERO — old oak canopy ============ */}
      <section className="relative overflow-hidden bg-forest-950 text-cream-50 dark:text-[#f6f1e7]">
        <div className="absolute inset-0 bg-gradient-to-b from-forest-900 via-forest-950 to-forest-950" />
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-[radial-gradient(52%_44%_at_72%_0%,rgba(167,196,168,0.18),transparent_70%)]"
        />
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-topographic opacity-50" />
        <div className="grain" aria-hidden="true" />

        {/* half-alive, half-lost animated forest floor */}
        <ForestSplit />

        <div aria-hidden="true" className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-b from-transparent to-cream-50" />

        {/* drifting leaves */}
        <Sprig className="pointer-events-none absolute left-[4%] top-24 hidden h-20 w-auto rotate-12 text-forest-500/50 animate-sway-slow md:block" />
        <Sprig className="pointer-events-none absolute right-[6%] top-40 hidden h-16 w-auto -rotate-[24deg] text-leaf-400/40 animate-float-slow md:block" />

        <div className="relative mx-auto grid w-full max-w-6xl gap-14 px-4 pb-28 pt-16 sm:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:px-8 lg:pb-36 lg:pt-24">
          {/* Left — copy */}
          <div>
            <div className="will-rise" style={{ animationDelay: '0ms' }}>
              <span className="inline-flex items-center gap-2.5 rounded-full border border-cream-50/20 bg-cream-50/[0.06] px-4 py-2 text-[0.78rem] font-semibold uppercase tracking-[0.16em] text-cream-100/90 backdrop-blur-sm dark:border-white/20 dark:bg-white/[0.06] dark:text-[#f6f1e7]/90">
                <span className="h-1.5 w-1.5 rounded-full bg-leaf-300 animate-pulse-soft" />
                Community environmental network
              </span>
            </div>

            <h1
              className="mt-7 font-display text-[2.7rem] font-medium leading-[1.04] text-cream-50 will-rise sm:text-6xl lg:text-[4.4rem] dark:text-[#fbfaf6]"
              style={{ animationDelay: '90ms', textWrap: 'balance' }}
            >
              The planet leaves signals.{' '}
              <em className="font-light italic text-leaf-300">We help you read them.</em>
            </h1>

            <p
              className="mt-6 max-w-xl text-lg leading-relaxed text-cream-100/75 will-rise dark:text-[#f3efe2]/80"
              style={{ animationDelay: '180ms' }}
            >
              Watch your local environment, understand what a hazard means, and
              leave a report that helps your community act — early, and together.
            </p>

            <div
              className="mt-9 flex flex-col gap-3.5 will-rise sm:flex-row"
              style={{ animationDelay: '270ms' }}
            >
              <Link to="/dashboard" className="btn btn-cream btn-lg group">
                Explore EcoPulse
                <ArrowRight className="h-[18px] w-[18px] transition-transform duration-300 group-hover:translate-x-1.5" />
              </Link>
              <Link to="/report" className="btn btn-glass btn-lg">
                <AlertTriangle className="h-[18px] w-[18px]" strokeWidth={1.9} />
                Report a hazard
              </Link>
            </div>

            <div
              className="mt-12 flex flex-wrap items-center gap-x-8 gap-y-3 text-[0.82rem] text-cream-100/60 will-rise hero-dim dark:text-[#e9e4d3]/80"
              style={{ animationDelay: '360ms' }}
            >
              <span className="inline-flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-leaf-300" strokeWidth={2} />
                Community-verified reports
              </span>
              <span className="inline-flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-leaf-300" strokeWidth={2} />
                Free for every guardian
              </span>
              <span className="inline-flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-leaf-300" strokeWidth={2} />
                Safety-first guidance
              </span>
            </div>
          </div>

          {/* Right — live field-note panel */}
          <div className="relative hidden will-rise lg:block" style={{ animationDelay: '250ms' }}>
            <div className="relative z-10 mx-auto max-w-md rounded-[1.75rem] border border-cream-50/15 bg-cream-50/[0.07] p-7 shadow-environmental backdrop-blur-md animate-float-slow dark:border-white/15 dark:bg-white/[0.07]">
              <div className="flex items-center justify-between">
                <p className="inline-flex items-center gap-2 text-[0.7rem] font-bold uppercase tracking-[0.18em] text-cream-100/80 dark:text-[#f3efe2]/85">
                  <span className="h-1.5 w-1.5 rounded-full bg-status-high animate-pulse-soft" />
                  EcoPulse · Live
                </p>
                <span className="rounded-full border border-cream-50/20 px-2.5 py-1 text-[0.62rem] font-bold uppercase tracking-[0.14em] text-cream-100/60 dark:border-white/20 dark:text-[#e9e4d3]/75">
                  Demo data
                </span>
              </div>

              <div className="mt-6">
                <p className="font-display text-[1.35rem] italic text-cream-50 dark:text-[#fbfaf6]">
                  {air.name}
                </p>
                <div className="mt-2 flex items-baseline gap-2">
                  <span className="font-display text-5xl font-medium text-cream-50 dark:text-[#fbfaf6]">
                    {air.score === null ? '–' : air.score}
                  </span>
                  {air.score !== null && (
                    <span className="text-sm text-cream-100/60 dark:text-[#e9e4d3]/75">/ 100 · {groupSummary(air)}</span>
                  )}
                </div>
                <div className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-cream-50/10 dark:bg-white/10">
                  <div
                    className={`h-full rounded-full ${air.bar}`}
                    style={{ width: `${air.score ?? 0}%` }}
                  />
                </div>
              </div>

              <ul className="mt-7 space-y-4 border-t border-cream-50/10 pt-6 dark:border-white/10">
                {heroRows.map((row) => (
                  <li key={row.key} className="flex items-center gap-3 text-sm">
                    <span className={`h-2 w-2 shrink-0 rounded-full ${row.bar}`} />
                    <span className="flex-1 truncate text-cream-100/75 dark:text-[#f3efe2]/85">{row.name}</span>
                    <span className="font-semibold text-cream-100 dark:text-[#fbfaf6]">
                      {row.score === null ? '–' : row.score}
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            {/* floating mini-card — keeps its light paper note look at night */}
            <div className="absolute -bottom-9 -left-2 z-20 rounded-2xl border border-cream-200 bg-[#fffdf7] px-5 py-4 shadow-soft-lg animate-float">
              <div className="flex items-center gap-3">
                <span className="grid h-9 w-9 place-items-center rounded-full bg-leaf-100 text-leaf-700 dark:bg-leaf-100/20 dark:text-leaf-300">
                  <CheckCircle2 className="h-5 w-5" strokeWidth={2} />
                </span>
                <div>
                  <p className="text-[0.82rem] font-bold text-charcoal-900 dark:text-[#24312a]">Report resolved</p>
                  <p className="text-xs text-mist-500 dark:text-[#6b766d]">EcoGuard #ECO-2026-0117</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============ MARQUEE band ============ */}
      <section aria-hidden="true" className="relative overflow-hidden border-y border-cream-200 bg-cream-100/80 py-4">
        <div className="flex w-max animate-marquee items-center gap-10 whitespace-nowrap">
          {[0, 1].map((copy) => (
            <div key={copy} className="flex items-center gap-10">
              {MARQUEE.map((item) => (
                <span
                  key={`${copy}-${item}`}
                  className="inline-flex items-center gap-10 text-[0.8rem] font-bold uppercase tracking-[0.22em] text-forest-700/80"
                >
                  {item}
                  <LeafSeal className="h-4 w-4 text-moss-400" />
                </span>
              ))}
            </div>
          ))}
        </div>
      </section>

      {/* ============ LIVE SIGNALS ============ */}
      <section className="relative py-20 sm:py-24">
        <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <Reveal>
              <p className="eyebrow justify-center">EcoPulse signals</p>
              <h2 className="mt-4 text-4xl sm:text-5xl">How is the wild feeling today?</h2>
              <p className="mt-5 text-lg leading-relaxed text-mist-700">
                Scores drawn from the community’s own reports — the dashboard
                keeps watching so you don’t have to.
              </p>
            </Reveal>
          </div>

          <div className="mt-14 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-5">
            {eco.map((signal, i) => (
              <SignalCard
                key={signal.key}
                name={signal.name}
                value={signal.score}
                blurb={groupSummary(signal)}
                icon={signal.icon}
                tile={signal.tile}
                bar={signal.bar}
                delay={i * 80}
              />
            ))}
          </div>
        </div>
      </section>

      {/* ============ FEATURES ============ */}
      <section className="relative overflow-hidden bg-cream-100/70 py-20 sm:py-24">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-topographic opacity-60" />
        <div className="grain" aria-hidden="true" />
        <div className="relative mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl">
            <Reveal>
              <p className="eyebrow">The platform</p>
              <h2 className="mt-4 text-4xl sm:text-5xl">Everything your lookout needs</h2>
              <p className="mt-5 text-lg leading-relaxed text-mist-700">
                One quiet toolkit for noticing, understanding and reporting what
                happens to the land around you.
              </p>
            </Reveal>
          </div>

          <div className="mt-14 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map((f, i) => {
              const Icon = f.icon;
              return (
                <Reveal key={f.to} direction="up" delay={i * 90} className="h-full">
                  <Link
                    to={f.to}
                    className="eco-card group flex h-full flex-col p-7"
                  >
                    <span className={`grid h-12 w-12 place-items-center rounded-2xl text-cream-50 shadow-soft transition-transform duration-300 group-hover:-rotate-6 group-hover:scale-110 dark:text-[#fffdf7] ${f.color}`}>
                      <Icon className="h-6 w-6" strokeWidth={1.8} />
                    </span>
                    <h3 className="mt-6 text-xl">{f.title}</h3>
                    <p className="mt-3 flex-1 text-sm leading-relaxed text-mist-700">{f.text}</p>
                    <span className="mt-6 inline-flex items-center gap-1.5 text-sm font-semibold text-forest-700">
                      Open
                      <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1.5" />
                    </span>
                  </Link>
                </Reveal>
              );
            })}
          </div>
        </div>
      </section>

      {/* ============ HAZARD ATLAS ============ */}
      <section className="relative py-20 sm:py-24">
        <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
            <Reveal className="max-w-xl">
              <p className="eyebrow">Hazard atlas</p>
              <h2 className="mt-4 text-4xl sm:text-5xl">Know what you’re looking at</h2>
              <p className="mt-4 text-lg leading-relaxed text-mist-700">
                Field notes on the hazards most often seen in the demo region —
                what causes them, and how to stay ahead.
              </p>
            </Reveal>
            <Reveal direction="left" delay={120}>
              <Link to="/hazards" className="btn btn-ghost group">
                Browse the full atlas
                <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1.5" />
              </Link>
            </Reveal>
          </div>

          <div className="mt-12">
            {loading ? (
              <div className="eco-loading">
                <div className="eco-loader" />
                <p className="eco-loading-text">Wandering the forest for field notes…</p>
              </div>
            ) : hazards.length > 0 ? (
              <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
                {hazards.map((hazard, i) => (
                  <Reveal key={hazard.id} delay={(i % 3) * 90} className="h-full">
                    <HazardCard hazard={hazard} />
                  </Reveal>
                ))}
              </div>
            ) : (
              <div className="eco-card px-8 py-16 text-center">
                <LeafSeal className="mx-auto h-12 w-12 text-forest-300" />
                <p className="mt-4 font-display text-xl text-charcoal-900">
                  The atlas is quiet right now
                </p>
                <p className="mx-auto mt-2 max-w-md text-sm text-mist-600">
                  Start the demo backend (cd server && npm run seed && npm run dev) and
                  the field notes will appear here.
                </p>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ============ HOW IT WORKS ============ */}
      <section className="relative overflow-hidden bg-forest-950 py-20 text-cream-50 dark:text-[#f6f1e7] sm:py-24">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-topographic opacity-40" />
        <div aria-hidden="true" className="absolute inset-0 bg-[radial-gradient(40%_60%_at_85%_10%,rgba(84,144,95,0.22),transparent_70%)]" />
        <div className="grain" aria-hidden="true" />
        <div className="relative mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8">
          <Reveal className="mx-auto max-w-2xl text-center">
            <p className="eyebrow justify-center text-leaf-300!">The cycle</p>
            <h2 className="mt-4 text-4xl text-cream-50 dark:text-[#fbfaf6] sm:text-5xl">
              From first sign to <em className="font-light italic text-leaf-300">all clear</em>
            </h2>
          </Reveal>

          <div className="relative mt-16 grid grid-cols-1 gap-10 md:grid-cols-3 md:gap-8">
            {/* joining line */}
            <div
              aria-hidden="true"
              className="absolute left-[16%] right-[16%] top-10 hidden border-t-2 border-dashed border-cream-50/15 dark:border-white/15 md:block"
            />
            {STEPS.map((step, i) => {
              const Icon = step.icon;
              return (
                <Reveal key={step.n} delay={i * 130} className="relative text-center md:px-4">
                  <div className="relative mx-auto grid h-20 w-20 place-items-center rounded-full border border-cream-50/20 bg-forest-900/60 backdrop-blur-sm dark:border-white/20">
                    <Icon className="h-8 w-8 text-leaf-300" strokeWidth={1.7} />
                    <span className="absolute -right-1.5 -top-1.5 grid h-8 w-8 place-items-center rounded-full bg-leaf-600 font-display text-xs font-semibold text-cream-50 shadow-environmental dark:text-[#fffdf7]">
                      {step.n}
                    </span>
                  </div>
                  <h3 className="mt-6 text-xl text-cream-50 dark:text-[#fbfaf6]">{step.title}</h3>
                  <p className="mx-auto mt-3 max-w-xs text-[0.95rem] leading-relaxed text-cream-100/70 dark:text-[#f3efe2]/80">
                    {step.text}
                  </p>
                </Reveal>
              );
            })}
          </div>
        </div>
      </section>

      {/* ============ COMMUNITY CTA ============ */}
      <section className="relative py-20 sm:py-24">
        <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="relative overflow-hidden rounded-[2.25rem] bg-gradient-to-br from-forest-800 via-forest-900 to-forest-950 px-6 py-16 text-center text-cream-50 shadow-environmental dark:from-[#2f4735] dark:text-[#f6f1e7] sm:px-12 sm:py-20">
            <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-topographic opacity-50" />
            <div aria-hidden="true" className="absolute inset-0 bg-[radial-gradient(50%_80%_at_50%_-10%,rgba(167,196,168,0.25),transparent_70%)]" />
            <Sprig className="pointer-events-none absolute -bottom-4 left-8 h-24 w-auto rotate-12 text-forest-600/50 animate-sway-slow" />
            <Sprig className="pointer-events-none absolute right-8 top-6 h-16 w-auto -rotate-[18deg] text-leaf-400/30 animate-float-slow" />

            <Reveal className="relative">
              <h2 className="mx-auto max-w-2xl text-4xl sm:text-5xl">
                See something harmful?{' '}
                <em className="font-light italic text-leaf-300">Leave a signal.</em>
              </h2>
              <p className="mx-auto mt-5 max-w-xl text-lg leading-relaxed text-cream-100/75 dark:text-[#f3efe2]/80">
                Join the guardians turning quiet observation into a cleaner,
                safer corner of the wild.
              </p>
              <div className="mt-9 flex flex-col items-center justify-center gap-3.5 sm:flex-row">
                <Link to="/report" className="btn btn-cream btn-lg group">
                  Report an ecohazard
                  <ArrowRight className="h-[18px] w-[18px] transition-transform duration-300 group-hover:translate-x-1.5" />
                </Link>
                <Link to="/register" className="btn btn-glass btn-lg">
                  Create an account
                </Link>
              </div>
            </Reveal>

            {stats && (
              <div className="relative mx-auto mt-14 grid max-w-2xl grid-cols-3 gap-6 border-t border-cream-50/15 pt-10 dark:border-white/15">
                {[
                  { value: stats.totalHazards, label: 'Hazards in the atlas' },
                  { value: stats.totalReports, label: 'Community reports' },
                  { value: stats.activeReports, label: 'Active cases' },
                ].map((stat) => (
                  <div key={stat.label}>
                    <CountUp
                      value={stat.value}
                      className="font-display text-4xl font-medium text-leaf-300 sm:text-5xl"
                    />
                    <p className="mx-auto mt-2 max-w-[10rem] text-[0.8rem] uppercase tracking-[0.12em] text-cream-100/60 dark:text-[#e9e4d3]/75">
                      {stat.label}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
