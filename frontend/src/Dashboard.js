import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { getClasses } from "./api";

/* ── tiny hook for counting-up numbers ── */
function useCountUp(target, duration = 1200) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    let start = 0;
    const step = Math.ceil(target / (duration / 16));
    const timer = setInterval(() => {
      start += step;
      if (start >= target) { setVal(target); clearInterval(timer); }
      else setVal(start);
    }, 16);
    return () => clearInterval(timer);
  }, [target, duration]);
  return val;
}

/* ── stat counter card ── */
function StatCard({ icon, value, label, color, bg }) {
  const count = useCountUp(value);
  return (
    <div style={{
      background: bg,
      border: `1px solid ${color}22`,
      borderRadius: "14px",
      padding: "20px 24px",
      display: "flex", alignItems: "center", gap: "16px",
      boxShadow: `0 4px 16px ${color}18`,
      transition: "transform 0.2s, box-shadow 0.2s",
    }}
    onMouseEnter={e => {
      e.currentTarget.style.transform = "translateY(-2px)";
      e.currentTarget.style.boxShadow = `0 8px 24px ${color}28`;
    }}
    onMouseLeave={e => {
      e.currentTarget.style.transform = "translateY(0)";
      e.currentTarget.style.boxShadow = `0 4px 16px ${color}18`;
    }}>
      <div style={{
        width: "46px", height: "46px", borderRadius: "12px",
        background: `${color}20`,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: "22px", flexShrink: 0,
      }}>{icon}</div>
      <div>
        <div style={{ fontSize: "24px", fontWeight: "800", color, lineHeight: 1 }}>{count}+</div>
        <div style={{ fontSize: "12px", color: "#64748b", fontWeight: "500", marginTop: "3px" }}>{label}</div>
      </div>
    </div>
  );
}

/* ── feature navigation card ── */
function FeatureCard({ icon, title, description, color, bg, borderColor, onClick, badge }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: hovered ? bg : "#fff",
        border: `2px solid ${hovered ? borderColor : "#e2e8f0"}`,
        borderRadius: "20px",
        padding: "32px 28px",
        cursor: "pointer",
        transition: "all 0.25s cubic-bezier(0.4,0,0.2,1)",
        transform: hovered ? "translateY(-4px)" : "translateY(0)",
        boxShadow: hovered
          ? `0 16px 40px ${color}25`
          : "0 2px 8px rgba(0,0,0,0.05)",
        position: "relative", overflow: "hidden",
      }}
    >
      {/* glow blob */}
      <div style={{
        position: "absolute", top: "-30px", right: "-30px",
        width: "120px", height: "120px", borderRadius: "50%",
        background: `${color}12`,
        transition: "opacity 0.3s",
        opacity: hovered ? 1 : 0,
        pointerEvents: "none",
      }} />

      {badge && (
        <div style={{
          position: "absolute", top: "16px", right: "16px",
          background: `${color}18`, color: color,
          fontSize: "10px", fontWeight: "700",
          padding: "3px 8px", borderRadius: "20px",
          border: `1px solid ${color}30`,
          textTransform: "uppercase", letterSpacing: "0.06em",
        }}>{badge}</div>
      )}

      <div style={{
        width: "60px", height: "60px", borderRadius: "16px",
        background: `${color}15`,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: "30px", marginBottom: "18px",
        border: `1px solid ${color}25`,
        transition: "transform 0.3s",
        transform: hovered ? "scale(1.08)" : "scale(1)",
      }}>{icon}</div>

      <h3 style={{
        fontSize: "17px", fontWeight: "700",
        color: "#0f172a", marginBottom: "8px",
        fontFamily: "'Poppins', sans-serif",
      }}>{title}</h3>

      <p style={{
        fontSize: "13px", color: "#64748b",
        lineHeight: "1.6", marginBottom: "20px",
      }}>{description}</p>

      <div style={{
        display: "inline-flex", alignItems: "center", gap: "6px",
        color: color, fontSize: "13px", fontWeight: "600",
        transition: "gap 0.2s",
        gap: hovered ? "10px" : "6px",
      }}>
        Get started <span style={{ fontSize: "16px" }}>→</span>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const [user, setUser]           = useState(null);
  const [classList, setClassList] = useState([]);
  const [greeting, setGreeting]   = useState("Good day");
  const navigate = useNavigate();

  useEffect(() => {
    const storedUser = localStorage.getItem("user");
    if (!storedUser) { navigate("/"); return; }
    setUser(JSON.parse(storedUser));

    // time-based greeting
    const h = new Date().getHours();
    if (h < 12) setGreeting("Good morning");
    else if (h < 17) setGreeting("Good afternoon");
    else setGreeting("Good evening");

    getClasses().then(({ data }) => setClassList(data || [])).catch(() => {});
  }, [navigate]);

  const handleLogout = () => { localStorage.clear(); navigate("/"); };

  const features = [
    {
      icon: "📂",
      title: "Upload Curriculum",
      description: "Ingest textbooks, notes, and PDFs. Our AI processes and indexes your material instantly for content generation.",
      color: "#4f46e5",
      bg: "#eef2ff",
      borderColor: "#a5b4fc",
      badge: "Step 1",
      path: "/upload",
    },
    {
      icon: "📝",
      title: "Generate Worksheet",
      description: "Create standards-aligned, AI-crafted worksheets with custom difficulty levels and question count in seconds.",
      color: "#059669",
      bg: "#ecfdf5",
      borderColor: "#6ee7b7",
      badge: "Step 2",
      path: "/generate",
    },
  ];

  const stats = [
    { icon: "📚", value: classList.length || 6, label: "Classes Available",  color: "#4f46e5", bg: "#eef2ff" },
    { icon: "✍️", value: 100,                    label: "Worksheets Created", color: "#059669", bg: "#ecfdf5" },
    // { icon: "⚡", value: 200,                   label: "Topics Indexed",     color: "#f59e0b", bg: "#fffbeb" },
    { icon: "🎯", value: 3,                     label: "Difficulty Levels",  color: "#8b5cf6", bg: "#f5f3ff" },
  ];

  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(160deg, #f0f4ff 0%, #f8fafc 50%, #f0fdf4 100%)" }}>

      {/* ── TOP NAV ── */}
      <header className="app-header">
        <div style={{
          maxWidth: "1100px", margin: "0 auto",
          padding: "0 24px", height: "64px",
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          {/* logo */}
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div style={{
              width: "36px", height: "36px", borderRadius: "10px",
              background: "linear-gradient(135deg, #4f46e5, #6366f1)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: "18px",
            }}>🎓</div>
            <span style={{
              fontFamily: "'Poppins', sans-serif",
              fontWeight: "700", fontSize: "17px", color: "#0f172a",
            }}>EduAI <span style={{ color: "#4f46e5" }}>Hub</span></span>
          </div>

          {/* breadcrumb */}
          <div style={{
            display: "flex", alignItems: "center", gap: "6px",
            background: "#f1f5f9", borderRadius: "8px",
            padding: "5px 12px", fontSize: "12px",
          }}>
            <span style={{ color: "#94a3b8" }}>🏠</span>
            <span style={{ color: "#94a3b8" }}>/</span>
            <span style={{ color: "#4f46e5", fontWeight: "600" }}>Dashboard</span>
          </div>

          {/* user menu */}
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <div style={{
              display: "flex", alignItems: "center", gap: "10px",
              background: "#f8fafc", border: "1px solid #e2e8f0",
              borderRadius: "40px", padding: "5px 14px 5px 6px",
            }}>
              <div style={{
                width: "30px", height: "30px", borderRadius: "50%",
                background: "linear-gradient(135deg, #4f46e5, #818cf8)",
                display: "flex", alignItems: "center", justifyContent: "center",
                color: "#fff", fontSize: "14px", fontWeight: "700",
              }}>
                {user?.name?.charAt(0)?.toUpperCase() || "U"}
              </div>
              <span style={{ fontSize: "13px", fontWeight: "600", color: "#334155" }}>
                {user?.name || "User"}
              </span>
            </div>
            <button
              className="btn-danger-ghost"
              onClick={handleLogout}
              style={{ fontSize: "12px", padding: "6px 12px" }}
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      {/* ── MAIN CONTENT ── */}
      <main style={{ maxWidth: "1100px", margin: "0 auto", padding: "40px 24px" }}>

        {/* HERO GREETING */}
        <div style={{
          background: "linear-gradient(135deg, #3730a3 0%, #4f46e5 55%, #6366f1 100%)",
          borderRadius: "24px",
          padding: "40px 48px",
          marginBottom: "32px",
          position: "relative", overflow: "hidden",
          animation: "fadeInUp 0.6s ease both",
          boxShadow: "0 20px 60px rgba(79,70,229,0.30)",
        }}>
          {/* bg decorations */}
          <div style={{ position: "absolute", top: "-60px", right: "-40px", width: "280px", height: "280px", borderRadius: "50%", background: "rgba(255,255,255,0.06)" }} />
          <div style={{ position: "absolute", bottom: "-40px", right: "160px", width: "180px", height: "180px", borderRadius: "50%", background: "rgba(255,255,255,0.04)" }} />
          <div style={{ position: "absolute", top: "20px", right: "48px", fontSize: "80px", opacity: 0.15, animation: "float 3.5s ease-in-out infinite" }}>🎓</div>

          <div style={{ position: "relative" }}>
            <div style={{
              display: "inline-flex", alignItems: "center", gap: "6px",
              background: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.25)",
              borderRadius: "20px", padding: "4px 12px", marginBottom: "14px",
            }}>
              <span style={{ fontSize: "11px", color: "rgba(255,255,255,0.9)", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                🟢 AI System Online
              </span>
            </div>

            <h1 style={{
              fontFamily: "'Poppins', sans-serif",
              fontSize: "clamp(22px, 3vw, 34px)",
              fontWeight: "800", color: "#fff",
              lineHeight: 1.2, marginBottom: "10px",
            }}>
              {greeting}, {user?.name?.split(" ")[0] || "Educator"} 👋
            </h1>
            <p style={{ color: "rgba(255,255,255,0.78)", fontSize: "15px", maxWidth: "480px", lineHeight: 1.7 }}>
              Your AI-powered content generation platform. Upload curriculum materials and generate professional worksheets in minutes.
            </p>
          </div>
        </div>

        {/* STATS ROW */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: "16px",
          marginBottom: "32px",
          animation: "fadeInUp 0.6s ease 0.1s both",
        }}>
          {stats.map((s, i) => <StatCard key={i} {...s} />)}
        </div>

        {/* SECTION LABEL */}
        <div style={{ marginBottom: "20px", animation: "fadeInUp 0.6s ease 0.2s both" }}>
          <h2 style={{
            fontFamily: "'Poppins', sans-serif",
            fontSize: "20px", fontWeight: "700",
            color: "#0f172a", marginBottom: "4px",
          }}>🚀 Quick Actions</h2>
          <p style={{ color: "#64748b", fontSize: "14px" }}>
            Follow the two-step workflow to generate your first AI worksheet
          </p>
        </div>

        {/* FEATURE CARDS */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
          gap: "20px",
          marginBottom: "36px",
          animation: "fadeInUp 0.6s ease 0.25s both",
        }}>
          {features.map((f, i) => (
            <FeatureCard key={i} {...f} onClick={() => navigate(f.path)} />
          ))}
        </div>

        {/* WORKFLOW EXPLAINER */}
        <div style={{
          background: "#fff",
          border: "1px solid #e2e8f0",
          borderRadius: "20px",
          padding: "28px 32px",
          boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
          animation: "fadeInUp 0.6s ease 0.35s both",
        }}>
          <h3 style={{
            fontFamily: "'Poppins', sans-serif",
            fontSize: "15px", fontWeight: "700",
            color: "#0f172a", marginBottom: "20px",
            display: "flex", alignItems: "center", gap: "8px",
          }}>
            <span style={{
              background: "#eef2ff", color: "#4f46e5",
              width: "24px", height: "24px", borderRadius: "50%",
              display: "inline-flex", alignItems: "center", justifyContent: "center",
              fontSize: "12px", fontWeight: "700",
            }}>💡</span>
            How It Works
          </h3>
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: "0",
          }}>
            {[
              { step: "01", icon: "📂", title: "Upload Material",    desc: "Select class, subject, chapter & topic, then upload your PDF." },
              { step: "02", icon: "⚙️", title: "AI Processes It",    desc: "The backend chunks, embeds and indexes your content into the RAG system." },
              { step: "03", icon: "📝", title: "Configure Output",   desc: "Choose difficulty and question count on the Generate page." },
              { step: "04", icon: "📥", title: "Download Worksheet", desc: "Review the AI-generated worksheet and export it as a PDF." },
            ].map((w, i) => (
              <div key={i} style={{ display: "flex", gap: "0", position: "relative" }}>
                {/* connector line */}
                {i < 3 && (
                  <div style={{
                    position: "absolute", top: "20px", right: "0",
                    width: "50%", height: "2px",
                    background: "linear-gradient(90deg, #e2e8f0, #c7d2fe)",
                    zIndex: 0,
                    display: "none", // hide on small screens
                  }} />
                )}
                <div style={{ padding: "0 16px 0 0", flex: 1 }}>
                  <div style={{
                    display: "flex", alignItems: "center", gap: "10px",
                    marginBottom: "10px",
                  }}>
                    <div style={{
                      width: "40px", height: "40px", borderRadius: "12px",
                      background: "#eef2ff",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: "20px", flexShrink: 0,
                    }}>{w.icon}</div>
                    <span style={{
                      fontSize: "11px", fontWeight: "700",
                      color: "#4f46e5", letterSpacing: "0.1em",
                      textTransform: "uppercase",
                    }}>Step {w.step}</span>
                  </div>
                  <h4 style={{ fontSize: "14px", fontWeight: "700", color: "#0f172a", marginBottom: "4px" }}>{w.title}</h4>
                  <p style={{ fontSize: "12px", color: "#64748b", lineHeight: "1.5" }}>{w.desc}</p>
                </div>
                {i < 3 && (
                  <div style={{
                    display: "flex", alignItems: "flex-start", paddingTop: "10px",
                    color: "#cbd5e1", fontSize: "20px", userSelect: "none",
                    paddingRight: "4px",
                  }}>→</div>
                )}
              </div>
            ))}
          </div>
        </div>

      </main>

      {/* ── FOOTER ── */}
      <footer style={{
        textAlign: "center", padding: "24px",
        borderTop: "1px solid #e2e8f0",
        color: "#94a3b8", fontSize: "12px",
        marginTop: "20px",
      }}>
        EduAI Content Hub · Automated Educational Content Generation · CSE 450 Capstone
      </footer>
    </div>
  );
}
