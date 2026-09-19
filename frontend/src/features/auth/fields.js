import React, { useId, useState } from "react";
import { useI18n } from "../../shared/i18n";
import { IconAlert, IconArrow, IconEye, IconEyeOff } from "./icons";

export function Field({ label, icon, ...inputProps }) {
  const id = useId();
  return (
    <div className="au-field">
      <label className="au-label" htmlFor={id}>{label}</label>
      <div className="au-input-wrap">
        {icon && <span className="au-input-icon">{icon}</span>}
        <input id={id} className="au-input" {...inputProps} />
      </div>
    </div>
  );
}

export function PasswordField({ label, hint, icon, ...inputProps }) {
  const id = useId();
  const { t } = useI18n();
  const [shown, setShown] = useState(false);
  return (
    <div className="au-field">
      <div className="au-label-row">
        <label className="au-label" htmlFor={id}>{label}</label>
        {hint}
      </div>
      <div className="au-input-wrap">
        {icon && <span className="au-input-icon">{icon}</span>}
        <input
          id={id}
          className="au-input"
          type={shown ? "text" : "password"}
          {...inputProps}
        />
        <button
          type="button"
          className="au-reveal-btn"
          onClick={() => setShown((v) => !v)}
          aria-label={shown ? t("auth.fields.hide") : t("auth.fields.show")}
          aria-pressed={shown}
        >
          {shown ? <IconEyeOff /> : <IconEye />}
        </button>
      </div>
    </div>
  );
}

/* role="alert" so a screen reader announces the failure without the user
   having to go looking for it after pressing submit. */
export function Alert({ children, action }) {
  if (!children) return null;
  return (
    <p className="au-alert" role="alert">
      <IconAlert />
      <span>
        {children}
        {action}
      </span>
    </p>
  );
}

export function Submit({ loading, children }) {
  const { t } = useI18n();
  return (
    <button type="submit" className="au-submit" disabled={loading}>
      {loading ? (
        <>
          <span className="au-spinner" aria-hidden="true" />
          {t("auth.working")}
        </>
      ) : (
        <>
          {children}
          <IconArrow />
        </>
      )}
    </button>
  );
}
