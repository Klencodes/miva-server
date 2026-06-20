const { ActivityLog, ActivityActions } = require('../models/ActivityLog');

/**
 * Log an activity. Non-blocking — failures are caught silently so they
 * never interrupt the main request flow.
 *
 * @param {Object} params
 * @param {string} params.user_id
 * @param {string} params.user_name
 * @param {string} params.user_role
 * @param {string} params.action   - one of ActivityActions
 * @param {string} [params.resource]
 * @param {string} [params.resource_id]
 * @param {string} [params.description]
 * @param {Object} [params.metadata]
 * @param {import('express').Request} [params.req] - pass to auto-extract IP + UA
 * @param {'success'|'failure'} [params.status='success']
 */
const logActivity = async ({
  user_id,
  user_name,
  user_role,
  action,
  resource,
  resource_id,
  description,
  metadata,
  req,
  status = 'success',
}) => {
  try {
    const ip_address = req
      ? req.headers['x-forwarded-for']?.split(',')[0].trim() || req.socket?.remoteAddress
      : undefined;
    const user_agent = req ? req.headers['user-agent'] : undefined;

    await ActivityLog.create({
      user_id,
      user_name,
      user_role,
      action,
      resource,
      resource_id: resource_id?.toString(),
      description,
      metadata,
      ip_address,
      user_agent,
      status,
    });
  } catch (err) {
    // Never let logging crash the app
    console.error('⚠️  Activity log write failed:', err.message);
  }
};

/**
 * Express middleware to auto-log a request after it completes.
 * Usage: router.post('/invoices', authMiddleware, autoLog('INVOICE_CREATED', 'Invoice'), handler)
 */
const autoLog = (action, resource) => (req, res, next) => {
  const originalJson = res.json.bind(res);

  res.json = (body) => {
    if (res.statusCode < 400 && req.user) {
      logActivity({
        user_id: req.user.id,
        user_name: req.user.name,
        user_role: req.user.role,
        action,
        resource,
        resource_id: body?.data?._id || body?.id,
        description: `${req.user.name} performed ${action}`,
        req,
      });
    }
    return originalJson(body);
  };

  next();
};

module.exports = { logActivity, autoLog, ActivityActions };