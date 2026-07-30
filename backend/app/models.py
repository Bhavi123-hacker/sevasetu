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


class FieldMismatch(Base):
    __tablename__ = "field_mismatches"

    id = Column(String, primary_key=True, index=True)
    application_id = Column(String, index=True, nullable=False)
    field_name = Column(String, nullable=False)  # name | date_of_birth | address
    status = Column(String, nullable=False)  # pass | fail
    detail = Column(String, nullable=True)
