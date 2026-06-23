/**
 * config/db.js
 * MongoDB connection with retry logic, lifecycle events, and status tracking.
 *
 * Key behaviours:
 * - Retries up to MAX_RETRIES times before giving up
 * - Server keeps running while retrying — DB failure is non-fatal at boot
 * - getDBStatus() lets the health check report real-time connection state
 * - Graceful shutdown is handled here (not in server.js) to keep DB teardown
 *   co-located with DB setup
 */

const mongoose = require('mongoose');

const MAX_RETRIES    = 5;
const RETRY_DELAY_MS = 3000;

const MONGO_OPTIONS = {
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS:          45000,
  maxPoolSize:              10,
  minPoolSize:              2,
  retryWrites:              true,
  w:                        'majority',
};

// Mutable state — updated by connectDB and mongoose events
let dbStatus = {
  connected:   false,
  error:       null,
  connectedAt: null,
  retryCount:  0,
};

// ── Lifecycle events ──────────────────────────────────────────────────────────
mongoose.connection.on('connected', () => {
  dbStatus.connected   = true;
  dbStatus.error       = null;
  dbStatus.connectedAt = new Date().toISOString();
  console.log('📡 Mongoose connected');
});

mongoose.connection.on('disconnected', () => {
  dbStatus.connected = false;
  console.warn('⚠️  Mongoose disconnected');
});

mongoose.connection.on('reconnected', () => {
  dbStatus.connected   = true;
  dbStatus.connectedAt = new Date().toISOString();
  console.log('🔁 Mongoose reconnected');
});

mongoose.connection.on('error', (err) => {
  dbStatus.error = err.message;
  console.error('Mongoose error:', err.message);
});

// ── Connection ────────────────────────────────────────────────────────────────
async function connectDB() {
  const uri = process.env.MONGO_URI;

  if (!uri) {
    const msg = 'MONGO_URI is not defined — skipping DB connection';
    dbStatus.error = msg;
    console.error(`⚠️  ${msg}`);
    return; // non-fatal: server still starts
  }

  try {
    await mongoose.connect(uri, MONGO_OPTIONS);
    // 'connected' event above updates dbStatus
    console.log(`✅ MongoDB connected: ${mongoose.connection.host}`);
    dbStatus.retryCount = 0;
  } catch (err) {
    dbStatus.error     = err.message;
    dbStatus.connected = false;
    console.error(`❌ MongoDB connection error: ${err.message}`);

    if (dbStatus.retryCount < MAX_RETRIES) {
      dbStatus.retryCount++;
      console.log(
        `🔄 Retrying (${dbStatus.retryCount}/${MAX_RETRIES}) in ${RETRY_DELAY_MS / 1000}s…`
      );
      setTimeout(connectDB, RETRY_DELAY_MS);
    } else {
      // All retries exhausted — log clearly but do NOT call process.exit() here.
      // Let server.js decide whether to keep running or shut down based on
      // whether any modules actually need the DB.
      console.error('💀 Max MongoDB retries reached. DB is unavailable.');
      dbStatus.error = 'Max retries reached — DB unavailable';
    }
  }
}

// ── Graceful shutdown ─────────────────────────────────────────────────────────
// Called by server.js during SIGINT / SIGTERM so DB teardown stays here,
// next to the connection logic.
async function disconnectDB(signal = 'shutdown') {
  if (mongoose.connection.readyState === 0) return; // already closed
  console.log(`\n${signal}: closing MongoDB connection…`);
  await mongoose.connection.close();
  console.log('MongoDB connection closed.');
}

// ── Status ────────────────────────────────────────────────────────────────────
function getDBStatus() {
  return { ...dbStatus };
}

module.exports = { connectDB, disconnectDB, getDBStatus };