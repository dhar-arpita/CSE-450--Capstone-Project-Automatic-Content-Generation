
import axios from "axios";

const API_URL = "http://127.0.0.1:8000";

const api = axios.create({
  baseURL: API_URL,
});


export const signup = (userData) => api.post("/users/", userData);
export const login = (email, password) => 
  api.post(`/login/?email=${encodeURIComponent(email)}&password=${encodeURIComponent(password)}`);
export const getUsers = () => api.get("/users/");


export const getClasses = () => api.get("/curriculum/classes");

export const getSubjects = (className) => 
  api.get(`/curriculum/subjects?class_name=${encodeURIComponent(className)}`);

export const getChapters = (subjectId) => 
  api.get(`/curriculum/chapters?subject_id=${subjectId}`);

export const getTopics = (chapterId) => 
  api.get(`/curriculum/topics?chapter_id=${chapterId}`);


export const uploadCurriculumFile = (file, topicId, userId) => {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("topic_id", topicId);
  formData.append("user_id", userId);
  
  return api.post("/ingest/upload", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
};


export const generateWorksheet = (topicId, userId, difficulty, numProblems, sampleFile = null) => {
  const formData = new FormData();
  formData.append("topic_id", topicId);
  formData.append("user_id", userId);
  formData.append("difficulty", difficulty);
  formData.append("num_problems", numProblems); // আপনার ব্যাকএন্ডে 'num_problems' আছে, এটা ঠিক আছে

  // যদি ইউজার স্যাম্পল ফাইল দেয়, তবে ব্যাকএন্ডের প্রত্যাশিত 'sample_worksheet' কি-তে পাঠাতে হবে
  if (sampleFile) {
    formData.append("sample_worksheet", sampleFile); 
  }

  return api.post("/generate/worksheet", formData, {
    headers: { "Content-Type": "multipart/form-data" }, // ফাইল পাঠানোর জন্য এটি জরুরি
  });
};


// src/api.js এ এটি নিশ্চিত করুন
export const refineWorksheet = (contentId, currentProblems, refinements) => {
  const formData = new FormData();
  formData.append("content_id", contentId);
  formData.append("current_problems", JSON.stringify(currentProblems));
  formData.append("refinements", JSON.stringify(refinements));

  return api.post("/generate/refine", formData);
};

export const getWorksheetDetails = (contentId) => api.get(`/generate/worksheet/${contentId}`);

export const getIngestionStatus = (jobId) => api.get(`/ingest/status/${jobId}`);


export const askQuestion = (question) => {
    return api.get(`/ask/?question=${encodeURIComponent(question)}`);
};

export const generateFlashcard = (topic) => {
  return api.post(`/create-flashcard/?topic=${encodeURIComponent(topic)}`);
};


export const deleteFile = (filename) => api.delete(`/ingest/delete-file/${filename}`);

export default api;