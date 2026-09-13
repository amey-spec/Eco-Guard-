import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../services/api';
import Reveal from '../components/Reveal';
import { LeafSeal, KeyRound, Loader2, CheckCircle2 } from 'lucide-react';

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const tokenFromUrl = searchParams.get('token');
  const emailFromUrl = searchParams.get('email');

  const [token, setToken] = useState(tokenFromUrl || '');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  // Auto-submit if token is in URL and passwords are filled
  useEffect(() => {
    if (tokenFromUrl && tokenFromUrl.length > 20) {
      setToken(tokenFromUrl);
    }
  }, [tokenFromUrl]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!token.trim()) {
      setError('No reset token provided. Request a new reset link.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }

    if (!/[A-Za-z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
      setError('Password must include at least one letter and one number.');
      return;
    }

    setLoading(true);
    try {
      await api.auth.resetPassword(token.trim(), newPassword);
      setSuccess(true);
    } catch (err) {
      setError(err.message || 'Could not reset your password. The token may be expired — request a new one.');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="relative flex min-h-[calc(100vh-4.4rem)] items-center justify-center overflow-hidden px-4 py-16 sm:px-6 lg:px-8">
        <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-b from-cream-100 via-cream-50 to-cream-50" />
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-topographic opacity-60" />

        <Reveal direction="up" className="relative w-full max-w-md text-center">
          <div className="grid h-20 w-20 place-items-center rounded-full bg-[#e5efe0] text-[#3e6a3c] mx-auto">
            <CheckCircle2 className="h-10 w-10" strokeWidth={2} />
          </div>
          <h1 className="mt-6 text-4xl font-display">Password reset</h1>
          <p className="mt-3 text-mist-600">Your password has been updated successfully.</p>
          <p className="mt-2 text-sm text-mist-500">Use your new password to sign in.</p>
          <Link to="/login" className="btn btn-primary btn-lg mt-8">
            Sign in
            <ArrowRight className="h-4 w-4" />
          </Link>
        </Reveal>
      </div>
    );
  }

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
          <h1 className="mt-5 text-4xl">Set a new password</h1>
          <p className="mt-2 text-mist-600">Enter your reset token and choose a new password</p>
        </div>

        <div className="eco-card mt-8 p-8 sm:p-9">
          {error && (
            <div
              id="reset-password-error"
              className="mb-5 rounded-xl border border-[#efcdbf] bg-[#f7e5de] px-4 py-3 text-sm font-medium text-[#a8432e]"
              role="alert"
            >
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5" noValidate>
            <div>
              <label htmlFor="reset-token" className="field-label">
                Reset token <span className="text-forest-600">*</span>
              </label>
              <input
                id="reset-token"
                type="text"
                required
                value={token}
                onChange={(e) => setToken(e.target.value)}
                className="field font-mono"
                placeholder="Paste the token here"
                aria-invalid={!!error}
                aria-describedby={error ? 'reset-password-error' : undefined}
              />
              <p className="mt-1 text-xs text-mist-500">
                Paste the token from your reset email (or the development screen).
              </p>
            </div>

            <div>
              <label htmlFor="new-password" className="field-label">
                New password <span className="text-forest-600">*</span>
              </label>
              <input
                id="new-password"
                type="password"
                required
                autoComplete="new-password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="field"
                placeholder="8+ characters with letters & numbers"
                aria-invalid={!!error}
                aria-describedby={error ? 'reset-password-error' : undefined}
              />
            </div>

            <div>
              <label htmlFor="confirm-password" className="field-label">
                Confirm new password <span className="text-forest-600">*</span>
              </label>
              <input
                id="confirm-password"
                type="password"
                required
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="field"
                placeholder="Same as above"
                aria-invalid={!!error}
                aria-describedby={error ? 'reset-password-error' : undefined}
              />
            </div>

            <div className="rounded-xl bg-cream-100/60 px-4 py-3 text-xs text-mist-500">
              At least 8 characters, with a letter and a number.
            </div>

            <button type="submit" disabled={loading} className="btn btn-primary w-full btn-lg">
              {loading ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Resetting…
                </span>
              ) : (
                'Reset password'
              )}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-mist-600">
            Didn't get a token?{' '}
            <Link to="/forgot-password" className="font-semibold text-forest-700 link-under">Request a new one</Link>
          </p>
        </div>
      </Reveal>
    </div>
  );
}

function ArrowRight({ className }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>;
}
