import React, { useState, useEffect, useCallback, useRef } from "react";
import { fetchDocumentFeed, fetchUploads, uploadDocuments, deleteUpload } from "./api/client";
import DocumentCard from "./components/DocumentCard";
import AIAnalysisPanel from "./components/AIAnalysisPanel";
import FeedStatsBar from "./components/FeedStatsBar";
import AuditLogPanel from "./components/AuditLogPanel";
import { BookOpen, RefreshCw, Wifi, Scale, Upload, Loader, X } from "lucide-react";

const POLL_INTERVAL = 30000;
const ACCEPT = ".pdf,.docx,.txt,.md";

const SOURCES = [
  { value: "all",                label: "All Sources"        },
  { value: "upload",             label: "Uploaded"           },
  { value: "newswire",           label: "Newswire Feed"      },
  { value: "case-law-db",        label: "Case Law Database"  },
  { value: "regulatory-library", label: "Regulatory Library" },
];

export default function App() {
  const [documents, setDocuments] = useState([]);
  const [uploads, setUploads] = useState([]);
  const [riskFlags, setRiskFlags] = useState([]);
  const [scores, setScores] = useState([]);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [liveEnabled, setLiveEnabled] = useState(true);
  const [loading, setLoading] = useState(true);
  const [sourceFilter, setSourceFilter] = useState("all");
  const [uploading, setUploading] = useState(false);
  const [uploadErrors, setUploadErrors] = useState([]);
  const [dragging, setDragging] = useState(false);
  const [auditRefresh, setAuditRefresh] = useState(0);
  const fileInput = useRef(null);

  const loadFeed = useCallback(async () => {
    try {
      const result = await fetchDocumentFeed(8);
      setDocuments(result.documents);
      setLastUpdate(new Date());
    } catch (e) {
      console.error("Feed fetch error:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadUploads = useCallback(async () => {
    try {
      const result = await fetchUploads();
      setUploads(result.documents);
    } catch (e) {
      console.error("Uploads fetch error:", e);
    }
  }, []);

  useEffect(() => { loadFeed(); loadUploads(); }, []);

  useEffect(() => {
    if (!liveEnabled) return;
    const id = setInterval(loadFeed, POLL_INTERVAL);
    return () => clearInterval(id);
  }, [liveEnabled, loadFeed]);

  const handleFiles = async (fileList) => {
    const files = Array.from(fileList || []);
    if (!files.length) return;
    setUploading(true);
    setUploadErrors([]);
    try {
      const result = await uploadDocuments(files);
      setUploads((prev) => [...result.documents, ...prev]);
      setUploadErrors(result.errors || []);
      setSourceFilter("upload");          // so the next Analyze runs on what was just added
    } catch (e) {
      const detail = e.response?.data?.detail;
      setUploadErrors(Array.isArray(detail) ? detail : [{ filename: "Upload", error: detail || "Upload failed. Is the backend running?" }]);
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  };

  const handleDelete = async (id) => {
    try {
      await deleteUpload(id);
      setUploads((prev) => prev.filter((d) => d.id !== id));
    } catch (e) {
      console.error("Delete error:", e);
    }
  };

  const allDocs = [...uploads, ...documents];

  const flagMap = riskFlags.reduce((acc, f) => {
    if (!acc[f.doc_id] || f.severity === "high") acc[f.doc_id] = f;
    return acc;
  }, {});
  const scoreMap = Object.fromEntries(scores.map((s) => [s.doc_id, s]));

  const filteredDocs = sourceFilter === "all"
    ? allDocs
    : allDocs.filter((d) => d.source === sourceFilter);

  return (
    <div className="min-h-screen bg-surface text-slate-100">
      <header className="border-b border-border px-6 py-4 flex items-center justify-between sticky top-0 bg-surface/95 backdrop-blur z-10">
        <div className="flex items-center gap-3">
          <Scale size={18} className="text-violet-400" />
          <div>
            <h1 className="text-sm font-bold text-slate-100 tracking-tight">Legal Intelligence Dashboard</h1>
            <p className="text-xs text-slate-500">Uploads · Newswire · Case Law · Regulatory Library · Local LLM</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {lastUpdate && (
            <span className="text-xs text-slate-500 hidden sm:block">{lastUpdate.toLocaleTimeString()}</span>
          )}
          <div className="flex items-center gap-1.5 text-xs">
            <span className={`w-2 h-2 rounded-full ${liveEnabled ? "bg-emerald-400 animate-pulse" : "bg-slate-600"}`} />
            <span className="text-slate-400">{liveEnabled ? "Live" : "Paused"}</span>
          </div>
          <button
            onClick={() => setLiveEnabled((v) => !v)}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300 transition-colors"
          >
            {liveEnabled ? <><Wifi size={12} /> Pause</> : <><RefreshCw size={12} /> Resume</>}
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 flex flex-col gap-6">
        <FeedStatsBar documents={allDocs} riskFlags={riskFlags} />
        <AIAnalysisPanel
          documents={filteredDocs}
          scopeLabel={SOURCES.find((s) => s.value === sourceFilter)?.label}
          onFlagsUpdate={setRiskFlags}
          onScoresUpdate={setScores}
          onComplete={() => setAuditRefresh((n) => n + 1)}
        />

        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setDragging(false); }}
          onDrop={(e) => { e.preventDefault(); setDragging(false); handleFiles(e.dataTransfer.files); }}
          className={`rounded-xl transition-colors ${dragging ? "outline-dashed outline-2 outline-violet-500/60 bg-violet-500/5" : ""}`}
        >
          <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
            <div className="flex items-center gap-2">
              <BookOpen size={16} className="text-slate-400" />
              <h2 className="text-sm font-semibold text-slate-200">Documents</h2>
              <span className="text-xs text-slate-500 bg-slate-800 px-2 py-0.5 rounded-full">
                {filteredDocs.length} documents
              </span>
            </div>
            <div className="flex gap-1.5 flex-wrap">
              <input
                ref={fileInput}
                type="file"
                accept={ACCEPT}
                multiple
                className="hidden"
                onChange={(e) => handleFiles(e.target.files)}
              />
              <button
                onClick={() => fileInput.current?.click()}
                disabled={uploading}
                className="text-xs px-3 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white font-medium transition-colors flex items-center gap-1.5"
              >
                {uploading ? <><Loader size={11} className="animate-spin" /> Uploading…</> : <><Upload size={11} /> Upload</>}
              </button>
              {SOURCES.map((s) => (
                <button
                  key={s.value}
                  onClick={() => setSourceFilter(s.value)}
                  className={`text-xs px-3 py-1.5 rounded-lg transition-colors ${
                    sourceFilter === s.value
                      ? "bg-slate-600 text-slate-100"
                      : "bg-slate-800 text-slate-400 hover:bg-slate-700"
                  }`}
                >
                  {s.label}
                </button>
              ))}
              <button
                onClick={loadFeed}
                className="text-xs px-3 py-1.5 rounded-lg bg-slate-800 text-slate-400 hover:bg-slate-700 transition-colors flex items-center gap-1"
              >
                <RefreshCw size={11} /> Refresh
              </button>
            </div>
          </div>

          {uploadErrors.length > 0 && (
            <div className="mb-4 text-xs text-red-300 bg-red-500/10 border border-red-500/30 rounded-lg p-3 flex justify-between gap-3">
              <ul className="flex flex-col gap-1">
                {uploadErrors.map((e, i) => (
                  <li key={i}><span className="font-semibold">{e.filename}:</span> {e.error}</li>
                ))}
              </ul>
              <button onClick={() => setUploadErrors([])} aria-label="Dismiss" className="self-start text-red-300/70 hover:text-red-200">
                <X size={14} />
              </button>
            </div>
          )}

          {loading ? (
            <div className="text-center text-slate-500 text-sm py-12">Loading documents...</div>
          ) : filteredDocs.length === 0 ? (
            <div className="text-center text-slate-500 text-sm py-12 border border-dashed border-border rounded-xl">
              {sourceFilter === "upload"
                ? <>No uploaded documents yet. Drop PDF, DOCX, TXT or MD files here, or use <span className="text-slate-300">Upload</span>.</>
                : "No documents for this source."}
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {filteredDocs.map((doc) => (
                <DocumentCard
                  key={doc.id}
                  doc={doc}
                  flagged={!!flagMap[doc.id]}
                  flagSeverity={flagMap[doc.id]?.severity}
                  score={scoreMap[doc.id]}
                  onDelete={doc.source === "upload" ? handleDelete : undefined}
                />
              ))}
            </div>
          )}
        </div>

        <AuditLogPanel refreshKey={auditRefresh} />

        <div className="text-center text-xs text-slate-600 pb-2">
          Legal Intelligence Dashboard · FastAPI + React + Ollama
        </div>
      </main>
    </div>
  );
}
