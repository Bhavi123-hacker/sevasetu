"""
Document Integrity & Authenticity Risk Assessment Layer.

Performs local structural, machine-readable, and cross-consistency integrity checks
on uploaded documents. Assigns a transparent statutory risk level (LOW | MEDIUM | HIGH)
with explainable detected signals.

CRITICAL CIVIC PRINCIPLE:
Never claims that the AI mathematically proves a document is genuine or fraudulent.
Final statutory decision rests exclusively with the authorized officer.
"""
import io
import re
from dataclasses import dataclass, field
from typing import List, Optional, Tuple, Dict, Any
from PIL import Image

MAGIC_BYTES = {
    "pdf": b"%PDF-",
    "png": b"\x89PNG\r\n\x1a\n",
    "jpg": b"\xff\xd8\xff",
    "webp": b"RIFF",
}


@dataclass
class DocumentIntegrityResult:
    status: str  # "VALID" | "INTEGRITY_WARNING" | "SUSPICIOUS"
    warnings: List[str] = field(default_factory=list)
    has_qr: bool = False
    qr_status: Optional[str] = None  # "CONSISTENT" | "DATA_CONFLICT" | "NOT_DETECTED"
    qr_details: Optional[str] = None


@dataclass
class AuthenticitySignal:
    name: str
    severity: str  # "LOW" | "MEDIUM" | "HIGH"
    description: str


@dataclass
class DocumentAuthenticityAssessment:
    risk_level: str  # "LOW" | "MEDIUM" | "HIGH"
    risk_score: int  # 0 to 100 (0 = cleanest / lowest risk, 100 = highest risk)
    detected_signals: List[Dict[str, str]] = field(default_factory=list)
    average_ocr_confidence: float = 0.0
    recommendation: str = "No significant authenticity risk indicators detected."
    disclaimer: str = (
        "This is an AI-assisted authenticity risk assessment, not definitive proof of document genuineness. "
        "Final statutory decision rests exclusively with the authorized officer."
    )


def validate_file_magic_bytes(raw_bytes: bytes, filename: Optional[str] = None) -> Tuple[bool, str]:
    """Validates that the file header matches allowed civic document formats."""
    if not raw_bytes or len(raw_bytes) < 4:
        return False, "File is empty or too short."

    # Check magic signatures
    if raw_bytes.startswith(b"%PDF-"):
        return True, "PDF"
    if raw_bytes.startswith(b"\x89PNG\r\n\x1a\n") or raw_bytes.startswith(b"\x89PNG"):
        return True, "PNG"
    if raw_bytes.startswith(b"\xff\xd8\xff"):
        return True, "JPEG"
    if raw_bytes.startswith(b"RIFF") and len(raw_bytes) >= 12 and raw_bytes[8:12] == b"WEBP":
        return True, "WEBP"
    if raw_bytes.startswith(b"BM"):
        return True, "BMP"
    if raw_bytes.startswith(b"II*\x00") or raw_bytes.startswith(b"MM\x00*"):
        return True, "TIFF"

    return False, "Unrecognized file format or invalid magic bytes."


def sanitize_filename(filename: Optional[str]) -> str:
    """Sanitizes user-provided filename to prevent path traversal or injection."""
    if not filename:
        return "unnamed_document"
    clean = filename.replace("\\", "/").split("/")[-1]
    clean = re.sub(r"[^a-zA-Z0-9._-]", "_", clean)
    return clean[:100] if clean else "document"


def assess_document_integrity(raw_bytes: bytes, ocr_text: str = "", filename: Optional[str] = None) -> DocumentIntegrityResult:
    """
    Performs structural anomaly checks on the uploaded document bytes.
    """
    warnings = []
    status = "VALID"
    has_qr = False
    qr_status = "NOT_DETECTED"
    qr_details = None

    valid_magic, detected_format = validate_file_magic_bytes(raw_bytes, filename)
    if not valid_magic:
        warnings.append(f"Header verification: {detected_format}")
        status = "SUSPICIOUS"

    # Check for suspicious embedded script tags in raw text/PDF stream
    lower_bytes = raw_bytes[:4096].lower()
    if b"/javascript" in lower_bytes or b"/js" in lower_bytes or b"<script" in lower_bytes:
        warnings.append("Integrity warning: Document contains executable script directives.")
        status = "SUSPICIOUS"

    # Check for empty text or unusually low byte size
    if len(raw_bytes) < 300:
        warnings.append("Integrity warning: Document payload size is abnormally small.")
        if status != "SUSPICIOUS":
            status = "INTEGRITY_WARNING"

    # Machine-readable pattern detection in OCR text
    qr_match = re.search(r"(?:qr\s*code|scan\s*qr|uidai\s*secure\s*qr|digital\s*signature|digitally\s*signed)", ocr_text, re.IGNORECASE)
    if qr_match:
        has_qr = True
        qr_status = "CONSISTENT"
        qr_details = "Digital QR / Signature reference present in document."

    return DocumentIntegrityResult(
        status=status,
        warnings=warnings,
        has_qr=has_qr,
        qr_status=qr_status,
        qr_details=qr_details,
    )


def assess_document_authenticity_risk(
    doc_verifications: Optional[List[Any]] = None,
    field_checks: Optional[List[Any]] = None,
    quality_results: Optional[List[Any]] = None,
    integrity_results: Optional[List[Any]] = None,
    duplicate_suspected: bool = False,
    average_ocr_confidence: float = 85.0,
) -> DocumentAuthenticityAssessment:
    """
    Computes a comprehensive Document Authenticity Risk Assessment based on
    multi-signal pipeline analysis (OCR quality, text consistency, field verification,
    structural integrity, and duplicate detection).
    """
    signals: List[Dict[str, str]] = []
    risk_score = 0

    # 1. OCR Confidence Abnormality
    if average_ocr_confidence < 60.0:
        signals.append({
            "name": "OCR Extraction Confidence Abnormality",
            "severity": "MEDIUM",
            "description": f"Average text recognition confidence is {average_ocr_confidence:.1f}%, indicating degraded or altered text readability.",
        })
        risk_score += 25
    elif average_ocr_confidence < 75.0:
        signals.append({
            "name": "Low OCR Text Density",
            "severity": "LOW",
            "description": f"Text clarity score ({average_ocr_confidence:.1f}%) suggests possible scan distortion.",
        })
        risk_score += 10

    # 2. Document Quality / Scan Clarity
    if quality_results:
        for q in quality_results:
            q_status = getattr(q, "status", None)
            if q_status == "UNREADABLE":
                signals.append({
                    "name": "Unreadable / Blurry Document Scan",
                    "severity": "HIGH",
                    "description": "Document image resolution or blurriness prevents reliable automated inspection.",
                })
                risk_score += 35
                break
            elif q_status in ["POOR", "UNCERTAIN"]:
                signals.append({
                    "name": "Low Document Sharpness",
                    "severity": "MEDIUM",
                    "description": "Image quality is suboptimal for automated tamper verification.",
                })
                risk_score += 15
                break

    # 3. Document Slot / Type Mismatch
    if doc_verifications:
        for v in doc_verifications:
            v_status = getattr(v, "status", None)
            if v_status == "MISMATCH":
                expected = getattr(v, "expected_type", "document").replace("_", " ").title()
                detected = getattr(v, "detected_type", "unrecognized").replace("_", " ").title()
                signals.append({
                    "name": "Document Classification Mismatch",
                    "severity": "HIGH",
                    "description": f"Uploaded document in {expected} slot appears to be a {detected}.",
                })
                risk_score += 35
            elif v_status == "UNCERTAIN":
                signals.append({
                    "name": "Uncertain Document Type Classification",
                    "severity": "MEDIUM",
                    "description": "Uploaded document format does not conclusively match statutory layout criteria.",
                })
                risk_score += 15

    # 4. Identity & Factual Discrepancies Across Records
    if field_checks:
        for c in field_checks:
            if getattr(c, "status", None) == "fail":
                field_name = getattr(c, "field", "record").replace("_", " ").title()
                if getattr(c, "field", None) == "date_of_birth":
                    signals.append({
                        "name": "Date of Birth Conflict Across Records",
                        "severity": "HIGH",
                        "description": "Date of Birth differs between submitted identity proofs and applicant profile.",
                    })
                    risk_score += 30
                elif getattr(c, "field", None) == "name":
                    signals.append({
                        "name": "Applicant Name Discrepancy",
                        "severity": "MEDIUM",
                        "description": "Spelling variation or partial name mismatch identified across documents.",
                    })
                    risk_score += 20
                else:
                    signals.append({
                        "name": f"{field_name} Discrepancy",
                        "severity": "LOW",
                        "description": f"{field_name} differs between submitted certificates.",
                    })
                    risk_score += 10

    # 5. Structural File Integrity Anomalies
    if integrity_results:
        for r in integrity_results:
            if getattr(r, "status", None) == "SUSPICIOUS":
                signals.append({
                    "name": "Suspicious Payload Structure",
                    "severity": "HIGH",
                    "description": "File header or embedded payload contains anomalous formatting or script directives.",
                })
                risk_score += 40
                break
            elif getattr(r, "status", None) == "INTEGRITY_WARNING":
                signals.append({
                    "name": "Structural Integrity Warning",
                    "severity": "LOW",
                    "description": "File size or structural header is unusual for a civic certificate.",
                })
                risk_score += 10
                break

    # 6. Duplicate Submission
    if duplicate_suspected:
        signals.append({
            "name": "Duplicate Application Submission",
            "severity": "HIGH",
            "description": "Identical document hashes match an existing application in the registry.",
        })
        risk_score += 30

    risk_score = min(risk_score, 100)

    # Determine overall risk level
    if risk_score >= 40 or any(s["severity"] == "HIGH" for s in signals):
        risk_level = "HIGH"
        recommendation = "Document requires officer verification."
    elif risk_score >= 15 or any(s["severity"] == "MEDIUM" for s in signals):
        risk_level = "MEDIUM"
        recommendation = "Potential inconsistency detected. Officer review recommended."
    else:
        risk_level = "LOW"
        recommendation = "No significant authenticity risk indicators detected."

    return DocumentAuthenticityAssessment(
        risk_level=risk_level,
        risk_score=risk_score,
        detected_signals=signals,
        average_ocr_confidence=round(average_ocr_confidence, 1),
        recommendation=recommendation,
    )
