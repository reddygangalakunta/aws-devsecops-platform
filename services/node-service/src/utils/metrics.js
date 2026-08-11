const client = require('prom-client');

// Initialize Registry
const register = new client.Registry();

// Add default system/runtime metrics (Event loop, GC, Heap, CPU)
client.collectDefaultMetrics({
  register,
  prefix: 'node_',
});

// Custom HTTP Metrics
const httpRequestsTotal = new client.Counter({
  name: 'node_http_requests_total',
  help: 'Total HTTP requests processed by Node.js service',
  labelNames: ['method', 'route', 'status_code'],
  registers: [register],
});

const httpRequestDurationSeconds = new client.Histogram({
  name: 'node_http_request_duration_seconds',
  help: 'HTTP request duration in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
  registers: [register],
});

// Real-Time WebSocket Metrics
const wsClientsActive = new client.Gauge({
  name: 'websocket_clients_active',
  help: 'Number of active WebSocket client connections',
  registers: [register],
});

// Business & Event Telemetry Metrics
const eventsIngestedTotal = new client.Counter({
  name: 'gateway_events_ingested_total',
  help: 'Total real-time events ingested through gateway',
  labelNames: ['event_type', 'status'],
  registers: [register],
});

const threatAlertsForwardedTotal = new client.Counter({
  name: 'gateway_threat_alerts_forwarded_total',
  help: 'Total threat alerts forwarded to WebSocket subscribers',
  labelNames: ['severity'],
  registers: [register],
});

const downstreamLatencyHistogram = new client.Histogram({
  name: 'downstream_python_request_duration_seconds',
  help: 'Latency of requests sent to Python analytics microservice',
  labelNames: ['endpoint', 'status'],
  buckets: [0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5],
  registers: [register],
});

module.exports = {
  register,
  httpRequestsTotal,
  httpRequestDurationSeconds,
  wsClientsActive,
  eventsIngestedTotal,
  threatAlertsForwardedTotal,
  downstreamLatencyHistogram,
};
