"""
Data Retention & Privacy Engine.

Implements configurable document and application data lifecycle management:
- DOCUMENT_RETENTION_DAYS (default: 90 days)
- APPLICATION_RETENTION_DAYS (default: 365 days)

CRITICAL:
Does NOT delete immutable statutory audit evidence when document payloads expire.
Maintains separate lifecycles for:
1. Raw document text & original filenames (purged after retention window)
2. Application metadata (retained per statutory archive rules)
3. AuditEvent hash-chain records (strictly immutable, NEVER deleted)
"""
import os
import logging
from datetime import datetime, timedelta, timezone
from typing import Dict, List, Optional
from sqlalchemy.orm import Session

from .. import models

logger = logging.getLogger("sevasetu.retention")

DOCUMENT_RETENTION_DAYS = int(os.environ.get("DOCUMENT_RETENTION_DAYS", "90"))
APPLICATION_RETENTION_DAYS = int(os.environ.get("APPLICATION_RETENTION_DAYS", "365"))


def run_retention_cleanup(db: Session, dry_run: bool = True) -> Dict:
    """
    Identifies and safely purges expired document text / records past retention threshold.
    """
    now = datetime.now(timezone.utc)
    doc_cutoff = now - timedelta(days=DOCUMENT_RETENTION_DAYS)
    app_cutoff = now - timedelta(days=APPLICATION_RETENTION_DAYS)

    # Find documents eligible for text/payload redaction
    expired_docs = db.query(models.DocumentRecord).join(
        models.Application, models.DocumentRecord.application_id == models.Application.id
    ).filter(
        models.Application.created_at < doc_cutoff,
        models.DocumentRecord.ocr_text.isnot(None),
    ).all()

    # Find resolved applications eligible for retention status archiving
    archivable_apps = db.query(models.Application).filter(
        models.Application.resolved_at.isnot(None),
        models.Application.resolved_at < app_cutoff,
    ).all()

    summary = {
        "dry_run": dry_run,
        "document_retention_days": DOCUMENT_RETENTION_DAYS,
        "application_retention_days": APPLICATION_RETENTION_DAYS,
        "expired_documents_found": len(expired_docs),
        "archivable_applications_found": len(archivable_apps),
        "documents_purged": 0,
        "applications_archived": 0,
        "executed_at": now.isoformat(),
    }

    if dry_run:
        return summary

    purged_count = 0
    for doc in expired_docs:
        # Redact raw OCR text and PII filename while preserving metadata for audit consistency
        doc.ocr_text = "[REDACTED_DUE_TO_RETENTION_POLICY]"
        doc.original_filename = "[PURGED]"
        purged_count += 1

    db.commit()
    summary["documents_purged"] = purged_count
    logger.info("retention_cleanup_executed", extra=summary)
    return summary
