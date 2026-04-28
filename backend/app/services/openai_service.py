import os
import json
from openai import OpenAI
from app.models.schemas import Document, RiskFlag
from typing import List, Tuple

client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))


def analyze_documents(documents: List[Document], workflow: str) -> Tuple[str, List[RiskFlag], str, List[str], float]:
    """
    Send document batch to GPT-4o-mini for legal/news risk analysis.
    Returns (summary, risk_flags, recommended_action, topics, confidence).
    """
    doc_summaries = [
        {
            "id": d.id,
            "title": d.title,
            "source": d.source,
            "doc_type": d.doc_type,
            "body": d.body[:600],
            "tags": d.tags,
            "jurisdiction": d.jurisdiction,
        }
        for d in documents
    ]

    prompt = f"""You are an AI legal intelligence analyst for a professional information services platform.

Workflow context: {workflow}

You have been given a batch of documents from Reuters News, Westlaw, and Practical Law:
{json.dumps(doc_summaries, indent=2)}

Analyze these documents and respond ONLY with a JSON object in this exact format:
{{
  "summary": "2-3 sentence executive summary of the most significant developments across this document batch",
  "risk_flags": [
    {{
      "doc_id": "the document id",
      "title": "short flag title",
      "flag_type": "one of: regulatory-change | litigation-risk | breaking-news | compliance",
      "severity": "one of: low | medium | high",
      "rationale": "one sentence explaining why this is flagged"
    }}
  ],
  "recommended_action": "Specific, actionable next step for a legal professional reviewing this batch",
  "topics": ["list", "of", "3-6", "key", "legal", "or", "business", "topics"],
  "confidence": 0.85
}}

Flag documents that contain: regulatory enforcement risk, new compliance obligations, significant litigation outcomes, or breaking news with legal implications. Not every document needs a flag."""

    response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {
                "role": "system",
                "content": "You are a precise legal intelligence analyst. Always respond with valid JSON only. No markdown fences.",
            },
            {"role": "user", "content": prompt},
        ],
        temperature=0.2,
        max_tokens=800,
    )

    raw = response.choices[0].message.content.strip()
    if raw.startswith("```"):
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]

    parsed = json.loads(raw.strip())

    risk_flags = [
        RiskFlag(
            doc_id=f["doc_id"],
            title=f["title"],
            flag_type=f["flag_type"],
            severity=f["severity"],
            rationale=f["rationale"],
        )
        for f in parsed.get("risk_flags", [])
    ]

    return (
        parsed["summary"],
        risk_flags,
        parsed["recommended_action"],
        parsed.get("topics", []),
        float(parsed.get("confidence", 0.85)),
    )
