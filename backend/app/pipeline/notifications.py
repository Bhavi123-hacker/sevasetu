"""
Multi-Channel Notification Dispatcher for SevaSetu.
Persists in-app notifications directly in the database.
Integrates with Resend Email and NotificationService provider abstraction.
Respects citizen notification preferences and provides standardized civic lifecycle message templates.
"""
import json
import uuid
from datetime import datetime, timezone
from typing import Optional, Dict, Any, List
from sqlalchemy.orm import Session
from sqlalchemy import func
from ..models import Notification, CitizenProfile
from .notification_providers import notification_service

DEFAULT_NOTIFICATION_PREFERENCES = {
    "application_updates": True,
    "correction_requests": True,
    "decision_alerts": True,
    "interview_reminders": True,
    "security_alerts": True,  # Mandatory
    "sms_enabled": False,
    "email_enabled": True,    # Transactional status emails enabled by default
    "whatsapp_enabled": False,
}


def get_citizen_preferences(db: Session, citizen_profile_id: Optional[str]) -> Dict[str, Any]:
    """Retrieves and normalizes citizen notification preferences."""
    prefs = dict(DEFAULT_NOTIFICATION_PREFERENCES)
    if citizen_profile_id:
        profile = db.query(CitizenProfile).filter(CitizenProfile.id == citizen_profile_id).first()
        if profile and profile.notification_preferences:
            try:
                custom = json.loads(profile.notification_preferences)
                if isinstance(custom, dict):
                    prefs.update(custom)
            except Exception:
                pass
    # Enforce mandatory security notifications
    prefs["security_alerts"] = True
    return prefs


def is_notification_permitted(prefs: Dict[str, Any], notification_type: str, channel: str) -> bool:
    """Checks if a notification is permitted according to preferences."""
    # In-app notifications are always enabled
    if channel.upper() == "IN_APP":
        return True

    # Security events are mandatory on all channels if recipient phone/email exists
    if notification_type in ["SECURITY_EVENT", "PHONE_VERIFIED"]:
        return True

    # Check category preference
    if notification_type in ["APPLICATION_SUBMITTED", "PROCESSING_STARTED", "READY_FOR_REVIEW", "RESUBMISSION_RECEIVED", "OFFICER_REVIEW_STARTED"]:
        if not prefs.get("application_updates", True):
            return False
    elif notification_type == "CORRECTION_REQUESTED":
        if not prefs.get("correction_requests", True):
            return False
    elif notification_type in ["APPLICATION_APPROVED", "APPLICATION_REJECTED"]:
        if not prefs.get("decision_alerts", True):
            return False
    elif notification_type in ["INTERVIEW_AVAILABLE", "DOCUMENT_REVIEW_PASSED", "INTERVIEW_COMPLETED", "FINAL_OFFICER_REVIEW"]:
        if not prefs.get("interview_reminders", True):
            return False

    # Check external channel enable flag
    ch = channel.upper()
    if ch == "SMS" and not prefs.get("sms_enabled", False):
        return False
    if ch == "EMAIL" and not prefs.get("email_enabled", True):
        return False
    if ch == "WHATSAPP" and not prefs.get("whatsapp_enabled", False):
        return False

    return True


def create_notification(
    db: Session,
    recipient: str,
    notification_type: str,
    title: str,
    message: str,
    application_id: Optional[str] = None,
    citizen_profile_id: Optional[str] = None,
    action_link: Optional[str] = None,
    channel: str = "IN_APP",
    destination: Optional[str] = None,
    metadata: Optional[Dict[str, Any]] = None,
    idempotency_key: Optional[str] = None,
) -> Notification:
    """
    Creates and commits a real notification record in the database with idempotency check.
    Dispatches via provider abstraction if external channel is specified.
    """
    if idempotency_key:
        existing = db.query(Notification).filter(Notification.idempotency_key == idempotency_key).first()
        if existing:
            return existing

    prov_res = notification_service.dispatch(
        destination=destination,
        title=title,
        message=message,
        channel=channel,
        metadata=metadata,
    )

    notif_id = f"notif-{uuid.uuid4().hex[:12]}"
    now = datetime.now(timezone.utc)
    meta_json = json.dumps(metadata) if metadata else None

    notif = Notification(
        id=notif_id,
        application_id=application_id,
        citizen_profile_id=citizen_profile_id,
        recipient=recipient,
        notification_type=notification_type,
        title=title,
        message=message,
        channel=channel.upper(),
        delivery_channel=channel.upper(),
        status=prov_res.status,
        delivery_status=prov_res.status,
        provider_message_id=prov_res.provider_message_id,
        idempotency_key=idempotency_key,
        metadata_json=meta_json,
        is_read=False,
        action_link=action_link,
        created_at=now,
        sent_at=now if prov_res.is_delivered else None,
    )
    db.add(notif)
    db.commit()
    db.refresh(notif)
    return notif


def trigger_lifecycle_notification(
    db: Session,
    notification_type: str,
    application_id: Optional[str],
    service_type: Optional[str] = None,
    citizen_profile_id: Optional[str] = None,
    extra_details: Optional[Dict[str, Any]] = None,
    phone_destination: Optional[str] = None,
    email_destination: Optional[str] = None,
) -> Notification:
    """
    Standardized, idempotent generator for civic service lifecycle notifications.
    Formats title, actionable messages, and next steps per statutory requirements.
    Dispatches in-app notifications and transactional emails via Resend.
    """
    extra = dict(extra_details or {})
    srv_label = (service_type or "Civic Service").replace("_", " ").title()
    app_ref = application_id or "General"
    action_link = f"/status?id={application_id}" if application_id else "/status"

    citizen_name = extra.get("citizen_name", "Citizen")
    citizen_email = email_destination

    if citizen_profile_id and (citizen_name == "Citizen" or not citizen_email):
        profile = db.query(CitizenProfile).filter(CitizenProfile.id == citizen_profile_id).first()
        if profile:
            if citizen_name == "Citizen" and profile.citizen_name:
                citizen_name = profile.citizen_name
            if not citizen_email and profile.email:
                citizen_email = profile.email

    extra["citizen_name"] = citizen_name
    extra["application_id"] = app_ref
    extra["action_url"] = f"http://localhost:3000{action_link}"

    # Message templates
    if notification_type == "APPLICATION_SUBMITTED":
        title = "Application Submitted Successfully"
        message = (
            f"Your application for {srv_label} (Ref: {app_ref}) has been received and queued for statutory processing."
        )
    elif notification_type == "PROCESSING_STARTED":
        title = "Automated Verification In Progress"
        message = (
            f"Automated pre-verification and document consistency checks have commenced for application {app_ref}."
        )
    elif notification_type == "READY_FOR_REVIEW":
        title = "Application Ready for Officer Review"
        message = (
            f"Your application for {srv_label} (Ref: {app_ref}) has satisfied preliminary checks and is waiting for statutory officer inspection."
        )
    elif notification_type == "CORRECTION_REQUESTED":
        title = "Action Required: Document Correction"
        reason = extra.get("reason", "Document mismatch or quality issue")
        details = extra.get("details", "Please review the flagged requirement.")
        message = (
            f"Action Required for {srv_label} (Ref: {app_ref}):\n"
            f"• Issue: {reason}\n"
            f"• Details: {details}\n"
            f"• Action: Upload the required replacement document.\n"
            f"• Next Step: Your application will be re-queued immediately upon resubmission."
        )
        action_link = f"/status?id={application_id}"
    elif notification_type == "RESUBMISSION_RECEIVED":
        title = "Replacement Documents Received"
        message = (
            f"Your corrected documents for {srv_label} (Ref: {app_ref}) have been received and re-evaluated for officer review."
        )
    elif notification_type == "OFFICER_REVIEW_STARTED":
        title = "Statutory Officer Review in Progress"
        officer = extra.get("officer_name", "Designated Officer")
        message = (
            f"Application {app_ref} is currently under statutory review by {officer}."
        )
    elif notification_type == "APPLICATION_APPROVED":
        title = "Application Approved"
        officer = extra.get("resolved_by", "Authorized Officer")
        message = (
            f"Your application for {srv_label} (Ref: {app_ref}) has been approved by the authorized officer ({officer}). "
            f"Please follow the configured next steps for statutory certificate issuance or collection."
        )
    elif notification_type == "APPLICATION_REJECTED":
        title = "Application Decision: Not Approved"
        reason = extra.get("reason", "Statutory eligibility criteria were not met.")
        message = (
            f"Your application for {srv_label} (Ref: {app_ref}) was not approved.\n"
            f"Statutory Reason: {reason}\n"
            f"You may review the decision summary or submit a revised application."
        )
    elif notification_type in ["INTERVIEW_AVAILABLE", "DOCUMENT_REVIEW_PASSED"]:
        title = "Verification Interview Available"
        message = (
            f"An authorized officer has reviewed your documents for {srv_label} (Ref: {app_ref}). "
            f"Your verification interview is now available."
        )
        action_link = f"/status?id={application_id}" if application_id else "/status"
    elif notification_type in ["INTERVIEW_COMPLETED", "FINAL_OFFICER_REVIEW"]:
        title = "Verification Interview Completed"
        message = (
            f"Your verification interview for {srv_label} (Ref: {app_ref}) has been completed "
            f"and your application is now awaiting final officer review."
        )
        action_link = f"/status?id={application_id}" if application_id else "/status"
    elif notification_type == "PHONE_VERIFIED":
        title = "Mobile Number Verified"
        masked = extra.get("phone_masked", "your number")
        message = (
            f"Mobile number {masked} has been successfully verified for secure civic communications."
        )
        action_link = "/profile"
    elif notification_type == "SECURITY_EVENT":
        title = "Security Alert: Profile Contact Changed"
        message = (
            f"The verified contact details on your citizen profile were recently updated. "
            f"If you did not make this change, please inspect your profile immediately."
        )
        action_link = "/profile"
    else:
        title = extra.get("title", "Application Update")
        message = extra.get("message", f"Update for application {app_ref}.")

    # 1. In-App notification (always persisted)
    in_app_key = f"lifecycle:{application_id or citizen_profile_id}:{notification_type}:IN_APP"
    notif = create_notification(
        db=db,
        recipient="citizen",
        notification_type=notification_type,
        title=title,
        message=message,
        application_id=application_id,
        citizen_profile_id=citizen_profile_id,
        action_link=action_link,
        channel="IN_APP",
        metadata=extra,
        idempotency_key=in_app_key,
    )

    # 2. Transactional Email notification via Resend (if citizen email is available)
    prefs = get_citizen_preferences(db, citizen_profile_id)
    if citizen_email and is_notification_permitted(prefs, notification_type, "EMAIL"):
        try:
            email_key = f"lifecycle:{application_id or citizen_profile_id}:{notification_type}:EMAIL"
            create_notification(
                db=db,
                recipient="citizen",
                notification_type=notification_type,
                title=title,
                message=message,
                application_id=application_id,
                citizen_profile_id=citizen_profile_id,
                action_link=action_link,
                channel="EMAIL",
                destination=citizen_email,
                metadata=extra,
                idempotency_key=email_key,
            )
        except Exception as exc:
            pass  # Non-blocking

    # 3. Optional SMS dispatch if phone destination is given
    if phone_destination and is_notification_permitted(prefs, notification_type, "SMS"):
        try:
            sms_key = f"lifecycle:{application_id or citizen_profile_id}:{notification_type}:SMS"
            create_notification(
                db=db,
                recipient="citizen",
                notification_type=notification_type,
                title=title,
                message=message,
                application_id=application_id,
                citizen_profile_id=citizen_profile_id,
                action_link=action_link,
                channel="SMS",
                destination=phone_destination,
                metadata=extra,
                idempotency_key=sms_key,
            )
        except Exception:
            pass

    return notif


def list_notifications(
    db: Session,
    recipient: Optional[str] = None,
    citizen_profile_id: Optional[str] = None,
    limit: int = 50,
) -> List[Notification]:
    """Lists notifications ordered by creation time descending."""
    query = db.query(Notification)
    if recipient:
        query = query.filter(Notification.recipient == recipient)
    if citizen_profile_id:
        query = query.filter(Notification.citizen_profile_id == citizen_profile_id)
    return query.order_by(Notification.created_at.desc()).limit(limit).all()


def get_unread_count(
    db: Session,
    recipient: Optional[str] = "citizen",
    citizen_profile_id: Optional[str] = None,
) -> int:
    """Returns count of unread notifications."""
    query = db.query(func.count(Notification.id)).filter(Notification.is_read == False)
    if recipient:
        query = query.filter(Notification.recipient == recipient)
    if citizen_profile_id:
        query = query.filter(Notification.citizen_profile_id == citizen_profile_id)
    return query.scalar() or 0


def mark_notification_read(db: Session, notification_id: str) -> bool:
    """Marks a single notification as read."""
    notif = db.query(Notification).filter(Notification.id == notification_id).first()
    if notif:
        notif.is_read = True
        notif.read_at = datetime.now(timezone.utc)
        db.commit()
        return True
    return False


def mark_all_notifications_read(
    db: Session,
    recipient: Optional[str] = "citizen",
    citizen_profile_id: Optional[str] = None,
) -> int:
    """Marks all matching notifications as read."""
    query = db.query(Notification).filter(Notification.is_read == False)
    if recipient:
        query = query.filter(Notification.recipient == recipient)
    if citizen_profile_id:
        query = query.filter(Notification.citizen_profile_id == citizen_profile_id)

    now = datetime.now(timezone.utc)
    count = query.update({"is_read": True, "read_at": now})
    db.commit()
    return count
