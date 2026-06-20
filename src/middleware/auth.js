const jwt = require('jsonwebtoken');
const { logActivity } = require('../utils/ActivityLogger');

const AUTO_LOGOUT_ROLES = ['sales', 'viewer', 'technician'];
const AUTO_LOGOUT_TTL_SECONDS = 60 * 60;

const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Authentication required', code: 'NO_TOKEN' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET, {
      algorithms: ['HS256'],
    });

    if (AUTO_LOGOUT_ROLES.includes(decoded.role)) {
      const tokenAge = Math.floor(Date.now() / 1000) - decoded.iat;
      if (tokenAge > AUTO_LOGOUT_TTL_SECONDS) {
        await logActivity({
          user_id: decoded.id,
          user_name: decoded.name,
          user_role: decoded.role,
          action: ActivityActions.SESSION_EXPIRED,
          description: `Session expired for user: ${decoded.email}`,
          metadata: { email: decoded.email, tokenAge },
          req,
          status: 'failure',
        });
        return res.status(401).json({
          error: 'Session expired. Please log in again.',
          code: 'SESSION_EXPIRED',
        });
      }
    }

    req.user = decoded;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token has expired', code: 'TOKEN_EXPIRED' });
    }
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'Invalid token', code: 'INVALID_TOKEN' });
    }
    console.error('Auth middleware error:', error);
    return res.status(500).json({ error: 'Internal server error', code: 'SERVER_ERROR' });
  }
};

// ─── NEW: x-entity middleware ─────────────────────────────────────────────────

/**
 * Validates the x-entity header against the authenticated user's entity access.
 *
 * Rules:
 *  - Header is required on all routes that use this middleware.
 *  - super_admin bypasses entity checks (can access any entity).
 *  - All other roles must have the requested entity UUID in their
 *    token's `entities` array (e.g. decoded.entities = ['uuid-1', 'uuid-2']).
 *
 * Usage: router.get('/inventory', authenticate, requireEntity, authorize('admin'), handler)
 */
const requireEntity = (req, res, next) => {
  const entityId = req.headers['x-entity'];

  if (!entityId) {
    return res.status(400).json({
      error: 'x-entity header is required.',
      code: 'MISSING_ENTITY',
    });
  }

  // super_admin can act on any entity — skip membership check
  if (req.user.role === 'super_admin' || req.user.role === 'admin') {
    req.entityId = entityId;
    return next();
  }

  // All other roles must belong to the requested entity
  const userEntities = req.user.entities ?? [];
  if (!userEntities.includes(entityId)) {
    return res.status(403).json({
      error: 'Access to this entity is not permitted.',
      code: 'ENTITY_ACCESS_DENIED',
    });
  }

  // Attach for use in downstream handlers/services
  req.entityId = entityId;
  next();
};

// ─────────────────────────────────────────────────────────────────────────────

const authorize = (...allowedRoles) => (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Not authenticated', code: 'NOT_AUTHENTICATED' });
  }
  if (!allowedRoles.includes(req.user.role)) {
    return res.status(403).json({ error: 'Insufficient permissions', code: 'FORBIDDEN' });
  }
  next();
};

const requirePermission = (permission) => (req, res, next) => {
  if (!req.user?.permissions?.includes(permission)) {
    return res.status(403).json({
      error: `Permission denied: ${permission}`,
      code: 'PERMISSION_DENIED',
    });
  }
  next();
};

module.exports = { authenticate, authorize, requirePermission, requireEntity };