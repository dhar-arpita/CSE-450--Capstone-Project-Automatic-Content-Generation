import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { signup, login } from "./api";

/* ── shared branded panel ── */
const BrandPanel = () => (
  <div style={{
    flex: "0 0 42%",
    background: "linear-gradient(145deg, #3730a3 0%, #4f46e5 45%, #6366f1 80%, #818cf8 100%)",
    display: "flex", flexDirection: "column",
    justifyContent: "center", alignItems: "center",
    padding: "60px 48px", position: "relative", overflow: "hidden",
  }}>
    {/* decorative blobs */}
    <div style={{
      position: "absolute", top: "-80px", right: "-80px",
      width: "300px", height: "300px", borderRadius: "50%",
      background: "rgba(255,255,255,0.07)",
    }} />
    <div style={{
      position: "absolute", bottom: "-60px", left: "-60px",
      width: "220px", height: "220px", borderRadius: "50%",
      background: "rgba(255,255,255,0.06)",
    }} />
    <div style={{
      position: "absolute", top: "35%", right: "-40px",
      width: "150px", height: "150px", borderRadius: "50%",
      background: "rgba(255,255,255,0.04)",
    }} />

    {/* logo */}
    <div style={{
      width: "72px", height: "72px", borderRadius: "20px",
      background: "rgba(255,255,255,0.15)",
      backdropFilter: "blur(10px)",
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: "36px", marginBottom: "28px",
      border: "1px solid rgba(255,255,255,0.25)",
      boxShadow: "0 8px 32px rgba(0,0,0,0.2)",
      animation: "float 3s ease-in-out infinite",
    }}>🎓</div>

    <h1 style={{
      fontFamily: "'Poppins', sans-serif",
      fontSize: "32px", fontWeight: "800",
      color: "#fff", textAlign: "center",
      lineHeight: 1.2, marginBottom: "14px",
      letterSpacing: "-0.5px",
    }}>EduAI<br/>Content Hub</h1>

    <p style={{
      color: "rgba(255,255,255,0.75)",
      fontSize: "15px", textAlign: "center",
      lineHeight: 1.7, maxWidth: "280px", marginBottom: "40px",
    }}>
      Automatically generate personalised worksheets, flashcards &amp; more — powered by AI.
    </p>

    {/* feature pills */}
    {[
      { icon: "📝", label: "AI Worksheet Generator" },
      { icon: "⚡", label: "Instant Curriculum Ingestion" },
      { icon: "🎯", label: "Adaptive Difficulty Levels" },
    ].map((f, i) => (
      <div key={i} style={{
        display: "flex", alignItems: "center", gap: "12px",
        background: "rgba(255,255,255,0.10)",
        border: "1px solid rgba(255,255,255,0.18)",
        borderRadius: "40px",
        padding: "10px 18px",
        marginBottom: "10px",
        width: "100%", maxWidth: "280px",
        backdropFilter: "blur(6px)",
        animation: `fadeInUp 0.5s ease ${0.2 + i * 0.12}s both`,
      }}>
        <span style={{ fontSize: "18px" }}>{f.icon}</span>
        <span style={{ color: "rgba(255,255,255,0.88)", fontSize: "13px", fontWeight: "500" }}>{f.label}</span>
      </div>
    ))}
  </div>
);

/* ═══════════════ LOGIN ═══════════════ */
export function Login() {
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState("");
  const [showPwd, setShowPwd]   = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    if (!email || !password) { setError("Please fill in all fields."); return; }
    setLoading(true);
    try {
      const { data } = await login(email, password);
      localStorage.setItem("user", JSON.stringify(data));
      navigate("/dashboard");
    } catch {
      setError("Invalid email or password. Please try again.");
    }
    setLoading(false);
  };

  return (
    <div style={{
      minHeight: "100vh", display: "flex",
      background: "linear-gradient(135deg, #f0f4ff 0%, #faf5ff 100%)",
    }}>
      <BrandPanel />

      {/* right form panel */}
      <div style={{
        flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
        padding: "40px 32px",
      }}>
        <div style={{
          width: "100%", maxWidth: "420px",
          animation: "fadeInUp 0.5s ease both",
        }}>
          <div style={{ marginBottom: "36px" }}>
            <h2 style={{
              fontFamily: "'Poppins', sans-serif",
              fontSize: "28px", fontWeight: "700",
              color: "#0f172a", marginBottom: "8px",
            }}>Welcome back 👋</h2>
            <p style={{ color: "#64748b", fontSize: "14px" }}>
              Sign in to your account to continue
            </p>
          </div>

          <form onSubmit={handleLogin} style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
            {/* email */}
            <div>
              <label className="form-label">Email address</label>
              <div style={{ position: "relative" }}>
                <span style={{
                  position: "absolute", left: "14px", top: "50%",
                  transform: "translateY(-50%)", fontSize: "16px",
                  pointerEvents: "none",
                }}>📧</span>
                <input
                  className="edu-input"
                  type="email"
                  placeholder="you@school.edu"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  style={{ paddingLeft: "42px" }}
                  autoComplete="email"
                />
              </div>
            </div>

            {/* password */}
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                <label className="form-label" style={{ marginBottom: 0 }}>Password</label>
                <button type="button" style={{
                  background: "none", border: "none", cursor: "pointer",
                  fontSize: "12px", color: "#4f46e5", fontWeight: "600",
                }}>Forgot password?</button>
              </div>
              <div style={{ position: "relative" }}>
                <span style={{
                  position: "absolute", left: "14px", top: "50%",
                  transform: "translateY(-50%)", fontSize: "16px",
                  pointerEvents: "none",
                }}>🔒</span>
                <input
                  className="edu-input"
                  type={showPwd ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  style={{ paddingLeft: "42px", paddingRight: "44px" }}
                  autoComplete="current-password"
                />
                <button type="button" onClick={() => setShowPwd(p => !p)} style={{
                  position: "absolute", right: "12px", top: "50%",
                  transform: "translateY(-50%)",
                  background: "none", border: "none", cursor: "pointer",
                  fontSize: "16px", color: "#94a3b8",
                }}>{showPwd ? "🙈" : "👁️"}</button>
              </div>
            </div>

            {/* error */}
            {error && (
              <div style={{
                display: "flex", alignItems: "center", gap: "8px",
                background: "#fef2f2", border: "1px solid #fecaca",
                borderRadius: "8px", padding: "10px 14px",
                color: "#dc2626", fontSize: "13px", fontWeight: "500",
                animation: "popIn 0.3s ease both",
              }}>
                <span>⚠️</span>{error}
              </div>
            )}

            <button
              type="submit"
              className="btn-primary"
              disabled={loading}
              style={{ width: "100%", padding: "13px 24px", fontSize: "15px", marginTop: "4px" }}
            >
              {loading ? <><span className="spinner" />Signing in…</> : "Sign in →"}
            </button>
          </form>

          <p style={{
            textAlign: "center", marginTop: "28px",
            color: "#64748b", fontSize: "14px",
          }}>
            Don't have an account?{" "}
            <a href="/signup" style={{
              color: "#4f46e5", fontWeight: "600", textDecoration: "none",
            }}>Create one free</a>
          </p>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════ SIGNUP ═══════════════ */
export function Signup() {
  const [form, setForm]       = useState({ name: "", email: "", password: "", role: "teacher" });
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const navigate = useNavigate();

  const handleSignup = async (e) => {
    e.preventDefault();
    setError("");
    if (!form.name || !form.email || !form.password) {
      setError("All fields are required."); return;
    }
    if (form.password.length < 6) {
      setError("Password must be at least 6 characters."); return;
    }
    setLoading(true);
    try {
      await signup(form);
      navigate("/", { state: { signedUp: true } });
    } catch {
      setError("Signup failed. This email might already be registered.");
    }
    setLoading(false);
  };

  const roles = [
    { value: "teacher", label: "Teacher", icon: "🧑‍🏫" },
    { value: "admin",   label: "Admin",   icon: "🏫" },
  ];

  return (
    <div style={{
      minHeight: "100vh", display: "flex",
      background: "linear-gradient(135deg, #f0f4ff 0%, #faf5ff 100%)",
    }}>
      <BrandPanel />

      <div style={{
        flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
        padding: "40px 32px",
      }}>
        <div style={{
          width: "100%", maxWidth: "420px",
          animation: "fadeInUp 0.5s ease both",
        }}>
          <div style={{ marginBottom: "32px" }}>
            <h2 style={{
              fontFamily: "'Poppins', sans-serif",
              fontSize: "28px", fontWeight: "700",
              color: "#0f172a", marginBottom: "8px",
            }}>Create your account ✨</h2>
            <p style={{ color: "#64748b", fontSize: "14px" }}>
              Join educators using AI to create amazing content
            </p>
          </div>

          <form onSubmit={handleSignup} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            {/* name */}
            <div>
              <label className="form-label">Full name</label>
              <div style={{ position: "relative" }}>
                <span style={{ position: "absolute", left: "14px", top: "50%", transform: "translateY(-50%)", fontSize: "16px", pointerEvents: "none" }}>👤</span>
                <input
                  className="edu-input"
                  placeholder="Jane Smith"
                  value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })}
                  style={{ paddingLeft: "42px" }}
                />
              </div>
            </div>

            {/* email */}
            <div>
              <label className="form-label">Email address</label>
              <div style={{ position: "relative" }}>
                <span style={{ position: "absolute", left: "14px", top: "50%", transform: "translateY(-50%)", fontSize: "16px", pointerEvents: "none" }}>📧</span>
                <input
                  className="edu-input"
                  type="email"
                  placeholder="you@school.edu"
                  value={form.email}
                  onChange={e => setForm({ ...form, email: e.target.value })}
                  style={{ paddingLeft: "42px" }}
                />
              </div>
            </div>

            {/* password */}
            <div>
              <label className="form-label">Password</label>
              <div style={{ position: "relative" }}>
                <span style={{ position: "absolute", left: "14px", top: "50%", transform: "translateY(-50%)", fontSize: "16px", pointerEvents: "none" }}>🔒</span>
                <input
                  className="edu-input"
                  type={showPwd ? "text" : "password"}
                  placeholder="Min. 6 characters"
                  value={form.password}
                  onChange={e => setForm({ ...form, password: e.target.value })}
                  style={{ paddingLeft: "42px", paddingRight: "44px" }}
                />
                <button type="button" onClick={() => setShowPwd(p => !p)} style={{
                  position: "absolute", right: "12px", top: "50%",
                  transform: "translateY(-50%)",
                  background: "none", border: "none", cursor: "pointer",
                  fontSize: "16px", color: "#94a3b8",
                }}>{showPwd ? "🙈" : "👁️"}</button>
              </div>
            </div>

            {/* role selector */}
            <div>
              <label className="form-label">I am a…</label>
              <div style={{ display: "flex", gap: "10px" }}>
                {roles.map(r => (
                  <button
                    type="button" key={r.value}
                    onClick={() => setForm({ ...form, role: r.value })}
                    style={{
                      flex: 1, padding: "10px 12px",
                      borderRadius: "10px",
                      border: form.role === r.value ? "2px solid #4f46e5" : "1.5px solid #e2e8f0",
                      background: form.role === r.value ? "#eef2ff" : "#fff",
                      color: form.role === r.value ? "#4f46e5" : "#475569",
                      fontWeight: "600", fontSize: "13px",
                      cursor: "pointer", transition: "all 0.2s",
                      display: "flex", alignItems: "center", justifyContent: "center", gap: "6px",
                    }}
                  >{r.icon} {r.label}</button>
                ))}
              </div>
            </div>

            {error && (
              <div style={{
                display: "flex", alignItems: "center", gap: "8px",
                background: "#fef2f2", border: "1px solid #fecaca",
                borderRadius: "8px", padding: "10px 14px",
                color: "#dc2626", fontSize: "13px", fontWeight: "500",
                animation: "popIn 0.3s ease both",
              }}>
                <span>⚠️</span>{error}
              </div>
            )}

            <button
              type="submit"
              className="btn-primary"
              disabled={loading}
              style={{ width: "100%", padding: "13px 24px", fontSize: "15px", marginTop: "4px" }}
            >
              {loading ? <><span className="spinner" />Creating account…</> : "Create account →"}
            </button>
          </form>

          <p style={{
            textAlign: "center", marginTop: "24px",
            color: "#64748b", fontSize: "14px",
          }}>
            Already have an account?{" "}
            <a href="/" style={{ color: "#4f46e5", fontWeight: "600", textDecoration: "none" }}>
              Sign in
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
