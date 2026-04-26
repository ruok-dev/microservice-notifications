'use strict';

// Load & validate env first — will throw if required vars are missing
const env = require('./config/env');
const logger = require('./utils/logger');
const { createApp } = require('./app');
const { connect: connectRabbitMQ, close: closeRabbitMQ } = require('./config/rabbitmq');
const { close: closeDB } = require('./config/database');
const { startEmailConsumer } = require('./queues/emailConsumer');
const { startWebhookConsumer } = require('./queues/webhookConsumer');

async function bootstrap() {
  // ── Connect to dependencies ───────────────────────────────
  await connectRabbitMQ();
  logger.info('RabbitMQ connected');

  // ── Start queue consumers ─────────────────────────────────
  await startEmailConsumer();
  await startWebhookConsumer();
  logger.info('Queue consumers started');

  // ── Start HTTP server ─────────────────────────────────────
  const app = createApp();
  const server = app.listen(env.node.port, () => {
    logger.info(
      { port: env.node.port, env: env.node.env, version: env.node.apiVersion },
      '🚀 Notification service is running',
    );
  });

  // ── Graceful shutdown ────────────────────────────────────
  async function shutdown(signal) {
    logger.info({ signal }, 'Shutdown signal received — draining connections...');

    server.close(async () => {
      try {
        await closeRabbitMQ();
        await closeDB();
        logger.info('Graceful shutdown complete');
        process.exit(0);
      } catch (err) {
        logger.error({ err }, 'Error during shutdown');
        process.exit(1);
      }
    });

    // Force exit after 15 s if drain takes too long
    setTimeout(() => {
      logger.error('Forced shutdown after timeout');
      process.exit(1);
    }, 15000).unref();
  }

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  // Catch uncaught exceptions — log and exit cleanly
  process.on('uncaughtException', (err) => {
    logger.fatal({ err }, 'Uncaught exception — shutting down');
    shutdown('uncaughtException');
  });

  process.on('unhandledRejection', (reason) => {
    logger.fatal({ reason }, 'Unhandled promise rejection — shutting down');
    shutdown('unhandledRejection');
  });
}

bootstrap().catch((err) => {
  // Use console here because logger may not be ready
  console.error('Fatal startup error:', err);
  process.exit(1);
});
