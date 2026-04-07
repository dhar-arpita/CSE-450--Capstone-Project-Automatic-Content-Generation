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
    <div style={modalOverlayStyle}>
      <div style={refineCardStyle}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "20px" }}>
          <h2 style={{ margin: 0, color: "#4834d4", fontSize: "18px" }}>Refinement Options</h2>
          <button onClick={onClose} style={{ cursor: "pointer", border: "none", background: "none", fontSize: "20px" }}>✖</button>
        </div>

        {/* 1. Add More */}
        <div style={optionBoxStyle}>
          <div style={headerGap}><input type="checkbox" checked={selectedRefinements.add_more} onChange={(e) => setSelectedRefinements({...selectedRefinements, add_more: e.target.checked})} /><label style={labelStyle}>Add more problems</label></div>
          {selectedRefinements.add_more && <div style={{ marginTop: "8px", marginLeft: "25px" }}><span style={{fontSize: "12px"}}>How many? </span><input type="number" value={selectedRefinements.add_count} onChange={(e) => setSelectedRefinements({...selectedRefinements, add_count: e.target.value})} style={inputSmall} /></div>}
        </div>

        {/* 2. Remove Problems */}
        <div style={optionBoxStyle}>
          <div style={headerGap}><input type="checkbox" checked={selectedRefinements.remove_problems.length > 0} readOnly /><label style={labelStyle}>Remove specific problems</label></div>
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
          <div style={headerGap}><input type="checkbox" checked={selectedRefinements.change_difficulty} onChange={(e) => setSelectedRefinements({...selectedRefinements, change_difficulty: e.target.checked})} /><label style={labelStyle}>Change difficulty of a problem</label></div>
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
          <div style={headerGap}><input type="checkbox" checked={selectedRefinements.add_visuals} onChange={(e) => setSelectedRefinements({...selectedRefinements, add_visuals: e.target.checked})} /><label style={labelStyle}>Add diagrams / visuals</label></div>
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
        <div style={optionBoxStyle}><div style={headerGap}><input type="checkbox" checked={selectedRefinements.simplify} onChange={(e) => setSelectedRefinements({...selectedRefinements, simplify: e.target.checked})} /><label style={labelStyle}>Simplify the language</label></div></div>

        <button onClick={handleRefine} disabled={loading} style={sendButtonStyle}>
          {loading ? "⌛ Refining..." : "Send Refinement Request"}
        </button>
      </div>
    </div>
  );
}

// Styles
const modalOverlayStyle = { position: "fixed", top: 0, left: 0, width: "100%", height: "100%", backgroundColor: "rgba(0,0,0,0.5)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 2000 };
const refineCardStyle = { backgroundColor: "white", padding: "20px", borderRadius: "10px", width: "500px", maxHeight: "90vh", overflowY: "auto" };
const optionBoxStyle = { border: "1px solid #e0e0e0", padding: "10px", marginBottom: "10px", borderRadius: "8px", backgroundColor: "#fdfdff" };
const headerGap = { display: "flex", alignItems: "center", gap: "10px" };
const labelStyle = { fontWeight: "600", fontSize: "14px", color: "#333" };
const scrollListStyle = { marginTop: "8px", maxHeight: "120px", overflowY: "auto", marginLeft: "24px", paddingLeft: "8px", borderLeft: "2px solid #f0f0f0" };
const itemRowStyle = { marginBottom: "5px", display: "flex", alignItems: "center" };
const itemTextStyle = { fontSize: "12px", marginLeft: "8px", color: "#666" };
const inputSmall = { padding: "3px", width: "45px", borderRadius: "4px", border: "1px solid #ccc" };
const sendButtonStyle = { width: "100%", backgroundColor: "#4834d4", color: "white", padding: "12px", border: "none", borderRadius: "6px", cursor: "pointer", fontWeight: "bold", marginTop: "10px" };