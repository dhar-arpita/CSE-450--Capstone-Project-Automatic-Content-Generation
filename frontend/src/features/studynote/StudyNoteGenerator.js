// features/studynote/StudyNoteGenerator.js — matches WorksheetGenerator's visual language
import React, { useState } from "react";
import { generateStudyNote, downloadWorksheetPDF } from "../../shared/services/api";

const TXT = {
  bangla: {
    generate: "📒 Study Note তৈরি করো",
    generating: "⌛ তৈরি হচ্ছে...",
    ready: "📒 Study Note তৈরি। নিচে রিভিউ করো — চাইলে প্রিন্ট বা ডাউনলোড করতে পারো।",
    print: "🖨️ Print",
    download: "📥 PDF ডাউনলোড করো",
    downloading: "⌛ ডাউনলোড হচ্ছে...",
    selectFirst: "প্রথমে উপরের ড্রপডাউন থেকে একটা Topic বেছে নাও!",
    empty: "Study note তৈরি হয়েছে কিন্তু কোনো কনটেন্ট পাওয়া যায়নি।",
    errorMsg: "⚠️ স্টাডি নোট তৈরি করতে সমস্যা হয়েছে।",
    retry: "🔄 আবার চেষ্টা করুন",
  },
  english: {
    generate: "📒 Generate Study Note",
    generating: "⌛ Generating...",
    ready: "📒 Study note ready. Review below — print or download as PDF.",
    print: "🖨️ Print",
    download: "📥 Download PDF",
    downloading: "⌛ Downloading...",
    selectFirst: "Please select a Topic from the dropdowns above first!",
    empty: "Study note generated but content is empty.",
    errorMsg: "⚠️ Failed to generate study note.",
    retry: "🔄 Try Again",
  },
};

export default function StudyNoteGenerator({ selectedTopicId, language = "bangla" }) {
  const t = TXT[language] || TXT.bangla;
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false); // 💡 Download Loading State
  const [error, setError] = useState(false);
  const [noteHTML, setNoteHTML] = useState("");
  const [contentId, setContentId] = useState(null);

  const onGenerate = async () => {
    if (!selectedTopicId) {
      alert(t.selectFirst);
      return;
    }

    setLoading(true);
    setError(false);
    setNoteHTML("");
    setContentId(null);

    try {
      const { data } = await generateStudyNote(selectedTopicId, language);
      const html = data?.html || data?.note_html || data?.content || "";
      if (html) {
        setNoteHTML(html);
        setContentId(data?.content_id || data?.id || null);
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
    if (!contentId) {
      alert("Content ID not found to download PDF.");
      return;
    }

    setDownloading(true); // 💡 ডাউনলোড শুরু
    try {
      const response = await downloadWorksheetPDF(contentId);

      const blob = new Blob([response.data], { type: "application/pdf" });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `studynote_${contentId}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Download failed:", err);
      alert("Download failed. Please try again.");
    } finally {
      setDownloading(false); // 💡 ডাউনলোড শেষ/ফেইল
    }
  };

  const handlePrint = () => {
    const printWindow = window.open("", "_blank");
    printWindow.document.write(
      `<html><head><title>Study Note</title></head><body>${noteHTML}</body></html>`
    );
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  };

  return (
    <div>
      {/* Generate Button Row */}
      <div style={configRow}>
        <button
          onClick={onGenerate}
          disabled={loading || !selectedTopicId}
          style={generateBtn(loading || !selectedTopicId)}
        >
          {loading ? t.generating : t.generate}
        </button>
      </div>

      {/* Error UI with Dynamic Try Again Button */}
      {error && (
        <div style={errorCard}>
          <span style={errorText}>{t.errorMsg}</span>
          <button onClick={onGenerate} style={retryBtn}>
            {t.retry}
          </button>
        </div>
      )}

      {/* Preview & Action Buttons Section */}
      {noteHTML && (
        <div style={previewCard}>
          <div style={previewHeaderRow}>
            <div style={previewHint}>{t.ready}</div>
            <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
              <button onClick={handlePrint} style={outlineBtn}>
                {t.print}
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
            className="note-render-area"
            style={noteRenderStyle}
            dangerouslySetInnerHTML={{ __html: noteHTML }}
          />
        </div>
      )}
    </div>
  );
}

/* ===== STYLES (mirrors WorksheetGenerator, cyan/teal theme) ===== */
const configRow = {
  display: "flex",
  gap: "16px",
  alignItems: "center",
  flexWrap: "wrap",
  backgroundColor: "#f8fafc",
  padding: "18px",
  borderRadius: "16px",
  border: "1px solid #e2e8f0",
};

const generateBtn = (disabled) => ({
  padding: "12px 24px",
  borderRadius: "12px",
  border: "none",
  background: disabled ? "#a5f3fc" : "linear-gradient(135deg, #0891b2, #06b6d4)",
  color: "#fff",
  fontWeight: 800,
  fontSize: "13.5px",
  cursor: disabled ? "not-allowed" : "pointer",
  boxShadow: disabled ? "none" : "0 4px 14px rgba(8,145,178,0.35)",
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

const outlineBtn = { backgroundColor: "#f1f5f9", color: "#334155", padding: "10px 16px", border: "1px solid #cbd5e1", borderRadius: "10px", cursor: "pointer", fontWeight: 700, fontSize: "13px" };

const downloadBtn = (disabled) => ({
  backgroundColor: disabled ? "#a5f3fc" : "#0891b2",
  color: "#fff",
  padding: "10px 20px",
  border: "none",
  borderRadius: "10px",
  cursor: disabled ? "not-allowed" : "pointer",
  fontWeight: 700,
  fontSize: "13px",
  boxShadow: disabled ? "none" : "0 4px 14px rgba(8,145,178,0.3)",
  opacity: disabled ? 0.8 : 1,
  transition: "all 0.2s",
});

const noteRenderStyle = { fontFamily: "'Times New Roman', serif", lineHeight: "1.7", color: "#000" };