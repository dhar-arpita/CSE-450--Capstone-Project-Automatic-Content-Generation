import React, { useCallback, useEffect, useRef, useState } from "react";
import { WORDMARK } from "./assets";
import "./logo-intro.css";

/* The tangram lockup assembling itself, on the way into the auth pages.

   This is drawn rather than played. The master video's artwork is only about
   311x146 real pixels once its anamorphic squeeze is undone, so on an ordinary
   retina laptop it was being scaled up roughly 2.7x and looked soft no matter
   how it was encoded — the detail simply is not in the file. The five triangles
   are exact geometry traced from the master artwork, and the wordmark is
   extracted from the 2000px master at full resolution with a real alpha
   channel, so the whole thing is crisp at any size and any pixel density.

   The choreography is not invented: each piece's entry offset, start time and
   travel were measured frame by frame off the original animation, so it moves
   the way the designed version moves. Coordinates are in the lockup's own
   space — 931 x 433, the bounding box of the artwork in the master. */

const PIECES = [
  // id       polygon points (lockup coordinates)                    fill       from        delay  dur
  { id: "sky",   pts: "365.3,99.8 464.2,1 462.2,197.5",              fill: "#5CE7FF", dx: -500, dy: -425, t: 0.32, d: 0.80 },
  { id: "sun",   pts: "479.1,1 547,69.8 479.1,69.8",                 fill: "#FFE533", dx: -503, dy: -374, t: 0.48, d: 0.64 },
  { id: "leaf",  pts: "245.6,1 457.2,213.5 241.6,429",               fill: "#7ED957", dx: -431, dy: -521, t: 0.64, d: 0.64 },
  { id: "coral", pts: "132.8,429 227.6,335.2 227.6,429",             fill: "#FC6467", dx: -344, dy:  491, t: 0.80, d: 0.64 },
  { id: "petal", pts: "1,0 226.6,0 226.6,228.5",                     fill: "#EF94CA", dx: -344, dy: -458, t: 0.96, d: 0.64 },
];

const WORD = { dx: 503, dy: -482, t: 0.64, d: 0.64 };

const SETTLE_MS = 1600;   // every piece has landed by here
const HOLD_MS = 420;      // let the assembled lockup sit still for a beat
const FADE_MS = 520;      // must match --intro-fade in logo-intro.css

export default function LogoIntro({ onFinish }) {
  const finished = useRef(false);
  const [leaving, setLeaving] = useState(false);

  const finish = useCallback(() => {
    if (finished.current) return;
    finished.current = true;
    setLeaving(true);
    setTimeout(onFinish, FADE_MS);
  }, [onFinish]);

  useEffect(() => {
    // Anyone who asked the OS for less motion gets the assembled mark briefly,
    // not a sequence of things flying across their screen.
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const timer = setTimeout(finish, still ? 700 : SETTLE_MS + HOLD_MS);

    const onKey = (e) => {
      if (e.key === "Escape" || e.key === "Enter" || e.key === " ") finish();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("keydown", onKey);
    };
  }, [finish]);

  return (
    <div
      className={`dhi-intro${leaving ? " is-leaving" : ""}`}
      onClick={finish}
      role="presentation"
    >
      <svg
        className="dhi-intro-art"
        viewBox="0 0 931 433"
        role="img"
        aria-label="Dhi AI"
      >
        {PIECES.map((p) => (
          <g
            key={p.id}
            className="dhi-pc"
            style={{
              "--dx": `${p.dx}px`,
              "--dy": `${p.dy}px`,
              animationDelay: `${p.t}s`,
              animationDuration: `${p.d}s`,
            }}
          >
            <polygon points={p.pts} fill={p.fill} />
          </g>
        ))}
        <g
          className="dhi-pc"
          style={{
            "--dx": `${WORD.dx}px`,
            "--dy": `${WORD.dy}px`,
            animationDelay: `${WORD.t}s`,
            animationDuration: `${WORD.d}s`,
          }}
        >
          <image href={WORDMARK} x="550" y="138" width="387" height="121" />
        </g>
      </svg>

      <button type="button" className="dhi-intro-skip" onClick={finish}>
        Skip
      </button>
    </div>
  );
}

/* Anyone who asked the OS for less motion should not be handed a splash. */
export function prefersNoIntro() {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}
