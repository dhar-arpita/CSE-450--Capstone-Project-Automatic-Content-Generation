// features/quiz/QuizGenerator.js
import React, { useState } from "react";
import { generateQuiz, downloadWorksheetPDF, quickAnswer } from "../../shared/services/api";

const TXT = {
  bangla: {
    scope: "স্কোপ (Scope)",
    questions: "প্রশ্ন সংখ্যা",
    generate: "🎯 Quiz তৈরি করো",
    generating: "⌛ তৈরি হচ্ছে...",
    quickAnswer: "⚡ Quick Answer", quickAnswerLoading: "⚡ খুঁজছি...",
    ready: "🎯 Quiz তৈরি শেষ। নিচে প্রশ্নগুলো দেখুন এবং প্র্যাকটিস করুন।",
    print: "🖨️ Print",
    download: "📥 PDF ডাউনলোড করো",
    downloading: "⌛ ডাউনলোড হচ্ছে...",
    selectFirst: "প্রথমে অন্তত একটি Scope (Topic/Chapter/Subject) সিলেক্ট করুন!",
    empty: "Quiz তৈরি হয়েছে কিন্তু কোনো কন্টেন্ট পাওয়া যায়নি।",
    topicScope: "Topic Scope",
    chapterScope: "Chapter Scope",
    subjectScope: "Subject Scope",
    errorMsg: "⚠️ কুইজ তৈরি করতে সমস্যা হয়েছে।",
    retry: "🔄 আবার চেষ্টা করুন",
    noCache: "⚠️ এই টপিকের জন্য ক্যাশে করা কনটেন্ট পাওয়া যায়নি।",
  },
  english: {
    scope: "Scope",
    questions: "Questions Count",
    generate: "🎯 Generate Quiz",
    generating: "⌛ Generating...",
    quickAnswer: "⚡ Quick Answer", quickAnswerLoading: "⚡ Searching...",
    ready: "🎯 Quiz is ready. Review and practice below.",
    print: "🖨️ Print",
    download: "📥 Download PDF",
    downloading: "⌛ Downloading...",
    selectFirst: "Please select at least a Topic, Chapter or Subject first!",
    empty: "Quiz generated but content is empty.",
    topicScope: "Topic Scope",
    chapterScope: "Chapter Scope",
    subjectScope: "Subject Scope",
    errorMsg: "⚠️ Failed to generate quiz.",
    retry: "🔄 Try Again",
    noCache: "⚠️ No cached content found for this topic.",
  },
};

const SCOPE_DEFAULT_QUESTIONS = { topic: 10, chapter: 20, subject: 30 };

export default function QuizGenerator({
  selectedClass,
  selectedSubject,
  selectedChapter,
  selectedTopicId,
  language = "bangla",
}) {
  const t = TXT[language] || TXT.bangla;

  const [scope, setScope] = useState("topic");
  const [numQuestions, setNumQuestions] = useState(SCOPE_DEFAULT_QUESTIONS.topic);
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false); // 💡 Download Loading State
  const [quickAnswerLoading, setQuickAnswerLoading] = useState(false); // 💡 Quick Answer Loading State
  const [error, setError] = useState(false);
  const [quizHTML, setQuizHTML] = useState("");
  const [contentId, setContentId] = useState(null);

  React.useEffect(() => {
    if (selectedTopicId) setScope("topic");
    else if (selectedChapter) setScope("chapter");
    else if (selectedSubject) setScope("subject");
  }, [selectedTopicId, selectedChapter, selectedSubject]);

  React.useEffect(() => {
    setNumQuestions(SCOPE_DEFAULT_QUESTIONS[scope] || 10);
  }, [scope]);

  const determineTarget = () => {
    if (scope === "topic" && selectedTopicId) {
      return { topic_id: selectedTopicId };
    }
    if (scope === "chapter" && selectedChapter) {
      return { chapter_id: selectedChapter };
    }
    if (scope === "subject" && selectedSubject) {
      return { subject_id: selectedSubject };
    }
    if (selectedTopicId) return { topic_id: selectedTopicId };
    if (selectedChapter) return { chapter_id: selectedChapter };
    if (selectedSubject) return { subject_id: selectedSubject };
    return null;
  };

  const target = determineTarget();

  const onGenerate = async () => {
    if (!target) {
      alert(t.selectFirst);
      return;
    }

    setLoading(true);
    setError(false);
    setQuizHTML("");
    setContentId(null);
    try {
      const payload = {
        scope,
        ...target,
        num_questions: parseInt(numQuestions, 10) || 5,
        language,
      };

      const { data } = await generateQuiz(payload);
      const html = data?.html || data?.quiz_html || data?.content || "";
      if (html) {
        setQuizHTML(html);
        setContentId(data?.content_id || data?.id || null);
      } else {
        setError(true);
      }
    } catch (err) {
      console.error("Error generating quiz:", err);
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
      link.setAttribute("download", `quiz_${contentId}.pdf`);
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
      `<html><head><title>Quiz</title></head><body>${quizHTML}</body></html>`
    );
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  };

  const handleQuickAnswer = async () => {
    if (!selectedTopicId) {
      alert("Please select a Topic from the dropdowns above first!");
      return;
    }

    // Quick Answer only works for topic-scope quizzes
    if (scope !== "topic") {
      alert("Quick Answer is only available for Topic Scope quizzes.");
      return;
    }

    setQuickAnswerLoading(true);
    setError(false);
    setQuizHTML("");

    try {
      const { data } = await quickAnswer({
        topic_id: selectedTopicId,
        content_type: "quiz_topic",
        language: language,
        num_questions: numQuestions,
      });
      
      if (data && data.found && data.html) {
        setQuizHTML(data.html);
        setContentId(data.content_id);
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

  return (
    <div>
      {/* Config Row */}
      <div style={configRow}>
        {/* Scope Selector */}
        <div style={fieldGroup}>
          <label style={labelStyle}>{t.scope}</label>
          <select
            value={scope}
            onChange={(e) => setScope(e.target.value)}
            style={selectStyle}
          >
            <option value="topic" disabled={!selectedTopicId}>
              {t.topicScope} {!selectedTopicId ? "(N/A)" : ""}
            </option>
            <option value="chapter" disabled={!selectedChapter}>
              {t.chapterScope} {!selectedChapter ? "(N/A)" : ""}
            </option>
            <option value="subject" disabled={!selectedSubject}>
              {t.subjectScope} {!selectedSubject ? "(N/A)" : ""}
            </option>
          </select>
        </div>

        {/* Questions Count */}
        <div style={fieldGroup}>
          <label style={labelStyle}>{t.questions}</label>
          <select
            value={numQuestions}
            onChange={(e) => setNumQuestions(e.target.value)}
            style={selectStyle}
          >
            <option value={5}>5</option>
            <option value={10}>10</option>
            <option value={15}>15</option>
            <option value={20}>20</option>
            <option value={25}>25</option>
            <option value={30}>30</option>
          </select>
        </div>

        {/* Generate Button */}
        <button
          onClick={onGenerate}
          disabled={loading || !target}
          style={generateBtn(loading || !target)}
        >
          {loading ? t.generating : t.generate}
        </button>

        {/* Quick Answer Button - only for topic scope */}
        {scope === "topic" && selectedTopicId && (
          <button
            onClick={handleQuickAnswer}
            disabled={quickAnswerLoading}
            style={quickAnswerBtn(quickAnswerLoading)}
          >
            {quickAnswerLoading ? t.quickAnswerLoading : t.quickAnswer}
          </button>
        )}
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
      {quizHTML && (
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
            className="quiz-render-area"
            style={quizRenderStyle}
            dangerouslySetInnerHTML={{ __html: quizHTML }}
          />
        </div>
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

const fieldGroup = { display: "flex", flexDirection: "column", gap: "6px" };
const labelStyle = { fontSize: "11px", fontWeight: 800, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.05em" };

const selectStyle = {
  padding: "10px 14px",
  borderRadius: "10px",
  border: "1.5px solid #e2e8f0",
  background: "#fff",
  fontSize: "13.5px",
  fontWeight: 600,
  color: "#0f172a",
  outline: "none",
};

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
  backgroundColor: disabled ? "#f472b6" : "#db2777",
  color: "#fff",
  padding: "10px 20px",
  border: "none",
  borderRadius: "10px",
  cursor: disabled ? "not-allowed" : "pointer",
  fontWeight: 700,
  fontSize: "13px",
  boxShadow: disabled ? "none" : "0 4px 14px rgba(219,39,119,0.3)",
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

const quizRenderStyle = { fontFamily: "'Times New Roman', serif", lineHeight: "1.7", color: "#000" };
