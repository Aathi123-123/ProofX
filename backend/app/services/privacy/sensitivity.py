"""
PSDE – Sensitivity Classification Engine

Deterministic scoring model for evidence sensitivity.

Scoring Formula (documented):
sensitivity_score = clamp(Σ(weight_i × factor_i), 0, 100)

Factors:
  F1: PII count              → +5 per PII finding, max 40
  F2: High-risk PII type     → +15 per HIGH_RISK type found
  F3: Secret/credential      → +20 if secret detected
  F4: Financial data         → +15 if CREDIT_CARD or IBAN found
  F5: Authentication data    → +15 if PASSWORD or API_KEY found
  F6: Location data          → +10 if GEO_COORDINATES found
  F7: Communications content → +10 if EMAIL with count > 2
  F8: File type bonus        → varies by MIME type
  F9: Metadata sensitivity   → +5 if metadata contains PII

Score → Sensitivity Level:
  0–20   → PUBLIC
  21–40  → LOW
  41–60  → MEDIUM
  61–80  → HIGH
  81–100 → CRITICAL

Weights are configurable. Formula is transparent and documented.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

from app.services.privacy.pii_detector import PIIFinding, PIIType
from app.models.models import EvidenceSensitivity


# ── HIGH RISK PII TYPES ───────────────────────────────────────────────────────

HIGH_RISK_PII_TYPES = {
    PIIType.SSN,
    PIIType.CREDIT_CARD,
    PIIType.IBAN,
    PIIType.PASSWORD,
    PIIType.API_KEY,
    PIIType.JWT_TOKEN,
    PIIType.CRYPTO_ADDRESS,
}

CREDENTIAL_TYPES = {PIIType.PASSWORD, PIIType.API_KEY, PIIType.JWT_TOKEN}
FINANCIAL_TYPES = {PIIType.CREDIT_CARD, PIIType.IBAN, PIIType.CRYPTO_ADDRESS}
AUTH_TYPES = {PIIType.PASSWORD, PIIType.API_KEY}
LOCATION_TYPES = {PIIType.GEO_COORDINATES}


# ── Configurable Weights ─────────────────────────────────────────────────────

@dataclass
class SensitivityWeights:
    """Configurable scoring weights. Change these to tune the model."""
    pii_per_finding: float = 5.0
    pii_count_max: float = 40.0
    high_risk_per_type: float = 15.0
    secret_bonus: float = 20.0
    financial_bonus: float = 15.0
    auth_bonus: float = 15.0
    location_bonus: float = 10.0
    communications_bonus: float = 10.0
    metadata_pii_bonus: float = 5.0
    # File type modifiers
    file_type_weights: dict[str, float] = field(default_factory=lambda: {
        "application/pdf": 5.0,
        "image/jpeg": 3.0,
        "image/png": 3.0,
        "application/zip": 8.0,
        "application/json": 5.0,
        "text/csv": 5.0,
    })


# ── Classification Result ─────────────────────────────────────────────────────

@dataclass
class SensitivityResult:
    score: float
    level: str
    reason: str
    factor_breakdown: dict[str, float]


# ── Sensitivity Classifier ────────────────────────────────────────────────────

class SensitivityClassifier:
    """
    Deterministic sensitivity classifier.
    All scoring logic is transparent and documented.
    """

    def __init__(self, weights: SensitivityWeights | None = None):
        self.weights = weights or SensitivityWeights()

    def classify(
        self,
        pii_findings: list[PIIFinding],
        mime_type: str = "application/octet-stream",
        metadata: dict[str, Any] | None = None,
        metadata_pii_findings: list[PIIFinding] | None = None,
        content_text: str = "",
    ) -> SensitivityResult:
        """
        Calculate sensitivity score from PII findings and contextual signals.

        Args:
            pii_findings:          PII findings from content analysis.
            mime_type:             MIME type of the evidence file.
            metadata:              File metadata dict.
            metadata_pii_findings: PII findings from metadata.
            content_text:          Text content (for communication pattern detection).

        Returns:
            SensitivityResult with score, level, reason, and factor breakdown.
        """
        w = self.weights
        breakdown: dict[str, float] = {}
        reasons: list[str] = []

        # F1: PII count
        f1 = min(len(pii_findings) * w.pii_per_finding, w.pii_count_max)
        breakdown["F1_pii_count"] = f1
        if f1 > 0:
            reasons.append(f"{len(pii_findings)} PII instance(s) detected")

        # F2: High-risk PII types found
        found_high_risk = {f.pii_type for f in pii_findings} & HIGH_RISK_PII_TYPES
        f2 = len(found_high_risk) * w.high_risk_per_type
        breakdown["F2_high_risk_pii"] = f2
        if found_high_risk:
            reasons.append(f"High-risk PII types: {', '.join(sorted(found_high_risk))}")

        # F3: Credential/secret detection
        has_credentials = any(f.pii_type in CREDENTIAL_TYPES for f in pii_findings)
        f3 = w.secret_bonus if has_credentials else 0.0
        breakdown["F3_credentials"] = f3
        if has_credentials:
            reasons.append("Credential/secret data detected")

        # F4: Financial data
        has_financial = any(f.pii_type in FINANCIAL_TYPES for f in pii_findings)
        f4 = w.financial_bonus if has_financial else 0.0
        breakdown["F4_financial"] = f4
        if has_financial:
            reasons.append("Financial data detected")

        # F5: Authentication data
        has_auth = any(f.pii_type in AUTH_TYPES for f in pii_findings)
        f5 = w.auth_bonus if has_auth else 0.0
        breakdown["F5_auth"] = f5
        if has_auth:
            reasons.append("Authentication data detected")

        # F6: Location data
        has_location = any(f.pii_type in LOCATION_TYPES for f in pii_findings)
        f6 = w.location_bonus if has_location else 0.0
        breakdown["F6_location"] = f6
        if has_location:
            reasons.append("Geographic location data detected")

        # F7: Communication content (many emails → personal communication)
        email_count = sum(1 for f in pii_findings if f.pii_type == PIIType.EMAIL)
        f7 = w.communications_bonus if email_count > 2 else 0.0
        breakdown["F7_communications"] = f7
        if email_count > 2:
            reasons.append(f"Multiple email addresses ({email_count}) suggest personal communication")

        # F8: File type modifier
        f8 = w.file_type_weights.get(mime_type, 0.0)
        breakdown["F8_file_type"] = f8
        if f8 > 0:
            reasons.append(f"File type '{mime_type}' has sensitivity modifier")

        # F9: Metadata PII
        meta_pii = metadata_pii_findings or []
        f9 = w.metadata_pii_bonus if meta_pii else 0.0
        breakdown["F9_metadata_pii"] = f9
        if meta_pii:
            reasons.append(f"PII found in file metadata ({len(meta_pii)} instance(s))")

        # Total
        total = f1 + f2 + f3 + f4 + f5 + f6 + f7 + f8 + f9
        score = max(0.0, min(100.0, total))

        level = _score_to_level(score)
        reason = "; ".join(reasons) if reasons else "No sensitive indicators detected"

        return SensitivityResult(
            score=round(score, 2),
            level=level,
            reason=reason,
            factor_breakdown=breakdown,
        )


def _score_to_level(score: float) -> str:
    """Map sensitivity score to sensitivity level."""
    if score <= 20:
        return EvidenceSensitivity.PUBLIC
    elif score <= 40:
        return EvidenceSensitivity.LOW
    elif score <= 60:
        return EvidenceSensitivity.MEDIUM
    elif score <= 80:
        return EvidenceSensitivity.HIGH
    else:
        return EvidenceSensitivity.CRITICAL


# ── Module-level default classifier ──────────────────────────────────────────

_default_classifier = SensitivityClassifier()


def classify_sensitivity(
    pii_findings: list[PIIFinding],
    mime_type: str = "application/octet-stream",
    metadata: dict[str, Any] | None = None,
    metadata_pii: list[PIIFinding] | None = None,
) -> SensitivityResult:
    """Convenience function using the default classifier."""
    return _default_classifier.classify(
        pii_findings=pii_findings,
        mime_type=mime_type,
        metadata=metadata,
        metadata_pii_findings=metadata_pii,
    )
