import { Link } from 'react-router-dom';
import { MapPin, CalendarDays, ArrowUpRight } from 'lucide-react';
import StatusBadge from './StatusBadge';
import { getHazardMeta } from '../utils/hazardMeta';

export default function ReportCard({ report }) {
  const meta = getHazardMeta(report.hazard_type || report.hazardType);
  const Icon = meta.icon;

  const when = report.created_at || report.createdAt
    ? new Date(report.created_at || report.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : null;

  return (
    <article className="eco-card group relative flex h-full flex-col overflow-hidden p-6">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Link
            to={`/reports/${report.id}`}
            className="font-display text-lg leading-snug text-charcoal-900 transition-colors duration-200 hover:text-forest-700"
          >
            {report.title}
          </Link>
          <div className="mt-1.5 flex items-center gap-2 text-xs text-mist-500">
            <Icon className="h-3.5 w-3.5" />
            <span className="truncate">{report.hazard_type || report.hazardType}</span>
          </div>
        </div>
        <StatusBadge status={report.severity} type="severity" className="shrink-0" />
      </div>

      <p className="mt-3 line-clamp-2 flex-1 text-sm leading-relaxed text-mist-700">
        {report.description}
      </p>

      <div className="mt-5 flex items-center justify-between border-t border-cream-200 pt-4 text-xs text-mist-500">
        <div className="flex items-center gap-4">
          <span className="inline-flex items-center gap-1.5">
            <MapPin className="h-3.5 w-3.5 text-forest-500" />
            <span className="max-w-[10rem] truncate">{report.location}</span>
          </span>
          {when && (
            <span className="inline-flex items-center gap-1.5">
              <CalendarDays className="h-3.5 w-3.5 text-forest-500" />
              {when}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge status={report.status} type="status" dot={false} />
          <ArrowUpRight className="h-4 w-4 text-forest-600 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
        </div>
      </div>
    </article>
  );
}
