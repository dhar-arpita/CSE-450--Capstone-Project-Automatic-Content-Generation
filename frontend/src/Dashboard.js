
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';

// API Functions
import { 
  getClasses, getSubjects, getChapters, getTopics, 
  uploadCurriculumFile, getIngestionStatus, askQuestion, generateFlashcard 
} from "./api";


import WorksheetGenerator from "./WorksheetGenerator";

export default function Dashboard() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  // --- Curriculum States ---
  const [classList, setClassList] = useState([]);
  const [subjectList, setSubjectList] = useState([]);
  const [chapterList, setChapterList] = useState([]);
  const [topicList, setTopicList] = useState([]);

  const [selectedClass, setSelectedClass] = useState("");
  const [selectedSubject, setSelectedSubject] = useState("");
  const [selectedChapter, setSelectedChapter] = useState("");
  const [selectedTopicId, setSelectedTopicId] = useState("");

  // --- File & Status States ---
  const [file, setFile] = useState(null);
  const [ingestionStatus, setIngestionStatus] = useState("");
  
  // --- RAG States ---
  const [topicSearch, setTopicSearch] = useState("");
  const [flashcard, setFlashcard] = useState(null);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");

  // ১. ইউজার সেশন চেক এবং ক্লাস লোড করা
  useEffect(() => {
    const storedUser = localStorage.getItem("user");
    if (!storedUser) {
        navigate("/"); 
    } else {
        const parsedUser = JSON.parse(storedUser);
        setUser(parsedUser);
        loadClasses();
    }
  }, [navigate]);

  // --- ড্রপডাউন চেইন লজিক ---
  const loadClasses = async () => {
    try {
      const { data } = await getClasses();
      setClassList(data);
    } catch (err) { console.error("Classes load failed", err); }
  };

  const handleClassChange = async (className) => {
    setSelectedClass(className);
    setSubjectList([]); setChapterList([]); setTopicList([]);
    setSelectedSubject(""); setSelectedChapter(""); setSelectedTopicId("");
    try {
      const { data } = await getSubjects(className);
      setSubjectList(data);
    } catch (err) { console.error(err); }
  };

  const handleSubjectChange = async (subjectId) => {
    setSelectedSubject(subjectId);
    setChapterList([]); setTopicList([]);
    setSelectedChapter(""); setSelectedTopicId("");
    try {
      const { data } = await getChapters(subjectId);
      setChapterList(data);
    } catch (err) { console.error(err); }
  };

  const handleChapterChange = async (chapterId) => {
    setSelectedChapter(chapterId);
    setTopicList([]);
    setSelectedTopicId("");
    try {
      const { data } = await getTopics(chapterId);
      setTopicList(data);
    } catch (err) { console.error(err); }
  };

  
  const handleUpload = async () => {
    if (!file || !selectedTopicId) {
      alert("Please select Class, Subject, Chapter, Topic and a File!");
      return;
    }
    setLoading(true);
    setIngestionStatus("Uploading...");
    try {
      const { data } = await uploadCurriculumFile(file, selectedTopicId, user.user_id || 1);
      setIngestionStatus("Job Queued. Processing...");
      startPolling(data.job_id);
    } catch (err) {
      setIngestionStatus("❌ Upload Failed");
      setLoading(false);
    }
  };

  const startPolling = (jobId) => {
    const interval = setInterval(async () => {
      try {
        const { data } = await getIngestionStatus(jobId);
        setIngestionStatus(`Processing: ${data.job_status}...`);
        if (data.job_status === "SUCCESS") {
          clearInterval(interval);
          setIngestionStatus("✅ Upload Successfully!");
          setLoading(false);
        } else if (data.job_status === "FAILED") {
          clearInterval(interval);
          setIngestionStatus(`❌ Failed: ${data.error_message}`);
          setLoading(false);
        }
      } catch (err) { 
          clearInterval(interval); 
          setLoading(false); 
      }
    }, 3000);
  };


  const handleGenerateFlashcard = async () => {
    if (!topicSearch) return;
    setLoading(true); setFlashcard(null);
    try {
      const { data } = await generateFlashcard(topicSearch);
      setFlashcard(data);
    } catch (err) { alert("Flashcard Generation Failed"); }
    setLoading(false);
  };

  const handleAskAI = async () => {
    if (!question) return;
    setLoading(true); setAnswer(""); 
    try {
      const { data } = await askQuestion(question);
      setAnswer(data.answer); 
    } catch (err) { alert("AI Answer Failed"); }
    setLoading(false);
  };

  return (
    <div style={{ padding: "40px", maxWidth: "1000px", margin: "auto", fontFamily: "Segoe UI, sans-serif", backgroundColor: "#fdfdfd" }}>
      
      {/* HEADER SECTION */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "2px solid #1890ff", paddingBottom: "15px", marginBottom: "30px" }}>
        <h2 style={{ color: "#1890ff", margin: 0 }}>EduAI Capstone: Content Hub</h2>
        <div style={{ textAlign: "right" }}>
          <span>Welcome, <strong>{user?.name}</strong> </span><br/>
          <button 
            onClick={() => { localStorage.clear(); navigate("/"); }}
            style={{ marginTop: "5px", color: "red", border: "1px solid red", background: "none", cursor: "pointer", borderRadius: "4px", fontSize: "12px" }}
          >Logout</button>
        </div>
      </div>
      
      {/* SECTION 1: UPLOAD AREA */}
      <div style={{ border: "1px solid #1890ff", padding: "20px", marginBottom: "30px", borderRadius: "12px", boxShadow: "0 4px 6px rgba(0,0,0,0.05)" }}>
        <h3 style={{ marginTop: 0 }}>📁 1. Upload Curriculum Material</h3>
        <p style={{ fontSize: "13px", color: "#666" }}>Select the exact topic where this file belongs.</p>
        
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "15px" }}>
          <select value={selectedClass} onChange={(e) => handleClassChange(e.target.value)}>
            <option value="">-- Select Class --</option>
            {classList.map(c => <option key={c.class_name} value={c.class_name}>{c.class_name}</option>)}
          </select>
          <select disabled={!selectedClass} value={selectedSubject} onChange={(e) => handleSubjectChange(e.target.value)}>
            <option value="">-- Select Subject --</option>
            {subjectList.map(s => <option key={s.subject_id} value={s.subject_id}>{s.name}</option>)}
          </select>
          <select disabled={!selectedSubject} value={selectedChapter} onChange={(e) => handleChapterChange(e.target.value)}>
            <option value="">-- Select Chapter --</option>
            {chapterList.map(ch => <option key={ch.chapter_id} value={ch.chapter_id}>Ch {ch.chapter_no}: {ch.name}</option>)}
          </select>
          <select disabled={!selectedChapter} value={selectedTopicId} onChange={(e) => setSelectedTopicId(e.target.value)}>
            <option value="">-- Select Topic --</option>
            {topicList.map(t => <option key={t.topic_id} value={t.topic_id}>{t.name}</option>)}
          </select>
        </div>

        <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
          <input type="file" onChange={(e) => setFile(e.target.files[0])} style={{ flex: 1, padding: "5px", border: "1px dashed #ccc" }} />
          <button 
            onClick={handleUpload} 
            disabled={loading || !selectedTopicId} 
            style={{ backgroundColor: "#1890ff", color: "white", padding: "8px 25px", border: "none", borderRadius: "6px", cursor: "pointer", fontWeight: "bold" }}
          >
            {loading && ingestionStatus.includes("Processing") ? "Processing..." : "Upload & Ingest"}
          </button>
        </div>
        {ingestionStatus && <div style={{ marginTop: "12px", fontWeight: "bold", color: ingestionStatus.includes("✅") ? "green" : "#444" }}>{ingestionStatus}</div>}
      </div>

      {/* SECTION 2: WORKSHEET GENERATOR */}
      {/* এখানে আমরা সব লজিক এবং লিস্টগুলো পাস করছি যাতে জেনারেটর সেকশনে ড্রপডাউনগুলো দেখা যায় */}
      <WorksheetGenerator 
        classList={classList}
        subjectList={subjectList}
        chapterList={chapterList}
        topicList={topicList}
        selectedClass={selectedClass}
        selectedSubject={selectedSubject}
        selectedChapter={selectedChapter}
        selectedTopicId={selectedTopicId}
        handleClassChange={handleClassChange}
        handleSubjectChange={handleSubjectChange}
        handleChapterChange={handleChapterChange}
        setSelectedTopicId={setSelectedTopicId}
      />

      {/* SECTION 3: FLASHCARDS & CHAT (RAG) */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "25px", marginTop: "30px" }}>
        
        {/* Flashcard Side */}
        <div style={{ border: "1px solid #ddd", padding: "15px", borderRadius: "10px" }}>
          <h4>🗂️ Generate Flashcard</h4>
          <input 
            placeholder="Topic (e.g. Comparison of numbers)" 
            value={topicSearch} 
            onChange={(e) => setTopicSearch(e.target.value)} 
            style={{ width: "93%", padding: "8px", marginBottom: "10px" }} 
          />
          <button onClick={handleGenerateFlashcard} disabled={loading} style={{ width: "100%", cursor: "pointer" }}>Generate</button>
          
          {flashcard?.flashcard && (
            <div style={{ marginTop: "15px", padding: "10px", backgroundColor: "#fffbe6", border: "1px solid #ffe58f", borderRadius: "5px" }}>
              <strong>Q:</strong> {flashcard.flashcard.question}<br/><hr/>
              <strong>A:</strong> {flashcard.flashcard.answer}
            </div>
          )}
        </div>

        {/* Chat Side */}
        <div style={{ border: "1px solid #ddd", padding: "15px", borderRadius: "10px" }}>
          <h4>🤖 Ask AI (RAG)</h4>
          <input 
            placeholder="Ask about salary grades or comparison..." 
            value={question} 
            onChange={(e) => setQuestion(e.target.value)} 
            style={{ width: "93%", padding: "8px", marginBottom: "10px" }} 
          />
          <button onClick={handleAskAI} disabled={loading} style={{ width: "100%", backgroundColor: "#52c41a", color: "white", border: "none", padding: "8px", cursor: "pointer", borderRadius: "4px" }}>Ask AI</button>
          
          {answer && (
            <div style={{ marginTop: "15px", maxHeight: "200px", overflowY: "auto", fontSize: "14px", padding: "10px", backgroundColor: "#f6ffed", border: "1px solid #b7eb8f" }}>
              <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>{answer}</ReactMarkdown>
            </div>
          )}
        </div>

      </div>

    </div>
  );
}