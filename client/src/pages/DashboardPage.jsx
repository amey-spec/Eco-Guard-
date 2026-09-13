import { useState, useEffect } from 'react';
import {
  Activity, Sprout, FileText, ShieldAlert, CheckCircle2,
} from 'lucide-react';
import {
  LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { api } from '../services/api';
import PageHeader from '../components/PageHeader';
import StatCard from '../components/StatCard';
import Reveal from '../components/Reveal';
import useInView from '../hooks/useInView';
import StatusBadge from '../components/StatusBadge';
import { getHazardMeta } from '../utils/hazardMeta';
import { computeEcoScores, scoreTone, groupSummary } from '../utils/ecoMetrics';

const CHART_COLORS = ['#44684a', '#8b9c53', '#54905f', '#ac7b45', '#5b8ca3', '#b06f8f', '#d9753f', '#6d7d3e'];
const AXIS = { stroke: '#9aa493', fontSize: 12, fontFamily: 'Inter' };
const TOOLTIP_STYLE = {
  background: '#fffdf7', border: '1px solid #ece3d0', borderRadius: '14px',
  boxShadow: '0 18px 40px -12px rgba(26,31,27,0.25)', fontSize: '12px',
};

/* progress bar that fills on scroll */
function Meter({ value, bar, className = '' }) {
  const [ref, inView] = useInView({ threshold: 0.3 });
  return (
    <div ref={ref} className={`h-2 w-full overflow-hidden rounded-full bg-cream-100 ring-1 ring-inset ring-black/[0.04] ${className}`}>
      <div
        className={`h-full rounded-full ${bar} transition-all duration-[1400ms] ease-out`}
        style={{ width: inView ? `${value}%` : '0%' }}
      />
    </div>
  );
}

const countStatus = (reports, pattern) =>
  reports.filter((r) => {
    const s = String(r.status || '').toLowerCase();
    return s.includes(pattern);
  }).length;

export default function DashboardPage() {
  const [stats, setStats] = useState(null);
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);

  // Recharts draws pie labels on the SVG canvas with unconstrained width, so on
  // narrow screens the “Air Pollution 12%” labels push past the card and stretch
  // the page horizontally. Below the md breakpoint the labels are dropped and
  // the pie relies on the tooltip + the recent-signals list instead.
  const [wideLayout, setWideLayout] = useState(() => window.matchMedia('(min-width: 768px)').matches);
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)');
    const onChange = (e) => setWideLayout(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [hazardsRes, reportsRes] = await Promise.all([
          api.hazards.getAll(),
          api.reports.getAll(),
        ]);
        const hazardsList = Array.isArray(hazardsRes) ? hazardsRes : hazardsRes?.hazards || [];
        const reportsData = Array.isArray(reportsRes) ? reportsRes : reportsRes?.reports || [];
        if (cancelled) return;
        setReports(reportsData);
        setStats({
          totalHazards: hazardsList.length,
          totalReports: reportsData.length,
          pending: countStatus(reportsData, 'pend'),
          inReview: countStatus(reportsData, 'review'),
          verified: countStatus(reportsData, 'verif'),
          resolved: countStatus(reportsData, 'resolv'),
          activeIssues: reportsData.filter((r) => !String(r.status || '').toLowerCase().includes('resolv')).length,
        });
      } catch (error) {
        console.error('Failed to load dashboard data:', error);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const trendData = [
    { month: 'Jan', airQuality: 65, waterHealth: 70, heatRisk: 45 },
    { month: 'Feb', airQuality: 68, waterHealth: 68, heatRisk: 52 },
    { month: 'Mar', airQuality: 70, waterHealth: 65, heatRisk: 58 },
    { month: 'Apr', airQuality: 72, waterHealth: 65, heatRisk: 68 },
    { month: 'May', airQuality: 74, waterHealth: 62, heatRisk: 76 },
    { month: 'Jun', airQuality: 71, waterHealth: 64, heatRisk: 84 },
  ];

  // Real per-group scores, derived from the loaded community reports.
  const ecoScores = computeEcoScores(reports);

  const categoryData = reports.reduce((acc, report) => {
    const name = report.hazard_type || report.hazardType || 'Unspecified';
    const existing = acc.find((item) => item.name === name);
    if (existing) existing.value += 1;
    else acc.push({ name, value: 1 });
    return acc;
  }, []);

  if (loading) {
    return (
      <div className="min-h-[60vh]">
        <div className="eco-loading">
          <div className="eco-loading-spinner" />
          <p className="eco-loading-text">Reading environmental data…</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        eyebrow="EcoPulse"
        title="The region’s vital signs"
        subtitle="A calm read on the demo network — air, water, heat, waste and habitat, gathered from community reports and field notes."
      >
        <div className="mt-5 inline-flex items-center gap-2 rounded-full border border-cream-300 bg-cream-50 px-3.5 py-1.5 text-[0.72rem] font-bold uppercase tracking-[0.16em] text-cream-700">
          <span className="h-1.5 w-1.5 rounded-full bg-status-high animate-pulse-soft" />
          Demo environmental data
        </div>
      </PageHeader>

      <div className="mx-auto w-full max-w-6xl px-4 pb-24 sm:px-6 lg:px-8">
        {/* Quick stats */}
        {stats && (
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4 lg:gap-5">
            <Reveal delay={0}><StatCard title="Community reports" value={stats.totalReports} icon={FileText} color="forest" /></Reveal>
            <Reveal delay={80}><StatCard title="Active issues" value={stats.activeIssues} icon={ShieldAlert} color="rust" /></Reveal>
            <Reveal delay={160}><StatCard title="Verified" value={stats.verified} icon={CheckCircle2} color="moss" /></Reveal>
            <Reveal delay={240}><StatCard title="Resolved" value={stats.resolved} icon={Sprout} color="leaf" /></Reveal>
          </div>
        )}

        {/* Signals */}
        <div className="mt-14">
          <Reveal>
            <h2 className="text-3xl">Environmental signals</h2>
            <p className="mt-2 text-mist-600">Five signals, scored from the community record.</p>
          </Reveal>
          <div className="mt-7 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {ecoScores.map((metric, i) => {
              const Icon = metric.icon;
              const hasScore = metric.score !== null;
              return (
                <Reveal key={metric.key} delay={i * 80} className="h-full">
                  <div className="eco-card flex h-full flex-col p-6">
                    <div className="flex items-center justify-between">
                      <span className={`grid h-11 w-11 place-items-center rounded-xl ring-1 ring-black/[0.03] ${metric.tile}`}>
                        <Icon className="h-5 w-5" strokeWidth={1.9} />
                      </span>
                      <span className={`font-display text-2xl font-medium ${scoreTone(metric.score)}`}>
                        {hasScore ? metric.score : '–'}
                        {hasScore && <span className="ml-0.5 font-sans text-sm text-mist-400">/100</span>}
                      </span>
                    </div>
                    <h3 className="mt-4 text-[0.95rem] font-bold">{metric.name}</h3>
                    <Meter value={hasScore ? metric.score : 0} bar={metric.bar} className="mt-3" />
                    <p className="mt-3 text-xs leading-relaxed text-mist-500">{groupSummary(metric)}</p>
                  </div>
                </Reveal>
              );
            })}
          </div>
        </div>

        {/* Charts */}
        <div className="mt-14 grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Reveal direction="left">
            <div className="eco-card p-6 sm:p-7">
              <h3 className="text-xl">Seasonal trends</h3>
              <p className="mt-1 text-sm text-mist-500">Air, water and heat through the spring.</p>
              <div className="mt-6 h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={trendData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#ece3d0" />
                    <XAxis dataKey="month" {...AXIS} />
                    <YAxis {...AXIS} />
                    <Tooltip contentStyle={TOOLTIP_STYLE} />
                    <Legend wrapperStyle={{ fontSize: '12px', fontFamily: 'Inter' }} />
                    <Line type="monotone" dataKey="airQuality" stroke="#5b8ca3" strokeWidth={2.5} dot={{ r: 3 }} name="Air quality" />
                    <Line type="monotone" dataKey="waterHealth" stroke="#4f93a0" strokeWidth={2.5} dot={{ r: 3 }} name="Water health" />
                    <Line type="monotone" dataKey="heatRisk" stroke="#d9753f" strokeWidth={2.5} dot={{ r: 3 }} name="Heat risk" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </Reveal>

          <Reveal direction="right" delay={100}>
            <div className="eco-card p-6 sm:p-7">
              <h3 className="text-xl">Reports by hazard type</h3>
              <p className="mt-1 text-sm text-mist-500">Where the community is looking.</p>
              <div className="mt-6 h-[300px] w-full">
                {categoryData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={categoryData}
                        cx="50%" cy="50%" labelLine={false}
                        {...(wideLayout
                          ? { label: ({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%` }
                          : {})}
                        outerRadius={95}
                        dataKey="value"
                        stroke="#fffdf7"
                      >
                        {categoryData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={TOOLTIP_STYLE} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="grid h-full place-items-center text-sm text-mist-500">
                    No report data available yet
                  </div>
                )}
              </div>
            </div>
          </Reveal>
        </div>

        {/* Recent reports */}
        <div className="mt-14">
          <Reveal>
            <h2 className="text-3xl">Recent eco-signals</h2>
            <p className="mt-2 text-mist-600">The latest notes left by the community.</p>
          </Reveal>

          <Reveal delay={120}>
            <div className="eco-card mt-7 overflow-hidden p-2">
              {reports.length > 0 ? (
                <ul className="divide-y divide-cream-200/80">
                  {reports.slice(0, 6).map((report) => {
                    const meta = getHazardMeta(report.hazard_type || report.hazardType);
                    const Icon = meta.icon;
                    return (
                      <li key={report.id}>
                        <div className="flex items-center gap-4 rounded-xl px-4 py-4 transition-colors hover:bg-cream-50 sm:px-5">
                          <span className={`hidden h-10 w-10 shrink-0 place-items-center rounded-xl sm:grid ${meta.tile}`}>
                            <Icon className="h-5 w-5" strokeWidth={1.9} />
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-[0.95rem] font-bold text-charcoal-900">
                              {report.title || 'Untitled report'}
                            </p>
                            <p className="mt-0.5 truncate text-xs text-mist-500">
                              {report.hazard_type || report.hazardType}
                              {' · '}
                              {report.location}
                              {(report.created_at || report.createdAt) && ` · ${new Date(report.created_at || report.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`}
                            </p>
                          </div>
                          <div className="hidden shrink-0 sm:block">
                            <StatusBadge status={report.severity} type="severity" />
                          </div>
                          <StatusBadge status={report.status} type="status" className="shrink-0" />
                        </div>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <div className="px-6 py-12 text-center">
                  <Activity className="mx-auto h-8 w-8 text-mist-300" />
                  <p className="mt-3 text-sm text-mist-600">No recent environmental signals</p>
                </div>
              )}
            </div>
          </Reveal>
        </div>
      </div>
    </div>
  );
}
