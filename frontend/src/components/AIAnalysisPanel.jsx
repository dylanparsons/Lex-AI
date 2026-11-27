import React, { useState, useEffect } from "react";
import { Brain, HardDrive, AlertTriangle, CheckCircle, Loader, Scale } from "lucide-react";
import { analyzeDocuments, fetchModels } from "../api/client";

const FLAG_TYPE_LABELS = {
  "regulatory-change": "Regulatory Change",
  "litigation-risk": "Litigation Risk",
  "breaking-news": "Breaking News",
  "compliance": "Compliance",
};

const SEVERITY_STYLES = {
  high:   "bg-red-500/10 border-red-500/40 text-red-300",
  medium: "bg-amber-500/10 border-amber-500/40 text-amber-300",
  low:    "bg-blue-500/10 border-blue-500/40 text-blue-300",
};

const SCORE_STYLES = {
  high:   "bg-red-500/10 text-red-300 border-red-500/30",
  medium: "bg-amber-500/10 text-amber-300 border-amber-500/30",
  low:    "bg-emerald-500/10 text-emerald-300 border-emerald-500/30",
};

const WORKFLOW_OPTIONS = [
  { value: "legal-risk-review", label: "Legal Risk Review" },
  { value: "regulatory-compliance", label: "Regulatory Compliance" },
  { value: "litigation-monitoring", label: "Litigation Monitoring" },
  { value: "daily-briefing", label: "Daily News Briefing" },
];

export default function AIAnalysisPanel({ documents, scopeLabel, onFlagsUpdate, onScoresUpdate, onComplete }) {
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [workflow, setWorkflow] = useState("legal-risk-review");
  const [llm, setLlm] = useState(null);       // { provider, default_model, models, reachable }
  const [model, setModel] = useState("");
  const [elapsed, setElapsed] = useState(0);
  // Snapshot of the batch that was analyzed: the live feed refreshes and issues new ids,
  // so flags must be matched against what the model actually saw.
  const [analyzedDocs, setAnalyzedDocs] = useState({});

  useEffect(() => {
    fetchModels()
      .then((info) => {
        setLlm(info);
        setModel(info.default_model);
      })
      .catch(() => setLlm({ provider: "unknown", models: [], reachable: false }));
  }, []);

  // Local inference is slow enough that a running timer is reassuring.
  useEffect(() => {
    if (!loading) return;
    setElapsed(0);
    const id = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [loading]);

  const modelOptions = llm
    ? Array.from(new Set([llm.default_model, ...(llm.models || [])].filter(Boolean)))
    : [];

  const runAnalysis = async () => {
    if (!documents?.length) return;
    setLoading(true);
    setError(null);
    try {
      const batch = documents;
      const data = await analyzeDocuments(batch, workflow, model);
      setAnalyzedDocs(Object.fromEntries(batch.map((d) => [d.id, d])));
      setResult(data);
      onFlagsUpdate?.(data.risk_flags);
      onScoresUpdate?.(data.document_scores || []);
      onComplete?.();
    } catch (e) {
      setError(e.response?.data?.detail || "Analysis failed. Is the backend running?");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-panel border border-border rounded-xl p-5 flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Brain size={18} className="text-violet-400" />
          <h2 className="text-sm font-semibold text-slate-200">AI Legal Analysis</h2>
          {llm && (
            <span
              className={`text-xs px-2 py-0.5 rounded-full ${
                llm.reachable ? "text-slate-400 bg-slate-700" : "text-red-300 bg-red-500/10"
              }`}
              title={llm.reachable ? "Model server reachable" : "Model server not reachable"}
            >
              {llm.provider}{llm.reachable ? "" : " offline"}
            </span>
          )}
        </div>
        <div className="flex gap-2 flex-wrap">
          {modelOptions.length > 0 && (
            <select
              value={model}
              onChange={(e) => setModel(e.target.value)}
              aria-label="Model"
              className="bg-slate-700 border border-border text-xs text-slate-200 rounded-lg px-2 py-1.5 max-w-[12rem]"
            >
              {modelOptions.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          )}
          <select
            value={workflow}
            onChange={(e) => setWorkflow(e.target.value)}
            className="bg-slate-700 border border-border text-xs text-slate-200 rounded-lg px-2 py-1.5"
          >
            {WORKFLOW_OPTIONS.map((w) => (
              <option key={w.value} value={w.value}>{w.label}</option>
            ))}
          </select>
          <button
            onClick={runAnalysis}
            disabled={loading || !documents?.length}
            className="text-xs px-4 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-medium transition-colors flex items-center gap-1.5"
          >
            {loading ? <><Loader size={12} className="animate-spin" /> Analyzing… {elapsed}s</> : <><Scale size={12} /> Analyze {documents?.length || 0}</>}
          </button>
        </div>
      </div>

      {error && (
        <div className="text-xs text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg p-3">{error}</div>
      )}

      {!result && !loading && !error && (
        <div className="text-sm text-slate-500 text-center py-10">
          Click <span className="text-slate-300">Analyze</span> to run AI analysis on the {documents?.length || 0} documents
          in <span className="text-slate-300">{scopeLabel || "All Sources"}</span>. Use the source filters below to change what gets analyzed.
        </div>
      )}

      {result && (
        <div className="flex flex-col gap-3">
          {/* Topics */}
          {result.topics?.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {result.topics.map((t) => (
                <span key={t} className="text-xs bg-violet-500/10 border border-violet-500/20 text-violet-300 px-2 py-0.5 rounded-full">
                  {t}
                </span>
              ))}
            </div>
          )}

          {/* Summary */}
          <div className="bg-slate-800 rounded-lg p-3">
            <p className="text-xs text-slate-400 mb-1 font-medium uppercase tracking-wider">Intelligence Summary</p>
            <p className="text-sm text-slate-200 leading-relaxed">{result.summary}</p>
          </div>

          {/* Risk Flags */}
          {result.risk_flags?.length > 0 ? (
            <div>
              <p className="text-xs text-slate-400 mb-2 font-medium uppercase tracking-wider flex items-center gap-1">
                <AlertTriangle size={12} className="text-amber-400" />
                Risk Flags ({result.risk_flags.length})
              </p>
              <div className="flex flex-col gap-1.5">
                {result.risk_flags.map((f, i) => (
                  <div key={i} className={`text-xs rounded-lg border px-3 py-2 ${SEVERITY_STYLES[f.severity]}`}>
                    <div className="flex justify-between items-center mb-0.5">
                      <span className="font-semibold">{f.title}</span>
                      <div className="flex gap-1.5 items-center">
                        <span className="opacity-70">{FLAG_TYPE_LABELS[f.flag_type] || f.flag_type}</span>
                        <span className="capitalize font-bold">{f.severity}</span>
                      </div>
                    </div>
                    <p className="opacity-80">{f.rationale}</p>
                    {analyzedDocs[f.doc_id] && (
                      <p className="mt-1.5 pt-1.5 border-t border-white/10 text-slate-400 truncate">
                        <span className="opacity-70">Source: </span>
                        <span className="text-slate-300">{analyzedDocs[f.doc_id].title}</span>
                        <span className="font-mono opacity-60"> #{f.doc_id}</span>
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 rounded-lg px-3 py-2">
              <CheckCircle size={14} /> No significant risks flagged in this batch
            </div>
          )}

          {/* Per-document scores */}
          {result.document_scores?.length > 0 && (
            <div>
              <p className="text-xs text-slate-400 mb-2 font-medium uppercase tracking-wider">Document Scores</p>
              <div className="flex flex-col divide-y divide-border border border-border rounded-lg">
                {[...result.document_scores]
                  .sort((a, b) => b.risk_score - a.risk_score)
                  .map((s) => (
                    <div key={s.doc_id} className="px-3 py-2 text-xs grid grid-cols-[1fr_auto] gap-x-3 gap-y-1 items-center">
                      <span className="text-slate-200 font-medium truncate" title={s.title}>{s.title}</span>
                      <div className="flex items-center gap-2 justify-end">
                        <span className={`px-2 py-0.5 rounded-full border capitalize ${SCORE_STYLES[s.risk_level]}`}>{s.risk_level}</span>
                        <span className="text-slate-300 tabular-nums w-14 text-right">{s.risk_score}/100</span>
                      </div>
                      <span className="text-slate-400 col-span-2">{s.summary}</span>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* Recommended Action */}
          <div className="bg-slate-800 rounded-lg p-3">
            <p className="text-xs text-slate-400 mb-1 font-medium uppercase tracking-wider">Recommended Action</p>
            <p className="text-sm text-slate-200 leading-relaxed">{result.recommended_action}</p>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between text-xs text-slate-500 pt-1">
            <span>Confidence: <span className="text-slate-300 font-medium">{Math.round(result.confidence * 100)}%</span></span>
            <div className="flex items-center gap-1.5">
              <span className="text-slate-400">{result.model_used}</span>
              <span className="text-slate-600">·</span>
              <HardDrive size={12} className={result.logged ? "text-emerald-400" : "text-slate-600"} />
              <span title={result.log_destination}>
                {result.logged ? (result.logged_to_s3 ? "Logged to S3" : "Logged locally") : "Not logged"}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
