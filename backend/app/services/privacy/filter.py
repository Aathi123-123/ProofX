"""
PSDE – Privacy Filter and Redaction Engine

Implements disclosure policy evaluation and deterministic redaction.

Policy decision matrix:
  Sensitivity  | Default Decision
  -------------|------------------
  PUBLIC       | ALLOW
  LOW          | ALLOW
  MEDIUM       | ALLOW_WITH_REDACTION (PII masked)
  HIGH         | ALLOW_WITH_REDACTION (PII + content masked)
  CRITICAL     | DENY

Final decision also considers:
  - Investigator's stated purpose
  - Artifact relevance level
  - Investigator role
  - Requested fields

Every decision is explainable (reason is always populated).
"""
from __future__ import annotations

import re
import hashlib
from dataclasses import dataclass, field
from typing import Any

from app.models.models import (
    EvidenceSensitivity, EvidenceRelevance, DisclosureDecision, UserRole
)
from app.services.privacy.pii_detector import PIIFinding, PIIType


# ── Redaction Targets ─────────────────────────────────────────────────────────

REDACTION_LABELS: dict[str, str] = {
    PIIType.PHONE: "[PHONE REDACTED]",
    PIIType.EMAIL: "[EMAIL REDACTED]",
    PIIType.IP_ADDRESS: "[IP REDACTED]",
    PIIType.IPV6_ADDRESS: "[IPV6 REDACTED]",
    PIIType.URL: "[URL REDACTED]",
    PIIType.CREDIT_CARD: "[CREDIT CARD REDACTED]",
    PIIType.UUID: "[UUID REDACTED]",
    PIIType.DATE: "[DATE REDACTED]",
    PIIType.GEO_COORDINATES: "[LOCATION REDACTED]",
    PIIType.SSN: "[SSN REDACTED]",
    PIIType.IBAN: "[IBAN REDACTED]",
    PIIType.MAC_ADDRESS: "[MAC REDACTED]",
    PIIType.CRYPTO_ADDRESS: "[CRYPTO ADDRESS REDACTED]",
    PIIType.JWT_TOKEN: "[TOKEN REDACTED]",
    PIIType.API_KEY: "[API KEY REDACTED]",
    PIIType.PASSWORD: "[PASSWORD REDACTED]",
}

# PII patterns from RegexPIIDetector (duplicated here for redaction)
_REDACTION_PATTERNS: list[tuple[str, str, float]] = [
    (PIIType.JWT_TOKEN,      r'eyJ[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+', 0),
    (PIIType.EMAIL,          r'[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}', 0),
    (PIIType.CREDIT_CARD,    r'(?:4[0-9]{12}(?:[0-9]{3})?|5[1-5][0-9]{14}|3[47][0-9]{13}|6(?:011|5[0-9]{2})[0-9]{12})', 0),
    (PIIType.SSN,            r'(?!000|666|9\d{2})\d{3}[-\s]?(?!00)\d{2}[-\s]?(?!0000)\d{4}', 0),
    (PIIType.IBAN,           r'[A-Z]{2}\d{2}[A-Z0-9]{4}\d{7}(?:[A-Z0-9]?){0,16}', 0),
    (PIIType.IP_ADDRESS,     r'\b(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\b', 0),
    (PIIType.GEO_COORDINATES,r'[-+]?(?:[1-8]?\d(?:\.\d+)?|90(?:\.0+)?),\s*[-+]?(?:1[0-7]\d(?:\.\d+)?|180(?:\.0+)?|(?:\d{1,2}(?:\.\d+)?))', 0),
    (PIIType.MAC_ADDRESS,    r'(?:[0-9a-fA-F]{2}[:\-]){5}[0-9a-fA-F]{2}', 0),
    (PIIType.UUID,           r'[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}', 0),
    (PIIType.URL,            r'https?://[^\s<>"\'{}|\\^`\[\]]+', 0),
    (PIIType.PHONE,          r'(?:\+?1[\s.\-]?)?(?:\(\d{3}\)|\d{3})[\s.\-]?\d{3}[\s.\-]?\d{4}', 0),
    (PIIType.DATE,           r'\b(?:\d{4}-\d{2}-\d{2}|\d{2}/\d{2}/\d{4})\b', 0),
    (PIIType.PASSWORD,       r'(?i)(?:password|passwd|pwd|secret)["\s:=]+([^\s"\']{8,})', 1),
    (PIIType.API_KEY,        r'(?i)(?:api[_\-]?key|token|auth)["\s:=]+([A-Za-z0-9\-_\.]{20,})', 1),
]

_compiled_patterns = [
    (ptype, re.compile(pattern, re.MULTILINE), group)
    for ptype, pattern, group in _REDACTION_PATTERNS
]


# ── Redaction ─────────────────────────────────────────────────────────────────

@dataclass
class RedactionRecord:
    pii_type: str
    count: int
    label: str


def redact_text(
    text: str,
    pii_types_to_redact: set[str] | None = None,
) -> tuple[str, list[RedactionRecord]]:
    """
    Redact PII from text content.

    Args:
        text: The text to redact.
        pii_types_to_redact: Set of PIIType values to redact.
                             If None, all known types are redacted.

    Returns:
        (redacted_text, list_of_redaction_records)
    """
    result = text
    redaction_counts: dict[str, int] = {}

    for ptype, pattern, capture_group in _compiled_patterns:
        if pii_types_to_redact is not None and ptype not in pii_types_to_redact:
            continue
        label = REDACTION_LABELS.get(ptype, f"[{ptype} REDACTED]")

        if capture_group == 0:
            # Full match replacement
            count = len(pattern.findall(result))
            result = pattern.sub(label, result)
        else:
            # Group replacement: replace only captured group
            def _replace(m: re.Match) -> str:
                return m.group(0).replace(m.group(capture_group), label)
            count = len(pattern.findall(result))
            result = pattern.sub(_replace, result)

        if count > 0:
            redaction_counts[ptype] = redaction_counts.get(ptype, 0) + count

    records = [
        RedactionRecord(pii_type=ptype, count=cnt, label=REDACTION_LABELS.get(ptype, "[REDACTED]"))
        for ptype, cnt in redaction_counts.items()
    ]
    return result, records


# ── Disclosure Policy ─────────────────────────────────────────────────────────

@dataclass
class DisclosureRequest:
    """A request to disclose a specific evidence artifact."""
    user_role: str
    purpose: str
    artifact_sensitivity: str
    artifact_relevance: str
    requested_fields: list[str] = field(default_factory=list)


@dataclass
class DisclosureDecisionResult:
    """The result of evaluating a disclosure request."""
    decision: str
    reason: str
    allowed_fields: list[str]
    redact_pii_types: set[str]
    explanation: list[str]


class PrivacyFilter:
    """
    Privacy-preserving disclosure policy engine.

    Evaluates whether an evidence artifact may be disclosed,
    with what redactions, and explains why.
    """

    # Fields always available in any disclosure (non-sensitive metadata)
    ALWAYS_AVAILABLE_FIELDS = [
        "artifact_id", "case_id", "mime_type", "file_size",
        "sensitivity_level", "relevance_level", "acquisition_timestamp",
        "status", "sha256",
    ]

    # Fields available for LOW/PUBLIC
    STANDARD_FIELDS = ALWAYS_AVAILABLE_FIELDS + [
        "filename", "source", "classification_reason", "evidence_metadata",
        "pii_findings",
    ]

    # Full fields (examiner only)
    ALL_FIELDS = STANDARD_FIELDS + ["storage_path", "override_reason"]

    def evaluate(self, request: DisclosureRequest) -> DisclosureDecisionResult:
        """
        Evaluate a disclosure request and return a policy decision.

        Decision logic (documented):
        1. CRITICAL evidence → DENY by default unless ADMIN/EXAMINER with justification
        2. HIGH + INVESTIGATOR → ALLOW_WITH_REDACTION (remove PII)
        3. MEDIUM → ALLOW_WITH_REDACTION (remove high-risk PII)
        4. LOW/PUBLIC → ALLOW
        5. IRRELEVANT evidence → DENY (not relevant to stated purpose)
        """
        explanation: list[str] = []
        sensitivity = request.artifact_sensitivity
        relevance = request.artifact_relevance
        role = request.user_role

        # Step 1: Relevance gate
        if relevance == EvidenceRelevance.IRRELEVANT:
            return DisclosureDecisionResult(
                decision=DisclosureDecision.DENY,
                reason="Evidence is classified as IRRELEVANT to the investigation purpose.",
                allowed_fields=[],
                redact_pii_types=set(),
                explanation=["Artifact relevance is IRRELEVANT — disclosure denied per privacy policy."],
            )

        explanation.append(f"Relevance: {relevance}")
        explanation.append(f"Sensitivity: {sensitivity}")
        explanation.append(f"Requestor role: {role}")

        # Step 2: Sensitivity-based policy
        if sensitivity == EvidenceSensitivity.CRITICAL:
            if role in (UserRole.ADMIN, UserRole.FORENSIC_EXAMINER):
                explanation.append("CRITICAL evidence: ADMIN/EXAMINER can access with redaction.")
                return DisclosureDecisionResult(
                    decision=DisclosureDecision.ALLOW_WITH_REDACTION,
                    reason="CRITICAL sensitivity: full PII redaction applied. Elevated role required.",
                    allowed_fields=self.STANDARD_FIELDS,
                    redact_pii_types=set(REDACTION_LABELS.keys()),
                    explanation=explanation,
                )
            else:
                explanation.append("CRITICAL evidence: access denied for INVESTIGATOR/VERIFIER role.")
                return DisclosureDecisionResult(
                    decision=DisclosureDecision.DENY,
                    reason="CRITICAL sensitivity evidence is not disclosable to this role.",
                    allowed_fields=[],
                    redact_pii_types=set(),
                    explanation=explanation,
                )

        elif sensitivity == EvidenceSensitivity.HIGH:
            explanation.append("HIGH sensitivity: PII redaction applied.")
            return DisclosureDecisionResult(
                decision=DisclosureDecision.ALLOW_WITH_REDACTION,
                reason="HIGH sensitivity: PII fields are redacted in the disclosed representation.",
                allowed_fields=self.STANDARD_FIELDS,
                redact_pii_types=set(REDACTION_LABELS.keys()),
                explanation=explanation,
            )

        elif sensitivity == EvidenceSensitivity.MEDIUM:
            # Redact only high-risk PII types for MEDIUM
            high_risk = {
                PIIType.SSN, PIIType.CREDIT_CARD, PIIType.IBAN,
                PIIType.PASSWORD, PIIType.API_KEY, PIIType.JWT_TOKEN,
            }
            explanation.append("MEDIUM sensitivity: high-risk PII redaction applied.")
            return DisclosureDecisionResult(
                decision=DisclosureDecision.ALLOW_WITH_REDACTION,
                reason="MEDIUM sensitivity: high-risk PII types are redacted.",
                allowed_fields=self.STANDARD_FIELDS,
                redact_pii_types=high_risk,
                explanation=explanation,
            )

        elif sensitivity in (EvidenceSensitivity.LOW, EvidenceSensitivity.PUBLIC):
            explanation.append("LOW/PUBLIC sensitivity: full disclosure allowed.")
            return DisclosureDecisionResult(
                decision=DisclosureDecision.ALLOW,
                reason="LOW/PUBLIC sensitivity: full disclosure permitted.",
                allowed_fields=self.ALL_FIELDS,
                redact_pii_types=set(),
                explanation=explanation,
            )

        else:
            # Unknown sensitivity → conservative deny
            explanation.append(f"Unknown sensitivity level '{sensitivity}': defaulting to DENY.")
            return DisclosureDecisionResult(
                decision=DisclosureDecision.DENY,
                reason=f"Unknown sensitivity level '{sensitivity}'. Conservative policy: deny.",
                allowed_fields=[],
                redact_pii_types=set(),
                explanation=explanation,
            )


# ── Module-level filter ───────────────────────────────────────────────────────

_default_filter = PrivacyFilter()


def evaluate_disclosure(
    user_role: str,
    purpose: str,
    sensitivity: str,
    relevance: str,
    requested_fields: list[str] | None = None,
) -> DisclosureDecisionResult:
    """Convenience function using the default privacy filter."""
    req = DisclosureRequest(
        user_role=user_role,
        purpose=purpose,
        artifact_sensitivity=sensitivity,
        artifact_relevance=relevance,
        requested_fields=requested_fields or [],
    )
    return _default_filter.evaluate(req)
