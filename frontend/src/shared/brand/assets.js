/* One place that knows where the brand files live. They sit in public/ rather
   than being imported through webpack because the same paths are referenced
   from public/index.html (favicon, og:image) where imports are not available. */
export const LOGO_MARK = "/brand/logo-mark.png";
/* The animated splash is drawn, not played — see LogoIntro. The wordmark is the
   one part that cannot be expressed as geometry, so it ships as a full-resolution
   cut-out of the master artwork with a real alpha channel. */
export const WORDMARK = "/brand/wordmark.png";

/* Not referenced by any component:
     public/brand/logo-lockup.png      the flat bird + wordmark, for og:image
     public/videos/logo.mp4 + poster   the original film
   The film is kept as the team's own asset but is no longer played anywhere —
   its artwork is ~311x146 real pixels, which cannot stay sharp on a retina
   screen. LogoIntro draws the mark instead. Masters live in src/assets/. */
