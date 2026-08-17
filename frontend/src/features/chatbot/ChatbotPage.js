// features/chatbot/ChatbotPage.js — Redesigned with 10MS-inspired UI
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
    selectClass: "ক্লাস বেছে নাও", selectSubject: "বিষয় বেছে নাও",
    selectChapter: "অধ্যায় বেছে নাও", selectTopic: "টপিক বেছে নাও",
    classL: "ক্লাস", subjectL: "বিষয়", chapterL: "অধ্যায় (ঐচ্ছিক)", topicL: "টপিক (ঐচ্ছিক)",
    lang: "ভাষা:",
    hintReady: "নিচের একটা tab বেছে নাও — যা করবে সব এখানে জমতে থাকবে।",
    hintPick: "শুরু করতে অন্তত বিষয় select করো।",
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
    newChat: "➕ নতুন কথোপকথন", history: "আগের সেশন", noSessions: "কোনো আগের সেশন নেই",
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

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
function sessionTitle(s) {
  let str = `Session #${s.session_id}`;
  if (s.subject_name) str += ` · ${s.subject_name}`;
  if (s.start_time) { const d = new Date(s.start_time); if (!isNaN(d)) str += ` · ${MONTHS[d.getMonth()]} ${d.getDate()}`; }
  return str;
}

function SelectField({ label, icon, value, onChange, disabled, options, placeholder }) {
  return (
    <div style={{ ...pillWrap, ...(disabled ? pillWrapDisabled : {}) }}>
      <select value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)}
        aria-label={label} style={pillSelect}>
        <option value="">{placeholder}</option>
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      <span style={pillCaret}>▾</span>
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
    studentId, subjectId: selectedSubject || null,
    chapterId: selectedChapter || null, topicId: selectedTopicId || null, language,
  });

  const [samples, setSamples] = useState([]);
  const [question, setQuestion] = useState("");
  const [qaFeed, setQaFeed] = useState([]);
  const [setFeed, setSetFeed] = useState([]);
  const [obFeed, setObFeed] = useState([]);
  const [busy, setBusy] = useState(false);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [sessionLoading, setSessionLoading] = useState(false);
  const [dropdownLoading, setDropdownLoading] = useState(false);
  const [sessions, setSessions] = useState([]);
  const [activeSid, setActiveSid] = useState(null);
  const feedEndRef = useRef(null);
  const prevCount = useRef(0);
  const [quizFeed, setQuizFeed] = useState([]);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const clearFeeds = () => {
    setSamples([]); setQuestion("");
    setQaFeed([]); setSetFeed([]); setObFeed([]); setQuizFeed([]); setMode(null);
  };

  const loadHistory = useCallback(async (uid, sid) => {
    setSessionLoading(true); clearFeeds();
    try {
      const { data } = await chatHistory(sid);
      if (data && data.session_id) {
        setActiveSid(data.session_id);
        const sc = data.scope || {};
        if (sc.class_name) { setSelectedClass(sc.class_name); try { const r = await getSubjects(sc.class_name); setSubjectList(r.data || []); } catch { } }
        if (sc.subject_id) { setSelectedSubject(String(sc.subject_id)); try { const r = await getChapters(sc.subject_id); setChapterList(r.data || []); } catch { } }
        if (sc.chapter_id) { setSelectedChapter(String(sc.chapter_id)); try { const r = await getTopics(sc.chapter_id); setTopicList(r.data || []); } catch { } }
        if (sc.topic_id) setSelectedTopicId(String(sc.topic_id));
        setQaFeed((data.qa || []).map((q) => ({ id: newId(), question: q.question, answer: q.answer, context: q.context || "", explain: q.explain || null, explainLoading: false, loading: false })));
        setSetFeed((data.sets || []).map((s, i, arr) => ({ id: newId(), questions: s.questions || [], showAnswers: false, isLatest: i === arr.length - 1, loading: false })));
        setObFeed((data.oneByone || []).map((o, i, arr) => ({ id: newId(), contentId: o.content_id, question: o.question, hints: o.hints || [], hintsUsed: o.hints_used || 0, answer: o.answer || null, selfReport: o.self_report ?? null, isLatest: i === arr.length - 1, loading: false })));
        if ((data.qa || []).length) setMode("qa");
        else if ((data.sets || []).length) setMode("set");
        else if ((data.oneByone || []).length) setMode("oneByone");
        else if ((data.quiz || []).length) setMode("quiz");
      }
    } catch { } finally { setSessionLoading(false); }
  }, []);

  const refreshSessions = useCallback(async (uid) => {
    try { const { data } = await chatSessions(uid); setSessions(data.sessions || []); }
    catch { setSessions([]); }
  }, []);

  useEffect(() => {
    const stored = localStorage.getItem("user");
    if (!stored) { navigate("/"); return; }
    const u = JSON.parse(stored);
    setUser(u);
    getClasses().then(({ data }) => setClassList(data || [])).catch(() => { });
    refreshSessions(u.user_id);
  }, [navigate, refreshSessions]);

  const didInitialLoad = useRef(false);
  useEffect(() => {
    if (!user || didInitialLoad.current) return;
    didInitialLoad.current = true;
    (async () => {
      const sid = chat.getSessionId();
      if (sid) await loadHistory(user.user_id, sid);
      setHistoryLoaded(true);
    })();
  }, [user]);

  useEffect(() => {
    const count = qaFeed.length + setFeed.length + obFeed.length;
    if (count > prevCount.current) feedEndRef.current?.scrollIntoView({ behavior: "smooth" });
    prevCount.current = count;
  }, [qaFeed, setFeed, obFeed]);

  const openSession = async (sid) => {
    if (sid === activeSid) return;
    chat.setSessionId(sid);
    await loadHistory(user.user_id, sid);
  };

  const newChat = () => {
    chat.resetSession(); setActiveSid(null); clearFeeds();
    setSelectedClass(""); setSelectedSubject(""); setSelectedChapter(""); setSelectedTopicId("");
    setSubjectList([]); setChapterList([]); setTopicList([]);
  };

  const resetOnSelectionChange = () => { chat.resetSession(); setActiveSid(null); clearFeeds(); };

  const onClass = async (v) => {
    setSelectedClass(v); setSubjectList([]); setChapterList([]); setTopicList([]);
    setSelectedSubject(""); setSelectedChapter(""); setSelectedTopicId(""); resetOnSelectionChange();
    if (v) { setDropdownLoading(true); try { const { data } = await getSubjects(v); setSubjectList(data || []); } catch { } finally { setDropdownLoading(false); } }
  };
  const onSubject = async (v) => {
    setSelectedSubject(v); setChapterList([]); setTopicList([]); setSelectedChapter(""); setSelectedTopicId(""); resetOnSelectionChange();
    if (v) { setDropdownLoading(true); try { const { data } = await getChapters(v); setChapterList(data || []); } catch { } finally { setDropdownLoading(false); } }
  };
  const onChapter = async (v) => {
    setSelectedChapter(v); setTopicList([]); setSelectedTopicId(""); resetOnSelectionChange();
    if (v) { setDropdownLoading(true); try { const { data } = await getTopics(v); setTopicList(data || []); } catch { } finally { setDropdownLoading(false); } }
  };
  const onTopic = (v) => { setSelectedTopicId(v); resetOnSelectionChange(); };
  const onLanguage = (v) => { if (!langLocked) setLanguage(v); };
  const canStart = !!selectedSubject;
  const langLocked = qaFeed.length > 0 || setFeed.length > 0 || obFeed.length > 0;
  const afterFirstContent = () => refreshSessions(user.user_id);

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

  const SET_DIFFICULTY = ["medium", "hard", "hard", "harder", "very hard"];
  const openSet = () => { setMode("set"); if (setFeed.length === 0) addSet(); };
  const addSet = async () => {
    if (busy) return; setBusy(true);
    const id = newId(); const wasNew = chat.getSessionId() == null;
    let setIndex = setFeed.length;
    if (setIndex >= SET_DIFFICULTY.length) setIndex = SET_DIFFICULTY.length - 1;
    const difficulty = SET_DIFFICULTY[setIndex];
    setSetFeed((f) => [...f.map((b) => ({ ...b, isLatest: false })), { id, questions: [], showAnswers: false, isLatest: true, loading: true }]);
    try {
      const d = await chat.practiceSet(difficulty, 5);
      setSetFeed((f) => f.map((b) => b.id === id ? { ...b, questions: d.questions || [], loading: false } : b));
      setActiveSid(chat.getSessionId());
      if (wasNew) afterFirstContent();
    } catch { setSetFeed((f) => f.map((b) => b.id === id ? { ...b, loading: false } : b)); }
    setBusy(false);
  };
  const toggleSetAnswers = (id) => setSetFeed((f) => f.map((b) => b.id === id ? { ...b, showAnswers: !b.showAnswers } : b));

  const openOneByOne = () => { setMode("oneByone"); if (obFeed.length === 0) startOB(); };
  const startOB = async () => {
    if (busy) return; setBusy(true);
    const id = newId(); const wasNew = chat.getSessionId() == null;
    setObFeed((f) => [...f.map((b) => ({ ...b, isLatest: false })), { id, contentId: null, question: "", hints: [], hintsUsed: 0, answer: null, selfReport: null, isLatest: true, loading: true }]);
    try {
      const d = await chat.startSession();
      setObFeed((f) => f.map((b) => b.id === id ? { ...b, contentId: d.content_id, question: d.question || "", loading: false } : b));
      setActiveSid(chat.getSessionId()); if (wasNew) afterFirstContent();
    } catch { setObFeed((f) => f.map((b) => b.id === id ? { ...b, loading: false } : b)); }
    setBusy(false);
  };
  const nextOB = async () => {
    if (busy) return; setBusy(true);
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

  const openQuiz = () => { setMode("quiz"); if (quizFeed.length === 0) addQuiz(); };
  const addQuiz = async () => {
    if (busy) return; setBusy(true);
    const id = newId(); const wasNew = chat.getSessionId() == null;
    setQuizFeed((f) => [...f.map((b) => ({ ...b, isLatest: false })), { id, questions: [], answers: {}, hints: {}, hintsUsed: {}, isLatest: true, loading: true }]);
    try {
      const d = await chat.quizSet("mixed");
      setQuizFeed((f) => f.map((b) => b.id === id ? { ...b, questions: d.questions || [], loading: false } : b));
      setActiveSid(chat.getSessionId()); if (wasNew) afterFirstContent();
    } catch { setQuizFeed((f) => f.map((b) => b.id === id ? { ...b, loading: false } : b)); }
    setBusy(false);
  };
  const selectQuizOption = (blockId, qnum, label) =>
    setQuizFeed((f) => f.map((b) => {
      if (b.id !== blockId || b.answers[qnum] != null) return b;
      return { ...b, answers: { ...b.answers, [qnum]: label } };
    }));
  const quizHint = async (blockId, qnum, contentId) => {
    const block = quizFeed.find((b) => b.id === blockId);
    const used = block?.hintsUsed[qnum] || 0;
    if (used >= 2) return;
    try {
      const d = await chat.getHint(contentId, used);
      if (d.hint) setQuizFeed((f) => f.map((b) => b.id !== blockId ? b : { ...b, hints: { ...b.hints, [qnum]: [...(b.hints[qnum] || []), d.hint] }, hintsUsed: { ...b.hintsUsed, [qnum]: d.hints_used } }));
    } catch { }
  };

  return (
    <div style={pageStyle}>
      {/* ===== TOP NAVBAR ===== */}
      <nav style={navStyle}>
        <div style={navInner}>
          {/* Logo */}
          <div style={navLogo} onClick={() => navigate(-1)}>
            <div style={logoIcon}>🎓</div>
            <span style={logoText}>EduAI <span style={{color:"#7c3aed"}}>Hub</span></span>
          </div>

          {/* Center - Breadcrumb */}
          <div style={navCenter}>
            <span style={navBreadcrumb}>
              🏠 / <span style={{color:"#7c3aed", fontWeight:700, marginLeft:"4px"}}>Study Chatbot</span>
            </span>
          </div>

          {/* Right Side */}
          <div style={navRight}>
            <div style={langToggle}>
              {[["bangla","BN"],["english","EN"]].map(([v,l]) => (
                <button key={v} onClick={() => onLanguage(v)} disabled={langLocked}
                  style={langBtn(language === v, langLocked && language !== v)}>{l}</button>
              ))}
            </div>
            <div style={userBadge}>
              <div style={userAvatar}>{(user?.name || "S")[0].toUpperCase()}</div>
              <span style={userName}>{user?.name || "Test Student"}</span>
            </div>
          </div>
        </div>
      </nav>

      {/* ===== MAIN LAYOUT ===== */}
      <div style={layoutStyle}>
        {/* SIDEBAR */}
        <aside style={sidebarStyle}>
          <button onClick={newChat} style={newChatBtnStyle}>
            <span>➕</span> {t.newChat}
          </button>
          <div style={sidebarSectionLabel}>{t.history}</div>
          <div style={sessionListStyle}>
            {sessions.length === 0 && <div style={emptySession}>{t.noSessions}</div>}
            {sessions.map((s) => (
              <button key={s.session_id} onClick={() => openSession(s.session_id)}
                style={sessionItemStyle(s.session_id === activeSid)}>
                <span style={{fontSize:"14px"}}>📖</span>
                <span style={{flex:1, textAlign:"left", lineHeight:1.4}}>{sessionTitle(s)}</span>
              </button>
            ))}
          </div>
        </aside>

        {/* MAIN CONTENT */}
        <div style={mainStyle}>
          {/* ===== AI STUDY BUDDY HEADER CARD ===== */}
          <div style={buddyCard}>
            <div style={buddyLeft}>
              <div style={buddyAvatar}>🤖</div>
              <div>
                <h1 style={buddyTitle}> <span style={{color:"#7c3aed"}}>AI Study Buddy</span></h1>
                <p style={buddySub}>{t.subtitle}</p>
              </div>
            </div>
            <div style={liveBadge}><span style={liveDot} />LIVE</div>
          </div>

          {/* ===== STUDY SELECTION CARD ===== */}
          <div style={studySelectCard}>
            <div style={studySelectHeader}><span>📚</span><span>{t.step1}</span></div>
            <div style={studySelectGrid}>
              <SelectField label={t.classL} icon="🏫" value={selectedClass} onChange={onClass}
                placeholder={t.selectClass} options={classList.map((c) => ({ value: c.class_name, label: c.class_name }))} />
              <SelectField label={t.subjectL} icon="📚" value={selectedSubject} onChange={onSubject}
                disabled={!selectedClass} placeholder={t.selectSubject}
                options={subjectList.map((s) => ({ value: s.subject_id, label: s.name }))} />
            </div>
            <div style={studySelectGridSecondary}>
              <SelectField label={t.chapterL} icon="🧩" value={selectedChapter} onChange={onChapter}
                disabled={!selectedSubject} placeholder={t.selectChapter}
                options={chapterList.map((ch) => ({ value: ch.chapter_id, label: `Ch ${ch.chapter_no}: ${ch.name}` }))} />
              <SelectField label={t.topicL} icon="🎯" value={selectedTopicId} onChange={onTopic}
                disabled={!selectedChapter} placeholder={t.selectTopic}
                options={topicList.map((tp) => ({ value: tp.topic_id, label: tp.name }))} />
            </div>

            {/* HINT */}
            <div style={hintBox}>
              <span>💡</span>
              <span style={{fontSize:"13px", color:"#6b7280", fontWeight:600}}>
                {dropdownLoading ? (language === "bangla" ? "⌛ লোড হচ্ছে..." : "⌛ Loading...") : (canStart ? t.hintReady : t.hintPick)}
              </span>
            </div>
          </div>

          {/* ===== MODE GRID (2x2) ===== */}
          <div style={modeGrid}>
            {[
              { key:"qa", icon:"❓", color:"#ef4444", bg:"#fee2e2", title:t.tabQA.replace(/^[^\p{L}]*/u,""), sub: language==="bangla" ? "Instant answer পাও" : "Get an instant answer" },
              { key:"set", icon:"📝", color:"#0ea5e9", bg:"#e0f2fe", title:t.tabSet.replace(/^[^\p{L}]*/u,""), sub: language==="bangla" ? "Questions practice করো" : "Practice questions" },
              { key:"oneByone", icon:"🎯", color:"#16a34a", bg:"#dcfce7", title:t.tabOne.replace(/^[^\p{L}]*/u,""), sub: language==="bangla" ? "Step by step practice" : "Step by step practice" },
              { key:"quiz", icon:"📋", color:"#f59e0b", bg:"#fef3c7", title:"Quiz", sub: language==="bangla" ? "MCQ quiz নাও" : "Take an MCQ quiz" },
            ].map(({key, icon, color, bg, title, sub}) => (
              <button key={key}
                onClick={() => key==="qa" ? openQA() : key==="set" ? openSet() : key==="oneByone" ? openOneByOne() : openQuiz()}
                disabled={!canStart}
                style={modeCard(color, mode === key, !canStart)}>
                <span style={modeCardIcon(bg)}>{icon}</span>
                <span style={modeCardTitle}>{title}</span>
                <span style={modeCardSub}>{sub}</span>
              </button>
            ))}
          </div>

          {/* SESSION LOADING */}
          {sessionLoading && (
            <div style={loadingCard}>
              <span style={{fontSize:"24px", animation:"spin 1s linear infinite"}}>⏳</span>
              <span style={{fontWeight:700, color:"#7c3aed"}}>
                {language === "bangla" ? "সেশন লোড হচ্ছে..." : "Loading session..."}
              </span>
            </div>
          )}

          {/* QUIZ MODE */}
          {mode === "quiz" && (
            <div style={contentCard}>
              <h3 style={contentTitle}>📋 Quiz</h3>
              <div style={{display:"flex", flexDirection:"column", gap:"16px", marginTop:"12px"}}>
                {quizFeed.map((b, idx) => {
                  const correctCount = b.questions.filter(q => b.answers[q.question_number] === q.correct_option).length;
                  return (
                    <div key={b.id} style={feedBlock}>
                      <div style={setLabel}>Quiz {idx + 1}</div>
                      {b.loading && <p style={mutedText}>⌛ Quiz তৈরি হচ্ছে...</p>}
                      {b.questions.map((q) => {
                        const sel = b.answers[q.question_number];
                        const answered = sel != null;
                        const hints = b.hints[q.question_number] || [];
                        const hintsUsed = b.hintsUsed[q.question_number] || 0;
                        return (
                          <div key={q.question_number} style={questionCard}>
                            <div style={questionText}>{q.question_number}. {q.question_text}</div>
                            <div style={{display:"flex", flexDirection:"column", gap:"6px", marginTop:"10px"}}>
                              {q.options.map((opt) => {
                                const isSelected = sel === opt.label;
                                const isCorrect = opt.label === q.correct_option;
                                let bg = "#f8fafc", border = "1.5px solid #e2e8f0", color = "#374151";
                                if (answered) {
                                  if (isCorrect) { bg = "#ecfdf5"; border = "1.5px solid #22c55e"; color = "#166534"; }
                                  else if (isSelected) { bg = "#fef2f2"; border = "1.5px solid #ef4444"; color = "#991b1b"; }
                                }
                                return (
                                  <button key={opt.label} onClick={() => selectQuizOption(b.id, q.question_number, opt.label)}
                                    disabled={answered}
                                    style={{textAlign:"left", padding:"10px 14px", borderRadius:"10px", background:bg, border, color, fontSize:"13px", fontWeight:600, cursor:answered?"default":"pointer", transition:"all 0.15s"}}>
                                    {opt.label}. {opt.text}
                                    {answered && isCorrect && " ✅"}
                                    {answered && isSelected && !isCorrect && " ❌"}
                                  </button>
                                );
                              })}
                            </div>
                            {answered && (
                              <div style={{marginTop:"8px", fontSize:"13px", fontWeight:700, color: sel===q.correct_option?"#16a34a":"#dc2626"}}>
                                {sel===q.correct_option ? "✅ সঠিক!" : `❌ ভুল — সঠিক উত্তর: ${q.correct_option}`}
                              </div>
                            )}
                            {hints.map((h,i) => <div key={i} style={hintRevealStyle}>💡 Hint {i+1}: {h}</div>)}
                            {!answered && hintsUsed < 2 && (
                              <button onClick={() => quizHint(b.id, q.question_number, q.content_id)}
                                style={{...actionBtn("#f59e0b"), marginTop:"8px", padding:"6px 12px", fontSize:"12px"}}>
                                💡 Hint ({hintsUsed}/2)
                              </button>
                            )}
                          </div>
                        );
                      })}
                      {b.questions.length > 0 && (
                        <div style={{display:"flex", gap:"10px", alignItems:"center", marginTop:"12px", flexWrap:"wrap"}}>
                          <span style={{fontWeight:800, fontSize:"14px", color:"#0f172a"}}>
                            স্কোর: {correctCount}/{b.questions.length}
                          </span>
                          <button onClick={addQuiz} disabled={!b.isLatest||busy} style={actionBtn("#7c3aed")}>📋 আরও Quiz</button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Q&A MODE */}
          {mode === "qa" && (
            <div style={contentCard}>
              <h3 style={contentTitle}>{t.qaTitle}</h3>
              {qaFeed.length === 0 && samples.length > 0 && (
                <div style={{marginTop:"12px"}}>
                  <p style={mutedText}>{t.samplesHint}</p>
                  <div style={{display:"flex", flexDirection:"column", gap:"8px"}}>
                    {samples.map((s,i) => (
                      <button key={i} onClick={() => doAsk(s)} style={sampleBtnStyle}>{s}</button>
                    ))}
                  </div>
                </div>
              )}
              <div style={{display:"flex", flexDirection:"column", gap:"18px", marginTop:"16px"}}>
                {qaFeed.map((b) => (
                  <div key={b.id} style={feedBlock}>
                    <div style={userBubbleStyle}>🙋 {b.question}</div>
                    {b.loading && <p style={mutedText}>{t.answering}</p>}
                    {b.answer && (
                      <div style={answerCardStyle}>
                        {b.answer.intro && <p style={{margin:0, fontSize:"15px", color:"#0f172a", lineHeight:1.7, fontWeight:500}}>{b.answer.intro}</p>}
                        {b.answer.key_points?.length > 0 && (
                          <div style={infoBlock("#f0fdf4","#bbf7d0")}>
                            <div style={blockLabel}>{t.keyPoints}</div>
                            <ul style={ulStyle}>{b.answer.key_points.map((k,i) => <li key={i}>{k}</li>)}</ul>
                          </div>
                        )}
                        {b.answer.formula?.length > 0 && (
                          <div style={infoBlock("#fefce8","#fde047")}>
                            <div style={blockLabel}>{t.formula}</div>
                            <ul style={ulStyle}>{b.answer.formula.map((f,i) => <li key={i} style={{fontFamily:"monospace"}}>{f}</li>)}</ul>
                          </div>
                        )}
                        {b.answer.examples?.length > 0 && (
                          <div style={infoBlock("#eff6ff","#bfdbfe")}>
                            <div style={blockLabel}>{t.examples}</div>
                            <ul style={ulStyle}>{b.answer.examples.map((e,i) => <li key={i}>{e}</li>)}</ul>
                          </div>
                        )}
                        {b.answer.summary && (
                          <div style={infoBlock("#f5f3ff","#ddd6fe")}>
                            <div style={blockLabel}>{t.summary}</div>
                            <p style={{margin:0, fontSize:"14px", color:"#0f172a"}}>{b.answer.summary}</p>
                          </div>
                        )}
                        {!b.explain && (
                          <button onClick={() => doExplainMore(b.id)} disabled={b.explainLoading}
                            style={actionBtn("#7c3aed")}>
                            {b.explainLoading ? t.explaining : t.explainMore}
                          </button>
                        )}
                        {b.explain && (
                          <div style={infoBlock("#faf5ff","#e9d5ff")}>
                            <div style={blockLabel}>{t.detailTitle}</div>
                            {b.explain.detailed_explanation && <p style={{fontSize:"14px", color:"#0f172a", lineHeight:1.7}}>{b.explain.detailed_explanation}</p>}
                            {b.explain.more_examples?.length > 0 && (
                              <>
                                <div style={{...blockLabel, marginTop:"8px"}}>{t.moreExamples}</div>
                                <ul style={ulStyle}>{b.explain.more_examples.map((e,i) => <li key={i}>{e}</li>)}</ul>
                              </>
                            )}
                            {b.explain.analogy && <p style={{fontSize:"14px", color:"#6b21a8", marginTop:"8px", fontStyle:"italic"}}>🧠 {b.explain.analogy}</p>}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
              <div style={askRow}>
                <input value={question} onChange={(e) => setQuestion(e.target.value)}
                  onKeyDown={(e) => e.key==="Enter" && doAsk()}
                  placeholder={t.askPlaceholder} style={inputStyle} />
                <button onClick={() => doAsk()} disabled={busy} style={actionBtn("#7c3aed")}>
                  {busy ? "⌛" : t.askBtn}
                </button>
              </div>
            </div>
          )}

          {/* SET MODE */}
          {mode === "set" && (
            <div style={contentCard}>
              <h3 style={contentTitle}>{t.setTitle}</h3>
              <div style={{display:"flex", flexDirection:"column", gap:"16px", marginTop:"12px"}}>
                {setFeed.map((b, idx) => (
                  <div key={b.id} style={feedBlock}>
                    <div style={setLabel}>{t.setLabel} {idx+1}</div>
                    {b.loading && <p style={mutedText}>{t.generating}</p>}
                    {b.questions.map((q,i) => (
                      <div key={i} style={questionCard}>
                        <div style={questionText}>{i+1}. {q.question}
                          {q.type && <span style={typeTagStyle}>{q.type}</span>}
                        </div>
                        {b.showAnswers && q.answer && <div style={ansRevealStyle}>✅ {q.answer}</div>}
                      </div>
                    ))}
                    {b.questions.length > 0 && (
                      <div style={{display:"flex", gap:"10px", marginTop:"12px", flexWrap:"wrap"}}>
                        <button onClick={() => toggleSetAnswers(b.id)} style={actionBtn("#64748b")}>{b.showAnswers ? t.hideAns : t.showAns}</button>
                        <button onClick={addSet} disabled={!b.isLatest||busy} style={actionBtn("#0ea5e9")}>{t.anotherSet}</button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ONE BY ONE MODE */}
          {mode === "oneByone" && (
            <div style={contentCard}>
              <h3 style={contentTitle}>{t.oneTitle}</h3>
              <div style={{display:"flex", flexDirection:"column", gap:"16px", marginTop:"12px"}}>
                {obFeed.map((b, idx) => (
                  <div key={b.id} style={feedBlock}>
                    <div style={setLabel}>{t.qLabel} {idx+1}</div>
                    {b.loading && <p style={mutedText}>{t.generating}</p>}
                    {b.question && (
                      <div style={questionCard}>
                        <div style={{...questionText, fontSize:"15px"}}>{b.question}</div>
                        {b.hints.map((h,i) => <div key={i} style={hintRevealStyle}>💡 Hint {i+1}: {h}</div>)}
                        {b.answer && <div style={ansRevealStyle}>✅ {b.answer}</div>}
                        {b.answer && b.selfReport === null && (
                          <div style={{display:"flex", gap:"10px", marginTop:"12px", alignItems:"center", flexWrap:"wrap"}}>
                            <span style={{fontSize:"13px", fontWeight:700, color:"#475569"}}>{t.didSolve}</span>
                            <button onClick={() => obReport(b.id, true)} style={actionBtn("#16a34a")}>{t.solved}</button>
                            <button onClick={() => obReport(b.id, false)} style={actionBtn("#ef4444")}>{t.notSolved}</button>
                          </div>
                        )}
                        {b.selfReport !== null && (
                          <div style={{marginTop:"10px", fontSize:"13px", fontWeight:700, color:b.selfReport?"#16a34a":"#dc2626"}}>
                            {b.selfReport ? t.solvedMsg : t.notSolvedMsg}
                          </div>
                        )}
                        <div style={{display:"flex", gap:"10px", flexWrap:"wrap", marginTop:"14px"}}>
                          {b.hintsUsed < 3 && !b.answer && (
                            <button onClick={() => obHint(b.id)} style={actionBtn("#f59e0b")}>{t.hintBtn} ({b.hintsUsed}/3)</button>
                          )}
                          {!b.answer && <button onClick={() => obReveal(b.id)} style={actionBtn("#64748b")}>{t.revealAns}</button>}
                          <button onClick={nextOB} disabled={!b.isLatest||busy} style={actionBtn("#16a34a")}>{t.nextQ}</button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div ref={feedEndRef} />
        </div>
      </div>
    </div>
  );
}

/* ===== STYLES ===== */
const pageStyle = { minHeight:"100vh", background:"#f1f5f9", fontFamily:"'Segoe UI', system-ui, sans-serif" };

// NAV — Dashboard Style (White, Clean)
const navStyle = { background:"#fff", position:"sticky", top:0, zIndex:100, boxShadow:"0 1px 8px rgba(0,0,0,0.08)", borderBottom:"1px solid #e2e8f0" };
const navInner = { maxWidth:"1300px", margin:"0 auto", padding:"0 24px", height:"64px", display:"flex", alignItems:"center", justifyContent:"space-between", gap:"16px" };

// Logo
const navLogo = { display:"flex", alignItems:"center", gap:"10px", flexShrink:0, cursor:"pointer" };
const logoIcon = { width:"36px", height:"36px", borderRadius:"10px", background:"linear-gradient(135deg, #7c3aed, #9333ea)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:"18px" };
const logoText = { fontSize:"18px", fontWeight:800, color:"#0f172a", fontFamily:"'Poppins', sans-serif" };

// Center
const navCenter = { flex:1, display:"flex", justifyContent:"center" };
const navBreadcrumb = { fontSize:"14px", fontWeight:600, color:"#94a3b8" };

// Right
const navRight = { display:"flex", alignItems:"center", gap:"12px", flexShrink:0 };
const langToggle = { display:"flex", background:"#f1f5f9", borderRadius:"999px", padding:"3px" };
const langBtn = (active, faded) => ({ padding:"5px 12px", borderRadius:"999px", border:"none", background:active?"#7c3aed":"transparent", color:active?"#fff":"#64748b", fontSize:"12px", fontWeight:700, cursor:faded?"not-allowed":"pointer", opacity:faded?0.4:1, transition:"all 0.15s" });
const userBadge = { display:"flex", alignItems:"center", gap:"8px" };
const userAvatar = { width:"34px", height:"34px", borderRadius:"50%", background:"#7c3aed", color:"#fff", display:"flex", alignItems:"center", justifyContent:"center", fontWeight:800, fontSize:"14px" };
const userName = { fontSize:"14px", fontWeight:600, color:"#0f172a" };

// AI STUDY BUDDY HEADER CARD
const buddyCard = { background:"#fff", borderRadius:"18px", border:"1px solid #f3e8ff", boxShadow:"0 4px 16px rgba(124,58,237,0.06)", padding:"18px 20px", display:"flex", alignItems:"center", justifyContent:"space-between", gap:"14px" };
const buddyLeft = { display:"flex", alignItems:"center", gap:"14px" };
const buddyAvatar = { width:"46px", height:"46px", borderRadius:"14px", background:"#fee2e2", display:"flex", alignItems:"center", justifyContent:"center", fontSize:"24px", flexShrink:0 };
const buddyTitle = { margin:0, fontSize:"17px", fontWeight:800, color:"#0f172a" };
const buddySub = { margin:"2px 0 0", fontSize:"12.5px", color:"#94a3b8", fontWeight:600 };
const liveBadge = { display:"flex", alignItems:"center", gap:"6px", background:"#f3e8ff", color:"#7c3aed", fontSize:"11px", fontWeight:800, padding:"6px 14px", borderRadius:"999px", letterSpacing:"0.04em", flexShrink:0 };
const liveDot = { width:"7px", height:"7px", borderRadius:"50%", background:"#22c55e", display:"inline-block" };

// MODE GRID (2x2 cards) - Kept exact same color setup from image
const modeGrid = { display:"grid", gridTemplateColumns:"repeat(2, 1fr)", gap:"14px" };
const modeCard = (color, active, disabled) => ({ display:"flex", flexDirection:"column", alignItems:"flex-start", gap:"6px", textAlign:"left", background: active ? `${color}0d` : "#fff", border: `1.5px solid ${active ? color : "#e2e8f0"}`, borderLeft:`4px solid ${color}`, borderRadius:"16px", padding:"16px 18px", cursor:disabled?"not-allowed":"pointer", opacity:disabled?0.45:1, boxShadow:"0 2px 10px rgba(0,0,0,0.05)", transition:"all 0.15s" });
const modeCardIcon = (bg) => ({ width:"32px", height:"32px", borderRadius:"10px", background:bg, display:"flex", alignItems:"center", justifyContent:"center", fontSize:"16px" });
const modeCardTitle = { fontSize:"14.5px", fontWeight:800, color:"#0f172a" };
const modeCardSub = { fontSize:"12px", color:"#94a3b8", fontWeight:600 };

// STUDY SELECTION CARD
const studySelectCard = { background:"#fff", borderRadius:"18px", border:"1px solid #e2e8f0", boxShadow:"0 4px 16px rgba(0,0,0,0.05)", padding:"18px 20px" };
const studySelectHeader = { display:"flex", alignItems:"center", gap:"8px", fontSize:"14.5px", fontWeight:800, color:"#0f172a", marginBottom:"14px" };
const studySelectGrid = { display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(200px, 1fr))", gap:"12px" };
const studySelectGridSecondary = { display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(200px, 1fr))", gap:"12px", marginTop:"12px" };

// LAYOUT
const layoutStyle = { maxWidth:"1300px", margin:"0 auto", padding:"24px 20px 60px", display:"grid", gridTemplateColumns:"260px 1fr", gap:"20px", alignItems:"start" };

// SIDEBAR
const sidebarStyle = { position:"sticky", top:"80px", background:"#fff", borderRadius:"16px", boxShadow:"0 4px 20px rgba(0,0,0,0.08)", padding:"16px", display:"flex", flexDirection:"column", gap:"8px", maxHeight:"calc(100vh - 100px)", overflow:"hidden" };
const newChatBtnStyle = { display:"flex", alignItems:"center", justifyContent:"center", gap:"8px", width:"100%", padding:"12px", borderRadius:"10px", border:"none", background:"linear-gradient(135deg, #7c3aed, #9333ea)", color:"#fff", fontWeight:800, fontSize:"13px", cursor:"pointer", boxShadow:"0 4px 12px rgba(124,58,237,0.3)" };
const sidebarSectionLabel = { fontSize:"11px", fontWeight:800, color:"#94a3b8", textTransform:"uppercase", letterSpacing:"0.08em", padding:"8px 4px 4px" };
const sessionListStyle = { display:"flex", flexDirection:"column", gap:"6px", overflowY:"auto", flex:1, paddingRight:"4px" };
const emptySession = { fontSize:"12px", color:"#94a3b8", padding:"8px 4px", textAlign:"center" };
const sessionItemStyle = (active) => ({ display:"flex", alignItems:"center", gap:"8px", textAlign:"left", padding:"10px 12px", borderRadius:"10px", border: active?"2px solid #7c3aed":"1.5px solid #e2e8f0", background: active?"#faf5ff":"#f8fafc", color: active?"#7c3aed":"#374151", fontSize:"12px", fontWeight:600, cursor:"pointer" });

// MAIN
const mainStyle = { display:"flex", flexDirection:"column", gap:"18px" };

const selectionCard = { background:"#fff", borderRadius:"20px", boxShadow:"0 4px 20px rgba(0,0,0,0.08)", padding:"28px", border:"1px solid #e2e8f0" };
const cardHeader = { display:"flex", alignItems:"center", gap:"12px", marginBottom:"20px" };
const stepBadge = { background:"linear-gradient(135deg, #22c55e, #16a34a)", color:"#fff", fontSize:"11px", fontWeight:800, padding:"5px 12px", borderRadius:"999px", letterSpacing:"0.06em" };
const cardTitle = { margin:0, fontSize:"20px", fontWeight:800, color:"#0f172a" };
const selectGrid = { display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(200px, 1fr))", gap:"14px" };

const hintBox = { display:"flex", alignItems:"center", gap:"8px", background:"#f8fafc", border:"1px solid #e2e8f0", borderRadius:"10px", padding:"10px 14px", marginTop:"16px" };

const tabsRow = { display:"flex", gap:"10px", flexWrap:"wrap", marginTop:"16px" };
const modeTab = (color, active, disabled) => ({ padding:"11px 20px", borderRadius:"12px", border:`2px solid ${color}`, background: active ? color : "#fff", color: active ? "#fff" : color, fontWeight:800, fontSize:"13px", cursor:disabled?"not-allowed":"pointer", opacity:disabled?0.45:1, boxShadow: active ? `0 4px 12px ${color}44` : "none", transition:"all 0.15s" });

const loadingCard = { background:"#fff", borderRadius:"16px", padding:"24px", display:"flex", alignItems:"center", gap:"14px", justifyContent:"center", boxShadow:"0 4px 20px rgba(0,0,0,0.06)" };

const contentCard = { background:"#fff", borderRadius:"20px", boxShadow:"0 4px 20px rgba(0,0,0,0.08)", padding:"28px", border:"1px solid #e2e8f0" };
const contentTitle = { margin:"0 0 4px", fontSize:"20px", fontWeight:800, color:"#0f172a" };

const feedBlock = { paddingBottom:"20px", borderBottom:"1px dashed #e2e8f0" };
const setLabel = { fontSize:"11px", fontWeight:800, color:"#64748b", textTransform:"uppercase", letterSpacing:"0.06em", marginBottom:"10px" };
const mutedText = { fontSize:"13px", color:"#94a3b8", fontWeight:600 };

const questionCard = { background:"#f8fafc", border:"1.5px solid #e2e8f0", borderRadius:"14px", padding:"16px", marginBottom:"10px" };
const questionText = { fontWeight:700, color:"#0f172a", fontSize:"14px", lineHeight:1.6 };
const typeTagStyle = { marginLeft:"8px", fontSize:"10px", fontWeight:700, color:"#7c3aed", background:"#faf5ff", padding:"2px 8px", borderRadius:"999px", textTransform:"uppercase" };
const ansRevealStyle = { marginTop:"10px", padding:"10px 14px", background:"#ecfdf5", border:"1.5px solid #86efac", borderRadius:"10px", fontSize:"13px", color:"#166534", fontWeight:700 };
const hintRevealStyle = { marginTop:"8px", padding:"10px 12px", background:"#fffbeb", border:"1.5px solid #fcd34d", borderRadius:"10px", fontSize:"13px", color:"#92400e", fontWeight:600 };

const userBubbleStyle = { display:"inline-block", background:"linear-gradient(135deg, #faf5ff, #f3e8ff)", color:"#581c87", padding:"10px 16px", borderRadius:"14px", fontSize:"14px", fontWeight:700, marginBottom:"12px" };
const answerCardStyle = { display:"flex", flexDirection:"column", gap:"12px", padding:"18px", background:"#fff", borderRadius:"14px", border:"1.5px solid #e2e8f0", boxShadow:"0 4px 16px rgba(0,0,0,0.06)" };
const infoBlock = (bg, border) => ({ padding:"14px 16px", borderRadius:"12px", background:bg, border:`1.5px solid ${border}` });
const blockLabel = { fontSize:"12px", fontWeight:800, color:"#374151", marginBottom:"8px", textTransform:"uppercase", letterSpacing:"0.04em" };
const ulStyle = { margin:0, paddingLeft:"20px", display:"flex", flexDirection:"column", gap:"5px", fontSize:"14px", color:"#374151", lineHeight:1.6 };

const askRow = { display:"flex", gap:"10px", marginTop:"18px" };
const inputStyle = { flex:1, padding:"12px 16px", borderRadius:"12px", border:"1.5px solid #e2e8f0", fontSize:"14px", outline:"none", fontFamily:"inherit", background:"#f8fafc" };
const sampleBtnStyle = { textAlign:"left", background:"#f8fafc", border:"1.5px solid #e2e8f0", borderRadius:"12px", padding:"12px 16px", fontSize:"14px", color:"#374151", cursor:"pointer", fontWeight:500, lineHeight:1.5 };

const actionBtn = (color) => ({ padding:"10px 18px", borderRadius:"10px", border:"none", background:color, color:"#fff", fontWeight:700, fontSize:"13px", cursor:"pointer", boxShadow:`0 3px 10px ${color}44` });

// PILL SELECT STYLES (dropdown fields)
const pillWrap = { display:"flex", alignItems:"center", gap:"8px", background:"#fff", border:"1.5px solid #e2e8f0", borderRadius:"12px", padding:"12px 16px" };
const pillWrapDisabled = { background:"#f1f5f9", opacity:0.6 };
const pillSelect = { flex:1, border:"none", outline:"none", background:"transparent", fontSize:"13.5px", fontWeight:600, color:"#0f172a", appearance:"none", fontFamily:"inherit", cursor:"pointer", minWidth:0 };
const pillCaret = { color:"#94a3b8", fontSize:"12px", flexShrink:0 };