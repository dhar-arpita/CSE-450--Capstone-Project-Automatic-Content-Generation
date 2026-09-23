import React from "react";
import "./teen-theme.css";

/* A handful of hand-drawn-style line icons that float gently behind the
   content on student-facing pages — the same stroke language as the rest of
   the icon set, just decorative, low-opacity, and animated. Purely visual:
   aria-hidden and pointer-events: none throughout, so it never gets in the
   way of the actual UI. */
const stroke = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.5,
  strokeLinecap: "round",
  strokeLinejoin: "round",
};

const Rocket = () => (
  <svg viewBox="0 0 24 24" width="42" height="42" {...stroke}>
    <path d="M12 2.5c3 2 4.2 5.4 3.6 9.8l-1.8 2.2h-3.6l-1.8-2.2C7.8 7.9 9 4.5 12 2.5Z" />
    <circle cx="12" cy="9" r="1.6" />
    <path d="M9 13.2 6.5 15v3l2.5-1.6M15 13.2 17.5 15v3L15 16.4" />
    <path d="M10.4 17.5 9.5 21l2.5-1.3L14.5 21l-.9-3.5" />
  </svg>
);

const Sparkle = () => (
  <svg viewBox="0 0 24 24" width="34" height="34" {...stroke}>
    <path d="M12 2.5c.5 4 2.7 6.3 6.8 6.8-4.1.5-6.3 2.7-6.8 6.8-.5-4.1-2.7-6.3-6.8-6.8 4.1-.5 6.3-2.8 6.8-6.8Z" />
    <path d="M19 17.5c.2 1.6 1 2.4 2.6 2.6-1.6.2-2.4 1-2.6 2.6-.2-1.6-1-2.4-2.6-2.6 1.6-.2 2.4-1 2.6-2.6Z" />
  </svg>
);

const Kite = () => (
  <svg viewBox="0 0 24 24" width="40" height="40" {...stroke}>
    <path d="M12 2.5 19 12l-7 9.5L5 12Z" />
    <path d="M5 12h14M12 2.5v19" />
    <path d="M12 21.5 9 24M12 21.5l3 2.5" opacity=".7" />
  </svg>
);

const Pencil = () => (
  <svg viewBox="0 0 24 24" width="36" height="36" {...stroke}>
    <path d="m4 20 1-4.6L15.4 5 19 8.6 8.6 19 4 20Z" />
    <path d="m13 7 4 4M4 20l1.6-.4" />
  </svg>
);

const Book = () => (
  <svg viewBox="0 0 24 24" width="40" height="40" {...stroke}>
    <path d="M3.6 5.3C5.6 4.1 8 4.1 10 5.2c2-1.1 4.4-1.1 6.4 0v11.9c-2-1.1-4.4-1.1-6.4 0-2-1.1-4.4-1.1-6.4 0Z" />
    <path d="M10 5.2v11.9" />
  </svg>
);

const Bulb = () => (
  <svg viewBox="0 0 24 24" width="34" height="34" {...stroke}>
    <path d="M9 17.5h6M9.6 21h4.8" />
    <path d="M12 3.2a5.6 5.6 0 0 0-3.3 10.1c.7.5 1.1 1.3 1.1 2.2h4.4c0-.9.4-1.7 1.1-2.2A5.6 5.6 0 0 0 12 3.2Z" />
  </svg>
);

const DOODLES = [
  { Icon: Rocket, className: "td td-1" },
  { Icon: Sparkle, className: "td td-2" },
  { Icon: Kite, className: "td td-3" },
  { Icon: Pencil, className: "td td-4" },
  { Icon: Book, className: "td td-5" },
  { Icon: Bulb, className: "td td-6" },
];

export default function TeenDoodles() {
  return (
    <div className="teen-doodles" aria-hidden="true">
      {DOODLES.map(({ Icon, className }, i) => (
        <span className={className} key={i}><Icon /></span>
      ))}
    </div>
  );
}
