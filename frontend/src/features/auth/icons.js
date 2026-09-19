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
