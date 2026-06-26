/**
 * middleware/core.js
 * Sets up all shared Express middleware (CORS, body parsing, sessions, logging).
 * Extracted so app.js stays slim and this can be tested or swapped independently.
 */

const cors    = require('cors');
const express = require('express');
const session = require('express-session');

const ALLOWED_ORIGINS = [
  process.env.FRONTEND_URL,
  'http://localhost:3000',
  'http://localhost:4000',
  'http://localhost:5000',
  'https://miva-chi.vercel.app',
  '*'
].filter(Boolean); // drop undefined if FRONTEND_URL isn't set

function applyCoreMiddleware(app) {
  // ── CORS ────────────────────────────────────────────────────────────────────
  app.use(cors({
    origin:         "*",
    methods:        ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Entity', 'X-Requested-With'],
    credentials:    true,
  }));

  // ── Body parsing ─────────────────────────────────────────────────────────────
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // ── Sessions ─────────────────────────────────────────────────────────────────
  app.use(session({
    secret:            process.env.JWT_SECRET || 'fallback-secret-change-this',
    resave:            false,
    saveUninitialized: false,
    cookie: {
      secure:   process.env.NODE_ENV === 'production',
      httpOnly: true,
      maxAge:   24 * 60 * 60 * 1000, // 24 hours
    },
  }));

  // ── Request logger ────────────────────────────────────────────────────────────
  app.use((req, _res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
    next();
  });
}

module.exports = { applyCoreMiddleware };