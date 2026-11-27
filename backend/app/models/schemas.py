from pydantic import BaseModel, ConfigDict
from typing import List, Optional


class Document(BaseModel):
    id: str
    title: str
    source: str          # "newswire" | "case-law-db" | "regulatory-library" | "upload"
    doc_type: str        # "news" | "legal-brief" | "regulation" | "case-law" | "pdf" | "docx" | "text"
    body: str
    published_at: str
    jurisdiction: Optional[str] = None
    tags: Optional[List[str]] = []
    # set for uploaded files
    filename: Optional[str] = None
    pages: Optional[int] = None
    char_count: Optional[int] = None


class DocumentBatch(BaseModel):
    documents: List[Document]
    feed: Optional[str] = "mock"


class AnalyzeRequest(BaseModel):
    documents: List[Document]
    workflow: Optional[str] = "legal-risk-review"
    model: Optional[str] = None   # override the server's default model (e.g. any installed Ollama model)


class RiskFlag(BaseModel):
    doc_id: str
    title: str
    flag_type: str       # "regulatory-change" | "litigation-risk" | "breaking-news" | "compliance"
    severity: str        # "low" | "medium" | "high"
    rationale: str


class DocumentScore(BaseModel):
    doc_id: str
    title: str
    risk_score: int      # 0-100
    risk_level: str      # "low" | "medium" | "high", derived from the score
    summary: str


class AnalyzeResponse(BaseModel):
    model_config = ConfigDict(protected_namespaces=())

    summary: str
    risk_flags: List[RiskFlag]
    document_scores: List[DocumentScore] = []
    recommended_action: str
    topics: List[str]
    confidence: float
    model_used: str
    provider: str
    logged: bool
    log_destination: str
    logged_to_s3: bool            # kept for backwards compatibility
