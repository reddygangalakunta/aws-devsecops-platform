import re
import time
import uuid
from datetime import datetime, timezone
from typing import Tuple, List
from app.models.schemas import SecurityEventPayload, ThreatAnalysisResult
from app.utils.metrics import EVENTS_ANALYZED_TOTAL, THREATS_DETECTED_TOTAL, RISK_SCORE_HISTOGRAM
from app.utils.logger import logger

# Signatures and Heuristic Patterns for Real-Time Threat Analysis
SQLI_PATTERNS = [
    re.compile(r"(\b(UNION(\s+ALL)?|SELECT|DROP|INSERT|DELETE|UPDATE|ALTER)\b|--|\bOR\b\s+['\"0-9a-zA-Z]+\s*=\s*['\"0-9a-zA-Z]+|;|\/\*|\*\/)", re.IGNORECASE),
    re.compile(r"('|\")\s*(or|and)\s*('|\")?\d+('|\")?\s*=\s*('|\")?\d+", re.IGNORECASE),
    re.compile(r"waitfor\s+delay\s+'", re.IGNORECASE),
    re.compile(r"sleep\(\s*\d+\s*\)", re.IGNORECASE),
]

XSS_PATTERNS = [
    re.compile(r"<script.*?>.*?</script>", re.IGNORECASE | re.DOTALL),
    re.compile(r"javascript:\s*", re.IGNORECASE),
    re.compile(r"onerror\s*=\s*|onload\s*=\s*|onclick\s*=\s*|<iframe|<svg\s+onload", re.IGNORECASE),
]

PATH_TRAVERSAL_PATTERNS = [
    re.compile(r"(\.\./|\.\.\\|/etc/passwd|/etc/shadow|c:\\windows\\system32)", re.IGNORECASE),
]

SUSPICIOUS_USER_AGENTS = [
    re.compile(r"(sqlmap|nikto|nmap|dirbuster|gobuster|masscan|hydra|acunetix|metasploit)", re.IGNORECASE),
]

def analyze_event(event: SecurityEventPayload) -> ThreatAnalysisResult:
    start_time = time.perf_counter()
    event_id = event.id or str(uuid.uuid4())
    detected_patterns: List[str] = []
    risk_score = 0.0
    
    payload_str = str(event.payload)
    
    # 1. SQL Injection Check
    for pattern in SQLI_PATTERNS:
        if pattern.search(payload_str):
            detected_patterns.append("SQL_INJECTION_SUSPECTED")
            risk_score += 45.0
            break
            
    # 2. XSS Check
    for pattern in XSS_PATTERNS:
        if pattern.search(payload_str):
            detected_patterns.append("CROSS_SITE_SCRIPTING_ATTEMPT")
            risk_score += 35.0
            break
            
    # 3. Path Traversal Check
    for pattern in PATH_TRAVERSAL_PATTERNS:
        if pattern.search(payload_str):
            detected_patterns.append("PATH_TRAVERSAL_DETECTED")
            risk_score += 40.0
            break

    # 4. User-Agent / Tool Scanning Check
    user_agent = event.payload.get("user_agent", "")
    if user_agent:
        for pattern in SUSPICIOUS_USER_AGENTS:
            if pattern.search(user_agent):
                detected_patterns.append(f"AUTOMATED_SCANNER_TOOL:{user_agent}")
                risk_score += 50.0
                break

    # 5. Business Logic Anomaly (e.g. high-risk financial amounts, repeated failures)
    if event.event_type in ["transaction", "payment"]:
        amount = event.payload.get("amount", 0)
        try:
            amount_val = float(amount)
            if amount_val > 10000.0:
                detected_patterns.append(f"HIGH_VALUE_ANOMALY:Amount=${amount_val:,.2f}")
                risk_score += 25.0
        except (ValueError, TypeError):
            pass

    if event.event_type == "auth_attempt":
        status = str(event.payload.get("status", "")).lower()
        failed_attempts = event.payload.get("failed_attempts", 0)
        try:
            if int(failed_attempts) >= 5 or status == "failed":
                detected_patterns.append(f"POTENTIAL_BRUTE_FORCE:Attempts={failed_attempts}")
                risk_score += 30.0
        except (ValueError, TypeError):
            pass

    # Normalize risk score to max 100.0
    risk_score = min(100.0, max(0.0, risk_score))
    
    # Determine severity
    if risk_score >= 80.0:
        severity = "CRITICAL"
        recommendation = "Immediate IP block recommended via WAF/Security Group. Trigger PagerDuty security alert."
    elif risk_score >= 50.0:
        severity = "HIGH"
        recommendation = "Apply dynamic rate-limiting, challenge with MFA/CAPTCHA, and flag transaction for manual review."
    elif risk_score >= 20.0:
        severity = "MEDIUM"
        recommendation = "Log event for behavioral anomaly tracking; monitor IP session."
    else:
        severity = "LOW"
        recommendation = "Normal telemetry profile. Standard logging applied."

    is_threat = risk_score >= 40.0
    duration_ms = round((time.perf_counter() - start_time) * 1000, 2)
    
    # Prometheus Metrics Updates
    EVENTS_ANALYZED_TOTAL.labels(event_type=event.event_type, severity=severity).inc()
    RISK_SCORE_HISTOGRAM.observe(risk_score)
    if is_threat:
        threat_type = detected_patterns[0] if detected_patterns else "UNKNOWN_THREAT"
        THREATS_DETECTED_TOTAL.labels(threat_type=threat_type, severity=severity).inc()

    logger.info(
        f"Event {event_id} analyzed: risk={risk_score}, is_threat={is_threat}, severity={severity}",
        extra={"props": {"event_id": event_id, "risk_score": risk_score, "is_threat": is_threat, "severity": severity}}
    )

    return ThreatAnalysisResult(
        event_id=event_id,
        event_type=event.event_type,
        source_ip=event.source_ip,
        is_threat=is_threat,
        risk_score=risk_score,
        severity=severity,
        detected_patterns=detected_patterns,
        recommendation=recommendation,
        analyzed_at=datetime.now(timezone.utc).isoformat(),
        processing_time_ms=duration_ms,
    )
