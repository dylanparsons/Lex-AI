import React from "react";
import { Newspaper, Scale, FileText, AlertTriangle } from "lucide-react";

export default function FeedStatsBar({ documents, riskFlags }) {
  const news     = documents.filter((d) => d.source === "newswire").length;
  const cases    = documents.filter((d) => d.source === "case-law-db").length;
  const regs     = documents.filter((d) => d.source === "regulatory-library").length;
  const highFlags = riskFlags.filter((f) => f.severity === "high").length;

  const stats = [
    { label: "Newswire Feed",     value: news,      icon: Newspaper,     color: "text-orange-400" },
    { label: "Case Law Database", value: cases,     icon: Scale,         color: "text-blue-400"   },
    { label: "Regulatory Library",value: regs,      icon: FileText,      color: "text-teal-400"   },
    { label: "High Risk Flags",   value: highFlags, icon: AlertTriangle, color: highFlags > 0 ? "text-red-400" : "text-slate-500" },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {stats.map((s) => (
        <div key={s.label} className="bg-panel border border-border rounded-xl px-4 py-3 flex items-center gap-3">
          <s.icon size={18} className={s.color} />
          <div>
            <div className="text-xl font-bold text-slate-100">{s.value}</div>
            <div className="text-xs text-slate-500">{s.label}</div>
          </div>
        </div>
      ))}
    </div>
  );
}
