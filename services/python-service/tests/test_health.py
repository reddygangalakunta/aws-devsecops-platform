import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_health_endpoint():
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert data["service"] == "threat-analytics-service"
    assert "uptime_seconds" in data
    assert "system" in data
    assert "components" in data
    assert data["components"]["threat_engine"]["status"] == "UP"

def test_liveness_probe():
    response = client.get("/health/live")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "alive"

def test_readiness_probe():
    response = client.get("/health/ready")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ready"

def test_metrics_endpoint():
    response = client.get("/metrics")
    assert response.status_code == 200
    assert "python_http_requests_total" in response.text or "process_cpu_seconds_total" in response.text
