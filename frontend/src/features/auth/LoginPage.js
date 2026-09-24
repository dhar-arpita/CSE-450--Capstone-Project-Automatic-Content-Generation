import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useI18n } from "../../shared/i18n";
import { login } from "../../shared/services/api";
import AuthShell from "./AuthShell";
import { Alert, Field, PasswordField, Submit } from "./fields";
import { IconArrow, IconLock, IconMail } from "./icons";
import { LOGIN_PATH, ROLES } from "./roles";
import "./auth.css";

export default function LoginPage({ role }) {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [wrongRole, setWrongRole] = useState(null);

  const others = ROLES.filter((r) => r !== role);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError(null);
    setWrongRole(null);

    if (!email.trim() || !password) {
      setError(t("auth.errors.required"));
      return;
    }

    setLoading(true);
    try {
      const { data } = await login(email.trim(), password);

      // The three doors are not decoration: an account only gets in through
      // its own. Nothing is persisted when the role does not match, so a
      // teacher cannot end up half-signed-in on the student page.
      if (data.role !== role) {
        setWrongRole(data.role);
        setError(t(`auth.errors.wrongRole.${data.role}`) || t("auth.errors.badCredentials"));
        setLoading(false);
        return;
      }

      localStorage.setItem("access_token", data.access_token);
      localStorage.setItem("refresh_token", data.refresh_token);
      localStorage.setItem("user", JSON.stringify({
        user_id: data.user_id,
        name: data.name,
        email: data.email,
        role: data.role,
        // Only meaningful for students; null for teachers/admins. Lets the
        // content pages skip asking for a class the student already picked
        // at signup.
        class_name: data.class_name ?? null,
      }));
      // The admin's home is the console; there is no teacher dashboard for
      // them to land on.
      navigate(data.role === "admin" ? "/admin" : "/dashboard");
    } catch (err) {
      // No response at all means the API is unreachable — telling the user
      // their password is wrong would send them chasing the wrong problem.
      setError(err.response ? t("auth.errors.badCredentials") : t("auth.errors.offline"));
      setLoading(false);
    }
  };

  const form = (
    <form className="au-form" onSubmit={handleSubmit} noValidate>
      <Field
        label={t("auth.fields.email")}
        icon={<IconMail />}
        type="email"
        name="email"
        autoComplete="email"
        placeholder={t("auth.fields.emailPlaceholder")}
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <PasswordField
        label={t("auth.fields.password")}
        icon={<IconLock />}
        name="password"
        autoComplete="current-password"
        placeholder="••••••••"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      <Alert
        action={
          wrongRole ? (
            <Link className="au-alert-link" to={LOGIN_PATH[wrongRole]}>
              {t(`auth.roleName.${wrongRole}`)} <IconArrow />
            </Link>
          ) : null
        }
      >
        {error}
      </Alert>
      <Submit loading={loading}>{t("auth.submitLogin")}</Submit>
    </form>
  );

  const footer = (
    <div className="au-foot">
      <p className="au-foot-line">
        {t("auth.noAccount")}{" "}
        <Link to={`/signup?role=${role}`}>{t("auth.signupLink")}</Link>
      </p>
      <p className="au-switch">
        <span>{t("auth.switchPrompt")}</span>
        {others.map((r, i) => (
          <React.Fragment key={r}>
            {i > 0 && <span className="au-switch-sep">·</span>}
            <Link to={LOGIN_PATH[r]}>{t(`auth.roleName.${r}`)}</Link>
          </React.Fragment>
        ))}
      </p>
    </div>
  );

  return (
    <AuthShell
      variant={role}
      eyebrow={t(`auth.${role}.eyebrow`)}
      title={t(`auth.${role}.title`)}
      lede={t(`auth.${role}.lede`)}
      points={role === "student" ? t("auth.student.points") : null}
      note={role === "admin" ? t("auth.admin.note") : null}
      cta={{ to: `/signup?role=${role}`, label: t("auth.signupCta") }}
      footer={footer}
    >
      {form}
    </AuthShell>
  );
}
