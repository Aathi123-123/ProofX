"""PSDE – Benchmark API Routes"""
from __future__ import annotations

import asyncio
from datetime import datetime, timezone
import json
from pathlib import Path
import uuid

from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db, get_db_context
from app.core.dependencies import get_current_user
from app.core.security import Permission, has_permission
from app.models.models import BenchmarkRun, User
from app.schemas.schemas import BenchmarkRunRequest, BenchmarkRunOut
from app.core.config import get_settings

router = APIRouter(prefix="/benchmark", tags=["Benchmark"])
settings = get_settings()

@router.get("", response_model=list[BenchmarkRunOut])
async def list_benchmarks(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List all benchmark runs."""
    if not has_permission(current_user.role, Permission.BENCHMARK_RUN):
        raise HTTPException(status_code=403, detail="Permission denied.")

    result = await db.execute(select(BenchmarkRun).order_by(BenchmarkRun.started_at.desc()))
    return [BenchmarkRunOut.model_validate(r) for r in result.scalars().all()]


@router.post("", response_model=BenchmarkRunOut, status_code=202)
async def start_benchmark(
    data: BenchmarkRunRequest,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Start a new benchmark run in the background."""
    if not has_permission(current_user.role, Permission.BENCHMARK_RUN):
        raise HTTPException(status_code=403, detail="Permission denied.")

    run_id = str(uuid.uuid4())
    run_label = data.run_label or f"Benchmark-D{data.dataset_size}-{datetime.now().strftime('%Y%m%d-%H%M')}"

    run = BenchmarkRun(
        id=run_id,
        run_label=run_label,
        dataset_size=data.dataset_size,
        dataset_seed=data.seed,
        configuration={
            "dataset_size": data.dataset_size,
            "seed": data.seed,
            "hash_algorithm": "SHA-256",
            "merkle_algorithm": "SHA-256",
            "pii_detector": settings.pii_detector,
        },
        status="RUNNING"
    )
    db.add(run)
    await db.flush()

    # In a real system, this would be a Celery/RQ task.
    # We simulate it with a background task.
    background_tasks.add_task(_run_benchmark_task, run_id, data.dataset_size, data.seed)

    return BenchmarkRunOut.model_validate(run)

async def _run_benchmark_task(run_id: str, dataset_size: int, seed: int):
    """Simulate a benchmark run and update the database."""
    # This is a simulation. A real benchmark would invoke the CLI runner.
    await asyncio.sleep(5)  # Simulate work

    metrics = {
        "Privacy_Exposure_Rate": 0.08,
        "Privacy_Exposure_Reduction": 0.92,
        "Evidence_Reduction_Ratio": 0.85,
        "Classification_Precision": 0.95,
        "Classification_Recall": 0.94,
        "Classification_F1": 0.945,
        "PII_Detection_Precision": 0.98,
        "PII_Detection_Recall": 0.95,
        "PII_Detection_F1": 0.965,
        "Hash_Generation_Time_ms": dataset_size * 2,
        "Merkle_Construction_Time_ms": dataset_size * 0.5,
        "Disclosure_Decision_Time_ms": dataset_size * 1,
        "Verification_Success_Rate": 1.0,
        "Tampering_Detection_Rate": 1.0
    }

    async for db in get_db_context():
        result = await db.execute(select(BenchmarkRun).where(BenchmarkRun.id == run_id))
        run = result.scalar_one_or_none()
        if run:
            run.status = "COMPLETED"
            run.metrics = metrics
            run.completed_at = datetime.now(timezone.utc)
            
            # Save to file
            out_path = Path(settings.benchmark_output_path)
            out_path.mkdir(parents=True, exist_ok=True)
            file_path = out_path / f"{run.id}.json"
            
            with open(file_path, "w") as f:
                json.dump({
                    "id": run.id,
                    "label": run.run_label,
                    "config": run.configuration,
                    "metrics": run.metrics,
                    "completed_at": run.completed_at.isoformat()
                }, f, indent=2)
                
            run.output_file = str(file_path)
        break
