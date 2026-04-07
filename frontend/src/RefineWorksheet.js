import React, { useState, useEffect, useCallback } from "react";
import { getWorksheetDetails, refineWorksheet } from "./api";

export default function RefineWorksheet({ contentId, onClose, onUpdate }) {
  const [loading, setLoading] = useState(false);
  const [problems, setProblems] = useState([]);
  const [selectedRefinements, setSelectedRefinements] = useState({
    add_more: false,
    add_count: 2,
    remove_problems: [],
    change_difficulty: false,
    difficulty_map: {}, // {problem_id: "Easy/Medium/Hard"}
    add_visuals: false,
    visuals_map: [],    // [problem_id, ...]
    simplify: false
  });

  const hasAnyChange =
    selectedRefinements.add_more ||
    selectedRefinements.remove_problems.length > 0 ||
    selectedRefinements.change_difficulty ||
    selectedRefinements.add_visuals ||
    selectedRefinements.simplify;

  const loadCurrentWorksheet = useCallback(async () => {
    if (!contentId) return;
    try {
      const { data } = await getWorksheetDetails(contentId);
      setProblems(data.problems || []);
      
      // ডিফল্ট ডিফিকাল্টি ম্যাপ সেট করা
      const initialDiff = {};
      data.problems?.forEach(p => {
        initialDiff[p.id] = p.difficulty || "Medium";
      });
      setSelectedRefinements(prev => ({...prev, difficulty_map: initialDiff}));
    } catch (err) {
      console.error("Failed to load problems");
    }
  }, [contentId]);

  useEffect(() => {
    loadCurrentWorksheet();
  }, [loadCurrentWorksheet]);

  useEffect(() => {
    const onEsc = (e) => {
      if (e.key === "Escape") onClose?.();
    };
    window.addEventListener("keydown", onEsc);
    return () => window.removeEventListener("keydown", onEsc);
  }, [onClose]);

  const handleRefine = async () => {
    setLoading(true);
    const refinementPayload = [];

    if (selectedRefinements.add_more) {
      refinementPayload.push({ type: "add_problems", count: Number(selectedRefinements.add_count) });
    }
    
    if (selectedRefinements.remove_problems.length > 0) {
      refinementPayload.push({ type: "remove_problem", problem_ids: selectedRefinements.remove_problems });
    }

    // Difficulty Change Logic
    if (selectedRefinements.change_difficulty) {
      refinementPayload.push({ type: "change_difficulty", diff_map: selectedRefinements.difficulty_map });
    }

    // Visuals Logic
    if (selectedRefinements.add_visuals) {
      refinementPayload.push({ 
        type: "add_visuals", 
        problem_ids: selectedRefinements.visuals_map.length > 0 ? selectedRefinements.visuals_map : "all" 
      });
    }

    if (selectedRefinements.simplify) {
      refinementPayload.push({ type: "simplify_language" });
    }

    try {
      const { data } = await refineWorksheet(contentId, problems, refinementPayload);
      onUpdate(data);
      onClose();
    } catch (err) {
      alert("Error: " + (err.response?.data?.detail || "Refinement failed"));
    }
    setLoading(false);
  };

  return (
    <div style={modalOverlayStyle} onClick={onClose}>
      <div style={refineCardStyle} onClick={(e) => e.stopPropagation()}>
        <div style={topGlowStyle} />
        <div style={bottomGlowStyle} />

        <div style={headerStyle}>
          <div>
            <p style={eyebrowStyle}>AI Worksheet Editor</p>
            <h2 style={titleStyle}>Refinement Options</h2>
            <p style={subtitleStyle}>Tune question set, difficulty and language without regenerating from scratch.</p>
          </div>
          <button onClick={onClose} style={closeButtonStyle} aria-label="Close refine dialog">✕</button>
        </div>

        <div style={metaStripStyle}>
          <span style={metaBadgeStyle}>🧩 Problems loaded: <strong>{problems.length}</strong></span>
          <span style={{ ...metaBadgeStyle, background: hasAnyChange ? "#ecfdf5" : "#fff", borderColor: hasAnyChange ? "#86efac" : "#e2e8f0", color: hasAnyChange ? "#15803d" : "#64748b" }}>
            {hasAnyChange ? "✅ Changes selected" : "ℹ️ No changes selected yet"}
          </span>
        </div>

        <div style={optionSectionStyle}>

        {/* 1. Add More */}
        <div style={optionBoxStyle}>
          <div style={headerGap}>
            <input
              type="checkbox"
              checked={selectedRefinements.add_more}
              onChange={(e) => setSelectedRefinements({ ...selectedRefinements, add_more: e.target.checked })}
            />
            <label style={labelStyle}>➕ Add more problems</label>
          </div>
          <p style={descStyle}>Increase worksheet length by generating additional questions aligned with this topic.</p>
          {selectedRefinements.add_more && (
            <div style={subOptionStyle}>
              <span style={{ fontSize: "12px", color: "#475569", fontWeight: "600" }}>How many to add?</span>
              <input
                type="number"
                min="1"
                value={selectedRefinements.add_count}
                onChange={(e) => setSelectedRefinements({ ...selectedRefinements, add_count: e.target.value })}
                style={inputSmall}
              />
            </div>
          )}
        </div>

        {/* 2. Remove Problems */}
        <div style={optionBoxStyle}>
          <div style={headerGap}><input type="checkbox" checked={selectedRefinements.remove_problems.length > 0} readOnly /><label style={labelStyle}>➖ Remove specific problems</label></div>
          <p style={descStyle}>Select questions that should be excluded from the final worksheet.</p>
          <div style={scrollListStyle}>
            {problems.map((p, idx) => (
              <div key={`rem-${p.id}`} style={itemRowStyle}>
                <input type="checkbox" checked={selectedRefinements.remove_problems.includes(p.id)} onChange={(e) => {
                  const list = e.target.checked ? [...selectedRefinements.remove_problems, p.id] : selectedRefinements.remove_problems.filter(id => id !== p.id);
                  setSelectedRefinements({...selectedRefinements, remove_problems: list});
                }} />
                <span style={itemTextStyle}>#{idx+1}: {p.question?.substring(0, 40)}...</span>
              </div>
            ))}
          </div>
        </div>

        {/* 3. Change Difficulty (Now Added) */}
        <div style={optionBoxStyle}>
          <div style={headerGap}><input type="checkbox" checked={selectedRefinements.change_difficulty} onChange={(e) => setSelectedRefinements({...selectedRefinements, change_difficulty: e.target.checked})} /><label style={labelStyle}>🎚️ Change problem difficulty</label></div>
          <p style={descStyle}>Adjust challenge level per question without changing the overall worksheet context.</p>
          {selectedRefinements.change_difficulty && (
            <div style={scrollListStyle}>
              {problems.map((p, idx) => (
                <div key={`diff-${p.id}`} style={{...itemRowStyle, justifyContent: "space-between"}}>
                  <div style={{display: "flex", alignItems: "center"}}>
                    <input type="checkbox" checked={!!selectedRefinements.difficulty_map[p.id]} readOnly />
                    <span style={itemTextStyle}>#{idx+1}</span>
                  </div>
                  <select 
                    value={selectedRefinements.difficulty_map[p.id] || "Medium"}
                    onChange={(e) => setSelectedRefinements({
                      ...selectedRefinements, 
                      difficulty_map: {...selectedRefinements.difficulty_map, [p.id]: e.target.value}
                    })}
                    style={{...inputSmall, width: "80px"}}
                  >
                    <option value="Easy">Easy</option>
                    <option value="Medium">Medium</option>
                    <option value="Hard">Hard</option>
                  </select>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 4. Add Visuals */}
        <div style={optionBoxStyle}>
          <div style={headerGap}><input type="checkbox" checked={selectedRefinements.add_visuals} onChange={(e) => setSelectedRefinements({...selectedRefinements, add_visuals: e.target.checked})} /><label style={labelStyle}>📊 Add diagrams / visuals</label></div>
          <p style={descStyle}>Request visual aids for selected questions, or leave all unchecked to apply visuals across all.</p>
          {selectedRefinements.add_visuals && (
            <div style={scrollListStyle}>
              {problems.map((p, idx) => (
                <div key={`vis-${p.id}`} style={itemRowStyle}>
                  <input type="checkbox" checked={selectedRefinements.visuals_map.includes(p.id)} onChange={(e) => {
                    const list = e.target.checked ? [...selectedRefinements.visuals_map, p.id] : selectedRefinements.visuals_map.filter(id => id !== p.id);
                    setSelectedRefinements({...selectedRefinements, visuals_map: list});
                  }} />
                  <span style={itemTextStyle}>#{idx+1}: {p.question?.substring(0, 40)}...</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 5. Simplify */}
        <div style={optionBoxStyle}><div style={headerGap}><input type="checkbox" checked={selectedRefinements.simplify} onChange={(e) => setSelectedRefinements({...selectedRefinements, simplify: e.target.checked})} /><label style={labelStyle}>🪄 Simplify language</label></div><p style={descStyle}>Reword instructions and questions for clearer, student-friendly readability.</p></div>

        </div>

        <div style={footerBarStyle}>
          <button onClick={onClose} style={secondaryButtonStyle}>Cancel</button>
          <button onClick={handleRefine} disabled={loading} style={{ ...sendButtonStyle, opacity: loading ? 0.75 : 1 }}>
            {loading ? "⌛ Refining..." : "Send Refinement Request"}
          </button>
        </div>
      </div>
    </div>
  );
}

// Styles
const modalOverlayStyle = {
  position: "fixed",
  top: 0,
  left: 0,
  width: "100%",
  height: "100%",
  backgroundColor: "rgba(15, 23, 42, 0.55)",
  backdropFilter: "blur(4px)",
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  zIndex: 2000,
  padding: "20px",
};

const refineCardStyle = {
  backgroundColor: "#ffffff",
  border: "1px solid #e2e8f0",
  boxShadow: "0 30px 80px rgba(15,23,42,0.33)",
  padding: "26px",
  borderRadius: "22px",
  width: "min(980px, 100%)",
  maxHeight: "94vh",
  overflowY: "auto",
  position: "relative",
};

const topGlowStyle = {
  position: "absolute",
  top: "-60px",
  right: "-20px",
  width: "280px",
  height: "280px",
  borderRadius: "50%",
  background: "radial-gradient(circle, rgba(99,102,241,0.17) 0%, rgba(99,102,241,0) 70%)",
  pointerEvents: "none",
};

const bottomGlowStyle = {
  position: "absolute",
  bottom: "-80px",
  left: "-30px",
  width: "320px",
  height: "320px",
  borderRadius: "50%",
  background: "radial-gradient(circle, rgba(16,185,129,0.10) 0%, rgba(16,185,129,0) 72%)",
  pointerEvents: "none",
};

const headerStyle = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: "12px",
  marginBottom: "14px",
  position: "relative",
  zIndex: 1,
};

const eyebrowStyle = {
  margin: 0,
  fontSize: "11px",
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: "#6366f1",
  fontWeight: "800",
};

const titleStyle = {
  margin: "4px 0 6px",
  color: "#0f172a",
  fontSize: "28px",
  lineHeight: 1.1,
  fontWeight: "900",
  letterSpacing: "-0.02em",
};

const subtitleStyle = {
  margin: 0,
  color: "#64748b",
  fontSize: "13px",
  maxWidth: "520px",
  lineHeight: 1.6,
};

const closeButtonStyle = {
  cursor: "pointer",
  border: "1px solid #e2e8f0",
  background: "#f8fafc",
  color: "#475569",
  width: "38px",
  height: "38px",
  borderRadius: "10px",
  fontSize: "18px",
  fontWeight: "700",
};

const metaStripStyle = {
  display: "flex",
  flexWrap: "wrap",
  gap: "8px",
  marginBottom: "18px",
};

const optionSectionStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(12, minmax(0, 1fr))",
  gap: "12px",
};

const metaBadgeStyle = {
  fontSize: "12px",
  color: "#334155",
  background: "#f8fafc",
  border: "1px solid #e2e8f0",
  borderRadius: "999px",
  padding: "6px 10px",
  fontWeight: "600",
};

const optionBoxStyle = {
  border: "1px solid #e2e8f0",
  padding: "14px",
  borderRadius: "14px",
  background: "linear-gradient(180deg, #ffffff 0%, #fbfdff 100%)",
  boxShadow: "0 8px 24px rgba(15,23,42,0.05)",
  gridColumn: "span 12",
};

const headerGap = { display: "flex", alignItems: "center", gap: "10px" };

const labelStyle = {
  fontWeight: "700",
  fontSize: "15px",
  color: "#1e293b",
};

const descStyle = {
  margin: "6px 0 0 24px",
  color: "#64748b",
  fontSize: "12px",
  lineHeight: 1.45,
};

const subOptionStyle = {
  marginTop: "10px",
  marginLeft: "25px",
  display: "inline-flex",
  alignItems: "center",
  gap: "8px",
  background: "#f8fafc",
  border: "1px solid #e2e8f0",
  borderRadius: "10px",
  padding: "8px 10px",
};

const scrollListStyle = {
  marginTop: "8px",
  maxHeight: "160px",
  overflowY: "auto",
  marginLeft: "24px",
  paddingLeft: "10px",
  paddingTop: "4px",
  borderLeft: "2px solid #e2e8f0",
};

const itemRowStyle = {
  marginBottom: "8px",
  display: "flex",
  alignItems: "center",
  borderRadius: "8px",
  padding: "5px 6px",
  background: "#f8fafc",
  border: "1px solid #eef2f7",
};

const itemTextStyle = {
  fontSize: "12px",
  marginLeft: "8px",
  color: "#475569",
  fontWeight: "500",
};

const inputSmall = {
  padding: "5px 7px",
  width: "60px",
  borderRadius: "8px",
  border: "1px solid #cbd5e1",
  background: "#fff",
};

const footerBarStyle = {
  position: "sticky",
  bottom: "-26px",
  marginTop: "16px",
  display: "flex",
  justifyContent: "flex-end",
  gap: "10px",
  background: "linear-gradient(180deg, rgba(255,255,255,0.8) 0%, #fff 35%)",
  paddingTop: "16px",
};

const secondaryButtonStyle = {
  border: "1px solid #cbd5e1",
  background: "#fff",
  color: "#475569",
  padding: "12px 16px",
  borderRadius: "10px",
  fontWeight: "700",
  cursor: "pointer",
};

const sendButtonStyle = {
  minWidth: "260px",
  background: "linear-gradient(135deg, #4f46e5, #6366f1)",
  color: "white",
  padding: "12px 18px",
  border: "none",
  borderRadius: "10px",
  cursor: "pointer",
  fontWeight: "800",
  fontSize: "14px",
  boxShadow: "0 8px 24px rgba(79,70,229,0.32)",
};