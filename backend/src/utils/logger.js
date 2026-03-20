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
    // Consola (siempre)
    new transports.Console({
      format: isProd ? json() : combine(colorize(), simple()),
    }),
  ],
});

// CloudWatch en producción
if (isProd && process.env.CW_LOG_GROUP) {
  try {
    const WinstonCloudWatch = require('winston-cloudwatch');
    logger.add(new WinstonCloudWatch({
      logGroupName: process.env.CW_LOG_GROUP,
      logStreamName: process.env.CW_LOG_STREAM || 'app',
      awsRegion: process.env.AWS_REGION || 'us-east-1',
      jsonMessage: true,
    }));
  } catch {
    // winston-cloudwatch es opcional en desarrollo
  }
}

module.exports = logger;
