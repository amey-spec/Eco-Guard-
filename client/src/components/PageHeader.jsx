import Reveal from './Reveal';
import { Sprig } from './Ornaments';

/**
 * Shared hero/header used by every inner page so the whole
 * application speaks one visual language.
 */
export default function PageHeader({ eyebrow, title, subtitle, children, className = '' }) {
  return (
    <header className={`relative overflow-hidden ${className}`}>
      {/* warm paper wash + contour texture */}
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-gradient-to-b from-cream-100 via-cream-100/60 to-transparent"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-topographic opacity-[0.5]"
      />
      <div className="grain" aria-hidden="true" />
      {/* corner sprig */}
      <Sprig className="pointer-events-none absolute right-8 top-6 hidden h-14 w-auto text-forest-300 lg:block" />

      <div className="relative mx-auto w-full max-w-6xl px-4 pb-10 pt-12 sm:px-6 sm:pb-14 sm:pt-20 lg:px-8">
        <Reveal>
          {eyebrow && <p className="eyebrow">{eyebrow}</p>}
          <h1 className="mt-4 max-w-3xl text-4xl leading-[1.05] sm:text-5xl [text-wrap:balance]">
            {title}
          </h1>
          {subtitle && (
            <p className="mt-5 max-w-2xl text-lg leading-relaxed text-mist-700">
              {subtitle}
            </p>
          )}
          {children}
        </Reveal>
      </div>
    </header>
  );
}
