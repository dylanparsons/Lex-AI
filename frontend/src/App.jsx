import React, { useState, useEffect, useCallback } from "react";
import { fetchDocumentFeed } from "./api/client";
import DocumentCard from "./components/DocumentCard";
import AIAnalysisPanel from "./components/AIAnalysisPanel";
import FeedStatsBar from "./components/FeedStatsBar";
import { BookOpen, RefreshCw, Wifi, Scale } from "lucide-react";

const POLL_INTERVAL = 30000;

export default function App() {
  const [documents, setDocuments] = useState([]);
  const [riskFlags, setRiskFlags] = useState([]);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [liveEnabled, setLiveEnabled] = useState(true);
  const [loading, setLoading] = useState(true);
  const [sourceFilter, setSourceFilter] = useState("all");

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

  useEffect(() => { loadFeed(); }, []);

  useEffect(() => {
    if (!liveEnabled) return;
    const id = setInterval(loadFeed, POLL_INTERVAL);
    return () => clearInterval(id);
  }, [liveEnabled, loadFeed]);

  const flagMap = riskFlags.reduce((acc, f) => {
    if (!acc[f.doc_id] || f.severity === "high") acc[f.doc_id] = f;
    return acc;
  }, {});

  const filteredDocs = sourceFilter === "all"
    ? documents
    : documents.filter((d) => d.source === sourceFilter);

  const SOURCES = [
    { value: "all",               label: "All Sources"        },
    { value: "newswire",          label: "Newswire Feed"      },
    { value: "case-law-db",       label: "Case Law Database"  },
    { value: "regulatory-library",label: "Regulatory Library" },
  ];

  return (
    <div className="min-h-screen bg-surface text-slate-100">
      <header className="border-b border-border px-6 py-4 flex items-center justify-between sticky top-0 bg-surface/95 backdrop-blur z-10">
        <div className="flex items-center gap-3">
          <Scale size={18} className="text-violet-400" />
          <div>
            <h1 className="text-sm font-bold text-slate-100 tracking-tight">Legal Intelligence Dashboard</h1>
            <p className="text-xs text-slate-500">Newswire · Case Law · Regulatory Library · GPT-4o-mini · AWS S3</p>
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
        <FeedStatsBar documents={documents} riskFlags={riskFlags} />
        <AIAnalysisPanel documents={documents} onFlagsUpdate={setRiskFlags} />

        <div>
          <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
            <div className="flex items-center gap-2">
              <BookOpen size={16} className="text-slate-400" />
              <h2 className="text-sm font-semibold text-slate-200">Document Feed</h2>
              <span className="text-xs text-slate-500 bg-slate-800 px-2 py-0.5 rounded-full">
                {filteredDocs.length} documents
              </span>
            </div>
            <div className="flex gap-1.5 flex-wrap">
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

          {loading ? (
            <div className="text-center text-slate-500 text-sm py-12">Loading document feed...</div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {filteredDocs.map((doc) => (
                <DocumentCard
                  key={doc.id}
                  doc={doc}
                  flagged={!!flagMap[doc.id]}
                  flagSeverity={flagMap[doc.id]?.severity}
                />
              ))}
            </div>
          )}
        </div>

        <div className="text-center text-xs text-slate-600 pb-2">
          Legal Intelligence Dashboard · FastAPI + React + GPT-4o-mini + AWS S3
        </div>
      </main>
    </div>
  );
}
