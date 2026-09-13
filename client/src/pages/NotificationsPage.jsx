import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Bell, CheckCircle2, Eye, ShieldCheck, AlertTriangle, AlertCircle, RefreshCw,
} from 'lucide-react';
import { api } from '../services/api';
import PageHeader from '../components/PageHeader';
import Reveal from '../components/Reveal';
import { timeAgo } from '../utils/format';

/* Visual style per kind of milestone (derived from the notification title). */
const KIND_STYLES = {
  received: { icon: Bell, tone: 'bg-[#e5efe0] text-[#3e6a3c]' },
  investigation: { icon: Eye, tone: 'bg-[#f7efd8] text-[#8f6f13]' },
  confirmed: { icon: ShieldCheck, tone: 'bg-[#e3edf0] text-[#3d6f83]' },
  resolved: { icon: CheckCircle2, tone: 'bg-[#e5efe0] text-[#3e6a3c]' },
  closed: { icon: AlertTriangle, tone: 'bg-[#f7e5de] text-[#a8432e]' },
};

function kindOf(title) {
  const t = String(title || '').toLowerCase();
  if (t.includes('investigation')) return 'investigation';
  if (t.includes('confirm')) return 'confirmed';
  if (t.includes('resolved')) return 'resolved';
  if (t.includes('closed')) return 'closed';
  return 'received';
}

export default function NotificationsPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api.notifications.getAll();
      setItems(Array.isArray(data) ? data : data?.notifications || []);
    } catch (err) {
      setError(err.message || 'Could not open your inbox');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const unread = items.filter((n) => !n.read_status).length;

  const markRead = async (id) => {
    setBusyId(id);
    try {
      await api.notifications.markRead(id);
      setItems((prev) => prev.map((n) => (n.id === id ? { ...n, read_status: 1 } : n)));
    } catch (err) {
      console.error('Failed to mark notification read:', err);
    } finally {
      setBusyId(null);
    }
  };

  const markAllRead = async () => {
    try {
      await api.notifications.markAllRead();
      setItems((prev) => prev.map((n) => ({ ...n, read_status: 1 })));
    } catch (err) {
      console.error('Failed to mark notifications read:', err);
    }
  };

  return (
    <div>
      <PageHeader
        eyebrow="Notifications"
        title="Whispers from the network"
        subtitle="Milestones on your reports — received, under investigation, confirmed, resolved — all land here, straight from the field record."
      >
        {!loading && (
          <div className="mt-5 w-fit rounded-full border border-cream-300 bg-cream-50 px-3.5 py-1.5 text-[0.72rem] font-bold uppercase tracking-[0.16em] text-cream-700">
            {unread === 0 ? 'All caught up' : `${unread} unread ${unread === 1 ? 'whisper' : 'whispers'}`}
          </div>
        )}
      </PageHeader>

      <div className="mx-auto w-full max-w-3xl px-4 pb-24 sm:px-6 lg:px-8">
        <Reveal>
          <div className="eco-card overflow-hidden p-2">
            {/* inbox header */}
            <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
              <div className="flex items-center gap-3">
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-forest-100 text-forest-700">
                  <Bell className="h-5 w-5" strokeWidth={1.9} />
                </span>
                <div>
                  <p className="font-bold text-charcoal-900">Your inbox</p>
                  <p className="text-xs text-mist-500">
                    {items.length === 0
                      ? 'Milestones from your reports appear here'
                      : `${items.length} ${items.length === 1 ? 'message' : 'messages'} from the network`}
                  </p>
                </div>
              </div>
              {unread > 0 && (
                <button
                  onClick={markAllRead}
                  className="rounded-full border border-cream-300 bg-cream-50 px-3.5 py-1.5 text-xs font-semibold text-forest-700 transition-colors hover:border-forest-400 hover:bg-forest-50"
                >
                  Mark all read
                </button>
              )}
            </div>

            {/* body */}
            {loading ? (
              <div className="eco-loading">
                <div className="eco-loader" />
                <p className="eco-loading-text">Checking the network…</p>
              </div>
            ) : error ? (
              <div className="px-6 py-14 text-center">
                <AlertCircle className="mx-auto h-9 w-9 text-[#a8432e]" />
                <p className="mt-4 font-display text-xl text-charcoal-900">Could not open your inbox</p>
                <p className="mx-auto mt-2 max-w-sm text-sm text-mist-600">{error}</p>
                <button onClick={load} className="btn btn-ghost btn-sm mt-6">
                  <RefreshCw className="h-3.5 w-3.5" /> Try again
                </button>
              </div>
            ) : items.length === 0 ? (
              <div className="px-6 py-16 text-center">
                <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-forest-100 text-forest-600">
                  <Bell className="h-7 w-7" strokeWidth={1.7} />
                </span>
                <p className="mt-5 font-display text-2xl text-charcoal-900">No whispers yet</p>
                <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-mist-600">
                  When you report a hazard, every milestone — received, under
                  investigation, confirmed, resolved — lands here with a note.
                </p>
                <div className="mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row">
                  <Link to="/report" className="btn btn-primary btn-sm">Report a hazard</Link>
                  <Link to="/map" className="btn btn-ghost btn-sm">See the risk map</Link>
                </div>
              </div>
            ) : (
              <ul className="divide-y divide-cream-200/80">
                {items.map((n) => {
                  const kind = KIND_STYLES[kindOf(n.title)] || KIND_STYLES.received;
                  const Icon = kind.icon;
                  const isUnread = !n.read_status;
                  const busy = busyId === n.id;
                  return (
                    <li key={n.id} className={`flex items-start gap-4 px-5 py-4 transition-colors hover:bg-cream-50 ${isUnread ? 'bg-cream-50/70' : ''}`}>
                      <span className={`mt-0.5 grid h-10 w-10 shrink-0 place-items-center rounded-xl ${kind.tone}`}>
                        <Icon className="h-5 w-5" strokeWidth={1.9} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                          <p className="text-[0.95rem] font-bold text-charcoal-900">{n.title}</p>
                          {isUnread && (
                            <span className="h-2 w-2 rounded-full bg-forest-500" aria-label="Unread" />
                          )}
                        </div>
                        <p className="mt-0.5 text-sm leading-relaxed text-mist-600">{n.message}</p>
                        <p className="mt-1 text-xs text-mist-400">{timeAgo(n.created_at)}</p>
                      </div>
                      {isUnread ? (
                        <button
                          onClick={() => markRead(n.id)}
                          disabled={busy}
                          className="mt-1 shrink-0 rounded-full border border-cream-300 bg-cream-50 px-3 py-1.5 text-xs font-semibold text-forest-700 transition-colors hover:border-forest-400 hover:bg-forest-50 disabled:opacity-50"
                        >
                          {busy ? 'Reading…' : 'Mark read'}
                        </button>
                      ) : (
                        <span className="mt-1.5 shrink-0 rounded-full bg-mist-100 px-3 py-1 text-[0.65rem] font-bold uppercase tracking-[0.1em] text-mist-500">
                          Read
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </Reveal>
      </div>
    </div>
  );
}
