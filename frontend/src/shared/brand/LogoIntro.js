import React, { useCallback, useEffect, useRef, useState } from "react";
import { LOGO_FILM, LOGO_FILM_REST } from "./assets";
import "./logo-intro.css";

const HOLD_AFTER_END = 320;   // let the assembled bird sit still for a beat
const FADE_MS = 520;          // must match --intro-fade in logo-intro.css
const SAFETY_MS = 4200;       // decode failures must never trap the user

/* The 2s tangram animation that plays on the way into the auth pages.

   The overlay is painted the same violet as the video itself, so the 1:1 film
   has no visible edge — it reads as the whole screen animating rather than a
   video box sitting on a background. */
export default function LogoIntro({ onFinish }) {
  const videoRef = useRef(null);
  const finished = useRef(false);
  const [leaving, setLeaving] = useState(false);

  const finish = useCallback(() => {
    if (finished.current) return;
    finished.current = true;
    setLeaving(true);
    setTimeout(onFinish, FADE_MS);
  }, [onFinish]);

  const handleEnded = useCallback(() => {
    setTimeout(finish, HOLD_AFTER_END);
  }, [finish]);

  useEffect(() => {
    const video = videoRef.current;
    const safety = setTimeout(finish, SAFETY_MS);

    // Autoplay is allowed for muted inline video, but a locked-down browser or
    // low-power mode can still refuse; skipping beats staring at a still frame.
    const started = video && video.play();
    if (started && typeof started.catch === "function") started.catch(finish);

    const onKey = (e) => {
      if (e.key === "Escape" || e.key === "Enter" || e.key === " ") finish();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      clearTimeout(safety);
      window.removeEventListener("keydown", onKey);
    };
  }, [finish]);

  return (
    <div
      className={`dhi-intro${leaving ? " is-leaving" : ""}`}
      onClick={finish}
      role="presentation"
    >
      <video
        ref={videoRef}
        className="dhi-intro-film"
        poster={LOGO_FILM_REST}
        muted
        playsInline
        autoPlay
        preload="auto"
        onEnded={handleEnded}
        aria-hidden="true"
      >
        <source src={LOGO_FILM} type="video/mp4" />
      </video>
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
