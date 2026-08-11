const express = require('express');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const config = require('./config');
const { httpRequestsTotal, httpRequestDurationSeconds } = require('./utils/metrics');
const healthRoutes = require('./routes/health');
const metricsRoutes = require('./routes/metrics');
const eventRoutes = require('./routes/events');

const app = express();

// Security Headers (configured to allow inline styles/scripts for demo dashboard)
app.use(
  helmet({
    contentSecurityPolicy: false, // Disabled for local dashboard inline assets & websocket
    crossOriginEmbedderPolicy: false,
  })
);

// CORS
app.use(cors());

// Body Parsers
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// Rate Limiter
const limiter = rateLimit({
  windowMs: config.rateLimitWindowMs,
  max: config.rateLimitMax,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
  skip: (req) => req.path.startsWith('/health') || req.path === '/metrics',
});
app.use('/api/', limiter);

// Prometheus HTTP Metrics Middleware
app.use((req, res, next) => {
  const start = process.hrtime();

  res.on('finish', () => {
    const diff = process.hrtime(start);
    const durationInSeconds = diff[0] + diff[1] / 1e9;
    const route = req.baseUrl + (req.route ? req.route.path : req.path);

    httpRequestsTotal.labels(req.method, route, res.statusCode).inc();
    httpRequestDurationSeconds.labels(req.method, route, res.statusCode).observe(durationInSeconds);
  });

  next();
});

// Static Dashboard Assets
app.use(express.static(path.join(__dirname, '../public')));

// Mount API Routes
app.use(healthRoutes);
app.use(metricsRoutes);
app.use('/api/v1', eventRoutes);

// Root fallback to dashboard
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// 404 Handler
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found', path: req.originalUrl });
});

// Global Error Handler
app.use((err, req, res, next) => {
  res.status(500).json({
    error: 'Internal Server Error',
    message: config.environment === 'development' ? err.message : undefined,
  });
});

module.exports = app;
