import API from "../config/api";

export const askAIAssistant = (question, noteContent = "", messages = [], imageData = "") =>
  API.post("/ai/assistant", { question, noteContent, messages, imageData });
