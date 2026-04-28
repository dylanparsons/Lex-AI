import React, { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

const SOURCE_STYLES = {
  "newswire":           { label: "Newswire Feed",      bg: "bg-orange-500/10", border: "border-orange-500/30", text: "text-orange-300" },
  "case-law-db":        { label: "Case Law Database",  bg: "bg-blue-500/10",   border: "border-blue-500/30",   text: "text-blue-300"   },
  "regulatory-library": { label: "Regulatory Library", bg: "bg-teal-500/10",   border: "border-teal-500/30",   text: "text-teal-300"   },
};

const TYPE_LABELS = {
  "news":        "News",
  "case-law":    "Case Law",
  "regulation":  "Regulation",
  "legal-brief": "Legal Brief",
};

export default function DocumentCard({ doc, flagged, flagSeverity }) {
  const [expanded, setExpanded] = useState(false);
  const s = SOURCE_STYLES[doc.source] || SOURCE_STYLES["newswire"];

  const severityBorder = flagSeverity === "high"
    ? "border-l-red-500"
    : flagSeverity === "medium"
    ? "border-l-amber-500"
    : "border-l-transparent";

  return (
    <div className={`bg-panel border border-border border-l-4 ${severityBorder} rounded-xl p-4 flex flex-col gap-3 transition-all`}>
      <div className="flex flex-col gap-1.5">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${s.bg} ${s.border} ${s.text}`}>
            {s.label}
          </span>
          <span className="text-xs text-slate-500 bg-slate-800 px-2 py-0.5 rounded-full">
            {TYPE_LABELS[doc.doc_type] || doc.doc_type}
          </span>
          {doc.jurisdiction && (
            <span className="text-xs text-slate-500">{doc.jurisdiction}</span>
          )}
          {flagged && (
            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
              flagSeverity === "high"
                ? "bg-red-500/10 text-red-400 border border-red-500/30"
                : "bg-amber-500/10 text-amber-400 border border-amber-500/30"
            }`}>
              ⚑ {flagSeverity?.toUpperCase()}
            </span>
          )}
        </div>
        <h3 className="text-sm font-semibold text-slate-100 leading-snug">{doc.title}</h3>
      </div>

      {doc.tags?.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {doc.tags.map((tag) => (
            <span key={tag} className="text-xs text-slate-500 bg-slate-800 px-1.5 py-0.5 rounded">{tag}</span>
          ))}
        </div>
      )}

      <button
        onClick={() => setExpanded((v) => !v)}
        className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-300 transition-colors self-start"
      >
        {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
        {expanded ? "Hide" : "Read excerpt"}
      </button>

      {expanded && (
        <p className="text-xs text-slate-400 leading-relaxed border-t border-border pt-3">{doc.body}</p>
      )}

      <div className="flex items-center justify-between text-xs text-slate-600">
        <span>{new Date(doc.published_at).toLocaleString()}</span>
        <span className="font-mono">#{doc.id}</span>
      </div>
    </div>
  );
}
