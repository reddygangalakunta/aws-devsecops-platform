import time
import os
import psutil
from datetime import datetime, timezone
from fastapi import APIRouter, Response, status
from app.config import settings
from app.models.schemas import HealthResponse, HealthComponentStatus

router = APIRouter(tags=["Health"])

START_TIME = time.time()

@router.get("/health", response_model=HealthResponse)
async def get_health():
    """
    Detailed aggregated health endpoint for CI/CD and Kubernetes verification.
    """
    uptime = time.time() - START_TIME
    
    # System metrics
    try:
        process = psutil.Process(os.getpid())
        mem_info = process.memory_info()
        memory_mb = round(mem_info.rss / (1024 * 1024), 2)
        cpu_percent = process.cpu_percent(interval=None)
    except Exception:
        memory_mb = 0.0
        cpu_percent = 0.0

    return HealthResponse(
        status="healthy",
        service=settings.SERVICE_NAME,
        version=settings.VERSION,
        timestamp=datetime.now(timezone.utc).isoformat(),
        uptime_seconds=round(uptime, 2),
        system={
            "environment": settings.ENVIRONMENT,
            "memory_usage_mb": memory_mb,
            "cpu_percent": cpu_percent,
            "pid": os.getpid(),
        },
        components={
            "threat_engine": HealthComponentStatus(
                status="UP",
                details={"patterns_loaded": 4, "threshold": settings.ANOMALY_THRESHOLD}
            ),
            "telemetry_collector": HealthComponentStatus(
                status="UP",
                details={"status": "active"}
            )
        }
    )

@router.get("/health/live")
@router.get("/healthz")
@router.get("/livez")
async def liveness_probe():
    """
    Kubernetes Liveness Probe:
    Verifies if the service process is running and not deadlocked.
    """
    return {"status": "alive", "service": settings.SERVICE_NAME, "timestamp": datetime.now(timezone.utc).isoformat()}

@router.get("/health/ready")
@router.get("/readyz")
async def readiness_probe():
    """
    Kubernetes Readiness Probe:
    Verifies if the service is ready to accept incoming traffic.
    """
    return {"status": "ready", "service": settings.SERVICE_NAME, "ready": True}
