from pydantic import BaseModel, Field
from typing import Dict, Any, List, Optional
from datetime import datetime

class SecurityEventPayload(BaseModel):
    id: Optional[str] = Field(default=None, description="Unique event identifier")
    event_type: str = Field(..., description="Type of event: e.g. api_access, auth_attempt, sql_query, file_upload, transaction")
    source_ip: str = Field(..., description="Origin IP address")
    user_id: Optional[str] = Field(default=None, description="User or service identifier")
    payload: Dict[str, Any] = Field(default_factory=dict, description="Raw event payload or parameters")
    timestamp: Optional[str] = Field(default=None, description="Event timestamp in ISO format")

class ThreatAnalysisResult(BaseModel):
    event_id: str
    event_type: str
    source_ip: str
    is_threat: bool
    risk_score: float = Field(..., ge=0.0, le=100.0, description="Risk score between 0 and 100")
    severity: str = Field(..., description="LOW, MEDIUM, HIGH, or CRITICAL")
    detected_patterns: List[str] = Field(default_factory=list)
    recommendation: str
    analyzed_at: str
    processing_time_ms: float

class HealthComponentStatus(BaseModel):
    status: str
    details: Optional[Dict[str, Any]] = None

class HealthResponse(BaseModel):
    status: str
    service: str
    version: str
    timestamp: str
    uptime_seconds: float
    system: Dict[str, Any]
    components: Dict[str, HealthComponentStatus]
