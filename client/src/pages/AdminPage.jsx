import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Users, Activity, FileText, ShieldCheck, Clock, CheckCircle2, Trash2,
  Save, X, Search, RefreshCw, AlertCircle, Inbox, UserCog, LogOut,
  Camera, MapPin, ClipboardCheck, ClipboardList, ScrollText, Shield,
  Eye, UserCheck, Lock, Zap,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { api, mediaUrl } from '../services/api';
import { useAuth } from '../context/AuthContext';
import PageHeader from '../components/PageHeader';
import StatusBadge from '../components/StatusBadge';
import CountUp from '../components/CountUp';
import Reveal from '../components/Reveal';
import RiskMap from '../components/RiskMap';
import { getHazardMeta } from '../utils/hazardMeta';
import { getInitials, timeAgo } from '../utils/format';

const ALL_STATUSES = ['Submitted', 'Pending', 'Under Review', 'Verified', 'Resolved', 'Rejected'];
const BAR_COLORS = ['#44684a', '#6d7d3e', '#54905f', '#5b8ca3', '#3f7d8f', '#d9753f', '#b06f8f', '#c79a2f', '#ac7b45'];
const SEVERITY_DOT = {
  Critical: 'bg-status-critical',
  High: 'bg-status-high',
  Moderate: 'bg-status-moderate',
  Low: 'bg-status-low',
};

const CLOSED = new Set(['Resolved', 'Rejected']);

/* Work buckets shown across the console (and as queue filters). */
const WORKFLOW = [
  { id: 'awaiting', label: 'Awaiting confirmation', statuses: ['Submitted'] },
  { id: 'active', label: 'Under investigation', statuses: ['Pending', 'Under Review', 'In Review', 'Verified'] },
  { id: 'completed', label: 'Completed', statuses: ['Resolved', 'Rejected'] },
];
const WORKFLOW_SET = Object.fromEntries(WORKFLOW.map((b) => [b.id, new Set(b.statuses)]));

const BUCKET_TILES = [
  {
    id: 'all', label: 'All reports', caption: 'Every signal on record',
    icon: ClipboardList, chip: 'bg-forest-100 text-forest-700', dot: 'bg-forest-500',
  },
  {
    id: 'awaiting', label: 'Awaiting confirmation', caption: 'Fresh signals to confirm',
    icon: Inbox, chip: 'bg-[#f7efd8] text-[#8f6f13]', dot: 'bg-[#c79a2f]',
  },
  {
    id: 'active', label: 'Under investigation', caption: 'Cases being worked now',
    icon: ClipboardCheck, chip: 'bg-[#e3edf0] text-[#3d6f83]', dot: 'bg-[#5b8ca3]',
  },
  {
    id: 'completed', label: 'Completed', caption: 'Resolved & closed files',
    icon: CheckCircle2, chip: 'bg-[#e5efe0] text-[#3e6a3c]', dot: 'bg-[#3c7049]',
  },
];

/* Subtitle + empty-state copy per queue filter. */
const QUEUE_COPY = {
  all: {
    subtitle: 'Review, verify, resolve — or send back for a second look.',
    empty: 'No community signals to moderate right now.',
  },
  awaiting: {
    subtitle: 'Signals waiting for a ranger’s first look. Confirm one to open the case.',
    empty: 'Nothing is waiting for confirmation — the inbox is clear.',
  },
  active: {
    subtitle: 'Open investigations being worked right now, from first review to verification.',
    empty: 'No investigations are open right now.',
  },
  completed: {
    subtitle: 'Closed files — resolved or rejected, with their field notes.',
    empty: 'No completed cases on record yet.',
  },
};

/* One-click next step per open status (advanced moves stay in the dropdown). */
const QUICK_LABEL = {
  Submitted: 'Confirm',
  Pending: 'Verify',
  'Under Review': 'Verify',
  'In Review': 'Verify',
  Verified: 'Resolve',
};
const QUICK_TO = {
  Submitted: 'Verified',
  Pending: 'Verified',
  'Under Review': 'Verified',
  'In Review': 'Verified',
  Verified: 'Resolved',
};

const hasCoords = (r) =>
  Number.isFinite(Number(r.latitude)) && Number.isFinite(Number(r.longitude));

export default function AdminPage() {
  const { user, logout } = useAuth();
  const [reports, setReports] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fatal, setFatal] = useState(null);

  const [queueView, setQueueView] = useState('all'); // 'all' | workflow id
  const [search, setSearch] = useState('');
  const queueRef = useRef(null);
  const [toast, setToast] = useState(null);

  // inline moderation state
  const [editing, setEditing] = useState(null); // { id, status }
  const [notes, setNotes] = useState('');
  const [busyId, setBusyId] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);

  // Admin & Security section state
  const [admins, setAdmins] = useState([]);
  const [securityOverview, setSecurityOverview] = useState(null);
  const [auditLog, setAuditLog] = useState(null);
  const [selectedAdmin, setSelectedAdmin] = useState(null);
  const [adminDetails, setAdminDetails] = useState(null);
  const [loadingAdmins, setLoadingAdmins] = useState(false);
  const [loadingSecurity, setLoadingSecurity] = useState(false);
  const [activeTab, setActiveTab] = useState('directory'); // 'directory' | 'security' | 'audit'

  const notify = useCallback((kind, msg) => {
    setToast({ kind, msg });
    window.setTimeout(() => setToast(null), 3500);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setFatal(null);
    try {
      const [reportsRes, usersRes] = await Promise.all([
        api.reports.getAll(),
        api.admin.getUsers(),
      ]);
      setReports(Array.isArray(reportsRes) ? reportsRes : reportsRes?.reports || []);
      setUsers(Array.isArray(usersRes) ? usersRes : usersRes?.users || []);
    } catch (err) {
      setFatal(err.message || 'Failed to load the console');
    } finally {
      setLoading(false);
    }
  }, []);

  // Load admin & security data
  const loadAdminData = useCallback(async () => {
    setLoadingAdmins(true);
    setLoadingSecurity(true);
    try {
      const [adminsRes, securityRes, auditRes] = await Promise.all([
        api.admin.getAdministrators(),
        api.admin.getSecurityOverview(),
        api.admin.getAuditLog({ limit: 20 }),
      ]);
      setAdmins(adminsRes.administrators || []);
      setSecurityOverview(securityRes);
      setAuditLog(auditRes.entries || []);
    } catch (err) {
      console.error('Failed to load admin data:', err);
    } finally {
      setLoadingAdmins(false);
      setLoadingSecurity(false);
    }
  }, []);

  // Load details for a specific admin
  const loadAdminDetails = useCallback(async (adminId) => {
    try {
      const details = await api.admin.getAdministratorDetails(adminId);
      setAdminDetails(details);
      setSelectedAdmin(adminId);
    } catch (err) {
      console.error('Failed to load admin details:', err);
      setAdminDetails(null);
    }
  }, []);

  useEffect(() => {
    load();
    loadAdminData();
  }, [load, loadAdminData]);

  const filteredReports = useMemo(() => {
    const allowed = queueView === 'all' ? null : WORKFLOW_SET[queueView];
    const q = search.trim().toLowerCase();
    return reports.filter((r) => {
      if (allowed && !allowed.has(r.status)) return false;
      if (!q) return true;
      return [r.title, r.hazard_type, r.location, r.id, r.reporter_name]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q));
    });
  }, [reports, queueView, search]);

  const bucketCount = useMemo(() => {
    const counts = { all: reports.length };
    WORKFLOW.forEach((b) => {
      counts[b.id] = reports.filter((r) => WORKFLOW_SET[b.id].has(r.status)).length;
    });
    return counts;
  }, [reports]);

  /* open (non-closed) signals, and those pinned with coordinates for the map */
  const openCount = useMemo(() => reports.filter((r) => !CLOSED.has(r.status)).length, [reports]);
  const onArea = useMemo(() => reports.filter((r) => !CLOSED.has(r.status) && hasCoords(r)), [reports]);

  /* photo attachments still on live cases vs. archived with closed ones */
  const fileCounts = useMemo(() => {
    let open = 0;
    let closed = 0;
    reports.forEach((r) => {
      if (!r.image_url) return;
      if (CLOSED.has(r.status)) closed += 1;
      else open += 1;
    });
    return { open, closed };
  }, [reports]);

  const goToQueue = (view) => {
    setQueueView(view);
    setEditing(null);
    queueRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const bySeverity = useMemo(() => {
    const counts = { Critical: 0, High: 0, Moderate: 0, Low: 0 };
    reports.forEach((r) => { if (counts[r.severity] !== undefined) counts[r.severity] += 1; });
    return counts;
  }, [reports]);

  const byStatus = useMemo(() => {
    const counts = { Open: 0, Verified: 0, Resolved: 0 };
    reports.forEach((r) => {
      const s = String(r.status || '');
      if (s === 'Resolved') counts.Resolved += 1;
      else if (s === 'Verified') counts.Verified += 1;
      else if (s !== 'Rejected') counts.Open += 1;
    });
    return counts;
  }, [reports]);

  const byCategory = useMemo(() => {
    const map = {};
    reports.forEach((r) => { map[r.hazard_type] = (map[r.hazard_type] || 0) + 1; });
    return Object.entries(map)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);
  }, [reports]);

  const maxCategory = Math.max(1, ...byCategory.map((c) => c.count));

  /* ---------- moderation actions ---------- */

  const beginEdit = (report) => {
    setConfirmDelete(null);
    setEditing({ id: report.id, status: report.status });
    setNotes('');
  };

  const cancelEdit = () => { setEditing(null); setNotes(''); };

  const applyStatus = async () => {
    if (!editing) return;
    setBusyId(editing.id);
    try {
      await api.admin.updateReportStatus(editing.id, editing.status, notes);
      setReports((prev) => prev.map((r) => (r.id === editing.id ? { ...r, status: editing.status } : r)));
      notify('success', `${editing.id} moved to ${editing.status}.`);
      setEditing(null);
      setNotes('');
    } catch (err) {
      notify('error', err.message || 'Could not update the report');
    } finally {
      setBusyId(null);
    }
  };

  const removeReport = async (id) => {
    setBusyId(id);
    try {
      await api.admin.deleteReport(id);
      setReports((prev) => prev.filter((r) => r.id !== id));
      setConfirmDelete(null);
      notify('success', `${id} removed from the record.`);
    } catch (err) {
      notify('error', err.message || 'Could not delete the report');
    } finally {
      setBusyId(null);
    }
  };

  const quickMove = async (report) => {
    const next = QUICK_TO[report.status];
    if (!next) return;
    setBusyId(report.id);
    try {
      await api.admin.updateReportStatus(report.id, next, '');
      setReports((prev) => prev.map((r) => (r.id === report.id ? { ...r, status: next } : r)));
      notify('success', `${report.id} ${next.toLowerCase()}.`);
    } catch (err) {
      notify('error', err.message || 'Could not update the report');
    } finally {
      setBusyId(null);
    }
  };

  const changeRole = async (id, role) => {
    setBusyId(`user-${id}`);
    try {
      await api.admin.updateUserRole(id, role);
      setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, role } : u)));
      notify('success', role === 'admin' ? 'Promoted to ranger (admin).' : 'Moved to guardian (user).');
    } catch (err) {
      notify('error', err.message || 'Could not change the role');
    } finally {
      setBusyId(null);
    }
  };

  const changeStatus = async (id, status) => {
    setBusyId(`user-${id}`);
    try {
      await api.admin.updateUserStatus(id, status);
      setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, status } : u)));
      notify('success', status === 'active' ? 'Account reactivated.' : `Account set to ${status}.`);
    } catch (err) {
      notify('error', err.message || 'Could not change the account status');
    } finally {
      setBusyId(null);
    }
  };

  const summary = [
    { icon: Users, label: 'Guardians', value: users.length, tone: 'bg-forest-100 text-forest-700' },
    { icon: Activity, label: 'Total signals', value: reports.length, tone: 'bg-[#e3edf0] text-[#3d6f83]' },
    { icon: Clock, label: 'Open cases', value: byStatus.Open, tone: 'bg-[#f7efd8] text-[#8f6f13]' },
    { icon: ShieldCheck, label: 'Verified', value: byStatus.Verified, tone: 'bg-moss-100 text-moss-700' },
    { icon: CheckCircle2, label: 'Resolved', value: byStatus.Resolved, tone: 'bg-[#e5efe0] text-[#3e6a3c]' },
  ];

  if (fatal) {
    return (
      <div>
        <PageHeader eyebrow="Ranger console" title="The console is out of reach" />
        <div className="mx-auto w-full max-w-6xl px-4 pb-24 sm:px-6 lg:px-8">
          <div className="eco-card mx-auto max-w-lg px-8 py-12 text-center">
            <AlertCircle className="mx-auto h-10 w-10 text-[#a8432e]" />
            <p className="mt-4 font-display text-xl">Could not load the console</p>
            <p className="mx-auto mt-2 max-w-sm text-sm text-mist-600">
              {fatal.includes('token') || fatal.includes('expired') || fatal.includes('Account')
                ? 'Your session may have expired or your role changed. Sign in again as a ranger.'
                : fatal}
            </p>
            <div className="mt-7 flex justify-center gap-3">
              <button onClick={() => { logout(); window.location.href = '/login'; }} className="btn btn-primary btn-sm">
                <LogOut className="h-4 w-4" /> Sign in again
              </button>
              <button onClick={load} className="btn btn-ghost btn-sm">Retry</button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        eyebrow="Ranger console"
        title="Stewarding the demo region"
        subtitle="Shepherd reports from first signal to all clear, and keep the guardians of the network in good standing."
      >
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <span className="inline-flex items-center gap-2 rounded-full border border-cream-300 bg-cream-50 px-3.5 py-1.5 text-[0.72rem] font-bold uppercase tracking-[0.16em] text-cream-700">
            <span className="h-1.5 w-1.5 rounded-full bg-forest-500 animate-pulse-soft" />
            {user?.name} · ranger
          </span>
          <button onClick={load} className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold text-forest-700 transition-colors hover:bg-forest-100/70">
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </PageHeader>

      <div className="mx-auto w-full max-w-6xl px-4 pb-24 sm:px-6 lg:px-8">
        {/* summary */}
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
          {summary.map((s, i) => {
            const Icon = s.icon;
            return (
              <Reveal key={s.label} delay={i * 60} className="h-full">
                <div className="eco-card flex h-full flex-col p-5">
                  <div className="flex items-center justify-between">
                    <span className={`grid h-9 w-9 place-items-center rounded-lg ${s.tone}`}>
                      <Icon className="h-[18px] w-[18px]" strokeWidth={1.9} />
                    </span>
                  </div>
                  <p className="mt-3 text-[0.7rem] font-bold uppercase tracking-[0.14em] text-mist-500">{s.label}</p>
                  <CountUp value={s.value} className="text-2xl font-medium" />
                </div>
              </Reveal>
            );
          })}
        </div>

        {/* severity balance strip */}
        <Reveal delay={120}>
          <div className="eco-card mt-6 flex flex-wrap items-center gap-x-8 gap-y-3 px-6 py-4">
            <p className="text-[0.72rem] font-bold uppercase tracking-[0.16em] text-mist-500">Severity balance</p>
            {['Critical', 'High', 'Moderate', 'Low'].map((sev) => (
              <span key={sev} className="inline-flex items-center gap-2 text-sm font-semibold text-charcoal-800">
                <span className={`h-2.5 w-2.5 rounded-full ${SEVERITY_DOT[sev]}`} />
                {sev}
                <span className="font-display text-lg text-charcoal-900">{bySeverity[sev]}</span>
              </span>
            ))}
          </div>
        </Reveal>

        {/* ============ workboard ============ */}
        <Reveal delay={140}>
          <div className="eco-card mt-6 p-4 sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-3 px-1 pb-3 pt-1">
              <div>
                <h2 className="text-xl">Workboard</h2>
                <p className="mt-0.5 text-xs text-mist-600">Everything being managed at a glance — open a bucket to work it.</p>
              </div>
              <p className="text-[0.68rem] font-bold uppercase tracking-[0.16em] text-mist-400">
                {bucketCount.awaiting + bucketCount.active} pending · {bucketCount.completed} done
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              {BUCKET_TILES.map((tile) => {
                const TileIcon = tile.icon;
                const active = queueView === tile.id;
                return (
                  <button
                    key={tile.id}
                    onClick={() => goToQueue(tile.id)}
                    aria-pressed={active}
                    className={`group flex items-center gap-3 rounded-2xl border p-3.5 text-left transition-all sm:p-4 ${
                      active
                        ? 'border-forest-400 bg-forest-50/70 shadow-soft'
                        : 'border-cream-200 bg-cream-50/50 hover:-translate-y-0.5 hover:border-forest-300 hover:shadow-soft'
                    }`}
                  >
                    <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${tile.chip}`}>
                      <TileIcon className="h-5 w-5" strokeWidth={1.9} />
                    </span>
                    <span className="min-w-0">
                      <span className="flex items-center gap-1.5 text-[0.85rem] font-bold leading-tight text-charcoal-900">
                        <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${tile.dot}`} />
                        <span className="truncate">{tile.label}</span>
                      </span>
                      <span className="mt-0.5 block truncate text-[0.7rem] text-mist-500">{tile.caption}</span>
                    </span>
                    <span className="ml-auto shrink-0 font-display text-2xl text-charcoal-900">
                      {bucketCount[tile.id]}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </Reveal>

        <div className="mt-10 grid grid-cols-1 gap-8 lg:grid-cols-3">
          {/* ============ moderation queue ============ */}
          <div className="lg:col-span-2">
            <div ref={queueRef} className="scroll-mt-6">
              <Reveal>
                <div className="flex flex-wrap items-end justify-between gap-4">
                  <div>
                    <h2 className="text-3xl">Moderation queue</h2>
                    <p className="mt-1.5 text-mist-600">{QUEUE_COPY[queueView].subtitle}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="relative">
                      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-mist-400" />
                      <input
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search reports…"
                        className="field !w-52 !py-2 pl-9 text-sm"
                      />
                    </div>
                    <span className="rounded-full border border-cream-200 bg-cream-50 px-3 py-1.5 text-[0.68rem] font-bold uppercase tracking-[0.14em] text-mist-500">
                      {filteredReports.length} shown
                    </span>
                  </div>
                </div>
              </Reveal>
            </div>

            <div className="mt-6 space-y-4">
              {loading ? (
                <div className="eco-card eco-loading">
                  <div className="eco-loader" />
                  <p className="eco-loading-text">Gathering the signals…</p>
                </div>
              ) : filteredReports.length === 0 ? (
                <div className="eco-card px-8 py-14 text-center">
                  <Inbox className="mx-auto h-9 w-9 text-mist-300" />
                  <p className="mt-4 font-display text-xl text-charcoal-900">The queue is quiet</p>
                  <p className="mx-auto mt-2 max-w-sm text-sm text-mist-600">
                    {search ? 'Nothing matches that search yet.' : QUEUE_COPY[queueView].empty}
                  </p>
                  {search && (
                    <button onClick={() => setSearch('')} className="btn btn-ghost btn-sm mt-5">Clear search</button>
                  )}
                </div>
              ) : (
                filteredReports.map((report, i) => {
                  const meta = getHazardMeta(report.hazard_type);
                  const Icon = meta.icon;
                  const isEditing = editing?.id === report.id;
                  const busy = busyId === report.id;
                  const confirming = confirmDelete === report.id;
                  const quick = QUICK_LABEL[report.status];
                  const photo = mediaUrl(report.image_url);

                  return (
                    <Reveal key={report.id} delay={Math.min(i, 4) * 50}>
                      <div className="eco-card eco-card--flush p-5 sm:p-6">
                        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                          <div className="flex min-w-0 gap-3.5">
                            <span className={`mt-0.5 grid h-10 w-10 shrink-0 place-items-center rounded-xl ring-1 ring-black/[0.04] ${meta.tile}`}>
                              <Icon className="h-5 w-5" strokeWidth={1.9} />
                            </span>
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="text-[0.68rem] font-bold uppercase tracking-[0.14em] text-mist-400">{report.id}</p>
                                <StatusBadge status={report.severity} type="severity" />
                              </div>
                              <h3 className="mt-1 truncate text-[1.05rem] leading-snug">{report.title}</h3>
                              <p className="mt-1 truncate text-xs text-mist-500">
                                {report.hazard_type} · {report.location}
                              </p>
                              <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-mist-600">
                                {report.description}
                              </p>

                              {/* photo attachment — click to inspect the original file */}
                              {photo && (
                                <a
                                  href={photo}
                                  target="_blank"
                                  rel="noreferrer"
                                  title="Open the attached photo"
                                  className="group/photo mt-3 inline-block"
                                >
                                  <span className="relative block h-20 w-28 overflow-hidden rounded-xl ring-1 ring-black/[0.06]">
                                    <img
                                      src={photo}
                                      alt={`Photo for ${report.id}: ${report.title}`}
                                      loading="lazy"
                                      className="h-full w-full object-cover transition-transform duration-500 group-hover/photo:scale-105"
                                    />
                                    <span className="absolute bottom-1 right-1 grid h-5 w-5 place-items-center rounded-full bg-charcoal-900/60 text-cream-50 backdrop-blur-sm">
                                      <Camera className="h-3 w-3" strokeWidth={2} />
                                    </span>
                                  </span>
                                </a>
                              )}

                              <p className="mt-2 flex flex-wrap items-center gap-x-2 text-[0.72rem] text-mist-400">
                                <span>{report.reporter_name ? `by ${report.reporter_name}` : 'anonymous'}</span>
                                <span>·</span>
                                <span>{timeAgo(report.created_at)}</span>
                                <span>·</span>
                                <span className={hasCoords(report) ? 'text-forest-600' : ''}>
                                  {hasCoords(report) ? 'pinned on the area map' : 'no coordinates yet'}
                                </span>
                              </p>
                            </div>
                          </div>

                          {/* right rail: status + actions */}
                          <div className="flex shrink-0 flex-col items-start gap-2 lg:items-end">
                            <StatusBadge status={report.status} type="status" />
                            {quick && (
                              <button
                                onClick={() => quickMove(report)}
                                disabled={busy}
                                title={`Move straight to ${QUICK_TO[report.status]}`}
                                className="inline-flex items-center gap-1.5 rounded-full bg-forest-700 px-3 py-1.5 text-[0.72rem] font-bold text-cream-50 transition-colors hover:bg-forest-800 dark:text-[#fffdf7] disabled:opacity-50"
                              >
                                <ClipboardCheck className="h-3.5 w-3.5" strokeWidth={2.1} />
                                {quick} → {QUICK_TO[report.status]}
                              </button>
                            )}
                            <div className="flex items-center gap-2">
                              <select
                                value={isEditing ? editing.status : report.status}
                                onChange={(e) => {
                                  const next = e.target.value;
                                  if (next === report.status) { cancelEdit(); return; }
                                  beginEdit({ ...report, status: next });
                                }}
                                disabled={busy}
                                className="cursor-pointer rounded-full border border-cream-300 bg-cream-50 px-3 py-1.5 text-xs font-semibold text-charcoal-800 outline-none transition-colors hover:border-forest-400 disabled:opacity-50"
                                aria-label={`Status for ${report.id}`}
                              >
                                {ALL_STATUSES.map((s) => <option key={s}>{s}</option>)}
                              </select>
                              <button
                                onClick={() => { setEditing(null); setConfirmDelete(confirming ? null : report.id); }}
                                className="grid h-8 w-8 place-items-center rounded-full text-mist-400 transition-colors hover:bg-[#f7e5de] hover:text-[#a8432e]"
                                aria-label={`Delete ${report.id}`}
                              >
                                <Trash2 className="h-4 w-4" strokeWidth={1.9} />
                              </button>
                            </div>
                          </div>
                        </div>

                        {/* inline status editor */}
                        {isEditing && (
                          <div className="mt-4 rounded-2xl border border-forest-200 bg-forest-50/70 p-4">
                            <p className="text-xs font-bold uppercase tracking-[0.12em] text-forest-800">
                              Moving to “{editing.status}” — add a field note (optional)
                            </p>
                            <textarea
                              value={notes}
                              onChange={(e) => setNotes(e.target.value)}
                              maxLength={500}
                              rows={2}
                              placeholder="e.g. Verified against the photo — heading to the field team."
                              className="field mt-2.5 !min-h-0 text-sm"
                            />
                            <div className="mt-3 flex items-center gap-2">
                              <button onClick={applyStatus} disabled={busy} className="btn btn-primary btn-sm">
                                {busy ? 'Saving…' : <><Save className="h-3.5 w-3.5" /> Apply status</>}
                              </button>
                              <button onClick={cancelEdit} className="btn btn-ghost btn-sm">
                                <X className="h-3.5 w-3.5" /> Cancel
                              </button>
                            </div>
                          </div>
                        )}

                        {/* inline delete confirmation */}
                        {confirming && (
                          <div className="mt-4 flex flex-col gap-3 rounded-2xl border border-[#efcdbf] bg-[#f7e5de] px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between">
                            <p className="text-sm font-semibold text-[#a8432e]">
                              Remove {report.id} from the record? This cannot be undone.
                            </p>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => removeReport(report.id)}
                                disabled={busy}
                                className="btn btn-danger btn-sm"
                              >
                                {busy ? 'Removing…' : 'Delete permanently'}
                              </button>
                              <button onClick={() => setConfirmDelete(null)} className="btn btn-ghost btn-sm">
                                Keep it
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </Reveal>
                  );
                })
              )}
            </div>
          </div>

          {/* ============ right rail ============ */}
          <div className="space-y-8">
            {/* area map — live open signals */}
            <Reveal delay={80}>
              <div>
                <div className="mb-3 flex items-center justify-between gap-3 px-1">
                  <div>
                    <h3 className="text-xl">Around the area</h3>
                    <p className="mt-0.5 text-xs leading-relaxed text-mist-600">
                      {onArea.length} of {openCount} open signals are pinned with coordinates.
                    </p>
                  </div>
                  <MapPin className="h-5 w-5 text-forest-600" strokeWidth={1.8} />
                </div>
                <RiskMap reports={onArea} loading={loading} />
              </div>
            </Reveal>

            {/* photo files — remaining vs completed */}
            <Reveal delay={120}>
              <div className="eco-card p-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-xl">Photo files</h3>
                  <Camera className="h-5 w-5 text-forest-600" strokeWidth={1.8} />
                </div>
                <p className="mt-2 text-sm leading-relaxed text-mist-600">
                  Attachments on record — review the files still tied to live cases, and keep the completed ones archived.
                </p>
                <div className="mt-5 space-y-4">
                  <div className="flex items-center justify-between rounded-2xl border border-[#ecdfae] bg-[#f7efd8]/60 px-4 py-3">
                    <div className="flex items-center gap-3">
                      <span className="h-2 w-2 rounded-full bg-[#c79a2f]" />
                      <div>
                        <p className="text-sm font-bold text-charcoal-900">Remaining files</p>
                        <p className="text-[0.72rem] text-mist-500">on cases still open</p>
                      </div>
                    </div>
                    <span className="font-display text-2xl text-charcoal-900">{fileCounts.open}</span>
                  </div>
                  <div className="flex items-center justify-between rounded-2xl border border-[#c2dcc8] bg-[#e2efe4]/60 px-4 py-3">
                    <div className="flex items-center gap-3">
                      <span className="h-2 w-2 rounded-full bg-[#3c7049]" />
                      <div>
                        <p className="text-sm font-bold text-charcoal-900">Completed files</p>
                        <p className="text-[0.72rem] text-mist-500">archived with closed cases</p>
                      </div>
                    </div>
                    <span className="font-display text-2xl text-charcoal-900">{fileCounts.closed}</span>
                  </div>
                  {fileCounts.open + fileCounts.closed > 0 && (
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-cream-100">
                      <div
                        className="h-full rounded-full bg-forest-500 transition-all duration-700"
                        style={{ width: `${(fileCounts.closed / (fileCounts.open + fileCounts.closed)) * 100}%` }}
                      />
                    </div>
                  )}
                  {fileCounts.open + fileCounts.closed === 0 && (
                    <p className="text-center text-xs text-mist-500">
                      No photo attachments yet — they appear here the moment a guardian files one.
                    </p>
                  )}
                  <p className="text-[0.72rem] leading-relaxed text-mist-400">
                    Open a report in the queue to inspect its photo in full.
                  </p>
                </div>
              </div>
            </Reveal>

            <Reveal delay={160}>
              <div className="eco-card p-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-xl">Hazards seen</h3>
                  <FileText className="h-5 w-5 text-forest-600" strokeWidth={1.8} />
                </div>
                <div className="mt-5 space-y-3.5">
                  {byCategory.length === 0 && (
                    <p className="text-sm text-mist-500">No reports yet.</p>
                  )}
                  {byCategory.map((cat, i) => (
                    <div key={cat.name}>
                      <div className="flex items-center justify-between text-xs font-semibold text-charcoal-800">
                        <span>{cat.name}</span>
                        <span className="text-mist-500">{cat.count}</span>
                      </div>
                      <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-cream-100">
                        <div
                          className="h-full rounded-full transition-all duration-700"
                          style={{ width: `${(cat.count / maxCategory) * 100}%`, backgroundColor: BAR_COLORS[i % BAR_COLORS.length] }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </Reveal>

            <Reveal delay={200}>
              <div className="eco-card p-6">
                <h3 className="text-xl">The rhythm</h3>
                <p className="mt-2 text-sm leading-relaxed text-mist-600">
                  Submitted signals wait for a ranger. Verified ones head to the
                  field team, and resolution closes the loop — the guardian gets a
                  notification at every step.
                </p>
                <Link to="/map" className="btn btn-soft btn-sm mt-5 w-full">
                  Open the risk map
                </Link>
              </div>
            </Reveal>
          </div>
        </div>

        {/* ============ guardians ============ */}
        <div className="mt-14">
          <Reveal>
            <div className="flex items-end justify-between gap-4">
              <div>
                <h2 className="text-3xl">Guardians</h2>
                <p className="mt-1.5 text-mist-600">Community members and their standing in the network.</p>
              </div>
              <UserCog className="h-6 w-6 text-forest-500" strokeWidth={1.7} />
            </div>
          </Reveal>

          <Reveal delay={100}>
            <div className="eco-card mt-6 overflow-hidden p-2">
              {loading ? (
                <div className="eco-loading"><div className="eco-loader" /><p className="eco-loading-text">Counting guardians…</p></div>
              ) : (
                <ul className="divide-y divide-cream-200/80">
                  {users.map((member) => {
                    const busy = busyId === `user-${member.id}`;
                    const isSelf = member.id === user?.id;
                    return (
                      <li key={member.id} className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:px-5">
                        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-forest-100 font-bold text-forest-800">
                          {getInitials(member.name, '?')}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[0.95rem] font-bold text-charcoal-900">
                            {member.name} {isSelf && <span className="ml-1 text-xs font-semibold text-forest-600">(you)</span>}
                          </p>
                          <p className="truncate text-xs text-mist-500">
                            {member.email} · joined {timeAgo(member.created_at)}
                          </p>
                        </div>
                        <div className="flex items-center gap-2.5">
                          <span className={`rounded-full px-2.5 py-1 text-[0.68rem] font-bold uppercase tracking-[0.12em] ${
                            member.role === 'admin'
                              ? 'bg-forest-100 text-forest-800'
                              : 'bg-cream-100 text-mist-600'
                          }`}>
                            {member.role === 'admin' ? 'Ranger' : 'Guardian'}
                          </span>
                          <select
                            value={member.role}
                            disabled={isSelf || busy}
                            onChange={(e) => changeRole(member.id, e.target.value)}
                            className="cursor-pointer rounded-full border border-cream-300 bg-cream-50 px-2.5 py-1.5 text-xs font-semibold text-charcoal-700 outline-none transition-colors hover:border-forest-400 disabled:cursor-not-allowed disabled:opacity-40"
                            aria-label={`Role for ${member.name}`}
                          >
                            <option value="user">user</option>
                            <option value="admin">admin</option>
                          </select>
                          <select
                            value={member.status || 'active'}
                            disabled={isSelf || busy}
                            onChange={(e) => changeStatus(member.id, e.target.value)}
                            title="Account status — suspended/disabled accounts cannot sign in"
                            className={`cursor-pointer rounded-full border px-2.5 py-1.5 text-xs font-semibold outline-none transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                              (member.status || 'active') === 'active'
                                ? 'border-cream-300 bg-cream-50 text-charcoal-700 hover:border-forest-400'
                                : 'border-[#efcdbf] bg-[#f7e5de]/70 text-[#a8432e] hover:border-[#a8432e]'
                            }`}
                            aria-label={`Account status for ${member.name}`}
                          >
                            <option value="active">active</option>
                            <option value="suspended">suspended</option>
                            <option value="disabled">disabled</option>
                          </select>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </Reveal>
        </div>
        {/* ============ admin & security ============ */}
        <div className="mt-14">
          <Reveal>
            <div className="flex items-end justify-between gap-4">
              <div>
                <h2 className="text-3xl">Admin & Security</h2>
                <p className="mt-1.5 text-mist-600">Manage administrators, review audit trails, and monitor security posture.</p>
              </div>
              <Shield className="h-6 w-6 text-forest-500" strokeWidth={1.7} />
            </div>
          </Reveal>

          {/* Tabs */}
          <Reveal delay={50}>
            <div className="mt-6 flex gap-1 rounded-xl border border-cream-200 bg-cream-50/50 p-1">
              <button
                onClick={() => setActiveTab('directory')}
                className={`flex-1 rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
                  activeTab === 'directory'
                    ? 'bg-forest-100 text-forest-800 shadow-soft'
                    : 'text-mist-600 hover:bg-cream-100/50'
                }`}
              >
                <Users className="inline h-4 w-4 mr-2" />
                Administrators
              </button>
              <button
                onClick={() => setActiveTab('security')}
                className={`flex-1 rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
                  activeTab === 'security'
                    ? 'bg-forest-100 text-forest-800 shadow-soft'
                    : 'text-mist-600 hover:bg-cream-100/50'
                }`}
              >
                <ShieldCheck className="inline h-4 w-4 mr-2" />
                Security Overview
              </button>
              <button
                onClick={() => setActiveTab('audit')}
                className={`flex-1 rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
                  activeTab === 'audit'
                    ? 'bg-forest-100 text-forest-800 shadow-soft'
                    : 'text-mist-600 hover:bg-cream-100/50'
                }`}
              >
                <ScrollText className="inline h-4 w-4 mr-2" />
                Audit Log
              </button>
            </div>
          </Reveal>

          {/* Tab Content */}
          <Reveal delay={100}>
            <div className="mt-4 eco-card p-5">
              {/* Directory Tab */}
              {activeTab === 'directory' && (
                <>
                  <div className="flex items-center justify-between mb-4">
                    <p className="text-sm text-mist-600">
                      { loadingAdmins ? 'Loading administrators…' : `${admins.length} administrator(s) on record` }
                    </p>
                    {admins.length > 0 && (
                      <button
                        onClick={loadAdminData}
                        disabled={loadingAdmins}
                        className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold text-forest-700 transition-colors hover:bg-forest-100/70 disabled:opacity-50"
                      >
                        <RefreshCw className={`h-3.5 w-3.5 ${loadingAdmins ? 'animate-spin' : ''}`} />
                        Refresh
                      </button>
                    )
                  }
                  </div>

                  {loadingAdmins ? (
                    <div className="eco-loading"><div className="eco-loader" /><p className="eco-loading-text">Loading administrators…</p></div>
                  ) : admins.length === 0 ? (
                    <div className="py-8 text-center">
                      <Users className="mx-auto h-9 w-9 text-mist-300" />
                      <p className="mt-3 font-display text-lg text-charcoal-900">No administrators yet</p>
                      <p className="mt-1 text-sm text-mist-500">Administrators will appear here once they are added to the system.</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {admins.map((admin) => (
                        <div
                          key={admin.id}
                          className={`rounded-xl border p-4 transition-all cursor-pointer hover:border-forest-300 hover:shadow-soft ${
                            selectedAdmin === admin.id ? 'border-forest-400 bg-forest-50/50' : 'border-cream-200 bg-cream-50/50'
                          }`}
                          onClick={() => loadAdminDetails(admin.id)}
                        >
                          <div className="flex items-start gap-4">
                            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-forest-100 font-bold text-forest-800">
                              {getInitials(admin.name, '?')}
                            </span>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <p className="truncate text-[0.95rem] font-bold text-charcoal-900">{admin.name}</p>
                                <span className={`rounded-full px-2.5 py-0.5 text-[0.65rem] font-bold uppercase tracking-[0.12em] ${
                                  admin.role === 'admin' ? 'bg-forest-100 text-forest-800' : 'bg-cream-100 text-mist-600'
                                }`}>
                                  {admin.role === 'admin' ? 'Ranger' : 'Guardian'}
                                </span>
                              </div>
                              <p className="truncate text-xs text-mist-500">{admin.email}</p>
                              <p className="mt-1 text-xs text-mist-400">
                                User ID: {admin.id} · Joined {timeAgo(admin.created_at)}
                              </p>
                            </div>
                            <Eye className="h-4 w-4 text-mist-400" title="View details" />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Admin Details Panel */}
                  {adminDetails && (
                    <div className="mt-4 rounded-xl border border-forest-300 bg-forest-50/50 p-5">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-bold text-charcoal-900">Administrator Details</h3>
                        <button
                          onClick={() => setAdminDetails(null)}
                          className="rounded-full p-1.5 text-mist-400 hover:bg-forest-100/50"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>

                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <p className="text-[0.68rem] font-bold uppercase tracking-[0.12em] text-mist-500">Name</p>
                          <p className="font-semibold text-charcoal-900">{adminDetails.administrator.name}</p>
                        </div>
                        <div>
                          <p className="text-[0.68rem] font-bold uppercase tracking-[0.12em] text-mist-500">Email</p>
                          <p className="font-semibold text-charcoal-900">{adminDetails.administrator.email}</p>
                        </div>
                        <div>
                          <p className="text-[0.68rem] font-bold uppercase tracking-[0.12em] text-mist-500">User ID</p>
                          <p className="font-semibold text-charcoal-900">{adminDetails.administrator.id}</p>
                        </div>
                        <div>
                          <p className="text-[0.68rem] font-bold uppercase tracking-[0.12em] text-mist-500">Role</p>
                          <p className="font-semibold text-charcoal-900">
                            <span className="inline-flex items-center gap-1.5">
                              <ShieldCheck className="h-3.5 w-3.5 text-forest-600" />
                              {adminDetails.administrator.role === 'admin' ? 'Ranger (admin)' : 'Guardian (user)'}
                            </span>
                          </p>
                        </div>
                        <div>
                          <p className="text-[0.68rem] font-bold uppercase tracking-[0.12em] text-mist-500">Joined</p>
                          <p className="font-semibold text-charcoal-900">{timeAgo(adminDetails.administrator.created_at)}</p>
                        </div>
                        <div>
                          <p className="text-[0.68rem] font-bold uppercase tracking-[0.12em] text-mist-500">Recent Actions</p>
                          <p className="font-semibold text-charcoal-900">{adminDetails.total_actions || 0} total</p>
                        </div>
                      </div>

                      {adminDetails.recent_role_changes && adminDetails.recent_role_changes.length > 0 && (
                        <div className="mt-4 pt-4 border-t border-forest-200">
                          <p className="text-xs font-bold uppercase tracking-[0.12em] text-forest-800 mb-2">Recent Role Changes</p>
                          <div className="space-y-2">
                            {adminDetails.recent_role_changes.map((change) => {
                              const oldData = change.old_value ? JSON.parse(change.old_value) : {};
                              const newData = change.new_value ? JSON.parse(change.new_value) : {};
                              return (
                                <div key={change.id} className="flex items-center justify-between text-xs py-1.5 border-b border-cream-200/50 last:border-0">
                                  <span className="text-mist-600">{change.target_type} #{change.target_id}</span>
                                  <span className="font-semibold text-forest-700">
                                    {oldData.role} → {newData.role}
                                  </span>
                                  <span className="text-mist-400">{timeAgo(change.created_at)}</span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {adminDetails.recent_actions && adminDetails.recent_actions.length > 0 && (
                        <div className="mt-4 pt-4 border-t border-forest-200">
                          <p className="text-xs font-bold uppercase tracking-[0.12em] text-forest-800 mb-2">Recent Activity</p>
                          <div className="space-y-2">
                            {adminDetails.recent_actions.slice(0, 5).map((action) => (
                              <div key={action.id} className="flex items-center justify-between text-xs py-1.5 border-b border-cream-200/50 last:border-0">
                                <span className="font-semibold text-charcoal-800">{action.action.replace(/_/g, ' ')}</span>
                                <span className="text-mist-500">{action.target_type} #{action.target_id}</span>
                                <span className="text-mist-400">{timeAgo(action.created_at)}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}

              {/* Security Overview Tab */}
              {activeTab === 'security' && (
                <>
                  {loadingSecurity ? (
                    <div className="eco-loading"><div className="eco-loader" /><p className="eco-loading-text">Loading security overview…</p></div>
                  ) : securityOverview ? (
                    <>
                      <div className="grid grid-cols-2 gap-4 mb-6">
                        <div className="rounded-xl border border-forest-200 bg-forest-50/50 p-4">
                          <div className="flex items-center justify-between">
                            <span className="text-[0.68rem] font-bold uppercase tracking-[0.14em] text-mist-500">Total Administrators</span>
                            <ShieldCheck className="h-5 w-5 text-forest-600" />
                          </div>
                          <p className="mt-2 text-3xl font-bold text-charcoal-900">{securityOverview.total_administrators}</p>
                          <p className="text-xs text-mist-500">Rangers with elevated privileges</p>
                        </div>

                        <div className="rounded-xl border border-cream-200 bg-cream-50/50 p-4">
                          <div className="flex items-center justify-between">
                            <span className="text-[0.68rem] font-bold uppercase tracking-[0.14em] text-mist-500">Audit Log Entries</span>
                            <ScrollText className="h-5 w-5 text-mist-500" />
                          </div>
                          <p className="mt-2 text-3xl font-bold text-charcoal-900">{securityOverview.audit_log_entries}</p>
                          <p className="text-xs text-mist-500">Recorded administrative actions</p>
                        </div>
                      </div>

                      {/* Recent Actions */}
                      <div className="mb-6">
                        <h3 className="text-sm font-bold uppercase tracking-[0.12em] text-mist-500 mb-3">Recent Administrative Actions</h3>
                        {securityOverview.recent_actions.length === 0 ? (
                          <p className="text-sm text-mist-400 py-3 text-center">No administrative actions recorded yet.</p>
                        ) : (
                          <div className="space-y-2">
                            {securityOverview.recent_actions.map((action) => (
                              <div key={action.id} className="flex items-center justify-between py-2 border-b border-cream-200/50 last:border-0">
                                <div className="flex items-center gap-3">
                                  <div className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${
                                    action.action === 'report_status_change' ? 'bg-[#e3edf0] text-[#3d6f83]' :
                                    action.action === 'role_change' ? 'bg-[#f7efd8] text-[#8f6f13]' :
                                    action.action === 'report_delete' ? 'bg-[#f7e5de] text-[#a8432e]' :
                                    'bg-cream-100 text-mist-500'
                                  }`}>
                                    {action.action === 'report_status_change' && <ClipboardCheck className="h-4 w-4" />}
                                    {action.action === 'role_change' && <UserCheck className="h-4 w-4" />}
                                    {action.action === 'report_delete' && <Trash2 className="h-4 w-4" />}
                                    {!['report_status_change', 'role_change', 'report_delete'].includes(action.action) && <Lock className="h-4 w-4" />}
                                  </div>
                                  <div>
                                    <p className="text-sm font-semibold text-charcoal-900">
                                      {action.action.replace(/_/g, ' ')}
                                    </p>
                                    <p className="text-xs text-mist-500">
                                      {action.admin_name} · {action.target_type} #{action.target_id}
                                    </p>
                                  </div>
                                </div>
                                <span className="text-xs text-mist-400">{timeAgo(action.created_at)}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Recent Role Changes */}
                      {securityOverview.recent_role_changes.length > 0 && (
                        <div>
                          <h3 className="text-sm font-bold uppercase tracking-[0.12em] text-mist-500 mb-3">Recent Role Changes</h3>
                          <div className="space-y-2">
                            {securityOverview.recent_role_changes.map((change) => {
                              const oldData = change.old_value ? JSON.parse(change.old_value) : {};
                              const newData = change.new_value ? JSON.parse(change.new_value) : {};
                              return (
                                <div key={change.id} className="flex items-center justify-between py-2 border-b border-cream-200/50 last:border-0">
                                  <div className="flex items-center gap-3">
                                    <UserCheck className="h-4 w-4 text-[#8f6f13]" />
                                    <div>
                                      <p className="text-sm font-semibold text-charcoal-900">
                                        {oldData.role} → {newData.role}
                                      </p>
                                      <p className="text-xs text-mist-500">
                                        {change.admin_name} changed user #{change.target_id}
                                      </p>
                                    </div>
                                  </div>
                                  <span className="text-xs text-mist-400">{timeAgo(change.created_at)}</span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Recent Destructive Actions */}
                      {securityOverview.recent_destructive_actions.length > 0 && (
                        <div>
                          <h3 className="text-sm font-bold uppercase tracking-[0.12em] text-mist-500 mb-3">Recent Destructive Actions</h3>
                          <div className="space-y-2">
                            {securityOverview.recent_destructive_actions.map((action) => (
                              <div key={action.id} className="flex items-center justify-between py-2 border-b border-cream-200/50 last:border-0">
                                <div className="flex items-center gap-3">
                                  <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[#f7e5de] text-[#a8432e]">
                                    <Trash2 className="h-4 w-4" />
                                  </div>
                                  <div>
                                    <p className="text-sm font-semibold text-charcoal-900">Report Deleted</p>
                                    <p className="text-xs text-mist-500">
                                      {action.admin_name} · {action.target_type} #{action.target_id}
                                    </p>
                                  </div>
                                </div>
                                <span className="text-xs text-mist-400">{timeAgo(action.created_at)}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Note about limitations */}
                      <div className="mt-6 pt-4 border-t border-cream-200 text-xs text-mist-500">
                        <p><strong>Note:</strong> This overview shows only data that the backend can reliably calculate. Metrics such as "active admins" or "security events" require additional fields or event types that are not currently implemented.</p>
                      </div>
                    </>
                  ) : (
                    <div className="py-8 text-center">
                      <Shield className="mx-auto h-9 w-9 text-mist-300" />
                      <p className="mt-3 font-display text-lg text-charcoal-900">Security overview unavailable</p>
                      <p className="mt-1 text-sm text-mist-500">Unable to load security data.</p>
                    </div>
                  )}
                </>
              )}

                  {/* Audit Log Tab */}
              {activeTab === 'audit' && (
                <>
                  <div className="flex items-center justify-between mb-4">
                    <p className="text-sm text-mist-600">
                      { loadingAdmins ? 'Loading audit log…' : `${auditLog ? auditLog.length : 0} recent entries` }
                    </p>
                    {!loadingAdmins && (
                      <button
                        onClick={loadAdminData}
                        disabled={loadingAdmins}
                        className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold text-forest-700 transition-colors hover:bg-forest-100/70 disabled:opacity-50"
                      >
                        <RefreshCw className={`h-3.5 w-3.5 ${loadingAdmins ? 'animate-spin' : ''}`} />
                        Refresh
                      </button>
                    )
                  }
                  </div>

                  {loadingAdmins ? (
                    <div className="eco-loading"><div className="eco-loader" /><p className="eco-loading-text">Loading audit log…</p></div>
                  ) : auditLog && auditLog.length > 0 ? (
                    <div className="space-y-2">
                      {auditLog.map((entry) => (
                        <div key={entry.id} className="flex items-start gap-4 py-3 border-b border-cream-200/50 last:border-0">
                          <div className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg mt-0.5 ${
                            entry.action === 'report_status_change' ? 'bg-[#e3edf0] text-[#3d6f83]' :
                            entry.action === 'role_change' ? 'bg-[#f7efd8] text-[#8f6f13]' :
                            entry.action === 'report_delete' ? 'bg-[#f7e5de] text-[#a8432e]' :
                            'bg-cream-100 text-mist-500'
                          }`}>
                            {entry.action === 'report_status_change' && <ClipboardCheck className="h-4 w-4" />}
                            {entry.action === 'role_change' && <UserCheck className="h-4 w-4" />}
                            {entry.action === 'report_delete' && <Trash2 className="h-4 w-4" />}
                            {!['report_status_change', 'role_change', 'report_delete'].includes(entry.action) && <Lock className="h-4 w-4" />}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-bold text-charcoal-900">{entry.action.replace(/_/g, ' ')}</span>
                              <span className="text-[0.65rem] font-bold uppercase tracking-[0.1em] text-mist-400">{entry.target_type}</span>
                              <span className="text-xs text-mist-500 font-mono">#{entry.target_id}</span>
                            </div>
                            <div className="mt-1 flex items-center gap-3 text-xs text-mist-500">
                              <span>by {entry.admin_name}</span>
                              <span>·</span>
                              <span>{entry.admin_id}</span>
                              <span>·</span>
                              <span>{new Date(entry.created_at).toLocaleString()}</span>
                            </div>
                            {(entry.old_value || entry.new_value) && (
                              <div className="mt-2 pt-2 border-t border-cream-200/50 grid grid-cols-2 gap-4 text-xs">
                                {entry.old_value && (
                                  <div>
                                    <span className="text-mist-400">Previous:</span>
                                    <pre className="mt-0.5 font-mono text-mist-600 bg-cream-100 rounded px-2 py-1">{JSON.stringify(JSON.parse(entry.old_value), null, 2)}</pre>
                                  </div>
                                )}
                                {entry.new_value && (
                                  <div>
                                    <span className="text-mist-400">Current:</span>
                                    <pre className="mt-0.5 font-mono text-mist-600 bg-cream-100 rounded px-2 py-1">{JSON.stringify(JSON.parse(entry.new_value), null, 2)}</pre>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="py-8 text-center">
                      <ScrollText className="mx-auto h-9 w-9 text-mist-300" />
                      <p className="mt-3 font-display text-lg text-charcoal-900">No audit entries yet</p>
                      <p className="mt-1 text-sm text-mist-500">Administrative actions will be recorded here once they occur.</p>
                    </div>
                  )}
                </>
              )}
            </div>
          </Reveal>
        </div>

      </div>

      {/* toast */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 z-[900] -translate-x-1/2 px-4">
          <div className={`flex items-center gap-2.5 rounded-full border px-5 py-3 text-sm font-semibold shadow-soft-lg ${
            toast.kind === 'success'
              ? 'border-[#c5dcc3] bg-[#e5efe0] text-[#2f5a37]'
              : 'border-[#efcdbf] bg-[#f7e5de] text-[#a8432e]'
          }`}>
            {toast.kind === 'success' ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
            {toast.msg}
          </div>
        </div>
      )}
    </div>
  );
}
