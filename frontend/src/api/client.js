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

export const fetchModels = () =>
  api.get("/predict/models").then((r) => r.data);

// Local models can take minutes on CPU, so analysis gets its own long timeout.
export const analyzeDocuments = (documents, workflow, model) =>
  api
    .post("/predict/analyze", { documents, workflow, model: model || null }, { timeout: 300000 })
    .then((r) => r.data);

// Multipart has to be set explicitly: with the instance's JSON header, axios would
// serialize the FormData to JSON instead of uploading the files.
export const uploadDocuments = (files) => {
  const form = new FormData();
  files.forEach((f) => form.append("files", f));
  return api
    .post("/documents/upload", form, { headers: { "Content-Type": "multipart/form-data" }, timeout: 120000 })
    .then((r) => r.data);
};

export const fetchUploads = () =>
  api.get("/documents/uploads").then((r) => r.data);

export const deleteUpload = (id) =>
  api.delete(`/documents/uploads/${id}`).then((r) => r.data);

export const fetchAuditLogs = (limit = 50) =>
  api.get(`/audit/logs?limit=${limit}`).then((r) => r.data);

export const fetchAuditLog = (id) =>
  api.get(`/audit/logs/${id}`).then((r) => r.data);

export default api;
