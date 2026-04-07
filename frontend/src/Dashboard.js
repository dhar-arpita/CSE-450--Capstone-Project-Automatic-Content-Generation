

import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';

import { 
  getClasses, getSubjects, getChapters, getTopics, 
  uploadCurriculumFile, getIngestionStatus, askQuestion, generateFlashcard 
} from "./api";

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

  useEffect(() => {
    const storedUser = localStorage.getItem("user");
    if (!storedUser) navigate("/"); 
    const parsedUser = JSON.parse(storedUser);
    setUser(parsedUser);

    
    loadClasses();
  }, [navigate]);

  // --- Dropdown Logic ---
  const loadClasses = async () => {
    try {
      const { data } = await getClasses();
      setClassList(data);
    } catch (err) { console.error("Error loading classes"); }
  };

  const handleClassChange = async (className) => {
    setSelectedClass(className);
    setSubjectList([]); setChapterList([]); setTopicList([]);
    try {
      const { data } = await getSubjects(className);
      setSubjectList(data);
    } catch (err) { console.error(err); }
  };

  const handleSubjectChange = async (subjectId) => {
    setSelectedSubject(subjectId);
    setChapterList([]); setTopicList([]);
    try {
      const { data } = await getChapters(subjectId);
      setChapterList(data);
    } catch (err) { console.error(err); }
  };

  const handleChapterChange = async (chapterId) => {
    setSelectedChapter(chapterId);
    setTopicList([]);
    try {
      const { data } = await getTopics(chapterId);
      setTopicList(data);
    } catch (err) { console.error(err); }
  };

  // --- Upload & Ingestion Logic ---
  const handleUpload = async () => {
    if (!file || !selectedTopicId) {
      alert("Please select a file and a Topic first!");
      return;
    }
    setLoading(true);
    setIngestionStatus("Uploading...");
    try {
      
      const { data } = await uploadCurriculumFile(file, selectedTopicId, user.user_id || 1);
      setIngestionStatus("Job Queued. Processing...");
      startPolling(data.job_id);
    } catch (err) {
      setIngestionStatus("Upload Failed");
      setLoading(false);
    }
  };

  const startPolling = (jobId) => {
    const interval = setInterval(async () => {
      try {
        const { data } = await getIngestionStatus(jobId);
        setIngestionStatus(`Status: ${data.job_status}...`);
        
        if (data.job_status === "SUCCESS") {
          clearInterval(interval);
          setIngestionStatus(" Upload Successfully!");
          setLoading(false);
        } else if (data.job_status === "FAILED") {
          clearInterval(interval);
          setIngestionStatus(` Failed: ${data.error_message}`);
          setLoading(false);
        }
      } catch (err) { clearInterval(interval); setLoading(false); }
    }, 3000);
  };

  // --- Existing Logic for Flashcards & Ask ---
  const handleGenerate = async () => {
    if (!topicSearch) return;
    setLoading(true); setFlashcard(null);
    try {
      const { data } = await generateFlashcard(topicSearch);
      setFlashcard(data);
    } catch (err) { alert("Generation Failed"); }
    setLoading(false);
  };

  const handleAsk = async () => {
    if (!question) return;
    setLoading(true); setAnswer(""); 
    try {
      const { data } = await askQuestion(question);
      setAnswer(data.answer); 
    } catch (err) { alert("Failed to get answer"); }
    setLoading(false);
  };

  return (
    <div style={{ padding: "40px", maxWidth: "900px", margin: "auto", fontFamily: "Arial" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h2>Automated Content Generation</h2>
        <div>
          <span>Welcome, <strong>{user?.name}</strong> </span>
          <button onClick={() => { localStorage.clear(); navigate("/"); }}>Logout</button>
        </div>
      </div>
      
<<<<<<< Updated upstream
      {/* 1. UPLOAD SECTION WITH DROPDOWNS */}
      <div style={{ border: "2px solid #1890ff", padding: "20px", marginTop: "20px", borderRadius: "8px" }}>
        <h3> 1. Upload Curriculum Material</h3>
=======
      {/* SECTION 1: UPLOAD AREA */}
      {/* <div style={{ border: "1px solid #1890ff", padding: "20px", marginBottom: "30px", borderRadius: "12px", boxShadow: "0 4px 6px rgba(0,0,0,0.05)" }}>
        <h3 style={{ marginTop: 0 }}>📁 1. Upload Curriculum Material</h3>
        <p style={{ fontSize: "13px", color: "#666" }}>Select the exact topic where this file belongs.</p>
>>>>>>> Stashed changes
        
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "15px" }}>
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

        <div style={{ display: "flex", gap: "10px" }}>
          <input type="file" onChange={(e) => setFile(e.target.files[0])} style={{ flex: 1 }} />
          <button onClick={handleUpload} disabled={loading || !selectedTopicId} style={{ backgroundColor: "#1890ff", color: "white", padding: "5px 20px" }}>
            {loading && ingestionStatus.includes("Status") ? "Processing..." : "Upload & Process"}
          </button>
        </div>
<<<<<<< Updated upstream
        
        {ingestionStatus && (
          <p style={{ marginTop: "10px", color: ingestionStatus.includes("✅") ? "green" : "#666" }}>
            <strong>Status:</strong> {ingestionStatus}
          </p>
        )}
      </div>

      {/* 2. FLASHCARD */}
      <div style={{ border: "1px solid #ddd", padding: "20px", marginTop: "20px", borderRadius: "8px" }}>
        <h3> 2. Generate Study Flashcard</h3>
        <div style={{ display: "flex", gap: "10px" }}>
          <input placeholder="Enter topic (e.g. Newton's Law)" value={topicSearch} onChange={(e) => setTopicSearch(e.target.value)} style={{ flex: 1, padding: "8px" }} />
          <button onClick={handleGenerate} disabled={loading}>Generate</button>
=======
        {ingestionStatus && <div style={{ marginTop: "12px", fontWeight: "bold", color: ingestionStatus.includes("✅") ? "green" : "#444" }}>{ingestionStatus}</div>}
      </div> */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px", marginTop: "40px" }}>
      <div 
        onClick={() => navigate("/upload")}
        style={{ padding: "30px", border: "2px solid #1890ff", borderRadius: "15px", cursor: "pointer", textAlign: "center", transition: "0.3s" }}
      >
        <h1 style={{ fontSize: "40px" }}>📁</h1>
        <h3>Upload Material</h3>
        {/* <p>নতুন কারিকুলাম ফাইল আপলোড এবং ইনজেস্ট করুন</p> */}
      </div>

      {/* SECTION 2: WORKSHEET GENERATOR */}
      {/* এখানে আমরা সব লজিক এবং লিস্টগুলো পাস করছি যাতে জেনারেটর সেকশনে ড্রপডাউনগুলো দেখা যায় */}
      {/* <WorksheetGenerator 
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
      /> */}
      <div 
        onClick={() => navigate("/generate")}
        style={{ padding: "30px", border: "2px solid #52c41a", borderRadius: "15px", cursor: "pointer", textAlign: "center" }}
      >
        <h1 style={{ fontSize: "40px" }}>📝</h1>
        <h3>Generate Worksheet</h3>
        {/* <p>AI ব্যবহার করে অটোমেটিক ওয়ার্কশিট তৈরি করুন</p> */}
      </div>

    </div>

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
>>>>>>> Stashed changes
        </div>

        {flashcard && flashcard.flashcard && (
          <div style={{ marginTop: "15px", padding: "15px", backgroundColor: "#e6f7ff", borderLeft: "5px solid #1890ff", borderRadius: "4px" }}>
            <p><strong>Q:</strong> {flashcard.flashcard.question}</p>
            <hr />
            <p><strong>A:</strong> {flashcard.flashcard.answer}</p>
          </div>
        )}
      </div>

      {/* 3. CHAT WITH PDF */}
      <div style={{ border: "1px solid #ddd", padding: "20px", marginTop: "20px", borderRadius: "8px" }}>
        <h3> 3. Chat with Curriculum Docs</h3>
        <div style={{ display: "flex", gap: "10px" }}>
          <input 
            placeholder="Ask AI anything about the uploaded materials..." 
            value={question} 
            onChange={(e) => setQuestion(e.target.value)} 
            style={{ flex: 1, padding: "8px" }}
          />
          <button onClick={handleAsk} disabled={loading} style={{ backgroundColor: "#52c41a", color: "white" }}>Ask AI</button>
        </div>

        {answer && (
          <div style={{ marginTop: "15px", padding: "15px", backgroundColor: "#f6ffed", borderLeft: "5px solid #52c41a", borderRadius: "4px" }}>
            <strong> AI Answer:</strong>
            <div style={{ lineHeight: "1.6", marginTop: "10px" }}>
              <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                {answer}
              </ReactMarkdown>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}