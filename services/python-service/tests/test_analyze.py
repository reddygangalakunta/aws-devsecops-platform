from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_analyze_benign_event():
    payload = {
        "id": "evt-test-1",
        "event_type": "api_access",
        "source_ip": "192.168.1.100",
        "user_id": "usr_9981",
        "payload": {
            "path": "/api/v1/profile",
            "method": "GET"
        }
    }
    response = client.post("/api/v1/analyze", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["event_id"] == "evt-test-1"
    assert data["is_threat"] is False
    assert data["severity"] == "LOW"
    assert data["risk_score"] < 40.0

def test_analyze_sqli_threat():
    payload = {
        "id": "evt-sqli-1",
        "event_type": "sql_query",
        "source_ip": "45.33.32.156",
        "payload": {
            "query": "SELECT * FROM users WHERE username = 'admin' OR 1=1 --"
        }
    }
    response = client.post("/api/v1/analyze", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["is_threat"] is True
    assert "SQL_INJECTION_SUSPECTED" in data["detected_patterns"]
    assert data["risk_score"] >= 45.0
    assert data["severity"] in ["MEDIUM", "HIGH", "CRITICAL"]

def test_analyze_xss_threat():
    payload = {
        "id": "evt-xss-1",
        "event_type": "api_access",
        "source_ip": "104.244.42.1",
        "payload": {
            "comment": "<script>alert('XSS')</script>"
        }
    }
    response = client.post("/api/v1/analyze", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["is_threat"] is False or data["risk_score"] >= 35.0
    assert "CROSS_SITE_SCRIPTING_ATTEMPT" in data["detected_patterns"]

def test_batch_analyze():
    batch = [
        {
            "id": "batch-1",
            "event_type": "api_access",
            "source_ip": "10.0.0.1",
            "payload": {"status": "ok"}
        },
        {
            "id": "batch-2",
            "event_type": "sql_query",
            "source_ip": "10.0.0.2",
            "payload": {"query": "UNION SELECT * FROM passwords"}
        }
    ]
    response = client.post("/api/v1/batch-analyze", json=batch)
    assert response.status_code == 200
    results = response.json()
    assert len(results) == 2
    assert results[0]["is_threat"] is False
    assert results[1]["is_threat"] is True
