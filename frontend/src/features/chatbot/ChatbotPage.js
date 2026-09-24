// features/chatbot/ChatbotPage.js — "Practice with Proggya", built on the same
// AppShell/studio chrome as the Worksheet/Quiz/Study Note studios.
import React, { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useI18n } from "../../shared/i18n";
import AppShell from "../../shared/ui/AppShell";
import {
  IconChatbot, IconCheck, IconPlus, IconSpark, IconAsk, IconChecklist, IconTarget, IconQuiz,
  IconRepeat, IconBulb, IconSearch, IconRuler, IconPin, IconKey, IconEye, IconArrow, IconArrowLeft,
  IconClose, IconAlert, IconUser2, IconBrain,
} from "../../shared/ui/icons";
import {
  getClasses, getSubjects, getChapters, getTopics, chatHistory, chatSessions, retryMistake, getMistakeTopics,
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
    hintReady: "উপরে থেকে একটা মোড বেছে নাও — যা করবে সব এখানে জমতে থাকবে।",
    hintPick: "শুরু করতে অন্তত একটা বিষয় বেছে নাও।",
    modeQaTitle: "প্রশ্ন করো", modeSetTitle: "প্র্যাকটিস সেট", modeOneTitle: "একটা একটা করে", modeQuizTitle: "কুইজ",
    modeFixTitle: "ভুল প্র্যাকটিস করো",
    qaTitle: "প্রশ্ন করো",
    samplesHint: "নিচের যেকোনো প্রশ্নে ক্লিক করো, অথবা নিজে টাইপ করো:",
    askPlaceholder: "আরেকটা প্রশ্ন লিখো...", askBtn: "জিজ্ঞেস করো",
    answering: "উত্তর তৈরি হচ্ছে...",
    keyPoints: "মূল পয়েন্ট", formula: "সূত্র", examples: "উদাহরণ", summary: "সারসংক্ষেপ",
    explainMore: "আরও বুঝিয়ে বলো", explaining: "আরও বোঝানো হচ্ছে...",
    detailTitle: "বিস্তারিত ব্যাখ্যা", moreExamples: "আরও উদাহরণ",
    setTitle: "প্র্যাকটিস সেট", setLabel: "সেট",
    generating: "প্রশ্ন তৈরি হচ্ছে...",
    showAns: "উত্তর দেখাও", hideAns: "উত্তর লুকাও", anotherSet: "আরেকটা সেট দাও",
    oneTitle: "একটা একটা করে", qLabel: "প্রশ্ন",
    hintBtn: "Hint দাও", revealAns: "উত্তর দেখাও", nextQ: "পরের প্রশ্ন",
    didSolve: "তুমি কি পেরেছিলে?", solved: "পেরেছি", notSolved: "পারিনি",
    solvedMsg: "দারুণ!", notSolvedMsg: "ঠিক আছে, পরের বার হবে।",
    newChat: "নতুন কথোপকথন", history: "আগের সেশন", noSessions: "কোনো আগের সেশন নেই",
    loadingSessions: "লোড হচ্ছে...", loadingSession: "সেশন লোড হচ্ছে...",
    loadingScope: "লোড হচ্ছে...",
    quizErrorMsg: "কুইজ তৈরি করতে সমস্যা হয়েছে।",
    quizRetry: "আবার চেষ্টা করো",
    quizStillRunning: "এখনো চলছে — একটু পরে আবার দেখো।",
    wizardSubjectTitle: "কোন বিষয়ে প্র্যাকটিস করতে চাও?",
    wizardSubjectSub: "একটা বিষয় বেছে নাও",
    wizardChapterTitle: "কোন অধ্যায়?",
    wizardChapterSub: "একটা অধ্যায় বেছে নাও, অথবা পুরো বিষয় নিয়ে প্র্যাকটিস শুরু করো",
    wizardTopicTitle: "কোন টপিক?",
    wizardTopicSub: "একটা টপিক বেছে নাও, অথবা পুরো অধ্যায় নিয়ে প্র্যাকটিস শুরু করো",
    back: "পেছনে যাও",
    noSubjects: "এই ক্লাসের জন্য কোনো বিষয় পাওয়া যায়নি।",
    noChapters: "এই বিষয়ে কোনো অধ্যায় পাওয়া যায়নি।",
    noTopics: "এই অধ্যায়ে কোনো টপিক পাওয়া যায়নি।",
    skipSubject: "+ সরাসরি এই বিষয়ের ওপর প্র্যাকটিস শুরু করো",
    skipChapter: "+ সরাসরি এই অধ্যায়ের ওপর প্র্যাকটিস শুরু করো",
    mistakeTryAgain: "আবার চেষ্টা করো",
    fixEmpty: "তোমার এখন কোনো ভুল নেই — দারুণ করছ!",
    fixBySubjectTitle: "তোমার ভুল ঠিক করো",
    fixBannerTitle: "ভুল ঠিক করার সময়!",
    fixProgress: (done, total) => `${done}/${total} ঠিক করা হয়েছে`,
    fixPracticeMore: "আরও একই রকম প্র্যাকটিস করো",
    fixSkip: "এটা বাদ দিয়ে পরেরটা",
    fixFinish: "শেষ করলাম, ফিরে যাই",
    fixBack: "ফিরে যাও",
  },
  english: {
    breadcrumb: "Practice with Proggya",
    pageTitle: "Practice with Proggya",
    subtitle: "Ask questions or practice — in your own language.",
    setupLabel: "Setup",
    step1: "What do you want to study?",
    step2Title: "Choose what to do",
    selectClass: "Select class", selectSubject: "Select subject",
    selectChapter: "Select chapter", selectTopic: "Select topic",
    classL: "Class", subjectL: "Subject", chapterL: "Chapter (optional)", topicL: "Topic (optional)",
    hintReady: "Pick a mode above — everything you do stays here as you go.",
    hintPick: "Select at least a subject to start.",
    modeQaTitle: "Ask", modeSetTitle: "Practice Set", modeOneTitle: "One by one", modeQuizTitle: "Quiz",
    modeFixTitle: "Practice Mistakes",
    qaTitle: "Ask a question",
    samplesHint: "Click any question below, or type your own:",
    askPlaceholder: "Type another question...", askBtn: "Ask",
    answering: "Generating answer...",
    keyPoints: "Key points", formula: "Formula", examples: "Examples", summary: "Summary",
    explainMore: "Explain more", explaining: "Explaining...",
    detailTitle: "Detailed explanation", moreExamples: "More examples",
    setTitle: "Practice Set", setLabel: "Set",
    generating: "Generating questions...",
    showAns: "Show answers", hideAns: "Hide answers", anotherSet: "Give another set",
    oneTitle: "One by one", qLabel: "Question",
    hintBtn: "Hint", revealAns: "Show answer", nextQ: "Next question",
    didSolve: "Did you solve it?", solved: "Got it", notSolved: "Missed it",
    solvedMsg: "Great job!", notSolvedMsg: "That's okay — next time!",
    newChat: "New conversation", history: "Past sessions", noSessions: "No past sessions",
    loadingSessions: "Loading...", loadingSession: "Loading session...",
    loadingScope: "Loading...",
    quizErrorMsg: "Failed to generate quiz.",
    quizRetry: "Try Again",
    quizStillRunning: "Still running — check back in a moment.",
    wizardSubjectTitle: "Which subject do you want to practice?",
    wizardSubjectSub: "Pick a subject to get started",
    wizardChapterTitle: "Which chapter?",
    wizardChapterSub: "Pick a chapter, or start practicing the whole subject",
    wizardTopicTitle: "Which topic?",
    wizardTopicSub: "Pick a topic, or start practicing the whole chapter",
    back: "Back",
    noSubjects: "No subjects found for this class.",
    noChapters: "No chapters found for this subject.",
    noTopics: "No topics found for this chapter.",
    skipSubject: "+ Start practicing this whole subject",
    skipChapter: "+ Start practicing this whole chapter",
    mistakeTryAgain: "Try again",
    fixEmpty: "No mistakes right now — nice work!",
    fixBySubjectTitle: "Fix your mistakes",
    fixBannerTitle: "Time to fix a mistake!",
    fixProgress: (done, total) => `${done}/${total} fixed`,
    fixPracticeMore: "Practice more like this",
    fixSkip: "Skip, next one",
    fixFinish: "I'm done, go back",
    fixBack: "Back",
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
  const [mode, setMode] = useState(null);

  // Follows the app's own language switch (sidebar, bottom-left) — same as
  // every other studio page — rather than a separate control on this one.
  const { lang } = useI18n();
  const language = lang === "bn" ? "bangla" : "english";
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

  // "Practice mistakes" mode: mistakeTopics is the picker list (unresolved
  // mistakes grouped by topic, refreshed whenever the student leaves an
  // active queue); fixQueue is the group currently being worked through
  // (null = showing the picker); fixFeed is that group's question feed,
  // kept separate from obFeed so this mode never gets mixed into normal
  // one-by-one practice.
  const [mistakeTopics, setMistakeTopics] = useState([]);
  const [mistakeTopicsLoading, setMistakeTopicsLoading] = useState(true);
  const [fixQueue, setFixQueue] = useState(null); // { label, subjectName, queue, anchorContentId, totalCount, doneCount }
  const [fixFeed, setFixFeed] = useState([]);

  const clearFeeds = () => {
    setSamples([]); setQuestion("");
    setQaFeed([]); setSetFeed([]); setObFeed([]); setQuizFeed([]); setQuizError(null); setMode(null);
    setFixFeed([]); setFixQueue(null);
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

  const refreshMistakeTopics = useCallback(async () => {
    setMistakeTopicsLoading(true);
    try { const { data } = await getMistakeTopics(); setMistakeTopics(data?.topics || []); }
    catch { setMistakeTopics([]); }
    finally { setMistakeTopicsLoading(false); }
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
    refreshMistakeTopics();
  }, [navigate, refreshSessions, refreshMistakeTopics]);

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

  // "ভুল প্র্যাকটিস করো" — a dedicated mode, not blended into normal one-by-one
  // practice. Younger students found a shared feed confusing: a "next
  // question" button that sometimes meant "next mistake" and sometimes meant
  // "next normal question" gave no way to tell which session they were in.
  // This mode has its own banner, its own feed (fixFeed), and buttons that
  // say exactly what they do.
  //
  // It also isn't a standalone destination any more — a global "N mistakes"
  // button on every page told a student nothing about WHERE those mistakes
  // were, so it's gone. Instead this mode is entered already scoped to
  // wherever the student is: a subject row on the subject-pick step, or the
  // topic actually selected once they reach "choose what to do." Nothing
  // shows on the chapter or topic-list steps in between — those are still
  // mid-pick, not a specific place mistakes belong to yet.
  const startFixScope = ({ subjectId, chapterId, topicId }, fallbackLabel) => {
    const matches = mistakeTopics.filter((g) => {
      if (topicId) return g.topic_id === Number(topicId);
      if (chapterId) return g.chapter_id === Number(chapterId);
      if (subjectId) return g.subject_id === Number(subjectId);
      return false;
    });
    if (matches.length === 0) return;
    const merged = [];
    matches.forEach((g) => g.content_ids.forEach((id) => { if (!merged.includes(id)) merged.push(id); }));
    pickFixTopic({
      label: matches.length === 1 ? matches[0].label : fallbackLabel,
      subject_name: matches.length === 1 ? matches[0].subject_name : null,
      content_ids: merged,
    });
  };

  // Starts (or restarts) a single question for one specific past mistake.
  // Always scoped to that mistake's own topic (retry_mistake resolves it
  // server-side) — a batch never drifts onto a different topic mid-queue.
  const startFixQuestion = async (mistakeContentId) => {
    if (busy) return; setBusy(true);
    const id = newId();
    setFixFeed((f) => [...f.map((b) => ({ ...b, isLatest: false })), {
      id, mistakeContentId, contentId: null, question: "", hints: [], hintsUsed: 0,
      answer: null, selfReport: null, isLatest: true, loading: true,
    }]);
    try {
      const { data } = await retryMistake(mistakeContentId);
      if (data && data.content_id) {
        chat.setSessionId(data.session_id);
        setActiveSid(data.session_id);
        if (data.scope) await applyScope(data.scope);
        setFixFeed((f) => f.map((b) => b.id === id ? { ...b, contentId: data.content_id, question: data.question || "", loading: false } : b));
        refreshSessions(user.user_id);
      } else {
        setFixFeed((f) => f.map((b) => b.id === id ? { ...b, loading: false } : b));
      }
    } catch { setFixFeed((f) => f.map((b) => b.id === id ? { ...b, loading: false } : b)); }
    setBusy(false);
  };

  // Starts a (possibly merged) group's first queued mistake — group.content_ids
  // is a plain array, built by startFixScope below or by the Profile deep link.
  const pickFixTopic = (group) => {
    const queue = [...(group.content_ids || [])];
    const first = queue.shift();
    if (!first) return;
    setSkipToMode(true);
    setMode("fixMistakes");
    setFixQueue({
      label: group.label, subjectName: group.subject_name, queue,
      anchorContentId: group.content_ids[group.content_ids.length - 1],
      totalCount: group.content_ids.length, doneCount: 0,
    });
    setFixFeed([]);
    startFixQuestion(first);
  };

  // "আরও একই রকম প্র্যাকটিস করো" (after a right answer) and "এটা বাদ দিয়ে
  // পরেরটা" (after a wrong one) are the same underlying move: pull the next
  // still-unattempted mistake out of the queue, or — once the queue is
  // empty — keep generating extra practice on the same topic by reusing the
  // group's anchor id, so "practice more" never runs out.
  const fixNext = () => {
    if (!fixQueue || busy) return;
    const next = fixQueue.queue.length > 0 ? fixQueue.queue[0] : fixQueue.anchorContentId;
    if (!next) return;
    setFixQueue((q) => q ? { ...q, queue: q.queue.slice(1) } : q);
    startFixQuestion(next);
  };

  // "শেষ করলাম, ফিরে যাই" — back to "choose what to do" for wherever the
  // student already was (never a forced navigation to a different subject
  // or topic). Refreshes the mistake counts since this sitting may have
  // resolved some of them, so the card's count is right if they open it again.
  const fixFinish = () => {
    setMode(null); setFixQueue(null); setFixFeed([]);
    refreshMistakeTopics();
  };

  const fixHint = async (id) => {
    const block = fixFeed.find((b) => b.id === id);
    if (!block || block.hintsUsed >= 3) return;
    try {
      const d = await chat.getHint(block.contentId, block.hintsUsed);
      if (d.hint) setFixFeed((f) => f.map((b) => b.id === id ? { ...b, hints: [...b.hints, d.hint], hintsUsed: d.hints_used } : b));
    } catch { }
  };
  const fixReveal = async (id) => {
    const block = fixFeed.find((b) => b.id === id);
    if (!block) return;
    try {
      const d = await chat.showAnswer(block.contentId, block.hintsUsed, null, null);
      setFixFeed((f) => f.map((b) => b.id === id ? { ...b, answer: d.answer || "" } : b));
    } catch { }
  };
  const fixReport = async (id, didSolve) => {
    const block = fixFeed.find((b) => b.id === id);
    if (!block) return;
    setFixFeed((f) => f.map((b) => b.id === id ? { ...b, selfReport: didSolve } : b));
    if (didSolve) setFixQueue((q) => q ? { ...q, doneCount: q.doneCount + 1 } : q);
    try { await chat.showAnswer(block.contentId, block.hintsUsed, didSolve, null); } catch { }
  };

  // A "Fix this mistake" link from Profile arrives as
  // /chatbot?fix_content_id=501 — waits for the topic-grouped list to load
  // so it can start that mistake's whole group (not just the one question),
  // with the linked mistake moved to the front of its queue.
  const fixLinkHandled = useRef(false);
  useEffect(() => {
    if (fixLinkHandled.current || !user || mistakeTopicsLoading) return;
    const fcid = Number(searchParams.get("fix_content_id"));
    if (!fcid) return;
    fixLinkHandled.current = true;
    const group = mistakeTopics.find((g) => g.content_ids.includes(fcid));
    if (group) {
      pickFixTopic({ ...group, content_ids: [fcid, ...group.content_ids.filter((c) => c !== fcid)] });
    } else {
      pickFixTopic({ label: "", subject_name: "", content_ids: [fcid] });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, searchParams, mistakeTopics, mistakeTopicsLoading]);

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

  // Scoped to exactly where the student currently is — as specific as
  // whatever's been picked (topic, else chapter, else subject) — never the
  // total across everywhere. A student on Physics/Motion shouldn't see a
  // count that includes their Chemistry mistakes.
  // One row per subject that actually has a mistake in it — shown under the
  // subject-pick step, so "fix your mistakes" starts from the same place a
  // student already is (picking a subject), not a separate destination.
  const subjectMistakeRows = React.useMemo(() => {
    const bySubject = {};
    mistakeTopics.forEach((g) => {
      if (!g.subject_id) return;
      const row = bySubject[g.subject_id] || { subjectId: g.subject_id, name: g.subject_name, count: 0 };
      row.count += g.count;
      bySubject[g.subject_id] = row;
    });
    return Object.values(bySubject).sort((a, b) => b.count - a.count);
  }, [mistakeTopics]);

  const selectedTopicName = topicList.find((tp) => String(tp.topic_id) === String(selectedTopicId))?.name || "";
  const fixMistakesLabel = selectedTopicId ? selectedTopicName : selectedChapter ? selectedChapterName : selectedSubjectName;
  const fixMistakesCount = mistakeTopics
    .filter((g) => {
      if (selectedTopicId) return g.topic_id === Number(selectedTopicId);
      if (selectedChapter) return g.chapter_id === Number(selectedChapter);
      if (selectedSubject) return g.subject_id === Number(selectedSubject);
      return false;
    })
    .reduce((sum, g) => sum + g.count, 0);

  const MODES = [
    { key: "qa", Icon: IconAsk, color: "#ef4444", bg: "#fee2e2", title: t.modeQaTitle, sub: language === "bangla" ? "Instant answer পাও" : "Get an instant answer", action: openQA },
    { key: "set", Icon: IconChecklist, color: "#0ea5e9", bg: "#e0f2fe", title: t.modeSetTitle, sub: language === "bangla" ? "Questions practice করো" : "Practice questions", action: openSet },
    { key: "oneByone", Icon: IconTarget, color: "#16a34a", bg: "#dcfce7", title: t.modeOneTitle, sub: language === "bangla" ? "Step by step practice" : "Step by step practice", action: openOneByOne },
    { key: "quiz", Icon: IconQuiz, color: "#f59e0b", bg: "#fef3c7", title: t.modeQuizTitle, sub: language === "bangla" ? "MCQ quiz নাও" : "Take an MCQ quiz", action: openQuiz },
    {
      key: "fixMistakes", Icon: IconRepeat, color: "#7c3aed", bg: "#ede9fe", title: t.modeFixTitle,
      sub: mistakeTopicsLoading
        ? "..."
        : (language === "bangla" ? `এখানে ${fixMistakesCount}টা ভুল আছে` : `${fixMistakesCount} mistake(s) here`),
      disabledExtra: !mistakeTopicsLoading && fixMistakesCount === 0,
      action: () => startFixScope(
        { subjectId: selectedSubject, chapterId: selectedChapter, topicId: selectedTopicId },
        fixMistakesLabel
      ),
    },
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

              {subjectMistakeRows.length > 0 && (
                <div style={{ marginTop: "20px" }}>
                  <p style={mutedText}>{t.fixBySubjectTitle}</p>
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginTop: "10px" }}>
                    {subjectMistakeRows.map((row) => (
                      <button key={row.subjectId} type="button"
                        onClick={() => startFixScope({ subjectId: row.subjectId }, row.name)}
                        style={fixTopicRowBtn}>
                        <span style={{ display: "flex", alignItems: "center", gap: "8px", fontWeight: 700, color: "var(--dhi-ink)" }}>
                          <IconRepeat /> {row.name || "—"}
                        </span>
                        <span style={fixTopicCount}>{row.count}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </section>
          )}

          {wizardStep === "chapter" && (
            <section className="as-panel gw-step">
              <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: "12px", marginBottom: "4px" }}>
                <button type="button" className="gw-back-btn" style={{ marginBottom: 0 }} onClick={backToSubjectStep}><IconArrowLeft /> {t.back}</button>
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
                <button type="button" className="gw-back-btn" style={{ marginBottom: 0 }} onClick={backToChapterStep}><IconArrowLeft /> {t.back}</button>
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
              <button type="button" className="gw-back-btn" style={{ marginBottom: 0 }} onClick={backFromMode}><IconArrowLeft /> {t.back}</button>
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
            {MODES.map(({ key, Icon, color, bg, title, sub, action, disabledExtra }) => (
              <button key={key} type="button"
                className={`gw-mode-card${mode === key ? " is-active" : ""}`}
                style={{ "--mode-color": color, "--mode-wash": bg, ...(disabledExtra ? { opacity: 0.45 } : {}) }}
                onClick={action}
                disabled={(key !== "fixMistakes" && !canStart) || sessionLoading || disabledExtra}>
                <span className="gw-mode-icon"><Icon /></span>
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
          <h3 style={contentTitle}><IconQuiz /> {t.modeQuizTitle}</h3>

          {/* Client-side timeout — distinct from a real FAILED */}
          {quizError?.isTimeout && (
            <div style={quizTimeoutCard}>
              <span>{t.quizStillRunning}</span>
            </div>
          )}

          {/* Real FAILED — distinct from the timeout above, offers Retry */}
          {quizError && !quizError.isTimeout && (
            <div style={quizErrorCard}>
              <span style={{ color: "#991b1b", fontWeight: 600, fontSize: "13px", display: "flex", alignItems: "center", gap: "6px" }}><IconAlert /> {quizError.message}</span>
              <button onClick={addQuiz} style={quizRetryBtn}><IconRepeat /> {t.quizRetry}</button>
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
                                style={{ display: "flex", alignItems: "center", gap: "6px", textAlign: "left", padding: "10px 14px", borderRadius: "10px", background: bg, border, color, fontSize: "13px", fontWeight: 600, cursor: answered ? "default" : "pointer", transition: "all 0.15s" }}>
                                <span>{opt.label}. {opt.text}</span>
                                {answered && isCorrect && <IconCheck />}
                                {answered && isSelected && !isCorrect && <IconClose />}
                              </button>
                            );
                          })}
                        </div>
                        {answered && (
                          <div style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "8px", fontSize: "13px", fontWeight: 700, color: sel === q.correct_option ? "#16a34a" : "#dc2626" }}>
                            {sel === q.correct_option
                              ? (<><IconCheck /> সঠিক!</>)
                              : (<><IconClose /> ভুল — সঠিক উত্তর: {q.correct_option}</>)}
                          </div>
                        )}
                        {hints.map((h, i) => <div key={i} style={hintRevealStyle}><IconBulb /> Hint {i + 1}: {h}</div>)}
                        {!answered && hintsUsed < 2 && (
                          <button onClick={() => quizHint(b.id, q.question_number, q.content_id)}
                            style={{ ...actionBtn("#f59e0b"), marginTop: "8px", padding: "6px 12px", fontSize: "12px" }}>
                            <IconBulb /> Hint ({hintsUsed}/2)
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
                      <button onClick={addQuiz} disabled={!b.isLatest || busy} style={actionBtn("var(--tone)")}><IconQuiz /> আরও Quiz</button>
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
          <h3 style={contentTitle}><IconAsk /> {t.qaTitle}</h3>
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
                <div style={userBubbleStyle}><IconUser2 /> {b.question}</div>
                {b.loading && <p style={mutedTextRow}><span className="wg-spinner" style={loadingSpinner} />{t.answering}</p>}
                {b.answer && (
                  <div style={answerCardStyle}>
                    {b.answer.intro && <p style={{ margin: 0, fontSize: "15px", color: "var(--dhi-ink)", lineHeight: 1.7, fontWeight: 500 }}>{b.answer.intro}</p>}
                    {b.answer.key_points?.length > 0 && (
                      <div style={infoBlock("#f0fdf4", "#bbf7d0")}>
                        <div style={blockLabel}><IconKey /> {t.keyPoints}</div>
                        <ul style={ulStyle}>{b.answer.key_points.map((k, i) => <li key={i}>{k}</li>)}</ul>
                      </div>
                    )}
                    {b.answer.formula?.length > 0 && (
                      <div style={infoBlock("#fefce8", "#fde047")}>
                        <div style={blockLabel}><IconRuler /> {t.formula}</div>
                        <ul style={ulStyle}>{b.answer.formula.map((f, i) => <li key={i} style={{ fontFamily: "monospace" }}>{f}</li>)}</ul>
                      </div>
                    )}
                    {b.answer.examples?.length > 0 && (
                      <div style={infoBlock("#eff6ff", "#bfdbfe")}>
                        <div style={blockLabel}><IconBulb /> {t.examples}</div>
                        <ul style={ulStyle}>{b.answer.examples.map((e, i) => <li key={i}>{e}</li>)}</ul>
                      </div>
                    )}
                    {b.answer.summary && (
                      <div style={infoBlock("#f5f3ff", "#ddd6fe")}>
                        <div style={blockLabel}><IconPin /> {t.summary}</div>
                        <p style={{ margin: 0, fontSize: "14px", color: "var(--dhi-ink)" }}>{b.answer.summary}</p>
                      </div>
                    )}
                    {!b.explain && (
                      <button onClick={() => doExplainMore(b.id)} disabled={b.explainLoading}
                        style={actionBtn("var(--tone)")}>
                        <IconSearch /> {b.explainLoading ? t.explaining : t.explainMore}
                      </button>
                    )}
                    {b.explain && (
                      <div style={infoBlock("#faf5ff", "#e9d5ff")}>
                        <div style={blockLabel}><IconSearch /> {t.detailTitle}</div>
                        {b.explain.detailed_explanation && <p style={{ fontSize: "14px", color: "var(--dhi-ink)", lineHeight: 1.7 }}>{b.explain.detailed_explanation}</p>}
                        {b.explain.more_examples?.length > 0 && (
                          <>
                            <div style={{ ...blockLabel, marginTop: "8px" }}>{t.moreExamples}</div>
                            <ul style={ulStyle}>{b.explain.more_examples.map((e, i) => <li key={i}>{e}</li>)}</ul>
                          </>
                        )}
                        {b.explain.analogy && (
                          <p style={{ display: "flex", alignItems: "flex-start", gap: "8px", fontSize: "14px", color: "#6b21a8", marginTop: "8px", fontStyle: "italic" }}>
                            <IconBrain /> {b.explain.analogy}
                          </p>
                        )}
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
          <h3 style={contentTitle}><IconChecklist /> {t.setTitle}</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: "16px", marginTop: "12px" }}>
            {setFeed.map((b, idx) => (
              <div key={b.id} style={feedBlock}>
                <div style={setLabel}>{t.setLabel} {idx + 1}</div>
                {b.loading && <p style={mutedTextRow}><span className="wg-spinner" style={loadingSpinner} />{t.generating}</p>}
                {b.questions.map((q, i) => (
                  <div key={i} style={questionCard}>
                    <div style={questionText}>{i + 1}. {q.question}
                      {q.type && <span style={typeTagStyle}>{q.type}</span>}
                    </div>
                    {b.showAnswers && q.answer && <div style={ansRevealStyle}><IconCheck /> {q.answer}</div>}
                  </div>
                ))}
                {b.questions.length > 0 && (
                  <div style={{ display: "flex", gap: "10px", marginTop: "12px", flexWrap: "wrap" }}>
                    <button onClick={() => toggleSetAnswers(b.id)} style={actionBtn("#64748b")}>{b.showAnswers ? t.hideAns : t.showAns}</button>
                    <button onClick={addSet} disabled={!b.isLatest || busy} style={actionBtn("#0ea5e9")}><IconRepeat /> {t.anotherSet}</button>
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
          <h3 style={contentTitle}><IconTarget /> {t.oneTitle}</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: "16px", marginTop: "12px" }}>
            {obFeed.map((b, idx) => (
              <div key={b.id} style={feedBlock}>
                <div style={setLabel}>{t.qLabel} {idx + 1}</div>
                {b.loading && <p style={mutedTextRow}><span className="wg-spinner" style={loadingSpinner} />{t.generating}</p>}
                {b.question && (
                  <div style={questionCard}>
                    <div style={{ ...questionText, fontSize: "15px" }}>{b.question}</div>
                    {b.hints.map((h, i) => <div key={i} style={hintRevealStyle}><IconBulb /> Hint {i + 1}: {h}</div>)}
                    {b.answer && <div style={ansRevealStyle}><IconCheck /> {b.answer}</div>}
                    {b.answer && b.selfReport === null && (
                      <div style={{ display: "flex", gap: "10px", marginTop: "12px", alignItems: "center", flexWrap: "wrap" }}>
                        <span style={{ fontSize: "13px", fontWeight: 700, color: "var(--dhi-ink-soft)" }}>{t.didSolve}</span>
                        <button onClick={() => obReport(b.id, true)} style={actionBtn("#16a34a")}><IconCheck /> {t.solved}</button>
                        <button onClick={() => obReport(b.id, false)} style={actionBtn("#ef4444")}><IconClose /> {t.notSolved}</button>
                      </div>
                    )}
                    {b.selfReport !== null && (
                      <div style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "10px", fontSize: "13px", fontWeight: 700, color: b.selfReport ? "#16a34a" : "#dc2626" }}>
                        {b.selfReport && <IconSpark />} {b.selfReport ? t.solvedMsg : t.notSolvedMsg}
                      </div>
                    )}
                    <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", marginTop: "14px" }}>
                      {b.hintsUsed < 3 && !b.answer && (
                        <button onClick={() => obHint(b.id)} style={actionBtn("#f59e0b")}><IconBulb /> {t.hintBtn} ({b.hintsUsed}/3)</button>
                      )}
                      {!b.answer && <button onClick={() => obReveal(b.id)} style={actionBtn("#64748b")}><IconEye /> {t.revealAns}</button>}
                      <button onClick={nextOB} disabled={!b.isLatest || busy} style={actionBtn("#16a34a")}><IconArrow /> {t.nextQ}</button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* FIX MISTAKES MODE — its own banner and feed, never mixed into the
          normal one-by-one feed above, so "next question" there never means
          two different things depending on context. */}
      {mode === "fixMistakes" && (
        <section className="as-panel">
          <h3 style={contentTitle}><IconRepeat /> {t.modeFixTitle}</h3>

          {!fixQueue ? (
            <p style={mutedText}>{t.fixEmpty}</p>
          ) : (
            <>
              <div style={fixBanner}>
                <span style={{ display: "flex" }}><IconTarget /></span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 800, fontSize: "14px", color: "#5b21b6" }}>{t.fixBannerTitle}</div>
                  <div style={{ fontSize: "12.5px", color: "#6d28d9", fontWeight: 600 }}>
                    {fixQueue.label || ""}{fixQueue.subjectName ? ` · ${fixQueue.subjectName}` : ""}
                  </div>
                </div>
                <span style={fixProgressPill}>{t.fixProgress(fixQueue.doneCount, fixQueue.totalCount)}</span>
                <button type="button" onClick={fixFinish} style={fixBackLink}><IconArrowLeft /> {t.fixBack}</button>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "16px", marginTop: "16px" }}>
                {fixFeed.map((b) => (
                  <div key={b.id} style={feedBlock}>
                    {b.loading && <p style={mutedTextRow}><span className="wg-spinner" style={loadingSpinner} />{t.generating}</p>}
                    {b.question && (
                      <div style={questionCard}>
                        <div style={{ ...questionText, fontSize: "15px" }}>{b.question}</div>
                        {b.hints.map((h, i) => <div key={i} style={hintRevealStyle}><IconBulb /> Hint {i + 1}: {h}</div>)}
                        {b.answer && <div style={ansRevealStyle}><IconCheck /> {b.answer}</div>}
                        {b.answer && b.selfReport === null && (
                          <div style={{ display: "flex", gap: "10px", marginTop: "12px", alignItems: "center", flexWrap: "wrap" }}>
                            <span style={{ fontSize: "13px", fontWeight: 700, color: "var(--dhi-ink-soft)" }}>{t.didSolve}</span>
                            <button onClick={() => fixReport(b.id, true)} style={actionBtn("#16a34a")}><IconCheck /> {t.solved}</button>
                            <button onClick={() => fixReport(b.id, false)} style={actionBtn("#ef4444")}><IconClose /> {t.notSolved}</button>
                          </div>
                        )}
                        {b.selfReport !== null && (
                          <div style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "10px", fontSize: "13px", fontWeight: 700, color: b.selfReport ? "#16a34a" : "#dc2626" }}>
                            {b.selfReport && <IconSpark />} {b.selfReport ? t.solvedMsg : t.notSolvedMsg}
                          </div>
                        )}
                        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", marginTop: "14px" }}>
                          {b.hintsUsed < 3 && !b.answer && (
                            <button onClick={() => fixHint(b.id)} style={actionBtn("#f59e0b")}><IconBulb /> {t.hintBtn} ({b.hintsUsed}/3)</button>
                          )}
                          {!b.answer && <button onClick={() => fixReveal(b.id)} style={actionBtn("#64748b")}><IconEye /> {t.revealAns}</button>}
                          {b.selfReport === false && (
                            <button onClick={() => startFixQuestion(b.mistakeContentId)} disabled={!b.isLatest || busy} style={actionBtn("#16a34a")}>{t.mistakeTryAgain}</button>
                          )}
                          {b.selfReport === false && (
                            <button onClick={fixNext} disabled={!b.isLatest || busy} style={actionBtn("#64748b")}>{t.fixSkip}</button>
                          )}
                          {b.selfReport === true && (
                            <button onClick={fixNext} disabled={!b.isLatest || busy} style={actionBtn("#7c3aed")}>{t.fixPracticeMore}</button>
                          )}
                          {b.selfReport === true && (
                            <button onClick={fixFinish} disabled={!b.isLatest || busy} style={actionBtn("#64748b")}>{t.fixFinish}</button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </section>
      )}

      <div ref={feedEndRef} />
    </AppShell>
  );
}

/* ===== STYLES ===== */

const loadingCard = { display: "flex", alignItems: "center", gap: "14px", justifyContent: "center", padding: "24px" };

const contentTitle = { margin: "0 0 4px", fontSize: "1.12rem", fontWeight: 700, color: "var(--dhi-ink)", display: "flex", alignItems: "center", gap: "9px" };

const feedBlock = { paddingBottom: "20px", borderBottom: "1px dashed var(--dhi-line)" };
const setLabel = { fontSize: "11px", fontWeight: 800, color: "var(--dhi-muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "10px" };
const mutedText = { fontSize: "13px", color: "var(--dhi-muted)", fontWeight: 600 };
const mutedTextRow = { ...mutedText, display: "flex", alignItems: "center", gap: "8px" };
const loadingSpinner = { display: "inline-block", flex: "0 0 auto" };

const questionCard = { background: "var(--dhi-surface-sunken)", border: "1.5px solid var(--dhi-line)", borderRadius: "14px", padding: "16px", marginBottom: "10px" };
const questionText = { fontWeight: 700, color: "var(--dhi-ink)", fontSize: "14px", lineHeight: 1.6 };
const typeTagStyle = { marginLeft: "8px", fontSize: "10px", fontWeight: 700, color: "var(--tone)", background: "var(--tone-wash)", padding: "2px 8px", borderRadius: "999px", textTransform: "uppercase" };
const ansRevealStyle = { display: "flex", alignItems: "center", gap: "8px", marginTop: "10px", padding: "10px 14px", background: "#ecfdf5", border: "1.5px solid #86efac", borderRadius: "10px", fontSize: "13px", color: "#166534", fontWeight: 700 };
const hintRevealStyle = { display: "flex", alignItems: "center", gap: "8px", marginTop: "8px", padding: "10px 12px", background: "#fffbeb", border: "1.5px solid #fcd34d", borderRadius: "10px", fontSize: "13px", color: "#92400e", fontWeight: 600 };

const userBubbleStyle = { display: "inline-flex", alignItems: "center", gap: "8px", background: "var(--tone-wash)", color: "var(--dhi-ink)", padding: "10px 16px", borderRadius: "14px", fontSize: "14px", fontWeight: 700, marginBottom: "12px" };
const answerCardStyle = { display: "flex", flexDirection: "column", gap: "12px", padding: "18px", background: "var(--dhi-surface-raised)", borderRadius: "14px", border: "1.5px solid var(--dhi-line)", boxShadow: "var(--dhi-shadow-sm)" };
const infoBlock = (bg, border) => ({ padding: "14px 16px", borderRadius: "12px", background: bg, border: `1.5px solid ${border}` });
const blockLabel = { display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", fontWeight: 800, color: "#374151", marginBottom: "8px", textTransform: "uppercase", letterSpacing: "0.04em" };
const ulStyle = { margin: 0, paddingLeft: "20px", display: "flex", flexDirection: "column", gap: "5px", fontSize: "14px", color: "#374151", lineHeight: 1.6 };

const askRow = { display: "flex", gap: "10px", marginTop: "18px" };
const inputStyle = { flex: 1, padding: "12px 16px", borderRadius: "12px", border: "1.5px solid var(--dhi-line-strong)", fontSize: "14px", outline: "none", fontFamily: "inherit", background: "var(--dhi-field)", color: "var(--dhi-ink)" };
const sampleBtnStyle = { textAlign: "left", background: "var(--dhi-surface-sunken)", border: "1.5px solid var(--dhi-line)", borderRadius: "12px", padding: "12px 16px", fontSize: "14px", color: "var(--dhi-ink-soft)", cursor: "pointer", fontWeight: 500, lineHeight: 1.5 };

const actionBtn = (color) => ({ display: "inline-flex", alignItems: "center", gap: "6px", padding: "10px 18px", borderRadius: "10px", border: "none", background: color, color: "#fff", fontWeight: 700, fontSize: "13px", cursor: "pointer" });

const fixTopicRowBtn = {
  display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px",
  padding: "14px 16px", borderRadius: "12px", border: "1.5px solid var(--dhi-line)",
  background: "var(--dhi-surface-sunken)", cursor: "pointer", textAlign: "left",
};
const fixTopicCount = {
  flex: "0 0 auto", minWidth: "26px", textAlign: "center", padding: "2px 8px",
  borderRadius: "999px", background: "#ede9fe", color: "#5b21b6", fontWeight: 800, fontSize: "12.5px",
};
const fixBanner = {
  display: "flex", alignItems: "center", gap: "12px", padding: "14px 16px",
  borderRadius: "14px", background: "#f5f3ff", border: "1.5px solid #ddd6fe", flexWrap: "wrap",
};
const fixProgressPill = {
  flex: "0 0 auto", padding: "5px 12px", borderRadius: "999px", background: "#ede9fe",
  color: "#5b21b6", fontWeight: 800, fontSize: "12px", whiteSpace: "nowrap",
};
const fixBackLink = {
  flex: "0 0 auto", border: "none", background: "none", color: "#6d28d9", fontWeight: 700,
  fontSize: "12.5px", cursor: "pointer", textDecoration: "underline", textUnderlineOffset: "3px",
};

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
  display: "inline-flex", alignItems: "center", gap: "6px",
  backgroundColor: "#dc2626", color: "#fff", border: "none", padding: "8px 14px",
  borderRadius: "8px", cursor: "pointer", fontWeight: 700, fontSize: "12.5px",
};
