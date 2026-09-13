import { Wind, Droplet, Sun, Recycle, Sprout } from 'lucide-react';

/**
 * EcoPulse groups. The score for each group is derived from the real community
 * report record — there are no air/water sensors, so every number shown comes
 * from actual reports (type, severity, status).
 *
 *   severity weights how bad an open signal is for the group;
 *   resolved/rejected reports are weighted near zero (the pressure was handled);
 *   score = 100 − total pressure, or null when the group has no reports at all.
 */
export const ECO_GROUPS = [
  { key: 'air', name: 'Air quality', icon: Wind, tile: 'bg-[#e3edf0] text-[#3d6f83]', bar: 'bg-[#5b8ca3]', keywords: ['air'] },
  { key: 'water', name: 'Water health', icon: Droplet, tile: 'bg-[#e2eff0] text-[#3f7d8a]', bar: 'bg-[#4f93a0]', keywords: ['water', 'flood'] },
  { key: 'heat', name: 'Heat risk', icon: Sun, tile: 'bg-[#fae9d6] text-[#c06a22]', bar: 'bg-[#d9753f]', keywords: ['heat'] },
  { key: 'waste', name: 'Waste pressure', icon: Recycle, tile: 'bg-[#efe6ea] text-[#915570]', bar: 'bg-[#b06f8f]', keywords: ['plastic', 'chemical'] },
  { key: 'habitat', name: 'Habitat health', icon: Sprout, tile: 'bg-[#e5efe0] text-[#4c7a3e]', bar: 'bg-[#54905f]', keywords: ['deforest', 'soil'] },
];

const SEVERITY_WEIGHT = { Critical: 25, High: 18, Moderate: 12, Low: 6 };
const CLOSED_STATUSES = ['Resolved', 'Rejected'];
const RESOLVED_WEIGHT = 0.15;

const matchesGroup = (hazardType, keywords) =>
  keywords.some((k) => String(hazardType || '').toLowerCase().includes(k));

/**
 * @param {Array} reports — full report list (hazard_type, severity, status)
 * @returns {Array} one entry per ECO_GROUPS: { ...group, score, open, total }
 *   score is 0–100 (healthier = higher) or null when the group has no reports.
 */
export function computeEcoScores(reports = []) {
  return ECO_GROUPS.map((group) => {
    const list = reports.filter((r) => matchesGroup(r.hazard_type || r.hazardType, group.keywords));
    const total = list.length;
    const open = list.filter((r) => !CLOSED_STATUSES.includes(r.status)).length;

    const pressure = list.reduce((sum, r) => {
      const weight = SEVERITY_WEIGHT[r.severity] || SEVERITY_WEIGHT.Low;
      return sum + (CLOSED_STATUSES.includes(r.status) ? weight * RESOLVED_WEIGHT : weight);
    }, 0);

    return {
      ...group,
      score: total === 0 ? null : Math.max(0, Math.round(100 - pressure)),
      open,
      total,
    };
  });
}

/** Text colour for a score value (higher score = healthier = greener). */
export function scoreTone(score) {
  if (score === null || score === undefined) return 'text-mist-400';
  if (score >= 75) return 'text-forest-600';
  if (score >= 60) return 'text-status-moderate';
  if (score >= 45) return 'text-status-high';
  return 'text-status-critical';
}

/** One-line, data-only summary for a computed group ("2 open of 5 signals"). */
export function groupSummary(g) {
  if (g.total === 0) return 'No signals on record yet';
  return `${g.open} open of ${g.total} ${g.total === 1 ? 'signal' : 'signals'}`;
}
