import { Link } from 'react-router-dom';
import { ArrowLeft, Compass } from 'lucide-react';
import Reveal from '../components/Reveal';
import { Sprig, LeafSeal } from '../components/Ornaments';

export default function NotFoundPage() {
  return (
    <div className="relative flex min-h-[calc(100vh-4.4rem)] items-center justify-center overflow-hidden px-4 py-24 text-center">
      <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-b from-cream-100 via-cream-50 to-cream-50" />
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-topographic opacity-60" />
      <div aria-hidden="true" className="absolute inset-0 bg-[radial-gradient(44%_36%_at_50%_0%,rgba(196,215,181,0.4),transparent_70%)]" />
      <Sprig className="pointer-events-none absolute left-[8%] top-24 hidden h-16 w-auto rotate-12 text-forest-200 animate-sway-slow md:block" />
      <Sprig className="pointer-events-none absolute bottom-16 right-[9%] hidden h-14 w-auto -rotate-[14deg] text-moss-300 animate-float-slow md:block" />

      <Reveal direction="up" className="relative">
        <LeafSeal className="mx-auto h-14 w-14 text-forest-400" />
        <p className="eyebrow justify-center mx-auto! mt-8">Lost in the woods</p>
        <h1 className="mt-3 font-display text-[7rem] font-light italic leading-none text-forest-800 sm:text-[9rem]">
          404
        </h1>
        <p className="mx-auto mt-2 max-w-md font-display text-2xl text-charcoal-900">
          This trail doesn’t lead anywhere yet.
        </p>
        <p className="mx-auto mt-4 max-w-md leading-relaxed text-mist-600">
          The page you followed has wandered off the map. Head back to the
          clearing and pick a well-trodden path.
        </p>
        <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link to="/" className="btn btn-primary">
            <ArrowLeft className="h-4 w-4" />
            Back home
          </Link>
          <Link to="/hazards" className="btn btn-ghost">
            <Compass className="h-4 w-4" />
            Browse the hazard atlas
          </Link>
        </div>
      </Reveal>
    </div>
  );
}
