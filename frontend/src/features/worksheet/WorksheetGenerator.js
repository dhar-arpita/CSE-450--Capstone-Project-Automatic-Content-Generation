// features/worksheet/WorksheetGenerator.js — Redesigned to match Emerald Green (#059669) Theme
import React, { useState } from "react";
import { generateWorksheet, downloadWorksheetPDF } from "../../shared/services/api";
import RefineWorksheet from "./RefineWorksheet";

const TXT = {
  bangla: {
    difficulty: "কঠিনতা", questions: "প্রশ্ন সংখ্যা",
    easy: "সহজ", medium: "মাঝারি", hard: "কঠিন",
    generate: "✨ Worksheet তৈরি করো", generating: "⌛ তৈরি হচ্ছে...",
    ready: "✨ Worksheet তৈরি। ডাউনলোডের আগে নির্দিষ্ট অংশ refine করতে পারো।",
    refine: "🛠 Refine করো", download: "📥 PDF ডাউনলোড করো",
  },
  english: {
    difficulty: "Difficulty", questions: "Questions",
    easy: "Easy", medium: "Medium", hard: "Hard",
    generate: "✨ Generate Worksheet", generating: "⌛ Generating...",
    ready: "✨ Worksheet ready. You can refine specific parts before downloading.",
    refine: "🛠 Refine Worksheet", download: "📥 Download as PDF",
  },
};

export default function WorksheetGenerator({ selectedTopicId, user, sampleFile, language = "bangla" }) {
  const t = TXT[language] || TXT.bangla;
  const [loading, setLoading] = useState(false);
  const [worksheetHTML, setWorksheetHTML] = useState("");
  const [contentId, setContentId] = useState(null);
  const [difficulty, setDifficulty] = useState("Medium");
  const [numQuestions, setNumQuestions] = useState(5);
  const [showRefine, setShowRefine] = useState(false);

  // WorkSheetGenerator.js এর সংশ্লিষ্ট অংশ আপডেট করুন:

  const onGenerate = async () => {
    if (!selectedTopicId) {
      alert("Please select a Topic from the dropdowns above first!");
      return;
    }

    const userId = user?.user_id || 1;

    setLoading(true);
    setWorksheetHTML("");
    try {
      // 💡 এখানে 'language' পাঠাতে হবে (যেমন: "bangla" বা "english")
      const { data } = await generateWorksheet(
        selectedTopicId,
        userId,
        difficulty.toLowerCase(),
        numQuestions,
        sampleFile,
        language 
      );
      if (data && data.html) {
        setWorksheetHTML(data.html);
        setContentId(data.content_id);
        setShowRefine(false);
      } else {
        alert("Worksheet generated but content is empty.");
      }
    } catch (err) {
      console.error("Error:", err);
      alert("Failed to generate worksheet.");
    }
    setLoading(false);
  };

const handleDownloadPDF = async () => {
  if (!contentId) return;
  try {
    // 💡 PDF ডাউনলোডের সঠিক হ্যান্ডলার
    const response = await downloadWorksheetPDF(contentId);
    
    // Response থেকে blob তৈরি করে ডাউনলোডের লিংক জেনারেট করা
    const blob = new Blob([response.data], { type: "application/pdf" });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `worksheet_${contentId}.pdf`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  } catch (err) {
    console.error("Download failed:", err);
    alert("Download failed. Please make sure you are logged in.");
  }
};

  const handleUpdateFromRefine = (newData) => {
    setWorksheetHTML(newData.html);
    setContentId(newData.content_id);
  };

  return (
    <div>
      {/* Config & Button Row */}
      <div style={configRow}>
        <div style={configField}>
          <label style={configLabel}>{t.difficulty}</label>
          <div style={pillWrap}>
            <select
              value={difficulty}
              onChange={(e) => setDifficulty(e.target.value)}
              style={pillSelect}
            >
              <option value="Easy">{t.easy}</option>
              <option value="Medium">{t.medium}</option>
              <option value="Hard">{t.hard}</option>
            </select>
            <span style={pillCaret}>▾</span>
          </div>
        </div>

        <div style={configField}>
          <label style={configLabel}>{t.questions}</label>
          <input
            type="number"
            value={numQuestions}
            onChange={(e) => setNumQuestions(e.target.value)}
            style={numberInput}
            min="1"
          />
        </div>

        <button
          onClick={onGenerate}
          disabled={loading || !selectedTopicId}
          style={generateBtn(loading || !selectedTopicId)}
        >
          {loading ? t.generating : t.generate}
        </button>
      </div>

      {/* Preview & Action Buttons Section */}
      {worksheetHTML && (
        <div style={previewCard}>
          <div style={previewHeaderRow}>
            <div style={previewHint}>{t.ready}</div>
            <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
              <button onClick={() => setShowRefine(true)} style={refineBtn}>
                {t.refine}
              </button>
              <button onClick={handleDownloadPDF} style={downloadBtn}>
                {t.download}
              </button>
            </div>
          </div>

          <div
            className="worksheet-render-area"
            style={worksheetRenderStyle}
            dangerouslySetInnerHTML={{ __html: worksheetHTML }}
          />
        </div>
      )}

      {/* Refinement Interface */}
      {showRefine && (
        <RefineWorksheet
          contentId={contentId}
          onClose={() => setShowRefine(false)}
          onUpdate={handleUpdateFromRefine}
        />
      )}
    </div>
  );
}

/* ===== STYLES ===== */
const configRow = {
  display: "flex",
  gap: "16px",
  alignItems: "flex-end",
  flexWrap: "wrap",
  backgroundColor: "#f8fafc",
  padding: "18px",
  borderRadius: "16px",
  border: "1px solid #e2e8f0",
};

const configField = { display: "flex", flexDirection: "column", gap: "8px" };
const configLabel = { fontSize: "11px", fontWeight: 800, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.06em" };

const pillWrap = { display: "flex", alignItems: "center", gap: "8px", background: "#fff", border: "1.5px solid #e2e8f0", borderRadius: "12px", padding: "10px 14px", minWidth: "140px" };
const pillSelect = { flex: 1, border: "none", outline: "none", background: "transparent", fontSize: "13.5px", fontWeight: 600, color: "#0f172a", appearance: "none", fontFamily: "inherit", cursor: "pointer" };
const pillCaret = { color: "#94a3b8", fontSize: "12px", flexShrink: 0 };

const numberInput = { width: "80px", padding: "10px 14px", borderRadius: "12px", border: "1.5px solid #e2e8f0", background: "#fff", fontSize: "13.5px", fontWeight: 600, color: "#0f172a", outline: "none" };

/* Updated to Emerald Green (#059669 & #10b981) */
const generateBtn = (disabled) => ({
  padding: "12px 24px",
  borderRadius: "12px",
  border: "none",
  background: disabled ? "#a7f3d0" : "linear-gradient(135deg, #059669, #10b981)",
  color: "#fff",
  fontWeight: 800,
  fontSize: "13.5px",
  cursor: disabled ? "not-allowed" : "pointer",
  boxShadow: disabled ? "none" : "0 4px 14px rgba(5,150,105,0.35)",
  transition: "all 0.15s",
});

const previewCard = {
  marginTop: "20px",
  backgroundColor: "#fff",
  padding: "28px",
  border: "1px solid #e2e8f0",
  borderRadius: "18px",
  boxShadow: "0 4px 20px rgba(0,0,0,0.06)",
  maxWidth: "100%",
  overflowX: "auto",
};

const previewHeaderRow = { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "18px", flexWrap: "wrap", gap: "10px" };
const previewHint = { fontSize: "12px", color: "#64748b", fontWeight: 600 };

/* Updated Refine & Download Buttons to match Green theme */
const refineBtn = { backgroundColor: "#ecfdf5", color: "#059669", padding: "10px 16px", border: "1.5px solid #a7f3d0", borderRadius: "10px", cursor: "pointer", fontWeight: 700, fontSize: "13px" };
const downloadBtn = { backgroundColor: "#059669", color: "#fff", padding: "10px 20px", border: "none", borderRadius: "10px", cursor: "pointer", fontWeight: 700, fontSize: "13px", boxShadow: "0 4px 14px rgba(5,150,105,0.3)" };

const worksheetRenderStyle = { fontFamily: "'Times New Roman', serif", lineHeight: "1.6", color: "#000" };