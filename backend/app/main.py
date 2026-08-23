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
import time
import uuid
import os
import json
from datetime import datetime, timezone
from pathlib import Path
from typing import List, Optional

from fastapi import FastAPI, Request, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, Response
from pydantic import BaseModel
from PIL import Image
from sqlalchemy.orm import Session

from .database import engine, Base, get_db, SessionLocal, ensure_schema_upgrades
from . import models
from .pipeline.ocr import (
    extract_text_from_image,
    extract_confidence_from_image,
    process_document_bytes,
    DocumentValidationError,
)
from .pipeline.extraction import extract_fields
from .pipeline.consistency import run_consistency_check, FieldCheckResult
from .pipeline.checklist import (
    find_missing_documents,
    seed_defaults_if_empty,
    get_service_catalog,
    get_required_documents,
    DOCUMENT_LABELS,
)
from .pipeline.classifier import classify_document_type, ClassificationResult, DOCUMENT_RULES
from .pipeline.duplicates import find_probable_duplicate
from .pipeline.scoring import compute_readiness
from .pipeline.rag import index_corpus, answer_question
from .pipeline.sentiment import analyze_sentiment
from .pipeline.generation import generate_answer
from .pipeline.report import build_report_pdf
from .logging_config import configure_logging, get_logger

configure_logging()
logger = get_logger("sevasetu")
from .auth import (
    create_access_token, get_current_staff_user, require_role,
    verify_password, hash_password, is_locked_out, record_failed_attempt, clear_failed_attempts,
    seed_demo_accounts_if_empty,
)

Base.metadata.create_all(bind=engine)
ensure_schema_upgrades(engine)
index_corpus()  # idempotent — indexes the regulation corpus once, no-ops if already indexed

# One-off session for startup seeding — get_db is request-scoped, this isn't a request.
with SessionLocal() as _startup_db:
    seed_defaults_if_empty(_startup_db)
    seed_demo_accounts_if_empty(_startup_db, models)

app = FastAPI(title="SevaSetu API", version="0.2.0")

# CORS configuration for cross-origin local and Render deployment
explicit_origins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:8000",
    "http://127.0.0.1:8000",
    "https://sevasetu-frontend.onrender.com",
    "https://sevasetu-backend.onrender.com",
]
custom_origins = [o.strip() for o in os.getenv("ALLOWED_ORIGINS", "").split(",") if o.strip() and o.strip() != "*"]
allowed_origins = list(set(explicit_origins + custom_origins))

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_origin_regex=r"^https?://(localhost|127\.0\.0\.1)(:[0-9]+)?$|^https://.*\.onrender\.com$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def log_requests(request: Request, call_next):
    start = time.monotonic()
    try:
        response = await call_next(request)
    except Exception as exc:
        duration_ms = round((time.monotonic() - start) * 1000, 1)
        logger.error("request_failed", extra={
            "method": request.method, "path": request.url.path,
            "duration_ms": duration_ms, "error": str(exc),
        })
        raise
    duration_ms = round((time.monotonic() - start) * 1000, 1)
    log_level = logger.warning if response.status_code >= 400 else logger.info
    log_level("request_completed", extra={
        "method": request.method, "path": request.url.path,
        "status_code": response.status_code, "duration_ms": duration_ms,
    })
    return response

STATIC_DIR = Path(__file__).parent / "static"
app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")


@app.get("/")
def root():
    return FileResponse(STATIC_DIR / "index.html")


@app.get("/api/health")
def health():
    return {"status": "ok", "service": "sevasetu-api"}


# ---------- Staff authentication ----------

class LoginRequest(BaseModel):
    username: str
    password: str


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    name: str
    role: str


@app.post("/api/auth/login", response_model=LoginResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    username = payload.username.strip().lower()

    lockout_remaining = is_locked_out(username)
    if lockout_remaining is not None:
        logger.warning("login_locked_out", extra={"username": username, "seconds_remaining": lockout_remaining})
        raise HTTPException(
            status_code=429,
            detail=f"Too many failed attempts. Try again in {lockout_remaining} seconds.",
        )

    user = db.query(models.StaffUser).filter(models.StaffUser.username == username).first()

    if not user or not verify_password(payload.password, user.password_hash) or not user.is_active:
        record_failed_attempt(username)
        logger.warning("login_failed", extra={"username": username})
        raise HTTPException(status_code=401, detail="Incorrect username or password")

    clear_failed_attempts(username)
    logger.info("login_succeeded", extra={"username": username, "role": user.role})

    token = create_access_token(username=user.username, name=user.display_name, role=user.role)
    return LoginResponse(access_token=token, name=user.display_name, role=user.role)


class FieldCheckOut(BaseModel):
    field: str
    status: str
    detail: str


class ScoreReasonOut(BaseModel):
    points: int
    label: str


class RequestCorrectionIn(BaseModel):
    reason: str
    details: Optional[str] = None


class LifecycleActionIn(BaseModel):
    notes: Optional[str] = None


class DocumentVerificationOut(BaseModel):
    expected_type: str
    detected_type: str
    confidence: float
    status: str  # MATCH | LIKELY_MATCH | UNCERTAIN | MISMATCH
    evidence: List[str] = []
    is_valid_for_slot: bool = True


class ReadinessResponse(BaseModel):
    application_id: str
    citizen_name: str
    service_type: str
    status: str
    readiness_score: int
    score_reasoning: List[ScoreReasonOut]
    field_checks: List[FieldCheckOut]
    document_verifications: List[DocumentVerificationOut] = []
    missing_documents: List[str]
    duplicate_suspected: bool
    duplicate_confidence: Optional[int] = None
    estimated_delay_days: str
    recommendation: str
    average_ocr_confidence: float
    correction_reason: Optional[str] = None
    correction_details: Optional[str] = None


def _log_audit(db: Session, application_id: str, event_type: str, detail: str = None, actor: str = "system"):
    db.add(models.AuditEvent(
        id=str(uuid.uuid4())[:8],
        application_id=application_id,
        event_type=event_type,
        detail=detail,
        actor=actor,
    ))


@app.get("/api/services")
def list_services(db: Session = Depends(get_db)):
    """Public catalog of active civic services with document requirements."""
    return get_service_catalog(db, active_only=True)


@app.post("/api/applications", response_model=ReadinessResponse)
async def submit_application(request: Request, db: Session = Depends(get_db)):
    form = await request.form()

    citizen_name = form.get("citizen_name")
    service_type = form.get("service_type")
    if not citizen_name or not service_type:
        raise HTTPException(status_code=422, detail="citizen_name and service_type are required")

    # Validate that service_type exists and is active in the catalog
    srv_def = db.query(models.ServiceDefinition).filter(models.ServiceDefinition.id == service_type).first()
    if not srv_def or not srv_def.is_active:
        raise HTTPException(status_code=400, detail=f"Unknown or inactive service '{service_type}'")

    # Every other form field whose value is an uploaded file is treated
    # as one document; the field name is that document's type.
    uploaded_docs = {key: value for key, value in form.multi_items() if hasattr(value, "read")}
    if not uploaded_docs:
        raise HTTPException(status_code=422, detail="At least one document must be uploaded")

    application_id = str(uuid.uuid4())[:8]
    _log_audit(db, application_id, "Uploaded", detail=f"{srv_def.name}: {len(uploaded_docs)} document(s): {', '.join(uploaded_docs.keys())}")

    fields_by_doc = {}
    confidences = []
    doc_verifications: List[ClassificationResult] = []

    for doc_type, upload in uploaded_docs.items():
        raw_bytes = await upload.read()
        filename = getattr(upload, "filename", None)
        content_type = getattr(upload, "content_type", None)

        try:
            ocr_text, confidence = process_document_bytes(
                raw_bytes, filename=filename, content_type=content_type
            )
        except DocumentValidationError as exc:
            logger.warning("invalid_document_upload", extra={"doc_type": doc_type, "error": str(exc)})
            raise HTTPException(status_code=400, detail=f"Invalid '{doc_type}' document: {str(exc)}")
        except Exception as exc:
            logger.error("ocr_processing_error", extra={"doc_type": doc_type, "error": str(exc)})
            raise HTTPException(status_code=500, detail=f"Failed to process '{doc_type}' document: {str(exc)}")

        confidences.append(confidence)
        fields_by_doc[doc_type] = extract_fields(ocr_text)

        # Independent Document Type Classification
        classification = classify_document_type(ocr_text, doc_type)
        doc_verifications.append(classification)

        db.add(models.DocumentRecord(
            id=str(uuid.uuid4())[:8],
            application_id=application_id,
            doc_type=doc_type,
            detected_type=classification.detected_type,
            type_confidence=classification.confidence,
            type_status=classification.status,
            type_evidence=json.dumps(classification.evidence),
            ocr_text=ocr_text,
            ocr_confidence=confidence,
        ))

    average_confidence = round(sum(confidences) / len(confidences), 1) if confidences else 0.0
    _log_audit(db, application_id, "OCR Completed", detail=f"Average confidence {average_confidence}%")

    # Document type verification audit logging
    mismatches = [c for c in doc_verifications if c.status == "MISMATCH"]
    uncertains = [c for c in doc_verifications if c.status == "UNCERTAIN"]
    if mismatches:
        m_details = "; ".join(f"{DOCUMENT_RULES.get(m.expected_type, {}).get('label', m.expected_type)} slot contains {DOCUMENT_RULES.get(m.detected_type, {}).get('label', m.detected_type)}" for m in mismatches)
        _log_audit(db, application_id, "Document Type Verification", detail=f"MISMATCH: {m_details}")
    elif uncertains:
        _log_audit(db, application_id, "Document Type Verification", detail=f"UNCERTAIN: {len(uncertains)} document(s) need manual verification")
    else:
        _log_audit(db, application_id, "Document Type Verification", detail="All uploaded documents match expected types")

    field_checks = run_consistency_check(fields_by_doc)
    _log_audit(db, application_id, "Consistency Check Completed",
               detail=f"{sum(1 for c in field_checks if c.status == 'fail')} mismatch(es) found")

    # Missing document checklist — only valid documents satisfy the requirement
    valid_doc_types = [c.expected_type for c in doc_verifications if c.is_valid_for_slot]
    missing_documents = find_missing_documents(db, service_type, valid_doc_types)

    # First non-empty DOB found across the bundle
    date_of_birth = next((f.get("date_of_birth") for f in fields_by_doc.values() if f.get("date_of_birth")), None)

    existing = db.query(models.Application).filter(
        models.Application.service_type == service_type
    ).all()
    existing_dicts = [
        {"id": a.id, "citizen_name": a.citizen_name, "service_type": a.service_type, "date_of_birth": a.date_of_birth}
        for a in existing
    ]
    duplicate_match = find_probable_duplicate(citizen_name, service_type, existing_dicts, date_of_birth)
    duplicate_suspected = duplicate_match is not None
    duplicate_confidence = duplicate_match["confidence"] if duplicate_match else None
    _log_audit(
        db, application_id, "Duplicate Check Completed",
        detail=f"Possible duplicate found, {duplicate_confidence}% confidence" if duplicate_suspected else "No duplicate found",
    )

    readiness = compute_readiness(
        field_checks=field_checks,
        missing_documents=missing_documents,
        duplicate_suspected=duplicate_suspected,
        doc_verifications=doc_verifications,
    )
    _log_audit(db, application_id, "Readiness Scored", detail=f"Score: {readiness.score}%")

    # Determine application lifecycle state based on validation
    if mismatches:
        app_status = "NEEDS_CORRECTION"
        first_m = mismatches[0]
        expected_lbl = DOCUMENT_RULES.get(first_m.expected_type, {}).get("label", first_m.expected_type)
        detected_lbl = DOCUMENT_RULES.get(first_m.detected_type, {}).get("label", first_m.detected_type)
        correction_reason = f"Document Type Mismatch in {expected_lbl} slot"
        correction_details = f"The document uploaded in the '{expected_lbl}' slot appears to be a '{detected_lbl}'. Please upload a valid {expected_lbl}."
    else:
        app_status = "READY_FOR_REVIEW"
        correction_reason = None
        correction_details = None

    logger.info("application_submitted", extra={
        "application_id": application_id, "service_type": service_type,
        "readiness_score": readiness.score, "document_count": len(uploaded_docs),
        "average_ocr_confidence": average_confidence, "duplicate_suspected": duplicate_suspected,
        "status": app_status,
    })

    db.add(models.Application(
        id=application_id,
        citizen_name=citizen_name,
        date_of_birth=date_of_birth,
        service_type=service_type,
        readiness_score=readiness.score,
        duplicate_suspected=duplicate_suspected,
        duplicate_confidence=duplicate_confidence,
        estimated_delay_days=readiness.estimated_delay_days,
        recommendation=readiness.recommendation,
        missing_documents=",".join(missing_documents),
        status=app_status,
        correction_reason=correction_reason,
        correction_details=correction_details,
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

    verif_out = [
        DocumentVerificationOut(
            expected_type=v.expected_type,
            detected_type=v.detected_type,
            confidence=v.confidence,
            status=v.status,
            evidence=v.evidence,
            is_valid_for_slot=v.is_valid_for_slot,
        )
        for v in doc_verifications
    ]

    return ReadinessResponse(
        application_id=application_id,
        citizen_name=citizen_name,
        service_type=service_type,
        status=app_status,
        readiness_score=readiness.score,
        score_reasoning=[ScoreReasonOut(points=r.points, label=r.label) for r in readiness.reasoning],
        field_checks=[FieldCheckOut(field=c.field, status=c.status, detail=c.detail) for c in field_checks],
        document_verifications=verif_out,
        missing_documents=missing_documents,
        duplicate_suspected=duplicate_suspected,
        duplicate_confidence=duplicate_confidence,
        estimated_delay_days=readiness.estimated_delay_days,
        recommendation=readiness.recommendation,
        average_ocr_confidence=average_confidence,
        correction_reason=correction_reason,
        correction_details=correction_details,
    )


@app.get("/api/applications")
def list_applications(db: Session = Depends(get_db), _user: dict = Depends(get_current_staff_user)):
    apps = db.query(models.Application).order_by(models.Application.readiness_score.asc()).all()
    return [
        {
            "id": a.id,
            "citizen_name": a.citizen_name,
            "service_type": a.service_type,
            "readiness_score": a.readiness_score,
            "duplicate_suspected": a.duplicate_suspected,
            "duplicate_confidence": a.duplicate_confidence,
            "missing_documents": a.missing_documents.split(",") if a.missing_documents else [],
            "status": a.status,
            "resolved_by": a.resolved_by,
            "correction_reason": a.correction_reason,
            "correction_details": a.correction_details,
            "created_at": a.created_at.isoformat() if a.created_at else None,
            "resolved_at": a.resolved_at.isoformat() if a.resolved_at else None,
            "resubmitted_at": a.resubmitted_at.isoformat() if a.resubmitted_at else None,
        }
        for a in apps
    ]


@app.get("/api/applications/{application_id}")
def get_application(application_id: str, db: Session = Depends(get_db)):
    application = db.query(models.Application).filter(models.Application.id == application_id).first()
    if not application:
        raise HTTPException(status_code=404, detail="Application not found")

    field_checks_rows = db.query(models.FieldMismatch).filter(
        models.FieldMismatch.application_id == application_id
    ).all()
    field_checks = [FieldCheckResult(field=c.field_name, status=c.status, detail=c.detail) for c in field_checks_rows]
    missing_documents = application.missing_documents.split(",") if application.missing_documents else []

    documents = db.query(models.DocumentRecord).filter(models.DocumentRecord.application_id == application_id).all()
    doc_verifs = []
    for d in documents:
        evidence = json.loads(d.type_evidence) if d.type_evidence else []
        doc_verifs.append(
            ClassificationResult(
                expected_type=d.doc_type,
                detected_type=d.detected_type or d.doc_type,
                confidence=d.type_confidence if d.type_confidence is not None else 0.95,
                status=d.type_status or "MATCH",
                evidence=evidence,
                is_valid_for_slot=d.type_status in ["MATCH", "LIKELY_MATCH"] if d.type_status else True,
            )
        )

    readiness = compute_readiness(field_checks, missing_documents, application.duplicate_suspected, doc_verifs)

    confidences = [d.ocr_confidence for d in documents if d.ocr_confidence is not None]
    average_confidence = round(sum(confidences) / len(confidences), 1) if confidences else None

    # Gather extracted fields for field verification table
    fields_extracted = {}
    for d in documents:
        if d.ocr_text:
            f = extract_fields(d.ocr_text)
            for k, v in f.items():
                if v and not fields_extracted.get(k):
                    fields_extracted[k] = {"value": v, "source_doc": d.doc_type, "confidence": d.ocr_confidence}

    doc_verifications_out = [
        {
            "expected_type": v.expected_type,
            "detected_type": v.detected_type,
            "confidence": v.confidence,
            "status": v.status,
            "evidence": v.evidence,
            "is_valid_for_slot": v.is_valid_for_slot,
        }
        for v in doc_verifs
    ]

    return {
        "id": application.id,
        "citizen_name": application.citizen_name,
        "service_type": application.service_type,
        "readiness_score": application.readiness_score,
        "score_reasoning": [{"points": r.points, "label": r.label} for r in readiness.reasoning],
        "duplicate_suspected": application.duplicate_suspected,
        "duplicate_confidence": application.duplicate_confidence,
        "estimated_delay_days": application.estimated_delay_days,
        "recommendation": application.recommendation,
        "missing_documents": missing_documents,
        "status": application.status,
        "resolved_by": application.resolved_by,
        "correction_reason": application.correction_reason,
        "correction_details": application.correction_details,
        "correction_requested_by": application.correction_requested_by,
        "correction_requested_at": application.correction_requested_at.isoformat() if application.correction_requested_at else None,
        "resubmitted_at": application.resubmitted_at.isoformat() if application.resubmitted_at else None,
        "created_at": application.created_at.isoformat() if application.created_at else None,
        "resolved_at": application.resolved_at.isoformat() if application.resolved_at else None,
        "average_ocr_confidence": average_confidence,
        "extracted_fields": fields_extracted,
        "document_verifications": doc_verifications_out,
        "documents": [
            {
                "id": d.id,
                "doc_type": d.doc_type,
                "detected_type": d.detected_type or d.doc_type,
                "type_status": d.type_status or "MATCH",
                "type_confidence": d.type_confidence,
                "ocr_confidence": d.ocr_confidence,
                "snippet": (d.ocr_text[:150] + "...") if d.ocr_text and len(d.ocr_text) > 150 else d.ocr_text,
            }
            for d in documents
        ],
        "field_checks": [
            {"field": c.field_name, "status": c.status, "detail": c.detail} for c in field_checks_rows
        ],
    }


@app.post("/api/applications/{application_id}/request-correction")
def request_correction(
    application_id: str,
    payload: RequestCorrectionIn,
    db: Session = Depends(get_db),
    user: dict = Depends(require_role("Officer")),
):
    application = db.query(models.Application).filter(models.Application.id == application_id).first()
    if not application:
        raise HTTPException(status_code=404, detail="Application not found")
    
    prev_status = application.status
    application.status = "NEEDS_CORRECTION"
    application.correction_reason = payload.reason
    application.correction_details = payload.details
    application.correction_requested_by = user["name"]
    application.correction_requested_at = datetime.now(timezone.utc)
    
    _log_audit(
        db, application_id, "Correction Requested",
        detail=f"State: {prev_status} -> NEEDS_CORRECTION. Reason: {payload.reason}. Notes: {payload.details or 'None'}",
        actor=user["name"],
    )
    db.commit()
    return {
        "id": application_id,
        "status": "NEEDS_CORRECTION",
        "correction_reason": payload.reason,
        "correction_details": payload.details,
    }


@app.post("/api/applications/{application_id}/resubmit", response_model=ReadinessResponse)
async def resubmit_application(
    application_id: str,
    request: Request,
    db: Session = Depends(get_db),
):
    application = db.query(models.Application).filter(models.Application.id == application_id).first()
    if not application:
        raise HTTPException(status_code=404, detail="Application not found")

    form = await request.form()
    uploaded_docs = {}
    for key, value in form.items():
        if hasattr(value, "read"):
            uploaded_docs[key] = value

    if not uploaded_docs:
        raise HTTPException(status_code=400, detail="At least one replacement document must be uploaded.")

    # Process all uploaded replacement documents
    for doc_type, upload in uploaded_docs.items():
        raw_bytes = await upload.read()
        filename = getattr(upload, "filename", None)
        content_type = getattr(upload, "content_type", None)

        try:
            ocr_text, confidence = process_document_bytes(
                raw_bytes, filename=filename, content_type=content_type
            )
        except DocumentValidationError as exc:
            logger.warning("invalid_document_upload", extra={"doc_type": doc_type, "error": str(exc)})
            raise HTTPException(status_code=400, detail=f"Invalid '{doc_type}' document: {str(exc)}")
        except Exception as exc:
            logger.error("ocr_processing_error", extra={"doc_type": doc_type, "error": str(exc)})
            raise HTTPException(status_code=500, detail=f"Failed to process '{doc_type}' document: {str(exc)}")

        # Classify replacement document
        classification = classify_document_type(ocr_text, doc_type)

        # Update existing record or create new
        existing_doc = db.query(models.DocumentRecord).filter(
            models.DocumentRecord.application_id == application_id,
            models.DocumentRecord.doc_type == doc_type,
        ).first()
        if existing_doc:
            existing_doc.ocr_text = ocr_text
            existing_doc.ocr_confidence = confidence
            existing_doc.detected_type = classification.detected_type
            existing_doc.type_confidence = classification.confidence
            existing_doc.type_status = classification.status
            existing_doc.type_evidence = json.dumps(classification.evidence)
        else:
            db.add(models.DocumentRecord(
                id=str(uuid.uuid4())[:8],
                application_id=application_id,
                doc_type=doc_type,
                detected_type=classification.detected_type,
                type_confidence=classification.confidence,
                type_status=classification.status,
                type_evidence=json.dumps(classification.evidence),
                ocr_text=ocr_text,
                ocr_confidence=confidence,
            ))

    # Re-evaluate complete bundle
    all_docs = db.query(models.DocumentRecord).filter(
        models.DocumentRecord.application_id == application_id
    ).all()
    fields_by_doc = {}
    confidences = []
    doc_verifications: List[ClassificationResult] = []

    for d in all_docs:
        if d.ocr_text:
            fields_by_doc[d.doc_type] = extract_fields(d.ocr_text)
        if d.ocr_confidence is not None:
            confidences.append(d.ocr_confidence)
        
        evidence = json.loads(d.type_evidence) if d.type_evidence else []
        doc_verifications.append(
            ClassificationResult(
                expected_type=d.doc_type,
                detected_type=d.detected_type or d.doc_type,
                confidence=d.type_confidence if d.type_confidence is not None else 0.95,
                status=d.type_status or "MATCH",
                evidence=evidence,
                is_valid_for_slot=d.type_status in ["MATCH", "LIKELY_MATCH"] if d.type_status else True,
            )
        )

    average_confidence = round(sum(confidences) / len(confidences), 1) if confidences else 0.0
    field_checks = run_consistency_check(fields_by_doc)

    valid_doc_types = [c.expected_type for c in doc_verifications if c.is_valid_for_slot]
    missing_documents = find_missing_documents(db, application.service_type, valid_doc_types)

    # Recreate field mismatches
    db.query(models.FieldMismatch).filter(models.FieldMismatch.application_id == application_id).delete()
    for check in field_checks:
        db.add(models.FieldMismatch(
            id=str(uuid.uuid4())[:8],
            application_id=application_id,
            field_name=check.field,
            status=check.status,
            detail=check.detail,
        ))

    readiness = compute_readiness(
        field_checks=field_checks,
        missing_documents=missing_documents,
        duplicate_suspected=application.duplicate_suspected,
        doc_verifications=doc_verifications,
    )
    
    prev_status = application.status
    mismatches = [c for c in doc_verifications if c.status == "MISMATCH"]

    if mismatches:
        new_status = "NEEDS_CORRECTION"
        first_m = mismatches[0]
        expected_lbl = DOCUMENT_RULES.get(first_m.expected_type, {}).get("label", first_m.expected_type)
        detected_lbl = DOCUMENT_RULES.get(first_m.detected_type, {}).get("label", first_m.detected_type)
        application.correction_reason = f"Document Type Mismatch in {expected_lbl} slot"
        application.correction_details = f"The replacement document in the '{expected_lbl}' slot appears to be a '{detected_lbl}'. Please upload a valid {expected_lbl}."
    else:
        new_status = "READY_FOR_REVIEW"
        application.correction_reason = None
        application.correction_details = None

    application.status = new_status
    application.readiness_score = readiness.score
    application.missing_documents = ",".join(missing_documents)
    application.estimated_delay_days = readiness.estimated_delay_days
    application.recommendation = readiness.recommendation
    application.resubmitted_at = datetime.now(timezone.utc)

    _log_audit(
        db, application_id, "Correction Resubmitted",
        detail=f"Citizen uploaded {len(uploaded_docs)} replacement document(s): {', '.join(uploaded_docs.keys())}",
        actor="Citizen",
    )
    _log_audit(
        db, application_id, "Automated Verification",
        detail=f"Reprocessed bundle. New Readiness Score: {readiness.score}%, OCR Confidence: {average_confidence}%",
        actor="System (Reprocessor)",
    )
    _log_audit(
        db, application_id, "Status Transition",
        detail=f"State: {prev_status} -> RESUBMITTED -> {new_status}",
        actor="System",
    )
    db.commit()

    verif_out = [
        DocumentVerificationOut(
            expected_type=v.expected_type,
            detected_type=v.detected_type,
            confidence=v.confidence,
            status=v.status,
            evidence=v.evidence,
            is_valid_for_slot=v.is_valid_for_slot,
        )
        for v in doc_verifications
    ]

    return ReadinessResponse(
        application_id=application_id,
        citizen_name=application.citizen_name,
        service_type=application.service_type,
        status=new_status,
        readiness_score=readiness.score,
        score_reasoning=[ScoreReasonOut(points=r.points, label=r.label) for r in readiness.reasoning],
        field_checks=[FieldCheckOut(field=c.field, status=c.status, detail=c.detail) for c in field_checks],
        document_verifications=verif_out,
        missing_documents=missing_documents,
        duplicate_suspected=application.duplicate_suspected,
        duplicate_confidence=application.duplicate_confidence,
        estimated_delay_days=readiness.estimated_delay_days,
        recommendation=readiness.recommendation,
        average_ocr_confidence=average_confidence,
        correction_reason=application.correction_reason,
        correction_details=application.correction_details,
    )


@app.post("/api/applications/{application_id}/approve")
def approve_application(
    application_id: str,
    payload: LifecycleActionIn = LifecycleActionIn(),
    db: Session = Depends(get_db),
    user: dict = Depends(require_role("Officer")),
):
    application = db.query(models.Application).filter(models.Application.id == application_id).first()
    if not application:
        raise HTTPException(status_code=404, detail="Application not found")
    
    prev_status = application.status
    application.status = "APPROVED"
    application.resolved_by = user["name"]
    application.resolved_at = datetime.now(timezone.utc)
    _log_audit(
        db, application_id, "Application Approved",
        detail=f"State: {prev_status} -> APPROVED. Approved by Officer {user['name']}. Notes: {payload.notes or 'All statutory requirements verified.'}",
        actor=user["name"],
    )
    db.commit()
    return {"id": application_id, "status": "APPROVED", "resolved_by": user["name"]}


@app.post("/api/applications/{application_id}/reject")
def reject_application(
    application_id: str,
    payload: LifecycleActionIn = LifecycleActionIn(),
    db: Session = Depends(get_db),
    user: dict = Depends(require_role("Officer")),
):
    application = db.query(models.Application).filter(models.Application.id == application_id).first()
    if not application:
        raise HTTPException(status_code=404, detail="Application not found")
    
    prev_status = application.status
    application.status = "REJECTED"
    application.resolved_by = user["name"]
    application.resolved_at = datetime.now(timezone.utc)
    _log_audit(
        db, application_id, "Application Rejected",
        detail=f"State: {prev_status} -> REJECTED. Rejected by Officer {user['name']}. Notes: {payload.notes or 'Requirements not met.'}",
        actor=user["name"],
    )
    db.commit()
    return {"id": application_id, "status": "REJECTED", "resolved_by": user["name"]}


@app.post("/api/applications/{application_id}/resolve")
def resolve_application(
    application_id: str, db: Session = Depends(get_db), user: dict = Depends(require_role("Officer"))
):
    application = db.query(models.Application).filter(models.Application.id == application_id).first()
    if not application:
        raise HTTPException(status_code=404, detail="Application not found")
    prev_status = application.status
    application.status = "resolved"
    application.resolved_by = user["name"]  # from the verified token, not a client-supplied field
    application.resolved_at = datetime.now(timezone.utc)
    _log_audit(
        db, application_id, "Resolved",
        detail=f"State: {prev_status} -> resolved. Marked resolved by {user['name']}",
        actor=user["name"],
    )
    db.commit()
    return {"id": application_id, "status": "resolved"}


@app.get("/api/applications/{application_id}/audit")
def get_audit_trail(application_id: str, db: Session = Depends(get_db), _user: dict = Depends(get_current_staff_user)):
    events = db.query(models.AuditEvent).filter(
        models.AuditEvent.application_id == application_id
    ).order_by(models.AuditEvent.created_at.asc()).all()
    return [
        {"event_type": e.event_type, "detail": e.detail, "actor": e.actor, "created_at": e.created_at.isoformat() if e.created_at else None}
        for e in events
    ]


@app.get("/api/applications/{application_id}/report.pdf")
def download_report(application_id: str, db: Session = Depends(get_db)):
    application = db.query(models.Application).filter(models.Application.id == application_id).first()
    if not application:
        raise HTTPException(status_code=404, detail="Application not found")

    field_checks_rows = db.query(models.FieldMismatch).filter(models.FieldMismatch.application_id == application_id).all()
    field_checks = [FieldCheckResult(field=c.field_name, status=c.status, detail=c.detail) for c in field_checks_rows]
    missing_documents = application.missing_documents.split(",") if application.missing_documents else []
    readiness = compute_readiness(field_checks, missing_documents, application.duplicate_suspected)

    audit_rows = db.query(models.AuditEvent).filter(
        models.AuditEvent.application_id == application_id
    ).order_by(models.AuditEvent.created_at.asc()).all()

    pdf_bytes = build_report_pdf(
        application={
            "id": application.id,
            "citizen_name": application.citizen_name,
            "service_type": application.service_type,
            "status": application.status,
            "readiness_score": application.readiness_score,
            "score_reasoning": [{"points": r.points, "label": r.label} for r in readiness.reasoning],
            "missing_documents": missing_documents,
            "recommendation": application.recommendation,
        },
        field_checks=[{"field": c.field_name, "status": c.status, "detail": c.detail} for c in field_checks_rows],
        audit_events=[
            {"event_type": e.event_type, "detail": e.detail, "created_at": e.created_at.isoformat() if e.created_at else None}
            for e in audit_rows
        ],
    )

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="sevasetu-report-{application_id}.pdf"'},
    )


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
    generated_answer: Optional[str] = None


@app.post("/api/ask", response_model=AskResponse)
def ask_question(payload: AskRequest):
    if not payload.question.strip():
        raise HTTPException(status_code=422, detail="question must not be empty")
    matches = answer_question(payload.question, top_k=2)

    generated_answer = None
    if matches:
        generated_answer = generate_answer(payload.question, matches[0]["text"])

    return AskResponse(
        question=payload.question,
        matches=[AskMatch(**m) for m in matches],
        generated_answer=generated_answer,
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
def list_feedback(db: Session = Depends(get_db), _user: dict = Depends(get_current_staff_user)):
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
def officer_stats(db: Session = Depends(get_db), _user: dict = Depends(get_current_staff_user)):
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

    by_date = {}
    for a in applications:
        if a.created_at:
            day = a.created_at.strftime("%Y-%m-%d")
            by_date[day] = by_date.get(day, 0) + 1
    by_date = dict(sorted(by_date.items()))  # chronological, not insertion order

    mismatches = db.query(models.FieldMismatch).filter(models.FieldMismatch.status == "fail").all()
    mismatch_reasons = {}
    for m in mismatches:
        label = m.field_name.replace("_", " ").title()
        mismatch_reasons[label] = mismatch_reasons.get(label, 0) + 1

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
        "applications_by_date": by_date,
        "common_mismatch_reasons": mismatch_reasons,
        "feedback_sentiment_counts": sentiment_counts,
        "total_feedback": len(feedback),
    }


# ---------- Administrator: staff account management ----------
# Turns "2 hardcoded demo accounts" into something a real team can
# actually onboard people into. Deactivate is soft (is_active=False),
# not a delete — keeps the audit/resolution history intact for
# whoever used the account while it was active.

class CreateStaffUserRequest(BaseModel):
    username: str
    password: str
    display_name: str
    role: str  # "Officer" | "Administrator"


@app.post("/api/staff/users")
def create_staff_user(
    payload: CreateStaffUserRequest, db: Session = Depends(get_db), _user: dict = Depends(require_role("Administrator"))
):
    if payload.role not in ("Officer", "Administrator"):
        raise HTTPException(status_code=422, detail="role must be 'Officer' or 'Administrator'")
    username = payload.username.strip().lower()
    if not username or not payload.password or not payload.display_name.strip():
        raise HTTPException(status_code=422, detail="username, password, and display_name are all required")
    if len(payload.password) < 8:
        raise HTTPException(status_code=422, detail="password must be at least 8 characters")
    if db.query(models.StaffUser).filter(models.StaffUser.username == username).first():
        raise HTTPException(status_code=409, detail="That username is already taken")

    new_user = models.StaffUser(
        id=str(uuid.uuid4())[:8],
        username=username,
        password_hash=hash_password(payload.password),
        display_name=payload.display_name.strip(),
        role=payload.role,
        is_active=True,
    )
    db.add(new_user)
    db.commit()
    logger.info("staff_account_created", extra={"username": username, "role": payload.role, "created_by": _user["username"]})
    return {"username": username, "display_name": new_user.display_name, "role": new_user.role, "is_active": True}


@app.get("/api/staff/users")
def list_staff_users(db: Session = Depends(get_db), _user: dict = Depends(require_role("Administrator"))):
    users = db.query(models.StaffUser).order_by(models.StaffUser.created_at.asc()).all()
    return [
        {"username": u.username, "display_name": u.display_name, "role": u.role, "is_active": u.is_active}
        for u in users
    ]


@app.patch("/api/staff/users/{username}/deactivate")
def deactivate_staff_user(username: str, db: Session = Depends(get_db), user: dict = Depends(require_role("Administrator"))):
    if username == user["username"]:
        raise HTTPException(status_code=400, detail="You can't deactivate your own account while logged in as it")
    target = db.query(models.StaffUser).filter(models.StaffUser.username == username).first()
    if not target:
        raise HTTPException(status_code=404, detail="No such account")
    target.is_active = False
    db.commit()
    logger.info("staff_account_deactivated", extra={"username": username, "deactivated_by": user["username"]})
    return {"username": username, "is_active": False}


@app.patch("/api/staff/users/{username}/activate")
def activate_staff_user(username: str, db: Session = Depends(get_db), user: dict = Depends(require_role("Administrator"))):
    target = db.query(models.StaffUser).filter(models.StaffUser.username == username).first()
    if not target:
        raise HTTPException(status_code=404, detail="No such account")
    target.is_active = True
    db.commit()
    logger.info("staff_account_reactivated", extra={"username": username, "reactivated_by": user["username"]})
    return {"username": username, "is_active": True}


# ---------- Administrator: required-documents settings ----------
# This is what makes Administrator a genuinely distinct role from
# Officer, not just a relabeled login. An Officer processes applications;
# an Administrator changes the rules those applications get checked
# against. Same distinction the architecture diagram draws.

@app.get("/api/service-requirements")
def get_service_requirements(db: Session = Depends(get_db), _user: dict = Depends(get_current_staff_user)):
    rows = db.query(models.RequiredDocument).all()
    result: dict = {}
    for row in rows:
        result.setdefault(row.service_type, []).append(row.document_type)
    return result


class UpdateRequirementsRequest(BaseModel):
    document_types: List[str]


@app.put("/api/service-requirements/{service_type}")
def update_service_requirements(
    service_type: str,
    payload: UpdateRequirementsRequest,
    db: Session = Depends(get_db),
    _user: dict = Depends(require_role("Administrator")),
):
    db.query(models.RequiredDocument).filter(
        models.RequiredDocument.service_type == service_type
    ).delete()
    for doc_type in payload.document_types:
        db.add(models.RequiredDocument(
            id=str(uuid.uuid4())[:8],
            service_type=service_type,
            document_type=doc_type,
        ))
    db.commit()
    return {"service_type": service_type, "document_types": payload.document_types}


@app.get("/api/admin/services")
def admin_list_services(
    db: Session = Depends(get_db),
    _user: dict = Depends(require_role("Administrator")),
):
    """Returns full service catalog including active and inactive services for Administrator."""
    return get_service_catalog(db, active_only=False)


@app.patch("/api/admin/services/{service_id}/toggle")
def admin_toggle_service(
    service_id: str,
    db: Session = Depends(get_db),
    user: dict = Depends(require_role("Administrator")),
):
    """Toggles active/inactive status for a service definition."""
    srv = db.query(models.ServiceDefinition).filter(models.ServiceDefinition.id == service_id).first()
    if not srv:
        raise HTTPException(status_code=404, detail="Service not found")
    srv.is_active = not srv.is_active
    db.commit()
    logger.info("service_status_toggled", extra={"service_id": service_id, "is_active": srv.is_active, "admin": user["username"]})
    return {"id": srv.id, "name": srv.name, "is_active": srv.is_active}
