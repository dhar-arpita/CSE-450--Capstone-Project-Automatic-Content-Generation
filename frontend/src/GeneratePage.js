import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { getClasses, getSubjects, getChapters, getTopics } from "./api";
import WorksheetGenerator from "./WorksheetGenerator";

function SelectField({ label, icon, value, onChange, disabled, options, placeholder }) {
  return (
    <div style={fieldCardStyle}>
      <label style={labelStyle}>
        <span>{icon}</span>
        <span>{label}</span>
      </label>
      <div style={{ position: "relative" }}>
        <select
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          style={{
            ...selectStyle,
            ...(disabled ? disabledSelectStyle : {}),
          }}
        >
          <option value="">{placeholder}</option>
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <span style={caretStyle}>▾</span>
      </div>
    </div>
  );
}

export default function GeneratePage() {
  const [user, setUser] = useState(null);
  const navigate = useNavigate();

  const [classList, setClassList] = useState([]);
  const [subjectList, setSubjectList] = useState([]);
  const [chapterList, setChapterList] = useState([]);
  const [topicList, setTopicList] = useState([]);

  const [selectedClass, setSelectedClass] = useState("");
  const [selectedSubject, setSelectedSubject] = useState("");
  const [selectedChapter, setSelectedChapter] = useState("");
  const [selectedTopicId, setSelectedTopicId] = useState("");

  const [sampleFile, setSampleFile] = useState(null);
  const [showSampleInput, setShowSampleInput] = useState(false);

  useEffect(() => {
    const storedUser = localStorage.getItem("user");
    if (!storedUser) {
      navigate("/");
    } else {
      setUser(JSON.parse(storedUser));
      loadClasses();
    }
  }, [navigate]);

  const loadClasses = async () => {
    try {
      const { data } = await getClasses();
      setClassList(data || []);
    } catch (err) {
      console.error("Classes load failed", err);
    }
  };

  const handleClassChange = async (className) => {
    setSelectedClass(className);
    setSubjectList([]);
    setChapterList([]);
    setTopicList([]);
    setSelectedSubject("");
    setSelectedChapter("");
    setSelectedTopicId("");
    try {
      const { data } = await getSubjects(className);
      setSubjectList(data || []);
    } catch (err) {
      console.error(err);
    }
  };

  const handleSubjectChange = async (subjectId) => {
    setSelectedSubject(subjectId);
    setChapterList([]);
    setTopicList([]);
    setSelectedChapter("");
    setSelectedTopicId("");
    try {
      const { data } = await getChapters(subjectId);
      setChapterList(data || []);
    } catch (err) {
      console.error(err);
    }
  };

  const handleChapterChange = async (chapterId) => {
    setSelectedChapter(chapterId);
    setTopicList([]);
    setSelectedTopicId("");
    try {
      const { data } = await getTopics(chapterId);
      setTopicList(data || []);
    } catch (err) {
      console.error(err);
    }
  };

  const setupProgress = [selectedClass, selectedSubject, selectedChapter, selectedTopicId].filter(Boolean).length;

  return (
    <div style={pageStyle}>
      <div style={ambientOrbA} />
      <div style={ambientOrbB} />
      <div style={ambientOrbC} />

      <div style={containerStyle}>
        <header style={topBarStyle}>
          <button onClick={() => navigate(-1)} style={backButtonStyle}>← Dashboard</button>

          <div style={{ textAlign: "center" }}>
            <h1 style={titleStyle}>📝 AI Worksheet Studio</h1>
            <p style={subtitleStyle}>Sophisticated worksheet generation workflow for your capstone demo</p>
          </div>

          <div style={userPillStyle}>👋 {user?.name?.split(" ")[0] || "Teacher"}</div>
        </header>

        <section style={heroCardStyle}>
          <div>
            
            <h2 style={heroTitleStyle}>Create classroom-ready worksheets at a click!</h2>
            <p style={heroDescStyle}>
              Select curriculum context precisely, add optional style reference, then generate polished outputs with AI.
            </p>
          </div>

          <div style={heroMeterStyle}>
            <span style={heroMeterLabelStyle}>Setup</span>
            <strong style={heroMeterValueStyle}>{setupProgress}/4</strong>
            <div style={heroTrackStyle}>
              <div style={{ ...heroFillStyle, width: `${(setupProgress / 4) * 100}%` }} />
            </div>
          </div>
        </section>

        <main style={mainCardStyle}>
          <div style={sectionHeaderStyle}>
            <span style={stepBadgeStyle}>STEP 1</span>
            <h3 style={sectionTitleStyle}>Curriculum Selection</h3>
          </div>

          <div style={gridStyle}>
            <SelectField
              label="Class"
              icon="🏫"
              value={selectedClass}
              onChange={handleClassChange}
              placeholder="Select class"
              options={classList.map((c) => ({ value: c.class_name, label: c.class_name }))}
            />

            <SelectField
              label="Subject"
              icon="📚"
              value={selectedSubject}
              onChange={handleSubjectChange}
              disabled={!selectedClass}
              placeholder="Select subject"
              options={subjectList.map((s) => ({ value: s.subject_id, label: s.name }))}
            />

            <SelectField
              label="Chapter"
              icon="🧩"
              value={selectedChapter}
              onChange={handleChapterChange}
              disabled={!selectedSubject}
              placeholder="Select chapter"
              options={chapterList.map((ch) => ({ value: ch.chapter_id, label: `Ch ${ch.chapter_no}: ${ch.name}` }))}
            />

            <SelectField
              label="Topic"
              icon="🎯"
              value={selectedTopicId}
              onChange={setSelectedTopicId}
              disabled={!selectedChapter}
              placeholder="Select topic"
              options={topicList.map((t) => ({ value: t.topic_id, label: t.name }))}
            />
          </div>

          <div style={hintBoxStyle}>
            <span style={{ fontSize: "16px" }}>💡</span>
            <span style={hintTextStyle}>
              {selectedTopicId
                ? "Perfect. Your context is locked in. Move to generation settings below."
                : "Complete all four dropdowns to unlock targeted worksheet generation."}
            </span>
          </div>

          <hr style={hrStyle} />

          <div style={sectionHeaderStyle}>
            <span style={{ ...stepBadgeStyle, background: "#eff6ff", borderColor: "#bfdbfe", color: "#1d4ed8" }}>STEP 2</span>
            <h3 style={sectionTitleStyle}>Configuration & Reference Style</h3>
          </div>

          <div style={sampleSectionStyle}>
            {!showSampleInput ? (
              <button onClick={() => setShowSampleInput(true)} style={sampleButtonStyle}>
                + Add a reference sample worksheet (optional)
              </button>
            ) : (
              <div style={uploadPanelStyle}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
                  <span style={{ fontSize: "14px", fontWeight: "800", color: "#0f172a" }}>Upload Reference File</span>
                  <button onClick={() => { setShowSampleInput(false); setSampleFile(null); }} style={cancelButtonStyle}>Cancel</button>
                </div>
                <input
                  type="file"
                  accept=".pdf,.txt"
                  onChange={(e) => setSampleFile(e.target.files[0])}
                  style={{ fontSize: "13px" }}
                />
                <p style={helperTextStyle}>Used only for style/tone guidance. Content still follows selected topic knowledge.</p>
                {sampleFile && <p style={selectedFileStyle}>✅ Selected: {sampleFile.name}</p>}
              </div>
            )}
          </div>

          <div style={{ marginTop: "20px" }}>
            <WorksheetGenerator selectedTopicId={selectedTopicId} user={user} sampleFile={sampleFile} />
          </div>
        </main>
      </div>
    </div>
  );
}

const pageStyle = {
  minHeight: "100vh",
  padding: "36px 20px 56px",
  background: "linear-gradient(180deg, #f8fafc 0%, #eef2ff 52%, #ecfeff 100%)",
  position: "relative",
  overflow: "hidden",
};

const ambientOrbA = {
  position: "absolute",
  top: "-130px",
  right: "-120px",
  width: "340px",
  height: "340px",
  borderRadius: "50%",
  background: "radial-gradient(circle, rgba(99,102,241,0.24) 0%, rgba(99,102,241,0) 72%)",
};

const ambientOrbB = {
  position: "absolute",
  bottom: "-140px",
  left: "-120px",
  width: "360px",
  height: "360px",
  borderRadius: "50%",
  background: "radial-gradient(circle, rgba(16,185,129,0.18) 0%, rgba(16,185,129,0) 74%)",
};

const ambientOrbC = {
  position: "absolute",
  top: "38%",
  left: "50%",
  transform: "translateX(-50%)",
  width: "280px",
  height: "280px",
  borderRadius: "50%",
  background: "radial-gradient(circle, rgba(14,165,233,0.12) 0%, rgba(14,165,233,0) 76%)",
};

const containerStyle = {
  maxWidth: "1080px",
  margin: "0 auto",
  position: "relative",
  zIndex: 1,
  display: "flex",
  flexDirection: "column",
  gap: "18px",
};

const topBarStyle = {
  display: "grid",
  gridTemplateColumns: "auto 1fr auto",
  alignItems: "center",
  gap: "16px",
  borderRadius: "16px",
  border: "1px solid #e2e8f0",
  background: "rgba(255,255,255,0.82)",
  backdropFilter: "blur(10px)",
  boxShadow: "0 12px 28px rgba(15,23,42,0.08)",
  padding: "14px 16px",
};

const backButtonStyle = {
  padding: "9px 14px",
  borderRadius: "10px",
  border: "1px solid #cbd5e1",
  background: "#fff",
  color: "#334155",
  fontSize: "13px",
  fontWeight: "700",
  cursor: "pointer",
};

const titleStyle = {
  margin: 0,
  fontSize: "26px",
  fontWeight: "900",
  letterSpacing: "-0.02em",
  color: "#0f172a",
};

const subtitleStyle = {
  margin: "4px 0 0",
  fontSize: "12px",
  color: "#64748b",
  fontWeight: "500",
};

const userPillStyle = {
  justifySelf: "end",
  borderRadius: "999px",
  border: "1px solid #bfdbfe",
  background: "#eff6ff",
  color: "#1d4ed8",
  fontSize: "12px",
  fontWeight: "700",
  padding: "8px 12px",
};

const heroCardStyle = {
  borderRadius: "20px",
  padding: "24px 26px",
  background: "linear-gradient(135deg, #0f172a 0%, #1e293b 65%, #334155 100%)",
  color: "#fff",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "18px",
  boxShadow: "0 20px 44px rgba(15,23,42,0.28)",
};

const heroTagStyle = {
  margin: 0,
  fontSize: "11px",
  color: "#93c5fd",
  fontWeight: "700",
  letterSpacing: "0.11em",
  textTransform: "uppercase",
};

const heroTitleStyle = {
  margin: "8px 0 10px",
  fontSize: "29px",
  lineHeight: 1.17,
  letterSpacing: "-0.02em",
  maxWidth: "720px",
};

const heroDescStyle = {
  margin: 0,
  color: "#cbd5e1",
  fontSize: "14px",
  lineHeight: 1.6,
  maxWidth: "700px",
};

const heroMeterStyle = {
  minWidth: "150px",
  textAlign: "right",
};

const heroMeterLabelStyle = {
  fontSize: "11px",
  color: "#a5b4fc",
  letterSpacing: "0.09em",
  textTransform: "uppercase",
};

const heroMeterValueStyle = {
  display: "block",
  marginTop: "4px",
  fontSize: "30px",
  lineHeight: 1,
};

const heroTrackStyle = {
  marginTop: "10px",
  height: "7px",
  borderRadius: "999px",
  background: "rgba(148,163,184,0.35)",
  overflow: "hidden",
};

const heroFillStyle = {
  height: "100%",
  borderRadius: "999px",
  background: "linear-gradient(90deg, #22c55e 0%, #60a5fa 100%)",
  transition: "width 0.35s ease",
};

const mainCardStyle = {
  borderRadius: "18px",
  border: "1px solid #e2e8f0",
  background: "rgba(255,255,255,0.93)",
  backdropFilter: "blur(8px)",
  boxShadow: "0 16px 40px rgba(15,23,42,0.10)",
  padding: "28px",
};

const sectionHeaderStyle = {
  display: "flex",
  alignItems: "center",
  gap: "10px",
  marginBottom: "14px",
};

const stepBadgeStyle = {
  fontSize: "11px",
  fontWeight: "800",
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: "#15803d",
  background: "#f0fdf4",
  border: "1px solid #bbf7d0",
  borderRadius: "999px",
  padding: "5px 10px",
};

const sectionTitleStyle = {
  margin: 0,
  fontSize: "20px",
  color: "#0f172a",
  fontWeight: "800",
  letterSpacing: "-0.01em",
};

const gridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: "14px",
};

const fieldCardStyle = {
  border: "1px solid #e2e8f0",
  borderRadius: "12px",
  padding: "12px",
  background: "#fff",
  boxShadow: "0 4px 14px rgba(15,23,42,0.04)",
};

const labelStyle = {
  display: "flex",
  alignItems: "center",
  gap: "6px",
  fontSize: "12px",
  fontWeight: "700",
  color: "#475569",
  marginBottom: "8px",
  letterSpacing: "0.03em",
  textTransform: "uppercase",
};

const selectStyle = {
  width: "100%",
  padding: "10px 32px 10px 11px",
  borderRadius: "10px",
  border: "1px solid #cbd5e1",
  fontSize: "14px",
  color: "#0f172a",
  outline: "none",
  background: "#fff",
  appearance: "none",
};

const disabledSelectStyle = {
  background: "#f8fafc",
  color: "#94a3b8",
};

const caretStyle = {
  position: "absolute",
  right: "11px",
  top: "50%",
  transform: "translateY(-50%)",
  color: "#64748b",
  pointerEvents: "none",
  fontSize: "12px",
};

const hintBoxStyle = {
  marginTop: "14px",
  display: "flex",
  alignItems: "center",
  gap: "8px",
  padding: "10px 12px",
  borderRadius: "10px",
  background: "#f8fafc",
  border: "1px solid #e2e8f0",
};

const hintTextStyle = {
  fontSize: "12px",
  color: "#475569",
  fontWeight: "600",
};

const hrStyle = {
  border: 0,
  borderTop: "1px solid #e2e8f0",
  margin: "24px 0",
};

const sampleSectionStyle = { marginBottom: "8px" };

const sampleButtonStyle = {
  background: "#eff6ff",
  border: "1px dashed #93c5fd",
  color: "#1d4ed8",
  borderRadius: "10px",
  fontSize: "13px",
  fontWeight: "700",
  padding: "10px 14px",
  cursor: "pointer",
};

const uploadPanelStyle = {
  padding: "14px",
  border: "1px dashed #94a3b8",
  borderRadius: "10px",
  backgroundColor: "#f8fafc",
};

const cancelButtonStyle = {
  border: "1px solid #fecaca",
  color: "#dc2626",
  background: "#fff",
  borderRadius: "8px",
  fontSize: "12px",
  fontWeight: "700",
  padding: "4px 10px",
  cursor: "pointer",
};

const helperTextStyle = {
  fontSize: "11px",
  color: "#64748b",
  marginTop: "9px",
  marginBottom: 0,
};

const selectedFileStyle = {
  marginTop: "8px",
  marginBottom: 0,
  fontSize: "12px",
  color: "#15803d",
  fontWeight: "700",
};
