import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import CountUp from './CountUp';

const colorMap = {
  forest: 'bg-[#e4ece1] text-forest-700 ring-forest-200/60',
  moss: 'bg-moss-100 text-moss-700 ring-moss-200/70',
  leaf: 'bg-leaf-100 text-leaf-700 ring-leaf-200/60',
  wood: 'bg-[#f1e6d4] text-earth-700 ring-earth-200/70',
  sage: 'bg-[#e3edee] text-[#2c6a77] ring-[#c6dcdd]',
  rust: 'bg-[#f8e3da] text-[#a8432e] ring-[#eec9b8]',
};

const trendStyles = {
  up: { cls: 'text-forest-700 bg-forest-100/80', Icon: TrendingUp },
  down: { cls: 'text-[#a8432e] bg-[#f7e5de]', Icon: TrendingDown },
  stable: { cls: 'text-mist-600 bg-mist-100', Icon: Minus },
};

export default function StatCard({ title, value, icon: Icon, color = 'forest', trend, trendValue, decimals = 0 }) {
  const tile = colorMap[color] || colorMap.forest;
  const trendInfo = trend ? trendStyles[trend] : null;
  const TrendIcon = trendInfo?.Icon;

  return (
    <div className="eco-card group p-6">
      <div className="flex items-start justify-between gap-3">
        <div
          className={`grid h-11 w-11 place-items-center rounded-xl ring-1 transition-transform duration-300 group-hover:-rotate-6 group-hover:scale-110 ${tile}`}
        >
          <Icon className="h-5 w-5" strokeWidth={1.9} />
        </div>
        {trendInfo && trendValue && (
          <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${trendInfo.cls}`}>
            <TrendIcon className="h-3.5 w-3.5" />
            {trendValue}
          </span>
        )}
      </div>

      <p className="mt-4 text-xs font-semibold uppercase tracking-[0.14em] text-mist-500">
        {title}
      </p>
      <CountUp
        value={value}
        decimals={decimals}
        className="mt-1 block text-3xl leading-tight text-charcoal-900"
      />
    </div>
  );
}
