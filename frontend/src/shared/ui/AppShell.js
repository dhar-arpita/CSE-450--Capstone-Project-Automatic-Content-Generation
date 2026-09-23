import React, { useState } from "react";
import { Link, NavLink } from "react-router-dom";
import BrandLogo from "../brand/BrandLogo";
import NotificationBell from "./NotificationBell";
import TeenDoodles from "./TeenDoodles";
import { useI18n } from "../i18n";
import { useTheme } from "../theme";
import {
  IconChatbot, IconClose, IconGlobe, IconHome, IconLogout, IconMenu, IconMoon,
  IconNotes, IconQuiz, IconSheet, IconSun, IconUpload, IconUser2,
} from "./icons";
import "./AppShell.css";

/* The signed-in chrome: fixed left rail, top bar, working column, footer.
   Every page inside the app renders through this, so the navigation, the
   language switch and the theme switch can never drift apart between pages.

   Pages supply their own breadcrumb and content; an optional `rail` fills the
   right-hand column, and when it is absent the working column takes the full
   width. */

export const APP_NAV = [
  { to: "/dashboard", key: "dashboard", Icon: IconHome, end: true },
  { to: "/generate", key: "worksheet", Icon: IconSheet },
  { to: "/quiz", key: "quiz", Icon: IconQuiz },
  { to: "/study-notes", key: "notes", Icon: IconNotes },
  { to: "/upload", key: "upload", Icon: IconUpload },
  { to: "/profile", key: "profile", Icon: IconUser2 },
];

/* Students get the same chrome as teachers, but they can't upload their own
   material — that slot becomes the practice chatbot instead. */
export const STUDENT_NAV = [
  { to: "/dashboard", key: "dashboard", Icon: IconHome, end: true },
  { to: "/generate", key: "worksheet", Icon: IconSheet },
  { to: "/quiz", key: "quiz", Icon: IconQuiz },
  { to: "/study-notes", key: "notes", Icon: IconNotes },
  { to: "/chatbot", key: "chatbot", Icon: IconChatbot },
  { to: "/profile", key: "profile", Icon: IconUser2 },
];

/* `nav` and `home` exist so the admin console can reuse this chrome with its
   own destinations instead of forking the shell. A nav item may carry a
   ready-made `label`; otherwise its `key` is looked up under app.nav, which is
   how the teacher nav above has always worked.

   When a page doesn't pass `nav` explicitly, the rail picks it from the
   signed-in user's role — so every shared page (worksheet, quiz, notes,
   profile) shows the right rail for whoever is looking at it, not just the
   dashboard. */
export default function AppShell({
  breadcrumb, user, onLogout, rail, tone, width, children,
  nav, home = "/dashboard",
}) {
  const { t, lang, toggleLang } = useI18n();
  const { theme, toggleTheme } = useTheme();
  const [navOpen, setNavOpen] = useState(false);

  const closeNav = () => setNavOpen(false);
  const initial = user?.name?.charAt(0)?.toUpperCase() || "U";
  const isStudent = user?.role === "student";
  const resolvedNav = nav || (isStudent ? STUDENT_NAV : APP_NAV);

  return (
    <div className={`as${tone ? ` as-tone-${tone}` : ""}${isStudent ? " is-student" : ""}${navOpen ? " is-nav-open" : ""}`}>
      <aside className="as-side">
        <div className="as-side-top">
          <BrandLogo to={home} />
        </div>

        <nav className="as-nav" aria-label={t("app.nav.dashboard")}>
          {resolvedNav.map(({ to, key, Icon, end, label }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              onClick={closeNav}
              className={({ isActive }) => `as-nav-item${isActive ? " is-active" : ""}`}
            >
              <Icon />
              {label || t(`app.nav.${key}`)}
            </NavLink>
          ))}
        </nav>

        <div className="as-side-foot">
          {/* The theme control is icon-only on purpose: a visible label would
              mean inventing copy in two languages for a toggle whose meaning
              the icon already carries. */}
          <div className="as-side-row">
            <button type="button" className="as-nav-item" onClick={toggleLang}>
              <IconGlobe />
              {lang === "bn" ? "English" : "বাংলা"}
            </button>
            <button
              type="button"
              className="as-icon-btn"
              onClick={toggleTheme}
              title={theme === "dark" ? t("a11y.toLight") : t("a11y.toDark")}
              aria-label={theme === "dark" ? t("a11y.toLight") : t("a11y.toDark")}
            >
              {theme === "dark" ? <IconSun /> : <IconMoon />}
            </button>
          </div>
          <button type="button" className="as-nav-item is-danger" onClick={onLogout}>
            <IconLogout />
            {t("app.logout")}
          </button>
        </div>
      </aside>

      {navOpen && (
        <button
          type="button"
          className="as-scrim"
          aria-label={t("app.closeMenu")}
          onClick={closeNav}
        />
      )}

      <div className="as-body">
        {isStudent && <TeenDoodles />}
        <header className="as-top">
          <button
            type="button"
            className="as-burger"
            onClick={() => setNavOpen((v) => !v)}
            aria-label={t("app.menu")}
            aria-expanded={navOpen}
          >
            {navOpen ? <IconClose /> : <IconMenu />}
          </button>

          <p className="as-crumb">
            <IconHome />
            <span className="as-crumb-sep">/</span>
            <strong>{breadcrumb}</strong>
          </p>

          <div className="as-top-right">
            <NotificationBell />
            {/* The chip is the way to the profile from anywhere in the app. */}
            <Link className="as-user" to={user?.role === "admin" ? home : "/profile"}>
              <span className="as-avatar">{initial}</span>
              <span className="as-user-text">
                <span className="as-user-name">{user?.name || "—"}</span>
                <span className="as-user-role">{user?.role || ""}</span>
              </span>
            </Link>
          </div>
        </header>

        <div className={`as-grid${rail ? "" : " is-wide"}${width === "full" ? " is-full" : ""}`}>
          <main className="as-main">{children}</main>
          {rail && <aside className="as-rail">{rail}</aside>}
        </div>

        <footer className="as-foot">{t("app.footer")}</footer>
      </div>
    </div>
  );
}
