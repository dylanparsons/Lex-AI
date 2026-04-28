import React, { useState } from "react";
import { Brain, CloudUpload, AlertTriangle, CheckCircle, Loader, Scale } from "lucide-react";
import { analyzeDocuments } from "../api/client";

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

const WORKFLOW_OPTIONS = [
  { value: "legal-risk-review", label: "Legal Risk Review" },
  { value: "regulatory-compliance", label: "Regulatory Compliance" },
  { value: "litigation-monitoring", label: "Litigation Monitoring" },
  { value: "daily-briefing", label: "Daily News Briefing" },
];

export default function AIAnalysisPanel({ documents, onFlagsUpdate }) {
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [workflow, setWorkflow] = useState("legal-risk-review");

  const runAnalysis = async () => {
    if (!documents?.length) return;
    setLoading(true);
    setError(null);
    try {
      const data = await analyzeDocuments(documents, workflow);
      setResult(data);
      onFlagsUpdate?.(data.risk_flags);
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
          <span className="text-xs text-slate-500 bg-slate-700 px-2 py-0.5 rounded-full">GPT-4o-mini</span>
        </div>
        <div className="flex gap-2 flex-wrap">
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
            {loading ? <><Loader size={12} className="animate-spin" /> Analyzing...</> : <><Scale size={12} /> Analyze</>}
          </button>
        </div>
      </div>

      {error && (
        <div className="text-xs text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg p-3">{error}</div>
      )}

      {!result && !loading && !error && (
        <div className="text-sm text-slate-500 text-center py-10">
          Select a workflow and click <span className="text-slate-300">Analyze</span> to run AI analysis across the document feed
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
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 rounded-lg px-3 py-2">
              <CheckCircle size={14} /> No significant risks flagged in this batch
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
              <CloudUpload size={12} className={result.logged_to_s3 ? "text-emerald-400" : "text-slate-600"} />
              <span>{result.logged_to_s3 ? "Logged to S3" : "S3 logging skipped"}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
