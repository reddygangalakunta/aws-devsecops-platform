import os
from pydantic import BaseModel

class Settings(BaseModel):
    SERVICE_NAME: str = os.getenv("SERVICE_NAME", "threat-analytics-service")
    ENVIRONMENT: str = os.getenv("ENVIRONMENT", "development")
    VERSION: str = os.getenv("VERSION", "1.0.0")
    PORT: int = int(os.getenv("PORT", "8000"))
    HOST: str = os.getenv("HOST", "0.0.0.0")
    LOG_LEVEL: str = os.getenv("LOG_LEVEL", "INFO")
    
    # Anomaly detection thresholds
    ANOMALY_THRESHOLD: float = float(os.getenv("ANOMALY_THRESHOLD", "75.0"))

settings = Settings()
