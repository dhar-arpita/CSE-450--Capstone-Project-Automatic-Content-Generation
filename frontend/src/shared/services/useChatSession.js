 
import { useRef, useCallback } from "react";
import {
  chatQaSamples, chatQaAsk, chatExplainMore,
  chatPracticeGenerate,
  chatSessionStart, chatSessionHint, chatSessionAnswer,
  chatSessionNext, chatSessionEnd,chatQuizGenerate,
} from "./api";
 
const LS_KEY = "chatbot_session_id";
 
export function useChatSession({ studentId, subjectId, chapterId = null, topicId = null, language = "bangla" }) {
  const sessionIdRef = useRef(
    (() => { const v = localStorage.getItem(LS_KEY); return v ? Number(v) : null; })()
  );
 
  const scope = useCallback(() => ({
    subject_id: subjectId ? Number(subjectId) : null,
    chapter_id: chapterId ? Number(chapterId) : null,
    topic_id: topicId ? Number(topicId) : null,
    language,
    student_id: studentId,
    session_id: sessionIdRef.current,
  }), [subjectId, chapterId, topicId, language, studentId]);
 
  const remember = (data) => {
    if (data && data.session_id != null) {
      sessionIdRef.current = data.session_id;
      localStorage.setItem(LS_KEY, String(data.session_id));
    }
    return data;
  };
 
  const askSamples = useCallback(async () => {
    const { data } = await chatQaSamples(scope());
    return remember(data);
  }, [scope]);
 
  const ask = useCallback(async (question) => {
    const { data } = await chatQaAsk({ ...scope(), question });
    return remember(data);
  }, [scope]);
 
  const explainMore = useCallback(async (question, previousAnswer, context) => {
    const { data } = await chatExplainMore({
      session_id: sessionIdRef.current,
      student_id: studentId,
      topic_id: topicId ? Number(topicId) : null,
      question, previous_answer: previousAnswer, context, language,
    });
    return remember(data);
  }, [studentId, topicId, language]);
 
  const practiceSet = useCallback(async (difficulty = "medium", count = 5) => {
    const { data } = await chatPracticeGenerate({ ...scope(), difficulty, count, exclude: [] });
    return remember(data);
  }, [scope]);
 
  const quizSet = useCallback(async (difficulty = "medium", count = 5) => {
    const { data } = await chatQuizGenerate({ ...scope(), difficulty, count, exclude: [] });
    return remember(data);
  }, [scope]);


  const startSession = useCallback(async () => {
    const { data } = await chatSessionStart(scope());
    return remember(data);
  }, [scope]);
 
  const nextQuestion = useCallback(async (difficulty = "medium") => {
    const { data } = await chatSessionNext({ ...scope(), difficulty, exclude: [] });
    return remember(data);
  }, [scope]);
 
  const getHint = useCallback(async (contentId, hintsUsed) => {
    const { data } = await chatSessionHint({ content_id: contentId, hints_used: hintsUsed, language });
    return data;
  }, [language]);
 
  const showAnswer = useCallback(async (contentId, hintsUsed, selfReport = null, timeSpent = null) => {
    const { data } = await chatSessionAnswer({
      session_id: sessionIdRef.current, content_id: contentId,
      hints_used: hintsUsed, self_report: selfReport, time_spent: timeSpent,
    });
    return data;
  }, []);
 
  const endSession = useCallback(async () => {
    const sid = sessionIdRef.current;
    sessionIdRef.current = null;
    localStorage.removeItem(LS_KEY);
    if (sid == null) return { status: "no_session" };
    try { const { data } = await chatSessionEnd({ session_id: sid }); return data; }
    catch { return { status: "end_failed" }; }
  }, []);
 
  const resetSession = useCallback(() => {
    sessionIdRef.current = null;
    localStorage.removeItem(LS_KEY);
  }, []);
 
  // sidebar theke purono session e click korle: ei session ke active kori
  const setSessionId = useCallback((sid) => {
    sessionIdRef.current = sid;
    if (sid == null) localStorage.removeItem(LS_KEY);
    else localStorage.setItem(LS_KEY, String(sid));
  }, []);
 
  const getSessionId = useCallback(() => sessionIdRef.current, []);
 
  return {
    askSamples, ask, explainMore,
    practiceSet,quizSet,
    startSession, nextQuestion, getHint, showAnswer,
    endSession, resetSession, setSessionId, getSessionId,
  };
}