import React, { useState, useEffect, useCallback } from "react";
import { ScrollText, ChevronDown, ChevronUp, RefreshCw, Loader } from "lucide-react";
import { fetchAuditLogs, fetchAuditLog } from "../api/client";

const LEVEL_STYLES = {
  high:   "text-red-300",
  medium: "text-amber-300",
  low:    "text-emerald-300",
};

function LogDetail({ logId }) {
  const [log, setLog] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchAuditLog(logId)
      .then(setLog)
      .catch((e) => setError(e.response?.data?.detail || "Couldn't load this log."));
  }, [logId]);

  if (error) return <p className="text-xs text-red-400 px-3 pb-3">{error}</p>;
  if (!log) return <p className="text-xs text-slate-500 px-3 pb-3">Loading…</p>;

  const docs = log.input?.documents || [];
  const scores = Object.fromEntries((log.document_scores || []).map((s) => [s.doc_id, s]));

  return (
    <div className="px-3 pb-3 flex flex-col gap-3 text-xs">
      <div>
        <p className="text-slate-500 uppercase tracking-wider mb-1">Summary</p>
        <p className="text-slate-300 leading-relaxed">{log.output?.summary}</p>
      </div>
      {log.output?.recommendation && (
        <div>
          <p className="text-slate-500 uppercase tracking-wider mb-1">Recommendation</p>
          <p className="text-slate-300 leading-relaxed">{log.output.recommendation}</p>
        </div>
      )}
      {docs.length > 0 && (
        <div>
          <p className="text-slate-500 uppercase tracking-wider mb-1">Documents</p>
          <ul className="flex flex-col gap-0.5">
            {docs.map((d) => (
              <li key={d.id} className="flex justify-between gap-3">
                <span className="text-slate-300 truncate">{d.title || d.id}</span>
                {scores[d.id] && (
                  <span className={`tabular-nums shrink-0 ${LEVEL_STYLES[scores[d.id].risk_level]}`}>
                    {scores[d.id].risk_score}/100
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
      {log.risk_flags?.length > 0 && (
        <div>
          <p className="text-slate-500 uppercase tracking-wider mb-1">Flags</p>
          <ul className="flex flex-col gap-1">
            {log.risk_flags.map((f, i) => (
              <li key={i} className="text-slate-300">
                <span className={`capitalize font-semibold ${LEVEL_STYLES[f.severity]}`}>{f.severity}</span>{" "}
                {f.title}: <span className="text-slate-400">{f.rationale}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      <p className="text-slate-600 font-mono">{log.log_id}</p>
    </div>
  );
}

export default function AuditLogPanel({ refreshKey }) {
  const [open, setOpen] = useState(false);
  const [logs, setLogs] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [expanded, setExpanded] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchAuditLogs(50);
      setLogs(data.logs);
      setTotal(data.total);
    } catch (e) {
      setError(e.response?.data?.detail || "Couldn't load the audit log.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [refreshKey, load]);

  return (
    <div className="bg-panel border border-border rounded-xl">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-5 py-4"
        aria-expanded={open}
      >
        <span className="flex items-center gap-2">
          <ScrollText size={16} className="text-slate-400" />
          <span className="text-sm font-semibold text-slate-200">Audit Log</span>
          <span className="text-xs text-slate-500 bg-slate-800 px-2 py-0.5 rounded-full">{total} runs</span>
        </span>
        {open ? <ChevronUp size={16} className="text-slate-500" /> : <ChevronDown size={16} className="text-slate-500" />}
      </button>

      {open && (
        <div className="px-5 pb-5 flex flex-col gap-3">
          <div className="flex justify-end">
            <button
              onClick={load}
              className="text-xs px-3 py-1.5 rounded-lg bg-slate-800 text-slate-400 hover:bg-slate-700 transition-colors flex items-center gap-1"
            >
              {loading ? <Loader size={11} className="animate-spin" /> : <RefreshCw size={11} />} Refresh
            </button>
          </div>

          {error && <div className="text-xs text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg p-3">{error}</div>}

          {!error && logs.length === 0 && !loading && (
            <p className="text-sm text-slate-500 text-center py-6">No analysis runs logged yet.</p>
          )}

          {logs.length > 0 && (
            <div className="border border-border rounded-lg divide-y divide-border overflow-x-auto">
              <div className="grid grid-cols-[minmax(9rem,1.2fr)_1fr_1fr_4rem_5rem_4.5rem_1rem] gap-3 px-3 py-2 text-xs text-slate-500 min-w-[40rem]">
                <span>Time</span><span>Workflow</span><span>Model</span>
                <span className="text-right">Docs</span><span className="text-right">Flags</span>
                <span className="text-right">Conf.</span><span />
              </div>
              {logs.map((l) => (
                <div key={l.log_id} className="min-w-[40rem]">
                  <button
                    onClick={() => setExpanded((id) => (id === l.log_id ? null : l.log_id))}
                    className="w-full grid grid-cols-[minmax(9rem,1.2fr)_1fr_1fr_4rem_5rem_4.5rem_1rem] gap-3 px-3 py-2 text-xs text-left hover:bg-slate-800/60 transition-colors"
                    aria-expanded={expanded === l.log_id}
                  >
                    <span className="text-slate-300">{l.timestamp ? new Date(l.timestamp).toLocaleString() : "—"}</span>
                    <span className="text-slate-400 truncate">{l.workflow}</span>
                    <span className="text-slate-400 truncate">{l.model}</span>
                    <span className="text-slate-300 text-right tabular-nums">{l.document_count}</span>
                    <span className="text-right tabular-nums">
                      <span className="text-slate-300">{l.flag_count}</span>
                      {l.high_count > 0 && <span className="text-red-300"> ({l.high_count} high)</span>}
                    </span>
                    <span className="text-slate-300 text-right tabular-nums">
                      {l.confidence != null ? `${Math.round(l.confidence * 100)}%` : "—"}
                    </span>
                    {expanded === l.log_id ? <ChevronUp size={12} className="text-slate-500" /> : <ChevronDown size={12} className="text-slate-500" />}
                  </button>
                  {expanded === l.log_id && <LogDetail logId={l.log_id} />}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
