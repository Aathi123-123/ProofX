"""
PSDE – Relevance Engine

Deterministic relevance scoring against an investigation purpose.

Relevance Score Formula:
relevance_score = clamp(Σ(weight_i × factor_i), 0, 100)

Factors:
  R1: Keyword match            → +10 per keyword found in content/filename
  R2: Entity match             → +15 per investigation entity matched
  R3: Date range match         → +20 if artifact is within investigation period
  R4: MIME type relevance      → varies by investigation type keywords
  R5: Source relevance         → +10 if source matches investigation scope
  R6: Communication relevance  → +15 if EMAIL/PHONE and participants match

Score → Relevance Level:
  80–100 → RELEVANT
  50–79  → POTENTIALLY_RELEVANT
  0–49   → IRRELEVANT

Examiner can override. Every override creates an audit event.
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any

from app.models.models import EvidenceRelevance


# ── Relevance Result ──────────────────────────────────────────────────────────

@dataclass
class RelevanceResult:
    score: float
    level: str
    reason: str
    matched_keywords: list[str]
    factor_breakdown: dict[str, float]


# ── Investigation Context ─────────────────────────────────────────────────────

@dataclass
class InvestigationContext:
    """
    Represents the investigative context used for relevance scoring.
    Extracted from the case's investigation_purpose field.
    """
    purpose_text: str
    keywords: list[str] = field(default_factory=list)
    entities: list[str] = field(default_factory=list)
    date_range_start: datetime | None = None
    date_range_end: datetime | None = None
    mime_types: list[str] = field(default_factory=list)
    sources: list[str] = field(default_factory=list)

    @classmethod
    def from_purpose(cls, purpose: str) -> "InvestigationContext":
        """Parse an investigation purpose string into structured context."""
        # Extract any quoted terms as entities
        entities = re.findall(r'"([^"]+)"', purpose)
        # Extract ISO dates
        dates = re.findall(r'\b(\d{4}-\d{2}-\d{2})\b', purpose)
        date_range_start = None
        date_range_end = None
        if len(dates) >= 2:
            try:
                date_range_start = datetime.fromisoformat(dates[0])
                date_range_end = datetime.fromisoformat(dates[1])
            except ValueError:
                pass
        elif len(dates) == 1:
            try:
                date_range_start = datetime.fromisoformat(dates[0])
            except ValueError:
                pass

        # Extract keywords: significant words, ignoring stop words
        stop_words = {
            "the", "a", "an", "and", "or", "in", "on", "at", "to", "for",
            "of", "with", "between", "during", "identify", "investigate",
            "find", "all", "any", "is", "are", "was", "were", "that", "this",
        }
        words = re.findall(r'\b[A-Za-z][A-Za-z0-9\-_]{2,}\b', purpose)
        keywords = [w.lower() for w in words if w.lower() not in stop_words]
        # Deduplicate
        keywords = list(dict.fromkeys(keywords))

        return cls(
            purpose_text=purpose,
            keywords=keywords,
            entities=entities,
            date_range_start=date_range_start,
            date_range_end=date_range_end,
        )


# ── Relevance Engine ──────────────────────────────────────────────────────────

@dataclass
class RelevanceWeights:
    keyword_per_match: float = 10.0
    keyword_max: float = 40.0
    entity_per_match: float = 15.0
    entity_max: float = 30.0
    date_range_match: float = 20.0
    source_match: float = 10.0
    communication_match: float = 15.0


class RelevanceEngine:
    """
    Deterministic relevance scorer.
    All scoring logic is documented and transparent.
    """

    def __init__(self, weights: RelevanceWeights | None = None):
        self.weights = weights or RelevanceWeights()

    def score(
        self,
        context: InvestigationContext,
        artifact_filename: str,
        artifact_content_text: str,
        artifact_mime_type: str,
        acquisition_timestamp: datetime | None,
        artifact_metadata: dict[str, Any] | None = None,
        artifact_source: str = "",
    ) -> RelevanceResult:
        """
        Score the relevance of an evidence artifact against an investigation context.
        """
        w = self.weights
        breakdown: dict[str, float] = {}
        reasons: list[str] = []
        matched_keywords: list[str] = []

        # Combine searchable text
        searchable = " ".join([
            artifact_filename,
            artifact_content_text[:5000],  # limit to first 5KB for performance
            artifact_source,
            str(artifact_metadata or {}),
        ]).lower()

        # R1: Keyword matching
        found_keywords: list[str] = []
        for kw in context.keywords:
            if kw.lower() in searchable:
                found_keywords.append(kw)
        r1 = min(len(found_keywords) * w.keyword_per_match, w.keyword_max)
        breakdown["R1_keyword"] = r1
        matched_keywords = found_keywords
        if found_keywords:
            reasons.append(f"Keywords matched: {', '.join(found_keywords[:5])}")

        # R2: Entity matching
        found_entities: list[str] = []
        for entity in context.entities:
            if entity.lower() in searchable:
                found_entities.append(entity)
        r2 = min(len(found_entities) * w.entity_per_match, w.entity_max)
        breakdown["R2_entity"] = r2
        if found_entities:
            reasons.append(f"Investigation entities matched: {', '.join(found_entities)}")

        # R3: Date range match
        r3 = 0.0
        if acquisition_timestamp and (context.date_range_start or context.date_range_end):
            ts = acquisition_timestamp.replace(tzinfo=None) if acquisition_timestamp.tzinfo else acquisition_timestamp
            in_range = True
            if context.date_range_start:
                start = context.date_range_start.replace(tzinfo=None)
                in_range = in_range and (ts >= start)
            if context.date_range_end:
                end = context.date_range_end.replace(tzinfo=None)
                in_range = in_range and (ts <= end)
            if in_range:
                r3 = w.date_range_match
                reasons.append("Artifact within specified investigation date range")
        breakdown["R3_date_range"] = r3

        # R4: Source relevance
        r4 = 0.0
        if context.sources and artifact_source:
            for src in context.sources:
                if src.lower() in artifact_source.lower():
                    r4 = w.source_match
                    reasons.append(f"Source matches investigation scope: {src}")
                    break
        breakdown["R4_source"] = r4

        # R5: Communication relevance (emails and phones in communications)
        r5 = 0.0
        if artifact_mime_type in ("text/plain", "application/json") and found_keywords:
            r5 = w.communication_match
            reasons.append("Communication artifact with relevant keywords")
        breakdown["R5_communication"] = r5

        total = r1 + r2 + r3 + r4 + r5
        score = max(0.0, min(100.0, total))
        level = _score_to_relevance(score)
        reason = "; ".join(reasons) if reasons else "No relevance signals found for this investigation context"

        return RelevanceResult(
            score=round(score, 2),
            level=level,
            reason=reason,
            matched_keywords=matched_keywords,
            factor_breakdown=breakdown,
        )


def _score_to_relevance(score: float) -> str:
    if score >= 80:
        return EvidenceRelevance.RELEVANT
    elif score >= 50:
        return EvidenceRelevance.POTENTIALLY_RELEVANT
    else:
        return EvidenceRelevance.IRRELEVANT


# ── Module-level default engine ───────────────────────────────────────────────

_default_engine = RelevanceEngine()


def score_relevance(
    purpose: str,
    filename: str,
    content_text: str,
    mime_type: str,
    acquisition_timestamp: datetime | None = None,
    metadata: dict[str, Any] | None = None,
    source: str = "",
) -> RelevanceResult:
    """Convenience function using the default relevance engine."""
    ctx = InvestigationContext.from_purpose(purpose)
    return _default_engine.score(
        context=ctx,
        artifact_filename=filename,
        artifact_content_text=content_text,
        artifact_mime_type=mime_type,
        acquisition_timestamp=acquisition_timestamp,
        artifact_metadata=metadata,
        artifact_source=source,
    )
