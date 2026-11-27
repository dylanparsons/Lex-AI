"""
LLM provider layer.

Supported providers (set LLM_PROVIDER):
  ollama   - default. Native Ollama /api/chat with JSON-schema structured output.
  openai   - OpenAI-compatible /chat/completions. Works with OpenAI itself, or any
             local server that speaks the same API (LM Studio, llama.cpp server,
             vLLM, LocalAI, Jan) by setting OPENAI_BASE_URL.

Everything returns the same normalized tuple so the routes don't care which
backend produced it.
"""
import json
import os
import re
from typing import List, Optional

import httpx

from app.models.schemas import Document, DocumentScore, RiskFlag

# ---------------------------------------------------------------- config

def _env(name: str, default: str) -> str:
    return os.getenv(name, default).strip()


def provider() -> str:
    return _env("LLM_PROVIDER", "ollama").lower()


def default_model() -> str:
    if provider() == "ollama":
        return _env("OLLAMA_MODEL", "llama3.1:8b")
    return _env("OPENAI_MODEL", "gpt-4o-mini")


OLLAMA_BASE_URL = _env("OLLAMA_BASE_URL", "http://localhost:11434").rstrip("/")
OLLAMA_NUM_CTX = int(_env("OLLAMA_NUM_CTX", "8192"))       # Ollama's default ctx is too small for a batch
OLLAMA_KEEP_ALIVE = _env("OLLAMA_KEEP_ALIVE", "10m")
LLM_TIMEOUT = float(_env("LLM_TIMEOUT", "300"))             # local CPU inference can be slow
LLM_TEMPERATURE = float(_env("LLM_TEMPERATURE", "0.2"))
LLM_MAX_TOKENS = int(_env("LLM_MAX_TOKENS", "1500"))

# Total characters of document text sent per request. Feed items are short; uploaded
# contracts are not. ~4 chars per token, so 14000 chars is about 3.5k tokens, which leaves
# room for instructions and output inside an 8192-token context. Raise both together.
LLM_CHAR_BUDGET = int(_env("LLM_CHAR_BUDGET", "14000"))

FLAG_TYPES = ["regulatory-change", "litigation-risk", "breaking-news", "compliance"]
SEVERITIES = ["low", "medium", "high"]

# JSON schema handed to Ollama's `format` field. Constrained decoding also follows the
# property order, so the model writes a per-document assessment before any flags.
# That keeps flags tied to what each document actually says.
ANALYSIS_SCHEMA = {
    "type": "object",
    "properties": {
        "document_assessments": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "doc_id": {"type": "string"},
                    "summary": {"type": "string"},
                    "risk_score": {"type": "integer", "minimum": 0, "maximum": 100},
                },
                "required": ["doc_id", "summary", "risk_score"],
            },
        },
        "risk_flags": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "doc_id": {"type": "string"},
                    "title": {"type": "string"},
                    "flag_type": {"type": "string", "enum": FLAG_TYPES},
                    "severity": {"type": "string", "enum": SEVERITIES},
                    "rationale": {"type": "string"},
                },
                "required": ["doc_id", "title", "flag_type", "severity", "rationale"],
            },
        },
        "summary": {"type": "string"},
        "recommended_action": {"type": "string"},
        "topics": {"type": "array", "items": {"type": "string"}},
        "confidence": {"type": "number"},
    },
    "required": ["document_assessments", "risk_flags", "summary", "recommended_action", "topics", "confidence"],
}

SYSTEM_PROMPT = (
    "You are a precise legal intelligence analyst. "
    "Always respond with a single valid JSON object only. No markdown fences, no commentary."
)


class LLMError(Exception):
    """Raised for provider/connection problems; message is safe to show the user."""


# ---------------------------------------------------------------- prompt

def _allocate(documents: List[Document], budget: int) -> dict:
    """Split the character budget so short docs keep their full text and long ones share the rest."""
    alloc, remaining = {}, budget
    ordered = sorted(documents, key=lambda d: len(d.body))
    for i, d in enumerate(ordered):
        share = max(300, remaining // (len(ordered) - i))
        alloc[d.id] = min(len(d.body), share)
        remaining = max(0, remaining - alloc[d.id])
    return alloc


def build_prompt(documents: List[Document], workflow: str) -> str:
    alloc = _allocate(documents, LLM_CHAR_BUDGET)
    blocks = []
    for d in documents:
        text = d.body[: alloc[d.id]]
        if len(text) < len(d.body):
            text += f"\n[... truncated, {len(d.body) - len(text):,} more characters not shown]"
        meta = [f"Title: {d.title}", f"Source: {d.source}", f"Type: {d.doc_type}"]
        if d.jurisdiction:
            meta.append(f"Jurisdiction: {d.jurisdiction}")
        if d.tags:
            meta.append(f"Tags: {', '.join(d.tags)}")
        blocks.append(f"=== DOCUMENT {d.id} ===\n" + "\n".join(meta) + f"\nText:\n{text}")
    docs_text = "\n\n".join(blocks)

    return f"""Workflow context: {workflow}

Below are {len(documents)} documents. They may be news items, case law, regulations, or files uploaded by the user such as contracts and policies.

{docs_text}

=== END OF DOCUMENTS ===

Respond ONLY with a JSON object in this format:
{{
  "document_assessments": [
    {{
      "doc_id": "the id after DOCUMENT, copied exactly",
      "summary": "one sentence on what this document says that matters legally",
      "risk_score": 0
    }}
  ],
  "risk_flags": [
    {{
      "doc_id": "the id of the document this flag is about",
      "title": "short flag title",
      "flag_type": "one of: regulatory-change | litigation-risk | breaking-news | compliance",
      "severity": "one of: low | medium | high",
      "rationale": "one sentence explaining why, based only on that document's text"
    }}
  ],
  "summary": "2-3 sentence executive summary of the most significant developments across these documents",
  "recommended_action": "Specific, actionable next step for a legal professional reviewing this batch",
  "topics": ["3 to 6 key legal or business topics"],
  "confidence": 0.85
}}

Rules:
- Write one document_assessment for every document, in the order given.
- risk_score is 0-100: 0-39 little legal exposure, 40-69 needs review, 70-100 serious exposure or obligations.
- For contracts and policies, look for unusual liability, indemnity, termination, data use, or compliance terms.
- Flag documents with regulatory enforcement risk, new compliance obligations, significant litigation outcomes, or breaking news with legal implications. Not every document needs a flag.
- Every flag must describe something stated in the document whose doc_id it uses. Do not mention cases, rules, or events that are not in the documents above."""


# ---------------------------------------------------------------- providers

def _call_ollama(prompt: str, model: str) -> str:
    payload = {
        "model": model,
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": prompt},
        ],
        "format": ANALYSIS_SCHEMA,
        "stream": False,
        "keep_alive": OLLAMA_KEEP_ALIVE,
        "options": {
            "temperature": LLM_TEMPERATURE,
            "num_ctx": OLLAMA_NUM_CTX,
            "num_predict": LLM_MAX_TOKENS,
        },
    }
    try:
        r = httpx.post(f"{OLLAMA_BASE_URL}/api/chat", json=payload, timeout=LLM_TIMEOUT)
    except httpx.ConnectError:
        raise LLMError(f"Can't reach Ollama at {OLLAMA_BASE_URL}. Start it with `ollama serve`.")
    except httpx.TimeoutException:
        raise LLMError(f"Ollama took longer than {LLM_TIMEOUT:.0f}s. Try a smaller model or raise LLM_TIMEOUT.")

    if r.status_code == 404:
        raise LLMError(f"Model '{model}' isn't installed in Ollama. Run `ollama pull {model}`.")
    if r.status_code >= 400:
        raise LLMError(f"Ollama error {r.status_code}: {r.text[:300]}")
    return r.json()["message"]["content"]


def _call_openai_compatible(prompt: str, model: str) -> str:
    try:
        from openai import OpenAI, APIConnectionError
    except ImportError:
        raise LLMError("The `openai` package is required for LLM_PROVIDER=openai. pip install openai")

    base_url = os.getenv("OPENAI_BASE_URL") or None          # None = api.openai.com
    # Local servers don't check the key but the client insists on one.
    api_key = os.getenv("OPENAI_API_KEY") or ("not-needed" if base_url else None)
    if not api_key:
        raise LLMError("OPENAI_API_KEY is not set (or set OPENAI_BASE_URL for a local server).")

    client = OpenAI(api_key=api_key, base_url=base_url, timeout=LLM_TIMEOUT)
    kwargs = dict(
        model=model,
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": prompt},
        ],
        temperature=LLM_TEMPERATURE,
        max_tokens=LLM_MAX_TOKENS,
    )
    # json_object is widely supported; some local servers reject it, so retry without.
    try:
        resp = client.chat.completions.create(response_format={"type": "json_object"}, **kwargs)
    except APIConnectionError:
        raise LLMError(f"Can't reach the model server at {base_url or 'api.openai.com'}.")
    except Exception:
        resp = client.chat.completions.create(**kwargs)
    return resp.choices[0].message.content or ""


# ---------------------------------------------------------------- parsing

def _extract_json(raw: str) -> dict:
    """Tolerate fences, preambles and trailing chatter from smaller models."""
    raw = raw.strip()
    fenced = re.search(r"```(?:json)?\s*(.*?)```", raw, re.S)
    if fenced:
        raw = fenced.group(1).strip()
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        start, end = raw.find("{"), raw.rfind("}")
        if start != -1 and end > start:
            return json.loads(raw[start:end + 1])
        raise


def _risk_level(score: int) -> str:
    return "high" if score >= 70 else "medium" if score >= 40 else "low"


def _normalize(parsed: dict, documents: List[Document]) -> dict:
    valid_ids = {d.id for d in documents}
    by_title = {d.title.lower(): d.id for d in documents}
    titles = {d.id: d.title for d in documents}

    def resolve(raw_id, fallback_title="") -> str:
        doc_id = str(raw_id or "").strip()
        if doc_id in valid_ids:
            return doc_id
        # small models sometimes echo the title instead of the id
        return by_title.get(doc_id.lower()) or by_title.get(str(fallback_title).lower(), "")

    flags: List[RiskFlag] = []
    for f in parsed.get("risk_flags") or []:
        if not isinstance(f, dict):
            continue
        doc_id = resolve(f.get("doc_id"), f.get("title", ""))
        if not doc_id:
            continue
        sev = str(f.get("severity", "medium")).lower().strip()
        ftype = str(f.get("flag_type", "compliance")).lower().strip().replace(" ", "-").replace("_", "-")
        flags.append(RiskFlag(
            doc_id=doc_id,
            title=str(f.get("title") or "Flagged document"),
            flag_type=ftype if ftype in FLAG_TYPES else "compliance",
            severity=sev if sev in SEVERITIES else "medium",
            rationale=str(f.get("rationale") or ""),
        ))

    scores: List[DocumentScore] = []
    seen = set()
    for a in parsed.get("document_assessments") or []:
        if not isinstance(a, dict):
            continue
        doc_id = resolve(a.get("doc_id"))
        if not doc_id or doc_id in seen:
            continue
        seen.add(doc_id)
        try:
            score = int(round(float(a.get("risk_score", 0))))
        except (TypeError, ValueError):
            continue
        score = max(0, min(100, score))
        scores.append(DocumentScore(
            doc_id=doc_id,
            title=titles[doc_id],                 # always our title, never the model's
            risk_score=score,
            risk_level=_risk_level(score),
            summary=str(a.get("summary") or ""),
        ))

    try:
        confidence = float(parsed.get("confidence", 0.75))
    except (TypeError, ValueError):
        confidence = 0.75
    if confidence > 1:            # "85" -> 0.85
        confidence /= 100
    confidence = max(0.0, min(1.0, confidence))

    return {
        "summary": str(parsed.get("summary") or "No summary returned."),
        "risk_flags": flags,
        "document_scores": scores,
        "recommended_action": str(parsed.get("recommended_action") or "Review flagged documents manually."),
        "topics": [str(t) for t in (parsed.get("topics") or []) if t][:6],
        "confidence": confidence,
    }


# ---------------------------------------------------------------- public API

def analyze_documents(documents: List[Document], workflow: str, model: Optional[str] = None) -> dict:
    """Returns the normalized analysis plus "model_used"."""
    model = model or default_model()
    prompt = build_prompt(documents, workflow)
    call = _call_ollama if provider() == "ollama" else _call_openai_compatible

    last_err: Exception = None
    for _ in range(2):                         # one retry on malformed JSON
        raw = call(prompt, model)
        try:
            return {**_normalize(_extract_json(raw), documents), "model_used": model}
        except (json.JSONDecodeError, ValueError) as e:
            last_err = e
    raise LLMError(f"Model '{model}' returned invalid JSON twice: {last_err}")


def list_models() -> dict:
    """Describe the active provider and, for Ollama, the locally installed models."""
    info = {"provider": provider(), "default_model": default_model(), "models": [], "reachable": True}
    if provider() == "ollama":
        try:
            r = httpx.get(f"{OLLAMA_BASE_URL}/api/tags", timeout=5)
            r.raise_for_status()
            info["models"] = sorted(m["name"] for m in r.json().get("models", []))
        except Exception:
            info["reachable"] = False
    else:
        base_url = os.getenv("OPENAI_BASE_URL")
        if base_url:   # local OpenAI-compatible servers usually expose /models
            try:
                r = httpx.get(f"{base_url.rstrip('/')}/models", timeout=5,
                              headers={"Authorization": f"Bearer {os.getenv('OPENAI_API_KEY', 'x')}"})
                r.raise_for_status()
                info["models"] = sorted(m["id"] for m in r.json().get("data", []))
            except Exception:
                info["reachable"] = False
        else:
            info["models"] = [default_model()]
    return info
