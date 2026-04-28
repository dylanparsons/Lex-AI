# lex-ai

A full-stack legal intelligence dashboard. Ingests documents from mock newswire, case law, and regulatory library feeds, runs AI-powered risk classification via OpenAI, and logs every inference to AWS S3.

**Stack:** React · Vite · Tailwind · FastAPI · OpenAI GPT-4o-mini · AWS S3

---

## What it does

- Polls a document feed across three source types: newswire, case law, and regulatory library
- Lets you select a workflow context (legal risk review, compliance monitoring, etc.) before running analysis
- Sends the document batch to GPT-4o-mini, which returns a risk summary, per-document flags with severity levels, and a recommended action
- Flagged documents are highlighted in the feed with color-coded severity borders
- Every AI inference is written to S3 as a structured JSON log under a date-partitioned key

---

## Architecture

```
frontend/   (React + Vite + Tailwind)
    ↕ Axios — proxied through Vite to avoid CORS in dev
backend/    (FastAPI)
    ├── /api/documents/feed      → mock document feed
    └── /api/predict/analyze     → OpenAI analysis + S3 log
         ↓
    openai_service.py            → GPT-4o-mini inference
    aws_logger.py                → S3 audit trail
```

---

## Quick start

### Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env            # add your OPENAI_API_KEY
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

S3 logging is non-blocking — if credentials are missing or the write fails, the API response is unaffected.

---

## AWS S3 setup

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
│       │   ├── openai_service.py    # GPT-4o-mini integration
│       │   └── aws_logger.py        # S3 audit logging
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
