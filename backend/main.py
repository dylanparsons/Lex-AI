from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routes import documents, predict

app = FastAPI(
    title="Legal Intelligence API",
    description="FastAPI backend for AI-powered legal and news document analysis",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(documents.router, prefix="/api/documents", tags=["Document Feed"])
app.include_router(predict.router, prefix="/api/predict", tags=["AI Analysis"])


@app.get("/")
def root():
    return {"status": "ok", "message": "Legal Intelligence API is running"}


@app.get("/health")
def health():
    return {"status": "healthy"}
