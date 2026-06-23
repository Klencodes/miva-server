/**
 * app.js
 * Application factory. Thin orchestrator — all concerns live in their own modules.
 *
 * Boot order:
 *   1. Core middleware (CORS, body, session, logger)
 *   2. Database connection  (non-fatal if it fails)
 *   3. Route modules        (non-fatal per-module via moduleLoader)
 *   4. Health check route   (always available, reports module + DB status)
 *   5. 404 + error handlers
 */

require('dotenv').config();

const express = require('express');

const { applyCoreMiddleware }              = require('./middleware/core');
const { notFoundHandler, globalErrorHandler } = require('./middleware/errorHandler');
const { connectDB, getDBStatus }           = require('./config/db');
const { loadModules }                      = require('./modules/moduleLoader');

const app = express();

// ── 1. Core middleware ────────────────────────────────────────────────────────
applyCoreMiddleware(app);

// ── 2. Database (non-blocking) ────────────────────────────────────────────────
connectDB(); // errors are caught internally — server still starts

// ── 3. Route modules (fault-isolated) ────────────────────────────────────────
//    loadModules returns { loaded, failed } used by the health check.
//    Broken modules get a 503 stub — everything else keeps working.
const moduleStatus = loadModules(app);

// ── 4. Health check (always available) ───────────────────────────────────────
app.get('/health', (_req, res) => {
  const db = getDBStatus();

  res.json({
    status:      'ok',
    timestamp:   new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    database: {
      connected:   db.connected,
      connectedAt: db.connectedAt,
      error:       db.error ?? undefined,
    },
    modules: {
      loaded: moduleStatus.loaded,
      failed: moduleStatus.failed,   // {} when everything is fine
    },
  });
});

// ── 5. Catch-alls (must come last) ───────────────────────────────────────────
app.use(notFoundHandler);
app.use(globalErrorHandler);

module.exports = app;