# lex-ai

A full-stack legal intelligence dashboard. Ingests documents from mock newswire, case law, and regulatory library feeds, runs AI-powered risk classification with a local LLM (Ollama by default, or any OpenAI-compatible server), and keeps an audit log of every inference on disk or in AWS S3.

**Stack:** React · Vite · Tailwind · FastAPI · Ollama (or OpenAI-compatible) · local / S3 audit log

---

## What it does

- Polls a document feed across three source types: newswire, case law, and regulatory library
- Lets you select a workflow context (legal risk review, compliance monitoring, etc.) before running analysis
- Sends the document batch to your chosen model, which returns a risk summary, per-document flags with severity levels, and a recommended action
- Flagged documents are highlighted in the feed with color-coded severity borders
- Every AI inference is written as a structured JSON log under a date-partitioned key (local `logs/` folder by default, S3 optional)

---

## Architecture

```
frontend/   (React + Vite + Tailwind)
    ↕ Axios — proxied through Vite to avoid CORS in dev
backend/    (FastAPI)
    ├── /api/documents/feed      → mock document feed
    ├── /api/documents/upload    → PDF / DOCX / TXT / MD upload + text extraction
    ├── /api/predict/models      → active provider + installed models
    ├── /api/predict/analyze     → LLM analysis + audit log
    └── /api/audit/logs          → past analysis runs
         ↓
    llm_service.py               → Ollama (native API, JSON-schema output) or OpenAI-compatible
    audit_logger.py              → local JSON files or S3
```

---

## Quick start

### 1. Run a local model with Ollama

Install Ollama from https://ollama.com, then:

```bash
ollama pull llama3.1:8b      # default model; ~5 GB
ollama serve                 # skip if the Ollama desktop app is already running
```

Other models that handle structured JSON well: `qwen2.5:7b`, `qwen2.5:14b`, `mistral-nemo`, `gemma2:9b`.
Anything you `ollama pull` shows up in the model picker in the dashboard.

### Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env            # defaults work for Ollama as-is
uvicorn main:app --reload --port 8000
```

Swagger docs at http://localhost:8000/docs

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Dashboard at http://localhost:5173

---

## Environment variables

| Variable | Required | Notes |
|---|---|---|
| `OPENAI_API_KEY` | Yes | sk-... |
| `AWS_S3_BUCKET` | No | defaults to `ai-dashboard-logs` |
| `AWS_REGION` | No | defaults to `us-east-1` |
| `AWS_ACCESS_KEY_ID` | No | not needed if AWS CLI is configured |
| `AWS_SECRET_ACCESS_KEY` | No | not needed if AWS CLI is configured |

Logging is non-blocking — if the write fails, the API response is unaffected.

### Other local servers

LM Studio, llama.cpp's `llama-server`, vLLM, LocalAI and Jan all speak the OpenAI API:

```bash
LLM_PROVIDER=openai
OPENAI_BASE_URL=http://localhost:1234/v1   # LM Studio; llama.cpp uses :8080/v1
OPENAI_MODEL=<model name the server reports>
```

To go back to hosted OpenAI, set `LLM_PROVIDER=openai`, `OPENAI_API_KEY=sk-...` and leave `OPENAI_BASE_URL` unset.

---

## Uploading documents

Use **Upload** in the Documents section, or drag files onto it. PDF, DOCX, TXT and MD files up to 15 MB are supported. Text is extracted on the server and saved under `backend/uploads/`, so uploads survive a restart.

Scanned PDFs have no text layer and are rejected; run them through OCR first.

**Analyze** runs on whatever the source filter shows, so pick **Uploaded** to analyze only your files. Each document gets a 0–100 risk score with a one-line summary, alongside the batch-level flags.

Long files are trimmed to fit the model's context window. `LLM_CHAR_BUDGET` (default 14000 characters) is shared across the batch: short documents keep their full text and long ones split what's left. If you have the RAM, raise `OLLAMA_NUM_CTX` and `LLM_CHAR_BUDGET` together, for example 16384 and 40000.

## Audit log

Every analysis is saved as JSON under `backend/logs/inference-logs/YYYY/MM/DD/`, including document titles, scores and flags. The **Audit Log** panel at the bottom of the dashboard lists past runs; click one to see its details. The viewer reads local logs only.

## AWS S3 setup (optional)

Set `LOG_BACKEND=s3`, then:

```bash
aws s3 mb s3://ai-dashboard-logs --region us-east-1
```

Minimum IAM policy:

```json
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Action": ["s3:PutObject"],
    "Resource": "arn:aws:s3:::ai-dashboard-logs/*"
  }]
}
```

Logs are written to:
```
s3://ai-dashboard-logs/inference-logs/YYYY/MM/DD/<uuid>.json
```

The date-partitioned structure means you can query the logs directly with Athena without any ETL.

---

## Deploying the backend to AWS Lambda

Add Mangum to `requirements.txt` and wrap the app in `main.py`:

```python
from mangum import Mangum
handler = Mangum(app)
```

Then build and deploy with SAM:

```bash
sam build && sam deploy --guided
```

---

## Deploying the frontend

```bash
cd frontend && npm run build
npx vercel --prod
```

Point `VITE_API_BASE_URL` to your deployed API URL in Vercel's environment settings.

---

## Project structure

```
lex-ai/
├── backend/
│   ├── main.py
│   ├── requirements.txt
│   ├── .env.example
│   └── app/
│       ├── routes/
│       │   ├── documents.py         # document feed endpoints
│       │   └── predict.py           # AI analysis endpoint
│       ├── services/
│       │   ├── llm_service.py       # Ollama / OpenAI-compatible inference
│       │   └── audit_logger.py      # local or S3 audit logging
│       └── models/
│           └── schemas.py           # Pydantic models
└── frontend/
    ├── src/
    │   ├── App.jsx
    │   ├── api/client.js
    │   └── components/
    │       ├── AIAnalysisPanel.jsx
    │       ├── DocumentCard.jsx
    │       └── FeedStatsBar.jsx
    ├── package.json
    └── vite.config.js
```
