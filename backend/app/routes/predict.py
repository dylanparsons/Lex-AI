from fastapi import APIRouter, HTTPException
from app.models.schemas import AnalyzeRequest, AnalyzeResponse
from app.services import llm_service
from app.services.llm_service import LLMError
from app.services.audit_logger import log_inference

router = APIRouter()


@router.get("/models", summary="Active LLM provider and available models")
def models():
    return llm_service.list_models()


# Plain `def` (not async): inference is blocking, so FastAPI runs it in a threadpool
# instead of freezing the event loop for the whole generation.
@router.post("/analyze", response_model=AnalyzeResponse, summary="AI analysis of document batch")
def analyze(request: AnalyzeRequest):
    if not request.documents:
        raise HTTPException(status_code=400, detail="No documents provided")

    try:
        result = llm_service.analyze_documents(request.documents, request.workflow, request.model)
    except LLMError as e:
        raise HTTPException(status_code=502, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"LLM error: {e}")

    logged, log_destination = log_inference(
        documents=[d.model_dump() for d in request.documents],
        flags=[f.model_dump() for f in result["risk_flags"]],
        scores=[s.model_dump() for s in result["document_scores"]],
        summary=result["summary"],
        recommendation=result["recommended_action"],
        confidence=result["confidence"],
        workflow=request.workflow,
        provider=llm_service.provider(),
        model=result["model_used"],
    )

    return AnalyzeResponse(
        **result,
        provider=llm_service.provider(),
        logged=logged,
        log_destination=log_destination,
        logged_to_s3=logged and log_destination.startswith("s3://"),
    )
