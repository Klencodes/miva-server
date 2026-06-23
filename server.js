/**
 * server.js
 * Entry point. Starts the HTTP server and wires graceful shutdown.
 * Kept separate from app.js so tests can import the app without binding a port.
 */

require('dotenv').config();

const app               = require('./src/app');
const { disconnectDB }  = require('./src/config/db');

const PORT = process.env.PORT || 4000;

const server = app.listen(PORT, () => {
  console.log(`\n🚀 Server running on port ${PORT}`);
  console.log(`📍 Environment : ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔗 Health check: http://localhost:${PORT}/health\n`);
});

// ── Graceful shutdown ─────────────────────────────────────────────────────────
async function gracefulShutdown(signal) {
  console.log(`\n${signal} received — shutting down gracefully…`);

  server.close(async () => {
    await disconnectDB(signal); // DB teardown lives in config/db.js
    console.log('HTTP server closed.');
    process.exit(0);
  });

  setTimeout(() => {
    console.error('Could not close connections in time — forcing shutdown');
    process.exit(1);
  }, 30_000);
}

process.on('SIGINT',  () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  gracefulShutdown('uncaughtException');
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  gracefulShutdown('unhandledRejection');
});