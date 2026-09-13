import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Search, SlidersHorizontal } from 'lucide-react';
import { api } from '../services/api';
import PageHeader from '../components/PageHeader';
import Reveal from '../components/Reveal';
import { getHazardMeta } from '../utils/hazardMeta';
import { Sprig } from '../components/Ornaments';
import { Loader2 } from 'lucide-react';

export default function EducationPage() {
  const [resources, setResources] = useState([]);
  const [categories, setCategories] = useState([]);
  const [category, setCategory] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filtered, setFiltered] = useState([]);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [resourcesRes, categoriesRes] = await Promise.all([
        api.education.getAll({ category, search }),
        api.education.getCategories(),
      ]);
      const list = Array.isArray(resourcesRes) ? resourcesRes : resourcesRes?.resources || [];
      const cats = Array.isArray(categoriesRes) ? categoriesRes : categoriesRes?.categories || [];
      setResources(list);
      setCategories(cats);
      setFiltered(list);
    } catch (err) {
      setError(err.message || 'Could not load the knowledge hub.');
      setResources([]);
      setFiltered([]);
    } finally {
      setLoading(false);
    }
  }, [category, search]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    let list = [...resources];
    if (category) {
      list = list.filter((r) => r.category === category);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (r) =>
          r.title?.toLowerCase().includes(q) ||
          r.content?.toLowerCase().includes(q) ||
          r.category?.toLowerCase().includes(q)
      );
    }
    setFiltered(list);
  }, [category, search, resources]);

  const hasFilters = Boolean(category || search.trim());

  return (
    <div>
      <PageHeader
        eyebrow="Knowledge hub"
        title="Field notes, written for the curious"
        subtitle="Plain-language guides on the hazards around us — what they are, what they do, and the small habits that keep you ahead of them."
      >
        <div className="mt-5 flex flex-col gap-4 sm:flex-row sm:items-end">
          <div className="flex-1">
            <label htmlFor="education-search" className="field-label">Search the library</label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-mist-400" />
              <input
                id="education-search"
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Try 'water' or 'climate'…"
                className="field pl-11"
              />
            </div>
          </div>
          <div className="w-full sm:w-56">
            <label htmlFor="education-category" className="field-label">Category</label>
            <select
              id="education-category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="field"
            >
              <option value="">All categories</option>
              {categories.map((cat) => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>
        </div>
      </PageHeader>

      <div className="mx-auto w-full max-w-6xl px-4 pb-24 sm:px-6 lg:px-8">
        {/* loading state */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-24">
            <Loader2 className="h-8 w-8 animate-spin text-forest-500" />
            <p className="mt-4 text-sm text-mist-600">Loading the library…</p>
          </div>
        )}

        {/* error state */}
        {error && !loading && (
          <div className="flex flex-col items-center justify-center py-24">
            <div className="grid h-14 w-14 place-items-center rounded-full bg-[#f7e5de] text-[#a8432e] mx-auto">
              <AlertTriangle className="h-7 w-7" />
            </div>
            <p className="mt-4 font-display text-xl text-charcoal-900">Could not load the library</p>
            <p className="mx-auto mt-2 max-w-sm text-sm text-mist-600">{error}</p>
            <button onClick={load} className="btn btn-ghost btn-sm mt-6">
              Try again
            </button>
          </div>
        )}

        {/* empty state */}
        {!loading && !error && filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-24">
            <Sprig className="h-14 w-auto text-forest-300 animate-sway-slow mx-auto" />
            <p className="mt-5 font-display text-xl text-charcoal-900">No field notes match</p>
            <p className="mx-auto mt-2 max-w-sm text-sm text-mist-600">
              {hasFilters
                ? 'Loosen the filters or try another word — the right article is usually nearby.'
                : 'The library is quiet right now. Start the demo backend to seed the articles.'}
            </p>
            {hasFilters && (
              <button
                onClick={() => { setCategory(''); setSearch(''); }}
                className="btn btn-soft btn-sm mt-6"
              >
                Clear filters
              </button>
            )}
          </div>
        )}

        {/* library */}
        {!loading && !error && filtered.length > 0 && (
          <>
            <div className="mt-10 grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
              {filtered.map((resource, i) => {
                const meta = getHazardMeta(resource.category);
                const Icon = meta.icon;
                return (
                  <Reveal key={resource.id} delay={(i % 3) * 90} className="h-full">
                    <article className="eco-card group flex h-full flex-col p-6">
                      <div className="flex items-center justify-between">
                        <span className={`grid h-10 w-10 place-items-center rounded-xl ring-1 ring-black/[0.03] ${meta.tile}`}>
                          <Icon className="h-5 w-5" strokeWidth={1.9} />
                        </span>
                        <span className="inline-flex items-center gap-1.5 text-[0.7rem] font-bold uppercase tracking-[0.16em] text-mist-400">
                          <Clock3 className="h-3 w-3" />
                          {resource.category}
                        </span>
                      </div>
                      <h2 className="mt-5 text-[1.15rem] leading-snug transition-colors duration-200 group-hover:text-forest-700">
                        {resource.title}
                      </h2>
                      <p className="mt-2.5 flex-1 text-sm leading-relaxed text-mist-600 line-clamp-3">
                        {resource.content}
                      </p>
                      <div className="mt-5 flex items-center justify-between border-t border-cream-200 pt-4">
                        <span className="text-xs font-medium text-mist-500">{resource.author}</span>
                        <Link
                          to={`/education/${resource.id}`}
                          className="inline-flex items-center gap-1 text-sm font-semibold text-forest-700"
                        >
                          Read note
                          <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
                        </Link>
                      </div>
                    </article>
                  </Reveal>
                );
              })}
            </div>

            {categories.length > 0 && (
              <div className="mt-8 flex flex-wrap gap-2">
                {categories.map((cat) => (
                  <span
                    key={cat}
                    className="rounded-full border border-cream-200 bg-cream-50 px-4 py-1.5 text-[0.8rem] font-semibold text-mist-600 transition-colors hover:border-forest-300 hover:text-forest-700"
                  >
                    {cat}
                  </span>
                ))}
              </div>
            )}
          </>
        )}
      </div >
    </div>
  );
}

function AlertTriangle({ className }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>;
}

function ArrowRight({ className }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>;
}

function Clock3({ className }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>;
}
