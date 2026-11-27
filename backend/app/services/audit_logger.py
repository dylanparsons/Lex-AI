"""
Inference audit log.

LOG_BACKEND:
  local - default. Writes JSON files to LOG_DIR/inference-logs/YYYY/MM/DD/<uuid>.json
  s3    - writes the same key layout to AWS_S3_BUCKET (needs boto3 + credentials)
  none  - disabled

Logging never breaks the API response: failures return (False, reason).
"""
import json
import os
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import List, Tuple


def _backend() -> str:
    return os.getenv("LOG_BACKEND", "local").strip().lower()


def _build_payload(documents: List[dict], flags: List[dict], scores: List[dict], summary: str,
                   recommendation: str, confidence: float, workflow: str,
                   provider: str, model: str) -> Tuple[str, dict]:
    now = datetime.now(timezone.utc)
    log_id = str(uuid.uuid4())
    key = f"inference-logs/{now:%Y/%m/%d}/{log_id}.json"
    payload = {
        "log_id": log_id,
        "timestamp": now.isoformat(),
        "workflow": workflow,
        "provider": provider,
        "model": model,
        "input": {
            "document_count": len(documents),
            "document_ids": [d.get("id") for d in documents],
            "documents": [
                {"id": d.get("id"), "title": d.get("title"), "source": d.get("source"),
                 "filename": d.get("filename")}
                for d in documents
            ],
            "sources": sorted({d.get("source") for d in documents if d.get("source")}),
        },
        "risk_flags": flags,
        "document_scores": scores,
        "output": {
            "summary": summary,
            "recommendation": recommendation,
            "confidence": confidence,
        },
    }
    return key, payload


def _write_local(key: str, payload: dict) -> str:
    base = Path(os.getenv("LOG_DIR", "logs"))
    path = base / key
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2))
    return str(path)


def _write_s3(key: str, payload: dict) -> str:
    import boto3  # optional dependency, only needed for LOG_BACKEND=s3
    bucket = os.getenv("AWS_S3_BUCKET", "ai-dashboard-logs")
    boto3.client("s3", region_name=os.getenv("AWS_REGION", "us-east-1")).put_object(
        Bucket=bucket, Key=key, Body=json.dumps(payload, indent=2), ContentType="application/json"
    )
    return f"s3://{bucket}/{key}"


def log_inference(**kwargs) -> Tuple[bool, str]:
    """Returns (logged, destination_or_reason)."""
    backend = _backend()
    if backend == "none":
        return False, "logging disabled"
    key, payload = _build_payload(**kwargs)
    try:
        dest = _write_s3(key, payload) if backend == "s3" else _write_local(key, payload)
        print(f"[audit] logged inference to {dest}")
        return True, dest
    except Exception as e:
        print(f"[audit] logging failed ({backend}): {e}")
        return False, f"{backend} logging failed"
