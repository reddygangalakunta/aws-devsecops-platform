from prometheus_client import Counter, Histogram, Gauge, generate_latest, CONTENT_TYPE_LATEST, REGISTRY

# HTTP Metrics
HTTP_REQUESTS_TOTAL = Counter(
    "python_http_requests_total",
    "Total HTTP requests received by Python service",
    ["method", "endpoint", "status_code"],
)

HTTP_REQUEST_DURATION_SECONDS = Histogram(
    "python_http_request_duration_seconds",
    "HTTP request latency in seconds",
    ["method", "endpoint"],
    buckets=[0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0],
)

# Business / Security Metrics
EVENTS_ANALYZED_TOTAL = Counter(
    "security_events_analyzed_total",
    "Total security events processed by analytics engine",
    ["event_type", "severity"],
)

THREATS_DETECTED_TOTAL = Counter(
    "security_threats_detected_total",
    "Total threats flagged by analytics engine",
    ["threat_type", "severity"],
)

RISK_SCORE_HISTOGRAM = Histogram(
    "security_event_risk_score",
    "Distribution of calculated security risk scores (0-100)",
    buckets=[0, 10, 25, 50, 75, 90, 100],
)

ACTIVE_SYSTEM_HEALTH_GAUGE = Gauge(
    "system_health_status",
    "System health status (1 = healthy, 0 = degraded/unhealthy)",
    ["service_name"],
)

ACTIVE_SYSTEM_HEALTH_GAUGE.labels(service_name="threat-analytics-service").set(1)

def get_metrics_output():
    return generate_latest(REGISTRY), CONTENT_TYPE_LATEST
