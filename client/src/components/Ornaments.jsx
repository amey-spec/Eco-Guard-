/**
 * Hand-drawn botanical ornaments used sparingly for a natural, non-template feel.
 */

export function Sprig({ className = '' }) {
  return (
    <svg viewBox="0 0 120 40" fill="none" className={className} aria-hidden="true">
      <path d="M4 34c18-14 38-16 58-8 12 5 26 5 40-1" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <path d="M16 25c-1-7 3-12 9-13 6-1 9 3 8 8-1 6-7 10-13 8-4-1-5-3-4-3z" fill="currentColor" opacity="0.9" />
      <path d="M38 18c2-6 7-9 12-8 6 1 8 6 5 11-3 5-9 7-14 4-3-2-4-4-3-7z" fill="currentColor" opacity="0.7" />
      <path d="M62 15c3-5 9-6 13-3 4 3 4 8 0 11-4 3-10 1-12-3-1-2-1-4-1-5z" fill="currentColor" opacity="0.55" />
      <path d="M86 19c0-4 3-7 7-7 4 0 6 3 6 7s-3 7-7 7-6-3-6-7z" fill="currentColor" opacity="0.4" />
    </svg>
  );
}

export function SproutMark({ className = '' }) {
  return (
    <svg viewBox="0 0 48 48" fill="none" className={className} aria-hidden="true">
      <path d="M24 42V22" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path
        d="M24 30c0-9 4-14 13-14 0 8-4 14-13 14zM24 34c0-7-3-11-10-11 0 6 3 11 10 11z"
        fill="currentColor"
        opacity="0.85"
      />
    </svg>
  );
}

export function LeafSeal({ className = '' }) {
  return (
    <svg viewBox="0 0 40 40" fill="none" className={className} aria-hidden="true">
      <circle cx="20" cy="20" r="18.5" stroke="currentColor" strokeWidth="1.6" opacity="0.85" />
      <path d="M20 9c5 2 8 7 8 13 0 6-3 10-8 9-5-1-8-6-8-11 0-6 3-10 8-11z" fill="currentColor" opacity="0.9" />
      <path d="M20 9v22" stroke="#fffdf7" strokeWidth="1.4" strokeLinecap="round" />
      <path d="M20 15c-2 2-2 5-1 8M20 20c2 2 4 3 6 3" stroke="#fffdf7" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}
