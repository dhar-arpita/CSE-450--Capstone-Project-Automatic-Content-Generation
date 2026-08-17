import React, { useState } from "react";
import { generateQuiz } from "../../shared/services/api";

const TXT = {
  bangla: {
    scope: "স্কোপ (Scope)",
    questions: "প্রশ্ন সংখ্যা",
    generate: "🎯 Quiz তৈরি করো",
    generating: "⌛ তৈরি হচ্ছে...",
    ready: "🎯 Quiz তৈরি শেষ। নিচে প্রশ্নগুলো দেখুন এবং প্র্যাকটিস করুন।",
    print: "🖨️ Print / Save PDF",
    copy: "📋 টেক্সট কপি করো",
    copied: "✅ কপি হয়েছে!",
    selectFirst: "প্রথমে অন্তত একটি Scope (Topic/Chapter/Subject) সিলেক্ট করুন!",
    empty: "Quiz তৈরি হয়েছে কিন্তু কোনো কন্টেন্ট পাওয়া যায়নি।",
    failed: "Quiz তৈরি করা যায়নি। আবার চেষ্টা করুন।",
    topicScope: "Topic Scope",
    chapterScope: "Chapter Scope",
    subjectScope: "Subject Scope",
  },
  english: {
    scope: "Scope",
    questions: "Questions Count",
    generate: "🎯 Generate Quiz",
    generating: "⌛ Generating...",
    ready: "🎯 Quiz is ready. Review and practice below.",
    print: "🖨️ Print / Save PDF",
    copy: "📋 Copy Text",
    copied: "✅ Copied!",
    selectFirst: "Please select at least a Topic, Chapter or Subject first!",
    empty: "Quiz generated but content is empty.",
    failed: "Failed to generate quiz. Please try again.",
    topicScope: "Topic Scope",
    chapterScope: "Chapter Scope",
    subjectScope: "Subject Scope",
  },
};

export default function QuizGenerator({
  selectedClass,
  selectedSubject,
  selectedChapter,
  selectedTopicId,
  language = "bangla",
}) {
  const t = TXT[language] || TXT.bangla;
  const [loading, setLoading] = useState(false);
  const [quizHTML, setQuizHTML] = useState("");
  const [numQuestions, setNumQuestions] = useState(5);
  const [copied, setCopied] = useState(false);

  // Determine active scope automatically
  const activeScope = selectedTopicId
    ? "topic"
    : selectedChapter
    ? "chapter"
    : selectedSubject
    ? "subject"
    : "";

  const onGenerate = async () => {
    if (!activeScope) {
      alert(t.selectFirst);
      return;
    }

    setLoading(true);
    setQuizHTML("");
    setCopied(false);

    try {
      const payload = {
        scope: activeScope,
        topic_id: selectedTopicId || null,
        chapter_id: selectedChapter || null,
        subject_id: selectedSubject || null,
        language: language,
        num_questions: numQuestions,
      };

      const { data } = await generateQuiz(payload);
      const html = data?.html || data?.quiz_html || data?.content || "";

      if (html) {
        setQuizHTML(html);
      } else {
        alert(t.empty);
      }
    } catch (err) {
      console.error("Error generating quiz:", err);
      alert(t.failed);
    }
    setLoading(false);
  };

  const handlePrint = () => {
    const printWindow = window.open("", "_blank");
    printWindow.document.write(
      `<html><head><title>Quiz Sheet</title></head><body>${quizHTML}</body></html>`
    );
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  };

  const handleCopy = async () => {
    const temp = document.createElement("div");
    temp.innerHTML = quizHTML;
    const text = temp.innerText || temp.textContent || "";
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      alert("Copy failed.");
    }
  };

  return (
    <div>
      {/* Config & Button Row */}
      <div style={configRow}>
        <div style={configField}>
          <label style={configLabel}>{t.scope}</label>
          <div style={badgeStyle(!!activeScope)}>
            {activeScope === "topic" && `🎯 ${t.topicScope}`}
            {activeScope === "chapter" && `🧩 ${t.chapterScope}`}
            {activeScope === "subject" && `📚 ${t.subjectScope}`}
            {!activeScope && "⚠️ None Selected"}
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
            max="50"
          />
        </div>

        <button
          onClick={onGenerate}
          disabled={loading || !activeScope}
          style={generateBtn(loading || !activeScope)}
        >
          {loading ? t.generating : t.generate}
        </button>
      </div>

      {/* Preview Section */}
      {quizHTML && (
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
            className="quiz-render-area"
            style={quizRenderStyle}
            dangerouslySetInnerHTML={{ __html: quizHTML }}
          />
        </div>
      )}
    </div>
  );
}

/* ===== STYLES (Pink Theme: #db2777) ===== */
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

const badgeStyle = (active) => ({
  padding: "10px 14px",
  borderRadius: "12px",
  background: active ? "#fdf2f8" : "#f1f5f9",
  border: `1.5px solid ${active ? "#fbcfe8" : "#e2e8f0"}`,
  fontSize: "13.5px",
  fontWeight: 700,
  color: active ? "#db2777" : "#94a3b8",
});

const numberInput = { width: "90px", padding: "10px 14px", borderRadius: "12px", border: "1.5px solid #e2e8f0", background: "#fff", fontSize: "13.5px", fontWeight: 600, color: "#0f172a", outline: "none" };

const generateBtn = (disabled) => ({
  padding: "12px 24px",
  borderRadius: "12px",
  border: "none",
  background: disabled ? "#fbcfe8" : "linear-gradient(135deg, #db2777, #ec4899)",
  color: "#fff",
  fontWeight: 800,
  fontSize: "13.5px",
  cursor: disabled ? "not-allowed" : "pointer",
  boxShadow: disabled ? "none" : "0 4px 14px rgba(219,39,119,0.35)",
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

const refineBtn = { backgroundColor: "#fdf2f8", color: "#db2777", padding: "10px 16px", border: "1.5px solid #fbcfe8", borderRadius: "10px", cursor: "pointer", fontWeight: 700, fontSize: "13px" };
const downloadBtn = { backgroundColor: "#db2777", color: "#fff", padding: "10px 20px", border: "none", borderRadius: "10px", cursor: "pointer", fontWeight: 700, fontSize: "13px", boxShadow: "0 4px 14px rgba(219,39,119,0.3)" };

const quizRenderStyle = { fontFamily: "'Segoe UI', sans-serif", lineHeight: "1.6", color: "#0f172a" };