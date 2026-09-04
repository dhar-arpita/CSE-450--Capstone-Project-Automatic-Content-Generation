// features/worksheet/WorksheetGenerator.js — Redesigned to match Emerald Green (#059669) Theme
import React, { useState } from "react";
import { generateWorksheet, downloadWorksheetPDF, quickAnswer } from "../../shared/services/api";
import RefineWorksheet from "./RefineWorksheet";

const TXT = {
  bangla: {
    difficulty: "কঠিনতা", questions: "প্রশ্ন সংখ্যা",
    easy: "সহজ", medium: "মাঝারি", hard: "কঠিন",
    generate: "✨ Worksheet তৈরি করো", generating: "⌛ তৈরি হচ্ছে...",
    quickAnswer: "⚡ Quick Answer", quickAnswerLoading: "⚡ খুঁজছি...",
    ready: "✨ Worksheet তৈরি। ডাউনলোডের আগে নির্দিষ্ট অংশ refine করতে পারো।",
    refine: "🛠 Refine করো",
    download: "📥 PDF ডাউনলোড করো",
    downloading: "⌛ ডাউনলোড হচ্ছে...",
    errorMsg: "⚠️ কনটেন্ট জেনারেট হতে সমস্যা হয়েছে। আবার চেষ্টা করুন।",
    retry: "🔄 আবার চেষ্টা করুন",
    noCache: "⚠️ এই টপিকের জন্য ক্যাশে করা কনটেন্ট পাওয়া যায়নি।",
  },
  english: {
    difficulty: "Difficulty", questions: "Questions",
    easy: "Easy", medium: "Medium", hard: "Hard",
    generate: "✨ Generate Worksheet", generating: "⌛ Generating...",
    quickAnswer: "⚡ Quick Answer", quickAnswerLoading: "⚡ Searching...",
    ready: "✨ Worksheet ready. You can refine specific parts before downloading.",
    refine: "🛠 Refine Worksheet",
    download: "📥 Download as PDF",
    downloading: "⌛ Downloading...",
    errorMsg: "⚠️ Failed to generate worksheet. Please try again.",
    retry: "🔄 Try Again",
    noCache: "⚠️ No cached content found for this topic.",
  },
};

export default function WorksheetGenerator({ selectedTopicId, user, sampleFile, language = "bangla" }) {
  const t = TXT[language] || TXT.bangla;
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false); // 💡 Download Loading State
  const [quickAnswerLoading, setQuickAnswerLoading] = useState(false); // 💡 Quick Answer Loading State
  const [error, setError] = useState(false);
  const [worksheetHTML, setWorksheetHTML] = useState("");
  const [contentId, setContentId] = useState(null);
  const [difficulty, setDifficulty] = useState("Medium");
  const [numQuestions, setNumQuestions] = useState(5);
  const [showRefine, setShowRefine] = useState(false);

  const onGenerate = async () => {
    if (!selectedTopicId) {
      alert("Please select a Topic from the dropdowns above first!");
      return;
    }

    const userId = user?.user_id || 1;

    setLoading(true);
    setError(false);
    setWorksheetHTML("");
    
    try {
      const { data } = await generateWorksheet(
        selectedTopicId,
        userId,
        difficulty.toLowerCase(),
        numQuestions,
        sampleFile,
        language,
        true            // refresh: Generate always builds fresh (see Quick Answer)
      );
      if (data && data.html) {
        setWorksheetHTML(data.html);
        setContentId(data.content_id);
        setShowRefine(false);
      } else {
        setError(true);
      }
    } catch (err) {
      console.error("Error:", err);
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadPDF = async () => {
    if (!contentId) return;

    setDownloading(true); // 💡 ডাউনলোড শুরু
    try {
      const response = await downloadWorksheetPDF(contentId);
      
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
    } finally {
      setDownloading(false); // 💡 ডাউনলোড শেষ/ফেইল
    }
  };

  const handleQuickAnswer = async () => {
    if (!selectedTopicId) {
      alert("Please select a Topic from the dropdowns above first!");
      return;
    }

    setQuickAnswerLoading(true);
    setError(false);
    setWorksheetHTML("");

    try {
      const { data } = await quickAnswer({
        topic_id: selectedTopicId,
        content_type: "worksheet",
        language: language,
        difficulty: difficulty.toLowerCase(),
        num_problems: numQuestions,
      });
      
      if (data && data.found && data.html) {
        setWorksheetHTML(data.html);
        setContentId(data.content_id);
        setShowRefine(false);
        setQuickAnswerLoading(false);
      } else {
        console.log("No cache found, calling regular generator...");
        setQuickAnswerLoading(false);
        await onGenerate();
      }
    } catch (err) {
      console.error("Quick Answer Error, falling back to general pipeline:", err);
      setQuickAnswerLoading(false);
      await onGenerate();
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

        <button
          onClick={handleQuickAnswer}
          disabled={quickAnswerLoading || !selectedTopicId}
          style={quickAnswerBtn(quickAnswerLoading || !selectedTopicId)}
        >
          {quickAnswerLoading ? t.quickAnswerLoading : t.quickAnswer}
        </button>
      </div>

      {/* Error UI with Try Again Button */}
      {error && (
        <div style={errorCard}>
          <span style={errorText}>{t.errorMsg}</span>
          <button onClick={onGenerate} style={retryBtn}>
            {t.retry}
          </button>
        </div>
      )}

      {/* Preview & Action Buttons Section */}
      {worksheetHTML && (
        <div style={previewCard}>
          <div style={previewHeaderRow}>
            <div style={previewHint}>{t.ready}</div>
            <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
              <button onClick={() => setShowRefine(true)} style={refineBtn}>
                {t.refine}
              </button>
              <button
                onClick={handleDownloadPDF}
                disabled={downloading}
                style={downloadBtn(downloading)}
              >
                {downloading ? t.downloading : t.download}
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

/* Error UI Styles */
const errorCard = {
  marginTop: "16px",
  padding: "14px 18px",
  backgroundColor: "#fef2f2",
  border: "1.5px solid #fecaca",
  borderRadius: "12px",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "12px",
};

const errorText = { fontSize: "13px", color: "#991b1b", fontWeight: 600 };

const retryBtn = {
  backgroundColor: "#dc2626",
  color: "#fff",
  border: "none",
  padding: "8px 14px",
  borderRadius: "8px",
  cursor: "pointer",
  fontWeight: 700,
  fontSize: "12.5px",
  boxShadow: "0 2px 8px rgba(220,38,38,0.25)",
};

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

const refineBtn = { backgroundColor: "#ecfdf5", color: "#059669", padding: "10px 16px", border: "1.5px solid #a7f3d0", borderRadius: "10px", cursor: "pointer", fontWeight: 700, fontSize: "13px" };

const downloadBtn = (disabled) => ({
  backgroundColor: disabled ? "#6ee7b7" : "#059669",
  color: "#fff",
  padding: "10px 20px",
  border: "none",
  borderRadius: "10px",
  cursor: disabled ? "not-allowed" : "pointer",
  fontWeight: 700,
  fontSize: "13px",
  boxShadow: disabled ? "none" : "0 4px 14px rgba(5,150,105,0.3)",
  opacity: disabled ? 0.8 : 1,
  transition: "all 0.2s",
});

const quickAnswerBtn = (disabled) => ({
  padding: "12px 24px",
  borderRadius: "12px",
  border: "none",
  background: disabled ? "#fef3c7" : "linear-gradient(135deg, #f59e0b, #fbbf24)",
  color: "#fff",
  fontWeight: 800,
  fontSize: "13.5px",
  cursor: disabled ? "not-allowed" : "pointer",
  boxShadow: disabled ? "none" : "0 4px 14px rgba(245,158,11,0.35)",
  transition: "all 0.15s",
});

const worksheetRenderStyle = { fontFamily: "'Times New Roman', serif", lineHeight: "1.6", color: "#000" };
