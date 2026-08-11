const http = require('http');
const app = require('./app');
const config = require('./config');
const logger = require('./utils/logger');
const { initWebSocketServer } = require('./services/websocketServer');

const server = http.createServer(app);

// Initialize WebSocket server on the same HTTP server
const wss = initWebSocketServer(server);

server.listen(config.port, config.host, () => {
  logger.info(`🚀 ${config.serviceName} listening on http://${config.host}:${config.port} (env: ${config.environment})`);
  logger.info(`📡 WebSocket server live at ws://${config.host}:${config.port}/ws/events`);
  logger.info(`🩺 Health check at http://${config.host}:${config.port}/health`);
  logger.info(`📊 Prometheus metrics at http://${config.host}:${config.port}/metrics`);
});

// Graceful Shutdown for Kubernetes & Docker
function gracefulShutdown(signal) {
  logger.info(`Received ${signal}. Starting graceful shutdown...`);

  // Close WebSocket connections
  if (wss) {
    wss.clients.forEach((client) => {
      client.close(1001, 'Server shutting down');
    });
  }

  // Stop accepting new HTTP requests
  server.close(() => {
    logger.info('HTTP server closed. Exiting process.');
    process.exit(0);
  });

  // Force close if graceful shutdown exceeds 10s
  setTimeout(() => {
    logger.error('Could not close connections in time, forcefully shutting down');
    process.exit(1);
  }, 10000);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

module.exports = server;
