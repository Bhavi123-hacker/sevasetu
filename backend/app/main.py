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
from pathlib import Path
from typing import List

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

Base.metadata.create_all(bind=engine)

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
        "field_checks": [
            {"field": c.field_name, "status": c.status, "detail": c.detail} for c in field_checks
        ],
    }


@app.post("/api/applications/{application_id}/resolve")
def resolve_application(application_id: str, db: Session = Depends(get_db)):
    application = db.query(models.Application).filter(models.Application.id == application_id).first()
    if not application:
        raise HTTPException(status_code=404, detail="Application not found")
    application.status = "resolved"
    db.commit()
    return {"id": application_id, "status": "resolved"}
