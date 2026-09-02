"""
SevaSetu Complete Database Models (v1.1.0).
Full schema supporting citizen profile, phone verification, document wallet, applications,
verification pipeline, AI verification interview, notifications, audit trail,
government requirement provenance, requirement versioning, and centralized civic service catalog.
"""
from sqlalchemy import Column, String, Integer, Boolean, DateTime, Float, Text, ForeignKey
from sqlalchemy.sql import func
from .database import Base


class CitizenProfile(Base):
    """
    Citizen-controlled profile holding reusable personal information.
    Must be reviewed and confirmed by citizen before application inclusion.
    """
    __tablename__ = "citizen_profiles"

    id = Column(String, primary_key=True, index=True)  # uuid or citizen identifier
    citizen_name = Column(String, nullable=False)
    date_of_birth = Column(String, nullable=True)
    gender = Column(String, nullable=True)  # Male | Female | Other
    address = Column(String, nullable=True)
    district = Column(String, nullable=True)
    state = Column(String, nullable=True)
    pincode = Column(String, nullable=True)
    phone = Column(String, nullable=True)
    phone_number = Column(String, nullable=True, index=True)  # Canonical +91XXXXXXXXXX
    phone_verified_at = Column(DateTime(timezone=True), nullable=True)
    phone_verification_status = Column(String, default="UNVERIFIED", nullable=False)  # UNVERIFIED | PENDING_VERIFICATION | VERIFIED
    email = Column(String, nullable=True)
    category = Column(String, nullable=True)  # General | OBC | SC | ST | EWS
    is_student = Column(Boolean, default=False)
    has_disability = Column(Boolean, default=False)
    annual_income = Column(Float, nullable=True)
    preferences = Column(Text, nullable=True)  # JSON: language, general preferences
    notification_preferences = Column(Text, nullable=True)  # JSON: granular channel & event preferences
    password_hash = Column(String, nullable=True)
    firebase_uid = Column(String(128), nullable=True, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class PhoneVerificationOtp(Base):
    """
    Secure short-lived phone verification OTP records.
    Never stores plaintext OTPs permanently. Stores salted SHA-256 hashes.
    """
    __tablename__ = "phone_verification_otps"

    id = Column(String, primary_key=True, index=True)
    phone_number = Column(String, nullable=False, index=True)
    citizen_profile_id = Column(String, nullable=True, index=True)
    hashed_otp = Column(String, nullable=False)
    salt = Column(String, nullable=False)
    attempts_left = Column(Integer, default=3, nullable=False)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    resend_available_at = Column(DateTime(timezone=True), nullable=False)
    is_used = Column(Boolean, default=False, nullable=False)
    is_invalidated = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class DocumentWalletItem(Base):
    """
    Citizen Document Wallet item ("My Documents").
    Stores pre-processed, reusable citizen documents with classification and validity history.
    """
    __tablename__ = "wallet_documents"

    id = Column(String, primary_key=True, index=True)
    citizen_profile_id = Column(String, index=True, nullable=True)
    doc_type = Column(String, nullable=False, index=True)  # e.g., aadhaar, ration_card, electricity_bill
    original_filename = Column(String, nullable=False)
    file_path = Column(String, nullable=True)
    file_size_bytes = Column(Integer, nullable=True)
    mime_type = Column(String, nullable=True)
    ocr_text = Column(Text, nullable=True)
    ocr_confidence = Column(Float, nullable=True)
    detected_type = Column(String, nullable=True)
    type_confidence = Column(Float, nullable=True)
    type_status = Column(String, default="DOCUMENT_TYPE_MATCH")  # DOCUMENT_TYPE_MATCH | DOCUMENT_TYPE_UNCERTAIN | DOCUMENT_TYPE_MISMATCH
    type_evidence = Column(Text, nullable=True)  # JSON array of matched evidence strings
    quality_status = Column(String, default="GOOD")  # GOOD | WARNING | UNREADABLE | POOR
    quality_score = Column(Float, nullable=True)
    quality_issues = Column(Text, nullable=True)
    validity_status = Column(String, default="VALID")  # VALID | EXPIRED | EXPIRING_SOON | NOT_APPLICABLE | UNABLE_TO_DETERMINE
    issue_date = Column(String, nullable=True)
    expiry_date = Column(String, nullable=True)
    validity_evidence = Column(Text, nullable=True)
    official_authenticity_verification = Column(String, default="NOT_PERFORMED", nullable=True)
    official_verification_status = Column(String, default="NOT_PERFORMED", nullable=True)
    authenticity_disclaimer = Column(String, default="Automated pre-verification only. Official authenticity has not been independently verified.", nullable=True)
    metadata_json = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class Application(Base):
    """
    Core civic application case record.
    Tracks complete lifecycle from draft/submission through automated verification,
    review, correction, and authorized officer decision.
    """
    __tablename__ = "applications"

    id = Column(String, primary_key=True, index=True)
    citizen_name = Column(String, nullable=False)
    service_type = Column(String, nullable=False, index=True)
    status = Column(String, default="READY_FOR_REVIEW", index=True)
    resolved_by = Column(String, nullable=True)
    readiness_score = Column(Integer, nullable=True)
    risk_level = Column(String, default="LOW", index=True)
    risk_factors = Column(String, nullable=True)
    is_fast_track_eligible = Column(Boolean, default=False)
    duplicate_suspected = Column(Boolean, default=False)
    duplicate_confidence = Column(Integer, nullable=True)
    estimated_delay_days = Column(String, nullable=True)
    recommendation = Column(String, nullable=True)
    missing_documents = Column(String, nullable=True)
    correction_reason = Column(String, nullable=True)
    correction_details = Column(String, nullable=True)
    tracking_token = Column(String, index=True, nullable=True)
    citizen_profile_id = Column(String, index=True, nullable=True)
    correction_requested_by = Column(String, nullable=True)
    correction_requested_at = Column(DateTime(timezone=True), nullable=True)
    resubmitted_at = Column(DateTime(timezone=True), nullable=True)
    declaration_confirmed = Column(Boolean, default=True)
    confirmation_timestamp = Column(DateTime(timezone=True), nullable=True)
    confirmation_method = Column(String, default="CITIZEN_DECLARATION")
    mfa_verified = Column(Boolean, default=False)
    interview_session_id = Column(String, nullable=True)
    interview_consistency = Column(String, nullable=True)
    requirement_version = Column(String, default="2026-08", nullable=True)
    requirement_version_id = Column(String, nullable=True)
    assigned_officer_id = Column(String, nullable=True, index=True)
    assigned_officer_name = Column(String, nullable=True)
    assigned_officer_username = Column(String, nullable=True, index=True)
    assignment_status = Column(String, default="UNASSIGNED", nullable=True, index=True)  # UNASSIGNED | ASSIGNED | IN_REVIEW | COMPLETED
    assigned_at = Column(DateTime(timezone=True), nullable=True)
    sla_deadline = Column(DateTime(timezone=True), nullable=True, index=True)
    sla_status = Column(String, default="NORMAL", nullable=True)  # NORMAL | APPROACHING_SLA | OVERDUE
    decision_reason_category = Column(String, nullable=True)
    decision_remarks = Column(Text, nullable=True)
    decision_evidence_reviewed = Column(Text, nullable=True)  # JSON list
    decision_certificate_id = Column(String, nullable=True, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)
    resolved_at = Column(DateTime(timezone=True), nullable=True)


class DocumentRecord(Base):
    __tablename__ = "documents"

    id = Column(String, primary_key=True, index=True)
    application_id = Column(String, index=True, nullable=False)
    wallet_doc_id = Column(String, index=True, nullable=True)
    doc_type = Column(String, nullable=False)
    detected_type = Column(String, nullable=True)
    type_confidence = Column(Float, nullable=True)
    type_status = Column(String, nullable=True)  # MATCH | LIKELY_MATCH | UNCERTAIN | MISMATCH
    type_evidence = Column(Text, nullable=True)
    integrity_status = Column(String, default="VALID", nullable=True)
    integrity_details = Column(String, nullable=True)
    qr_status = Column(String, nullable=True)
    original_filename = Column(String, nullable=True)
    ocr_text = Column(Text, nullable=True)
    ocr_confidence = Column(Float, nullable=True)
    official_authenticity_verification = Column(String, default="NOT_PERFORMED", nullable=True)
    authenticity_disclaimer = Column(String, default="Automated pre-verification only. Official authenticity has not been independently verified.", nullable=True)
    is_authentic_verified = Column(Boolean, default=False, nullable=True)
    quality_status = Column(String, default="GOOD", nullable=True)
    quality_score = Column(Float, nullable=True)
    quality_issues = Column(String, nullable=True)
    validity_status = Column(String, default="VALID", nullable=True)
    issue_date = Column(String, nullable=True)
    expiry_date = Column(String, nullable=True)
    validity_evidence = Column(String, nullable=True)
    version = Column(Integer, default=1, nullable=False)
    status = Column(String, default="ACTIVE", nullable=False)  # ACTIVE | ARCHIVED_REPLACED | CORRECTION_REQUESTED
    checksum_sha256 = Column(String, nullable=True, index=True)
    previous_version_id = Column(String, nullable=True)
    uploaded_by = Column(String, nullable=True)
    file_size_bytes = Column(Integer, nullable=True)
    mime_type = Column(String, nullable=True)
    file_path = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class FieldMismatch(Base):
    __tablename__ = "field_mismatches"

    id = Column(String, primary_key=True, index=True)
    application_id = Column(String, index=True, nullable=False)
    field_name = Column(String, nullable=False)
    status = Column(String, nullable=False)  # MATCH | MISMATCH | MISSING | UNCERTAIN | pass | fail
    detail = Column(String, nullable=True)


class AuditEvent(Base):
    __tablename__ = "audit_events"

    id = Column(String, primary_key=True, index=True)
    application_id = Column(String, index=True, nullable=True)
    event_type = Column(String, nullable=False, index=True)
    actor = Column(String, nullable=True)
    actor_role = Column(String, nullable=True, index=True)
    actor_id = Column(String, nullable=True)
    action = Column(String, nullable=True, index=True)
    entity_type = Column(String, nullable=True, index=True)
    entity_id = Column(String, nullable=True, index=True)
    previous_state = Column(String, nullable=True)
    new_state = Column(String, nullable=True)
    reason = Column(Text, nullable=True)
    correlation_id = Column(String, nullable=True)
    detail = Column(Text, nullable=True)
    metadata_json = Column(Text, nullable=True)
    previous_event_hash = Column(String, nullable=True)
    event_hash = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class StaffUser(Base):
    __tablename__ = "staff_users"

    id = Column(String, primary_key=True, index=True)
    username = Column(String, unique=True, nullable=False, index=True)
    password_hash = Column(String, nullable=False)
    display_name = Column(String, nullable=True)
    role = Column(String, nullable=False, default="Officer")
    is_active = Column(Boolean, default=True)
    applications_processed = Column(Integer, default=0)
    last_login = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class ServiceRequirement(Base):
    __tablename__ = "service_requirements"

    id = Column(String, primary_key=True, index=True)
    service_type = Column(String, unique=True, nullable=False, index=True)
    document_types = Column(String, nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class RequiredDocument(Base):
    __tablename__ = "required_documents"

    id = Column(String, primary_key=True, index=True)
    service_type = Column(String, nullable=False, index=True)
    document_type = Column(String, nullable=False)
    label = Column(String, nullable=True)
    rule_type = Column(String, default="ALL_OF", nullable=True)
    allowed_alternatives = Column(String, nullable=True)
    group_key = Column(String, nullable=True)
    is_mandatory = Column(Boolean, default=True, nullable=True)


class ServiceDefinition(Base):
    __tablename__ = "services"

    id = Column(String, primary_key=True, index=True)
    name = Column(String, nullable=False)
    description = Column(Text, nullable=False)
    category = Column(String, default="Certificates", nullable=False, index=True)
    jurisdiction = Column(String, default="State / District Configurable", nullable=True)
    department = Column(String, default="Revenue & District Administration", nullable=True)
    requirement_version = Column(String, default="v1.0-2026", nullable=True)
    effective_from = Column(String, default="2024-01-01", nullable=True)
    source_name = Column(String, default="Configured Template (Local Authority Verification Required)", nullable=True)
    source_url = Column(String, default="https://serviceonline.gov.in", nullable=True)
    source_type = Column(String, default="CONFIGURED_TEMPLATE", nullable=True)
    last_verified_at = Column(String, default="2026-08-01", nullable=True)
    verified_by = Column(String, default="System Administrator", nullable=True)
    verification_status = Column(String, default="CONFIGURED_NOT_VERIFIED", nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    sla_days = Column(Integer, default=7, nullable=True)
    interview_required = Column(Boolean, default=False, nullable=True)
    effective_date = Column(String, nullable=True)
    expiry_date = Column(String, nullable=True)
    eligibility_summary = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class ServiceRequirementItem(Base):
    """
    Detailed government requirement item with structured provenance.
    Directly reflects statutory rules from authoritative ministries and portals.
    """
    __tablename__ = "service_requirement_items"

    id = Column(String, primary_key=True, index=True)
    service_id = Column(String, nullable=False, index=True)
    requirement_id = Column(String, nullable=False, index=True)
    application_type = Column(String, nullable=True)
    applicant_type = Column(String, nullable=True)
    document_category = Column(String, nullable=False)
    document_name = Column(String, nullable=False)
    requirement_type = Column(String, default="Required", nullable=False)  # Required | Conditional | Alternative
    alternative_group = Column(String, nullable=True)
    condition = Column(Text, nullable=True)
    state_specific = Column(String, default="No", nullable=True)
    jurisdiction = Column(String, nullable=True)
    department = Column(String, nullable=True)
    authority = Column(String, nullable=True)
    issuing_authority = Column(String, nullable=True)
    verification_note = Column(Text, nullable=True)
    requirement_version = Column(String, default="2026-08", nullable=True)
    effective_from = Column(String, default="2024-01-01", nullable=True)
    effective_until = Column(String, nullable=True)
    source_name = Column(String, nullable=True)
    source_url = Column(String, nullable=True)
    source_type = Column(String, default="OFFICIAL_GOVERNMENT_PORTAL", nullable=True)
    source_reference = Column(String, nullable=True)
    last_verified_at = Column(String, default="2026-08-24", nullable=True)
    verified_by = Column(String, default="Civic Policy Lead", nullable=True)
    verification_status = Column(String, default="OFFICIAL_VERIFIED", nullable=False)  # OFFICIAL_VERIFIED | CONFIGURED_NOT_VERIFIED | OUTDATED | PENDING_REVIEW
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class EligibilityRule(Base):
    __tablename__ = "eligibility_rules"

    id = Column(String, primary_key=True, index=True)
    service_type = Column(String, nullable=False, index=True)
    criteria_key = Column(String, nullable=False)
    operator = Column(String, default="EQ", nullable=False)
    criteria_value = Column(String, nullable=False)
    label = Column(String, nullable=False)
    guidance_text = Column(Text, nullable=False)
    source_name = Column(String, default="Configured Administrative Rule", nullable=True)
    source_url = Column(String, default="https://serviceonline.gov.in", nullable=True)
    verification_status = Column(String, default="CONFIGURED_NOT_VERIFIED", nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class InterviewSession(Base):
    __tablename__ = "interview_sessions"

    id = Column(String, primary_key=True, index=True)
    application_id = Column(String, index=True, nullable=True)
    citizen_profile_id = Column(String, index=True, nullable=True)
    service_type = Column(String, nullable=True)
    date_of_birth = Column(String, nullable=True)
    status = Column(String, default="INITIATED")  # INITIATED | IN_PROGRESS | COMPLETED | ABANDONED
    total_questions = Column(Integer, default=3)
    current_question_index = Column(Integer, default=0)
    questions_data = Column(Text, nullable=True)  # JSON: list of generated questions and ground truths
    answers_data = Column(Text, nullable=True)    # JSON: list of citizen answers and match evaluations
    overall_consistency = Column(String, default="NOT_EVALUATED")  # CONSISTENT | MINOR_DISCREPANCIES | INCONSISTENT | NOT_EVALUATED
    summary_notes = Column(Text, nullable=True)
    disclaimer = Column(String, default="Automated interview for pre-verification consistency. Final assessment rests with reviewing officers.", nullable=True)
    completed_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class InterviewQuestion(Base):
    __tablename__ = "interview_questions"

    id = Column(String, primary_key=True, index=True)
    session_id = Column(String, nullable=False, index=True)
    category = Column(String, nullable=False)
    question_text = Column(Text, nullable=False)
    expected_field = Column(String, nullable=True)
    expected_value = Column(String, nullable=True)
    order_num = Column(Integer, default=1)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class InterviewAnswer(Base):
    __tablename__ = "interview_answers"

    id = Column(String, primary_key=True, index=True)
    session_id = Column(String, nullable=False, index=True)
    question_id = Column(String, nullable=False, index=True)
    transcript_text = Column(Text, nullable=False)
    extracted_value = Column(String, nullable=True)
    comparison_status = Column(String, nullable=True)
    confidence = Column(Float, nullable=True)
    confidence_score = Column(Float, nullable=True)
    discrepancy_details = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class Notification(Base):
    __tablename__ = "notifications"

    id = Column(String, primary_key=True, index=True)
    recipient = Column(String, nullable=False, index=True)  # citizen | officer | admin
    citizen_profile_id = Column(String, index=True, nullable=True)
    application_id = Column(String, index=True, nullable=True)
    notification_type = Column(String, nullable=False, index=True)  # APPLICATION_SUBMITTED | READY_FOR_REVIEW | etc.
    channel = Column(String, default="IN_APP", nullable=False)  # IN_APP | SMS | EMAIL | WHATSAPP
    title = Column(String, default="Notification", nullable=True)
    message = Column(Text, nullable=False)
    action_link = Column(String, nullable=True)
    is_read = Column(Boolean, default=False)
    status = Column(String, default="CREATED", nullable=False)  # CREATED | QUEUED | SENT | DELIVERED | FAILED | NOT_CONFIGURED | READ
    delivery_channel = Column(String, default="IN_APP", nullable=True)
    delivery_status = Column(String, default="DELIVERED", nullable=True)  # DELIVERED | NOT_CONFIGURED | FAILED | PENDING
    provider_message_id = Column(String, nullable=True)
    idempotency_key = Column(String, nullable=True, index=True)
    metadata_json = Column(Text, nullable=True)
    sent_at = Column(DateTime(timezone=True), nullable=True)
    read_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)


class Feedback(Base):
    __tablename__ = "feedback"

    id = Column(String, primary_key=True, index=True)
    application_id = Column(String, nullable=True, index=True)
    grievance_id = Column(String, nullable=True, index=True)
    citizen_id = Column(String, nullable=True, index=True)
    citizen_name = Column(String, nullable=True)
    rating = Column(Integer, default=5, nullable=True)
    category = Column(String, default="EASE_OF_APPLICATION", nullable=True)
    text = Column(Text, nullable=False)
    sentiment_label = Column(String, nullable=True)
    sentiment_score = Column(Float, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class Grievance(Base):
    """
    Real-World Civic Grievance & Escalation Model.
    Traceable, auditable civic grievance workflow bound to citizen profile and optional application.
    """
    __tablename__ = "grievances"

    id = Column(String, primary_key=True, index=True)
    public_reference = Column(String, unique=True, index=True, nullable=False)  # e.g., SS-GRV-2026-000001
    citizen_id = Column(String, index=True, nullable=False)
    citizen_name = Column(String, nullable=True)
    citizen_email = Column(String, nullable=True)
    application_id = Column(String, index=True, nullable=True)
    service_type = Column(String, nullable=True)
    category = Column(String, nullable=False, index=True)  # APPLICATION_DELAYED, DOCUMENT_REJECTED, etc.
    subject = Column(String, nullable=False)
    description = Column(Text, nullable=False)
    status = Column(String, default="OPEN", nullable=False, index=True)  # OPEN, ACKNOWLEDGED, ASSIGNED, UNDER_REVIEW, AWAITING_CITIZEN, ESCALATED, SENIOR_REVIEW, RESOLVED, CLOSED, REOPENED
    priority = Column(String, default="NORMAL", nullable=False, index=True)  # LOW, NORMAL, HIGH, URGENT
    assigned_officer_id = Column(String, index=True, nullable=True)
    assigned_officer_name = Column(String, nullable=True)
    assigned_at = Column(DateTime(timezone=True), nullable=True)
    attachment_path = Column(String, nullable=True)
    attachment_filename = Column(String, nullable=True)
    attachment_mime = Column(String, nullable=True)
    attachment_size = Column(Integer, nullable=True)
    resolution_notes = Column(Text, nullable=True)
    resolution_category = Column(String, nullable=True)
    escalation_reason = Column(Text, nullable=True)
    reopen_count = Column(Integer, default=0, nullable=False)
    sla_deadline = Column(DateTime(timezone=True), nullable=True, index=True)
    sla_status = Column(String, default="NORMAL", nullable=True)
    resolved_at = Column(DateTime(timezone=True), nullable=True)
    closed_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class GrievanceMessage(Base):
    """
    Message / Interaction history on a grievance.
    Distinguishes public citizen-visible responses from staff-only internal notes.
    """
    __tablename__ = "grievance_messages"

    id = Column(String, primary_key=True, index=True)
    grievance_id = Column(String, index=True, nullable=False)
    sender_type = Column(String, nullable=False)  # citizen | officer | senior_officer | admin
    sender_id = Column(String, nullable=False)
    sender_name = Column(String, nullable=False)
    message_type = Column(String, nullable=False)  # CITIZEN_REPLY | OFFICER_RESPONSE | INFO_REQUEST | INTERNAL_NOTE
    message_text = Column(Text, nullable=False)
    is_internal = Column(Boolean, default=False, nullable=False)  # True for staff internal notes
    attachment_path = Column(String, nullable=True)
    attachment_filename = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class CitizenConsent(Base):
    """
    Structured civic consent and privacy tracking record.
    Tracks explicit citizen authorizations by purpose, policy version, and withdrawal lifecycle.
    """
    __tablename__ = "citizen_consents"

    id = Column(String, primary_key=True, index=True)
    citizen_id = Column(String, index=True, nullable=False)
    purpose = Column(String, nullable=False, index=True)  # APPLICATION_PROCESSING | OCR_PREVERIFICATION | NOTIFICATIONS | ANALYTICS_FEEDBACK
    policy_version = Column(String, default="2026.1", nullable=False)
    is_granted = Column(Boolean, default=True, nullable=False)
    status = Column(String, default="ACTIVE", nullable=False, index=True)  # ACTIVE | WITHDRAWN
    withdrawn_at = Column(DateTime(timezone=True), nullable=True)
    metadata_json = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

