// features/chatbot/ChatbotPage.js — "Practice with Progga", built on the same
// AppShell/studio chrome as the Worksheet/Quiz/Study Note studios.
import React, { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import AppShell from "../../shared/ui/AppShell";
import { IconChatbot, IconCheck, IconPlus, IconSpark } from "../../shared/ui/icons";
import {
  getClasses, getSubjects, getChapters, getTopics, chatHistory, chatSessions, retryMistake,
} from "../../shared/services/api";
import { useChatSession } from "../../shared/services/useChatSession";
import "../../shared/ui/studio.css";
import "../../shared/ui/SavedContentList.css";

/* ---------- bilingual UI text ---------- */
const TXT = {
  bangla: {
    breadcrumb: "প্রজ্ঞার সাথে প্র্যাকটিস",
    pageTitle: "প্রজ্ঞার সাথে প্র্যাকটিস",
    subtitle: "প্রশ্ন করো বা প্র্যাকটিস করো — নিজের ভাষায়।",
    setupLabel: "সেটআপ",
    step1: "তুমি কী নিয়ে পড়তে চাও?",
    step2Title: "কী করতে চাও বেছে নাও",
    selectClass: "ক্লাস বেছে নিন", selectSubject: "বিষয় বেছে নিন",
    selectChapter: "অধ্যায় বেছে নিন", selectTopic: "টপিক বেছে নিন",
    classL: "ক্লাস", subjectL: "বিষয়", chapterL: "অধ্যায় (ঐচ্ছিক)", topicL: "টপিক (ঐচ্ছিক)",
    lang: "উত্তরের ভাষা:",
    hintReady: "উপরে থেকে একটা মোড বেছে নাও — যা করবে সব এখানে জমতে থাকবে।",
    hintPick: "শুরু করতে অন্তত একটা বিষয় বেছে নাও।",
    modeQaTitle: "প্রশ্ন করো", modeSetTitle: "প্র্যাকটিস সেট", modeOneTitle: "একটা একটা করে", modeQuizTitle: "কুইজ",
    qaTitle: "❓ প্রশ্ন করো",
    samplesHint: "নিচের যেকোনো প্রশ্নে ক্লিক করো, অথবা নিজে টাইপ করো:",
    askPlaceholder: "আরেকটা প্রশ্ন লিখো...", askBtn: "জিজ্ঞেস করো",
    answering: "⌛ উত্তর তৈরি হচ্ছে...",
    keyPoints: "🔑 মূল পয়েন্ট", formula: "📐 সূত্র", examples: "💡 উদাহরণ", summary: "📌 সারসংক্ষেপ",
    explainMore: "🔍 আরও বুঝিয়ে বলো", explaining: "⌛ আরও বোঝানো হচ্ছে...",
    detailTitle: "🔍 বিস্তারিত ব্যাখ্যা", moreExamples: "আরও উদাহরণ",
    setTitle: "📝 প্র্যাকটিস সেট", setLabel: "সেট",
    generating: "⌛ প্রশ্ন তৈরি হচ্ছে...",
    showAns: "👁️ উত্তর দেখাও", hideAns: "উত্তর লুকাও", anotherSet: "🔄 আরেকটা সেট দাও",
    oneTitle: "🎯 একটা একটা করে", qLabel: "প্রশ্ন",
    hintBtn: "💡 Hint দাও", revealAns: "উত্তর দেখাও", nextQ: "➡️ পরের প্রশ্ন",
    didSolve: "তুমি কি পেরেছিলে?", solved: "✅ পেরেছি", notSolved: "❌ পারিনি",
    solvedMsg: "🎉 দারুণ!", notSolvedMsg: "ঠিক আছে, পরের বার হবে।",
    newChat: "নতুন কথোপকথন", history: "আগের সেশন", noSessions: "কোনো আগের সেশন নেই",
    loadingSessions: "লোড হচ্ছে...", loadingSession: "সেশন লোড হচ্ছে...",
    loadingScope: "⌛ লোড হচ্ছে...",
    quizErrorMsg: "⚠️ কুইজ তৈরি করতে সমস্যা হয়েছে।",
    quizRetry: "🔄 আবার চেষ্টা করো",
    quizStillRunning: "⏳ এখনো চলছে — একটু পরে আবার দেখো।",
    wizardSubjectTitle: "কোন বিষয়ে প্র্যাকটিস করতে চাও?",
    wizardSubjectSub: "একটা বিষয় বেছে নাও",
    wizardChapterTitle: "কোন অধ্যায়?",
    wizardChapterSub: "একটা অধ্যায় বেছে নাও, অথবা পুরো বিষয় নিয়ে প্র্যাকটিস শুরু করো",
    wizardTopicTitle: "কোন টপিক?",
    wizardTopicSub: "একটা টপিক বেছে নাও, অথবা পুরো অধ্যায় নিয়ে প্র্যাকটিস শুরু করো",
    back: "← পেছনে যাও",
    noSubjects: "এই ক্লাসের জন্য কোনো বিষয় পাওয়া যায়নি।",
    noChapters: "এই বিষয়ে কোনো অধ্যায় পাওয়া যায়নি।",
    noTopics: "এই অধ্যায়ে কোনো টপিক পাওয়া যায়নি।",
    skipSubject: "+ সরাসরি এই বিষয়ের ওপর প্র্যাকটিস শুরু করো",
    skipChapter: "+ সরাসরি এই অধ্যায়ের ওপর প্র্যাকটিস শুরু করো",
    mistakeTryAgain: "আবার চেষ্টা করো",
    mistakeMoveOn: "পরে করব",
  },
  english: {
    breadcrumb: "Practice with Progga",
    pageTitle: "Practice with Progga",
    subtitle: "Ask questions or practice — in your own language.",
    setupLabel: "Setup",
    step1: "What do you want to study?",
    step2Title: "Choose what to do",
    selectClass: "Select class", selectSubject: "Select subject",
    selectChapter: "Select chapter", selectTopic: "Select topic",
    classL: "Class", subjectL: "Subject", chapterL: "Chapter (optional)", topicL: "Topic (optional)",
    lang: "Answer language:",
    hintReady: "Pick a mode above — everything you do stays here as you go.",
    hintPick: "Select at least a subject to start.",
    modeQaTitle: "Ask", modeSetTitle: "Practice Set", modeOneTitle: "One by one", modeQuizTitle: "Quiz",
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
    newChat: "New conversation", history: "Past sessions", noSessions: "No past sessions",
    loadingSessions: "Loading...", loadingSession: "Loading session...",
    loadingScope: "⌛ Loading...",
    quizErrorMsg: "⚠️ Failed to generate quiz.",
    quizRetry: "🔄 Try Again",
    quizStillRunning: "⏳ Still running — check back in a moment.",
    wizardSubjectTitle: "Which subject do you want to practice?",
    wizardSubjectSub: "Pick a subject to get started",
    wizardChapterTitle: "Which chapter?",
    wizardChapterSub: "Pick a chapter, or start practicing the whole subject",
    wizardTopicTitle: "Which topic?",
    wizardTopicSub: "Pick a topic, or start practicing the whole chapter",
    back: "← Back",
    noSubjects: "No subjects found for this class.",
    noChapters: "No chapters found for this subject.",
    noTopics: "No topics found for this chapter.",
    skipSubject: "+ Start practicing this whole subject",
    skipChapter: "+ Start practicing this whole chapter",
    mistakeTryAgain: "Try again",
    mistakeMoveOn: "I'll do this later",
  },
};

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
function sessionTitle(s) {
  let str = `Session #${s.session_id}`;
  if (s.subject_name) str += ` · ${s.subject_name}`;
  if (s.start_time) { const d = new Date(s.start_time); if (!isNaN(d)) str += ` · ${MONTHS[d.getMonth()]} ${d.getDate()}`; }
  return str;
}

function SelectField({ label, value, onChange, disabled, options, placeholder }) {
  return (
    <div className="gw-field">
      <label className="gw-label">{label}</label>
      <div className="gw-select">
        <select value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)} aria-label={label}>
          <option value="">{placeholder}</option>
          {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor"
             strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="m6 9 6 6 6-6" />
        </svg>
      </div>
    </div>
  );
}

/* ── the student wizard (Subject → Chapter → Topic) ────────────────────────
   Every student, any class — one big-card decision per screen instead of
   four dropdowns on one page. Chapter and topic are optional here (same as
   the dropdown flow always allowed), so both those screens also offer a
   "practice the whole X now" shortcut via skipToMode below. A student whose
   account predates the class field still gets the SelectField grid above. */
function PickCard({ label, onClick }) {
  return (
    <button type="button" className="gw-mode-card" onClick={onClick}>
      <span className="gw-mode-icon">{label.charAt(0).toUpperCase()}</span>
      <span className="gw-mode-title">{label}</span>
    </button>
  );
}

function TopicRow({ index, label, onClick }) {
  return (
    <button type="button" className="gw-topic-row" onClick={onClick}>
      <span className="gw-topic-num">{index}</span>
      <span className="gw-topic-name">{label}</span>
      <svg className="gw-topic-arrow" viewBox="0 0 24 24" width="18" height="18" fill="none"
           stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M9 6l6 6-6 6" />
      </svg>
    </button>
  );
}

function WizardCrumbs({ subjectName, chapterName, onSubject, onChapter }) {
  return (
    <div className="gw-crumb-bar">
      <button type="button" className="gw-crumb-chip" onClick={onSubject}>{subjectName}</button>
      {chapterName && (
        <>
          <span className="gw-crumb-sep">/</span>
          <button type="button" className="gw-crumb-chip" onClick={onChapter}>{chapterName}</button>
        </>
      )}
    </div>
  );
}

let _bid = 0;
const newId = () => `b${++_bid}`;

export default function ChatbotPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [user, setUser] = useState(null);
  const [classList, setClassList] = useState([]);
  const [subjectList, setSubjectList] = useState([]);
  const [chapterList, setChapterList] = useState([]);
  const [topicList, setTopicList] = useState([]);
  const [selectedClass, setSelectedClass] = useState("");
  const [selectedSubject, setSelectedSubject] = useState("");
  const [selectedChapter, setSelectedChapter] = useState("");
  const [selectedTopicId, setSelectedTopicId] = useState("");
  // Wizard-only: true once the student picks "practice the whole
  // subject/chapter" instead of narrowing further, or once a past session is
  // resumed (loadHistory sets this too — there's nothing left to pick).
  const [skipToMode, setSkipToMode] = useState(false);
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
  const [sessionLoading, setSessionLoading] = useState(false);
  const [dropdownLoading, setDropdownLoading] = useState(false);
  const [sessions, setSessions] = useState([]);
  const [sessionsListLoading, setSessionsListLoading] = useState(true);
  const [activeSid, setActiveSid] = useState(null);
  const [loadingSid, setLoadingSid] = useState(null);
  const feedEndRef = useRef(null);
  const prevCount = useRef(0);
  const [quizFeed, setQuizFeed] = useState([]);
  const [quizError, setQuizError] = useState(null); // { blockId, message, isTimeout }


  const clearFeeds = () => {
    setSamples([]); setQuestion("");
    setQaFeed([]); setSetFeed([]); setObFeed([]); setQuizFeed([]); setQuizError(null); setMode(null);
  };

  // Populates the wizard's subject/chapter/topic state from a scope object
  // shaped like /chat/history's "scope" (or /chat/mistakes/.../retry's) —
  // used both to resume a past session and to land on a mistake-retry
  // question, neither of which goes through the wizard's own pick-flow.
  const applyScope = useCallback(async (sc) => {
    if (sc.class_name) { setSelectedClass(sc.class_name); try { const r = await getSubjects(sc.class_name); setSubjectList(r.data || []); } catch { } }
    if (sc.subject_id) { setSelectedSubject(String(sc.subject_id)); try { const r = await getChapters(sc.subject_id); setChapterList(r.data || []); } catch { } }
    if (sc.chapter_id) { setSelectedChapter(String(sc.chapter_id)); try { const r = await getTopics(sc.chapter_id); setTopicList(r.data || []); } catch { } }
    if (sc.topic_id) setSelectedTopicId(String(sc.topic_id));
  }, []);

  const loadHistory = useCallback(async (uid, sid, preferMode) => {
    setSessionLoading(true); clearFeeds();
    try {
      const { data } = await chatHistory(sid);
      if (data && data.session_id) {
        setActiveSid(data.session_id);
        // A resumed session has its scope (and usually its content) already
        // decided — jump straight past the wizard to the mode/feed view
        // rather than making them re-pick a subject with nothing to pick.
        setSkipToMode(true);
        await applyScope(data.scope || {});
        setQaFeed((data.qa || []).map((q) => ({ id: newId(), question: q.question, answer: q.answer, context: q.context || "", explain: q.explain || null, explainLoading: false, loading: false })));
        setSetFeed((data.sets || []).map((s, i, arr) => ({ id: newId(), questions: s.questions || [], showAnswers: false, isLatest: i === arr.length - 1, loading: false })));
        setObFeed((data.oneByone || []).map((o, i, arr) => ({ id: newId(), contentId: o.content_id, question: o.question, hints: o.hints || [], hintsUsed: o.hints_used || 0, answer: o.answer || null, selfReport: o.self_report ?? null, isLatest: i === arr.length - 1, loading: false })));
        setQuizFeed((data.quiz || []).map((qz, i, arr) => {
          const answers = {};
          (qz.questions || []).forEach((q) => { if (q.student_answer != null) answers[q.question_number] = q.student_answer; });
          return { id: newId(), questions: qz.questions || [], answers, hints: qz.hints || {}, hintsUsed: qz.hints_used || {}, isLatest: i === arr.length - 1, loading: false };
        }));
        // A "re-practice this" link from Profile knows which mode the
        // mistake it's pointing at lives in — honor that over the usual
        // qa > set > oneByone > quiz priority when that feed is non-empty.
        const hasMode = {
          qa: (data.qa || []).length > 0, set: (data.sets || []).length > 0,
          oneByone: (data.oneByone || []).length > 0, quiz: (data.quiz || []).length > 0,
        };
        if (preferMode && hasMode[preferMode]) setMode(preferMode);
        else if (hasMode.qa) setMode("qa");
        else if (hasMode.set) setMode("set");
        else if (hasMode.oneByone) setMode("oneByone");
        else if (hasMode.quiz) setMode("quiz");
      }
    } catch { } finally { setSessionLoading(false); }
  }, [applyScope]);

  const refreshSessions = useCallback(async (uid) => {
    setSessionsListLoading(true);
    try { const { data } = await chatSessions(uid); setSessions(data.sessions || []); }
    catch { setSessions([]); }
    finally { setSessionsListLoading(false); }
  }, []);

  useEffect(() => {
    const stored = localStorage.getItem("user");
    if (!stored) { navigate("/login"); return; }
    const u = JSON.parse(stored);
    setUser(u);
    if (u.class_name) {
      // A student's class is fixed at signup — skip the class picker and go
      // straight to that class's subjects.
      setSelectedClass(u.class_name);
      getSubjects(u.class_name).then(({ data }) => setSubjectList(data || [])).catch(() => { });
    } else {
      getClasses().then(({ data }) => setClassList(data || [])).catch(() => { });
    }
    refreshSessions(u.user_id);
  }, [navigate, refreshSessions]);

  // Pre-existing accounts predate the class field and have no class_name yet
  // — they fall back to the manual picker below rather than being blocked.
  const isStudentWithClass = !!user?.class_name;

  useEffect(() => {
    const count = qaFeed.length + setFeed.length + obFeed.length;
    if (count > prevCount.current) feedEndRef.current?.scrollIntoView({ behavior: "smooth" });
    prevCount.current = count;
  }, [qaFeed, setFeed, obFeed]);

  const handleLogout = () => {
    ["access_token", "refresh_token", "user", "chatbot_session_id"].forEach((k) =>
      localStorage.removeItem(k)
    );
    Object.keys(localStorage)
      .filter((k) => k.startsWith("activeJob:"))
      .forEach((k) => localStorage.removeItem(k));
    navigate("/", { state: { splash: true } });
  };

  const openSession = async (sid, preferMode) => {
    if (sid === activeSid || sessionLoading) return;
    setLoadingSid(sid);
    chat.setSessionId(sid);
    await loadHistory(user.user_id, sid, preferMode);
    setLoadingSid(null);
  };

  // A "re-practice" link from Profile's mistakes list arrives as
  // /chatbot?session_id=123&mode=quiz — jump straight into that session (and
  // that mode) once the user is known, the same way clicking it in the rail
  // would, but landing on the feed the mistake actually came from.
  const deepLinkHandled = useRef(false);
  useEffect(() => {
    if (deepLinkHandled.current || !user) return;
    const sid = Number(searchParams.get("session_id"));
    if (!sid) return;
    deepLinkHandled.current = true;
    openSession(sid, searchParams.get("mode") || undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, searchParams]);

  // "Fix this mistake" — a Profile mistakes-list link arrives as
  // /chatbot?retry_content_id=501. This drops straight into the SAME
  // session the mistake happened in (the backend reuses it), in the normal
  // one-by-one mode, with the fresh similar-but-different question as its
  // first block — not a separate flow bolted onto the page. Each block this
  // produces carries retryOfMistake so the render below knows to swap in
  // "try again / do later" instead of "next question" if it's answered
  // wrong; answered right, it's indistinguishable from any other question.
  const startRetry = async (contentId) => {
    if (busy) return; setBusy(true);
    setSkipToMode(true);
    setMode("oneByone");
    const id = newId();
    setObFeed((f) => [...f.map((b) => ({ ...b, isLatest: false })), {
      id, contentId: null, question: "", hints: [], hintsUsed: 0, answer: null,
      selfReport: null, isLatest: true, loading: true, retryOfMistake: contentId,
    }]);
    try {
      const { data } = await retryMistake(contentId);
      if (data && data.content_id) {
        chat.setSessionId(data.session_id);
        setActiveSid(data.session_id);
        if (data.scope) await applyScope(data.scope);
        setObFeed((f) => f.map((b) => b.id === id ? { ...b, contentId: data.content_id, question: data.question || "", loading: false } : b));
        refreshSessions(user.user_id);
      } else {
        setObFeed((f) => f.map((b) => b.id === id ? { ...b, loading: false } : b));
      }
    } catch { setObFeed((f) => f.map((b) => b.id === id ? { ...b, loading: false } : b)); }
    setBusy(false);
  };

  const retryLinkHandled = useRef(false);
  useEffect(() => {
    if (retryLinkHandled.current || !user) return;
    const rcid = Number(searchParams.get("retry_content_id"));
    if (!rcid) return;
    retryLinkHandled.current = true;
    startRetry(rcid);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, searchParams]);

  // "আবার চেষ্টা করো" on a wrongly-answered retry block — another
  // similar-but-different question on the same mistake, appended the same
  // way a normal "next question" would be (same session, already-known
  // scope), just still tagged so it keeps the special buttons if missed again.
  const retryAgainForBlock = async (mistakeContentId) => {
    if (busy) return; setBusy(true);
    const id = newId();
    setObFeed((f) => [...f.map((b) => ({ ...b, isLatest: false })), {
      id, contentId: null, question: "", hints: [], hintsUsed: 0, answer: null,
      selfReport: null, isLatest: true, loading: true, retryOfMistake: mistakeContentId,
    }]);
    try {
      const { data } = await retryMistake(mistakeContentId);
      if (data && data.content_id) {
        setObFeed((f) => f.map((b) => b.id === id ? { ...b, contentId: data.content_id, question: data.question || "", loading: false } : b));
      } else {
        setObFeed((f) => f.map((b) => b.id === id ? { ...b, loading: false } : b));
      }
    } catch { setObFeed((f) => f.map((b) => b.id === id ? { ...b, loading: false } : b)); }
    setBusy(false);
  };

  const newChat = () => {
    chat.resetSession(); setActiveSid(null); clearFeeds();
    setSkipToMode(false);
    setSelectedSubject(""); setSelectedChapter(""); setSelectedTopicId("");
    setChapterList([]); setTopicList([]);
    if (isStudentWithClass) {
      // The class picker is hidden for these students — re-populate their
      // class's subjects instead of leaving the (invisible) class blank.
      setSubjectList([]);
      getSubjects(user.class_name).then(({ data }) => setSubjectList(data || [])).catch(() => { });
    } else {
      setSelectedClass(""); setSubjectList([]);
    }
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

  // Wizard-only: going back a step just clears that level's selection and
  // everything under it — chapterList/subjectList are still cached from the
  // forward trip, so no refetch is needed.
  const backToSubjectStep = () => {
    setSkipToMode(false);
    setSelectedSubject(""); setChapterList([]); setSelectedChapter("");
    setTopicList([]); setSelectedTopicId("");
    resetOnSelectionChange();
  };
  const backToChapterStep = () => {
    setSkipToMode(false);
    setSelectedChapter(""); setTopicList([]); setSelectedTopicId("");
    resetOnSelectionChange();
  };
  // Undoes whichever way the mode step was reached — a topic pick (clearing
  // it lands back on the topic step) or a skip from chapter/subject (clearing
  // the flag lands back wherever selectedChapter/selectedSubject say it
  // should, since the step is derived from that state either way).
  const backFromMode = () => {
    setSkipToMode(false);
    setSelectedTopicId("");
  };
  const wizardStep = skipToMode ? "picker"
    : !selectedSubject ? "subject"
    : !selectedChapter ? "chapter"
    : !selectedTopicId ? "topic"
    : "picker";
  const showModeStep = !isStudentWithClass || wizardStep === "picker";
  const selectedSubjectName = subjectList.find((s) => String(s.subject_id) === String(selectedSubject))?.name || "";
  const selectedChapterObj = chapterList.find((c) => String(c.chapter_id) === String(selectedChapter));
  const selectedChapterName = selectedChapterObj ? `Ch ${selectedChapterObj.chapter_no}: ${selectedChapterObj.name}` : "";
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
    setQuizError(null);
    setQuizFeed((f) => [...f.map((b) => ({ ...b, isLatest: false })), { id, questions: [], answers: {}, hints: {}, hintsUsed: {}, isLatest: true, loading: true }]);
    try {
      const d = await chat.quizSet("mixed");
      setQuizFeed((f) => f.map((b) => b.id === id ? { ...b, questions: d.questions || [], loading: false } : b));
      setActiveSid(chat.getSessionId()); if (wasNew) afterFirstContent();
    } catch (err) {
      setQuizFeed((f) => f.map((b) => b.id === id ? { ...b, loading: false } : b));
      // A cancelled poll (superseded by a newer quiz in the same session)
      // isn't a real error worth showing the user — only surface genuine
      // FAILED and client-side timeouts.
      if (!err?.isCancelled) {
        setQuizError({
          blockId: id,
          message: err?.message || t.quizErrorMsg,
          isTimeout: err?.isTimeout || false,
        });
      }
    }
    setBusy(false);
  };
  const selectQuizOption = (blockId, qnum, label, contentId) => {
    let alreadyAnswered = false;
    setQuizFeed((f) => f.map((b) => {
      if (b.id !== blockId) return b;
      if (b.answers[qnum] != null) { alreadyAnswered = true; return b; }
      return { ...b, answers: { ...b.answers, [qnum]: label } };
    }));
    if (!alreadyAnswered) chat.submitQuizAnswer(contentId, label);
  };
  const quizHint = async (blockId, qnum, contentId) => {
    const block = quizFeed.find((b) => b.id === blockId);
    const used = block?.hintsUsed[qnum] || 0;
    if (used >= 2) return;
    try {
      const d = await chat.getHint(contentId, used);
      if (d.hint) setQuizFeed((f) => f.map((b) => b.id !== blockId ? b : { ...b, hints: { ...b.hints, [qnum]: [...(b.hints[qnum] || []), d.hint] }, hintsUsed: { ...b.hintsUsed, [qnum]: d.hints_used } }));
    } catch { }
  };

  const MODES = [
    { key: "qa", icon: "❓", color: "#ef4444", bg: "#fee2e2", title: t.modeQaTitle, sub: language === "bangla" ? "Instant answer পাও" : "Get an instant answer", action: openQA },
    { key: "set", icon: "📝", color: "#0ea5e9", bg: "#e0f2fe", title: t.modeSetTitle, sub: language === "bangla" ? "Questions practice করো" : "Practice questions", action: openSet },
    { key: "oneByone", icon: "🎯", color: "#16a34a", bg: "#dcfce7", title: t.modeOneTitle, sub: language === "bangla" ? "Step by step practice" : "Step by step practice", action: openOneByOne },
    { key: "quiz", icon: "📋", color: "#f59e0b", bg: "#fef3c7", title: t.modeQuizTitle, sub: language === "bangla" ? "MCQ quiz নাও" : "Take an MCQ quiz", action: openQuiz },
  ];

  const totalStepOneFields = isStudentWithClass ? 3 : 4;
  const chosenStepOne = [
    ...(isStudentWithClass ? [] : [selectedClass]),
    selectedSubject, selectedChapter, selectedTopicId,
  ].filter(Boolean).length;

  const rail = (
    <section className="as-panel sc">
      <button type="button" onClick={newChat} disabled={sessionLoading}
        className="wg-solid" style={{ width: "100%", justifyContent: "center", marginBottom: "18px" }}>
        <IconPlus /> {t.newChat}
      </button>
      <h3 className="sc-title">{t.history}</h3>
      {sessionsListLoading && <p className="sc-note">{t.loadingSessions}</p>}
      {!sessionsListLoading && sessions.length === 0 && (
        <div className="sc-empty">
          <span className="sc-empty-mark"><IconSpark /></span>
          <p>{t.noSessions}</p>
        </div>
      )}
      {!sessionsListLoading && sessions.length > 0 && (
        <ul className="sc-list">
          {sessions.map((s) => {
            const isLoadingThis = loadingSid === s.session_id;
            const isDisabled = sessionLoading && !isLoadingThis;
            return (
              <li key={s.session_id}>
                <button type="button"
                  className={`sc-item${s.session_id === activeSid ? " is-active" : ""}`}
                  disabled={isDisabled}
                  aria-current={s.session_id === activeSid ? "true" : undefined}
                  onClick={() => openSession(s.session_id)}>
                  <span className="sc-item-name">{isLoadingThis ? "⏳ " : ""}{sessionTitle(s)}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );

  return (
    <AppShell breadcrumb={t.breadcrumb} user={user} onLogout={handleLogout} tone="chatbot" rail={rail}>
      <section className="gw-head">
        <span className="gw-head-icon"><IconChatbot /></span>
        <div>
          <h1>{t.pageTitle}</h1>
          <p>{t.subtitle}</p>
        </div>
      </section>

      <div style={langRow}>
        <span style={langRowLabel}>{t.lang}</span>
        <div style={langToggle}>
          {[["bangla", "BN"], ["english", "EN"]].map(([v, l]) => (
            <button key={v} type="button" onClick={() => onLanguage(v)} disabled={langLocked}
              style={langBtn(language === v, langLocked && language !== v)}>{l}</button>
          ))}
        </div>
      </div>

      {isStudentWithClass ? (
        <>
          {wizardStep === "subject" && (
            <section className="as-panel gw-step">
              <header className="gw-step-head">
                <span className="gw-step-no">1</span>
                <div className="gw-step-text">
                  <h2>{t.wizardSubjectTitle}</h2>
                  <p>{t.wizardSubjectSub}</p>
                </div>
              </header>
              {subjectList.length === 0 ? (
                <p className="gw-pick-empty">{t.noSubjects}</p>
              ) : (
                <div className="gw-mode-grid">
                  {subjectList.map((s) => (
                    <PickCard key={s.subject_id} label={s.name} onClick={() => onSubject(s.subject_id)} />
                  ))}
                </div>
              )}
            </section>
          )}

          {wizardStep === "chapter" && (
            <section className="as-panel gw-step">
              <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: "12px", marginBottom: "4px" }}>
                <button type="button" className="gw-back-btn" style={{ marginBottom: 0 }} onClick={backToSubjectStep}>{t.back}</button>
                <button type="button" className="gw-sample-open" style={{ marginBottom: 0 }} onClick={() => setSkipToMode(true)}>
                  {t.skipSubject}
                </button>
              </div>
              <header className="gw-step-head">
                <span className="gw-step-no">2</span>
                <div className="gw-step-text">
                  <h2>{t.wizardChapterTitle}</h2>
                  <p>{t.wizardChapterSub}</p>
                </div>
              </header>
              {chapterList.length === 0 ? (
                <p className="gw-pick-empty">{t.noChapters}</p>
              ) : (
                <div className="gw-mode-grid">
                  {chapterList.map((ch) => (
                    <PickCard
                      key={ch.chapter_id}
                      label={`Ch ${ch.chapter_no}: ${ch.name}`}
                      onClick={() => onChapter(ch.chapter_id)}
                    />
                  ))}
                </div>
              )}
            </section>
          )}

          {wizardStep === "topic" && (
            <section className="as-panel gw-step">
              <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: "12px", marginBottom: "4px" }}>
                <button type="button" className="gw-back-btn" style={{ marginBottom: 0 }} onClick={backToChapterStep}>{t.back}</button>
                <button type="button" className="gw-sample-open" style={{ marginBottom: 0 }} onClick={() => setSkipToMode(true)}>
                  {t.skipChapter}
                </button>
              </div>
              <header className="gw-step-head">
                <span className="gw-step-no">3</span>
                <div className="gw-step-text">
                  <h2>{t.wizardTopicTitle}</h2>
                  <p>{t.wizardTopicSub}</p>
                </div>
              </header>
              {topicList.length === 0 ? (
                <p className="gw-pick-empty">{t.noTopics}</p>
              ) : (
                <div className="gw-topic-list">
                  {topicList.map((tp, i) => (
                    <TopicRow key={tp.topic_id} index={i + 1} label={tp.name} onClick={() => onTopic(tp.topic_id)} />
                  ))}
                </div>
              )}
            </section>
          )}
        </>
      ) : (
        <section className="as-panel gw-step">
          <header className="gw-step-head">
            <span className={`gw-step-no${canStart ? " is-done" : ""}`}>
              {canStart ? <IconCheck /> : "1"}
            </span>
            <div className="gw-step-text">
              <h2>{t.step1}</h2>
            </div>
            <div className="gw-tally">
              <span className="gw-tally-count">
                {t.setupLabel} <strong>{chosenStepOne}/{totalStepOneFields}</strong>
              </span>
              <div className="gw-tally-track">
                <div className="gw-tally-fill" style={{ width: `${(chosenStepOne / totalStepOneFields) * 100}%` }} />
              </div>
            </div>
          </header>

          <div className="gw-fields">
            {!isStudentWithClass && (
              <SelectField label={t.classL} value={selectedClass} onChange={onClass}
                placeholder={t.selectClass} options={classList.map((c) => ({ value: c.class_name, label: c.class_name }))} />
            )}
            <SelectField label={t.subjectL} value={selectedSubject} onChange={onSubject}
              disabled={!selectedClass} placeholder={t.selectSubject}
              options={subjectList.map((s) => ({ value: s.subject_id, label: s.name }))} />
            <SelectField label={t.chapterL} value={selectedChapter} onChange={onChapter}
              disabled={!selectedSubject} placeholder={t.selectChapter}
              options={chapterList.map((ch) => ({ value: ch.chapter_id, label: `Ch ${ch.chapter_no}: ${ch.name}` }))} />
            <SelectField label={t.topicL} value={selectedTopicId} onChange={onTopic}
              disabled={!selectedChapter} placeholder={t.selectTopic}
              options={topicList.map((tp) => ({ value: tp.topic_id, label: tp.name }))} />
          </div>

          <p className={`gw-hint${canStart ? " is-done" : ""}`}>
            <IconSpark />
            {dropdownLoading ? t.loadingScope : (canStart ? t.hintReady : t.hintPick)}
          </p>
        </section>
      )}

      {/* ── STEP 2 · mode ── */}
      {showModeStep && (
        <section className="as-panel gw-step">
          {isStudentWithClass && (
            <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: "12px", marginBottom: "18px" }}>
              <button type="button" className="gw-back-btn" style={{ marginBottom: 0 }} onClick={backFromMode}>{t.back}</button>
              <WizardCrumbs
                subjectName={selectedSubjectName}
                chapterName={selectedChapterName}
                onSubject={backToSubjectStep}
                onChapter={backToChapterStep}
              />
            </div>
          )}
          <header className="gw-step-head">
            <span className={`gw-step-no${mode ? " is-done" : ""}`}>
              {mode ? <IconCheck /> : "2"}
            </span>
            <div className="gw-step-text">
              <h2>{t.step2Title}</h2>
            </div>
          </header>

          <div className="gw-mode-grid">
            {MODES.map(({ key, icon, color, bg, title, sub, action }) => (
              <button key={key} type="button"
                className={`gw-mode-card${mode === key ? " is-active" : ""}`}
                style={{ "--mode-color": color, "--mode-wash": bg }}
                onClick={action}
                disabled={!canStart || sessionLoading}>
                <span className="gw-mode-icon">{icon}</span>
                <span className="gw-mode-title">{title}</span>
                <span className="gw-mode-sub">{sub}</span>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* SESSION LOADING */}
      {sessionLoading && (
        <div className="as-panel" style={loadingCard}>
          <span className="wg-spinner" style={{ color: "var(--tone)" }} />
          <span style={{ fontWeight: 700, color: "var(--tone)" }}>{t.loadingSession}</span>
        </div>
      )}

      {/* QUIZ MODE */}
      {mode === "quiz" && (
        <section className="as-panel">
          <h3 style={contentTitle}>📋 {t.modeQuizTitle}</h3>

          {/* Client-side timeout — distinct from a real FAILED */}
          {quizError?.isTimeout && (
            <div style={quizTimeoutCard}>
              <span>{t.quizStillRunning}</span>
            </div>
          )}

          {/* Real FAILED — distinct from the timeout above, offers Retry */}
          {quizError && !quizError.isTimeout && (
            <div style={quizErrorCard}>
              <span style={{ color: "#991b1b", fontWeight: 600, fontSize: "13px" }}>⚠️ {quizError.message}</span>
              <button onClick={addQuiz} style={quizRetryBtn}>{t.quizRetry}</button>
            </div>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: "16px", marginTop: "12px" }}>
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
                        <div style={{ display: "flex", flexDirection: "column", gap: "6px", marginTop: "10px" }}>
                          {q.options.map((opt) => {
                            const isSelected = sel === opt.label;
                            const isCorrect = opt.label === q.correct_option;
                            let bg = "var(--dhi-surface-sunken)", border = "1.5px solid var(--dhi-line)", color = "var(--dhi-ink)";
                            if (answered) {
                              if (isCorrect) { bg = "#ecfdf5"; border = "1.5px solid #22c55e"; color = "#166534"; }
                              else if (isSelected) { bg = "#fef2f2"; border = "1.5px solid #ef4444"; color = "#991b1b"; }
                            }
                            return (
                              <button key={opt.label} onClick={() => selectQuizOption(b.id, q.question_number, opt.label, q.content_id)}
                                disabled={answered}
                                style={{ textAlign: "left", padding: "10px 14px", borderRadius: "10px", background: bg, border, color, fontSize: "13px", fontWeight: 600, cursor: answered ? "default" : "pointer", transition: "all 0.15s" }}>
                                {opt.label}. {opt.text}
                                {answered && isCorrect && " ✅"}
                                {answered && isSelected && !isCorrect && " ❌"}
                              </button>
                            );
                          })}
                        </div>
                        {answered && (
                          <div style={{ marginTop: "8px", fontSize: "13px", fontWeight: 700, color: sel === q.correct_option ? "#16a34a" : "#dc2626" }}>
                            {sel === q.correct_option ? "✅ সঠিক!" : `❌ ভুল — সঠিক উত্তর: ${q.correct_option}`}
                          </div>
                        )}
                        {hints.map((h, i) => <div key={i} style={hintRevealStyle}>💡 Hint {i + 1}: {h}</div>)}
                        {!answered && hintsUsed < 2 && (
                          <button onClick={() => quizHint(b.id, q.question_number, q.content_id)}
                            style={{ ...actionBtn("#f59e0b"), marginTop: "8px", padding: "6px 12px", fontSize: "12px" }}>
                            💡 Hint ({hintsUsed}/2)
                          </button>
                        )}
                      </div>
                    );
                  })}
                  {b.questions.length > 0 && (
                    <div style={{ display: "flex", gap: "10px", alignItems: "center", marginTop: "12px", flexWrap: "wrap" }}>
                      <span style={{ fontWeight: 800, fontSize: "14px", color: "var(--dhi-ink)" }}>
                        স্কোর: {correctCount}/{b.questions.length}
                      </span>
                      <button onClick={addQuiz} disabled={!b.isLatest || busy} style={actionBtn("var(--tone)")}>📋 আরও Quiz</button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Q&A MODE */}
      {mode === "qa" && (
        <section className="as-panel">
          <h3 style={contentTitle}>{t.qaTitle}</h3>
          {qaFeed.length === 0 && samples.length > 0 && (
            <div style={{ marginTop: "12px" }}>
              <p style={mutedText}>{t.samplesHint}</p>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {samples.map((s, i) => (
                  <button key={i} onClick={() => doAsk(s)} style={sampleBtnStyle}>{s}</button>
                ))}
              </div>
            </div>
          )}
          <div style={{ display: "flex", flexDirection: "column", gap: "18px", marginTop: "16px" }}>
            {qaFeed.map((b) => (
              <div key={b.id} style={feedBlock}>
                <div style={userBubbleStyle}>🙋 {b.question}</div>
                {b.loading && <p style={mutedText}>{t.answering}</p>}
                {b.answer && (
                  <div style={answerCardStyle}>
                    {b.answer.intro && <p style={{ margin: 0, fontSize: "15px", color: "var(--dhi-ink)", lineHeight: 1.7, fontWeight: 500 }}>{b.answer.intro}</p>}
                    {b.answer.key_points?.length > 0 && (
                      <div style={infoBlock("#f0fdf4", "#bbf7d0")}>
                        <div style={blockLabel}>{t.keyPoints}</div>
                        <ul style={ulStyle}>{b.answer.key_points.map((k, i) => <li key={i}>{k}</li>)}</ul>
                      </div>
                    )}
                    {b.answer.formula?.length > 0 && (
                      <div style={infoBlock("#fefce8", "#fde047")}>
                        <div style={blockLabel}>{t.formula}</div>
                        <ul style={ulStyle}>{b.answer.formula.map((f, i) => <li key={i} style={{ fontFamily: "monospace" }}>{f}</li>)}</ul>
                      </div>
                    )}
                    {b.answer.examples?.length > 0 && (
                      <div style={infoBlock("#eff6ff", "#bfdbfe")}>
                        <div style={blockLabel}>{t.examples}</div>
                        <ul style={ulStyle}>{b.answer.examples.map((e, i) => <li key={i}>{e}</li>)}</ul>
                      </div>
                    )}
                    {b.answer.summary && (
                      <div style={infoBlock("#f5f3ff", "#ddd6fe")}>
                        <div style={blockLabel}>{t.summary}</div>
                        <p style={{ margin: 0, fontSize: "14px", color: "var(--dhi-ink)" }}>{b.answer.summary}</p>
                      </div>
                    )}
                    {!b.explain && (
                      <button onClick={() => doExplainMore(b.id)} disabled={b.explainLoading}
                        style={actionBtn("var(--tone)")}>
                        {b.explainLoading ? t.explaining : t.explainMore}
                      </button>
                    )}
                    {b.explain && (
                      <div style={infoBlock("#faf5ff", "#e9d5ff")}>
                        <div style={blockLabel}>{t.detailTitle}</div>
                        {b.explain.detailed_explanation && <p style={{ fontSize: "14px", color: "var(--dhi-ink)", lineHeight: 1.7 }}>{b.explain.detailed_explanation}</p>}
                        {b.explain.more_examples?.length > 0 && (
                          <>
                            <div style={{ ...blockLabel, marginTop: "8px" }}>{t.moreExamples}</div>
                            <ul style={ulStyle}>{b.explain.more_examples.map((e, i) => <li key={i}>{e}</li>)}</ul>
                          </>
                        )}
                        {b.explain.analogy && <p style={{ fontSize: "14px", color: "#6b21a8", marginTop: "8px", fontStyle: "italic" }}>🧠 {b.explain.analogy}</p>}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
          <div style={askRow}>
            <input value={question} onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && doAsk()}
              placeholder={t.askPlaceholder} style={inputStyle} />
            <button onClick={() => doAsk()} disabled={busy} style={actionBtn("var(--tone)")}>
              {busy ? "⌛" : t.askBtn}
            </button>
          </div>
        </section>
      )}

      {/* SET MODE */}
      {mode === "set" && (
        <section className="as-panel">
          <h3 style={contentTitle}>{t.setTitle}</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: "16px", marginTop: "12px" }}>
            {setFeed.map((b, idx) => (
              <div key={b.id} style={feedBlock}>
                <div style={setLabel}>{t.setLabel} {idx + 1}</div>
                {b.loading && <p style={mutedText}>{t.generating}</p>}
                {b.questions.map((q, i) => (
                  <div key={i} style={questionCard}>
                    <div style={questionText}>{i + 1}. {q.question}
                      {q.type && <span style={typeTagStyle}>{q.type}</span>}
                    </div>
                    {b.showAnswers && q.answer && <div style={ansRevealStyle}>✅ {q.answer}</div>}
                  </div>
                ))}
                {b.questions.length > 0 && (
                  <div style={{ display: "flex", gap: "10px", marginTop: "12px", flexWrap: "wrap" }}>
                    <button onClick={() => toggleSetAnswers(b.id)} style={actionBtn("#64748b")}>{b.showAnswers ? t.hideAns : t.showAns}</button>
                    <button onClick={addSet} disabled={!b.isLatest || busy} style={actionBtn("#0ea5e9")}>{t.anotherSet}</button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ONE BY ONE MODE */}
      {mode === "oneByone" && (
        <section className="as-panel">
          <h3 style={contentTitle}>{t.oneTitle}</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: "16px", marginTop: "12px" }}>
            {obFeed.map((b, idx) => (
              <div key={b.id} style={feedBlock}>
                <div style={setLabel}>{t.qLabel} {idx + 1}</div>
                {b.loading && <p style={mutedText}>{t.generating}</p>}
                {b.question && (
                  <div style={questionCard}>
                    <div style={{ ...questionText, fontSize: "15px" }}>{b.question}</div>
                    {b.hints.map((h, i) => <div key={i} style={hintRevealStyle}>💡 Hint {i + 1}: {h}</div>)}
                    {b.answer && <div style={ansRevealStyle}>✅ {b.answer}</div>}
                    {b.answer && b.selfReport === null && (
                      <div style={{ display: "flex", gap: "10px", marginTop: "12px", alignItems: "center", flexWrap: "wrap" }}>
                        <span style={{ fontSize: "13px", fontWeight: 700, color: "var(--dhi-ink-soft)" }}>{t.didSolve}</span>
                        <button onClick={() => obReport(b.id, true)} style={actionBtn("#16a34a")}>{t.solved}</button>
                        <button onClick={() => obReport(b.id, false)} style={actionBtn("#ef4444")}>{t.notSolved}</button>
                      </div>
                    )}
                    {b.selfReport !== null && (
                      <div style={{ marginTop: "10px", fontSize: "13px", fontWeight: 700, color: b.selfReport ? "#16a34a" : "#dc2626" }}>
                        {b.selfReport ? t.solvedMsg : t.notSolvedMsg}
                      </div>
                    )}
                    <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", marginTop: "14px" }}>
                      {b.hintsUsed < 3 && !b.answer && (
                        <button onClick={() => obHint(b.id)} style={actionBtn("#f59e0b")}>{t.hintBtn} ({b.hintsUsed}/3)</button>
                      )}
                      {!b.answer && <button onClick={() => obReveal(b.id)} style={actionBtn("#64748b")}>{t.revealAns}</button>}
                      {b.retryOfMistake && b.selfReport === false ? (
                        <>
                          <button onClick={() => retryAgainForBlock(b.retryOfMistake)} disabled={!b.isLatest || busy} style={actionBtn("#16a34a")}>{t.mistakeTryAgain}</button>
                          <button onClick={nextOB} disabled={!b.isLatest || busy} style={actionBtn("#64748b")}>{t.mistakeMoveOn}</button>
                        </>
                      ) : (
                        <button onClick={nextOB} disabled={!b.isLatest || busy} style={actionBtn("#16a34a")}>{t.nextQ}</button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      <div ref={feedEndRef} />
    </AppShell>
  );
}

/* ===== STYLES ===== */
/* The content-language toggle is independent of the app's own English/বাংলা
   switch in the rail below — this one locks once a conversation starts,
   because switching languages mid-chat would orphan the existing feed. */
const langRow = { display: "flex", alignItems: "center", gap: "10px" };
const langRowLabel = { fontSize: ".88rem", fontWeight: 600, color: "var(--dhi-ink-soft)" };
const langToggle = { display: "flex", background: "var(--dhi-surface-sunken)", borderRadius: "999px", padding: "3px" };
const langBtn = (active, faded) => ({ padding: "6px 16px", borderRadius: "999px", border: "none", background: active ? "var(--tone)" : "transparent", color: active ? "#fff" : "var(--dhi-muted)", fontSize: "12px", fontWeight: 700, cursor: faded ? "not-allowed" : "pointer", opacity: faded ? 0.4 : 1, transition: "all 0.15s" });

const loadingCard = { display: "flex", alignItems: "center", gap: "14px", justifyContent: "center", padding: "24px" };

const contentTitle = { margin: "0 0 4px", fontSize: "1.12rem", fontWeight: 700, color: "var(--dhi-ink)" };

const feedBlock = { paddingBottom: "20px", borderBottom: "1px dashed var(--dhi-line)" };
const setLabel = { fontSize: "11px", fontWeight: 800, color: "var(--dhi-muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "10px" };
const mutedText = { fontSize: "13px", color: "var(--dhi-muted)", fontWeight: 600 };

const questionCard = { background: "var(--dhi-surface-sunken)", border: "1.5px solid var(--dhi-line)", borderRadius: "14px", padding: "16px", marginBottom: "10px" };
const questionText = { fontWeight: 700, color: "var(--dhi-ink)", fontSize: "14px", lineHeight: 1.6 };
const typeTagStyle = { marginLeft: "8px", fontSize: "10px", fontWeight: 700, color: "var(--tone)", background: "var(--tone-wash)", padding: "2px 8px", borderRadius: "999px", textTransform: "uppercase" };
const ansRevealStyle = { marginTop: "10px", padding: "10px 14px", background: "#ecfdf5", border: "1.5px solid #86efac", borderRadius: "10px", fontSize: "13px", color: "#166534", fontWeight: 700 };
const hintRevealStyle = { marginTop: "8px", padding: "10px 12px", background: "#fffbeb", border: "1.5px solid #fcd34d", borderRadius: "10px", fontSize: "13px", color: "#92400e", fontWeight: 600 };

const userBubbleStyle = { display: "inline-block", background: "var(--tone-wash)", color: "var(--dhi-ink)", padding: "10px 16px", borderRadius: "14px", fontSize: "14px", fontWeight: 700, marginBottom: "12px" };
const answerCardStyle = { display: "flex", flexDirection: "column", gap: "12px", padding: "18px", background: "var(--dhi-surface-raised)", borderRadius: "14px", border: "1.5px solid var(--dhi-line)", boxShadow: "var(--dhi-shadow-sm)" };
const infoBlock = (bg, border) => ({ padding: "14px 16px", borderRadius: "12px", background: bg, border: `1.5px solid ${border}` });
const blockLabel = { fontSize: "12px", fontWeight: 800, color: "#374151", marginBottom: "8px", textTransform: "uppercase", letterSpacing: "0.04em" };
const ulStyle = { margin: 0, paddingLeft: "20px", display: "flex", flexDirection: "column", gap: "5px", fontSize: "14px", color: "#374151", lineHeight: 1.6 };

const askRow = { display: "flex", gap: "10px", marginTop: "18px" };
const inputStyle = { flex: 1, padding: "12px 16px", borderRadius: "12px", border: "1.5px solid var(--dhi-line-strong)", fontSize: "14px", outline: "none", fontFamily: "inherit", background: "var(--dhi-field)", color: "var(--dhi-ink)" };
const sampleBtnStyle = { textAlign: "left", background: "var(--dhi-surface-sunken)", border: "1.5px solid var(--dhi-line)", borderRadius: "12px", padding: "12px 16px", fontSize: "14px", color: "var(--dhi-ink-soft)", cursor: "pointer", fontWeight: 500, lineHeight: 1.5 };

const actionBtn = (color) => ({ padding: "10px 18px", borderRadius: "10px", border: "none", background: color, color: "#fff", fontWeight: 700, fontSize: "13px", cursor: "pointer" });

// QUIZ ERROR / TIMEOUT CARDS
const quizTimeoutCard = {
  marginTop: "12px", padding: "12px 16px", backgroundColor: "#fffbeb",
  border: "1.5px solid #fde68a", borderRadius: "12px", fontSize: "13px",
  color: "#92400e", fontWeight: 600,
};
const quizErrorCard = {
  marginTop: "12px", padding: "12px 16px", backgroundColor: "#fef2f2",
  border: "1.5px solid #fecaca", borderRadius: "12px",
  display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px",
};
const quizRetryBtn = {
  backgroundColor: "#dc2626", color: "#fff", border: "none", padding: "8px 14px",
  borderRadius: "8px", cursor: "pointer", fontWeight: 700, fontSize: "12.5px",
};
