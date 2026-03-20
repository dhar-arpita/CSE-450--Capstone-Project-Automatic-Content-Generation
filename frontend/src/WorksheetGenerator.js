import React, { useState } from "react";
import { generateWorksheet } from "./api";

export default function WorksheetGenerator({ 
  classList, subjectList, chapterList, topicList,
  selectedClass, selectedSubject, selectedChapter, selectedTopicId,
  handleClassChange, handleSubjectChange, handleChapterChange, setSelectedTopicId
}) {
  const [loading, setLoading] = useState(false);
  const [worksheetHTML, setWorksheetHTML] = useState("");
  const [contentId, setContentId] = useState(null); // PDF ডাউনলোডের জন্য আইডি
  const [difficulty, setDifficulty] = useState("Medium");
  const [numQuestions, setNumQuestions] = useState(5);

  const onGenerate = async () => {
    if (!selectedTopicId) {
      alert("Please select Class, Subject, Chapter and Topic first!");
      return;
    }

    const storedUser = JSON.parse(localStorage.getItem("user"));
    const userId = storedUser?.user_id || 1; 

    setLoading(true);
    setWorksheetHTML(""); // নতুন করে জেনারেট করার আগে পুরনোটা মুছে ফেলা
    try {
      const { data } = await generateWorksheet(
        selectedTopicId, 
        userId, 
        difficulty.toLowerCase(), 
        numQuestions
      );

      if (data && data.html) {
        setWorksheetHTML(data.html);
        setContentId(data.content_id); // ব্যাকএন্ড থেকে আসা আইডি সেভ করা
      } else {
        alert("Worksheet generated but content is empty. Ensure the PDF is ingested correctly.");
      }
    } catch (err) {
      console.error("Error response:", err.response?.data);
      alert("Failed to generate worksheet. Please check if curriculum file is uploaded.");
    }
    setLoading(false);
  };

  const handleDownloadPDF = () => {
    if (!contentId) return;
    // ব্যাকএন্ডের ডাউনলোড রাউটে হিট করা
    window.open(`http://127.0.0.1:8000/generate/download/${contentId}`, "_blank");
  };

  return (
    <div style={{ border: "2px solid #52c41a", padding: "20px", marginTop: "20px", borderRadius: "12px", backgroundColor: "#f6ffed", boxShadow: "0 4px 10px rgba(0,0,0,0.05)" }}>
      <h3 style={{ color: "#389e0d" }}>📝 AI Worksheet Generator</h3>
      
      {/* Dropdowns Row */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "15px" }}>
        <select value={selectedClass} onChange={(e) => handleClassChange(e.target.value)} style={{ padding: "8px" }}>
          <option value="">-- Select Class --</option>
          {classList.map(c => <option key={c.class_name} value={c.class_name}>{c.class_name}</option>)}
        </select>

        <select disabled={!selectedClass} value={selectedSubject} onChange={(e) => handleSubjectChange(e.target.value)} style={{ padding: "8px" }}>
          <option value="">-- Select Subject --</option>
          {subjectList.map(s => <option key={s.subject_id} value={s.subject_id}>{s.name}</option>)}
        </select>

        <select disabled={!selectedSubject} value={selectedChapter} onChange={(e) => handleChapterChange(e.target.value)} style={{ padding: "8px" }}>
          <option value="">-- Select Chapter --</option>
          {chapterList.map(ch => <option key={ch.chapter_id} value={ch.chapter_id}>Ch {ch.chapter_no}: {ch.name}</option>)}
        </select>

        <select disabled={!selectedChapter} value={selectedTopicId} onChange={(e) => setSelectedTopicId(e.target.value)} style={{ padding: "8px" }}>
          <option value="">-- Select Topic --</option>
          {topicList.map(t => <option key={t.topic_id} value={t.topic_id}>{t.name}</option>)}
        </select>
      </div>

      {/* Config & Button Row */}
      <div style={{ display: "flex", gap: "15px", alignItems: "center", marginBottom: "15px", flexWrap: "wrap" }}>
        <label>Difficulty:</label>
        <select value={difficulty} onChange={(e) => setDifficulty(e.target.value)} style={{ padding: "5px" }}>
          <option value="Easy">Easy</option>
          <option value="Medium">Medium</option>
          <option value="Hard">Hard</option>
        </select>

        <label>Questions:</label>
        <input type="number" value={numQuestions} onChange={(e) => setNumQuestions(e.target.value)} style={{ width: "60px", padding: "5px" }} />

        <button 
          onClick={onGenerate} 
          disabled={loading || !selectedTopicId} 
          style={{ backgroundColor: "#52c41a", color: "white", padding: "10px 20px", cursor: "pointer", border: "none", borderRadius: "6px", fontWeight: "bold" }}
        >
          {loading ? "⌛ Generating..." : "✨ Generate Worksheet"}
        </button>
      </div>

      {/* Preview Section */}
      {worksheetHTML && (
        <div style={{ marginTop: "20px", backgroundColor: "white", padding: "30px", border: "1px solid #d9d9d9", borderRadius: "8px", overflowX: "auto" }}>
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "15px" }}>
            <button 
              onClick={handleDownloadPDF} 
              style={{ backgroundColor: "#1890ff", color: "white", padding: "8px 16px", border: "none", borderRadius: "4px", cursor: "pointer", fontWeight: "bold" }}
            >
              📥 Download as PDF
            </button>
          </div>
          
          {/* এই অংশটি ব্যাকএন্ড থেকে আসা HTML রেন্ডার করবে */}
          <div 
            className="worksheet-render-area"
            dangerouslySetInnerHTML={{ __html: worksheetHTML }} 
          />
        </div>
      )}
    </div>
  );
}