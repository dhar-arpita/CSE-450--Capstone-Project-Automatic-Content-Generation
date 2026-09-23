import React, { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import BrandLogo from "../brand/BrandLogo";
import { useI18n } from "../i18n";
import { useTheme } from "../theme";
import "./AppNav.css";

/* ── icons (inline so AppNav has no icon-file dependency) ────────────── */
function IconSun() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"
      aria-hidden="true">
      <circle cx="12" cy="12" r="4" />
      <line x1="12" y1="2" x2="12" y2="4" />
      <line x1="12" y1="20" x2="12" y2="22" />
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
      <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
      <line x1="2" y1="12" x2="4" y2="12" />
      <line x1="20" y1="12" x2="22" y2="12" />
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
      <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
    </svg>
  );
}

function IconMoon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"
      aria-hidden="true">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  );
}

function IconChevron() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"
      aria-hidden="true">
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

function IconLogout() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"
      aria-hidden="true">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  );
}

/* ── AccountMenu ─────────────────────────────────────────────────────── */
function AccountMenu({ user, onLogout, t }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  /* close on outside click */
  useEffect(() => {
    if (!open) return;
    function handler(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  /* close on Escape */
  useEffect(() => {
    if (!open) return;
    function handler(e) { if (e.key === "Escape") setOpen(false); }
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open]);

  const initial = user?.name ? user.name[0].toUpperCase() : "?";

  return (
    <div className="an-account" ref={ref}>
      <button
        type="button"
        className="an-avatar"
        onClick={() => setOpen((v) => !v)}
        aria-label={t("nav.accountMenu")}
        aria-expanded={open}
        aria-haspopup="true"
      >
        <span className="an-avatar-initial" aria-hidden="true">{initial}</span>
        {/* <span className="an-avatar-name">{user?.name?.[0]}</span> */}
        <IconChevron />
      </button>

      {open && (
        <div className="an-menu" role="menu">
          <div className="an-menu-header">
            <span className="an-menu-name">{user?.name}</span>
            <span className="an-menu-email">{user?.email}</span>
          </div>
          <div className="an-menu-divider" />
          <button
            type="button"
            className="an-menu-item"
            role="menuitem"
            onClick={() => { setOpen(false); onLogout(); }}
          >
            <IconLogout />
            <span>{t("nav.logout")}</span>
          </button>
        </div>
      )}
    </div>
  );
}

/* ── Breadcrumb ──────────────────────────────────────────────────────── */
/**
 * crumbs — array of { label, to? }
 * Last item is the current page (no link).
 */
function Breadcrumb({ crumbs }) {
  if (!crumbs || crumbs.length === 0) return null;
  return (
    <nav className="an-breadcrumb" aria-label="breadcrumb">
      <ol className="an-breadcrumb-list">
        {crumbs.map((c, i) => {
          const isLast = i === crumbs.length - 1;
          return (
            <li key={i} className="an-breadcrumb-item">
              {!isLast && c.to ? (
                <a className="an-breadcrumb-link" href={c.to}>{c.label}</a>
              ) : (
                <span className={isLast ? "an-breadcrumb-current" : "an-breadcrumb-link"}
                  aria-current={isLast ? "page" : undefined}>
                  {c.label}
                </span>
              )}
              {!isLast && <span className="an-breadcrumb-sep" aria-hidden="true">/</span>}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

/* ── AppNav (exported) ───────────────────────────────────────────────── */
/**
 * Props:
 *   crumbs      — array of { label, to? } for breadcrumb (optional)
 *   logoTo      — where the logo links (default "/dashboard")
 *   transparent — if true, nav has no bottom border (for hero pages)
 */
export default function AppNav({ crumbs, logoTo = "/dashboard", transparent = false }) {
  const { t, lang, toggleLang } = useI18n();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();

  /* read user from localStorage — same pattern as ProtectedRoute */
  const user = React.useMemo(() => {
    try { return JSON.parse(localStorage.getItem("user")); }
    catch { return null; }
  }, []);

  function handleLogout() {
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    localStorage.removeItem("user");
    navigate("/login");
  }

  return (
    <header className={`an${transparent ? " an-transparent" : ""}`}>
      <div className="an-inner">
        {/* left: logo + breadcrumb */}
        <div className="an-left">
          <BrandLogo to={logoTo} />
          <Breadcrumb crumbs={crumbs} />
        </div>

        {/* right: tools */}
        <div className="an-tools">
          {/* language toggle */}
          <button
            type="button"
            className="an-chip"
            onClick={toggleLang}
            aria-label={lang === "bn" ? t("a11y.toEnglish") : t("a11y.toBangla")}
          >
            {lang === "bn" ? "EN" : "বাং"}
          </button>

          {/* theme toggle */}
          <button
            type="button"
            className="an-chip an-chip-icon"
            onClick={toggleTheme}
            aria-label={theme === "dark" ? t("a11y.toLight") : t("a11y.toDark")}
          >
            {theme === "dark" ? <IconSun /> : <IconMoon />}
          </button>

          {/* account menu */}
          {user && (
            <AccountMenu user={user} onLogout={handleLogout} t={t} />
          )}
        </div>
      </div>
    </header>
  );
}