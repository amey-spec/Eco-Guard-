import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { MapPin, Plus, ArrowRight, Compass } from 'lucide-react';
import { api } from '../services/api';
import PageHeader from '../components/PageHeader';
import RiskMap from '../components/RiskMap';
import ReportCard from '../components/ReportCard';
import Reveal from '../components/Reveal';

const LEGEND = [
  { color: '#bc4b33', label: 'Critical' },
  { color: '#d97e2c', label: 'High' },
  { color: '#c79a2f', label: 'Moderate' },
  { color: '#3f7d8f', label: 'Low' },
];

export default function MapPage() {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await api.reports.getAll();
        if (cancelled) return;
        const list = Array.isArray(res) ? res : res?.reports || [];
        setReports(list);
      } catch (error) {
        console.error('Failed to load reports:', error);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const pinned = reports.filter(
    (r) => Number.isFinite(Number(r.latitude)) && Number.isFinite(Number(r.longitude))
  );

  return (
    <div>
      <PageHeader
        eyebrow="Risk map"
        title="The landscape keeps a memory"
        subtitle="Every report pins a place. Pan the demo region, filter by severity and status, and open any signal to see its full trail."
      >
        <div className="mt-5 flex flex-wrap items-center gap-2.5">
          <span className="inline-flex items-center gap-2 rounded-full border border-cream-300 bg-cream-50 px-3.5 py-1.5 text-[0.72rem] font-bold uppercase tracking-[0.16em] text-cream-700">
            <span className="h-1.5 w-1.5 rounded-full bg-forest-500 animate-pulse-soft" />
            {pinned.length} signals pinned · demo region
          </span>
          <span className="inline-flex items-center gap-2 rounded-full border border-cream-300 bg-cream-50 px-3.5 py-1.5 text-[0.72rem] font-bold uppercase tracking-[0.16em] text-cream-700">
            <Compass className="h-3.5 w-3.5 text-forest-600" />
            New York · Hudson to the Bay
          </span>
        </div>
      </PageHeader>

      <div className="mx-auto w-full max-w-6xl px-4 pb-6 sm:px-6 lg:px-8">
        <Reveal direction="zoom">
          <RiskMap reports={reports} loading={loading} />
        </Reveal>

        {/* legend + hint */}
        <Reveal delay={100}>
          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
              {LEGEND.map((item) => (
                <span key={item.label} className="inline-flex items-center gap-2 text-xs font-semibold text-mist-600">
                  <span className="h-3 w-3 rounded-full" style={{ backgroundColor: item.color }} />
                  {item.label}
                </span>
              ))}
              <span className="inline-flex items-center gap-2 text-xs font-semibold text-mist-600">
                <MapPin className="h-3.5 w-3.5 text-forest-600" />
                Click a pin for the field note
              </span>
            </div>
            <Link to="/report" className="btn btn-soft btn-sm group">
              <Plus className="h-4 w-4" strokeWidth={2.2} />
              Drop a new signal
              <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" />
            </Link>
          </div>
        </Reveal>

        {/* recent community signals */}
        <div className="mt-16">
          <Reveal>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="eyebrow">Field record</p>
                <h2 className="mt-3 text-3xl sm:text-4xl">Recent community signals</h2>
              </div>
              <p className="text-sm text-mist-500">
                The {Math.min(reports.length, 6)} most recent of {reports.length} reports
              </p>
            </div>
          </Reveal>

          <div className="mt-8">
            {loading ? (
              <div className="eco-loading">
                <div className="eco-loader" />
                <p className="eco-loading-text">Walking the field record…</p>
              </div>
            ) : reports.length > 0 ? (
              <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
                {reports.slice(0, 6).map((report, i) => (
                  <Reveal key={report.id} delay={(i % 3) * 80} className="h-full">
                    <ReportCard report={report} />
                  </Reveal>
                ))}
              </div>
            ) : (
              <div className="eco-card px-8 py-14 text-center">
                <MapPin className="mx-auto h-9 w-9 text-mist-300" />
                <p className="mt-4 font-display text-xl text-charcoal-900">No signals on the record yet</p>
                <p className="mx-auto mt-2 max-w-md text-sm text-mist-600">
                  Start the demo backend (cd server && npm run seed && npm run dev) and the
                  community signals will appear here and on the map.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
