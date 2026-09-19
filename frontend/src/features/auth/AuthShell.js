import React from "react";
import { Link } from "react-router-dom";
import BrandLogo from "../../shared/brand/BrandLogo";
import DhiMark from "../../shared/brand/DhiMark";
import { useI18n } from "../../shared/i18n";
import { useTheme } from "../../shared/theme";
import { IconMoon, IconShield, IconSun } from "./icons";
import { DeskScene, StudentScene } from "./scenes";
import "./auth.css";

/* One bar, three skins. On the student page it floats over the light half, on
   the teacher page it is the page's navigation, and on the admin page it sits
   above the console frame. Keeping it in one component means the logo, the
   language switch and the theme switch can never drift apart between pages. */
function TopBar({ cta }) {
  const { t, lang, toggleLang } = useI18n();
  const { theme, toggleTheme } = useTheme();

  return (
    <header className="au-top">
      <BrandLogo to="/" />
      <div className="au-top-tools">
        <Link className="au-top-link" to="/">{t("auth.explore")}</Link>
        <button
          type="button"
          className="au-chip"
          onClick={toggleLang}
          aria-label={lang === "bn" ? t("a11y.toEnglish") : t("a11y.toBangla")}
        >
          {lang === "bn" ? "EN" : "বাং"}
        </button>
        <button
          type="button"
          className="au-chip au-chip-icon"
          onClick={toggleTheme}
          aria-label={theme === "dark" ? t("a11y.toLight") : t("a11y.toDark")}
        >
          {theme === "dark" ? <IconSun /> : <IconMoon />}
        </button>
        {cta && <Link className="au-top-cta" to={cta.to}>{cta.label}</Link>}
      </div>
    </header>
  );
}

function Copy({ eyebrow, title, lede }) {
  return (
    <div className="au-copy">
      {eyebrow && <p className="au-eyebrow">{eyebrow}</p>}
      <h1 className="au-title">{title}</h1>
      {lede && <p className="au-lede">{lede}</p>}
    </div>
  );
}

export default function AuthShell({
  variant = "teacher",
  eyebrow,
  title,
  lede,
  points,
  note,
  cta,
  footer,
  children,
}) {
  const copy = <Copy eyebrow={eyebrow} title={title} lede={lede} />;

  if (variant === "student") {
    return (
      <div className="au au-student">
        <div className="au-stage">
          <TopBar cta={cta} />
          <div className="au-stage-inner">
            {copy}
            {children}
            {footer}
          </div>
        </div>

        <aside className="au-panel">
          <StudentScene />
          {points && points.length > 0 && (
            <ul className="au-panel-points">
              {points.map((p) => <li key={p}>{p}</li>)}
            </ul>
          )}
        </aside>
      </div>
    );
  }

  if (variant === "admin") {
    return (
      <div className="au au-admin">
        <TopBar cta={cta} />
        <main className="au-center">
          <div className="au-frame">
            <div className="au-frame-visual">
              <DhiMark className="au-frame-mark" />
              <p className="au-frame-note">
                <IconShield />
                <span>{note}</span>
              </p>
            </div>
            <div className="au-frame-form">
              {copy}
              {children}
              {footer}
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="au au-teacher">
      <TopBar cta={cta} />
      <div className="au-frieze au-frieze-l" aria-hidden="true"><DeskScene /></div>
      <div className="au-frieze au-frieze-r" aria-hidden="true"><DeskScene /></div>
      <main className="au-center">
        <div className="au-card">
          <DhiMark className="au-card-sticker" />
          {copy}
          {children}
          {footer}
        </div>
      </main>
    </div>
  );
}
