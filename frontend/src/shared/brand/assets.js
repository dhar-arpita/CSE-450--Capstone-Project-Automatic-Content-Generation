/* One place that knows where the brand files live. They sit in public/ rather
   than being imported through webpack because the same paths are referenced
   from public/index.html (favicon, og:image) where imports are not available. */
export const LOGO_MARK = "/brand/logo-mark.png";
export const LOGO_LOCKUP = "/brand/logo-lockup.png";
export const LOGO_FILM = "/videos/logo.mp4";
export const LOGO_FILM_REST = "/videos/logo-poster.jpg";
