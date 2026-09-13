import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Check, Clock, Eye, MapPin, AlertTriangle } from 'lucide-react';
import { api } from '../services/api';
import PageHeader from '../components/PageHeader';
import Reveal from '../components/Reveal';
import StatusBadge from '../components/StatusBadge';
import { getHazardMeta } from '../utils/hazardMeta';

function formatDate(dateString) {
  if (!dateString) return '';
  return new Date(dateString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function StatusTimeline({ report }) {
  if (!report) return null;

  // Build a timeline from the report's status history.
  // The current status is the last entry. We show the full journey.
  const steps = [];

  // Always show the submitted step (all reports start there).
  steps.push({
    label: 'Submitted',
    sub: report.created_at ? `Filed · ${formatDate(report.created_at)}` : 'Filed',
    done: true,
    icon: Check,
  });

  // Determine which steps have been passed based on current status.
  const statusOrder = ['Submitted', 'Pending', 'Under Review', 'Verified', 'Resolved', 'Rejected'];
  const currentIndex = statusOrder.indexOf(report.status);

  const intermediateSteps = [
    { label: 'Pending', sub: 'Awaiting review', icon: Clock },
    { label: 'Under Review', sub: 'Field team picked it up', icon: Eye },
    { label: 'Verified', sub: 'Confirmed by a second guardian', icon: Check },
  ];

  for (let i = 0; i < currentIndex && i < intermediateSteps.length; i++) {
    steps.push({
      ...intermediateSteps[i],
      done: true,
    });
  }

  // Add the current status (if not already shown).
  if (currentIndex >= 0 && report.status !== 'Submitted') {
    const isClosed = report.status === 'Resolved' || report.status === 'Rejected';
    const currentStep = intermediateSteps.find((s) => s.label === report.status) || {
      label: report.status,
      sub: report.admin_notes ? `Ranger note: ${report.admin_notes}` : 'In progress',
      icon: isClosed ? Check : Clock,
    };
    // Avoid duplicating if already added above.
    if (!steps.some((s) => s.label === currentStep.label)) {
      steps.push({
        ...currentStep,
        done: isClosed,
      });
    }
  }

  // If closed, add the final step.
  if (report.status === 'Resolved') {
    steps.push({
      label: 'Resolved',
      sub: report.updated_at ? `Resolved · ${formatDate(report.updated_at)}` : 'Resolved',
      done: true,
      icon: Check,
    });
  } else if (report.status === 'Rejected') {
    steps.push({
      label: 'Closed',
      sub: report.updated_at ? `Closed · ${formatDate(report.updated_at)}` : 'Closed',
      done: true,
      icon: AlertTriangle,
    });
  }

  return (
    <ol className="mt-8 space-y-0">
      {steps.map((step, i) => {
        const Icon = step.icon;
        const isLast = i === steps.length - 1;
        return (
          <li key={step.label} className="relative flex gap-5 pb-9 last:pb-0">
            {!isLast && (
              <span
                aria-hidden="true"
                className={`absolute left-[1.1rem] top-9 h-[calc(100%-2.5rem)] w-0.5 rounded-full ${step.done ? 'bg-forest-300' : 'bg-cream-200'}`}
              />
            )}
            <span
              className={`relative z-10 grid h-9 w-9 shrink-0 place-items-center rounded-full ring-4 ring-[#fffdf7] dark:ring-cream-50 ${step.done ? 'bg-forest-600 text-cream-50' : 'bg-cream-200 text-mist-500'}`}
            >
              <Icon className="h-4 w-4" strokeWidth={2.2} />
            </span>
            <div className="pt-1">
              <p className={`font-bold ${step.done ? 'text-charcoal-900' : 'text-mist-500'}`}>{step.label}</p>
              <p className="mt-0.5 text-sm text-mist-500">{step.sub}</p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

export default function TrackReportPage() {
  const { id } = useParams();
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');

    if (!id) {
      setError('No report ID provided.');
      setLoading(false);
      return;
    }

    api.reports
      .track(id)
      .then((data) => {
        if (!cancelled) setReport(data);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err.message || `Could not load report ${id}.`);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [id]);

  if (loading) {
    return (
      <div>
        <PageHeader
          eyebrow="Track a report"
          title="Watch it make its way home"
          subtitle="Every report you leave gets a quiet journey — from first sighting to review, verification and resolution."
        />
        <div className="flex items-center justify-center py-24">
          <Loader2 className="h-8 w-8 animate-spin text-forest-500" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <PageHeader
          eyebrow="Track a report"
          title="Report not found"
          subtitle="That report ID doesn't match anything on the record."
        />
        <div className="mx-auto w-full max-w-3xl px-4 pb-6 sm:px-6 lg:px-8">
          <Reveal direction="zoom">
            <div className="eco-card p-7 sm:p-9 text-center">
              <div className="grid h-14 w-14 place-items-center rounded-full bg-[#f7e5de] text-[#a8432e] mx-auto">
                <AlertTriangle className="h-7 w-7" />
              </div>
              <p className="mt-4 font-display text-xl text-charcoal-900">Could not load this report</p>
              <p className="mt-2 text-sm text-mist-600">{error}</p>
              <div className="mt-6 flex justify-center">
                <Link to="/map" className="btn btn-primary">
                  See the risk map
                </Link>
              </div>
            </div>
          </Reveal>
        </div>
      </div>
    );
  }

  if (!report) {
    return null;
  }

  const meta = getHazardMeta(report.hazard_type || report.hazardType);
  const Icon = meta.icon;

  return (
    <div>
      <PageHeader
        eyebrow="Track a report"
        title="Watch it make its way home"
        subtitle="Every report you leave gets a quiet journey — from first sighting to review, verification and resolution. This is that trail."
      >
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <StatusBadge status={report.severity} type="severity" />
          <StatusBadge status={report.status} type="status" />
          {report.image_url && (
            <img
              src={mediaUrl(report.image_url)}
              alt={`Photo for report ${report.id}`}
              loading="lazy"
              className="h-10 w-10 rounded-lg object-cover ring-1 ring-black/[0.05]"
            />
          )}
        </div>
      </PageHeader>

      <div className="mx-auto w-full max-w-3xl px-4 pb-6 sm:px-6 lg:px-8">
        <Reveal direction="zoom">
          <div className="eco-card p-7 sm:p-9">
            <div className="flex items-center justify-between">
              <div className="min-w-0">
                <p className="text-[0.72rem] font-bold uppercase tracking-[0.16em] text-mist-500">{report.id}</p>
                <h2 className="mt-1 font-display text-xl">{report.title}</h2>
                <p className="mt-1 text-sm text-mist-500">
                  {report.hazard_type} · {report.location}
                </p>
              </div>
              {Icon && (
                <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ring-1 ring-black/[0.04] ${meta.tile}`}>
                  <Icon className="h-5 w-5" strokeWidth={1.9} />
                </span>
              )}
            </div>

            {report.description && (
              <p className="mt-4 text-sm leading-relaxed text-mist-600 border-t border-cream-200 pt-4">
                {report.description}
              </p>
            )}

            {report.latitude && report.longitude && (
              <div className="mt-3 flex items-center gap-2 text-xs text-mist-500">
                <MapPin className="h-3.5 w-3.5 text-forest-500" />
                {report.latitude.toFixed(5)}, {report.longitude.toFixed(5)}
              </div>
            )}

            <StatusTimeline report={report} />
          </div>
        </Reveal>

        <div className="mt-6 flex justify-center">
          <Link to="/map" className="btn btn-soft">
            Back to the risk map
          </Link>
        </div>
      </div>
    </div>
  );
}

function Loader2({ className }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 11-6.219-8.53"/></svg>;
}

function mediaUrl(path) {
  if (!path) return '';
  if (/^https?:/.test(path)) return path;
  const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
  if (path.startsWith('/')) return `${API_BASE_URL.replace(/\/api\/?$/, '')}${path}`;
  return path;
}
