"""PSDE – Main FastAPI Application Entrypoint"""
from __future__ import annotations

import logging
import json
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import JSONResponse
from pydantic import ValidationError
from sqlalchemy.exc import IntegrityError

from app.api import auth, cases, evidence, merkle, blockchain, disclosure, verification, audit, dashboard, benchmark, reports
from app.core.config import get_settings
from app.core.logging import configure_logging

settings = get_settings()

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    configure_logging(level=settings.log_level, fmt=settings.log_format)
    logger = logging.getLogger("psde")
    logger.info("Starting PSDE Backend (Environment: %s)", settings.app_env)
    
    yield
    
    # Shutdown
    logger.info("Shutting down PSDE Backend")

app = FastAPI(
    title="PSDE API",
    description="Privacy-Preserving Selective Disclosure of Digital Forensic Evidence",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_origin_regex=r"https?://(localhost|127\.0\.0\.1)(:\d+)?$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# GZip Compression
app.add_middleware(GZipMiddleware, minimum_size=500)

# Exception handlers
@app.exception_handler(ValidationError)
async def validation_exception_handler(request: Request, exc: ValidationError):
    return JSONResponse(
        status_code=422,
        content={"detail": exc.errors()},
    )

@app.exception_handler(ValueError)
async def value_error_handler(request: Request, exc: ValueError):
    return JSONResponse(
        status_code=400,
        content={"detail": str(exc)},
    )

@app.exception_handler(PermissionError)
async def permission_error_handler(request: Request, exc: PermissionError):
    return JSONResponse(
        status_code=403,
        content={"detail": str(exc)},
    )

@app.exception_handler(IntegrityError)
async def integrity_error_handler(request: Request, exc: IntegrityError):
    detail = str(exc.orig) if settings.app_env == "development" else "Database constraint failed."
    return JSONResponse(status_code=409, content={"detail": detail})

@app.exception_handler(Exception)
async def development_exception_handler(request: Request, exc: Exception):
    if settings.app_env != "development":
        return JSONResponse(status_code=500, content={"detail": "Internal server error."})
    return JSONResponse(status_code=500, content={"detail": f"{type(exc).__name__}: {exc}"})


# Include routers
app.include_router(auth.router)
app.include_router(cases.router)
app.include_router(evidence.router)
app.include_router(merkle.router)
app.include_router(blockchain.router)
app.include_router(disclosure.router)
app.include_router(verification.router)
app.include_router(audit.router)
app.include_router(dashboard.router)
app.include_router(reports.router)
app.include_router(benchmark.router)

@app.get("/", tags=["System"])
async def root():
    """Root endpoint with quick navigation links."""
    return {
        "name": "PSDE API",
        "status": "online",
        "frontend_ui": "http://localhost:5173",
        "api_documentation": "/docs",
        "environment": settings.app_env,
    }


@app.get("/health", tags=["System"])
async def health_check():
    """System health check endpoint."""
    return {"status": "ok", "environment": settings.app_env}
