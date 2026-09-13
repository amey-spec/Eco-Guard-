import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { LocateFixed, MapPin, X, ArrowRight, Loader2 } from 'lucide-react';
import StatusBadge from './StatusBadge';
import { getHazardMeta } from '../utils/hazardMeta';

const SEVERITY_COLOR = {
  Critical: '#bc4b33',
  High: '#d97e2c',
  Moderate: '#c79a2f',
  Low: '#3f7d8f',
};

const SEVERITIES = ['Critical', 'High', 'Moderate', 'Low'];
const STATUSES = ['Submitted', 'Pending', 'Under Review', 'Verified', 'Resolved'];

const REGION = [40.715, -73.985];
const TILES = 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png';
const ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>';

const esc = (value) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

function pinIcon(severity) {
  const color = SEVERITY_COLOR[severity] || '#636f60';
  const html = `
    <span class="risk-pin" style="position:relative;display:block;width:30px;height:30px;">
      <span class="risk-pin__pulse" style="position:absolute;inset:2px;border-radius:9999px;background:${color};"></span>
      <svg width="30" height="34" viewBox="0 0 24 27" fill="none" xmlns="http://www.w3.org/2000/svg" style="position:relative;filter:drop-shadow(0 5px 6px rgba(18,33,20,.35));">
        <path d="M12 0C5.4 0 0 5.2 0 11.6 0 20.3 12 27 12 27s12-6.7 12-15.4C24 5.2 18.6 0 12 0z" fill="${color}"/>
        <circle cx="12" cy="11.5" r="4.1" fill="#fffdf7"/>
      </svg>
    </span>`;
  return L.divIcon({
    className: '',
    html,
    iconSize: [30, 30],
    iconAnchor: [15, 29],
    popupAnchor: [0, -30],
  });
}

function popupHtml(report) {
  const color = SEVERITY_COLOR[report.severity] || '#636f60';
  const when = report.created_at || report.createdAt
    ? new Date(report.created_at || report.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : '';
  return `
    <div class="risk-pop">
      <p class="risk-pop__kicker"><span style="width:7px;height:7px;border-radius:99px;background:${color};display:inline-block;"></span>${esc(report.severity)} signal · ${esc(report.status)}</p>
      <h3 class="risk-pop__title">${esc(report.title || 'Untitled report')}</h3>
      <p class="risk-pop__meta"><span>📍</span> ${esc(report.location || 'Unknown spot')}</p>
      <p class="risk-pop__type">${esc(report.hazard_type || report.hazardType)}${when ? ` · ${esc(when)}` : ''}</p>
    </div>`;
}

export default function RiskMap({ reports = [], loading = false }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const groupRef = useRef(null);
  const hasFitted = useRef(false);

  const [mapReady, setMapReady] = useState(false);
  const [severity, setSeverity] = useState('All');
  const [status, setStatus] = useState('All');
  const [selected, setSelected] = useState(null);

  const withCoords = useMemo(
    () => reports.filter((r) => Number.isFinite(Number(r.latitude)) && Number.isFinite(Number(r.longitude))),
    [reports]
  );

  const visible = useMemo(
    () =>
      withCoords.filter(
        (r) =>
          (severity === 'All' || r.severity === severity) &&
          (status === 'All' || r.status === status)
      ),
    [withCoords, severity, status]
  );

  /* initialise the map once */
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return undefined;

    const map = L.map(containerRef.current, {
      center: REGION,
      zoom: 11,
      zoomControl: false,
      minZoom: 9,
      maxZoom: 18,
      attributionControl: true,
    });

    L.control.zoom({ position: 'topright' }).addTo(map);
    L.tileLayer(TILES, { attribution: ATTRIBUTION, subdomains: 'abcd', maxZoom: 18 }).addTo(map);

    mapRef.current = map;
    groupRef.current = L.layerGroup().addTo(map);
    setMapReady(true);

    return () => {
      map.remove();
      mapRef.current = null;
      groupRef.current = null;
      hasFitted.current = false;
    };
  }, []);

  /* draw markers whenever the visible set changes */
  useEffect(() => {
    if (!mapReady || !mapRef.current || !groupRef.current) return undefined;

    const group = groupRef.current;
    group.clearLayers();

    visible.forEach((report) => {
      const marker = L.marker([Number(report.latitude), Number(report.longitude)], {
        icon: pinIcon(report.severity),
        riseOnHover: true,
        title: report.title,
      }).addTo(group);

      marker.bindPopup(popupHtml(report), { maxWidth: 300, minWidth: 230, autoPanPadding: [40, 40] });
      marker.on('click', () => setSelected(report));
    });

    // gentle first fit so the whole demo region is in view
    if (visible.length > 0 && !hasFitted.current) {
      hasFitted.current = true;
      const bounds = L.latLngBounds(visible.map((r) => [Number(r.latitude), Number(r.longitude)]));
      mapRef.current.flyToBounds(bounds, { padding: [56, 56], maxZoom: 13, duration: 1.1 });
    }

    setSelected((prev) => (prev && visible.some((r) => r.id === prev.id) ? prev : null));
  }, [mapReady, visible]);

  const refit = () => {
    const map = mapRef.current;
    if (!map || visible.length === 0) return;
    const bounds = L.latLngBounds(visible.map((r) => [Number(r.latitude), Number(r.longitude)]));
    map.flyToBounds(bounds, { padding: [56, 56], maxZoom: 13, duration: 0.9 });
  };

  const selectedMeta = selected ? getHazardMeta(selected.hazard_type || selected.hazardType) : null;
  const SelectedIcon = selectedMeta?.icon;

  return (
    <div className="risk-map overflow-hidden rounded-[2rem] border border-cream-200 bg-[#dfe8d7] shadow-soft">
      <div className="relative h-[440px] sm:h-[560px]">
        <div ref={containerRef} className="absolute inset-0 z-0" />

        {/* loading veil */}
        {loading && (
          <div className="absolute inset-0 z-[500] grid place-items-center bg-cream-50/70 backdrop-blur-[2px]">
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-forest-600" />
              <p className="text-sm font-medium text-mist-600">Reading the signals…</p>
            </div>
          </div>
        )}

        {/* severity filter */}
        <div className="absolute left-3 top-3 z-[600] flex max-w-[calc(100%-1.5rem)] flex-wrap items-center gap-1.5 rounded-2xl border border-cream-200 bg-cream-50/95 p-2 shadow-soft backdrop-blur-sm">
          {['All', ...SEVERITIES].map((s) => (
            <button
              key={s}
              onClick={() => { setSeverity(s); setSelected(null); }}
              className={`rounded-full px-3 py-1.5 text-[0.72rem] font-bold transition-colors ${
                severity === s
                  ? 'bg-forest-700 text-cream-50 dark:text-[#fffdf7]'
                  : 'text-mist-600 hover:bg-forest-100/80 hover:text-forest-800'
              }`}
            >
              {s === 'All' ? 'All severities' : s}
            </button>
          ))}
        </div>

        {/* status filter */}
        <div className="absolute left-3 top-[4.6rem] z-[600] flex max-w-[calc(100%-1.5rem)] flex-wrap items-center gap-1.5 rounded-2xl border border-cream-200 bg-cream-50/95 px-2.5 py-2 shadow-soft backdrop-blur-sm sm:top-3 sm:left-auto sm:right-16 sm:max-w-[calc(100%-15rem)] sm:justify-end">
          <span className="mr-1 hidden text-[0.65rem] font-bold uppercase tracking-[0.14em] text-mist-400 lg:inline">
            Status
          </span>
          <select
            value={status}
            onChange={(e) => { setStatus(e.target.value); setSelected(null); }}
            className="cursor-pointer rounded-full border border-cream-200 bg-transparent px-2 py-1 text-[0.72rem] font-semibold text-charcoal-700 outline-none transition-colors hover:border-forest-300"
          >
            <option value="All">All statuses</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>

        {/* refit + attribution-friendly extras */}
        <button
          onClick={refit}
          aria-label="Recenter on all signals"
          title="Recenter on all signals"
          className="absolute right-3 top-[4.6rem] z-[600] grid h-10 w-10 place-items-center rounded-full border border-cream-200 bg-cream-50/95 text-forest-700 shadow-soft transition-all hover:-translate-y-0.5 hover:bg-forest-100 sm:top-3"
        >
          <LocateFixed className="h-[18px] w-[18px]" strokeWidth={1.9} />
        </button>

        {/* empty / zero-state message */}
        {!loading && visible.length === 0 && (
          <div className="pointer-events-none absolute inset-x-0 bottom-6 z-[500] flex justify-center px-4">
            <p className="rounded-2xl border border-cream-200 bg-cream-50/95 px-5 py-3 text-center text-sm text-mist-600 shadow-soft backdrop-blur-sm">
              {withCoords.length === 0
                ? 'No community signals with coordinates yet — start the demo backend to seed them.'
                : 'No signals match those filters.'}
            </p>
          </div>
        )}

        {/* signal count */}
        {!loading && visible.length > 0 && (
          <div className="pointer-events-none absolute bottom-3 left-3 z-[600] rounded-full border border-cream-200 bg-cream-50/95 px-3.5 py-1.5 text-[0.72rem] font-bold uppercase tracking-[0.12em] text-forest-800 shadow-soft backdrop-blur-sm">
            {visible.length} {visible.length === 1 ? 'signal' : 'signals'} shown
          </div>
        )}

        {/* selected report card */}
        {selected && (
          <div className="absolute inset-x-3 bottom-14 z-[700] sm:inset-x-auto sm:bottom-4 sm:left-4 sm:max-w-sm">
            <div className="relative rounded-2xl border border-cream-200 bg-cream-50 p-5 shadow-soft-lg">
              <button
                onClick={() => setSelected(null)}
                aria-label="Close details"
                className="absolute right-3 top-3 grid h-8 w-8 place-items-center rounded-full text-mist-500 transition-colors hover:bg-cream-100 hover:text-charcoal-900"
              >
                <X className="h-4 w-4" />
              </button>

              <div className="flex items-center gap-3 pr-8">
                {SelectedIcon && (
                  <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ring-1 ring-black/[0.04] ${selectedMeta.tile}`}>
                    <SelectedIcon className="h-5 w-5" strokeWidth={1.9} />
                  </span>
                )}
                <div className="min-w-0">
                  <p className="text-[0.68rem] font-bold uppercase tracking-[0.16em] text-mist-500">
                    {selected.id}
                  </p>
                  <h3 className="truncate text-base leading-tight">{selected.title || 'Untitled report'}</h3>
                </div>
              </div>

              <p className="mt-2.5 line-clamp-2 text-sm leading-relaxed text-mist-600">
                {selected.description}
              </p>

              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-mist-500">
                <span className="inline-flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5 text-forest-500" />
                  {selected.location}
                </span>
              </div>

              <div className="mt-3.5 flex items-center justify-between gap-3 border-t border-cream-200 pt-3.5">
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge status={selected.severity} type="severity" />
                  <StatusBadge status={selected.status} type="status" />
                </div>
                <Link
                  to={`/reports/${selected.id}`}
                  className="btn btn-primary btn-sm group shrink-0"
                >
                  Trail
                  <ArrowRight className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-0.5" />
                </Link>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
