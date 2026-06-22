// middleware/auth.js
const jwt = require('jsonwebtoken');
const { logActivity } = require('../utils/ActivityLogger');

const AUTO_LOGOUT_ROLES = ['sales', 'viewer', 'technician'];
const AUTO_LOGOUT_TTL_SECONDS = 60 * 60;

const ActivityActions = {
  SESSION_EXPIRED: 'session_expired',
  LOGIN: 'login',
  LOGOUT: 'logout',
  USER_CREATED: 'user_created',
  USER_UPDATED: 'user_updated',
  USER_DELETED: 'user_deleted',
  PASSWORD_CHANGED: 'password_changed',
  ENTITY_CREATED: 'entity_created',
  ENTITY_UPDATED: 'entity_updated',
  ENTITY_DELETED: 'entity_deleted',
};

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

const getCurrentEntity = (req) => {
  if (req.entityId) {
    return req.entityId;
  }
  const entityId = req.headers['x-entity'];
  return entityId || null;
};

const requireEntity = (req, res, next) => {
  const entityId = req.headers['x-entity'];

  if (!entityId) {
    return res.status(400).json({
      error: 'x-entity header is required.',
      code: 'MISSING_ENTITY',
    });
  }

  // super_admin and admin can access any entity including ALL_ENTITIES
  if (req.user.role === 'super_admin' || req.user.role === 'admin') {
    req.entityId = entityId;
    return next();
  }

  // ALL_ENTITIES is restricted to super_admin/admin only
  if (entityId === 'ALL_ENTITIES') {
    return res.status(403).json({
      error: 'Access to all entities is not permitted.',
      code: 'ENTITY_ACCESS_DENIED',
    });
  }

  // All other roles must belong to the requested entity
  const userEntities = req.user.entities ?? [];
  if (!userEntities.includes(entityId)) {
    return res.status(403).json({
      error: 'Access to this entity is not permitted.',
      code: 'ENTITY_ACCESS_DENIED',
    });
  }

  req.entityId = entityId;
  next();
};

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

module.exports = {
  authenticate,
  authorize,
  requirePermission,
  requireEntity,
  getCurrentEntity,
};