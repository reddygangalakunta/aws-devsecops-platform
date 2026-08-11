const axios = require('axios');
const config = require('../config');
const logger = require('../utils/logger');
const { downstreamLatencyHistogram } = require('../utils/metrics');

const client = axios.create({
  baseURL: config.pythonServiceUrl,
  timeout: config.pythonTimeoutMs,
  headers: {
    'Content-Type': 'application/json',
    'User-Agent': `${config.serviceName}/${config.version}`,
  },
});

/**
 * Check health of downstream Python microservice
 */
async function checkPythonHealth() {
  const start = Date.now();
  try {
    const response = await client.get('/health', { timeout: 3000 });
    const duration = (Date.now() - start) / 1000;
    downstreamLatencyHistogram.labels('/health', 'success').observe(duration);
    return {
      status: 'UP',
      latencyMs: Math.round(duration * 1000),
      data: response.data,
    };
  } catch (error) {
    const duration = (Date.now() - start) / 1000;
    downstreamLatencyHistogram.labels('/health', 'error').observe(duration);
    logger.warn('Downstream Python service health check failed', { error: error.message });
    return {
      status: 'DEGRADED',
      latencyMs: Math.round(duration * 1000),
      error: error.message,
    };
  }
}

/**
 * Forward event payload to Python service for real-time security & anomaly analysis
 */
async function analyzeEventWithPython(eventPayload) {
  const start = Date.now();
  try {
    const response = await client.post('/api/v1/analyze', eventPayload);
    const duration = (Date.now() - start) / 1000;
    downstreamLatencyHistogram.labels('/api/v1/analyze', 'success').observe(duration);
    return response.data;
  } catch (error) {
    const duration = (Date.now() - start) / 1000;
    downstreamLatencyHistogram.labels('/api/v1/analyze', 'error').observe(duration);
    logger.error('Failed to communicate with Python analytics microservice', {
      error: error.message,
      event: eventPayload.id,
    });

    // Fallback local heuristic in case Python service is momentarily down
    return {
      event_id: eventPayload.id || 'fallback-id',
      event_type: eventPayload.event_type,
      source_ip: eventPayload.source_ip,
      is_threat: false,
      risk_score: 0.0,
      severity: 'UNKNOWN',
      detected_patterns: ['DOWNSTREAM_UNAVAILABLE_FALLBACK'],
      recommendation: 'Downstream analytics service offline. Event queued/logged.',
      analyzed_at: new Date().toISOString(),
      processing_time_ms: Math.round(duration * 1000),
    };
  }
}

module.exports = {
  checkPythonHealth,
  analyzeEventWithPython,
};
