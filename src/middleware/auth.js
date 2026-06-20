const jwt = require('jsonwebtoken');
const { logActivity } = require('../utils/ActivityLogger');

// Roles that get auto-logout (shorter session TTL enforced here)
const AUTO_LOGOUT_ROLES = ['sales', 'viewer', 'technician'];
const AUTO_LOGOUT_TTL_SECONDS = 60 * 60; // 1 hour

const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Authentication required', code: 'NO_TOKEN' });
    }

    const token = authHeader.split(' ')[1];

    // Verify signature + expiry
    const decoded = jwt.verify(token, process.env.JWT_SECRET, {
      algorithms: ['HS256'],
    });

    // Enforce shorter TTL for restricted roles regardless of token expiry
    if (AUTO_LOGOUT_ROLES.includes(decoded.role)) {
  const tokenAge = Math.floor(Date.now() / 1000) - decoded.iat;
  if (tokenAge > AUTO_LOGOUT_TTL_SECONDS) {
    // Log session expiry
    await logActivity({
      user_id: decoded.id,
      user_name: decoded.name,
      user_role: decoded.role,
      action: ActivityActions.SESSION_EXPIRED,
      description: `Session expired for user: ${decoded.email}`,
      metadata: { email: decoded.email, tokenAge },
      req,
      status: 'failure'
    });
    
    return res.status(401).json({
      error: 'Session expired. Please log in again.',
      code: 'SESSION_EXPIRED',
    });
  }
}

    // Attach user to request
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

/**
 * Role-based access control middleware factory.
 * Usage: router.get('/admin', authenticate, authorize('admin', 'super_admin'), handler)
 */
const authorize = (...allowedRoles) => (req, res, next) => {
  console.log(req.user, "req.user>>>>>")
  if (!req.user) {
    return res.status(401).json({ error: 'Not authenticated', code: 'NOT_AUTHENTICATED' });
  }
  if (!allowedRoles.includes(req.user.role)) {
    return res.status(403).json({ error: 'Insufficient permissions', code: 'FORBIDDEN' });
  }
  next();
};

/**
 * Permission-based guard middleware factory.
 * Usage: requirePermission('can_delete_inventory')
 */
const requirePermission = (permission) => (req, res, next) => {
  if (!req.user?.permissions?.includes(permission)) {
    return res.status(403).json({
      error: `Permission denied: ${permission}`,
      code: 'PERMISSION_DENIED',
    });
  }
  next();
};

module.exports = { authenticate, authorize, requirePermission };