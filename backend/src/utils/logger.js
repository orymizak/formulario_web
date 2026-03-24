const { createLogger, format, transports } = require('winston');
const { combine, timestamp, json, colorize, simple } = format;

const isProd = process.env.NODE_ENV === 'production';

const logger = createLogger({
  level: isProd ? 'info' : 'debug',
  format: combine(
    timestamp(),
    json()
  ),
  defaultMeta: { service: 'contactos-api' },
  transports: [
    // En Fargate, la consola es suficiente. 
    // AWS Logs Driver enviará esto a CloudWatch automáticamente.
    new transports.Console({
      format: isProd ? json() : combine(colorize(), simple()),
    }),
  ],
});

module.exports = logger;