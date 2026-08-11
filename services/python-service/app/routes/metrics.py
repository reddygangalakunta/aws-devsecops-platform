from fastapi import APIRouter, Response
from app.utils.metrics import get_metrics_output

router = APIRouter(tags=["Metrics"])

@router.get("/metrics")
async def get_metrics():
    """
    Prometheus metrics endpoint. Exposes standard runtime and custom business metrics.
    """
    content, content_type = get_metrics_output()
    return Response(content=content, media_type=content_type)
