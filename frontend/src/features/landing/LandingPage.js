import React, { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import BrandLogo from "../../shared/brand/BrandLogo";
import LogoIntro, { prefersNoIntro } from "../../shared/brand/LogoIntro";
import { useI18n } from "../../shared/i18n";
import { useTheme } from "../../shared/theme";
import "./LandingPage.css";

const FILM = "/videos/landing-hero.mp4";
const FILM_REST = "/videos/landing-hero-poster.jpg";

const Arrow = () => (
  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M5 12h13M13 6l6 6-6 6" />
  </svg>
);

const SunIcon = () => (
  <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" aria-hidden="true">
    <circle cx="12" cy="12" r="4.2" />
    <path d="M12 2.6v2.2M12 19.2v2.2M4.3 4.3l1.6 1.6M18.1 18.1l1.6 1.6M2.6 12h2.2M19.2 12h2.2M4.3 19.7l1.6-1.6M18.1 5.9l1.6-1.6" />
  </svg>
);

const MoonIcon = () => (
  <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M20 13.4A8.2 8.2 0 0 1 10.6 4a8.4 8.4 0 1 0 9.4 9.4Z" />
  </svg>
);

const IconSheet = () => (
  <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M7 3h7l5 5v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z" />
    <path d="M14 3v5h5M9.5 13h6M9.5 16.5h4" />
  </svg>
);

const IconQuiz = () => (
  <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="9" />
    <path d="M9.4 9.3a2.7 2.7 0 0 1 5.2.9c0 1.8-2.6 2.1-2.6 3.8" />
    <path d="M12 17.4h.01" />
  </svg>
);

const IconNotes = () => (
  <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M5 4.8C7 3.6 9.6 3.6 12 4.9c2.4-1.3 5-1.3 7 .0v13.4c-2-1.3-4.6-1.3-7 0-2.4-1.3-5-1.3-7 0Z" />
    <path d="M12 4.9v13.4" />
  </svg>
);

const IconSpark = () => (
  <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 3.5 13.7 9l5.5 1.7-5.5 1.7L12 18l-1.7-5.6L4.8 10.7 10.3 9 12 3.5Z" />
    <path d="M18.5 16.5l.7 2.2 2.2.7-2.2.7-.7 2.2-.7-2.2-2.2-.7 2.2-.7.7-2.2Z" />
  </svg>
);

const CRAFT_ICONS = [IconSheet, IconQuiz, IconNotes, IconSpark];

function HeroFilm({ hold = false }) {
  const videoRef = useRef(null);
  const [settled, setSettled] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || hold) return;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setSettled(true);
      return;
    }
    // Autoplay can still be refused (low-power mode, strict settings) — resting
    // on the final frame is the correct fallback, not a broken black rectangle.
    const started = video.play();
    if (started && typeof started.catch === "function") {
      started.catch(() => setSettled(true));
    }
  }, [hold]);

  return (
    <div className="lp-film">
      <video
        ref={videoRef}
        className="lp-film-media"
        poster={FILM_REST}
        muted
        playsInline
        autoPlay={!hold}
        preload="auto"
        onEnded={() => setSettled(true)}
        aria-hidden="true"
      >
        <source src={FILM} type="video/mp4" />
      </video>
      <img
        className={`lp-film-rest${settled ? " is-visible" : ""}`}
        src={FILM_REST}
        alt=""
        aria-hidden="true"
      />
      <div className="lp-film-scrim" aria-hidden="true" />
    </div>
  );
}

function Nav() {
  const { t, lang, toggleLang } = useI18n();
  const { theme, toggleTheme } = useTheme();
  const [stuck, setStuck] = useState(false);

  useEffect(() => {
    const onScroll = () => setStuck(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header className={`lp-nav${stuck ? " is-stuck" : ""}`}>
      <nav className="lp-nav-pill" aria-label={t("a11y.primaryNav")}>
        <BrandLogo to="/" size="sm" />

        <ul className="lp-nav-links">
          <li><a href="#craft">{t("nav.craft")}</a></li>
          <li><a href="#how">{t("nav.how")}</a></li>
          <li><a href="#students">{t("nav.students")}</a></li>
        </ul>

        <div className="lp-nav-tools">
          <button
            type="button"
            className="lp-chip"
            onClick={toggleLang}
            aria-label={lang === "bn" ? t("a11y.toEnglish") : t("a11y.toBangla")}
          >
            {lang === "bn" ? "EN" : "বাং"}
          </button>
          <button
            type="button"
            className="lp-chip lp-chip-icon"
            onClick={toggleTheme}
            aria-label={theme === "dark" ? t("a11y.toLight") : t("a11y.toDark")}
          >
            {theme === "dark" ? <SunIcon /> : <MoonIcon />}
          </button>
          <Link to="/login" className="lp-nav-login">{t("nav.login")}</Link>
        </div>
      </nav>
    </header>
  );
}

export default function LandingPage() {
  const { t } = useI18n();
  const location = useLocation();
  const navigate = useNavigate();

  /* Signing out is the one arrival at this page that plays the mark animation.
     The flag is read once and then dropped from history, so a reload — or the
     back button — does not replay it. */
  const [splash, setSplash] = useState(
    () => Boolean(location.state?.splash) && !prefersNoIntro()
  );
  useEffect(() => {
    if (location.state?.splash) {
      navigate(location.pathname, { replace: true, state: null });
    }
  }, [location.state, location.pathname, navigate]);

  const craftItems = t("craft.items");
  const steps = t("how.steps");
  const quotes = t("students.quotes");

  return (
    <div className="lp">
      {splash && <LogoIntro onFinish={() => setSplash(false)} />}
      <Nav />

      <section className="lp-hero">
        <HeroFilm hold={splash} />

        <div className="lp-hero-body">
          <p className="lp-kicker">{t("hero.kicker")}</p>
          <h1 className="lp-title">
            {t("hero.titleLead")}
            <br />
            <em>{t("hero.titleAccent")}</em>
          </h1>
          <p className="lp-lede">{t("hero.lede")}</p>
          <div className="lp-hero-actions">
            <Link to="/signup" className="lp-cta-primary">
              {t("hero.primary")} <Arrow />
            </Link>
            <a href="#how" className="lp-cta-quiet">{t("hero.secondary")}</a>
          </div>
        </div>

        <a href="#craft" className="lp-scroll" aria-label={t("a11y.scrollDown")}>
          <span>{t("hero.scroll")}</span>
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M12 5v14M6 13l6 6 6-6" />
          </svg>
        </a>
      </section>

      <section className="lp-section" id="craft">
        <div className="lp-wrap">
          <header className="lp-head">
            <p className="lp-eyebrow">{t("craft.eyebrow")}</p>
            <h2>
              {t("craft.headLead")} <em>{t("craft.headAccent")}</em>
            </h2>
          </header>
          <div className="lp-craft">
            {craftItems.map((item, i) => {
              const Icon = CRAFT_ICONS[i];
              return (
                <article className="lp-card" key={item.title}>
                  <span className="lp-card-icon"><Icon /></span>
                  <h3>{item.title}</h3>
                  <p>{item.body}</p>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section className="lp-section lp-section-tint" id="how">
        <div className="lp-wrap">
          <header className="lp-head">
            <p className="lp-eyebrow">{t("how.eyebrow")}</p>
            <h2>
              {t("how.headLead")} <em>{t("how.headAccent")}</em>
            </h2>
          </header>
          <ol className="lp-steps">
            {steps.map((step, i) => (
              <li key={step.k}>
                <span className="lp-step-index">{String(i + 1).padStart(2, "0")}</span>
                <h3>{step.k}</h3>
                <p>{step.v}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="lp-section" id="students">
        <div className="lp-wrap lp-split">
          <div className="lp-split-copy">
            <p className="lp-eyebrow">{t("students.eyebrow")}</p>
            <h2>
              {t("students.headLead")} <em>{t("students.headAccent")}</em>
            </h2>
            <p className="lp-body">{t("students.body")}</p>
            <Link to="/signup?role=student" className="lp-cta-dark">
              {t("students.cta")} <Arrow />
            </Link>
          </div>
          <ul className="lp-quotes" aria-label={t("a11y.practiceList")}>
            {quotes.map((q) => (
              <li key={q.k}><strong>{q.k}</strong> {q.v}</li>
            ))}
          </ul>
        </div>
      </section>

      <section className="lp-close">
        <div className="lp-wrap">
          <h2>
            {t("close.headLead")} <em>{t("close.headAccent")}</em>
          </h2>
          <p>{t("close.sub")}</p>
          <div className="lp-close-actions">
            <Link to="/signup" className="lp-cta-primary">
              {t("close.primary")} <Arrow />
            </Link>
            <Link to="/login" className="lp-cta-ghost">{t("close.secondary")}</Link>
          </div>
        </div>
      </section>

      <footer className="lp-footer">
        <div className="lp-wrap lp-footer-inner">
          <BrandLogo to="/" size="sm" />
          <nav className="lp-footer-links" aria-label={t("a11y.footerNav")}>
            <a href="#craft">{t("nav.craft")}</a>
            <a href="#how">{t("nav.how")}</a>
            <Link to="/login">{t("nav.login")}</Link>
            <Link to="/signup">{t("footer.signup")}</Link>
          </nav>
          <p className="lp-footer-note">© {new Date().getFullYear()} {t("brand")}</p>
        </div>
      </footer>
    </div>
  );
}
