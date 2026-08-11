const winston = require('winston');
const config = require('../config');

const logger = winston.createLogger({
  level: config.logLevel,
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: {
    service: config.serviceName,
    env: config.environment,
    version: config.version,
  },
  transports: [
    new winston.transports.Console({
      format: config.environment === 'development'
        ? winston.format.combine(
            winston.format.colorize(),
            winston.format.printf(({ timestamp, level, message, service, ...meta }) => {
              const extra = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
              return `[${timestamp}] [${service}] [${level}]: ${message}${extra}`;
            })
          )
        : winston.format.json(),
    }),
  ],
});

module.exports = logger;
