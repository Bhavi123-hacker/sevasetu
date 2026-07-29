"""
SevaSetu API — entrypoint.

Real pipeline, wired end to end: an uploaded document bundle goes
through OCR -> field normalization -> the consistency engine -> the
missing-document checklist -> duplicate detection -> the readiness
score, and the result is persisted to SQLite.

Send documents as multipart form fields where the FIELD NAME is the
document type, e.g. a field named "aadhaar" holding the Aadhaar image.
This keeps the upload flexible across service types without needing a
fixed list of named parameters.
"""
import io
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import List, Optional

from fastapi import FastAPI, Request, HTTPException, Depends
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel
from PIL import Image
from sqlalchemy.orm import Session

from .database import engine, Base, get_db
from . import models
from .pipeline.ocr import extract_text_from_image
from .pipeline.extraction import extract_fields
from .pipeline.consistency import run_consistency_check
from .pipeline.checklist import find_missing_documents
from .pipeline.duplicates import find_probable_duplicate
from .pipeline.scoring import compute_readiness
from .pipeline.rag import index_corpus, answer_question
from .pipeline.sentiment import analyze_sentiment

Base.metadata.create_all(bind=engine)
index_corpus()  # idempotent — indexes the regulation corpus once, no-ops if already indexed

app = FastAPI(title="SevaSetu API", version="0.2.0")

STATIC_DIR = Path(__file__).parent / "static"
app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")


@app.get("/")
def root():
    return FileResponse(STATIC_DIR / "index.html")


@app.get("/api/health")
def health():
    return {"status": "ok", "service": "sevasetu-api"}


class FieldCheckOut(BaseModel):
    field: str
    status: str
    detail: str


class ReadinessResponse(BaseModel):
    application_id: str
    citizen_name: str
    service_type: str
    readiness_score: int
    field_checks: List[FieldCheckOut]
    missing_documents: List[str]
    duplicate_suspected: bool
    estimated_delay_days: str
    recommendation: str


@app.post("/api/applications", response_model=ReadinessResponse)
async def submit_application(request: Request, db: Session = Depends(get_db)):
    form = await request.form()

    citizen_name = form.get("citizen_name")
    service_type = form.get("service_type")
    if not citizen_name or not service_type:
        raise HTTPException(status_code=422, detail="citizen_name and service_type are required")

    # Every other form field whose value is an uploaded file is treated
    # as one document; the field name is that document's type.
    uploaded_docs = {key: value for key, value in form.multi_items() if hasattr(value, "read")}
    if not uploaded_docs:
        raise HTTPException(status_code=422, detail="At least one document must be uploaded")

    application_id = str(uuid.uuid4())[:8]
    fields_by_doc = {}

    for doc_type, upload in uploaded_docs.items():
        raw_bytes = await upload.read()
        image = Image.open(io.BytesIO(raw_bytes))
        ocr_text = extract_text_from_image(image)
        fields_by_doc[doc_type] = extract_fields(ocr_text)

        db.add(models.DocumentRecord(
            id=str(uuid.uuid4())[:8],
            application_id=application_id,
            doc_type=doc_type,
            ocr_text=ocr_text,
        ))

    field_checks = run_consistency_check(fields_by_doc)
    missing_documents = find_missing_documents(service_type, list(uploaded_docs.keys()))

    existing = db.query(models.Application).filter(
        models.Application.service_type == service_type
    ).all()
    existing_dicts = [{"id": a.id, "citizen_name": a.citizen_name, "service_type": a.service_type} for a in existing]
    duplicate = find_probable_duplicate(citizen_name, service_type, existing_dicts)
    duplicate_suspected = bool(duplicate)

    readiness = compute_readiness(field_checks, missing_documents, duplicate_suspected)

    db.add(models.Application(
        id=application_id,
        citizen_name=citizen_name,
        service_type=service_type,
        readiness_score=readiness.score,
        duplicate_suspected=duplicate_suspected,
        estimated_delay_days=readiness.estimated_delay_days,
        recommendation=readiness.recommendation,
        missing_documents=",".join(missing_documents),
    ))
    for check in field_checks:
        db.add(models.FieldMismatch(
            id=str(uuid.uuid4())[:8],
            application_id=application_id,
            field_name=check.field,
            status=check.status,
            detail=check.detail,
        ))
    db.commit()

    return ReadinessResponse(
        application_id=application_id,
        citizen_name=citizen_name,
        service_type=service_type,
        readiness_score=readiness.score,
        field_checks=[FieldCheckOut(field=c.field, status=c.status, detail=c.detail) for c in field_checks],
        missing_documents=missing_documents,
        duplicate_suspected=duplicate_suspected,
        estimated_delay_days=readiness.estimated_delay_days,
        recommendation=readiness.recommendation,
    )


@app.get("/api/applications")
def list_applications(db: Session = Depends(get_db)):
    apps = db.query(models.Application).order_by(models.Application.readiness_score.asc()).all()
    return [
        {
            "id": a.id,
            "citizen_name": a.citizen_name,
            "service_type": a.service_type,
            "readiness_score": a.readiness_score,
            "duplicate_suspected": a.duplicate_suspected,
            "status": a.status,
            "created_at": a.created_at.isoformat() if a.created_at else None,
        }
        for a in apps
    ]


@app.get("/api/applications/{application_id}")
def get_application(application_id: str, db: Session = Depends(get_db)):
    application = db.query(models.Application).filter(models.Application.id == application_id).first()
    if not application:
        raise HTTPException(status_code=404, detail="Application not found")

    field_checks = db.query(models.FieldMismatch).filter(
        models.FieldMismatch.application_id == application_id
    ).all()

    return {
        "id": application.id,
        "citizen_name": application.citizen_name,
        "service_type": application.service_type,
        "readiness_score": application.readiness_score,
        "duplicate_suspected": application.duplicate_suspected,
        "estimated_delay_days": application.estimated_delay_days,
        "recommendation": application.recommendation,
        "missing_documents": application.missing_documents.split(",") if application.missing_documents else [],
        "status": application.status,
        "resolved_by": application.resolved_by,
        "field_checks": [
            {"field": c.field_name, "status": c.status, "detail": c.detail} for c in field_checks
        ],
    }


class ResolveRequest(BaseModel):
    officer_name: Optional[str] = None


@app.post("/api/applications/{application_id}/resolve")
def resolve_application(application_id: str, payload: ResolveRequest, db: Session = Depends(get_db)):
    application = db.query(models.Application).filter(models.Application.id == application_id).first()
    if not application:
        raise HTTPException(status_code=404, detail="Application not found")
    application.status = "resolved"
    application.resolved_by = payload.officer_name
    application.resolved_at = datetime.now(timezone.utc)
    db.commit()
    return {"id": application_id, "status": "resolved"}


# ---------- Regulation RAG assistant ----------
# Retrieval-only: returns the best-matching passage from the regulation
# corpus, no generation step on top. See pipeline/rag.py for why.

class AskRequest(BaseModel):
    question: str


class AskMatch(BaseModel):
    id: str
    text: str
    relevance: float


class AskResponse(BaseModel):
    question: str
    matches: List[AskMatch]


@app.post("/api/ask", response_model=AskResponse)
def ask_question(payload: AskRequest):
    if not payload.question.strip():
        raise HTTPException(status_code=422, detail="question must not be empty")
    matches = answer_question(payload.question, top_k=2)
    return AskResponse(
        question=payload.question,
        matches=[AskMatch(**m) for m in matches],
    )


# ---------- Feedback + sentiment ----------

class FeedbackRequest(BaseModel):
    text: str
    citizen_name: Optional[str] = None
    application_id: Optional[str] = None


class FeedbackResponse(BaseModel):
    id: str
    sentiment_label: str
    sentiment_score: float


@app.post("/api/feedback", response_model=FeedbackResponse)
def submit_feedback(payload: FeedbackRequest, db: Session = Depends(get_db)):
    if not payload.text.strip():
        raise HTTPException(status_code=422, detail="text must not be empty")

    sentiment = analyze_sentiment(payload.text)
    feedback_id = str(uuid.uuid4())[:8]

    db.add(models.Feedback(
        id=feedback_id,
        application_id=payload.application_id,
        citizen_name=payload.citizen_name,
        text=payload.text,
        sentiment_label=sentiment["label"],
        sentiment_score=sentiment["score"],
    ))
    db.commit()

    return FeedbackResponse(id=feedback_id, sentiment_label=sentiment["label"], sentiment_score=sentiment["score"])


@app.get("/api/feedback")
def list_feedback(db: Session = Depends(get_db)):
    rows = db.query(models.Feedback).order_by(models.Feedback.created_at.desc()).all()
    return [
        {
            "id": f.id,
            "text": f.text,
            "citizen_name": f.citizen_name,
            "sentiment_label": f.sentiment_label,
            "sentiment_score": f.sentiment_score,
            "created_at": f.created_at.isoformat() if f.created_at else None,
        }
        for f in rows
    ]


# ---------- Officer productivity stats ----------
# Plain SQL aggregation over data that already exists — no separate
# analytics pipeline or learned model, consistent with the rest of this
# project's "explainable over black-box" choice.

@app.get("/api/officer-stats")
def officer_stats(db: Session = Depends(get_db)):
    applications = db.query(models.Application).all()
    feedback = db.query(models.Feedback).all()

    total = len(applications)
    resolved = [a for a in applications if a.status == "resolved"]
    by_officer = {}
    for a in resolved:
        name = a.resolved_by or "unattributed"
        by_officer[name] = by_officer.get(name, 0) + 1

    by_service = {}
    for a in applications:
        by_service[a.service_type] = by_service.get(a.service_type, 0) + 1

    avg_readiness = round(sum(a.readiness_score or 0 for a in applications) / total, 1) if total else 0

    sentiment_counts = {"positive": 0, "neutral": 0, "negative": 0}
    for f in feedback:
        sentiment_counts[f.sentiment_label] = sentiment_counts.get(f.sentiment_label, 0) + 1

    return {
        "total_applications": total,
        "resolved_count": len(resolved),
        "pending_count": total - len(resolved),
        "average_readiness_score": avg_readiness,
        "resolutions_by_officer": by_officer,
        "applications_by_service": by_service,
        "feedback_sentiment_counts": sentiment_counts,
        "total_feedback": len(feedback),
    }
