const express = require('express');
const router = express.Router();
const config = require('../config');
const { checkPythonHealth } = require('../services/pythonClient');
const { getActiveClientCount } = require('../services/websocketServer');

const startTime = Date.now();

/**
 * Detailed Aggregated Health Check for Kubernetes and CI/CD Verification
 */
router.get('/health', async (req, res) => {
  const uptimeSeconds = Math.round((Date.now() - startTime) / 1000);
  const memory = process.memoryUsage();
  
  // Check downstream Python service
  const pythonStatus = await checkPythonHealth();

  const isHealthy = pythonStatus.status === 'UP';
  const overallStatus = isHealthy ? 'healthy' : 'degraded';

  const responsePayload = {
    status: overallStatus,
    service: config.serviceName,
    version: config.version,
    timestamp: new Date().toISOString(),
    uptime_seconds: uptimeSeconds,
    system: {
      environment: config.environment,
      node_version: process.version,
      pid: process.pid,
      memory_rss_mb: Math.round((memory.rss / (1024 * 1024)) * 100) / 100,
      heap_used_mb: Math.round((memory.heapUsed / (1024 * 1024)) * 100) / 100,
      active_ws_clients: getActiveClientCount(),
    },
    dependencies: {
      python_analytics_service: pythonStatus,
    },
  };

  // Return 200 even if degraded so CI/CD can read json diagnostics, or 503 if strict unhealthy
  res.status(200).json(responsePayload);
});

/**
 * Kubernetes Liveness Probe:
 * Simple fast 200 response to confirm Node.js process is active
 */
router.get(['/health/live', '/healthz', '/livez'], (req, res) => {
  res.status(200).json({
    status: 'alive',
    service: config.serviceName,
    timestamp: new Date().toISOString(),
  });
});

/**
 * Kubernetes Readiness Probe:
 * Confirms gateway is ready to receive and route traffic
 */
router.get(['/health/ready', '/readyz'], (req, res) => {
  res.status(200).json({
    status: 'ready',
    service: config.serviceName,
    ready: true,
  });
});

module.exports = router;
