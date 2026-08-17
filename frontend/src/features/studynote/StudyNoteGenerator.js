// features/studynote/StudyNoteGenerator.js — matches WorksheetGenerator's visual language
import React, { useState } from "react";
import { generateStudyNote } from "../../shared/services/api";

const TXT = {
  bangla: {
    generate: "📒 Study Note তৈরি করো",
    generating: "⌛ তৈরি হচ্ছে...",
    ready: "📒 Study Note তৈরি। নিচে রিভিউ করো — চাইলে প্রিন্ট বা কপি করতে পারো।",
    print: "🖨️ Print / PDF Save",
    copy: "📋 কপি করো",
    copied: "✅ কপি হয়েছে!",
    selectFirst: "প্রথমে উপরের ড্রপডাউন থেকে একটা Topic বেছে নাও!",
    empty: "Study note তৈরি হয়েছে কিন্তু কোনো কনটেন্ট পাওয়া যায়নি।",
    failed: "Study note তৈরি করা যায়নি। আবার চেষ্টা করো।",
  },
  english: {
    generate: "📒 Generate Study Note",
    generating: "⌛ Generating...",
    ready: "📒 Study note ready. Review below — print or copy it.",
    print: "🖨️ Print / Save PDF",
    copy: "📋 Copy Text",
    copied: "✅ Copied!",
    selectFirst: "Please select a Topic from the dropdowns above first!",
    empty: "Study note generated but content is empty.",
    failed: "Failed to generate study note. Please try again.",
  },
};

export default function StudyNoteGenerator({ selectedTopicId, language = "bangla" }) {
  const t = TXT[language] || TXT.bangla;
  const [loading, setLoading] = useState(false);
  const [noteHTML, setNoteHTML] = useState("");
  const [copied, setCopied] = useState(false);

  const onGenerate = async () => {
    if (!selectedTopicId) {
      alert(t.selectFirst);
      return;
    }

    setLoading(true);
    setNoteHTML("");
    setCopied(false);
    try {
      const { data } = await generateStudyNote(selectedTopicId, language);
      // NOTE: adjust this line once you confirm the exact response shape
      // from your backend (e.g. data.html, data.note_html, data.content...)
      const html = data?.html || data?.note_html || data?.content || "";
      if (html) {
        setNoteHTML(html);
      } else {
        alert(t.empty);
      }
    } catch (err) {
      console.error("Error:", err);
      alert(t.failed);
    }
    setLoading(false);
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

  const handleCopy = async () => {
    const temp = document.createElement("div");
    temp.innerHTML = noteHTML;
    const text = temp.innerText || temp.textContent || "";
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      alert("Copy failed. Please select and copy manually.");
    }
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

      {/* Preview & Action Buttons Section */}
      {noteHTML && (
        <div style={previewCard}>
          <div style={previewHeaderRow}>
            <div style={previewHint}>{t.ready}</div>
            <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
              <button onClick={handleCopy} style={refineBtn}>
                {copied ? t.copied : t.copy}
              </button>
              <button onClick={handlePrint} style={downloadBtn}>
                {t.print}
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

const refineBtn = { backgroundColor: "#ecfeff", color: "#0891b2", padding: "10px 16px", border: "1.5px solid #a5f3fc", borderRadius: "10px", cursor: "pointer", fontWeight: 700, fontSize: "13px" };
const downloadBtn = { backgroundColor: "#0891b2", color: "#fff", padding: "10px 20px", border: "none", borderRadius: "10px", cursor: "pointer", fontWeight: 700, fontSize: "13px", boxShadow: "0 4px 14px rgba(8,145,178,0.3)" };

const noteRenderStyle = { fontFamily: "'Times New Roman', serif", lineHeight: "1.7", color: "#000" };