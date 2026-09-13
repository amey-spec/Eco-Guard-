import { useState, useEffect } from 'react';
import { Search, SlidersHorizontal, Leaf } from 'lucide-react';
import { api } from '../services/api';
import HazardCard from '../components/HazardCard';
import PageHeader from '../components/PageHeader';
import Reveal from '../components/Reveal';

export default function HazardsPage() {
  const [hazards, setHazards] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [categories, setCategories] = useState([]);
  const [category, setCategory] = useState('');
  const [severity, setSeverity] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const data = await api.hazards.getAll();
        if (cancelled) return;
        const list = Array.isArray(data) ? data : data?.hazards || [];
        setHazards(list);
        setFiltered(list);
      } catch (error) {
        if (!cancelled) console.error('Failed to load hazards:', error);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    (async () => {
      try {
        const data = await api.hazards.getCategories();
        if (cancelled) return;
        setCategories(Array.isArray(data) ? data : data?.categories || []);
      } catch (error) {
        if (!cancelled) console.error('Failed to load categories:', error);
      }
    })();

    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let list = [...hazards];
    if (category) list = list.filter((h) => h.category === category);
    if (severity) list = list.filter((h) => h.severity === severity);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (h) =>
          h.name.toLowerCase().includes(q) ||
          h.description.toLowerCase().includes(q) ||
          h.category.toLowerCase().includes(q)
      );
    }
    setFiltered(list);
  }, [category, severity, search, hazards]);

  const hasFilters = Boolean(category || severity || search.trim());

  return (
    <div>
      <PageHeader
        eyebrow="Hazard atlas"
        title="Know what you’re looking at"
        subtitle="Browse the field notes on each hazard — what causes it, what it does to the land and people, and how to stay ahead of it."
      />

      <div className="mx-auto w-full max-w-6xl px-4 pb-24 sm:px-6 lg:px-8">
        {/* Filters */}
        <Reveal>
          <div className="eco-card p-6 sm:p-7">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-end">
              <div className="flex-1">
                <label htmlFor="hazard-search" className="field-label">Search the atlas</label>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-mist-400" />
                  <input
                    id="hazard-search"
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Try “flooding” or “plastic”…"
                    className="field pl-11"
                  />
                </div>
              </div>

              <div className="w-full lg:w-56">
                <label htmlFor="category" className="field-label">Category</label>
                <select id="category" value={category} onChange={(e) => setCategory(e.target.value)} className="field">
                  <option value="">All categories</option>
                  {categories.map((cat) => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              <div className="w-full lg:w-56">
                <label htmlFor="severity" className="field-label">Severity</label>
                <select id="severity" value={severity} onChange={(e) => setSeverity(e.target.value)} className="field">
                  <option value="">All severities</option>
                  <option value="Low">Low</option>
                  <option value="Moderate">Moderate</option>
                  <option value="High">High</option>
                  <option value="Critical">Critical</option>
                </select>
              </div>

              <div className="hidden shrink-0 items-center gap-2 rounded-xl bg-cream-100 px-4 py-3 text-sm text-mist-600 lg:flex">
                <SlidersHorizontal className="h-4 w-4 text-forest-600" />
                {filtered.length} {filtered.length === 1 ? 'entry' : 'entries'}
              </div>
            </div>
          </div>
        </Reveal>

        {/* Results */}
        <div className="mt-10">
          {loading ? (
            <div className="eco-loading">
              <div className="eco-loader" />
              <p className="eco-loading-text">Walking the atlas…</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="eco-card px-8 py-16 text-center">
              <Leaf className="mx-auto h-10 w-10 text-mist-300" />
              <p className="mt-4 font-display text-xl text-charcoal-900">No field notes match</p>
              <p className="mx-auto mt-2 max-w-sm text-sm text-mist-600">
                {hasFilters
                  ? 'Loosen the filters or try another word — the right entry is usually nearby.'
                  : 'The atlas is empty right now. Start the demo backend to seed the field notes.'}
              </p>
              {hasFilters && (
                <button
                  onClick={() => { setCategory(''); setSeverity(''); setSearch(''); }}
                  className="btn btn-soft btn-sm mt-6"
                >
                  Clear filters
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
              {filtered.map((hazard, i) => (
                <Reveal key={hazard.id} delay={(i % 3) * 80} className="h-full">
                  <HazardCard hazard={hazard} />
                </Reveal>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
