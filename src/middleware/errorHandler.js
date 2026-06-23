/**
 * middleware/errorHandler.js
 * Global error handler + 404 handler.
 * Mount these AFTER all routes.
 */

const isDev = process.env.NODE_ENV === 'development';

// 404 — no route matched
function notFoundHandler(req, res) {
  res.status(404).json({
    error:  'Route not found',
    path:   req.path,
    method: req.method,
  });
}

// 500 — something threw in a route or middleware
function globalErrorHandler(err, req, res, _next) {
  console.error('Unhandled error:', {
    message: err.message,
    stack:   isDev ? err.stack : undefined,
    path:    req.path,
    method:  req.method,
  });

  if (err.name === 'ValidationError') {
    return res.status(400).json({ error: 'Validation error', details: err.message });
  }
  if (err.name === 'CastError') {
    return res.status(400).json({ error: 'Invalid ID format' });
  }
  if (err.code === 11000) {
    return res.status(409).json({
      error: 'Duplicate key error',
      field: Object.keys(err.keyPattern || {})[0],
    });
  }

  res.status(500).json({
    error:   'Internal server error',
    message: isDev ? err.message : undefined,
  });
}

module.exports = { notFoundHandler, globalErrorHandler };