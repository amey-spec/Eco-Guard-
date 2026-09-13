import { Link } from 'react-router-dom';
import { Globe, AtSign, Mail, ShieldAlert, ArrowUpRight } from 'lucide-react';
import { LeafSeal, Sprig } from './Ornaments';  const columns = [
  {
    heading: 'Platform',
    links: [
      { to: '/', label: 'Discover' },
      { to: '/dashboard', label: 'EcoPulse' },
      { to: '/map', label: 'Risk Map' },
      { to: '/hazards', label: 'Hazard Atlas' },
    ],
  },
  {
    heading: 'Learn',
    links: [
      { to: '/education', label: 'Knowledge Hub' },
      { to: '/safety', label: 'Safety Center' },
      { to: '/quiz', label: 'EcoSense Quiz' },
      { to: '/profile', label: 'My EcoSpace' },
    ],
  },
  {
    heading: 'Take part',
    links: [
      { to: '/report', label: 'Report a hazard' },
      { to: '/register', label: 'Join EcoGuard' },
      { to: '/login', label: 'Sign in' },
      { to: '/notifications', label: 'Notifications' },
    ],
  },
  {
    heading: 'Legal',
    links: [
      { to: '/privacy', label: 'Privacy Policy' },
      { to: '/terms', label: 'Terms & Conditions' },
      { to: '/cookies', label: 'Cookie Policy' },
    ],
  },
];

export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="relative mt-auto overflow-hidden bg-forest-950 text-mist-300 dark:text-mist-300">
      {/* texture + light from the canopy */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-topographic opacity-60" />
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-gradient-to-b from-forest-900/60 via-transparent to-transparent"
      />
      <div className="grain" aria-hidden="true" />
      <Sprig className="pointer-events-none absolute left-6 top-8 h-16 w-auto text-forest-700/80 sm:left-10" />

      <div className="relative mx-auto w-full max-w-6xl px-4 pb-10 pt-16 sm:px-6 sm:pt-20 lg:px-8">
        <div className="grid grid-cols-1 gap-12 md:grid-cols-2 lg:grid-cols-12">
          {/* Brand */}
          <div className="lg:col-span-5">
            <Link to="/" className="inline-flex items-center gap-2.5">
              <span className="text-cream-100 dark:text-[#f6f1e7]">
                <LeafSeal className="h-11 w-11" />
              </span>
              <span className="font-display text-[1.7rem] font-semibold tracking-tight text-cream-50 dark:text-[#fbfaf6]">
                Eco<span className="italic text-leaf-300">Guard</span>
              </span>
            </Link>
            <p className="mt-5 max-w-sm text-[0.95rem] leading-relaxed text-mist-400">
              The wild is giving signals — we help communities read them, report
              what they see, and keep their corner of the forest safe.
            </p>
            <div className="mt-6 flex items-center gap-3">
              {[
                { icon: Globe, label: 'Site', href: '#' },
                { icon: AtSign, label: 'Community', href: '#' },
                { icon: Mail, label: 'Email', href: 'mailto:support@ecoguard.example' },
              ].map((s) => (
                <a
                  key={s.label}
                  href={s.href}
                  aria-label={s.label}
                  className="grid h-10 w-10 place-items-center rounded-full border border-white/10 bg-white/[0.04] text-mist-300 transition-all duration-300 hover:-translate-y-0.5 hover:border-leaf-300/50 hover:text-leaf-300"
                >
                  <s.icon className="h-[18px] w-[18px]" strokeWidth={1.8} />
                </a>
              ))}
            </div>
          </div>

          {/* Link columns */}
          {columns.map((col) => (
            <nav key={col.heading} className="lg:col-span-2">
              <h3 className="text-[0.72rem] font-bold uppercase tracking-[0.22em] text-leaf-300">
                {col.heading}
              </h3>
              <ul className="mt-5 space-y-3">
                {col.links.map((link) => (
                  <li key={link.to}>
                    <Link
                      to={link.to}
                      className="group inline-flex items-center gap-1 text-[0.92rem] text-mist-400 transition-colors duration-200 hover:text-cream-50 dark:hover:text-[#fbfaf6]"
                    >
                      <span className="link-under">{link.label}</span>
                      <ArrowUpRight className="h-3 w-3 opacity-0 transition-all duration-200 group-hover:translate-x-0.5 group-hover:opacity-100" />
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        {/* Disclaimer */}
        <div className="mt-14 flex flex-col gap-4 rounded-2xl border border-white/[0.08] bg-white/[0.03] px-6 py-5 sm:flex-row sm:items-center">
          <ShieldAlert className="h-6 w-6 shrink-0 text-[#e0b25a]" strokeWidth={1.7} />
          <p className="text-[0.85rem] leading-relaxed text-mist-400">
            <span className="font-semibold text-cream-100 dark:text-[#f6f1e7]">Stay safe first.</span>{' '}
            EcoGuard shares general environmental guidance for learning — it never
            replaces official instructions. In an emergency, follow your local
            authorities and call your emergency number.
          </p>
        </div>

        {/* Bottom bar */}
        <div className="mt-8 flex flex-col items-center justify-between gap-4 border-t border-white/[0.08] pt-7 text-[0.8rem] text-mist-500 sm:flex-row">
          <p>© {year} EcoGuard. Grown with care for the wild.</p>
          <div className="flex items-center gap-5">
            <a href="mailto:support@ecoguard.example" className="transition-colors hover:text-leaf-300">
              Contact
            </a>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 px-3 py-1">
              <span className="h-1.5 w-1.5 rounded-full bg-leaf-400 animate-pulse-soft" />
              Demo environment
            </span>
          </div>
        </div>
      </div>

      {/* ghost wordmark */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-8 right-0 hidden select-none font-display text-[11rem] font-semibold italic leading-none tracking-tight text-cream-50/[0.035] dark:text-[#fbfaf6]/[0.035] lg:block"
      >
        EcoGuard
      </span>
    </footer>
  );
}
