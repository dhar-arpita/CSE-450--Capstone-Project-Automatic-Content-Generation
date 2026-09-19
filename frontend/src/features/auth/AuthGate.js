import React, { useState } from "react";
import { Outlet } from "react-router-dom";
import LogoIntro, { prefersNoIntro } from "../../shared/brand/LogoIntro";

/* A layout route wrapping every auth page.

   Because the same element stays mounted while the child route changes, the
   logo animation plays when you arrive from the landing page — and not again
   when you move between the student, teacher and admin doors or hop to signup,
   which is what makes an intro charming the first time and grating the third. */
export default function AuthGate() {
  const [playing, setPlaying] = useState(() => !prefersNoIntro());

  return (
    <>
      {playing && <LogoIntro onFinish={() => setPlaying(false)} />}
      <div className={`au-reveal${playing ? "" : " is-in"}`}>
        <Outlet />
      </div>
    </>
  );
}
