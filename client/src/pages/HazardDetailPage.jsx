import { useParams, Link } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { ArrowLeft, AlertTriangle, Waves, ShieldCheck } from 'lucide-react';
import { api } from '../services/api';
import StatusBadge from '../components/StatusBadge';
import Reveal from '../components/Reveal';
import { getHazardMeta } from '../utils/hazardMeta';
import { Sprig } from '../components/Ornaments';

const SECTION_STYLES = {
  causes: { icon: AlertTriangle, box: 'bg-[#f7e5de]/70 border-[#efcdbf]/70', title: 'text-[#a8432e]', iconCls: 'text-[#a8432e]', marker: 'text-[#bc4b33]' },
  effects: { icon: Waves, box: 'bg-[#f7efd8]/70 border-[#ecdfae]/80', title: 'text-[#8f6f13]', iconCls: 'text-[#8f6f13]', marker: 'text-[#c79a2f]' },
  prevention: { icon: ShieldCheck, box: 'bg-[#e5efe0]/80 border-[#c5dcc3]', title: 'text-[#3e6a3c]', iconCls: 'text-[#3e6a3c]', marker: 'text-[#4d8a5b]' },
};

function Section({ kind, title, items }) {
  const style = SECTION_STYLES[kind];
  const Icon = style.icon;
  if (!items || items.length === 0) return null;

  return (
    <Reveal className="h-full">
      <section className={`h-full rounded-2xl border p-6 sm:p-7 ${style.box}`}>
        <div className="flex items-center gap-2.5">
          <Icon className={`h-5 w-5 ${style.iconCls}`} strokeWidth={2} />
          <h2 className={`text-lg ${style.title}`}>{title}</h2>
        </div>
        <ul className="mt-5 space-y-3">
          {items.map((item, idx) => (
            <li key={idx} className="flex items-start gap-3 text-sm leading-relaxed text-charcoal-800">
              <span className={`mt-[0.45em] h-1.5 w-1.5 shrink-0 rounded-full ${style.marker}`} />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </section>
    </Reveal>
  );
}

export default function HazardDetailPage() {
  const { id } = useParams();
  const [hazard, setHazard] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api.hazards
      .getById(id)
      .then((data) => { if (!cancelled) setHazard(data); })
      .catch((error) => console.error('Failed to load hazard:', error))
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [id]);

  if (loading) {
    return (
      <div className="eco-loading">
        <div className="eco-loading-spinner" />
        <p className="eco-loading-text">Finding this field note…</p>
      </div>
    );
  }

  if (!hazard) {
    return (
      <div className="px-4 py-28 text-center">
        <p className="font-display text-3xl text-charcoal-900">Hazard not found</p>
        <p className="mx-auto mt-3 max-w-md text-mist-600">
          That field note may have been moved or archived.
        </p>
        <Link to="/hazards" className="btn btn-soft mt-8">
          <ArrowLeft className="h-4 w-4" />
          Back to the atlas
        </Link>
      </div>
    );
  }

  const meta = getHazardMeta(hazard.category);
  const Icon = meta.icon;

  return (
    <div>
      {/* hero strip */}
      <header className="relative overflow-hidden border-b border-cream-200/80 bg-gradient-to-b from-cream-100 via-cream-100/50 to-transparent">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-topographic opacity-60" />
        <Sprig className="pointer-events-none absolute right-8 top-8 hidden h-16 w-auto text-forest-300 lg:block" />
        <div className="relative mx-auto w-full max-w-4xl px-4 pb-12 pt-10 sm:px-6 sm:pb-16 sm:pt-14 lg:px-8">
          <Reveal>
            <Link
              to="/hazards"
              className="inline-flex items-center gap-2 text-sm font-semibold text-forest-700 transition-colors hover:text-forest-900"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to the atlas
            </Link>

            <div className="mt-8 flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex items-center gap-5">
                <div className={`grid h-16 w-16 shrink-0 place-items-center rounded-2xl ring-1 ring-black/[0.04] ${meta.tile}`}>
                  <Icon className="h-8 w-8" strokeWidth={1.7} />
                </div>
                <div>
                  <p className="text-[0.72rem] font-bold uppercase tracking-[0.2em] text-mist-500">
                    {meta.label} hazard · {hazard.category}
                  </p>
                  <h1 className="mt-2 text-4xl sm:text-5xl">{hazard.name}</h1>
                </div>
              </div>
              <div className="shrink-0">
                <StatusBadge status={hazard.severity} type="severity" pulse />
              </div>
            </div>

            <p className="mt-8 max-w-3xl font-display text-lg italic leading-relaxed text-charcoal-700">
              {hazard.description}
            </p>
          </Reveal>
        </div>
      </header>

      {/* body */}
      <div className="mx-auto w-full max-w-4xl px-4 py-14 sm:px-6 sm:py-16 lg:px-8">
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          <Section kind="causes" title="What causes it" items={hazard.causes} />
          <Section kind="effects" title="What it does" items={hazard.effects} />
        </div>
        <div className="mt-5">
          <Section kind="prevention" title="How to stay ahead" items={hazard.prevention} />
        </div>
      </div>
    </div>
  );
}
