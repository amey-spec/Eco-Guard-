import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Reveal from '../components/Reveal';
import { LeafSeal, Sprig } from '../components/Ornaments';

export default function RegisterPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { register, isAuthenticated, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  // Already signed in? Head to the dashboard.
  useEffect(() => {
    if (isAuthenticated && !authLoading) {
      navigate('/dashboard', { replace: true });
    }
  }, [isAuthenticated, authLoading, navigate]);

  if (authLoading) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    // Client-side UX checks only — the backend remains the authority and
    // re-validates every field.
    if (name.trim().length < 2 || name.trim().length > 80) {
      setError('Name must be between 2 and 80 characters');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim())) {
      setError('Please enter a valid email address');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }
    if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
      setError('Password must include at least one letter and one number');
      return;
    }

    setLoading(true);
    try {
      await register(name, email, password);
      navigate('/dashboard');
    } catch (err) {
      setError(err.message || 'Registration failed');
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
          <h1 className="mt-5 text-4xl">Join the guardians</h1>
          <p className="mt-2 text-mist-600">Create an account and keep watch over your corner of the wild</p>
        </div>

        <div className="eco-card mt-8 p-8 sm:p-9">
          {error && (
            <div
              id="register-form-error"
              className="mb-5 rounded-xl border border-[#efcdbf] bg-[#f7e5de] px-4 py-3 text-sm font-medium text-[#a8432e]"
              role="alert"
            >
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5" noValidate>
            <div>
              <label htmlFor="name" className="field-label">
                Full name <span className="text-forest-600">*</span>
              </label>
              <input
                id="name"
                type="text"
                required
                autoComplete="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="field"
                placeholder="Robin Green"
                aria-invalid={!!error}
                aria-describedby={error ? 'register-form-error' : undefined}
              />
            </div>
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
                aria-describedby={error ? 'register-form-error' : undefined}
              />
            </div>
            <div>
              <label htmlFor="password" className="field-label">
                Password <span className="text-forest-600">*</span>
              </label>
              <input
                id="password"
                type="password"
                required
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="field"
                placeholder="8+ characters with letters & numbers"
                aria-invalid={!!error}
                aria-describedby={error ? 'register-form-error' : undefined}
              />
            </div>
            <div>
              <label htmlFor="confirmPassword" className="field-label">
                Confirm password <span className="text-forest-600">*</span>
              </label>
              <input
                id="confirmPassword"
                type="password"
                required
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="field"
                placeholder="Same again"
                aria-invalid={!!error}
                aria-describedby={error ? 'register-form-error' : undefined}
              />
            </div>

            <button type="submit" disabled={loading} className="btn btn-primary w-full btn-lg">
              {loading ? 'Planting your seed…' : 'Create account'}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-mist-600">
            Already a guardian?{' '}
            <Link to="/login" className="font-semibold text-forest-700 link-under">Sign in</Link>
          </p>
        </div>
      </Reveal>
    </div>
  );
}
