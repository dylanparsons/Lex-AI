import json
import os
import re
from pathlib import Path

from fastapi import APIRouter, HTTPException, Query

router = APIRouter()


def _log_root() -> Path:
    return Path(os.getenv("LOG_DIR", "logs")) / "inference-logs"


def _check_backend():
    if os.getenv("LOG_BACKEND", "local").strip().lower() != "local":
        raise HTTPException(status_code=501, detail="The audit log viewer reads local logs only (LOG_BACKEND=local).")


def _summary(entry: dict) -> dict:
    flags = entry.get("risk_flags") or []
    inp = entry.get("input") or {}
    return {
        "log_id": entry.get("log_id"),
        "timestamp": entry.get("timestamp"),
        "workflow": entry.get("workflow"),
        "provider": entry.get("provider", "openai"),
        "model": entry.get("model"),
        "document_count": inp.get("document_count", 0),
        "flag_count": len(flags),
        "high_count": sum(1 for f in flags if f.get("severity") == "high"),
        "confidence": (entry.get("output") or {}).get("confidence"),
    }


@router.get("/logs", summary="Recent inference logs, newest first")
def list_logs(limit: int = Query(50, ge=1, le=500)):
    _check_backend()
    root = _log_root()
    if not root.exists():
        return {"logs": [], "total": 0}
    files = list(root.rglob("*.json"))
    entries = []
    for f in files:
        try:
            entries.append(json.loads(f.read_text(encoding="utf-8")))
        except Exception:
            continue
    entries.sort(key=lambda e: e.get("timestamp", ""), reverse=True)
    return {"logs": [_summary(e) for e in entries[:limit]], "total": len(entries)}


@router.get("/logs/{log_id}", summary="One inference log in full")
def get_log(log_id: str):
    _check_backend()
    if not re.fullmatch(r"[0-9a-f-]{36}", log_id):
        raise HTTPException(status_code=400, detail="Invalid log id")
    for f in _log_root().rglob(f"{log_id}.json"):
        return json.loads(f.read_text(encoding="utf-8"))
    raise HTTPException(status_code=404, detail="Log not found")
