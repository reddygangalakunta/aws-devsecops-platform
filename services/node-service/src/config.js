require('dotenv').config();

module.exports = {
  serviceName: process.env.SERVICE_NAME || 'node-gateway-service',
  version: process.env.VERSION || '1.0.0',
  environment: process.env.ENVIRONMENT || 'development',
  port: parseInt(process.env.PORT, 10) || 3000,
  host: process.env.HOST || '0.0.0.0',
  logLevel: process.env.LOG_LEVEL || 'info',
  
  // Downstream Python Analytics Microservice
  pythonServiceUrl: process.env.PYTHON_SERVICE_URL || 'http://localhost:8000',
  pythonTimeoutMs: parseInt(process.env.PYTHON_TIMEOUT_MS, 10) || 5000,
  
  // Rate Limiting
  rateLimitWindowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) || 15 * 60 * 1000,
  rateLimitMax: parseInt(process.env.RATE_LIMIT_MAX, 10) || 500,
};
