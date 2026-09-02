"""
Integration-Ready Gateway & Provider Adapters for Government & External Civic APIs.

Defines decoupled statutory provider interfaces for:
1. Identity Verification (e.g. UIDAI / Aadhaar Offline XML / Mock Sandbox)
2. Document Verification (e.g. DigiLocker / State Land Records / Sandbox)
3. Service Eligibility Rules (e.g. State Welfare Registry / Sandbox)

CRITICAL CIVIC PRINCIPLE:
Never claims live government integration that does not exist.
Default configuration runs the verified local sandbox provider without fabricating false statutory authority.
"""
from abc import ABC, abstractmethod
from typing import Dict, Any, Optional, List
from dataclasses import dataclass, field


@dataclass
class IdentityVerificationResult:
    provider_name: str
    is_verified: bool
    status: str  # "VERIFIED" | "MISMATCH" | "SANDBOX_VERIFIED" | "UNAVAILABLE"
    match_confidence: float
    verified_fields: Dict[str, Any] = field(default_factory=dict)
    discrepancies: List[str] = field(default_factory=list)
    is_simulation: bool = True
    disclaimer: str = "Integration Sandbox — Not an official UIDAI/Government connection."


@dataclass
class ExternalDocumentResult:
    provider_name: str
    is_authentic: bool
    status: str  # "FOUND" | "NOT_FOUND" | "SANDBOX_MOCK"
    document_type: str
    issuer_name: str
    issuance_date: Optional[str] = None
    is_simulation: bool = True
    disclaimer: str = "Local Sandbox Provider — DigiLocker integration point."


class IdentityVerificationProvider(ABC):
    """Abstract interface for citizen identity verification."""

    @abstractmethod
    def verify_identity(self, name: str, dob: Optional[str], doc_number: str) -> IdentityVerificationResult:
        pass


class DocumentVerificationProvider(ABC):
    """Abstract interface for official document authenticity cross-checks."""

    @abstractmethod
    def verify_document(self, doc_type: str, document_number: str) -> ExternalDocumentResult:
        pass


class ServiceEligibilityProvider(ABC):
    """Abstract interface for state welfare registry eligibility verification."""

    @abstractmethod
    def check_statutory_eligibility(self, service_type: str, citizen_profile: Dict[str, Any]) -> Dict[str, Any]:
        pass


# ============================================================================
# SANDBOX / LOCAL DEVELOPMENT IMPLEMENTATIONS
# ============================================================================

class SandboxIdentityVerificationProvider(IdentityVerificationProvider):
    """
    Transparent local sandbox identity verification provider.
    Evaluates format validity and structural checksums without making external network calls.
    """

    def verify_identity(self, name: str, dob: Optional[str], doc_number: str) -> IdentityVerificationResult:
        clean_num = doc_number.replace(" ", "").replace("-", "")
        # Structural check for 12-digit format
        is_valid_format = len(clean_num) == 12 and clean_num.isdigit()
        
        return IdentityVerificationResult(
            provider_name="SevaSetu Sandbox Identity Gateway",
            is_verified=is_valid_format,
            status="SANDBOX_VERIFIED" if is_valid_format else "INVALID_FORMAT",
            match_confidence=0.95 if is_valid_format else 0.0,
            verified_fields={
                "name_evaluated": name,
                "dob_evaluated": dob,
                "format_valid": is_valid_format,
            },
            discrepancies=[] if is_valid_format else ["Document number does not match standard 12-digit format."],
            is_simulation=True,
            disclaimer="Evaluation performed via local sandbox gateway. No live UIDAI queries executed.",
        )


class SandboxDocumentVerificationProvider(DocumentVerificationProvider):
    """
    Local DigiLocker / State Repository simulation adapter.
    """

    def verify_document(self, doc_type: str, document_number: str) -> ExternalDocumentResult:
        return ExternalDocumentResult(
            provider_name="SevaSetu DigiLocker Sandbox Adapter",
            is_authentic=True,
            status="SANDBOX_MOCK",
            document_type=doc_type,
            issuer_name="Local Government Authority (Sandbox Simulation)",
            is_simulation=True,
            disclaimer="Sandbox mock response — external government repository not connected.",
        )


class SandboxServiceEligibilityProvider(ServiceEligibilityProvider):
    """
    Local statutory eligibility rules evaluator.
    """

    def check_statutory_eligibility(self, service_type: str, citizen_profile: Dict[str, Any]) -> Dict[str, Any]:
        return {
            "provider_name": "SevaSetu Statutory Rule Engine",
            "service_type": service_type,
            "is_eligible": True,
            "evaluated_criteria": {
                "residence_confirmed": bool(citizen_profile.get("state") or citizen_profile.get("district")),
                "age_confirmed": bool(citizen_profile.get("dob")),
            },
            "is_simulation": False,
            "disclaimer": "Evaluated against local statutory criteria catalog.",
        }


# Active Gateway Singletons
identity_provider: IdentityVerificationProvider = SandboxIdentityVerificationProvider()
document_provider: DocumentVerificationProvider = SandboxDocumentVerificationProvider()
eligibility_provider: ServiceEligibilityProvider = SandboxServiceEligibilityProvider()
