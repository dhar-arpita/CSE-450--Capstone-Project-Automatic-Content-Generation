// features/chatbot/ChatbotPage.js
// Chat-feed + history + BILINGUAL UI + SIDEBAR (Claude-style session list) + scroll-fix.
// Sidebar: session list (nijei scroll), "New conversation" (landing e fere), click -> session load.
// Refresh e last session fere; logout->login e landing (localStorage.clear diye).

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  getClasses, getSubjects, getChapters, getTopics, chatHistory, chatSessions,
} from "../../shared/services/api";
import { useChatSession } from "../../shared/services/useChatSession";

/* ---------- bilingual UI text ---------- */
const TXT = {
  bangla: {
    subtitle: "প্রশ্ন করো বা প্র্যাকটিস করো — তোমার ভাষায়",
    step1: "তুমি কী নিয়ে পড়তে চাও?",
    selectClass: "Select class", selectSubject: "Select subject",
    selectChapter: "Select chapter", selectTopic: "Select topic",
    classL: "Class", subjectL: "Subject", chapterL: "Chapter (optional)", topicL: "Topic (optional)",
    lang: "ভাষা:",
    hintReady: "নিচের একটা tab বেছে নাও — যা করবে সব এখানে জমতে থাকবে, scroll করে আগেরগুলা দেখতে পারবে।",
    hintPick: "শুরু করতে অন্তত Subject select করো।",
    tabQA: "❓ প্রশ্ন করো", tabSet: "📝 প্র্যাকটিস সেট", tabOne: "🎯 একটা একটা করে",
    qaTitle: "❓ প্রশ্ন করো",
    samplesHint: "নিচের যেকোনো প্রশ্নে ক্লিক করো, অথবা নিজে টাইপ করো:",
    askPlaceholder: "আরেকটা প্রশ্ন লেখো...", askBtn: "জিজ্ঞেস করো",
    answering: "⌛ উত্তর তৈরি হচ্ছে...",
    keyPoints: "🔑 মূল পয়েন্ট", formula: "📐 সূত্র", examples: "💡 উদাহরণ", summary: "📌 সারসংক্ষেপ",
    explainMore: "🔍 আরও বুঝিয়ে বলো", explaining: "⌛ আরও বোঝাচ্ছি...",
    detailTitle: "🔍 বিস্তারিত ব্যাখ্যা", moreExamples: "আরও উদাহরণ",
    setTitle: "📝 প্র্যাকটিস সেট", setLabel: "সেট",
    generating: "⌛ প্রশ্ন তৈরি হচ্ছে...",
    showAns: "👁️ উত্তর দেখাও", hideAns: "উত্তর লুকাও", anotherSet: "🔄 আরেকটা সেট দাও",
    oneTitle: "🎯 একটা একটা করে", qLabel: "প্রশ্ন",
    hintBtn: "💡 Hint দাও", revealAns: "উত্তর দেখাও", nextQ: "➡️ পরের প্রশ্ন",
    didSolve: "তুমি কি পেরেছিলে?", solved: "✅ পেরেছি", notSolved: "❌ পারিনি",
    solvedMsg: "🎉 দারুণ!", notSolvedMsg: "ঠিক আছে, পরের বার হবে।",
    newChat: "➕ New conversation", history: "আগের সেশন", noSessions: "কোনো আগের সেশন নেই",
  },
  english: {
    subtitle: "Ask questions or practice — in your language",
    step1: "What do you want to study?",
    selectClass: "Select class", selectSubject: "Select subject",
    selectChapter: "Select chapter", selectTopic: "Select topic",
    classL: "Class", subjectL: "Subject", chapterL: "Chapter (optional)", topicL: "Topic (optional)",
    lang: "Language:",
    hintReady: "Pick a tab below — everything you do stays here; scroll up to see earlier ones.",
    hintPick: "Select at least a Subject to start.",
    tabQA: "❓ Ask", tabSet: "📝 Practice Set", tabOne: "🎯 One by one",
    qaTitle: "❓ Ask a question",
    samplesHint: "Click any question below, or type your own:",
    askPlaceholder: "Type another question...", askBtn: "Ask",
    answering: "⌛ Generating answer...",
    keyPoints: "🔑 Key points", formula: "📐 Formula", examples: "💡 Examples", summary: "📌 Summary",
    explainMore: "🔍 Explain more", explaining: "⌛ Explaining...",
    detailTitle: "🔍 Detailed explanation", moreExamples: "More examples",
    setTitle: "📝 Practice Set", setLabel: "Set",
    generating: "⌛ Generating questions...",
    showAns: "👁️ Show answers", hideAns: "Hide answers", anotherSet: "🔄 Give another set",
    oneTitle: "🎯 One by one", qLabel: "Question",
    hintBtn: "💡 Hint", revealAns: "Show answer", nextQ: "➡️ Next question",
    didSolve: "Did you solve it?", solved: "✅ Got it", notSolved: "❌ Missed it",
    solvedMsg: "🎉 Great job!", notSolvedMsg: "That's okay — next time!",
    newChat: "➕ New conversation", history: "Past sessions", noSessions: "No past sessions",
  },
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function sessionTitle(s) {
  let str = `Session #${s.session_id}`;
  if (s.subject_name) str += ` · ${s.subject_name}`;
  if (s.start_time) {
    const d = new Date(s.start_time);
    if (!isNaN(d)) str += ` · ${MONTHS[d.getMonth()]} ${d.getDate()}`;
  }
  return str;
}

function SelectField({ label, icon, value, onChange, disabled, options, placeholder }) {
  return (
    <div style={fieldCardStyle}>
      <label style={labelStyle}><span>{icon}</span><span>{label}</span></label>
      <div style={{ position: "relative" }}>
        <select value={value} disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          style={{ ...selectStyle, ...(disabled ? disabledSelectStyle : {}) }}>
          <option value="">{placeholder}</option>
          {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <span style={caretStyle}>▾</span>
      </div>
    </div>
  );
}

let _bid = 0;
const newId = () => `b${++_bid}`;

export default function ChatbotPage() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);

  const [classList, setClassList] = useState([]);
  const [subjectList, setSubjectList] = useState([]);
  const [chapterList, setChapterList] = useState([]);
  const [topicList, setTopicList] = useState([]);
  const [selectedClass, setSelectedClass] = useState("");
  const [selectedSubject, setSelectedSubject] = useState("");
  const [selectedChapter, setSelectedChapter] = useState("");
  const [selectedTopicId, setSelectedTopicId] = useState("");
  const [language, setLanguage] = useState("bangla");
  const [mode, setMode] = useState(null);

  const t = TXT[language] || TXT.bangla;
  const studentId = user?.user_id || 1;

  const chat = useChatSession({
    studentId,
    subjectId: selectedSubject || null,
    chapterId: selectedChapter || null,
    topicId: selectedTopicId || null,
    language,
  });

  const [samples, setSamples] = useState([]);
  const [question, setQuestion] = useState("");
  const [qaFeed, setQaFeed] = useState([]);
  const [setFeed, setSetFeed] = useState([]);
  const [obFeed, setObFeed] = useState([]);
  const [busy, setBusy] = useState(false);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [sessions, setSessions] = useState([]);
  const [activeSid, setActiveSid] = useState(null);
  const feedEndRef = useRef(null);
  const prevCount = useRef(0);

  /* ---- clear only feeds ---- */
  const clearFeeds = () => {
    setSamples([]); setQuestion("");
    setQaFeed([]); setSetFeed([]); setObFeed([]); setMode(null);
  };

  /* ---- ekta session er history load kore feed sajai ---- */
  const loadHistory = useCallback(async (uid, sid) => {
    clearFeeds();
    try {
      const { data } = await chatHistory(uid, sid);
      if (data && data.session_id) {
        setActiveSid(data.session_id);

        // --- scope diye dropdown fill (tai session load korle shob mode khule) ---
        const sc = data.scope || {};
        if (sc.class_name) {
          setSelectedClass(sc.class_name);
          try { const r = await getSubjects(sc.class_name); setSubjectList(r.data || []); } catch { }
        }
        if (sc.subject_id) {
          setSelectedSubject(String(sc.subject_id));
          try { const r = await getChapters(sc.subject_id); setChapterList(r.data || []); } catch { }
        }
        if (sc.chapter_id) {
          setSelectedChapter(String(sc.chapter_id));
          try { const r = await getTopics(sc.chapter_id); setTopicList(r.data || []); } catch { }
        }
        if (sc.topic_id) setSelectedTopicId(String(sc.topic_id));

        // --- feed sajao (ager motoi) ---
        setQaFeed((data.qa || []).map((q) => ({ id: newId(), question: q.question, answer: q.answer, context: q.context || "", explain: q.explain || null, explainLoading: false, loading: false })));
        setSetFeed((data.sets || []).map((s, i, arr) => ({ id: newId(), questions: s.questions || [], showAnswers: false, isLatest: i === arr.length - 1, loading: false })));
        setObFeed((data.oneByone || []).map((o, i, arr) => ({ id: newId(), contentId: o.content_id, question: o.question, hints: o.hints || [], hintsUsed: o.hints_used || 0, answer: o.answer || null, selfReport: o.self_report ?? null, isLatest: i === arr.length - 1, loading: false })));
        if ((data.qa || []).length) setMode("qa");
        else if ((data.sets || []).length) setMode("set");
        else if ((data.oneByone || []).length) setMode("oneByone");
      }
    } catch { }
  }, []);
  /* ---- sidebar session list refresh ---- */
  const refreshSessions = useCallback(async (uid) => {
    try { const { data } = await chatSessions(uid); setSessions(data.sessions || []); }
    catch { setSessions([]); }
  }, []);

  /* ---- load user + classes + sessions ---- */
  useEffect(() => {
    const stored = localStorage.getItem("user");
    if (!stored) { navigate("/"); return; }
    const u = JSON.parse(stored);
    setUser(u);
    getClasses().then(({ data }) => setClassList(data || [])).catch(() => { });
    refreshSessions(u.user_id);
  }, [navigate, refreshSessions]);

  /* ---- refresh e last session fere (localStorage e session thakle) ---- */
  useEffect(() => {
    if (!user || historyLoaded) return;
    (async () => {
      const sid = chat.getSessionId();
      if (sid) await loadHistory(user.user_id, sid);   // sid nai (logout->login) hole landing
      setHistoryLoaded(true);
    })();
  }, [user, historyLoaded, chat, loadHistory]);

  /* ---- auto-scroll SHUDHU notun block jog hole ---- */
  useEffect(() => {
    const count = qaFeed.length + setFeed.length + obFeed.length;
    if (count > prevCount.current) feedEndRef.current?.scrollIntoView({ behavior: "smooth" });
    prevCount.current = count;
  }, [qaFeed, setFeed, obFeed]);

  /* ---- sidebar: purono session e click ---- */
  const openSession = async (sid) => {
    if (sid === activeSid) return;
    chat.setSessionId(sid);
    await loadHistory(user.user_id, sid);
  };

  /* ---- "New conversation": landing e fere (session create na, feed+selection clear) ---- */
  const newChat = () => {
    chat.resetSession();
    setActiveSid(null);
    clearFeeds();
    setSelectedClass(""); setSelectedSubject(""); setSelectedChapter(""); setSelectedTopicId("");
    setSubjectList([]); setChapterList([]); setTopicList([]);
  };

  /* ---- selection bodlale: notun session + feed clear ---- */
  const resetOnSelectionChange = () => { chat.resetSession(); setActiveSid(null); clearFeeds(); };

  const onClass = async (v) => {
    setSelectedClass(v);
    setSubjectList([]); setChapterList([]); setTopicList([]);
    setSelectedSubject(""); setSelectedChapter(""); setSelectedTopicId("");
    resetOnSelectionChange();
    if (v) { try { const { data } = await getSubjects(v); setSubjectList(data || []); } catch { } }
  };
  const onSubject = async (v) => {
    setSelectedSubject(v);
    setChapterList([]); setTopicList([]); setSelectedChapter(""); setSelectedTopicId("");
    resetOnSelectionChange();
    if (v) { try { const { data } = await getChapters(v); setChapterList(data || []); } catch { } }
  };
  const onChapter = async (v) => {
    setSelectedChapter(v);
    setTopicList([]); setSelectedTopicId("");
    resetOnSelectionChange();
    if (v) { try { const { data } = await getTopics(v); setTopicList(data || []); } catch { } }
  };
  const onTopic = (v) => { setSelectedTopicId(v); resetOnSelectionChange(); };
  const onLanguage = (v) => { if (!langLocked) setLanguage(v); };   // locked hole bodlabe na
  const canStart = !!selectedSubject;
  const langLocked = qaFeed.length > 0 || setFeed.length > 0 || obFeed.length > 0;  // session shuru hole lock

  const afterFirstContent = () => refreshSessions(user.user_id);

  /* ================= Q&A ================= */
  const openQA = async () => {
    setMode("qa");
    if (qaFeed.length === 0) { try { const d = await chat.askSamples(); setSamples(d.samples || []); } catch { setSamples([]); } }
  };
  const doAsk = async (q) => {
    const query = (q ?? question).trim();
    if (!query || busy) return;
    setBusy(true); setQuestion("");
    const id = newId();
    const wasNew = chat.getSessionId() == null;
    setQaFeed((f) => [...f, { id, question: query, answer: null, context: "", explain: null, explainLoading: false, loading: true }]);
    try {
      const d = await chat.ask(query);
      setQaFeed((f) => f.map((b) => b.id === id ? { ...b, answer: d.answer || null, context: d.context || "", loading: false } : b));
      setActiveSid(chat.getSessionId());
      if (wasNew) afterFirstContent();
    } catch { setQaFeed((f) => f.map((b) => b.id === id ? { ...b, loading: false } : b)); }
    setBusy(false);
  };
  const doExplainMore = async (id) => {
    const block = qaFeed.find((b) => b.id === id);
    if (!block || !block.answer) return;
    setQaFeed((f) => f.map((b) => b.id === id ? { ...b, explainLoading: true } : b));
    try {
      const d = await chat.explainMore(block.question, block.answer, block.context);
      setQaFeed((f) => f.map((b) => b.id === id ? { ...b, explain: d.detail || null, explainLoading: false } : b));
    } catch { setQaFeed((f) => f.map((b) => b.id === id ? { ...b, explainLoading: false } : b)); }
  };

  /* ================= PRACTICE SET ================= */
  const openSet = () => { setMode("set"); if (setFeed.length === 0) addSet(); };
  const addSet = async () => {
    if (busy) return;
    setBusy(true);
    const id = newId();
    const wasNew = chat.getSessionId() == null;
    setSetFeed((f) => [...f.map((b) => ({ ...b, isLatest: false })), { id, questions: [], showAnswers: false, isLatest: true, loading: true }]);
    try {
      const d = await chat.practiceSet("medium", 5);
      setSetFeed((f) => f.map((b) => b.id === id ? { ...b, questions: d.questions || [], loading: false } : b));
      setActiveSid(chat.getSessionId());
      if (wasNew) afterFirstContent();
    } catch { setSetFeed((f) => f.map((b) => b.id === id ? { ...b, loading: false } : b)); }
    setBusy(false);
  };
  const toggleSetAnswers = (id) => setSetFeed((f) => f.map((b) => b.id === id ? { ...b, showAnswers: !b.showAnswers } : b));

  /* ================= ONE-BY-ONE ================= */
  const openOneByOne = () => { setMode("oneByone"); if (obFeed.length === 0) startOB(); };
  const startOB = async () => {
    if (busy) return;
    setBusy(true);
    const id = newId();
    const wasNew = chat.getSessionId() == null;
    setObFeed((f) => [...f.map((b) => ({ ...b, isLatest: false })), { id, contentId: null, question: "", hints: [], hintsUsed: 0, answer: null, selfReport: null, isLatest: true, loading: true }]);
    try {
      const d = await chat.startSession();
      setObFeed((f) => f.map((b) => b.id === id ? { ...b, contentId: d.content_id, question: d.question || "", loading: false } : b));
      setActiveSid(chat.getSessionId());
      if (wasNew) afterFirstContent();
    } catch { setObFeed((f) => f.map((b) => b.id === id ? { ...b, loading: false } : b)); }
    setBusy(false);
  };
  const nextOB = async () => {
    if (busy) return;
    setBusy(true);
    const id = newId();
    setObFeed((f) => [...f.map((b) => ({ ...b, isLatest: false })), { id, contentId: null, question: "", hints: [], hintsUsed: 0, answer: null, selfReport: null, isLatest: true, loading: true }]);
    try {
      const d = await chat.nextQuestion("medium");
      setObFeed((f) => f.map((b) => b.id === id ? { ...b, contentId: d.content_id, question: d.question || "", loading: false } : b));
    } catch { setObFeed((f) => f.map((b) => b.id === id ? { ...b, loading: false } : b)); }
    setBusy(false);
  };
  const obHint = async (id) => {
    const block = obFeed.find((b) => b.id === id);
    if (!block || block.hintsUsed >= 3) return;
    try {
      const d = await chat.getHint(block.contentId, block.hintsUsed);
      if (d.hint) setObFeed((f) => f.map((b) => b.id === id ? { ...b, hints: [...b.hints, d.hint], hintsUsed: d.hints_used } : b));
    } catch { }
  };
  const obReveal = async (id) => {
    const block = obFeed.find((b) => b.id === id);
    if (!block) return;
    try {
      const d = await chat.showAnswer(block.contentId, block.hintsUsed, null, null);
      setObFeed((f) => f.map((b) => b.id === id ? { ...b, answer: d.answer || "" } : b));
    } catch { }
  };
  const obReport = async (id, didSolve) => {
    const block = obFeed.find((b) => b.id === id);
    if (!block) return;
    setObFeed((f) => f.map((b) => b.id === id ? { ...b, selfReport: didSolve } : b));
    try { await chat.showAnswer(block.contentId, block.hintsUsed, didSolve, null); } catch { }
  };

  /* ======================= RENDER ======================= */
  return (
    <div style={pageStyle}>
      <div style={ambientOrbA} /><div style={ambientOrbB} />

      <div style={layoutStyle}>
        {/* ===== SIDEBAR ===== */}
        <aside style={sidebarStyle}>
          <button onClick={newChat} style={newChatBtn}>{t.newChat}</button>
          <div style={{ fontSize: "11px", fontWeight: 800, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.06em", margin: "14px 4px 8px" }}>{t.history}</div>
          <div style={{ display: "flex", flexDirection: "column", gap: "6px", overflowY: "auto", flex: 1, minHeight: 0, paddingRight: "4px" }}>
            {sessions.length === 0 && <div style={{ fontSize: "12px", color: "#94a3b8", padding: "8px 4px" }}>{t.noSessions}</div>}
            {sessions.map((s) => (
              <button key={s.session_id} onClick={() => openSession(s.session_id)} style={sessionItem(s.session_id === activeSid)}>
                {sessionTitle(s)}
              </button>
            ))}
          </div>
        </aside>

        {/* ===== MAIN ===== */}
        <div style={containerStyle}>
          <header style={topBarStyle}>
            <button onClick={() => navigate(-1)} style={backButtonStyle}>← Dashboard</button>
            <div style={{ textAlign: "center" }}>
              <h1 style={titleStyle}>💬 Study Chatbot</h1>
              <p style={subtitleStyle}>{t.subtitle}</p>
            </div>
            <div style={userPillStyle}>👋 {user?.name?.split(" ")[0] || "Student"}</div>
          </header>

          <main style={mainCardStyle}>
            <div style={sectionHeaderStyle}>
              <span style={stepBadgeStyle}>STEP 1</span>
              <h3 style={sectionTitleStyle}>{t.step1}</h3>
            </div>
            <div style={gridStyle}>
              <SelectField label={t.classL} icon="🏫" value={selectedClass} onChange={onClass}
                placeholder={t.selectClass} options={classList.map((c) => ({ value: c.class_name, label: c.class_name }))} />
              <SelectField label={t.subjectL} icon="📚" value={selectedSubject} onChange={onSubject}
                disabled={!selectedClass} placeholder={t.selectSubject} options={subjectList.map((s) => ({ value: s.subject_id, label: s.name }))} />
              <SelectField label={t.chapterL} icon="🧩" value={selectedChapter} onChange={onChapter}
                disabled={!selectedSubject} placeholder={t.selectChapter} options={chapterList.map((ch) => ({ value: ch.chapter_id, label: `Ch ${ch.chapter_no}: ${ch.name}` }))} />
              <SelectField label={t.topicL} icon="🎯" value={selectedTopicId} onChange={onTopic}
                disabled={!selectedChapter} placeholder={t.selectTopic} options={topicList.map((tp) => ({ value: tp.topic_id, label: tp.name }))} />
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginTop: "14px" }}>
              <span style={{ fontSize: "13px", fontWeight: 700, color: "#475569" }}>{t.lang}</span>
              {[["bangla", "বাংলা"], ["english", "English"]].map(([val, lbl]) => (
                <button key={val} onClick={() => onLanguage(val)} disabled={langLocked}
                  style={{ ...pillBtn(language === val), opacity: langLocked && language !== val ? 0.4 : 1, cursor: langLocked ? "not-allowed" : "pointer" }}>
                  {lbl}
                </button>
              ))}
            </div>
            <div style={hintBoxStyle}>
              <span style={{ fontSize: "16px" }}>💡</span>
              <span style={hintTextStyle}>{canStart ? t.hintReady : t.hintPick}</span>
            </div>
            <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", marginTop: "8px" }}>
              <button onClick={openQA} disabled={!canStart} style={tabBtn("#4f46e5", mode === "qa", !canStart)}>{t.tabQA}</button>
              <button onClick={openSet} disabled={!canStart} style={tabBtn("#0ea5e9", mode === "set", !canStart)}>{t.tabSet}</button>
              <button onClick={openOneByOne} disabled={!canStart} style={tabBtn("#16a34a", mode === "oneByone", !canStart)}>{t.tabOne}</button>
            </div>
          </main>

          {/* Q&A */}
          {mode === "qa" && (
            <section style={mainCardStyle}>
              <h3 style={sectionTitleStyle}>{t.qaTitle}</h3>
              {qaFeed.length === 0 && samples.length > 0 && (
                <div style={{ marginTop: "12px" }}>
                  <p style={mutedLabel}>{t.samplesHint}</p>
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                    {samples.map((s, i) => <button key={i} onClick={() => doAsk(s)} style={sampleBtn}>{s}</button>)}
                  </div>
                </div>
              )}
              <div style={{ display: "flex", flexDirection: "column", gap: "16px", marginTop: "14px" }}>
                {qaFeed.map((b) => (
                  <div key={b.id} style={feedBlock}>
                    <div style={userBubble}>🙋 {b.question}</div>
                    {b.loading && <p style={mutedLabel}>{t.answering}</p>}
                    {b.answer && (
                      <div style={answerCard}>
                        {b.answer.intro && <p style={introText}>{b.answer.intro}</p>}
                        {b.answer.key_points?.length > 0 && (
                          <div style={blockStyle}><div style={blockTitle}>{t.keyPoints}</div>
                            <ul style={ulStyle}>{b.answer.key_points.map((k, i) => <li key={i} style={liStyle}>{k}</li>)}</ul></div>)}
                        {b.answer.formula?.length > 0 && (
                          <div style={{ ...blockStyle, background: "#fef9c3", border: "1px solid #fde047" }}><div style={blockTitle}>{t.formula}</div>
                            <ul style={ulStyle}>{b.answer.formula.map((f, i) => <li key={i} style={{ ...liStyle, fontFamily: "monospace" }}>{f}</li>)}</ul></div>)}
                        {b.answer.examples?.length > 0 && (
                          <div style={{ ...blockStyle, background: "#ecfdf5", border: "1px solid #a7f3d0" }}><div style={blockTitle}>{t.examples}</div>
                            <ul style={ulStyle}>{b.answer.examples.map((e, i) => <li key={i} style={liStyle}>{e}</li>)}</ul></div>)}
                        {b.answer.summary && (
                          <div style={{ ...blockStyle, background: "#eff6ff", border: "1px solid #bfdbfe" }}><div style={blockTitle}>{t.summary}</div>
                            <p style={{ margin: 0, fontSize: "14px", color: "#0f172a" }}>{b.answer.summary}</p></div>)}
                        {!b.explain && (
                          <button onClick={() => doExplainMore(b.id)} disabled={b.explainLoading} style={{ ...bigBtn("#7c3aed", b.explainLoading), marginTop: "6px" }}>
                            {b.explainLoading ? t.explaining : t.explainMore}</button>)}
                        {b.explain && (
                          <div style={{ ...blockStyle, background: "#faf5ff", border: "1px solid #e9d5ff", marginTop: "10px" }}>
                            <div style={blockTitle}>{t.detailTitle}</div>
                            {b.explain.detailed_explanation && <p style={{ fontSize: "14px", color: "#0f172a", lineHeight: 1.7 }}>{b.explain.detailed_explanation}</p>}
                            {b.explain.more_examples?.length > 0 && (<><div style={{ ...blockTitle, marginTop: "8px" }}>{t.moreExamples}</div>
                              <ul style={ulStyle}>{b.explain.more_examples.map((e, i) => <li key={i} style={liStyle}>{e}</li>)}</ul></>)}
                            {b.explain.analogy && <p style={{ fontSize: "14px", color: "#6b21a8", marginTop: "8px", fontStyle: "italic" }}>🧠 {b.explain.analogy}</p>}
                          </div>)}
                      </div>
                    )}
                  </div>
                ))}
              </div>
              <div style={{ display: "flex", gap: "10px", marginTop: "16px" }}>
                <input value={question} onChange={(e) => setQuestion(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && doAsk()} placeholder={t.askPlaceholder} style={inputStyle} />
                <button onClick={() => doAsk()} disabled={busy} style={bigBtn("#4f46e5", busy)}>{busy ? "⌛" : t.askBtn}</button>
              </div>
            </section>
          )}

          {/* SET */}
          {mode === "set" && (
            <section style={mainCardStyle}>
              <h3 style={sectionTitleStyle}>{t.setTitle}</h3>
              <div style={{ display: "flex", flexDirection: "column", gap: "16px", marginTop: "12px" }}>
                {setFeed.map((b, idx) => (
                  <div key={b.id} style={feedBlock}>
                    <div style={{ fontSize: "12px", fontWeight: 700, color: "#64748b", marginBottom: "6px" }}>{t.setLabel} {idx + 1}</div>
                    {b.loading && <p style={mutedLabel}>{t.generating}</p>}
                    {b.questions.map((q, i) => (
                      <div key={i} style={qCard}>
                        <div style={{ fontWeight: 700, color: "#0f172a", fontSize: "14px" }}>{i + 1}. {q.question}
                          {q.type && <span style={typeTag}>{q.type}</span>}</div>
                        {b.showAnswers && q.answer && <div style={ansReveal}>✅ {q.answer}</div>}
                      </div>
                    ))}
                    {b.questions.length > 0 && (
                      <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", marginTop: "12px" }}>
                        <button onClick={() => toggleSetAnswers(b.id)} style={bigBtn("#64748b", false)}>{b.showAnswers ? t.hideAns : t.showAns}</button>
                        <button onClick={addSet} disabled={!b.isLatest || busy} style={bigBtn("#0ea5e9", !b.isLatest || busy)}>{t.anotherSet}</button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* ONE-BY-ONE */}
          {mode === "oneByone" && (
            <section style={mainCardStyle}>
              <h3 style={sectionTitleStyle}>{t.oneTitle}</h3>
              <div style={{ display: "flex", flexDirection: "column", gap: "16px", marginTop: "12px" }}>
                {obFeed.map((b, idx) => (
                  <div key={b.id} style={feedBlock}>
                    <div style={{ fontSize: "12px", fontWeight: 700, color: "#64748b", marginBottom: "6px" }}>{t.qLabel} {idx + 1}</div>
                    {b.loading && <p style={mutedLabel}>{t.generating}</p>}
                    {b.question && (
                      <div style={qCard}>
                        <div style={{ fontWeight: 700, color: "#0f172a", fontSize: "15px" }}>{b.question}</div>
                        {b.hints.length > 0 && (
                          <div style={{ marginTop: "10px", display: "flex", flexDirection: "column", gap: "6px" }}>
                            {b.hints.map((h, i) => <div key={i} style={hintReveal}>💡 Hint {i + 1}: {h}</div>)}</div>)}
                        {b.answer && <div style={{ ...ansReveal, marginTop: "10px" }}>✅ {b.answer}</div>}
                        {b.answer && b.selfReport === null && (
                          <div style={{ display: "flex", gap: "10px", marginTop: "12px", alignItems: "center", flexWrap: "wrap" }}>
                            <span style={{ fontSize: "13px", fontWeight: 700, color: "#475569" }}>{t.didSolve}</span>
                            <button onClick={() => obReport(b.id, true)} style={bigBtn("#16a34a", false)}>{t.solved}</button>
                            <button onClick={() => obReport(b.id, false)} style={bigBtn("#dc2626", false)}>{t.notSolved}</button>
                          </div>)}
                        {b.selfReport !== null && (
                          <div style={{ marginTop: "10px", fontSize: "13px", fontWeight: 700, color: b.selfReport ? "#16a34a" : "#dc2626" }}>
                            {b.selfReport ? t.solvedMsg : t.notSolvedMsg}</div>)}
                        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", marginTop: "14px" }}>
                          {b.hintsUsed < 3 && !b.answer && (
                            <button onClick={() => obHint(b.id)} style={bigBtn("#f59e0b", false)}>{t.hintBtn} ({b.hintsUsed}/3)</button>)}
                          {!b.answer && (<button onClick={() => obReveal(b.id)} style={bigBtn("#64748b", false)}>{t.revealAns}</button>)}
                          <button onClick={nextOB} disabled={!b.isLatest || busy} style={bigBtn("#16a34a", !b.isLatest || busy)}>{t.nextQ}</button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}

          <div ref={feedEndRef} />
        </div>
      </div>
    </div>
  );
}

/* ======================= styles ======================= */
const tabBtn = (color, active, disabled) => ({ background: active ? color : "#fff", color: active ? "#fff" : color, padding: "11px 20px", border: `2px solid ${color}`, borderRadius: "10px", fontWeight: 700, fontSize: "14px", cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.5 : 1 });
const pillBtn = (active) => ({ padding: "7px 16px", borderRadius: "999px", border: active ? "2px solid #4f46e5" : "1.5px solid #e2e8f0", background: active ? "#eef2ff" : "#fff", color: active ? "#4f46e5" : "#475569", fontWeight: 700, fontSize: "13px", cursor: "pointer" });
const bigBtn = (color, disabled) => ({ background: color, color: "#fff", padding: "11px 20px", border: "none", borderRadius: "10px", fontWeight: 700, fontSize: "14px", cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.55 : 1 });
const sampleBtn = { textAlign: "left", background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "10px", padding: "11px 14px", fontSize: "14px", color: "#334155", cursor: "pointer", fontWeight: 500 };
const inputStyle = { flex: 1, padding: "11px 14px", borderRadius: "10px", border: "1px solid #cbd5e1", fontSize: "14px", outline: "none" };
const newChatBtn = { width: "100%", background: "#4f46e5", color: "#fff", border: "none", borderRadius: "10px", padding: "11px", fontWeight: 800, fontSize: "13px", cursor: "pointer", flexShrink: 0 };
const sessionItem = (active) => ({ textAlign: "left", padding: "9px 11px", borderRadius: "9px", border: active ? "1.5px solid #4f46e5" : "1px solid #e2e8f0", background: active ? "#eef2ff" : "#fff", color: active ? "#4f46e5" : "#334155", fontSize: "12px", fontWeight: 600, cursor: "pointer", lineHeight: 1.4, flexShrink: 0 });
const feedBlock = { paddingBottom: "16px", borderBottom: "1px dashed #e2e8f0" };
const userBubble = { display: "inline-block", background: "#eef2ff", color: "#3730a3", padding: "8px 14px", borderRadius: "12px", fontSize: "14px", fontWeight: 600, marginBottom: "10px" };
const answerCard = { display: "flex", flexDirection: "column", gap: "12px", padding: "16px", background: "#fff", borderRadius: "14px", border: "1px solid #e2e8f0", boxShadow: "0 6px 18px rgba(15,23,42,0.06)" };
const introText = { margin: 0, fontSize: "15px", color: "#0f172a", lineHeight: 1.7, fontWeight: 500 };
const blockStyle = { padding: "12px 14px", borderRadius: "10px", background: "#f8fafc", border: "1px solid #e2e8f0" };
const blockTitle = { fontSize: "13px", fontWeight: 800, color: "#334155", marginBottom: "6px" };
const ulStyle = { margin: 0, paddingLeft: "20px", display: "flex", flexDirection: "column", gap: "5px" };
const liStyle = { fontSize: "14px", color: "#334155", lineHeight: 1.6 };
const mutedLabel = { fontSize: "13px", color: "#64748b", marginBottom: "8px", fontWeight: 600 };
const qCard = { padding: "14px 16px", background: "#fff", border: "1px solid #e2e8f0", borderRadius: "12px", boxShadow: "0 4px 12px rgba(15,23,42,0.04)", marginBottom: "8px" };
const typeTag = { marginLeft: "8px", fontSize: "10px", fontWeight: 700, color: "#4f46e5", background: "#eef2ff", padding: "2px 8px", borderRadius: "999px", textTransform: "uppercase" };
const ansReveal = { marginTop: "8px", padding: "10px 12px", background: "#ecfdf5", border: "1px solid #a7f3d0", borderRadius: "8px", fontSize: "13px", color: "#065f46", fontWeight: 600 };
const hintReveal = { padding: "9px 12px", background: "#fffbeb", border: "1px solid #fde68a", borderRadius: "8px", fontSize: "13px", color: "#92400e", fontWeight: 500 };
const pageStyle = { minHeight: "100vh", padding: "24px 20px 56px", background: "linear-gradient(180deg, #f8fafc 0%, #eef2ff 52%, #ecfeff 100%)", position: "relative", overflow: "hidden" };
const ambientOrbA = { position: "absolute", top: "-130px", right: "-120px", width: "340px", height: "340px", borderRadius: "50%", background: "radial-gradient(circle, rgba(99,102,241,0.24) 0%, rgba(99,102,241,0) 72%)" };
const ambientOrbB = { position: "absolute", bottom: "-140px", left: "-120px", width: "360px", height: "360px", borderRadius: "50%", background: "radial-gradient(circle, rgba(16,185,129,0.18) 0%, rgba(16,185,129,0) 74%)" };
const layoutStyle = { maxWidth: "1200px", margin: "0 auto", position: "relative", zIndex: 1, display: "grid", gridTemplateColumns: "240px 1fr", gap: "18px", alignItems: "start", minHeight: "calc(100vh - 80px)" };
const sidebarStyle = { position: "sticky", top: "24px", maxHeight: "calc(100vh - 48px)", display: "flex", flexDirection: "column", overflow: "hidden", borderRadius: "16px", border: "1px solid #e2e8f0", background: "rgba(255,255,255,0.9)", backdropFilter: "blur(10px)", boxShadow: "0 12px 28px rgba(15,23,42,0.08)", padding: "14px" };
const containerStyle = { position: "relative", zIndex: 1, display: "flex", flexDirection: "column", gap: "18px", minWidth: 0 };
const topBarStyle = { display: "grid", gridTemplateColumns: "auto 1fr auto", alignItems: "center", gap: "16px", borderRadius: "16px", border: "1px solid #e2e8f0", background: "rgba(255,255,255,0.82)", backdropFilter: "blur(10px)", boxShadow: "0 12px 28px rgba(15,23,42,0.08)", padding: "14px 16px" };
const backButtonStyle = { padding: "9px 14px", borderRadius: "10px", border: "1px solid #cbd5e1", background: "#fff", color: "#334155", fontSize: "13px", fontWeight: 700, cursor: "pointer" };
const titleStyle = { margin: 0, fontSize: "24px", fontWeight: 900, letterSpacing: "-0.02em", color: "#0f172a" };
const subtitleStyle = { margin: "4px 0 0", fontSize: "12px", color: "#64748b", fontWeight: 500 };
const userPillStyle = { justifySelf: "end", borderRadius: "999px", border: "1px solid #bfdbfe", background: "#eff6ff", color: "#1d4ed8", fontSize: "12px", fontWeight: 700, padding: "8px 12px" };
const mainCardStyle = { borderRadius: "18px", border: "1px solid #e2e8f0", background: "rgba(255,255,255,0.93)", backdropFilter: "blur(8px)", boxShadow: "0 16px 40px rgba(15,23,42,0.10)", padding: "26px" };
const sectionHeaderStyle = { display: "flex", alignItems: "center", gap: "10px", marginBottom: "14px" };
const stepBadgeStyle = { fontSize: "11px", fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: "#15803d", background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: "999px", padding: "5px 10px" };
const sectionTitleStyle = { margin: 0, fontSize: "19px", color: "#0f172a", fontWeight: 800, letterSpacing: "-0.01em" };
const gridStyle = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "14px" };
const fieldCardStyle = { border: "1px solid #e2e8f0", borderRadius: "12px", padding: "12px", background: "#fff", boxShadow: "0 4px 14px rgba(15,23,42,0.04)" };
const labelStyle = { display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", fontWeight: 700, color: "#475569", marginBottom: "8px", letterSpacing: "0.03em", textTransform: "uppercase" };
const selectStyle = { width: "100%", padding: "10px 32px 10px 11px", borderRadius: "10px", border: "1px solid #cbd5e1", fontSize: "14px", color: "#0f172a", outline: "none", background: "#fff", appearance: "none" };
const disabledSelectStyle = { background: "#f8fafc", color: "#94a3b8" };
const caretStyle = { position: "absolute", right: "11px", top: "50%", transform: "translateY(-50%)", color: "#64748b", pointerEvents: "none", fontSize: "12px" };
const hintBoxStyle = { marginTop: "14px", marginBottom: "12px", display: "flex", alignItems: "center", gap: "8px", padding: "10px 12px", borderRadius: "10px", background: "#f8fafc", border: "1px solid #e2e8f0" };
const hintTextStyle = { fontSize: "12px", color: "#475569", fontWeight: 600 };