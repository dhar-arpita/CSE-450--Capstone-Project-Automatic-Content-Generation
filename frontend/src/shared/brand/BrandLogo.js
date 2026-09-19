import React from "react";
import { Link } from "react-router-dom";
import { useI18n } from "../i18n";
import { LOGO_MARK } from "./assets";
import "./brand.css";

/* The single logo used by every navbar in the app.

   The mark is the tangram bird cropped out of the master artwork and kept on
   its own violet tile: the artwork has no transparency, and keying the purple
   out would leave a fringe on every antialiased edge. A tile also survives
   both themes without a second file.

   Renders as a <Link> by default, a <button> when given onClick (several of
   the older pages use the logo as a "go back" control), or a plain <span>
   when neither is wanted. */
export default function BrandLogo({
  to = "/",
  onClick,
  size = "md",
  wordmark = true,
  tone = "auto",
  className = "",
}) {
  const { t } = useI18n();
  const cls = `dhi-logo dhi-logo-${size} dhi-logo-${tone}${className ? ` ${className}` : ""}`;

  const inner = (
    <>
      <img className="dhi-logo-mark" src={LOGO_MARK} alt="" width="40" height="40" />
      {wordmark && (
        <span className="dhi-logo-word">
          {t("brand")}
          <span className="dhi-logo-suffix">AI</span>
        </span>
      )}
    </>
  );

  // The accessible name never depends on the language toggle: the product is
  // called the same thing in both, only the script changes.
  const label = `${t("brand")} AI`;

  if (onClick) {
    return (
      <button type="button" className={cls} onClick={onClick} aria-label={label}>
        {inner}
      </button>
    );
  }
  if (!to) {
    return <span className={cls} aria-label={label}>{inner}</span>;
  }
  return (
    <Link to={to} className={cls} aria-label={label}>
      {inner}
    </Link>
  );
}
