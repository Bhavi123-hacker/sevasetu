"""
Minimal schema — enough to store what the readiness pipeline needs.
Extend as the real OCR/consistency-engine logic gets wired in.
"""
from sqlalchemy import Column, String, Integer, Boolean, DateTime, Float
from sqlalchemy.sql import func
from .database import Base


class Application(Base):
    __tablename__ = "applications"

    id = Column(String, primary_key=True, index=True)
    citizen_name = Column(String, nullable=False)
    service_type = Column(String, nullable=False, index=True)
    readiness_score = Column(Integer, nullable=True)
    duplicate_suspected = Column(Boolean, default=False)
    estimated_delay_days = Column(String, nullable=True)
    recommendation = Column(String, nullable=True)
    missing_documents = Column(String, nullable=True)  # comma-separated, simplest for an MVP
    status = Column(String, default="submitted")  # submitted | reviewed | resolved
    resolved_by = Column(String, nullable=True)  # officer name — demo-level attribution, not tied to real auth
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    resolved_at = Column(DateTime(timezone=True), nullable=True)


class Feedback(Base):
    __tablename__ = "feedback"

    id = Column(String, primary_key=True, index=True)
    application_id = Column(String, nullable=True, index=True)  # optional — general feedback allowed too
    citizen_name = Column(String, nullable=True)
    text = Column(String, nullable=False)
    sentiment_label = Column(String, nullable=False)  # positive | neutral | negative
    sentiment_score = Column(Float, nullable=True)  # VADER compound score, -1 to 1
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class DocumentRecord(Base):
    __tablename__ = "documents"

    id = Column(String, primary_key=True, index=True)
    application_id = Column(String, index=True, nullable=False)
    doc_type = Column(String, nullable=False)  # e.g. aadhaar, ration_card, electricity_bill
    ocr_text = Column(String, nullable=True)
    ocr_confidence = Column(Float, nullable=True)  # average word-level confidence, 0-100


class FieldMismatch(Base):
    __tablename__ = "field_mismatches"

    id = Column(String, primary_key=True, index=True)
    application_id = Column(String, index=True, nullable=False)
    field_name = Column(String, nullable=False)  # name | date_of_birth | address
    status = Column(String, nullable=False)  # pass | fail
    detail = Column(String, nullable=True)


class AuditEvent(Base):
    """
    One row per pipeline stage per application — Uploaded, OCR Completed,
    Duplicate Check, Consistency Check, Officer Reviewed, Resolved.
    Append-only by convention (nothing in this codebase updates or
    deletes a row); that's what makes it a real audit trail rather than
    just a status field that overwrites itself.
    """
    __tablename__ = "audit_events"

    id = Column(String, primary_key=True, index=True)
    application_id = Column(String, index=True, nullable=False)
    event_type = Column(String, nullable=False)
    detail = Column(String, nullable=True)
    actor = Column(String, nullable=True)  # "system" for pipeline stages, an officer's name for manual actions
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class StaffUser(Base):
    """
    Individual accounts, replacing the earlier shared-password-per-role
    login. That earlier design had a real gap: the role was picked by
    the client in a dropdown and only checked against one password
    shared by both roles — nothing actually bound an identity to a
    role. Here, role comes from the account record the username
    resolves to, not from anything the client sends.
    """
    __tablename__ = "staff_users"

    id = Column(String, primary_key=True, index=True)
    username = Column(String, unique=True, nullable=False, index=True)
    password_hash = Column(String, nullable=False)
    display_name = Column(String, nullable=False)
    role = Column(String, nullable=False)  # "Officer" | "Administrator"
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class RequiredDocument(Base):
    """
    One row per (service_type, document_type). Replaces the hardcoded
    SERVICE_REQUIREMENTS dict — this is what US-25 (administrator edits
    the checklist) actually needed to exist. Seeded once at startup with
    the same defaults that used to live in code; editable after that via
    the admin endpoints.
    """
    __tablename__ = "required_documents"

    id = Column(String, primary_key=True, index=True)
    service_type = Column(String, nullable=False, index=True)
    document_type = Column(String, nullable=False)
