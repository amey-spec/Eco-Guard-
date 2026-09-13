import { useCallback, useEffect, useState } from 'react';
import { FileText, ShieldCheck, Sprout, Pencil, KeyRound, Save, X, RefreshCw, ArrowRight, Trash2, AlertTriangle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api, mediaUrl } from '../services/api';
import PageHeader from '../components/PageHeader';
import Reveal from '../components/Reveal';
import StatusBadge from '../components/StatusBadge';
import { getHazardMeta } from '../utils/hazardMeta';
import { getInitials, timeAgo } from '../utils/format';

const PASSWORD_HINT = 'At least 8 characters, with a letter and a number.';

export default function ProfilePage() {
  const { user, updateUser } = useAuth();

  // live report history
  const [myReports, setMyReports] = useState(null); // null = loading
  const [loadError, setLoadError] = useState(false);

  // inline name editing
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState('');
  const [savingName, setSavingName] = useState(false);
  const [nameMsg, setNameMsg] = useState(null);

  // change password
  const [pw, setPw] = useState({ current: '', next: '', confirm: '' });
  const [savingPw, setSavingPw] = useState(false);
  const [pwMsg, setPwMsg] = useState(null);

  const load = useCallback(async () => {
    setLoadError(false);
    setMyReports(null);
    try {
      const list = await api.reports.getMyReports();
      setMyReports(Array.isArray(list) ? list : []);
    } catch {
      setMyReports([]);
      setLoadError(true);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const reportsLeft = myReports?.length ?? null;
  const contributions = myReports ? myReports.filter((r) => r.status === 'Resolved').length : null;

  const stats = [
    { icon: FileText, value: reportsLeft, label: 'Reports left', caption: 'signals you’ve filed' },
    { icon: ShieldCheck, value: user?.role === 'admin' ? 'Ranger' : 'Guardian', label: 'Your role', caption: 'standing on the network' },
    { icon: Sprout, value: contributions, label: 'Contributions', caption: 'of yours that were resolved' },
  ];

  /* ---------- name editing ---------- */

  const startEditName = () => {
    setNameDraft(user?.name || '');
    setNameMsg(null);
    setEditingName(true);
  };

  const saveName = async (e) => {
    e.preventDefault();
    const name = nameDraft.trim();
    if (name.length < 2) {
      setNameMsg({ kind: 'error', text: 'Name must be at least 2 characters.' });
      return;
    }
    setSavingName(true);
    setNameMsg(null);
    try {
      const updated = await api.auth.updateProfile(name);
      updateUser(updated);
      setNameMsg({ kind: 'success', text: 'Name saved.' });
      setEditingName(false);
    } catch (err) {
      setNameMsg({ kind: 'error', text: err.message || 'Could not save your name.' });
    } finally {
      setSavingName(false);
    }
  };

  /* ---------- password change ---------- */

  const submitPassword = async (e) => {
    e.preventDefault();
    setPwMsg(null);
    if (!pw.current) {
      setPwMsg({ kind: 'error', text: 'Enter your current password.' });
      return;
    }
    if (pw.next !== pw.confirm) {
      setPwMsg({ kind: 'error', text: 'New passwords do not match.' });
      return;
    }
    if (pw.next.length < 8 || !/[A-Za-z]/.test(pw.next) || !/[0-9]/.test(pw.next)) {
      setPwMsg({ kind: 'error', text: `New password needs ${PASSWORD_HINT.toLowerCase()}` });
      return;
    }
    setSavingPw(true);
    try {
      await api.auth.changePassword(pw.current, pw.next);
      setPwMsg({ kind: 'success', text: 'Password updated — use it next time you sign in.' });
      setPw({ current: '', next: '', confirm: '' });
    } catch (err) {
      setPwMsg({ kind: 'error', text: err.message || 'Could not change the password.' });
    } finally {
      setSavingPw(false);
    }
  };

  const field = 'field !min-h-0 !py-2.5 text-sm';

  /* ---------- account deletion ---------- */

  const [deleting, setDeleting] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteMsg, setDeleteMsg] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const startDeleteConfirm = () => {
    setDeleteConfirm(true);
    setDeletePassword('');
    setDeleteMsg(null);
  };

  const cancelDeleteConfirm = () => {
    setDeleteConfirm(false);
    setDeletePassword('');
    setDeleteMsg(null);
  };

  const submitDelete = async (e) => {
    e.preventDefault();
    setDeleteLoading(true);
    setDeleteMsg(null);

    if (deletePassword.length < 8) {
      setDeleteMsg({ kind: 'error', text: 'Password must be at least 8 characters.' });
      setDeleteLoading(false);
      return;
    }

    try {
      await api.auth.deleteAccount(deletePassword);
      setDeleteMsg({ kind: 'success', text: 'Your account has been deleted. You will be signed out.' });
      setDeleteLoading(false);
      // Sign out the user after successful deletion.
      window.setTimeout(() => {
        window.location.href = '/login';
      }, 2000);
    } catch (err) {
      setDeleteMsg({ kind: 'error', text: err.message || 'Could not delete your account.' });
      setDeleteLoading(false);
    }
  };

  return (
    <div>
      <PageHeader
        eyebrow="My EcoSpace"
        title="Your corner of the forest"
        subtitle="Reports you’ve left, their journey through the network, and how to keep your details current."
      />

      <div className="mx-auto w-full max-w-6xl px-4 pb-24 sm:px-6 lg:px-8">
        {/* identity card */}
        <Reveal>
          <div className="eco-card overflow-hidden">
            <div className="relative h-28 bg-gradient-to-br from-forest-700 via-forest-800 to-forest-950 dark:from-[#38553f] dark:via-[#2f4735]">
              {/* decorative only — never intercept clicks on the identity row below */}
              <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-topographic opacity-50" />
            </div>
            {/* relative so the -mt-9 identity row paints above the banner above it */}
            <div className="relative px-7 pb-8">
              <div className="-mt-9 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
                <div className="flex items-end gap-4">
                  <span className="grid h-20 w-20 place-items-center rounded-3xl bg-forest-700 text-xl font-bold text-cream-50 ring-4 ring-[#fffdf7] dark:text-[#fffdf7] dark:ring-cream-50">
                    {getInitials(user?.name)}
                  </span>
                  <div className="pb-1">
                    <div className="flex items-center gap-2">
                      {editingName ? (
                        <form onSubmit={saveName} className="flex flex-wrap items-center gap-2">
                          <input
                            autoFocus
                            value={nameDraft}
                            onChange={(e) => setNameDraft(e.target.value)}
                            maxLength={80}
                            aria-label="Your name"
                            className="field !w-52 !min-h-0 !py-1.5 text-sm"
                          />
                          <button type="submit" disabled={savingName} className="btn btn-primary btn-sm">
                            {savingName ? 'Saving…' : <><Save className="h-3.5 w-3.5" /> Save</>}
                          </button>
                          <button
                            type="button"
                            onClick={() => { setEditingName(false); setNameMsg(null); }}
                            className="btn btn-ghost btn-sm"
                          >
                            <X className="h-3.5 w-3.5" /> Cancel
                          </button>
                        </form>
                      ) : (
                        <>
                          <h2 className="text-2xl">{user?.name || 'Guest guardian'}</h2>
                          <button
                            onClick={startEditName}
                            aria-label="Edit your name"
                            title="Edit your name"
                            className="grid h-7 w-7 place-items-center rounded-full text-mist-400 transition-colors hover:bg-forest-100 hover:text-forest-700"
                          >
                            <Pencil className="h-3.5 w-3.5" strokeWidth={2} />
                          </button>
                        </>
                      )}
                    </div>
                    {nameMsg && (
                      <p className={`mt-1 text-xs font-semibold ${nameMsg.kind === 'success' ? 'text-[#3e6a3c]' : 'text-[#a8432e]'}`}>
                        {nameMsg.text}
                      </p>
                    )}
                    <p className="text-sm text-mist-500">{user?.email}</p>
                  </div>
                </div>
                <span className="chip w-fit self-start sm:self-end">
                  <span className="h-1.5 w-1.5 rounded-full bg-forest-500" />
                  {user?.role === 'admin' ? 'Ranger (admin)' : 'Guardian'}
                </span>
              </div>

              <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
                {stats.map((s) => {
                  const Icon = s.icon;
                  return (
                    <div key={s.label} className="rounded-2xl border border-dashed border-cream-300 bg-cream-50/60 p-5">
                      <Icon className="h-5 w-5 text-forest-600" strokeWidth={1.9} />
                      <p className="mt-3 font-display text-2xl text-charcoal-900">
                        {s.value === null ? '…' : s.value}
                      </p>
                      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-mist-500">{s.label}</p>
                      <p className="mt-0.5 text-[0.7rem] text-mist-400">{s.caption}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </Reveal>

        {/* account & security */}
        <Reveal delay={80}>
          <div className="eco-card mt-10 p-6 sm:p-8">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-2xl">Account & security</h2>
                <p className="mt-1 text-sm text-mist-600">Keep your sign-in details up to date.</p>
              </div>
              <KeyRound className="h-6 w-6 text-forest-600" strokeWidth={1.7} />
            </div>

            <form onSubmit={submitPassword} className="mt-6">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <label className="block">
                  <span className="text-xs font-bold uppercase tracking-[0.12em] text-mist-500">Current password</span>
                  <input
                    type="password"
                    value={pw.current}
                    onChange={(e) => setPw((p) => ({ ...p, current: e.target.value }))}
                    autoComplete="current-password"
                    placeholder="••••••••"
                    className="field mt-1.5"
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-bold uppercase tracking-[0.12em] text-mist-500">New password</span>
                  <input
                    type="password"
                    value={pw.next}
                    onChange={(e) => setPw((p) => ({ ...p, next: e.target.value }))}
                    autoComplete="new-password"
                    placeholder="••••••••"
                    className="field mt-1.5"
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-bold uppercase tracking-[0.12em] text-mist-500">Confirm new</span>
                  <input
                    type="password"
                    value={pw.confirm}
                    onChange={(e) => setPw((p) => ({ ...p, confirm: e.target.value }))}
                    autoComplete="new-password"
                    placeholder="••••••••"
                    className="field mt-1.5"
                  />
                </label>
              </div>

              <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center">
                <button type="submit" disabled={savingPw} className="btn btn-primary">
                  {savingPw ? 'Updating…' : <><KeyRound className="h-4 w-4" /> Update password</>}
                </button>
                <p className="text-xs text-mist-500">{PASSWORD_HINT}</p>
              </div>
              {pwMsg && (
                <p className={`mt-4 rounded-xl border px-4 py-3 text-sm font-semibold ${
                  pwMsg.kind === 'success'
                    ? 'border-[#c5dcc3] bg-[#e5efe0] text-[#2f5a37]'
                    : 'border-[#efcdbf] bg-[#f7e5de] text-[#a8432e]'
                }`}>
                  {pwMsg.text}
                </p>
              )}
            </form>

            {/* account deletion */}
            <div className="mt-8 pt-6 border-t border-cream-200">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl">Delete account</h2>
                  <p className="mt-1 text-sm text-mist-600">Permanently delete your account and all of your data.</p>
                </div>
                <AlertTriangle className="h-5 w-5 text-status-high" strokeWidth={1.7} />
              </div>

              {!deleteConfirm ? (
                <button
                  onClick={startDeleteConfirm}
                  className="mt-4 btn btn-danger"
                >
                  <Trash2 className="h-4 w-4" />
                  Delete my account
                </button>
              ) : (
                <form onSubmit={submitDelete} className="mt-4 space-y-4">
                  <div className="rounded-xl border border-[#efcdbf] bg-[#f7e5de] px-4 py-3 text-sm">
                    <p className="font-semibold text-[#a8432e]">This action cannot be undone.</p>
                    <ul className="mt-2 text-xs text-[#a8432e] space-y-1">
                      <li>Your account will be disabled and can never be recovered.</li>
                      <li>Your password will be wiped.</li>
                      <li>Your notifications will be deleted.</li>
                      <li>Your reports will become anonymous (no longer linked to you).</li>
                      <li>Audit and security records are preserved.</li>
                    </ul>
                  </div>

                  <label className="block">
                    <span className="text-xs font-bold uppercase tracking-[0.12em] text-mist-500">Type your password to confirm</span>
                    <input
                      type="password"
                      value={deletePassword}
                      onChange={(e) => setDeletePassword(e.target.value)}
                      autoComplete="current-password"
                      placeholder="••••••••"
                      className="field mt-1.5"
                      aria-invalid={deleteMsg && deleteMsg.kind === 'error'}
                    />
                  </label>

                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={cancelDeleteConfirm}
                      className="btn btn-ghost"
                      disabled={deleteLoading}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={deleteLoading}
                      className="btn btn-danger"
                    >
                      {deleteLoading ? 'Deleting…' : 'Delete my account'}
                    </button>
                  </div>

                  {deleteMsg && (
                    <p className={`mt-4 rounded-xl border px-4 py-3 text-sm font-semibold ${
                      deleteMsg.kind === 'success'
                        ? 'border-[#c5dcc3] bg-[#e5efe0] text-[#2f5a37]'
                        : 'border-[#efcdbf] bg-[#f7e5de] text-[#a8432e]'
                    }`}>
                      {deleteMsg.text}
                    </p>
                  )}
                </form>
              )}
            </div>
          </div>
        </Reveal>

        {/* my reports */}
        <div className="mt-14">
          <Reveal>
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <h2 className="text-3xl">My reports</h2>
                <p className="mt-1.5 text-mist-600">Everything you’ve filed, newest first — and where it stands now.</p>
              </div>
              <Link to="/report" className="btn btn-soft btn-sm">
                Report a hazard
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </Reveal>

          <div className="mt-6 space-y-4">
            {myReports === null ? (
              <div className="eco-card eco-loading">
                <div className="eco-loader" />
                <p className="eco-loading-text">Fetching your reports…</p>
              </div>
            ) : loadError ? (
              <div className="eco-card px-8 py-12 text-center">
                <p className="font-display text-xl text-charcoal-900">Could not load your reports</p>
                <p className="mx-auto mt-2 max-w-sm text-sm text-mist-600">
                  The network is out of reach right now. Try again in a moment.
                </p>
                <button onClick={load} className="btn btn-ghost btn-sm mt-5">
                  <RefreshCw className="h-3.5 w-3.5" /> Retry
                </button>
              </div>
            ) : myReports.length === 0 ? (
              <div className="eco-card px-8 py-14 text-center">
                <Sprout className="mx-auto h-9 w-9 text-mist-300" />
                <p className="mt-4 font-display text-xl text-charcoal-900">No reports yet</p>
                <p className="mx-auto mt-2 max-w-sm text-sm text-mist-600">
                  When you spot a hazard, leave a signal here — then watch its trail from first sighting to all clear.
                </p>
                <Link to="/report" className="btn btn-primary btn-sm mt-5">
                  Report a hazard
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            ) : (
              myReports.map((report, i) => {
                const meta = getHazardMeta(report.hazard_type);
                const Icon = meta.icon;
                return (
                  <Reveal key={report.id} delay={Math.min(i, 4) * 60}>
                    <div className="eco-card eco-card--flush p-5 sm:p-6">
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                        <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ring-1 ring-black/[0.04] ${meta.tile}`}>
                          <Icon className="h-5 w-5" strokeWidth={1.9} />
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-[0.68rem] font-bold uppercase tracking-[0.14em] text-mist-400">{report.id}</p>
                            <StatusBadge status={report.status} type="status" />
                          </div>
                          <h3 className="mt-1 text-[1.05rem] leading-snug">{report.title}</h3>
                          <p className="mt-1 truncate text-xs text-mist-500">
                            {report.hazard_type} · {report.location}
                          </p>
                          {report.description && (
                            <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-mist-600">
                              {report.description}
                            </p>
                          )}
                          <p className="mt-2 text-[0.72rem] text-mist-400">filed {timeAgo(report.created_at)}</p>
                        </div>
                        <div className="flex items-center gap-4 sm:flex-col sm:items-end">
                          <StatusBadge status={report.severity} type="severity" />
                          {report.image_url && (
                            <img
                              src={mediaUrl(report.image_url)}
                              alt={`Photo for report ${report.id}: ${report.title}`}
                              loading="lazy"
                              className="h-14 w-20 rounded-lg object-cover ring-1 ring-black/[0.05]"
                            />
                          )}
                        </div>
                      </div>
                    </div>
                  </Reveal>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
