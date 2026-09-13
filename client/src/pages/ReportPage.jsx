import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ImagePlus, MapPin, Tag, NotebookPen, LocateFixed, X, CheckCircle2, Loader2,
} from 'lucide-react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import PageHeader from '../components/PageHeader';
import Reveal from '../components/Reveal';
import StatusBadge from '../components/StatusBadge';

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

// The atlas is normally loaded live from the API; this keeps the picker usable
// if the backend is unreachable (names mirror the seeded hazard atlas).
const FALLBACK_TYPES = [
  'Air Pollution', 'Water Pollution', 'Soil Pollution', 'Noise Pollution',
  'Plastic Pollution', 'Deforestation', 'Flooding', 'Extreme Heat',
  'Wildfires', 'Chemical Pollution',
];

const ASKS = [
  { icon: MapPin, label: 'Site location', text: 'Describe the spot — “use my location” pins it precisely.' },
  { icon: Tag, label: 'What', text: 'Pick the hazard type & severity from the lists.' },
  { icon: NotebookPen, label: 'The detail', text: 'A short field note on what you saw.' },
  { icon: ImagePlus, label: 'Proof', text: 'One clear image (JPG, PNG or WebP) speeds up review.' },
];

const initialForm = {
  title: '',
  hazard_type: '',
  severity: '',
  location: '',
  description: '',
};

export default function ReportPage() {
  const { user, isAuthenticated } = useAuth();
  const [form, setForm] = useState(initialForm);
  const [hazardTypes, setHazardTypes] = useState([]);
  const [coords, setCoords] = useState(null);
  const [locating, setLocating] = useState(false);
  const [locNote, setLocNote] = useState('');
  const [image, setImage] = useState(null);
  const [imagePreview, setImagePreview] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submittedId, setSubmittedId] = useState(null);

  const setField = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  /* load the live hazard list for the type picker */
  useEffect(() => {
    let cancelled = false;
    api.hazards
      .getAll()
      .then((data) => {
        if (cancelled) return;
        const list = Array.isArray(data) ? data : data?.hazards || [];
        const names = list.map((h) => h.name).filter(Boolean);
        setHazardTypes(names.length > 0 ? names : FALLBACK_TYPES);
      })
      .catch(() => { if (!cancelled) setHazardTypes(FALLBACK_TYPES); });
    return () => { cancelled = true; };
  }, []);

  /* revoke the preview object URL when it changes or the page unmounts */
  useEffect(() => {
    if (!imagePreview) return undefined;
    const url = imagePreview;
    return () => URL.revokeObjectURL(url);
  }, [imagePreview]);

  const pickImage = (file) => {
    setError('');
    if (!file) return;
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      setError('Please choose a JPG, PNG or WebP image.');
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setError('That image is over the 5 MB limit — try a smaller one.');
      return;
    }
    setImage(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const locateMe = () => {
    setLocNote('');
    if (!('geolocation' in navigator)) {
      setLocNote('Location lookup is not available on this device — describing the spot is fine.');
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({
          lat: Number(pos.coords.latitude.toFixed(5)),
          lng: Number(pos.coords.longitude.toFixed(5)),
        });
        setLocating(false);
      },
      () => {
        setLocating(false);
        setLocNote('Could not read your location — describing the spot is fine.');
      },
      { enableHighAccuracy: false, timeout: 10000 }
    );
  };

  const validate = () => {
    if (form.title.trim().length < 4) return 'Give the signal a short, clear title.';
    if (!form.hazard_type) return 'Choose the type of hazard you saw.';
    if (!form.severity) return 'Choose how severe it looks.';
    if (form.location.trim().length < 4) return 'Tell us roughly where this is.';
    if (form.description.trim().length < 20) return 'Describe what you saw in a sentence or two.';
    return '';
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const problem = validate();
    if (problem) { setError(problem); return; }
    setError('');
    setSubmitting(true);

    const fd = new FormData();
    fd.append('title', form.title.trim());
    fd.append('hazard_type', form.hazard_type);
    fd.append('severity', form.severity);
    fd.append('location', form.location.trim());
    fd.append('description', form.description.trim());
    if (coords) {
      fd.append('latitude', String(coords.lat));
      fd.append('longitude', String(coords.lng));
    }
    if (image) fd.append('image', image);

    try {
      const data = await api.reports.submit(fd);
      setSubmittedId(data.reportId);
    } catch (err) {
      setError(err.message || 'Could not send the report — please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const reset = () => {
    setForm(initialForm);
    setCoords(null);
    setLocNote('');
    setImage(null);
    setImagePreview('');
    setError('');
    setSubmittedId(null);
  };

  return (
    <div>
      <PageHeader
        eyebrow="Report a hazard"
        title="If it looks wrong, say so"
        subtitle="A report takes about two minutes and joins the local field record — helping neighbours and authorities act while there’s still time."
      />

      <div className="mx-auto w-full max-w-6xl px-4 pb-24 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_330px] lg:items-start">
          {/* ---------- form / confirmation ---------- */}
          <Reveal>
            <div className="eco-card p-6 sm:p-9">
              {submittedId ? (
                <div className="py-6 text-center sm:py-10">
                  <span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-[#e5efe0] text-[#3e6a3c]">
                    <CheckCircle2 className="h-8 w-8" strokeWidth={1.9} />
                  </span>
                  <h2 className="mt-6 text-3xl">Signal left in the field record</h2>
                  <p className="mx-auto mt-2 max-w-md text-mist-600">
                    Your report is now on the record. A ranger will review it and
                    verified signals head to the field team.
                  </p>
                  <p className="mt-6 font-display text-2xl tracking-tight text-forest-800">
                    {submittedId}
                  </p>
                  <div className="mt-3 flex justify-center">
                    <StatusBadge status="Submitted" type="status" />
                  </div>
                  {isAuthenticated ? (
                    <p className="mx-auto mt-5 max-w-sm text-sm leading-relaxed text-mist-500">
                      You’ll get a notification in your inbox at each milestone.
                    </p>
                  ) : (
                    <p className="mx-auto mt-5 max-w-sm text-sm leading-relaxed text-mist-500">
                      This report was left anonymously. Sign in next time to keep it on
                      your account and follow its trail.
                    </p>
                  )}
                  <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
                    <button onClick={reset} className="btn btn-primary btn-lg">
                      Leave another signal
                    </button>
                    <Link to="/map" className="btn btn-ghost btn-lg">
                      See the risk map
                    </Link>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-6" noValidate>
                  <div>
                    <h2 className="text-2xl">Leave a signal</h2>
                    <p className="mt-1.5 text-sm text-mist-600">
                      Everything below goes straight onto the public field record.
                    </p>
                  </div>

                  {error && (
                    <div
                      id="report-form-error"
                      className="rounded-xl border border-[#efcdbf] bg-[#f7e5de] px-4 py-3 text-sm font-medium text-[#a8432e]"
                      role="alert"
                    >
                      {error}
                    </div>
                  )}

                  {/* title */}
                  <div>
                    <label htmlFor="report-title" className="field-label">
                      Short title <span className="text-forest-600">*</span>
                    </label>
                    <input
                      id="report-title"
                      type="text"
                      required
                      value={form.title}
                      onChange={(e) => setField('title', e.target.value)}
                      maxLength={120}
                      placeholder="e.g. Oily sheen on the creek near the footbridge"
                      className="field"
                      aria-invalid={!!error}
                      aria-describedby={error ? 'report-form-error' : undefined}
                    />
                  </div>

                  {/* type + severity */}
                  <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                    <div>
                      <label htmlFor="report-type" className="field-label">
                        Type of hazard <span className="text-forest-600">*</span>
                      </label>
                      <select
                        id="report-type"
                        required
                        value={form.hazard_type}
                        onChange={(e) => setField('hazard_type', e.target.value)}
                        className="field"
                        aria-invalid={!!error}
                        aria-describedby={error ? 'report-form-error' : undefined}
                      >
                        <option value="">Select the type…</option>
                        {hazardTypes.map((name) => (
                          <option key={name} value={name}>{name}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label htmlFor="report-severity" className="field-label">
                        Severity <span className="text-forest-600">*</span>
                      </label>
                      <select
                        id="report-severity"
                        required
                        value={form.severity}
                        onChange={(e) => setField('severity', e.target.value)}
                        className="field"
                        aria-invalid={!!error}
                        aria-describedby={error ? 'report-form-error' : undefined}
                      >
                        <option value="">Select severity…</option>
                        <option value="Low">Low — noticeable, no danger yet</option>
                        <option value="Moderate">Moderate — worth watching</option>
                        <option value="High">High — acting quickly helps</option>
                        <option value="Critical">Critical — immediate concern</option>
                      </select>
                    </div>
                  </div>

                  {/* location */}
                  <div>
                    <div className="flex items-center justify-between gap-3">
                      <label htmlFor="report-location" className="field-label mb-0">
                        Site location <span className="text-forest-600">*</span>
                      </label>
                      <button
                        type="button"
                        onClick={locateMe}
                        disabled={locating}
                        className="inline-flex items-center gap-1.5 rounded-full border border-cream-300 bg-cream-50 px-3 py-1.5 text-xs font-semibold text-forest-700 transition-colors hover:border-forest-400 hover:bg-forest-50 disabled:opacity-60"
                        aria-describedby="location-help"
                      >
                        {locating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <MapPin className="h-3.5 w-3.5" />}
                        {locating ? 'Reading…' : 'Use my location'}
                      </button>
                    </div>
                    <input
                      id="report-location"
                      type="text"
                      required
                      value={form.location}
                      onChange={(e) => setField('location', e.target.value)}
                      maxLength={160}
                      placeholder="e.g. Riverside North, by the old mill bridge"
                      className="field mt-2"
                      aria-invalid={!!error}
                      aria-describedby={error ? 'report-form-error' : 'location-help'}
                    />
                    <p className="mt-1.5 text-xs text-mist-500">
                      {form.location.length}/160 — a street, landmark or “near the…” works. Pin your device for a precise spot.
                    </p>
                    {coords && (
                      <div className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-forest-200 bg-forest-50/80 px-4 py-2.5 text-sm">
                        <span className="inline-flex items-center gap-2 font-medium text-forest-800">
                          <MapPin className="h-4 w-4" />
                          {coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}
                          <span className="text-xs font-normal text-mist-500">· pinned from your device</span>
                        </span>
                        <button
                          type="button"
                          onClick={() => setCoords(null)}
                          aria-label="Remove device location"
                          className="grid h-6 w-6 place-items-center rounded-full text-mist-500 transition-colors hover:bg-forest-100 hover:text-charcoal-900"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )}
                    {locNote && <p className="mt-2 text-xs text-mist-500">{locNote}</p>}
                  </div>

                  {/* description */}
                  <div>
                    <label htmlFor="report-description" className="field-label">
                      What did you see? <span className="text-forest-600">*</span>
                    </label>
                    <textarea
                      id="report-description"
                      required
                      value={form.description}
                      onChange={(e) => setField('description', e.target.value)}
                      maxLength={4000}
                      rows={4}
                      placeholder="Describe the signal — colour, smell, timing, how long it’s been going on, anything that helps a ranger understand it."
                      className="field"
                    />
                    <p className="mt-1.5 text-xs text-mist-500">{form.description.length}/4000 characters</p>
                  </div>

                  {/* image */}
                  <div>
                    <span className="field-label text-forest-700">Photo (optional)</span>
                    {imagePreview ? (
                      <div className="flex items-center gap-4 rounded-2xl border border-cream-200 bg-cream-50/70 p-3">
                        <img
                          src={imagePreview}
                          alt={`Preview of ${image?.name || 'your photo'}`}
                          className="h-24 w-24 shrink-0 rounded-xl object-cover ring-1 ring-black/[0.06]"
                        />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-charcoal-900">{image?.name}</p>

                          <p className="mt-0.5 text-xs text-mist-500">
                            {image ? Math.round(image.size / 1024) + ' KB · attached' : ''}
                          </p>
                          <button
                            type="button"
                            onClick={() => { setImage(null); setImagePreview(''); }}
                            className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-[#a8432e] transition-colors hover:text-[#bc4b33]"
                          >
                            <X className="h-3.5 w-3.5" /> Remove photo
                          </button>
                        </div>
                      </div>
                    ) : (
                      <label
                        htmlFor="report-image"
                        className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-cream-300 bg-cream-50/50 px-6 py-9 text-center transition-colors hover:border-forest-400 hover:bg-forest-50/50"
                      >
                        <span className="grid h-11 w-11 place-items-center rounded-full bg-forest-100 text-forest-700">
                          <ImagePlus className="h-5 w-5" strokeWidth={1.9} />
                        </span>
                        <span className="text-sm font-semibold text-charcoal-800">Click to add a photo</span>
                        <span className="text-xs text-mist-500">JPG, PNG or WebP · up to 5 MB</span>
                      </label>
                    )}
                    <input
                      id="report-image"
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      className="hidden"
                      onChange={(e) => pickImage(e.target.files?.[0])}
                    />
                  </div>

                  <div className="flex flex-col items-center gap-3 border-t border-cream-200 pt-6 sm:flex-row sm:justify-between">
                    <p className="text-xs leading-relaxed text-mist-500">
{isAuthenticated
  ? (
    <>Reporting as <span className="font-semibold text-charcoal-800">{user?.name}</span> — you’ll get updates.</>
  )
  : (
    <>Reporting anonymously — <Link to="/login" className="font-semibold text-forest-700 link-under">sign in</Link> to keep it on your account.</>
  )
}
                    </p>
                    <button
                      type="submit"
                      disabled={submitting}
                      className="btn btn-primary btn-lg w-full sm:w-auto"
                    >
                      {submitting ? (
                        <><Loader2 className="h-[18px] w-[18px] animate-spin" /> Sending your signal…</>
                      ) : (
                        'Send the signal'
                      )}
                    </button>
                  </div>
                </form>
              )
}
            </div>
          </Reveal>

          {/* ---------- sidebar ---------- */}
          <div className="space-y-6">
            <Reveal delay={80}>
              <div className="eco-card p-6">
                <h3 className="text-xl">What we ask</h3>
                <ul className="mt-5 space-y-4">
                  {ASKS.map((ask) => {
                    const Icon = ask.icon;
                    return (
                      <li key={ask.label} className="flex items-start gap-3.5">
                        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-forest-100 text-forest-700">
                          <Icon className="h-[18px] w-[18px]" strokeWidth={1.9} />
                        </span>
                        <div>
                          <p className="text-[0.95rem] font-bold text-charcoal-900">{ask.label}</p>
                          <p className="mt-0.5 text-xs leading-relaxed text-mist-600">{ask.text}</p>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </Reveal>

            <Reveal delay={140}>
              <div className="rounded-3xl border border-dashed border-forest-200 bg-forest-50/60 p-6">
                <h3 className="text-lg">What happens next</h3>
                <p className="mt-2 text-sm leading-relaxed text-mist-600">
                  Signals go to the moderation queue, where a ranger moves them
                  through <span className="font-semibold text-charcoal-800">review → verification → resolution</span>.
                  The map and dashboard update from the same record.
                </p>
                <Link to="/map" className="btn btn-soft btn-sm mt-5 w-full">
                  Open the risk map
                </Link>
              </div>
            </Reveal>
          </div>
        </div>
      </div>
    </div>
  );
}
