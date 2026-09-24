import React from "react";

const stroke = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.7,
  strokeLinecap: "round",
  strokeLinejoin: "round",
};

export const IconMail = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" {...stroke} aria-hidden="true">
    <rect x="3" y="5.5" width="18" height="13" rx="2.4" />
    <path d="m3.8 7 7.1 5.3a2 2 0 0 0 2.2 0L20.2 7" />
  </svg>
);

export const IconLock = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" {...stroke} aria-hidden="true">
    <rect x="4.5" y="10.5" width="15" height="9.5" rx="2.4" />
    <path d="M8.2 10.5V7.8a3.8 3.8 0 0 1 7.6 0v2.7" />
  </svg>
);

export const IconUser = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" {...stroke} aria-hidden="true">
    <circle cx="12" cy="8.4" r="3.6" />
    <path d="M4.8 20c.9-3.6 3.7-5.4 7.2-5.4s6.3 1.8 7.2 5.4" />
  </svg>
);

export const IconEye = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" {...stroke} aria-hidden="true">
    <path d="M2.6 12S6 5.8 12 5.8 21.4 12 21.4 12 18 18.2 12 18.2 2.6 12 2.6 12Z" />
    <circle cx="12" cy="12" r="2.9" />
  </svg>
);

export const IconEyeOff = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" {...stroke} aria-hidden="true">
    <path d="M9.6 6.3A8.9 8.9 0 0 1 12 6c6 0 9.4 6 9.4 6a16 16 0 0 1-3 3.7M6.5 8.1A16.3 16.3 0 0 0 2.6 12S6 18 12 18a9 9 0 0 0 3.2-.6" />
    <path d="m4 4 16 16" />
  </svg>
);

export const IconArrow = () => (
  <svg viewBox="0 0 24 24" width="16" height="16" {...stroke} strokeWidth="2.1" aria-hidden="true">
    <path d="M5 12h13M13 6l6 6-6 6" />
  </svg>
);

export const IconAlert = () => (
  <svg viewBox="0 0 24 24" width="17" height="17" {...stroke} aria-hidden="true">
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7.6v5M12 16.2h.01" />
  </svg>
);

export const IconSun = () => (
  <svg viewBox="0 0 24 24" width="17" height="17" {...stroke} strokeWidth="1.9" aria-hidden="true">
    <circle cx="12" cy="12" r="4.2" />
    <path d="M12 2.6v2.2M12 19.2v2.2M4.3 4.3l1.6 1.6M18.1 18.1l1.6 1.6M2.6 12h2.2M19.2 12h2.2M4.3 19.7l1.6-1.6M18.1 5.9l1.6-1.6" />
  </svg>
);

export const IconMoon = () => (
  <svg viewBox="0 0 24 24" width="17" height="17" {...stroke} strokeWidth="1.9" aria-hidden="true">
    <path d="M20 13.4A8.2 8.2 0 0 1 10.6 4a8.4 8.4 0 1 0 9.4 9.4Z" />
  </svg>
);

export const IconShield = () => (
  <svg viewBox="0 0 24 24" width="17" height="17" {...stroke} aria-hidden="true">
    <path d="M12 3.2 5 6v5.6c0 4 2.9 7.5 7 9.2 4.1-1.7 7-5.2 7-9.2V6l-7-2.8Z" />
    <path d="m9.2 12.1 2 2 3.6-3.9" />
  </svg>
);

/* ── added for the app shell and the dashboard ── */

export const IconHome = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" {...stroke} aria-hidden="true">
    <path d="M3.6 10.4 12 3.8l8.4 6.6V19a1.4 1.4 0 0 1-1.4 1.4h-4.2v-5.6H9.2v5.6H5a1.4 1.4 0 0 1-1.4-1.4Z" />
  </svg>
);

export const IconSheet = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" {...stroke} aria-hidden="true">
    <path d="M7 3h7l5 5v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z" />
    <path d="M14 3v5h5M9.5 13h6M9.5 16.5h4" />
  </svg>
);

export const IconQuiz = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" {...stroke} aria-hidden="true">
    <circle cx="12" cy="12" r="9" />
    <path d="M9.4 9.3a2.7 2.7 0 0 1 5.2.9c0 1.8-2.6 2.1-2.6 3.8" />
    <path d="M12 17.4h.01" />
  </svg>
);

export const IconNotes = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" {...stroke} aria-hidden="true">
    <path d="M5 4.8C7 3.6 9.6 3.6 12 4.9c2.4-1.3 5-1.3 7 0v13.4c-2-1.3-4.6-1.3-7 0-2.4-1.3-5-1.3-7 0Z" />
    <path d="M12 4.9v13.4" />
  </svg>
);

export const IconUpload = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" {...stroke} aria-hidden="true">
    <path d="M4 14.5V18a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3.5" />
    <path d="M12 15.2V3.8M8.2 7.6 12 3.8l3.8 3.8" />
  </svg>
);

export const IconChatbot = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" {...stroke} aria-hidden="true">
    <rect x="3.5" y="6.5" width="17" height="12" rx="3" />
    <path d="M12 6.5V3.8M9 12.2v.01M15 12.2v.01" />
    <path d="M8.6 15.6c1 .9 5.8.9 6.8 0" />
  </svg>
);

export const IconGlobe = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" {...stroke} aria-hidden="true">
    <circle cx="12" cy="12" r="9" />
    <path d="M3 12h18M12 3c2.6 2.6 2.6 15.4 0 18M12 3c-2.6 2.6-2.6 15.4 0 18" />
  </svg>
);

export const IconLogout = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" {...stroke} aria-hidden="true">
    <path d="M14.5 4.5H18A1.5 1.5 0 0 1 19.5 6v12a1.5 1.5 0 0 1-1.5 1.5h-3.5" />
    <path d="M10 15.5 13.5 12 10 8.5M13.5 12H4.5" />
  </svg>
);

export const IconMenu = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" {...stroke} strokeWidth="1.9" aria-hidden="true">
    <path d="M4 7h16M4 12h16M4 17h16" />
  </svg>
);

export const IconClose = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" {...stroke} strokeWidth="1.9" aria-hidden="true">
    <path d="m6 6 12 12M18 6 6 18" />
  </svg>
);

export const IconSpark = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" {...stroke} aria-hidden="true">
    <path d="M12 3.5 13.7 9l5.5 1.7-5.5 1.7L12 18l-1.7-5.6L4.8 10.7 10.3 9 12 3.5Z" />
  </svg>
);

export const IconBolt = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" {...stroke} aria-hidden="true">
    <path d="M13.2 2.6 5 13.4h5.6L10.8 21.4 19 10.6h-5.6l-.2-8Z" />
  </svg>
);

export const IconRocket = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" {...stroke} aria-hidden="true">
    <path d="M12 2.5c2.6 1.8 4.2 4.8 4.2 8.4 0 2.4-.7 4.6-1.9 6.4L12 21l-2.3-3.7c-1.2-1.8-1.9-4-1.9-6.4 0-3.6 1.6-6.6 4.2-8.4Z" />
    <circle cx="12" cy="10" r="1.6" />
    <path d="M8.3 15.8 5.6 17.5l.4-3.3M15.7 15.8l2.7 1.7-.4-3.3" />
  </svg>
);

export const IconTrendUp = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" {...stroke} aria-hidden="true">
    <path d="M3.5 16.5 9 11l4 3.5L20.5 6" />
    <path d="M15 6h5.5v5.5" />
  </svg>
);

export const IconTrophy = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" {...stroke} aria-hidden="true">
    <path d="M7 4h10v4.2c0 2.9-2.2 5.3-5 5.6-2.8-.3-5-2.7-5-5.6V4Z" />
    <path d="M7 5.5H4.6C4.3 5.5 4 5.8 4 6.1c0 2 1.6 3.6 3.6 3.6M17 5.5h2.4c.3 0 .6.3.6.6 0 2-1.6 3.6-3.6 3.6" />
    <path d="M12 13.8V17M9 20h6M9.5 17h5" />
  </svg>
);

export const IconDownload = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" {...stroke} aria-hidden="true">
    <path d="M4 15.5V18a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2.5" />
    <path d="M12 3.8v11.4M8.2 11.4 12 15.2l3.8-3.8" />
  </svg>
);

export const IconCheck = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" {...stroke} strokeWidth="2.2" aria-hidden="true">
    <path d="m5 12.5 4.5 4.5L19 7.5" />
  </svg>
);

export const IconPlus = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" {...stroke} strokeWidth="2" aria-hidden="true">
    <path d="M12 5v14M5 12h14" />
  </svg>
);

export const IconMinus = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" {...stroke} strokeWidth="2" aria-hidden="true">
    <path d="M5 12h14" />
  </svg>
);

export const IconSliders = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" {...stroke} aria-hidden="true">
    <path d="M5 20v-7M5 9V4M12 20v-9M12 7V4M19 20v-4M19 12V4" />
    <path d="M2.8 13h4.4M9.8 11h4.4M16.8 16h4.4" />
  </svg>
);

export const IconChart = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" {...stroke} aria-hidden="true">
    <path d="M4 20h16" />
    <path d="M7 20v-6M12 20V7M17 20v-9" />
  </svg>
);

export const IconPuzzle = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" {...stroke} aria-hidden="true">
    <path d="M4 10h2.2a2.3 2.3 0 1 1 4.6 0H13v2.2a2.3 2.3 0 1 0 0 4.6V19H4Z" />
    <path d="M13 10h6v3.2a2.3 2.3 0 1 1 0 4.6V19" />
  </svg>
);

export const IconBell = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" {...stroke} aria-hidden="true">
    <path d="M18 8.6a6 6 0 1 0-12 0c0 5-2 6.4-2 6.4h16s-2-1.4-2-6.4Z" />
    <path d="M13.7 19a2 2 0 0 1-3.4 0" />
  </svg>
);

export const IconUser2 = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" {...stroke} aria-hidden="true">
    <circle cx="12" cy="8.4" r="3.6" />
    <path d="M4.8 20c.9-3.6 3.7-5.4 7.2-5.4s6.3 1.8 7.2 5.4" />
  </svg>
);

export const IconCalendar = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" {...stroke} aria-hidden="true">
    <rect x="3.5" y="5" width="17" height="15" rx="2.4" />
    <path d="M3.5 9.6h17M8.5 3.2v3.4M15.5 3.2v3.4" />
  </svg>
);

/* A mortarboard — the class a student belongs to, on the signup form. */
export const IconSchool = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" {...stroke} aria-hidden="true">
    <path d="M12 4.2 2.8 8.6 12 13l9.2-4.4L12 4.2Z" />
    <path d="M6.4 10.6v4.6c0 1.6 2.5 2.9 5.6 2.9s5.6-1.3 5.6-2.9v-4.6" />
    <path d="M21.2 8.6v5" />
  </svg>
);

export const IconChevronDown = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" {...stroke} aria-hidden="true">
    <path d="m6.5 9.8 5.5 5.2 5.5-5.2" />
  </svg>
);

/* ── admin console ─────────────────────────────────────────────────────── */

export const IconUsers = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" {...stroke} aria-hidden="true">
    <circle cx="9.2" cy="8.4" r="3.4" />
    <path d="M2.8 19.4c.8-3.3 3.4-5 6.4-5s5.6 1.7 6.4 5" />
    <path d="M16.4 5.4a3.4 3.4 0 0 1 0 6.1M18 14.8c2 .6 3.3 2.1 3.8 4.6" />
  </svg>
);

/* A trace with one spike — the job queue's pulse. */
export const IconPulse = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" {...stroke} aria-hidden="true">
    <path d="M2.8 12.6h4.1l2.3-6.4 3.6 12.2 2.4-5.8h6" />
  </svg>
);

/* Stacked sheets — the curriculum, chapter on chapter. */
export const IconLayers = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" {...stroke} aria-hidden="true">
    <path d="m12 3.2 8.6 4.3-8.6 4.3-8.6-4.3 8.6-4.3Z" />
    <path d="m3.4 12.4 8.6 4.3 8.6-4.3M3.4 16.9l8.6 4.3 8.6-4.3" />
  </svg>
);

export const IconSearch = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" {...stroke} aria-hidden="true">
    <circle cx="10.8" cy="10.8" r="6.4" />
    <path d="m15.6 15.6 4.2 4.2" />
  </svg>
);

export const IconTrash = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" {...stroke} aria-hidden="true">
    <path d="M4.6 6.6h14.8M9.4 6.6V4.9c0-.6.5-1.1 1.1-1.1h3c.6 0 1.1.5 1.1 1.1v1.7" />
    <path d="M6.6 6.6 7.7 19a1.6 1.6 0 0 0 1.6 1.4h5.4A1.6 1.6 0 0 0 16.3 19L17.4 6.6" />
  </svg>
);

export const IconUndo = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" {...stroke} aria-hidden="true">
    <path d="M4.2 9.4h7.2a5.6 5.6 0 1 1 0 11.2H7.6" />
    <path d="m4.2 9.4 4-4M4.2 9.4l4 4" />
  </svg>
);

/* A circle with a slice cut out — the share one group holds of the whole. */
export const IconShare = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" {...stroke} aria-hidden="true">
    <circle cx="12" cy="12" r="8.4" />
    <path d="M12 3.6V12l6.6 5.2" />
  </svg>
);
