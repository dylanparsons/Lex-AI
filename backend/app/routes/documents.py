import random
import uuid
from datetime import datetime, timedelta
from fastapi import APIRouter, Query
from app.models.schemas import Document, DocumentBatch

router = APIRouter()

MOCK_DOCUMENTS = [
    {
        "source": "newswire",
        "doc_type": "news",
        "jurisdiction": None,
        "items": [
            {
                "title": "SEC Expands Cybersecurity Disclosure Rules for Public Companies",
                "body": "The Securities and Exchange Commission has adopted new rules requiring public companies to disclose material cybersecurity incidents within four business days. Companies must also provide annual disclosures about their cybersecurity risk management strategies and board oversight. The rules take effect 30 days after publication in the Federal Register.",
                "tags": ["SEC", "cybersecurity", "compliance", "regulation"],
            },
            {
                "title": "EU AI Act Enters Final Implementation Phase",
                "body": "The European Union's Artificial Intelligence Act has entered its final implementation phase, with high-risk AI system providers now required to register with national competent authorities. Legal and financial services firms using automated decision-making tools must complete conformity assessments by Q2. Non-compliance penalties can reach 3% of global annual turnover.",
                "tags": ["EU", "AI regulation", "compliance", "legal tech"],
            },
            {
                "title": "Federal Reserve Issues Guidance on AI Use in Credit Decisions",
                "body": "The Federal Reserve Board issued supervisory guidance addressing the use of artificial intelligence and machine learning models in consumer credit decisions. The guidance emphasizes explainability requirements under the Equal Credit Opportunity Act and the Fair Housing Act. Banks are expected to maintain model inventories and conduct ongoing fairness testing.",
                "tags": ["Federal Reserve", "AI", "credit", "fair lending"],
            },
            {
                "title": "Legal AI Adoption Accelerates Across Large Law Firms",
                "body": "A new industry survey finds that over 60% of Am Law 200 firms have deployed AI-assisted research or drafting tools in the past 12 months, up from 28% the prior year. Firms cite gains in associate productivity and faster turnaround on due diligence as primary drivers. Governance frameworks and model oversight remain top concerns among general counsel.",
                "tags": ["legal AI", "law firms", "productivity", "governance"],
            },
        ],
    },
    {
        "source": "case-law-db",
        "doc_type": "case-law",
        "jurisdiction": "US Federal",
        "items": [
            {
                "title": "Authors Guild et al. v. AI Corp — Motion to Dismiss Denied",
                "body": "The Northern District of California denied defendant's motion to dismiss claims brought by a class of authors alleging unauthorized use of copyrighted works in AI training data. The court held that plaintiffs sufficiently alleged direct and vicarious copyright infringement and that the fair use defense presented questions of fact not resolvable at the pleading stage.",
                "tags": ["AI", "copyright", "training data", "fair use", "N.D. Cal."],
            },
            {
                "title": "FTC v. Precision Data Corp — Consent Decree on Algorithmic Pricing",
                "body": "The Federal Trade Commission reached a consent decree with Precision Data Corp following allegations that its algorithmic pricing software facilitated price-fixing in violation of Section 5 of the FTC Act. The decree prohibits the company from sharing competitively sensitive pricing data with algorithmic tools used by competing firms.",
                "tags": ["FTC", "antitrust", "algorithmic pricing", "consent decree"],
            },
            {
                "title": "In re: Automated Underwriting Class Action — Settlement Approved",
                "body": "A federal district court granted final approval to a $47 million class action settlement against a major insurer whose automated underwriting system was alleged to have discriminated against minority applicants in violation of the Fair Housing Act. The settlement includes injunctive relief requiring third-party audits of the model annually for five years.",
                "tags": ["fair lending", "automated underwriting", "discrimination", "settlement"],
            },
        ],
    },
    {
        "source": "regulatory-library",
        "doc_type": "regulation",
        "jurisdiction": "US Federal",
        "items": [
            {
                "title": "Practice Note: DORA Compliance Checklist for Financial Institutions",
                "body": "The Digital Operational Resilience Act (DORA) becomes enforceable for EU financial institutions and their ICT third-party service providers. This practice note outlines key obligations including ICT risk management frameworks, incident classification and reporting timelines, digital operational resilience testing, and third-party risk management requirements.",
                "tags": ["DORA", "financial regulation", "ICT risk", "compliance"],
            },
            {
                "title": "Standard Clause: AI Procurement — Vendor Risk and Liability Provisions",
                "body": "Updated standard clauses for procurement contracts involving AI-powered software vendors. Covers model transparency and explainability obligations, data residency and processing restrictions, indemnification for AI-generated errors, audit rights over training data, and liability caps for automated decision-making failures.",
                "tags": ["AI contracts", "vendor risk", "procurement", "standard clauses"],
            },
            {
                "title": "Legal Update: Corporate Governance Obligations for AI Oversight",
                "body": "Courts and regulators are increasingly scrutinizing board-level oversight of AI systems. Directors may face duty-of-care claims if they fail to establish adequate AI governance frameworks. This update covers emerging best practices for board AI committees, management reporting structures, and disclosure obligations for material AI risks.",
                "tags": ["corporate governance", "AI oversight", "board duties", "SEC"],
            },
        ],
    },
]


def build_document(source_pool: dict, item: dict, time_offset_minutes: int = 0) -> Document:
    ts = (datetime.utcnow() - timedelta(minutes=time_offset_minutes)).isoformat()
    return Document(
        id=str(uuid.uuid4())[:8],
        title=item["title"],
        source=source_pool["source"],
        doc_type=source_pool["doc_type"],
        body=item["body"],
        published_at=ts,
        jurisdiction=source_pool.get("jurisdiction"),
        tags=item.get("tags", []),
    )


@router.get("/feed", response_model=DocumentBatch, summary="Get latest documents across all sources")
def get_feed(limit: int = Query(6, ge=1, le=20)):
    docs = []
    offset = 0
    for pool in MOCK_DOCUMENTS:
        for item in pool["items"]:
            docs.append(build_document(pool, item, time_offset_minutes=offset))
            offset += random.randint(5, 45)
    random.shuffle(docs)
    return DocumentBatch(documents=docs[:limit], feed="mock-live")


@router.get("/sources", summary="List available content sources")
def list_sources():
    return {
        "sources": [
            {"id": "newswire",           "label": "Newswire Feed",      "type": "news"},
            {"id": "case-law-db",        "label": "Case Law Database",  "type": "case-law"},
            {"id": "regulatory-library", "label": "Regulatory Library", "type": "regulation"},
        ]
    }
