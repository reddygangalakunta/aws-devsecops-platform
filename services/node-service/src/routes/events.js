const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const logger = require('../utils/logger');
const { eventsIngestedTotal } = require('../utils/metrics');
const { analyzeEventWithPython } = require('../services/pythonClient');
const { broadcastEvent } = require('../services/websocketServer');

// In-memory ring buffer for recent events (last 100)
const MAX_HISTORY = 100;
const eventHistory = [];

// Aggregate stats counters
const aggregateStats = {
  totalProcessed: 0,
  threatsDetected: 0,
  benignEvents: 0,
  threatsBySeverity: {
    LOW: 0,
    MEDIUM: 0,
    HIGH: 0,
    CRITICAL: 0,
    UNKNOWN: 0,
  },
};

/**
 * Ingest and process a real-time event
 */
router.post('/events', async (req, res) => {
  const { event_type, source_ip, user_id, payload } = req.body;

  if (!event_type || !source_ip) {
    return res.status(400).json({
      error: 'Validation failed: event_type and source_ip are required fields',
    });
  }

  const eventId = req.body.id || `evt-${crypto.randomUUID()}`;
  const timestamp = req.body.timestamp || new Date().toISOString();

  const eventData = {
    id: eventId,
    event_type,
    source_ip,
    user_id: user_id || 'anonymous',
    payload: payload || {},
    timestamp,
  };

  try {
    // 1. Analyze with Python Microservice
    const analysisResult = await analyzeEventWithPython(eventData);

    // 2. Track Metrics
    eventsIngestedTotal.labels(event_type, analysisResult.is_threat ? 'threat' : 'normal').inc();

    // 3. Update stats & history
    aggregateStats.totalProcessed++;
    if (analysisResult.is_threat) {
      aggregateStats.threatsDetected++;
    } else {
      aggregateStats.benignEvents++;
    }
    const severity = analysisResult.severity || 'LOW';
    aggregateStats.threatsBySeverity[severity] = (aggregateStats.threatsBySeverity[severity] || 0) + 1;

    const fullEvent = {
      ...eventData,
      analysis: analysisResult,
    };

    eventHistory.unshift(fullEvent);
    if (eventHistory.length > MAX_HISTORY) {
      eventHistory.pop();
    }

    // 4. Broadcast in real time via WebSocket
    broadcastEvent(fullEvent);

    logger.info(`Event processed: ${eventId}`, {
      type: event_type,
      is_threat: analysisResult.is_threat,
      risk_score: analysisResult.risk_score,
      severity: analysisResult.severity,
    });

    res.status(201).json(fullEvent);
  } catch (error) {
    logger.error('Error processing event ingestion', { error: error.message });
    res.status(500).json({ error: 'Internal server error processing event' });
  }
});

/**
 * Retrieve recent event stream history
 */
router.get('/events', (req, res) => {
  const limit = parseInt(req.query.limit, 10) || 50;
  res.status(200).json({
    count: Math.min(limit, eventHistory.length),
    total: eventHistory.length,
    events: eventHistory.slice(0, limit),
  });
});

/**
 * Summary stats for dashboard
 */
router.get('/stats', (req, res) => {
  res.status(200).json({
    timestamp: new Date().toISOString(),
    stats: aggregateStats,
  });
});

module.exports = router;
