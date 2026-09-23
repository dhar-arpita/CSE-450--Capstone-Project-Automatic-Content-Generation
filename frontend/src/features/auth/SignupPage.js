import React, { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useI18n } from "../../shared/i18n";
import { getClasses, signup } from "../../shared/services/api";
import AuthShell from "./AuthShell";
import { Alert, Field, PasswordField, SelectField, Submit } from "./fields";
import { IconLock, IconMail, IconSchool, IconUser } from "./icons";
import { DEFAULT_ROLE, LOGIN_PATH, SIGNUP_ROLES } from "./roles";
import "./auth.css";

const MIN_PASSWORD = 6;

export default function SignupPage() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [params] = useSearchParams();

  // Arriving from "Join as a student" should land on the student role already
  // chosen; an unknown value in the query string must not select nothing.
  const asked = params.get("role");
  const [role, setRole] = useState(SIGNUP_ROLES.includes(asked) ? asked : DEFAULT_ROLE);

  const [form, setForm] = useState({ name: "", email: "", password: "", className: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // A student belongs to one class and only ever sees that class's material,
  // so the class is fixed here at signup rather than chosen per session. The
  // list is fetched only once the student role is actually picked — a teacher
  // signing up never needs it. /curriculum/classes is unauthenticated for
  // exactly this reason: there is no token yet.
  const [classes, setClasses] = useState([]);
  const [classesFailed, setClassesFailed] = useState(false);

  useEffect(() => {
    if (role !== "student" || classes.length) return;
    let live = true;
    getClasses()
      .then(({ data }) => {
        if (!live) return;
        setClasses(data);
        setClassesFailed(false);
      })
      .catch(() => live && setClassesFailed(true));
    return () => { live = false; };
  }, [role, classes.length]);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError(null);

    if (!form.name.trim() || !form.email.trim() || !form.password) {
      setError(t("auth.errors.required"));
      return;
    }
    if (form.password.length < MIN_PASSWORD) {
      setError(t("auth.errors.shortPassword"));
      return;
    }
    if (role === "student" && !form.className) {
      setError(t("auth.errors.pickClass"));
      return;
    }

    setLoading(true);
    try {
      const { data } = await signup({
        name: form.name.trim(),
        email: form.email.trim(),
        password: form.password,
        role,
        // Sent only for students; the backend rejects a student without one
        // and ignores it for teachers.
        ...(role === "student" ? { class_name: form.className } : {}),
      });
      localStorage.setItem("access_token", data.access_token);
      localStorage.setItem("refresh_token", data.refresh_token);
      localStorage.setItem("user", JSON.stringify({
        user_id: data.user_id,
        name: data.name,
        email: data.email,
        role: data.role,
        class_name: data.class_name ?? null,
      }));
      navigate("/dashboard");
    } catch (err) {
      setError(err.response ? t("auth.errors.signupFailed") : t("auth.errors.offline"));
      setLoading(false);
    }
  };

  const form_ = (
    <form className="au-form" onSubmit={handleSubmit} noValidate>
      <fieldset className="au-roles">
        <legend className="au-label">{t("auth.roleLabel")}</legend>
        <div className="au-roles-row">
          {SIGNUP_ROLES.map((r) => (
            <button
              type="button"
              key={r}
              className={`au-role${role === r ? " is-on" : ""}`}
              onClick={() => setRole(r)}
              aria-pressed={role === r}
            >
              {t(`auth.roleName.${r}`)}
            </button>
          ))}
        </div>
      </fieldset>

      <Field
        label={t("auth.fields.name")}
        icon={<IconUser />}
        name="name"
        autoComplete="name"
        placeholder={t("auth.fields.namePlaceholder")}
        value={form.name}
        onChange={set("name")}
      />
      <Field
        label={t("auth.fields.email")}
        icon={<IconMail />}
        type="email"
        name="email"
        autoComplete="email"
        placeholder={t("auth.fields.emailPlaceholder")}
        value={form.email}
        onChange={set("email")}
      />
      {role === "student" && (
        <SelectField
          label={t("auth.fields.className")}
          icon={<IconSchool />}
          name="class_name"
          placeholder={
            classesFailed
              ? t("auth.fields.classUnavailable")
              : classes.length
                ? t("auth.fields.classPlaceholder")
                : t("auth.fields.classLoading")
          }
          options={classes.map((c) => ({ value: c.class_name, label: c.class_name }))}
          value={form.className}
          onChange={set("className")}
          disabled={classesFailed || !classes.length}
        />
      )}
      <PasswordField
        label={t("auth.fields.password")}
        icon={<IconLock />}
        name="password"
        autoComplete="new-password"
        placeholder={t("auth.fields.passwordPlaceholder")}
        value={form.password}
        onChange={set("password")}
      />
      <Alert>{error}</Alert>
      <Submit loading={loading}>{t("auth.submitSignup")}</Submit>
    </form>
  );

  const footer = (
    <div className="au-foot">
      <p className="au-foot-line">
        {t("auth.haveAccount")}{" "}
        <Link to={LOGIN_PATH[role]}>{t("auth.loginLink")}</Link>
      </p>
    </div>
  );

  return (
    <AuthShell
      variant="teacher"
      eyebrow={t("auth.signup.eyebrow")}
      title={t("auth.signup.title")}
      lede={t("auth.signup.lede")}
      cta={{ to: LOGIN_PATH[role], label: t("auth.loginLink") }}
      footer={footer}
    >
      {form_}
    </AuthShell>
  );
}
