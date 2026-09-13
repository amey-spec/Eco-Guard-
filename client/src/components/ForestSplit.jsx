/**
 * ForestSplit — an animated forest floor for the home hero.
 *
 * One continuous woodland, cut in half by what it has become:
 *   · Left  — a living grove: layered green canopies that sway in the wind,
 *             birds drifting above, a few leaves falling.
 *   · Right — the same hillside gone dry: bare, twisted trees, a fresh-cut
 *             stump at the seam, cracked soil and slow smoke.
 *
 * Pure SVG (aria-hidden) + a handful of CSS-animated leaves and wisps.
 * All motion respects `prefers-reduced-motion` via index.css.
 */

const HEALTHY_LEAVES = [
  { left: 6,  size: 7, dur: 13, delay: -3, drift: 18, spin: 320 },
  { left: 12, size: 6, dur: 17, delay: -9, drift: -14, spin: -300 },
  { left: 19, size: 8, dur: 11, delay: -2, drift: 26, spin: 360 },
  { left: 26, size: 5, dur: 15, delay: -11, drift: -20, spin: -340 },
  { left: 32, size: 7, dur: 18, delay: -6, drift: 16, spin: 300 },
  { left: 38, size: 6, dur: 12, delay: -8, drift: -12, spin: -320 },
  { left: 43, size: 8, dur: 16, delay: -1, drift: 22, spin: 350 },
];

const WISPS = [
  { left: 62, w: 86, h: 34, dur: 19, delay: -6, drift: -30 },
  { left: 71, w: 66, h: 28, dur: 24, delay: -14, drift: -20 },
  { left: 83, w: 96, h: 40, dur: 21, delay: -2, drift: -34 },
];

export default function ForestSplit() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-x-0 bottom-0 h-48 select-none overflow-hidden sm:h-56 lg:h-72 xl:h-80"
    >
      <svg
        className="absolute inset-0 h-full w-full"
        viewBox="0 0 1440 260"
        preserveAspectRatio="xMidYMax slice"
        focusable="false"
      >
        <defs>
          {/* air tint — cool on the living side, warm on the withered side */}
          <linearGradient id="fs-airH" gradientUnits="userSpaceOnUse" x1="0" y1="40" x2="0" y2="170">
            <stop offset="0" stopColor="rgb(124 170 132)" stopOpacity="0" />
            <stop offset="0.55" stopColor="rgb(124 170 132)" stopOpacity="0.14" />
            <stop offset="1" stopColor="rgb(124 170 132)" stopOpacity="0.05" />
          </linearGradient>
          <linearGradient id="fs-airD" gradientUnits="userSpaceOnUse" x1="0" y1="40" x2="0" y2="170">
            <stop offset="0" stopColor="rgb(178 138 92)" stopOpacity="0" />
            <stop offset="0.55" stopColor="rgb(178 138 92)" stopOpacity="0.17" />
            <stop offset="1" stopColor="rgb(178 138 92)" stopOpacity="0.07" />
          </linearGradient>
          {/* ground fills */}
          <linearGradient id="fs-groundH" gradientUnits="userSpaceOnUse" x1="0" y1="130" x2="0" y2="260">
            <stop offset="0" stopColor="#1d3a23" />
            <stop offset="0.3" stopColor="#132818" />
            <stop offset="1" stopColor="#0b1810" />
          </linearGradient>
          <linearGradient id="fs-groundD" gradientUnits="userSpaceOnUse" x1="0" y1="130" x2="0" y2="260">
            <stop offset="0" stopColor="#3a2a19" />
            <stop offset="0.35" stopColor="#221709" />
            <stop offset="1" stopColor="#120b05" />
          </linearGradient>
        </defs>

        {/* ---- mood air ---- */}
        <rect x="0" y="40" width="730" height="190" fill="url(#fs-airH)" />
        <rect x="712" y="40" width="728" height="190" fill="url(#fs-airD)" />

        {/* ---- far hillside — living side (small back bumps) ---- */}
        <g fill="#1d3522">
          <circle cx="110" cy="112" r="22" /><circle cx="84" cy="118" r="17" /><circle cx="136" cy="117" r="17" />
          <circle cx="250" cy="106" r="28" /><circle cx="217" cy="115" r="21" /><circle cx="283" cy="113" r="21" />
          <circle cx="395" cy="114" r="24" /><circle cx="368" cy="120" r="17" /><circle cx="424" cy="118" r="17" />
        </g>
        <g fill="#2a4a33" opacity="0.9">
          <circle cx="110" cy="104" r="12" />
          <circle cx="250" cy="96" r="15" />
          <circle cx="395" cy="105" r="11" />
        </g>

        {/* ---- far hillside — withered side (thin dead snags) ---- */}
        <g stroke="#3e3120" strokeWidth="3" strokeLinecap="round" fill="none">
          <path d="M1058 140 C 1058 112 1054 92 1048 76" />
          <path d="M1048 76 L 1036 62" strokeWidth="2" />
          <path d="M1232 140 C 1232 116 1236 98 1230 84" />
          <path d="M1230 84 L 1220 72" strokeWidth="2" />
          <path d="M1230 84 L 1242 72" strokeWidth="2" />
          <path d="M1386 140 C 1386 122 1384 108 1382 96" />
          <path d="M1382 96 L 1374 86" strokeWidth="2" />
        </g>

        {/* ---- ground ---- */}
        <path
          d="M0 260 L0 138 C 70 130 150 140 230 133 C 320 126 420 138 500 131 C 590 126 660 136 720 130 L 726 132 L 726 260 Z"
          fill="url(#fs-groundH)"
        />
        <path
          d="M1440 260 L1440 136 C 1380 130 1310 138 1240 133 C 1160 127 1080 138 1000 132 C 930 128 860 136 790 132 C 750 130 736 132 728 134 L 728 260 Z"
          fill="url(#fs-groundD)"
        />

        {/* ================= living grove ================= */}
        {/* main oak */}
        <path d="M447 112 L463 112 L466 142 L444 142 Z" fill="#22301f" />
        <g className="cg-sway" style={{ animationDuration: '12s' }}>
          <g fill="#2c4a34">
            <circle cx="455" cy="70" r="44" /><circle cx="417" cy="80" r="36" />
            <circle cx="494" cy="76" r="34" /><circle cx="430" cy="44" r="30" /><circle cx="480" cy="44" r="28" />
          </g>
          <g fill="#3f6b48">
            <circle cx="455" cy="64" r="36" /><circle cx="423" cy="74" r="28" />
            <circle cx="492" cy="68" r="26" /><circle cx="435" cy="42" r="22" /><circle cx="478" cy="40" r="20" />
          </g>
          <g fill="#54905f" opacity="0.9">
            <circle cx="452" cy="52" r="24" /><circle cx="470" cy="40" r="16" />
          </g>
          <circle cx="446" cy="42" r="13" fill="#77ad81" opacity="0.5" />
        </g>

        {/* second oak */}
        <path d="M594 100 L606 100 L608 142 L592 142 Z" fill="#22301f" />
        <g className="cg-sway" style={{ animationDuration: '9.5s', animationDelay: '-3s' }}>
          <g fill="#2b4a33">
            <circle cx="600" cy="74" r="30" /><circle cx="575" cy="80" r="24" /><circle cx="625" cy="78" r="22" />
          </g>
          <g fill="#3f6b48">
            <circle cx="600" cy="72" r="22" /><circle cx="582" cy="76" r="17" />
          </g>
          <g fill="#54905f" opacity="0.9">
            <circle cx="600" cy="64" r="15" /><circle cx="590" cy="60" r="9" />
          </g>
          <circle cx="608" cy="56" r="8" fill="#77ad81" opacity="0.45" />
        </g>

        {/* sapling at the seam */}
        <path d="M672 124 L680 124 L681 142 L671 142 Z" fill="#22301f" />
        <g className="cg-sway" style={{ animationDuration: '8s', animationDelay: '-1s' }}>
          <g fill="#3f6b48">
            <circle cx="676" cy="112" r="13" /><circle cx="667" cy="117" r="9" /><circle cx="685" cy="116" r="8" />
          </g>
          <circle cx="676" cy="107" r="7" fill="#54905f" opacity="0.9" />
        </g>

        {/* birds */}
        <g stroke="#bcd8c0" strokeWidth="1.6" strokeLinecap="round" fill="none" opacity="0.55" className="cg-bob">
          <path d="M322 52 q 7 -8 14 0 q 7 -8 14 0" />
          <path d="M300 66 q 6 -6 11 0 q 6 -6 11 0" strokeWidth="1.3" opacity="0.7" />
        </g>

        {/* ================= withered side ================= */}
        {/* cut stump at the seam */}
        <path d="M734 118 L750 118 L752 142 L732 142 Z" fill="#2c2114" />
        <ellipse cx="742" cy="118" rx="9.5" ry="3.2" fill="#b7905f" opacity="0.95" />
        <path d="M737 118 L747 118" stroke="#6e5231" strokeWidth="0.9" strokeLinecap="round" opacity="0.8" />
        <circle cx="751" cy="127" r="1.7" fill="#7a5b35" opacity="0.8" />
        <circle cx="733" cy="131" r="1.4" fill="#7a5b35" opacity="0.7" />

        {/* small dead sapling */}
        <path d="M797 122 L803 122 L805 142 L795 142 Z" fill="#332616" />
        <g stroke="#8a6a44" strokeLinecap="round" fill="none">
          <path d="M800 122 C 800 110 798 102 794 96" strokeWidth="3" />
          <path d="M800 122 C 800 110 803 104 808 100" strokeWidth="3" />
          <path d="M800 122 C 800 114 801 108 801 100" strokeWidth="2.5" />
        </g>
        <ellipse cx="793" cy="94" rx="5" ry="3" fill="#9a6a34" opacity="0.35" transform="rotate(-18 793 94)" />

        {/* dead tree 1 */}
        <path d="M894 86 L906 86 L909 142 L891 142 Z" fill="#332616" />
        <g stroke="#8a6a44" strokeLinecap="round" fill="none">
          <path d="M900 86 C 897 66 880 52 856 44" strokeWidth="6.5" />
          <path d="M876 58 C 868 50 860 45 850 43" strokeWidth="4" />
          <path d="M900 86 C 906 62 922 48 946 42" strokeWidth="6" />
          <path d="M926 56 L 940 48" strokeWidth="3" />
          <path d="M900 86 C 899 62 902 40 898 24" strokeWidth="4.5" />
          <path d="M899 46 L 886 40" strokeWidth="3" />
          <path d="M900 52 L 914 44" strokeWidth="3" />
        </g>
        <ellipse cx="858" cy="45" rx="8" ry="4" fill="#9a6a34" opacity="0.45" transform="rotate(-12 858 45)" />
        <ellipse cx="944" cy="43" rx="7" ry="3.6" fill="#9a6a34" opacity="0.4" transform="rotate(16 944 43)" />
        <ellipse cx="896" cy="22" rx="6" ry="3" fill="#9a6a34" opacity="0.5" />

        {/* dead tree 2 */}
        <path d="M1094 72 L1106 72 L1109 142 L1091 142 Z" fill="#2b2012" />
        <g stroke="#7f5f3a" strokeLinecap="round" fill="none">
          <path d="M1100 72 C 1097 44 1088 30 1070 22" strokeWidth="6.5" />
          <path d="M1085 36 C 1078 28 1070 23 1062 21" strokeWidth="3.5" />
          <path d="M1100 72 C 1102 42 1116 28 1136 22" strokeWidth="6" />
          <path d="M1119 38 C 1126 32 1132 28 1138 26" strokeWidth="3" />
          <path d="M1100 72 C 1100 50 1099 38 1101 18" strokeWidth="4.5" />
          <path d="M1100 40 L 1112 34" strokeWidth="2.5" />
          <path d="M1101 44 L 1089 36" strokeWidth="2.5" />
        </g>
        <ellipse cx="1066" cy="22" rx="7" ry="3.6" fill="#966a36" opacity="0.4" transform="rotate(-14 1066 22)" />
        <ellipse cx="1134" cy="23" rx="6" ry="3" fill="#966a36" opacity="0.35" transform="rotate(12 1134 23)" />
        <ellipse cx="1099" cy="15" rx="5.5" ry="2.8" fill="#966a36" opacity="0.45" />

        {/* dead tree 3 (leaning) */}
        <path d="M1313 100 L1327 100 L1335 144 L1305 144 Z" fill="#2f2416" />
        <g stroke="#6f5638" strokeLinecap="round" fill="none">
          <path d="M1320 100 C 1316 78 1306 66 1292 58" strokeWidth="6" />
          <path d="M1306 68 C 1300 62 1296 59 1290 58" strokeWidth="3" />
          <path d="M1320 100 C 1324 80 1338 66 1356 60" strokeWidth="5" />
          <path d="M1342 72 L 1356 64" strokeWidth="2.5" />
          <path d="M1320 100 C 1321 86 1320 74 1321 62" strokeWidth="3.5" />
        </g>
        <ellipse cx="1290" cy="56" rx="6" ry="3" fill="#966a36" opacity="0.4" transform="rotate(-10 1290 56)" />

        {/* ---- ground dressing: living side ---- */}
        <g stroke="#45744c" strokeWidth="1.5" strokeLinecap="round" opacity="0.75" fill="none">
          <path d="M150 140 q -2 -8 -4 -12" /><path d="M150 140 q 3 -7 4 -12" />
          <path d="M300 138 q -2 -8 -4 -12" /><path d="M300 138 q 3 -7 4 -12" />
          <path d="M470 136 q -2 -8 -4 -12" /><path d="M470 136 q 3 -7 4 -12" />
          <path d="M590 138 q -2 -8 -4 -12" /><path d="M590 138 q 3 -7 4 -12" />
          <path d="M660 136 q -2 -8 -4 -12" /><path d="M660 136 q 3 -7 4 -12" />
          <path d="M710 136 q -2 -8 -4 -12" /><path d="M710 136 q 3 -7 4 -12" />
        </g>
        <g fill="#e9dfc6" opacity="0.85">
          <circle cx="318" cy="128" r="2" /><circle cx="472" cy="127" r="1.8" />
          <circle cx="662" cy="127" r="1.7" /><circle cx="160" cy="129" r="1.6" />
        </g>
        <g fill="#36603d" opacity="0.7">
          <circle cx="430" cy="139" r="3.2" /><circle cx="466" cy="140" r="2.6" />
          <circle cx="583" cy="140" r="2.2" /><circle cx="612" cy="139" r="2.8" />
          <circle cx="668" cy="139" r="2" />
        </g>

        {/* ---- ground dressing: withered side ---- */}
        <g fill="#201708" opacity="0.9">
          <circle cx="810" cy="137" r="9" />
          <circle cx="960" cy="137" r="12" />
          <circle cx="1155" cy="136" r="11" />
          <circle cx="1260" cy="138" r="13" />
        </g>
        <g stroke="#4c3a25" strokeWidth="1.4" strokeLinecap="round" fill="none" opacity="0.85">
          <path d="M960 150 L 978 146 L 992 152" />
          <path d="M1156 148 L 1172 152 L 1186 148 M 1186 148 L 1196 151" />
          <path d="M1340 144 L 1356 148 M 1356 148 L 1366 145" />
          <path d="M818 146 L 830 150" />
        </g>
        <g stroke="#5c4a2c" strokeWidth="1.2" strokeLinecap="round" opacity="0.6" fill="none">
          <path d="M824 140 q -1 -5 -2 -8" /><path d="M824 140 q 2 -4 3 -7" />
          <path d="M932 140 q -1 -5 -2 -8" /><path d="M932 140 q 2 -4 3 -7" />
          <path d="M1012 141 q -1 -5 -2 -8" /><path d="M1012 141 q 2 -4 3 -7" />
          <path d="M1118 140 q -1 -5 -2 -8" /><path d="M1118 140 q 2 -4 3 -7" />
          <path d="M1208 139 q -1 -5 -2 -8" /><path d="M1208 139 q 2 -4 3 -7" />
          <path d="M1290 141 q -1 -5 -2 -8" /><path d="M1290 141 q 2 -4 3 -7" />
          <path d="M1372 140 q -1 -5 -2 -8" /><path d="M1372 140 q 2 -4 3 -7" />
        </g>
        <g fill="#8a6840" opacity="0.55">
          <ellipse cx="892" cy="140" rx="5" ry="2.6" transform="rotate(24 892 140)" />
          <ellipse cx="908" cy="142" rx="4" ry="2.2" transform="rotate(-18 908 142)" />
          <ellipse cx="1100" cy="141" rx="4.5" ry="2.4" transform="rotate(30 1100 141)" />
          <ellipse cx="1332" cy="140" rx="4" ry="2.2" transform="rotate(-24 1332 140)" />
        </g>      {/* ---- the seam — where green stops ---- */}
      <path d="M726 30 L726 244" stroke="#e8dfc4" strokeWidth="1.5" strokeOpacity="0.14" strokeDasharray="3 7" />

      {/* ================= tumbleweed loop (new, subtle, CSS-driven) ================= */}
      <g className="cg-tumbleweed">
        <g transform="translate(0 0)">
          <g fill="#6f5a3c" opacity="0.6" stroke="#3e3221" strokeWidth="0.7">
            <circle cx="0" cy="0" r="9" />
            <circle cx="6" cy="-5" r="5" />
            <circle cx="-6" cy="-4" r="5" />
            <circle cx="7" cy="5" r="5" />
            <circle cx="-7" cy="4" r="5" />
            <circle cx="0" cy="7" r="4.5" />
            <circle cx="0" cy="-7" r="4.5" />
          </g>
          <path d="M0 0 L7 -3 M0 0 L-6 3 M0 0 L3 7 M0 0 L-3 -6" stroke="#3e3221" strokeWidth="0.8" opacity="0.6" strokeLinecap="round" fill="none" />
        </g>
      </g>
      <g className="cg-tumbleweed" style={{ animationDelay: '7.5s' }}>
        <g transform="translate(0 0)">
          <g fill="#6f5a3c" opacity="0.6" stroke="#3e3221" strokeWidth="0.7">
            <circle cx="0" cy="0" r="9" />
            <circle cx="6" cy="-5" r="5" />
            <circle cx="-6" cy="-4" r="5" />
            <circle cx="7" cy="5" r="5" />
            <circle cx="-7" cy="4" r="5" />
            <circle cx="0" cy="7" r="4.5" />
            <circle cx="0" cy="-7" r="4.5" />
          </g>
          <path d="M0 0 L7 -3 M0 0 L-6 3 M0 0 L3 7 M0 0 L-3 -6" stroke="#3e3221" strokeWidth="0.8" opacity="0.6" strokeLinecap="round" fill="none" />
        </g>
      </g>
      </svg>

      {/* falling leaves over the living side */}
      {HEALTHY_LEAVES.map((leaf, i) => (
        <span
          key={`leaf-${i}`}
          className="leaf-bit"
          style={{
            left: `${leaf.left}%`,
            width: leaf.size,
            height: Math.max(3, Math.round(leaf.size * 0.62)),
            background: i % 3 === 0 ? '#a5cba9' : '#77ad81',
            animationDuration: `${leaf.dur}s`,
            animationDelay: `${leaf.delay}s`,
            ['--drift']: `${leaf.drift}px`,
            ['--spin']: `${leaf.spin}deg`,
          }}
        />
      ))}

      {/* smoke over the withered side */}
      {WISPS.map((wisp, i) => (
        <span
          key={`wisp-${i}`}
          className="cg-wisp"
          style={{
            left: `${wisp.left}%`,
            width: wisp.w,
            height: wisp.h,
            animationDuration: `${wisp.dur}s`,
            animationDelay: `${wisp.delay}s`,
            ['--wisp-drift']: `${wisp.drift}px`,
            ['--wisp-color']: i === 1 ? 'rgb(160 120 82 / 0.42)' : 'rgb(178 140 96 / 0.5)',
          }}
        />
      ))}

      {/* legend — makes the before/after explicit */}
      <div className="absolute bottom-4 left-[3%] flex items-center gap-2 rounded-full border border-cream-50/15 bg-forest-950/45 px-3.5 py-1.5 backdrop-blur-md dark:border-white/20 sm:left-[5%]">
        <span className="h-1.5 w-1.5 rounded-full bg-leaf-300 animate-pulse-soft" />
        <span className="text-[0.62rem] font-bold uppercase tracking-[0.18em] text-cream-50/90 dark:text-[#fbfaf6]/90">
          Before <span className="text-cream-50/50 dark:text-[#fbfaf6]/60">·</span> thriving
        </span>
      </div>
      <div className="absolute bottom-4 right-[3%] flex items-center gap-2 rounded-full border border-cream-50/15 bg-forest-950/45 px-3.5 py-1.5 backdrop-blur-md dark:border-white/20 sm:right-[5%]">
        <span className="h-1.5 w-1.5 rounded-full bg-status-high animate-pulse-soft" />
        <span className="text-[0.62rem] font-bold uppercase tracking-[0.18em] text-cream-50/90 dark:text-[#fbfaf6]/90">
          After <span className="text-cream-50/50 dark:text-[#fbfaf6]/60">·</span> lost
        </span>
      </div>
    </div>
  );
}
