import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu, X, Bell, ShieldCheck, LogOut, Sun, Moon, Monitor, Check } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { api } from '../services/api';
import { LeafSeal } from './Ornaments';
import { getInitials } from '../utils/format';

const NAV_LINKS = [
  { to: '/', label: 'Discover' },
  { to: '/dashboard', label: 'EcoPulse' },
  { to: '/map', label: 'Risk Map' },
  { to: '/hazards', label: 'Hazards' },
  { to: '/education', label: 'Knowledge Hub' },
  { to: '/safety', label: 'Safety' },
];

const THEME_OPTIONS = [
  { value: 'light', label: 'Day', hint: 'Always light', Icon: Sun },
  { value: 'dark', label: 'Night', hint: 'Always dark', Icon: Moon },
  { value: 'system', label: 'Follow system', hint: 'Matches your device', Icon: Monitor },
];

/** Dropdown picker for the light / dark / follow-system theme preference. */
function AppearanceMenu() {
  const [open, setOpen] = useState(false);
  const menuRef = useRef(null);
  const { theme, isDark, setTheme } = useTheme();
  const ResolvedIcon = isDark ? Moon : Sun;

  useEffect(() => {
    if (!open) return undefined;
    const onPointerDown = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setOpen(false);
      }
    };
    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  return (
    <div ref={menuRef} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Change color theme"
        aria-haspopup="menu"
        aria-expanded={open}
        title="Day, night or follow your device"
        className="grid h-10 w-10 place-items-center rounded-full text-charcoal-600 transition-colors hover:bg-forest-100/70 hover:text-forest-800 dark:text-mist-400 dark:hover:bg-forest-100/70 dark:hover:text-forest-300"
      >
        <ResolvedIcon className="h-[19px] w-[19px]" strokeWidth={1.8} />
      </button>

      {open && (
        <div
          role="menu"
          aria-label="Color theme"
          className="absolute right-0 top-[calc(100%+0.5rem)] z-50 w-52 overflow-hidden rounded-2xl border border-cream-200 bg-cream-50 p-1.5 shadow-soft-lg dark:bg-[#141b16]"
        >
          <p className="px-3 pb-1 pt-2 text-[0.62rem] font-bold uppercase tracking-[0.18em] text-mist-500">
            Appearance
          </p>
          {THEME_OPTIONS.map(({ value, label, hint, Icon }) => {
            const selected = theme === value;
            return (
              <button
                key={value}
                role="menuitemradio"
                aria-checked={selected}
                onClick={() => { setTheme(value); setOpen(false); }}
                className={`flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm transition-colors ${
                  selected
                    ? 'bg-forest-100/80 font-semibold text-forest-800'
                    : 'text-charcoal-700 hover:bg-forest-50 hover:text-forest-800'
                }`}
              >
                <Icon className={`h-[17px] w-[17px] shrink-0 ${selected ? 'text-forest-700' : 'text-mist-500'}`} strokeWidth={1.9} />
                <span className="flex-1">
                  <span className="block leading-tight">{label}</span>
                  <span className="block text-[0.68rem] font-normal text-mist-500">{hint}</span>
                </span>
                {selected && <Check className="h-4 w-4 shrink-0 text-forest-600" strokeWidth={2.2} />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function Navbar() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(() => window.scrollY > 10);
  const [unread, setUnread] = useState(0);
  const { user, isAuthenticated, logout } = useAuth();
  const location = useLocation();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // close the mobile menu on navigation
  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  // keep the bell dot honest: show it only while there are unread notifications
  // (refreshed on navigation, so reading them clears it)
  useEffect(() => {
    if (!isAuthenticated) {
      setUnread(0);
      return undefined;
    }
    let cancelled = false;
    api.notifications
      .getAll()
      .then((list) => {
        if (cancelled) return;
        const all = Array.isArray(list) ? list : list?.notifications || [];
        setUnread(all.filter((n) => !n.read_status).length);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [isAuthenticated, location.pathname]);

  const isActive = (to) => (to === '/' ? location.pathname === '/' : location.pathname.startsWith(to));

  return (
    <header
      className={`sticky top-0 z-50 border-b backdrop-blur-xl transition-all duration-300 ${
        scrolled
          ? 'border-cream-200/80 bg-cream-50/85 shadow-soft'
          : 'border-transparent bg-cream-50/60'
      }`}
    >
      <nav className="mx-auto flex h-[4.4rem] w-full max-w-6xl items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
        {/* Brand */}
        <Link to="/" className="group flex items-center gap-2.5">
          <span className="grid h-10 w-10 place-items-center rounded-full text-forest-700 transition-transform duration-500 group-hover:rotate-12">
            <LeafSeal className="h-10 w-10" />
          </span>
          <span className="font-display text-[1.45rem] font-semibold tracking-tight text-charcoal-950">
            Eco<span className="font-medium italic text-forest-700">Guard</span>
          </span>
        </Link>

        {/* Desktop nav */}
        <div className="hidden items-center gap-0.5 lg:flex">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              className={`relative rounded-full px-3.5 py-2 text-[0.92rem] font-medium transition-colors duration-200 ${
                isActive(link.to)
                  ? 'bg-forest-100/80 text-forest-800'
                  : 'text-charcoal-600 hover:bg-forest-50 hover:text-forest-700'
              }`}
            >
              {link.label}
              {isActive(link.to) && (
                <span className="absolute inset-x-3 -bottom-[7px] h-[2.5px] rounded-full bg-forest-600/80" />
              )}
            </Link>
          ))}
        </div>

        {/* Right actions */}
        <div className="flex items-center gap-2.5">
          {/* Appearance: day / night / follow system */}
          <AppearanceMenu />
          {isAuthenticated ? (
            <>
              <Link
                to="/notifications"
                aria-label="Notifications"
                className="relative grid h-10 w-10 place-items-center rounded-full text-charcoal-600 transition-colors hover:bg-forest-100/70 hover:text-forest-800"
              >
                <Bell className="h-[19px] w-[19px]" strokeWidth={1.8} />
                {unread > 0 && (
                  <span className="absolute right-2.5 top-2.5 h-2 w-2 rounded-full bg-status-high ring-2 ring-cream-50 animate-pulse-soft" />
                )}
              </Link>

              {user?.role === 'admin' && (
                <Link
                  to="/admin"
                  className="hidden items-center gap-1.5 rounded-full px-3 py-2 text-sm font-medium text-charcoal-600 transition-colors hover:bg-forest-100/70 hover:text-forest-800 md:inline-flex"
                >
                  <ShieldCheck className="h-4 w-4" strokeWidth={1.9} />
                  Admin
                </Link>
              )}

              <Link
                to="/profile"
                aria-label="Profile"
                className="hidden items-center gap-2 rounded-full p-1 pr-3 transition-colors hover:bg-forest-100/70 md:flex"
              >
                <span className="grid h-8 w-8 place-items-center rounded-full bg-forest-700 text-[0.75rem] font-bold text-cream-50 dark:text-[#fffdf7]">
                  {getInitials(user?.name)}
                </span>
                <span className="max-w-[7rem] truncate text-sm font-medium text-charcoal-700">
                  {user?.name}
                </span>
              </Link>

              <button
                onClick={logout}
                aria-label="Log out"
                className="hidden h-10 w-10 place-items-center rounded-full text-charcoal-600 transition-colors hover:bg-[#f7e5de] hover:text-[#a8432e] dark:text-mist-400 dark:hover:bg-[#2e1b14] dark:hover:text-[#ef9a83] md:grid"
              >
                <LogOut className="h-[18px] w-[18px]" strokeWidth={1.8} />
              </button>
            </>
          ) : (
            <div className="hidden items-center gap-2 md:flex">
              <Link to="/login" className="btn btn-ghost btn-sm">
                Sign in
              </Link>
              <Link to="/register" className="btn btn-primary btn-sm">
                Join EcoGuard
              </Link>
            </div>
          )}

          {/* Mobile toggle */}
          <button
            onClick={() => setOpen(!open)}
            aria-label="Toggle menu"
            className="grid h-10 w-10 place-items-center rounded-full text-charcoal-700 transition-colors hover:bg-forest-100/70 lg:hidden"
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </nav>

      {/* Mobile menu */}
      {open && (
        <div className="border-t border-cream-200/80 bg-cream-50/95 backdrop-blur-xl lg:hidden">
          <div className="mx-auto w-full max-w-6xl space-y-1 px-4 py-5 sm:px-6">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                className={`block rounded-xl px-4 py-3 text-[0.95rem] font-medium transition-colors ${
                  isActive(link.to)
                    ? 'bg-forest-100/80 text-forest-800'
                    : 'text-charcoal-700 hover:bg-forest-50'
                }`}
              >
                {link.label}
              </Link>
            ))}

            <div className="mt-4 border-t border-cream-200 pt-4">
              {isAuthenticated ? (
                <div className="space-y-2">
                  <Link
                    to="/report"
                    className="block rounded-xl bg-forest-700 px-4 py-3 text-center text-sm font-semibold text-cream-50 shadow-environmental transition-colors hover:bg-forest-800 dark:text-[#fffdf7]"
                  >
                    Report a hazard
                  </Link>
                  <div className="flex gap-2">
                    {user?.role === 'admin' && (
                      <Link
                        to="/admin"
                        className="flex-1 rounded-xl border border-cream-300 px-4 py-2.5 text-center text-sm font-medium text-charcoal-700"
                      >
                        Admin
                      </Link>
                    )}
                    <Link
                      to="/profile"
                      className="flex-1 rounded-xl border border-cream-300 px-4 py-2.5 text-center text-sm font-medium text-charcoal-700"
                    >
                      Profile
                    </Link>
                    <button
                      onClick={logout}
                      className="flex-1 rounded-xl border border-cream-300 px-4 py-2.5 text-center text-sm font-medium text-[#a8432e] dark:text-[#ef9a83]"
                    >
                      Log out
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <Link
                    to="/login"
                    className="block rounded-xl border border-cream-300 px-4 py-3 text-center text-sm font-semibold text-forest-800"
                  >
                    Sign in
                  </Link>
                  <Link
                    to="/register"
                    className="block rounded-xl bg-forest-700 px-4 py-3 text-center text-sm font-semibold text-cream-50 shadow-environmental transition-colors hover:bg-forest-800 dark:text-[#fffdf7]"
                  >
                    Join EcoGuard
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
