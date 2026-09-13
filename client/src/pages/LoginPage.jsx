import { useEffect, useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Reveal from '../components/Reveal';
import { LeafSeal, Sprig } from '../components/Ornaments';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login, isAuthenticated, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Already signed in? Head back to the dashboard (or where you were headed).
  useEffect(() => {
    if (isAuthenticated && !authLoading) {
      navigate(location.state?.from || '/dashboard', { replace: true });
    }
  }, [isAuthenticated, authLoading, navigate, location.state]);

  if (authLoading) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      navigate(location.state?.from || '/dashboard', { replace: true });
    } catch (err) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-[calc(100vh-4.4rem)] items-center justify-center overflow-hidden px-4 py-16 sm:px-6 lg:px-8">
      <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-b from-cream-100 via-cream-50 to-cream-50" />
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-topographic opacity-60" />
      <div aria-hidden="true" className="absolute inset-0 bg-[radial-gradient(46%_40%_at_50%_0%,rgba(196,215,181,0.35),transparent_70%)]" />
      <Sprig className="pointer-events-none absolute left-[6%] top-16 hidden h-16 w-auto rotate-12 text-forest-200 animate-sway-slow md:block" />
      <Sprig className="pointer-events-none absolute bottom-12 right-[7%] hidden h-14 w-auto -rotate-[16deg] text-moss-300 animate-float-slow md:block" />

      <Reveal direction="up" className="relative w-full max-w-md">
        <div className="text-center">
          <Link to="/" className="inline-block text-forest-700 transition-transform duration-300 hover:scale-105">
            <LeafSeal className="mx-auto h-16 w-16" />
          </Link>
          <h1 className="mt-5 text-4xl">Welcome back</h1>
          <p className="mt-2 text-mist-600">Sign in to your EcoGuard lookout</p>
        </div>

        <div className="eco-card mt-8 p-8 sm:p-9">
          {error && (
            <div
              id="login-form-error"
              className="mb-5 rounded-xl border border-[#efcdbf] bg-[#f7e5de] px-4 py-3 text-sm font-medium text-[#a8432e]"
              role="alert"
            >
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5" noValidate>
            <div>
              <label htmlFor="email" className="field-label">
                Email address <span className="text-forest-600">*</span>
              </label>
              <input
                id="email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="field"
                placeholder="you@example.com"
                aria-invalid={!!error}
                aria-describedby={error ? 'login-form-error' : undefined}
              />
            </div>
            <div>
              <div className="flex items-center justify-between">
                <label htmlFor="password" className="field-label">
                  Password <span className="text-forest-600">*</span>
                </label>
                <span className="mb-2 text-xs text-mist-400">demo: user123</span>
              </div>
              <input
                id="password"
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="field"
                placeholder="••••••••"
                aria-invalid={!!error}
                aria-describedby={error ? 'login-form-error' : undefined}
              />
            </div>

            <button type="submit" disabled={loading} className="btn btn-primary w-full btn-lg">
              {loading ? 'Opening the gate…' : 'Sign in'}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-mist-600">
            New to the network?{' '}
            <Link to="/register" className="font-semibold text-forest-700 link-under">Create an account</Link>
          </p>
        </div>

        <div className="mt-6 rounded-2xl border border-dashed border-cream-300 bg-cream-100/60 px-6 py-4 text-center text-[0.8rem] leading-relaxed text-mist-600" role="region" aria-label="Demo credentials">
          <p className="font-bold uppercase tracking-[0.14em] text-mist-500">Demo credentials</p>
          <p className="mt-1.5">
            Guardian — <span className="font-semibold text-charcoal-800">user@ecoguard.com / user123</span>
            <br />
            Ranger (admin) — <span className="font-semibold text-charcoal-800">admin@ecoguard.com / admin123</span>
          </p>
        </div>
      </Reveal>
    </div>
  );
}
