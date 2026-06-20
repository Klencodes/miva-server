// src/utils/permissions.js
const { Permissions } = require('../models/User');

/**
 * Check if user has a specific permission
 */
const hasPermission = (user, permission) => {
  if (!user || !user.permissions) return false;
  return user.permissions.includes(permission);
};

/**
 * Check if user has any of the given permissions
 */
const hasAnyPermission = (user, permissionList) => {
  if (!user || !user.permissions) return false;
  return permissionList.some(p => user.permissions.includes(p));
};

/**
 * Check if user has all of the given permissions
 */
const hasAllPermissions = (user, permissionList) => {
  if (!user || !user.permissions) return false;
  return permissionList.every(p => user.permissions.includes(p));
};

/**
 * Check if user is admin or super admin
 */
const isAdmin = (user) => {
  return user && (user.role === 'admin' || user.role === 'super_admin');
};

/**
 * Middleware to check if user has permission
 */
const requirePermission = (permission) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        message: 'Unauthorized',
        code: 'UNAUTHORIZED',
        success: false
      });
    }
    
    if (!hasPermission(req.user, permission)) {
      return res.status(403).json({
        message: 'Forbidden: Insufficient permissions',
        code: 'FORBIDDEN',
        success: false
      });
    }
    
    next();
  };
};

/**
 * Middleware to check if user has any of the given permissions
 */
const requireAnyPermission = (permissionList) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        message: 'Unauthorized',
        code: 'UNAUTHORIZED',
        success: false
      });
    }
    
    if (!hasAnyPermission(req.user, permissionList)) {
      return res.status(403).json({
        message: 'Forbidden: Insufficient permissions',
        code: 'FORBIDDEN',
        success: false
      });
    }
    
    next();
  };
};

module.exports = {
  Permissions,
  hasPermission,
  hasAnyPermission,
  hasAllPermissions,
  isAdmin,
  requirePermission,
  requireAnyPermission
};