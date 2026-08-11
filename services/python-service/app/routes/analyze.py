from fastapi import APIRouter, HTTPException, status
from typing import List
from app.models.schemas import SecurityEventPayload, ThreatAnalysisResult
from app.services.threat_engine import analyze_event

router = APIRouter(prefix="/api/v1", tags=["Analysis"])

@router.post("/analyze", response_model=ThreatAnalysisResult, status_code=status.HTTP_200_OK)
async def analyze_single_event(payload: SecurityEventPayload):
    """
    Analyzes a single security/telemetry event for threats, anomalies, and risk score.
    """
    try:
        return analyze_event(payload)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error analyzing event: {str(e)}"
        )

@router.post("/batch-analyze", response_model=List[ThreatAnalysisResult], status_code=status.HTTP_200_OK)
async def analyze_batch_events(events: List[SecurityEventPayload]):
    """
    Analyzes a batch of security/telemetry events in real-time.
    """
    results = []
    for event in events:
        results.append(analyze_event(event))
    return results
