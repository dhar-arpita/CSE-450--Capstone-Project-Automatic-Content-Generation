import React from "react";
import DhiMark from "../../shared/brand/DhiMark";

/* Hand-drawn line art rather than stock illustration: a consistent 1.6px
   stroke, no fills, nothing photographic. At low opacity the clusters read as
   engraving on the panel instead of decoration stuck on top of it. */

const line = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round",
  strokeLinejoin: "round",
};

/* Deterministic scatter — a seeded loop keeps the same sky on every render,
   so the panel does not shimmer when React re-renders the form beside it. */
const STARS = (() => {
  const out = [];
  let seed = 20260920;
  const rand = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
  for (let i = 0; i < 46; i += 1) {
    out.push({
      cx: Math.round(rand() * 560),
      cy: Math.round(rand() * 820),
      r: Number((0.8 + rand() * 1.7).toFixed(1)),
      o: Number((0.18 + rand() * 0.55).toFixed(2)),
    });
  }
  return out;
})();

export function StudentScene() {
  return (
    <svg
      className="au-scene-svg"
      viewBox="0 0 560 820"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
    >
      {STARS.map((s, i) => (
        <circle key={i} cx={s.cx} cy={s.cy} r={s.r} fill="#fff" opacity={s.o} />
      ))}

      {/* orbits */}
      <g stroke="#fff" fill="none" opacity=".12">
        <ellipse cx="300" cy="392" rx="250" ry="176" strokeWidth="1.2" />
        <ellipse cx="300" cy="392" rx="180" ry="250" strokeWidth="1.2" transform="rotate(24 300 392)" />
      </g>

      {/* the flight path the bird is riding */}
      <path
        d="M52 640C150 560 168 392 300 350c112-36 176-104 204-196"
        fill="none"
        stroke="#5CE7FF"
        strokeWidth="1.6"
        strokeDasharray="2 9"
        strokeLinecap="round"
        opacity=".5"
      />

      <g transform="translate(196 330) scale(.38)">
        <DhiMark />
      </g>

      {/* question in a bubble */}
      <g transform="translate(64 156)" stroke="#EF94CA" opacity=".72" {...line}>
        <path d="M6 4h74a6 6 0 0 1 6 6v40a6 6 0 0 1-6 6H36l-16 16V56h-14a6 6 0 0 1-6-6V10a6 6 0 0 1 6-6Z" />
        <path d="M34 22a10 10 0 0 1 19 3c0 6.5-9.5 7.6-9.5 13.8" />
        <path d="M43.5 45.5h.01" />
      </g>

      {/* idea */}
      <g transform="translate(404 130)" stroke="#FFE533" opacity=".72" {...line}>
        <path d="M22 44a18 18 0 1 1 20 0v8H22v-8Z" />
        <path d="M24 58h16M27 65h10" />
        <path d="M32 6V0M50 14l4.5-4.5M14 14 9.5 9.5M60 30h6M-2 30h6" />
      </g>

      {/* reaching the top */}
      <g transform="translate(414 570)" stroke="#7ED957" opacity=".7" {...line}>
        <path d="M16 6h36v22a18 18 0 0 1-36 0V6Z" />
        <path d="M16 11H6v6a10 10 0 0 0 10 10M52 11h10v6a10 10 0 0 1-10 10" />
        <path d="M30 48h8v10h-8zM20 62h28" />
      </g>

      {/* the piece that fits */}
      <g transform="translate(52 430)" stroke="#5CE7FF" opacity=".64" {...line}>
        <path d="M4 22h14a9 9 0 1 1 18 0h14v14a9 9 0 1 0 0 18H36v14H22a9 9 0 1 0-18 0V22Z" />
      </g>

      {/* a small star, drawn not filled */}
      <g transform="translate(466 328)" stroke="#fff" opacity=".4" {...line}>
        <path d="M18 2 23 14l13 1.6-9.6 8.8 2.7 12.9L18 30.7 6.9 37.3 9.6 24.4 0 15.6 13 14 18 2Z" />
      </g>
    </svg>
  );
}

/* The frieze behind the teacher card. One component, mirrored by CSS on the
   right-hand side, so the two clusters are never quite the same shape. */
export function DeskScene() {
  return (
    <svg
      className="au-frieze-svg"
      viewBox="0 0 320 620"
      preserveAspectRatio="xMidYMid meet"
      aria-hidden="true"
    >
      <g {...line}>
        {/* stack of books */}
        <g transform="translate(28 452)">
          <path d="M4 60h108v14H4zM12 44h100v16H12zM22 28h84v16H22z" />
          <path d="M18 67h20M26 51h22M34 35h18" />
        </g>

        {/* chalkboard on a stand */}
        <g transform="translate(36 96)">
          <rect x="0" y="0" width="184" height="126" rx="8" />
          <path d="M18 34h62M18 54h96M18 74h44" />
          <path d="M126 96 148 58l24 38z" />
          <path d="M92 126v42M56 186l36-18 36 18" />
        </g>

        {/* globe */}
        <g transform="translate(196 276)">
          <circle cx="40" cy="40" r="38" />
          <path d="M2 40h76M40 2c14 11 14 65 0 76M40 2C26 13 26 67 40 78" />
          <path d="M40 78v16M22 100h36" />
        </g>

        {/* pencils in a cup */}
        <g transform="translate(34 288)">
          <path d="M10 34h56l-7 52a6 6 0 0 1-6 5H23a6 6 0 0 1-6-5l-7-52Z" />
          <path d="M26 34V8l8-8 8 8v26M50 34V14" />
        </g>

        {/* paper plane */}
        <g transform="translate(212 84)">
          <path d="M2 30 74 2 52 72 38 46 2 30Z" />
          <path d="m38 46 36-44" />
        </g>

        {/* clock */}
        <g transform="translate(218 500)">
          <circle cx="34" cy="34" r="30" />
          <path d="M34 16v20l13 8" />
        </g>
      </g>
    </svg>
  );
}
