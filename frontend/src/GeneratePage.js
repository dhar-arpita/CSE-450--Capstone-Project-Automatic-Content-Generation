

import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { 
  getClasses, getSubjects, getChapters, getTopics 
} from "./api"; 
import WorksheetGenerator from "./WorksheetGenerator"; 

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

  // Optional Sample Worksheet State
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
    } catch (err) { console.error("Classes load failed", err); }
  };

  const handleClassChange = async (className) => {
    setSelectedClass(className);
    setSubjectList([]); setChapterList([]); setTopicList([]);
    setSelectedSubject(""); setSelectedChapter(""); setSelectedTopicId("");
    try {
      const { data } = await getSubjects(className);
      setSubjectList(data || []);
    } catch (err) { console.error(err); }
  };

  const handleSubjectChange = async (subjectId) => {
    setSelectedSubject(subjectId);
    setChapterList([]); setTopicList([]);
    setSelectedChapter(""); setSelectedTopicId("");
    try {
      const { data } = await getChapters(subjectId);
      setChapterList(data || []);
    } catch (err) { console.error(err); }
  };

  const handleChapterChange = async (chapterId) => {
    setSelectedChapter(chapterId);
    setTopicList([]); setSelectedTopicId("");
    try {
      const { data } = await getTopics(chapterId);
      setTopicList(data || []);
    } catch (err) { console.error(err); }
  };

  return (
    <div style={{ backgroundColor: "#f0f2f5", minHeight: "100vh", padding: "40px 20px" }}>
      <div style={{ maxWidth: "1000px", margin: "0 auto", display: "flex", flexDirection: "column", gap: "20px" }}>
        
        {/* Header Section */}
        <div style={headerStyle}>
          <button onClick={() => navigate(-1)} style={backButtonStyle}>← Dashboard</button>
          <h2 style={{ color: "#52c41a", margin: 0, flexGrow: 1, textAlign: "center" }}>📝 AI Worksheet Generator</h2>
          <div style={{ width: "100px" }}></div>
        </div>

        {/* Main Content Card */}
        <div style={mainCardStyle}>
          {/* Step 1: Selection Details */}
          <h4 style={step1TitleStyle}>Step 1: Selection Details</h4>
          <div style={gridStyle}>
            <div className="input-group">
              <label style={labelStyle}>Class</label>
              <select style={selectStyle} value={selectedClass} onChange={(e) => handleClassChange(e.target.value)}>
                <option value="">-- Select Class --</option>
                {classList.map(c => <option key={c.class_name} value={c.class_name}>{c.class_name}</option>)}
              </select>
            </div>
            <div className="input-group">
              <label style={labelStyle}>Subject</label>
              <select style={selectStyle} disabled={!selectedClass} value={selectedSubject} onChange={(e) => handleSubjectChange(e.target.value)}>
                <option value="">-- Select Subject --</option>
                {subjectList.map(s => <option key={s.subject_id} value={s.subject_id}>{s.name}</option>)}
              </select>
            </div>
            <div className="input-group">
              <label style={labelStyle}>Chapter</label>
              <select style={selectStyle} disabled={!selectedSubject} value={selectedChapter} onChange={(e) => handleChapterChange(e.target.value)}>
                <option value="">-- Select Chapter --</option>
                {chapterList.map(ch => <option key={ch.chapter_id} value={ch.chapter_id}>Ch {ch.chapter_no}: {ch.name}</option>)}
              </select>
            </div>
            <div className="input-group">
              <label style={labelStyle}>Topic</label>
              <select style={selectStyle} disabled={!selectedChapter} value={selectedTopicId} onChange={(e) => setSelectedTopicId(e.target.value)}>
                <option value="">-- Select Topic --</option>
                {topicList.map(t => <option key={t.topic_id} value={t.topic_id}>{t.name}</option>)}
              </select>
            </div>
          </div>

          <hr style={hrStyle} />

          {/* Step 2: Configuration & Optional Sample */}
          <h4 style={step2TitleStyle}>Step 2: Configuration</h4>
          
          {/* Optional Sample Worksheet Section */}
          <div style={sampleSectionStyle}>
            {!showSampleInput ? (
              <button onClick={() => setShowSampleInput(true)} style={addSampleButtonStyle}>
                + Add a reference sample worksheet (Optional)
              </button>
            ) : (
              <div style={uploadBoxStyle}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "10px" }}>
                  <span style={{ fontSize: "14px", fontWeight: "bold", color: "#333" }}>Upload Reference File:</span>
                  <button onClick={() => { setShowSampleInput(false); setSampleFile(null); }} style={cancelButtonStyle}>Cancel</button>
                </div>
                <input 
                  type="file" 
                  accept=".pdf,.txt" 
                  onChange={(e) => setSampleFile(e.target.files[0])} 
                  style={{ fontSize: "13px" }}
                />
                <p style={helperTextStyle}>*এই ফাইলটি ডাটাবেজে জমা হবে না, শুধু এই জেনারেশনের জন্য এআই রেফারেন্স হিসেবে নিবে।</p>
              </div>
            )}
          </div>
          
          <div style={{ marginTop: "20px" }}>
            <WorksheetGenerator 
              selectedTopicId={selectedTopicId} 
              user={user}
              sampleFile={sampleFile} // এই প্রপসটি WorksheetGenerator এ পাঠাচ্ছি
            />
          </div>
        </div>
      </div>
    </div>
  );
}

// Styles
const headerStyle = { display: "flex", alignItems: "center", backgroundColor: "white", padding: "15px 25px", borderRadius: "12px", boxShadow: "0 2px 8px rgba(0,0,0,0.05)" };
const backButtonStyle = { padding: "8px 16px", cursor: "pointer", borderRadius: "6px", border: "1px solid #ddd", backgroundColor: "#fff", marginRight: "20px" };
const mainCardStyle = { backgroundColor: "white", padding: "30px", borderRadius: "12px", boxShadow: "0 4px 15px rgba(0,0,0,0.1)", border: "1px solid #e8e8e8" };
const step1TitleStyle = { marginTop: 0, color: "#333", borderBottom: "2px solid #52c41a", display: "inline-block", paddingBottom: "5px" };
const step2TitleStyle = { marginTop: 0, color: "#333", borderBottom: "2px solid #1890ff", display: "inline-block", paddingBottom: "5px", marginBottom: "20px" };
const gridStyle = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "20px", marginTop: "20px", marginBottom: "30px" };
const labelStyle = { display: "block", fontSize: "13px", fontWeight: "bold", marginBottom: "5px", color: "#666" };
const selectStyle = { width: "100%", padding: "10px", borderRadius: "6px", border: "1px solid #ccc", backgroundColor: "#fff", fontSize: "14px", outline: "none" };
const hrStyle = { border: "0", borderTop: "1px solid #eee", margin: "30px 0" };

// Sample Section Styles
const sampleSectionStyle = { marginBottom: "20px" };
const addSampleButtonStyle = { background: "none", border: "none", color: "#1890ff", cursor: "pointer", fontWeight: "600", fontSize: "14px", padding: 0 };
const uploadBoxStyle = { padding: "15px", border: "1px dashed #cbd5e0", borderRadius: "8px", backgroundColor: "#f8fafc" };
const cancelButtonStyle = { color: "#ff4d4f", border: "none", background: "none", cursor: "pointer", fontSize: "12px", fontWeight: "bold" };
const helperTextStyle = { fontSize: "11px", color: "#718096", marginTop: "8px" };