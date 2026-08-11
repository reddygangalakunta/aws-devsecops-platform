const WebSocket = require('ws');
const logger = require('../utils/logger');
const { wsClientsActive, threatAlertsForwardedTotal } = require('../utils/metrics');

let wss = null;
const connectedClients = new Set();

function initWebSocketServer(server) {
  wss = new WebSocket.Server({ server, path: '/ws/events' });

  wss.on('connection', (ws, req) => {
    connectedClients.add(ws);
    wsClientsActive.set(connectedClients.size);
    
    const clientIp = req.socket.remoteAddress;
    logger.info(`WebSocket client connected from ${clientIp}. Total active: ${connectedClients.size}`);

    // Send initial welcome & connection state
    ws.send(JSON.stringify({
      type: 'CONNECTION_ESTABLISHED',
      timestamp: new Date().toISOString(),
      activeClients: connectedClients.size,
      message: 'Connected to DevSecOps Real-Time Telemetry Stream',
    }));

    ws.isAlive = true;
    ws.on('pong', () => {
      ws.isAlive = true;
    });

    ws.on('message', (message) => {
      try {
        const parsed = JSON.parse(message);
        if (parsed.type === 'PING') {
          ws.send(JSON.stringify({ type: 'PONG', timestamp: new Date().toISOString() }));
        }
      } catch (err) {
        logger.debug('Received raw ws message', { data: message.toString() });
      }
    });

    ws.on('close', () => {
      connectedClients.delete(ws);
      wsClientsActive.set(connectedClients.size);
      logger.info(`WebSocket client disconnected. Total active: ${connectedClients.size}`);
    });

    ws.on('error', (err) => {
      logger.error('WebSocket client error', { error: err.message });
    });
  });

  // Heartbeat / ping-pong interval to clean up dead sockets
  const heartbeatInterval = setInterval(() => {
    if (!wss) return;
    wss.clients.forEach((ws) => {
      if (ws.isAlive === false) {
        connectedClients.delete(ws);
        wsClientsActive.set(connectedClients.size);
        return ws.terminate();
      }
      ws.isAlive = false;
      ws.ping();
    });
  }, 30000);

  wss.on('close', () => {
    clearInterval(heartbeatInterval);
  });

  return wss;
}

/**
 * Broadcast an analyzed event to all connected dashboard clients in real time
 */
function broadcastEvent(analyzedEvent) {
  if (!wss || connectedClients.size === 0) return;

  const payload = JSON.stringify({
    type: 'SECURITY_EVENT_STREAM',
    timestamp: new Date().toISOString(),
    data: analyzedEvent,
  });

  if (analyzedEvent.is_threat) {
    threatAlertsForwardedTotal.labels(analyzedEvent.severity).inc();
  }

  connectedClients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(payload);
    }
  });
}

function getActiveClientCount() {
  return connectedClients.size;
}

module.exports = {
  initWebSocketServer,
  broadcastEvent,
  getActiveClientCount,
};
