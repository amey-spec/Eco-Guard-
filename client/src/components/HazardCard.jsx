import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import StatusBadge from './StatusBadge';
import { getHazardMeta } from '../utils/hazardMeta';

export default function HazardCard({ hazard }) {
  const meta = getHazardMeta(hazard.category);
  const Icon = meta.icon;
  const causes = Array.isArray(hazard.causes) ? hazard.causes.length : 0;

  return (
    <Link
      to={`/hazards/${hazard.id}`}
      className="eco-card group relative flex h-full flex-col overflow-hidden p-6 sm:p-7"
    >
      {/* soft hover wash */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-gradient-to-br from-forest-50/0 via-forest-50/0 to-moss-100/70 opacity-0 transition-opacity duration-500 group-hover:opacity-100"
      />

      <div className="relative flex items-start justify-between gap-3">
        <div className="flex items-center gap-3.5">
          <div
            className={`grid h-12 w-12 shrink-0 place-items-center rounded-xl ring-1 ring-black/[0.04] transition-transform duration-300 group-hover:-rotate-6 group-hover:scale-110 ${meta.tile}`}
          >
            <Icon className="h-[22px] w-[22px]" strokeWidth={1.9} />
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-mist-500">
              {meta.label} signal
            </p>
            <h3 className="mt-0.5 text-lg leading-snug text-charcoal-900 transition-colors duration-300 group-hover:text-forest-700">
              {hazard.name}
            </h3>
          </div>
        </div>
        <StatusBadge status={hazard.severity} type="severity" />
      </div>

      <p className="relative mt-4 line-clamp-2 flex-1 text-sm leading-relaxed text-mist-700">
        {hazard.description}
      </p>

      <div className="relative mt-5 flex items-center justify-between border-t border-cream-200 pt-4">
        <span className="text-xs font-medium text-mist-500">
          {hazard.category}
          {causes > 0 && <span className="mx-1.5 text-cream-400">·</span>}
          {causes > 0 && `${causes} recorded ${causes === 1 ? 'cause' : 'causes'}`}
        </span>
        <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-forest-700">
          Field notes
          <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1.5" />
        </span>
      </div>
    </Link>
  );
}
