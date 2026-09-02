"""
Government Authenticity Verification Provider Architecture.
Provides an extensible adapter layer for external authorized government verification sources.

NON-NEGOTIABLE PRINCIPLE:
Never simulate or claim official authenticity when no authorized external provider is connected.
Default behavior: Return OFFICIAL_VERIFICATION_UNAVAILABLE.
"""
from abc import ABC, abstractmethod
from typing import Dict, Any, Optional
from pydantic import BaseModel


class VerificationResult(BaseModel):
    provider_name: str
    status: str  # OFFICIAL_VERIFIED | OFFICIAL_VERIFICATION_FAILED | OFFICIAL_VERIFICATION_UNAVAILABLE | NOT_PERFORMED
    is_officially_verified: bool
    reference_id: Optional[str] = None
    verification_timestamp: Optional[str] = None
    disclaimer: str = (
        "Automated pre-verification only. Official authenticity has not been independently verified. "
        "SevaSetu is not itself a government authority."
    )
    details: Optional[str] = None


class GovernmentVerificationProvider(ABC):
    """Abstract base class for authorized external government verification providers."""

    @abstractmethod
    def get_provider_name(self) -> str:
        pass

    @abstractmethod
    def is_configured(self) -> bool:
        pass

    @abstractmethod
    def verify_document(
        self,
        doc_type: str,
        ocr_text: str,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> VerificationResult:
        pass


class DefaultUnavailableVerificationProvider(GovernmentVerificationProvider):
    """
    Standard default provider when no external government credentials / MOUs are active.
    Transparently reports OFFICIAL_VERIFICATION_UNAVAILABLE.
    """

    def get_provider_name(self) -> str:
        return "Internal Pre-Verification Adapter (No External Gateway Connected)"

    def is_configured(self) -> bool:
        return False

    def verify_document(
        self,
        doc_type: str,
        ocr_text: str,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> VerificationResult:
        return VerificationResult(
            provider_name=self.get_provider_name(),
            status="OFFICIAL_VERIFICATION_UNAVAILABLE",
            is_officially_verified=False,
            details="External government authenticity gateway is not configured in this deployment.",
        )


def get_active_verification_provider() -> GovernmentVerificationProvider:
    """Factory returning the active government verification adapter."""
    # In production/MVP without live government gateway credentials, return the honest unavailable adapter
    return DefaultUnavailableVerificationProvider()
