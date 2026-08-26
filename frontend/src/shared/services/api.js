import axios from "axios";
import axiosRetry from "axios-retry";

const API_URL = "http://127.0.0.1:8000";

const api = axios.create({
  baseURL: API_URL,
});

// ──── AXIOS RETRY CONFIGURATION ────

axiosRetry(api, {
  retries: 3,
  retryDelay: axiosRetry.exponentialDelay, 
  onRetry: (retryCount, error, requestConfig) => {
    console.log(`⚠️ Retrying API request... Attempt #${retryCount}`);
  },
  retryCondition: (error) => {
    
    return (
      axiosRetry.isNetworkOrIdempotentRequestError(error) ||
      (error.response && error.response.status >= 500)
    );
  },
});

// ──── AXIOS INTERCEPTOR ────
// Auto-inject JWT token from localStorage into every request header
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("access_token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor to handle 401 (token expired)
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem("access_token");
      localStorage.removeItem("refresh_token");
      localStorage.removeItem("user");
      window.location.href = "/";
    }
    return Promise.reject(error);
  }
);

// ──── AUTH ENDPOINTS ────
export const signup = (userData) => api.post("/users/", userData);
export const login = (email, password) =>
  api.post("/login/", { email, password });
export const getCurrentUser = () => api.get("/users/me");
export const getUsers = () => api.get("/users/");


// ──── CURRICULUM ENDPOINTS ────
export const getClasses = () => api.get("/curriculum/classes");

export const getSubjects = (className) =>
  api.get(`/curriculum/subjects?class_name=${encodeURIComponent(className)}`);

export const getChapters = (subjectId) =>
  api.get(`/curriculum/chapters?subject_id=${subjectId}`);

export const getTopics = (chapterId) =>
  api.get(`/curriculum/topics?chapter_id=${chapterId}`);


// ──── FILE UPLOAD ────
export const uploadCurriculumFile = (file, chapterId, userId) => {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("chapter_id", chapterId);
  formData.append("user_id", userId);

  return api.post("/ingest/upload", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
};


// ──── CHATBOT ENDPOINTS ────
export const chatQaSamples = (body) => api.post("/chat/qa/samples", body);
export const chatQaAsk = (body) => api.post("/chat/qa/ask", body);
export const chatExplainMore = (body) => api.post("/chat/qa/explain_more", body);

// --- Practice: set mode ---
export const chatPracticeGenerate = (body) => api.post("/chat/practice/generate", body);

// --- Practice: one-by-one mode ---
export const chatSessionStart = (body) => api.post("/chat/practice/session/start", body);
export const chatSessionHint = (body) => api.post("/chat/practice/session/hint", body);
export const chatSessionAnswer = (body) => api.post("/chat/practice/session/answer", body);
export const chatSessionNext = (body) => api.post("/chat/practice/session/next", body);
export const chatSessionEnd = (body) => api.patch("/chat/practice/session/end", body);
export const chatQuizGenerate = (body) => api.post("/chat/quiz/generate", body);


// ──── WORKSHEET GENERATION ────
export const generateWorksheet = (
  topicId,
  userId,
  difficulty,
  numProblems,
  sampleFile = null,
  language = "bangla"
) => {
  const formData = new FormData();
  formData.append("topic_id", topicId);
  formData.append("user_id", userId);
  formData.append("difficulty", difficulty);
  formData.append("num_problems", numProblems);
  formData.append("language", language);

  if (sampleFile) {
    formData.append("sample_worksheet", sampleFile);
  }

  return api.post("/generate/worksheet", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
};

export const refineWorksheet = (contentId, currentProblems, refinements) => {
  const formData = new FormData();
  formData.append("content_id", contentId);
  formData.append("current_problems", JSON.stringify(currentProblems));
  formData.append("refinements", JSON.stringify(refinements));

  return api.post("/generate/refine", formData);
};

export const getWorksheetDetails = (contentId) => api.get(`/generate/worksheet/${contentId}`);

export const getIngestionStatus = (jobId) => api.get(`/ingest/status/${jobId}`);


// ──── STUDY NOTE GENERATION ────
export const generateStudyNote = (topicId, language = "bangla") => {
  const formData = new URLSearchParams();
  formData.append("topic_id", topicId);
  formData.append("language", language);

  return api.post("/generate/study-note", formData, {
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
  });
};


// ──── QUIZ GENERATION ────
export const generateQuiz = (params) => {
  const formData = new URLSearchParams();
  
  if (params.scope) formData.append("scope", params.scope);
  if (params.topic_id) formData.append("topic_id", params.topic_id);
  if (params.chapter_id) formData.append("chapter_id", params.chapter_id);
  if (params.subject_id) formData.append("subject_id", params.subject_id);
  if (params.language) formData.append("language", params.language);
  if (params.num_questions) formData.append("num_questions", params.num_questions);

  return api.post("/generate/quiz", formData, {
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
  });
};


// ──── Q&A & FLASHCARDS ────
export const askQuestion = (question) => {
  return api.get(`/ask/?question=${encodeURIComponent(question)}`);
};

export const generateFlashcard = (topic) => {
  return api.post(`/create-flashcard/?topic=${encodeURIComponent(topic)}`);
};


// ──── FILE MANAGEMENT ────
export const deleteFile = (filename) => api.delete(`/ingest/delete-file/${filename}`);


// ──── CHAT HISTORY & SESSIONS ────
// 💡 Session history retrieval methods
export const chatHistory = (sessionId = null) =>
  api.get(`/chat/history${sessionId ? `?session_id=${sessionId}` : ""}`);

export const chatSessions = () => api.get(`/chat/sessions`);


// ──── FILE DOWNLOAD ────
export const downloadWorksheetPDF = (contentId) => {
  return api.get(`/generate/download/${contentId}`, { responseType: "blob" });
};

export default api;