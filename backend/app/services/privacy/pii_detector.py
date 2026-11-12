"""
PSDE – PII Detection Pipeline

Pluggable architecture with three implementations:
1. RegexPIIDetector   – deterministic, no external dependencies (primary)
2. MetadataPIIDetector – inspects file metadata
3. OptionalSemanticPIIDetector – placeholder for optional external API

Disclaimer: No PII detector achieves perfect recall or precision.
All findings include a confidence score. The system does NOT claim
to exhaustively detect all PII.
"""
from __future__ import annotations

import re
import hashlib
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Any


# ── Data Classes ──────────────────────────────────────────────────────────────

@dataclass
class PIIFinding:
    """
    A single detected PII instance.
    The raw value is NEVER stored; only its hash/fingerprint.
    """
    pii_type: str          # e.g., "EMAIL", "PHONE", "IP", etc.
    location: str          # human-readable location description
    confidence: float      # 0.0 – 1.0
    value_hash: str        # SHA-256 of the raw detected value
    value_preview: str = ""  # Optional safe preview (e.g., first 3 chars + ***)
    context: str = ""      # Surrounding text snippet (safe, no raw value)

    def to_dict(self) -> dict[str, Any]:
        return {
            "pii_type": self.pii_type,
            "location": self.location,
            "confidence": round(self.confidence, 4),
            "value_hash": self.value_hash,
            "value_preview": self.value_preview,
            "context": self.context,
        }


def _hash_value(raw: str) -> str:
    """SHA-256 hash of the raw PII value."""
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def _safe_preview(value: str, show_chars: int = 3) -> str:
    """Create a privacy-safe preview by masking most characters."""
    if len(value) <= show_chars:
        return "*" * len(value)
    return value[:show_chars] + "*" * (len(value) - show_chars)


# ── PII Type Constants ────────────────────────────────────────────────────────

class PIIType:
    EMAIL = "EMAIL"
    PHONE = "PHONE"
    IP_ADDRESS = "IP_ADDRESS"
    IPV6_ADDRESS = "IPV6_ADDRESS"
    URL = "URL"
    CREDIT_CARD = "CREDIT_CARD"
    UUID = "UUID"
    DATE = "DATE"
    GEO_COORDINATES = "GEO_COORDINATES"
    USERNAME = "USERNAME"
    API_KEY = "API_KEY"
    PASSWORD = "PASSWORD"
    SSN = "SSN"
    IBAN = "IBAN"
    MAC_ADDRESS = "MAC_ADDRESS"
    CRYPTO_ADDRESS = "CRYPTO_ADDRESS"
    JWT_TOKEN = "JWT_TOKEN"


# ── Abstract Detector ─────────────────────────────────────────────────────────

class PIIDetector(ABC):
    """
    Abstract base class for all PII detectors.
    Implement this interface to add new detection strategies.
    """

    @abstractmethod
    def detect(self, content: str, context_label: str = "content") -> list[PIIFinding]:
        """
        Analyse content and return a list of PII findings.
        Args:
            content: The text content to analyse.
            context_label: Human-readable label for the content source.
        Returns:
            List of PIIFinding instances.
        """
        ...

    @property
    @abstractmethod
    def name(self) -> str:
        """Human-readable name of this detector."""
        ...


# ── Regex PII Detector ────────────────────────────────────────────────────────

class RegexPIIDetector(PIIDetector):
    """
    Deterministic PII detector using regular expression patterns.
    No external dependencies required.
    All patterns are documented and configurable.

    Limitations:
    - Phone number detection has geographic specificity limitations.
    - Name detection is NOT implemented (high false positive rate).
    - Novel or obfuscated PII may not be detected.
    """

    # Pattern registry: {type: (pattern, confidence)}
    PATTERNS: dict[str, tuple[str, float]] = {
        PIIType.EMAIL: (
            r'\b[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}\b',
            0.97,
        ),
        PIIType.PHONE: (
            r'(?<!\d)(?:\+?1[\s.\-]?)?(?:\(\d{3}\)|\d{3})[\s.\-]?\d{3}[\s.\-]?\d{4}(?!\d)',
            0.75,
        ),
        PIIType.IP_ADDRESS: (
            r'\b(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\b',
            0.95,
        ),
        PIIType.IPV6_ADDRESS: (
            r'\b(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}\b',
            0.90,
        ),
        PIIType.URL: (
            r'https?://[^\s<>"\'{}|\\^`\[\]]+',
            0.92,
        ),
        PIIType.CREDIT_CARD: (
            r'\b(?:4[0-9]{12}(?:[0-9]{3})?|5[1-5][0-9]{14}|3[47][0-9]{13}|6(?:011|5[0-9]{2})[0-9]{12})\b',
            0.90,
        ),
        PIIType.UUID: (
            r'\b[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}\b',
            0.98,
        ),
        PIIType.DATE: (
            r'\b(?:\d{4}-\d{2}-\d{2}|\d{2}/\d{2}/\d{4}|\d{2}-\d{2}-\d{4})\b',
            0.70,
        ),
        PIIType.GEO_COORDINATES: (
            r'(?<!\d)[-+]?(?:[1-8]?\d(?:\.\d+)?|90(?:\.0+)?),\s*[-+]?(?:1[0-7]\d(?:\.\d+)?|180(?:\.0+)?|(?:\d{1,2}(?:\.\d+)?))(?!\d)',
            0.80,
        ),
        PIIType.SSN: (
            r'\b(?!000|666|9\d{2})\d{3}[-\s]?(?!00)\d{2}[-\s]?(?!0000)\d{4}\b',
            0.85,
        ),
        PIIType.IBAN: (
            r'\b[A-Z]{2}\d{2}[A-Z0-9]{4}\d{7}(?:[A-Z0-9]?){0,16}\b',
            0.88,
        ),
        PIIType.MAC_ADDRESS: (
            r'\b(?:[0-9a-fA-F]{2}[:\-]){5}[0-9a-fA-F]{2}\b',
            0.93,
        ),
        PIIType.CRYPTO_ADDRESS: (
            r'\b(?:1[a-km-zA-HJ-NP-Z1-9]{25,34}|3[a-km-zA-HJ-NP-Z1-9]{25,34}|bc1[a-z0-9]{25,39}|0x[a-fA-F0-9]{40})\b',
            0.85,
        ),
        PIIType.JWT_TOKEN: (
            r'\beyJ[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+\b',
            0.97,
        ),
        PIIType.API_KEY: (
            r'(?i)(?:api[_\-]?key|token|secret|bearer|auth)["\s:=]+([A-Za-z0-9\-_\.]{20,})',
            0.72,
        ),
        PIIType.PASSWORD: (
            r'(?i)(?:password|passwd|pwd|secret)["\s:=]+([^\s"\']{8,})',
            0.70,
        ),
    }

    def __init__(self, custom_patterns: dict[str, tuple[str, float]] | None = None):
        self._patterns = {**self.PATTERNS}
        if custom_patterns:
            self._patterns.update(custom_patterns)
        # Compile all patterns once for efficiency
        self._compiled = {
            ptype: (re.compile(pattern, re.MULTILINE), confidence)
            for ptype, (pattern, confidence) in self._patterns.items()
        }

    @property
    def name(self) -> str:
        return "RegexPIIDetector"

    def detect(self, content: str, context_label: str = "content") -> list[PIIFinding]:
        findings: list[PIIFinding] = []
        for ptype, (regex, confidence) in self._compiled.items():
            for match in regex.finditer(content):
                raw_value = match.group(0)
                # For group-capture patterns (API_KEY, PASSWORD), use group(1) if present
                if regex.groups and match.lastindex:
                    raw_value = match.group(match.lastindex)

                # Extract a safe context window (±20 chars, no raw value exposure in logs)
                start = max(0, match.start() - 20)
                end = min(len(content), match.end() + 20)
                ctx = content[start:end].replace(raw_value, "[REDACTED]")

                findings.append(PIIFinding(
                    pii_type=ptype,
                    location=f"{context_label}:char_{match.start()}",
                    confidence=confidence,
                    value_hash=_hash_value(raw_value),
                    value_preview=_safe_preview(raw_value),
                    context=ctx,
                ))
        return findings


# ── Metadata PII Detector ─────────────────────────────────────────────────────

class MetadataPIIDetector(PIIDetector):
    """
    Detects PII in file metadata fields (EXIF, document properties, etc.).
    Delegates to RegexPIIDetector on individual metadata values.
    """

    def __init__(self):
        self._regex_detector = RegexPIIDetector()

    @property
    def name(self) -> str:
        return "MetadataPIIDetector"

    def detect(self, content: str, context_label: str = "metadata") -> list[PIIFinding]:
        """
        Detect PII in a metadata string (expected to be key=value or JSON text).
        """
        return self._regex_detector.detect(content, context_label=context_label)

    def detect_from_dict(self, metadata: dict[str, Any]) -> list[PIIFinding]:
        """Detect PII across all metadata values."""
        findings: list[PIIFinding] = []
        for key, value in metadata.items():
            if isinstance(value, str):
                sub_findings = self._regex_detector.detect(
                    value, context_label=f"metadata.{key}"
                )
                findings.extend(sub_findings)
        return findings


# ── Optional Semantic Detector (stub) ─────────────────────────────────────────

class OptionalSemanticPIIDetector(PIIDetector):
    """
    Placeholder for an optional semantic PII detector.
    This class is NEVER required for core system functionality.
    To enable: implement the detect() method using an external NER model or API.
    Do NOT add any paid API calls to this class without explicit configuration.
    """

    @property
    def name(self) -> str:
        return "OptionalSemanticPIIDetector"

    def detect(self, content: str, context_label: str = "content") -> list[PIIFinding]:
        raise NotImplementedError(
            "OptionalSemanticPIIDetector is not implemented. "
            "The system operates correctly without it using RegexPIIDetector."
        )


# ── Composite Detector ────────────────────────────────────────────────────────

class CompositePIIDetector(PIIDetector):
    """
    Chains multiple PII detectors and deduplicates findings by value_hash.
    """

    def __init__(self, detectors: list[PIIDetector]):
        self._detectors = detectors

    @property
    def name(self) -> str:
        names = ", ".join(d.name for d in self._detectors)
        return f"CompositePIIDetector({names})"

    def detect(self, content: str, context_label: str = "content") -> list[PIIFinding]:
        seen_hashes: set[str] = set()
        findings: list[PIIFinding] = []
        for detector in self._detectors:
            for finding in detector.detect(content, context_label):
                key = f"{finding.pii_type}:{finding.value_hash}"
                if key not in seen_hashes:
                    seen_hashes.add(key)
                    findings.append(finding)
        return findings


# ── Factory ───────────────────────────────────────────────────────────────────

def create_pii_detector(detector_type: str = "regex") -> PIIDetector:
    """
    Factory function to create a PII detector by name.
    'regex'    → RegexPIIDetector (default, no external dependencies)
    'metadata' → MetadataPIIDetector
    'semantic' → Raises ImportError (optional, not implemented)
    """
    if detector_type == "regex":
        return RegexPIIDetector()
    elif detector_type == "metadata":
        return CompositePIIDetector([RegexPIIDetector(), MetadataPIIDetector()])
    elif detector_type == "semantic":
        raise ImportError(
            "Semantic PII detection is not enabled. Set PII_DETECTOR=regex in .env"
        )
    else:
        raise ValueError(f"Unknown PII detector type: {detector_type!r}")
