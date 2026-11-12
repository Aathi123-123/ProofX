"""
PSDE – Cryptographic Hashing Service
SHA-256 based hashing for evidence integrity.

Design principles:
- Uses only Python standard library hashlib (no custom crypto)
- Deterministic: same input → same output
- Evidence is NEVER modified before hashing
- Original hash and disclosed-representation hash are kept separate
"""
from __future__ import annotations

import hashlib
import hmac
import os
import secrets
from pathlib import Path
from typing import Any


# ── SHA-256 Core ──────────────────────────────────────────────────────────────

def sha256_bytes(data: bytes) -> str:
    """Calculate SHA-256 hash of raw bytes. Returns lowercase hex string."""
    return hashlib.sha256(data).hexdigest()


def sha256_file(file_path: str | Path) -> str:
    """
    Calculate SHA-256 hash of a file using streaming reads.
    Does NOT load the entire file into memory.
    Returns lowercase hex string.
    """
    h = hashlib.sha256()
    with open(file_path, "rb") as f:
        for chunk in iter(lambda: f.read(65536), b""):
            h.update(chunk)
    return h.hexdigest()


def sha256_string(text: str, encoding: str = "utf-8") -> str:
    """Calculate SHA-256 hash of a UTF-8 string."""
    return sha256_bytes(text.encode(encoding))


def sha256_dict(data: dict[str, Any]) -> str:
    """
    Calculate SHA-256 hash of a dictionary.
    Dictionary is serialised to a deterministic JSON-like string.
    Uses sorted keys to ensure determinism.
    """
    import json
    serialised = json.dumps(data, sort_keys=True, ensure_ascii=True)
    return sha256_string(serialised)


# ── HMAC ─────────────────────────────────────────────────────────────────────

def compute_hmac(key: bytes, message: bytes) -> str:
    """Compute HMAC-SHA256. Returns hex string."""
    return hmac.new(key, message, hashlib.sha256).hexdigest()


def verify_hmac(key: bytes, message: bytes, expected_hex: str) -> bool:
    """Constant-time HMAC verification."""
    computed = compute_hmac(key, message)
    return hmac.compare_digest(computed, expected_hex)


# ── Secure Random ─────────────────────────────────────────────────────────────

def generate_secure_token(n_bytes: int = 32) -> str:
    """Generate a cryptographically secure random hex token."""
    return secrets.token_hex(n_bytes)


def generate_secure_bytes(n_bytes: int = 32) -> bytes:
    """Generate cryptographically secure random bytes."""
    return secrets.token_bytes(n_bytes)


# ── Evidence Hash Verification ────────────────────────────────────────────────

def verify_file_integrity(file_path: str | Path, expected_sha256: str) -> bool:
    """
    Recalculate SHA-256 of a file and compare against expected value.
    Returns True if and only if the hashes match exactly.
    Uses constant-time comparison to prevent timing attacks.
    """
    if not Path(file_path).exists():
        return False
    actual = sha256_file(file_path)
    return hmac.compare_digest(actual, expected_sha256.lower())


# ── Hash Tree Node ────────────────────────────────────────────────────────────

def combine_hashes(left: str, right: str) -> str:
    """
    Combine two SHA-256 hashes for Merkle tree construction.
    Input: two lowercase hex SHA-256 strings
    Output: SHA-256(left_bytes || right_bytes)
    """
    left_bytes = bytes.fromhex(left)
    right_bytes = bytes.fromhex(right)
    return sha256_bytes(left_bytes + right_bytes)
