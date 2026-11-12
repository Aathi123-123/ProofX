"""
PSDE Backend – Application Configuration
Loads settings from environment variables (.env file supported).
"""
from __future__ import annotations

import os
import json
from functools import lru_cache
from typing import Literal

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        enable_decoding=False,
        extra="ignore",
    )

    # ── Application ──────────────────────────────────────────────
    app_env: Literal["development", "staging", "production"] = "development"
    app_debug: bool = False
    app_secret_key: str = Field(..., min_length=32)
    app_allowed_origins: str = (
        '["http://localhost:5173","http://127.0.0.1:5173",'
        '"http://localhost:3000","http://127.0.0.1:3000"]'
    )

    # ── Database ─────────────────────────────────────────────────
    database_url: str = "sqlite+aiosqlite:///./psde.db"

    # ── JWT ───────────────────────────────────────────────────────
    jwt_secret_key: str = Field(..., min_length=32)
    jwt_algorithm: str = "HS256"
    jwt_access_token_expire_minutes: int = 60
    jwt_refresh_token_expire_days: int = 7

    # ── Blockchain ────────────────────────────────────────────────
    blockchain_network: str = "hardhat-local"
    blockchain_rpc_url: str = "http://localhost:8545"
    blockchain_chain_id: int = 31337
    commitment_contract_address: str = ""
    blockchain_deployer_private_key: str = ""

    # ── Evidence Storage ─────────────────────────────────────────
    evidence_storage_path: str = "./evidence_store"
    max_upload_size_mb: int = 100
    allowed_mime_types: str = (
        '["text/plain","text/csv","application/pdf","image/png","image/jpeg",'
        '"image/gif","application/json","application/zip","application/octet-stream"]'
    )

    # ── PII Detection ─────────────────────────────────────────────
    pii_detector: Literal["regex", "metadata", "semantic"] = "regex"

    # ── Benchmark ─────────────────────────────────────────────────
    benchmark_output_path: str = "./benchmarks/results"
    benchmark_default_seed: int = 42

    # ── Logging ───────────────────────────────────────────────────
    log_level: str = "INFO"
    log_format: Literal["json", "console"] = "json"

    # ── Rate Limiting ─────────────────────────────────────────────
    rate_limit_requests_per_minute: int = 60

    # ── Bootstrap Admin ───────────────────────────────────────────
    bootstrap_admin_email: str = "admin@psde.local"
    bootstrap_admin_password: str = ""

    @property
    def max_upload_size_bytes(self) -> int:
        return self.max_upload_size_mb * 1024 * 1024

    @property
    def is_sqlite(self) -> bool:
        return self.database_url.startswith("sqlite")


@lru_cache
def get_settings() -> Settings:
    """Cached settings instance – import and call to get config."""
    return Settings()
