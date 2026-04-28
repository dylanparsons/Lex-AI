from pydantic import BaseModel
from typing import List, Optional


class Document(BaseModel):
    id: str
    title: str
    source: str          # "reuters-news" | "westlaw" | "practical-law"
    doc_type: str        # "news" | "legal-brief" | "regulation" | "case-law"
    body: str
    published_at: str
    jurisdiction: Optional[str] = None
    tags: Optional[List[str]] = []


class DocumentBatch(BaseModel):
    documents: List[Document]
    feed: Optional[str] = "mock"


class AnalyzeRequest(BaseModel):
    documents: List[Document]
    workflow: Optional[str] = "legal-risk-review"


class RiskFlag(BaseModel):
    doc_id: str
    title: str
    flag_type: str       # "regulatory-change" | "litigation-risk" | "breaking-news" | "compliance"
    severity: str        # "low" | "medium" | "high"
    rationale: str


class AnalyzeResponse(BaseModel):
    summary: str
    risk_flags: List[RiskFlag]
    recommended_action: str
    topics: List[str]
    confidence: float
    model_used: str
    logged_to_s3: bool
