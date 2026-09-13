import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import Reveal from './Reveal';
import { SproutMark } from './Ornaments';

/**
 * Premium "section is being planted" state so in-progress pages
 * still feel intentional and on-brand.
 */
export default function GrowingSoon({ message, note, links = [] }) {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 pb-24 sm:px-6 lg:px-8">
      <Reveal>
        <div className="eco-card relative overflow-hidden px-6 py-14 text-center sm:px-10 sm:py-16">
          <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-topographic opacity-40" />
          <div className="grain" aria-hidden="true" />

          <div className="relative mx-auto grid h-20 w-20 place-items-center rounded-full bg-forest-100 text-forest-700">
            <SproutMark className="h-11 w-11 animate-sway" />
          </div>

          <h2 className="relative mt-7 text-3xl sm:text-[2rem] [text-wrap:balance]">
            This clearing is being planted
          </h2>
          <p className="relative mx-auto mt-4 max-w-xl text-mist-700 leading-relaxed">
            {message}
          </p>
          {note && (
            <p className="relative mx-auto mt-3 max-w-md text-sm text-mist-500 italic">
              {note}
            </p>
          )}

          {links.length > 0 && (
            <div className="relative mx-auto mt-10 grid max-w-3xl grid-cols-1 gap-4 sm:grid-cols-3">
              {links.map((link) => (
                <Link
                  key={link.to}
                  to={link.to}
                  className="group flex items-center justify-between gap-2 rounded-2xl border border-cream-200 bg-cream-50/80 px-5 py-4 text-left transition-all duration-300 hover:-translate-y-1 hover:border-forest-300 hover:shadow-soft-lg"
                >
                  <span>
                    <span className="block text-sm font-bold text-charcoal-900">{link.title}</span>
                    <span className="mt-0.5 block text-xs text-mist-500">{link.desc}</span>
                  </span>
                  <ArrowRight className="h-4 w-4 shrink-0 text-forest-600 transition-transform duration-300 group-hover:translate-x-1" />
                </Link>
              ))}
            </div>
          )}
        </div>
      </Reveal>
    </div>
  );
}
