"""Uploaded documents, kept as one JSON file each under UPLOAD_DIR (default: uploads/)."""
import json
import os
import re
from pathlib import Path
from typing import List, Optional

from app.models.schemas import Document


def _dir() -> Path:
    d = Path(os.getenv("UPLOAD_DIR", "uploads"))
    d.mkdir(parents=True, exist_ok=True)
    return d


def _path(doc_id: str) -> Optional[Path]:
    if not re.fullmatch(r"[0-9a-f]{8}", doc_id):     # ids are ours; never let them reach the filesystem otherwise
        return None
    return _dir() / f"{doc_id}.json"


def save(doc: Document) -> None:
    _path(doc.id).write_text(doc.model_dump_json(indent=2), encoding="utf-8")


def list_all() -> List[Document]:
    docs = []
    for f in _dir().glob("*.json"):
        try:
            docs.append(Document.model_validate_json(f.read_text(encoding="utf-8")))
        except Exception:
            continue
    return sorted(docs, key=lambda d: d.published_at, reverse=True)


def delete(doc_id: str) -> bool:
    p = _path(doc_id)
    if p and p.exists():
        p.unlink()
        return True
    return False
