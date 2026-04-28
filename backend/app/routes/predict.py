from fastapi import APIRouter, HTTPException
from app.models.schemas import AnalyzeRequest, AnalyzeResponse
from app.services.openai_service import analyze_documents
from app.services.aws_logger import log_inference_to_s3
import os

router = APIRouter()


@router.post("/analyze", response_model=AnalyzeResponse, summary="AI analysis of document batch")
async def analyze(request: AnalyzeRequest):
    if not request.documents:
        raise HTTPException(status_code=400, detail="No documents provided")

    if not os.getenv("OPENAI_API_KEY"):
        raise HTTPException(status_code=503, detail="OPENAI_API_KEY not configured")

    try:
        summary, risk_flags, recommended_action, topics, confidence = analyze_documents(
            documents=request.documents,
            workflow=request.workflow,
        )
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"OpenAI API error: {str(e)}")

    docs_dicts = [d.model_dump() for d in request.documents]
    flags_dicts = [f.model_dump() for f in risk_flags]
    logged = log_inference_to_s3(docs_dicts, flags_dicts, summary, recommended_action, confidence)

    return AnalyzeResponse(
        summary=summary,
        risk_flags=risk_flags,
        recommended_action=recommended_action,
        topics=topics,
        confidence=confidence,
        model_used="gpt-4o-mini",
        logged_to_s3=logged,
    )
