const express = require('express');
const { ActivityLog } = require('../models/ActivityLog');
const { authenticate, requirePermission } = require('../middleware/auth');

const router = express.Router();

// All activity log routes require authentication + the can_view_activity_logs permission
router.use(authenticate);
router.use(requirePermission('can_view_activity_logs'));

/**
 * GET /api/activity-logs
 * Query params:
 *   - page         (default: 1)
 *   - limit        (default: 20, max: 100)
 *   - user_id      filter by specific user
 *   - action       filter by action type
 *   - resource     filter by resource (e.g. 'Invoice')
 *   - status       'success' | 'failure'
 *   - from         ISO date string (start of range)
 *   - to           ISO date string (end of range)
 */
router.get('/', async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
    const skip = (page - 1) * limit;

    const filter = {};

    if (req.query.user_id) filter.user_id = req.query.user_id;
    if (req.query.action) filter.action = req.query.action;
    if (req.query.resource) filter.resource = req.query.resource;
    if (req.query.status) filter.status = req.query.status;

    if (req.query.from || req.query.to) {
      filter.created_at = {};
      if (req.query.from) filter.created_at.$gte = new Date(req.query.from);
      if (req.query.to) filter.created_at.$lte = new Date(req.query.to);
    }

    const [logs, total] = await Promise.all([
      ActivityLog.find(filter)
        .sort({ created_at: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      ActivityLog.countDocuments(filter),
    ]);

    res.json({
      data: logs,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Activity log fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch activity logs' });
  }
});

/**
 * GET /api/activity-logs/summary
 * Returns action counts grouped by type for a dashboard widget.
 */
router.get('/summary', async (req, res) => {
  try {
    const from = req.query.from ? new Date(req.query.from) : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const to = req.query.to ? new Date(req.query.to) : new Date();

    const summary = await ActivityLog.aggregate([
      { $match: { created_at: { $gte: from, $lte: to } } },
      { $group: { _id: '$action', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);

    res.json({ data: summary, period: { from, to } });
  } catch (error) {
    console.error('Activity summary error:', error);
    res.status(500).json({ error: 'Failed to fetch summary' });
  }
});

module.exports = router;