import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import Reveal from '../components/Reveal';
import { LeafSeal, Sprout, ArrowRight, Loader2 } from 'lucide-react';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [resetToken, setResetToken] = useState(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess(false);
    setResetToken(null);

    if (!email.trim()) {
      setError('Please enter your email address.');
      return;
    }

    setLoading(true);
    try {
      const data = await api.auth.forgotPassword(email.trim());
      setSuccess(true);
      if (data.resetToken) {
        setResetToken(data.resetToken);
      }
    } catch (err) {
      setError(err.message || 'Could not request a password reset.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-[calc(100vh-4.4rem)] items-center justify-center overflow-hidden px-4 py-16 sm:px-6 lg:px-8">
      <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-b from-cream-100 via-cream-50 to-cream-50" />
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-topographic opacity-60" />
      <div aria-hidden="true" className="absolute inset-0 bg-[radial-gradient(46%_40%_at_50%_0%,rgba(196,215,181,0.35),transparent_70%)]" />

      <Reveal direction="up" className="relative w-full max-w-md">
        <div className="text-center">
          <Link to="/" className="inline-block text-forest-700 transition-transform duration-300 hover:scale-105">
            <LeafSeal className="mx-auto h-16 w-16" />
          </Link>
          <h1 className="mt-5 text-4xl">Reset your password</h1>
          <p className="mt-2 text-mist-600">Enter your email and we'll send you a reset link</p>
        </div>

        <div className="eco-card mt-8 p-8 sm:p-9">
          {error && (
            <div
              id="forgot-password-error"
              className="mb-5 rounded-xl border border-[#efcdbf] bg-[#f7e5de] px-4 py-3 text-sm font-medium text-[#a8432e]"
              role="alert"
            >
              {error}
            </div>
          )}

          {success && (
            <div className="mb-5 rounded-xl border border-[#c5dcc3] bg-[#e5efe0] px-4 py-3 text-sm font-medium text-[#2f5a37]">
              {resetToken ? (
                <>
                  <p className="font-semibold">Your reset token (development only — not sent by email):</p>
                  <p className="mt-2 font-mono text-sm break-all bg-cream-100 px-3 py-2 rounded">{resetToken}</p>
                  <p className="mt-2 text-xs text-mist-500">
                    In production, this token would be sent to your email. Use it below to set a new password.
                  </p>
                  <Link
                    to={`/reset-password?token=${encodeURIComponent(resetToken)}&email=${encodeURIComponent(email)}`}
                    className="btn btn-primary btn-sm mt-4"
                  >
                    Set a new password
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </>
              ) : (
                <>
                  <p className="font-semibold">If an account with that email exists, a reset link has been sent.</p>
                  <p className="mt-1 text-xs text-mist-500">Check your inbox and follow the link to set a new password.</p>
                  <Link to="/login" className="btn btn-ghost btn-sm mt-4">
                    Back to sign in
                  </Link>
                </>
              )}
            </div>
          )}

          {!success && (
            <form onSubmit={handleSubmit} className="space-y-5" noValidate>
              <div>
                <label htmlFor="forgot-email" className="field-label">
                  Email address <span className="text-forest-600">*</span>
                </label>
                <input
                  id="forgot-email"
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="field"
                  placeholder="you@example.com"
                  aria-invalid={!!error}
                  aria-describedby={error ? 'forgot-password-error' : undefined}
                />
              </div>

              <button type="submit" disabled={loading} className="btn btn-primary w-full btn-lg">
                {loading ? (
                  <span className="inline-flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Sending…
                  </span>
                ) : (
                  'Send reset link'
                )}
              </button>
            </form>
          )}

          <p className="mt-6 text-center text-sm text-mist-600">
            Remember your password?{' '}
            <Link to="/login" className="font-semibold text-forest-700 link-under">Sign in</Link>
          </p>
        </div>

        <div className="mt-6 rounded-2xl border border-dashed border-cream-300 bg-cream-100/60 px-6 py-4 text-center text-[0.8rem] leading-relaxed text-mist-600">
          <p className="font-bold uppercase tracking-[0.14em] text-mist-500">Development notice</p>
          <p className="mt-1.5 text-xs">
            Email delivery is not configured. The reset token is shown on screen for testing.
            In production, this would be sent to your email.
          </p>
        </div>
      </Reveal>
    </div>
  );
}
