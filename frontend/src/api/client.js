import axios from "axios";

const api = axios.create({
  baseURL: "/api",
  timeout: 20000,
  headers: { "Content-Type": "application/json" },
});

export const fetchDocumentFeed = (limit = 6) =>
  api.get(`/documents/feed?limit=${limit}`).then((r) => r.data);

export const fetchSources = () =>
  api.get("/documents/sources").then((r) => r.data);

export const analyzeDocuments = (documents, workflow) =>
  api.post("/predict/analyze", { documents, workflow }).then((r) => r.data);

export default api;
