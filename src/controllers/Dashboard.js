const DashboardService = require('../services/Dashboard');
const { getCurrentEntity } = require('../middleware/auth');

class DashboardController {
 getDashboardStats = async (req, res) => {
  try {
    const { date_from, date_to, entity_id } = req.query;
    
    // Build filters object
    const filters = {};
    if (date_from) filters.date_from = date_from;
    if (date_to) filters.date_to = date_to;

    let entityId = null;
    if (entity_id && entity_id !== 'ALL_ENTITIES' && entity_id !== '') {
      entityId = entity_id;
    }
    
    const stats = await DashboardService.getDashboardStats(entityId, filters, req);
    
    return res.json({
      message: 'Dashboard statistics retrieved successfully',
      code: 'DASHBOARD_STATS_FETCH_SUCCESS',
      success: true,
      results: stats
    });
  } catch (error) {
    return this.handleError(error, res);
  }
};
  getInventoryStats = async (req, res) => {
    try {
      const entityId = getCurrentEntity(req);
      const { date_from, date_to } = req.query;
      const isAllEntities = entityId === 'ALL_ENTITIES';
      const filters = {};
      if (date_from) filters.date_from = date_from;
      if (date_to)   filters.date_to   = date_to;
      const stats = await DashboardService.getInventoryStats(
        isAllEntities ? null : entityId, filters
      );
      return res.json({ message: 'Inventory statistics retrieved successfully', code: 'INVENTORY_STATS_FETCH_SUCCESS', success: true, results: stats });
    } catch (error) { return this.handleError(error, res); }
  };

  getInvoiceStats = async (req, res) => {
    try {
      const entityId = getCurrentEntity(req);
      const { date_from, date_to } = req.query;
      const isAllEntities = entityId === 'ALL_ENTITIES';
      const filters = {};
      if (date_from) filters.date_from = date_from;
      if (date_to)   filters.date_to   = date_to;
      const stats = await DashboardService.getInvoiceStats(
        isAllEntities ? null : entityId, filters
      );
      return res.json({ message: 'Invoice statistics retrieved successfully', code: 'INVOICE_STATS_FETCH_SUCCESS', success: true, results: stats });
    } catch (error) { return this.handleError(error, res); }
  };

  getWeeklySales = async (req, res) => {
    try {
      const entityId = getCurrentEntity(req);
      const { date_from, date_to } = req.query;
      const isAllEntities = entityId === 'ALL_ENTITIES';
      const filters = {};
      if (date_from) filters.date_from = date_from;
      if (date_to)   filters.date_to   = date_to;
      const sales = await DashboardService.getWeeklySales(
        isAllEntities ? null : entityId, filters
      );
      return res.json({ message: 'Weekly sales retrieved successfully', code: 'WEEKLY_SALES_FETCH_SUCCESS', success: true, results: sales });
    } catch (error) { return this.handleError(error, res); }
  };

  getTopSelling = async (req, res) => {
    try {
      const entityId = getCurrentEntity(req);
      const { limit = 5, date_from, date_to } = req.query;
      const isAllEntities = entityId === 'ALL_ENTITIES';
      const filters = {};
      if (date_from) filters.date_from = date_from;
      if (date_to)   filters.date_to   = date_to;
      const items = await DashboardService.getTopSellingItems(
        isAllEntities ? null : entityId, parseInt(limit), filters
      );
      return res.json({ message: 'Top selling items retrieved successfully', code: 'TOP_SELLING_FETCH_SUCCESS', success: true, results: items });
    } catch (error) { return this.handleError(error, res); }
  };

  getRecentTransactions = async (req, res) => {
    try {
      const entityId = getCurrentEntity(req);
      const { limit = 10, date_from, date_to } = req.query;
      const isAllEntities = entityId === 'ALL_ENTITIES';
      const filters = {};
      if (date_from) filters.date_from = date_from;
      if (date_to)   filters.date_to   = date_to;
      const transactions = await DashboardService.getRecentTransactions(
        isAllEntities ? null : entityId, parseInt(limit), filters
      );
      return res.json({ message: 'Recent transactions retrieved successfully', code: 'RECENT_TRANSACTIONS_FETCH_SUCCESS', success: true, results: transactions });
    } catch (error) { return this.handleError(error, res); }
  };

  getMonthlyRevenue = async (req, res) => {
    try {
      const entityId = getCurrentEntity(req);
      const { months = 12, date_from, date_to } = req.query;
      const isAllEntities = entityId === 'ALL_ENTITIES';
      const filters = {};
      if (date_from) filters.date_from = date_from;
      if (date_to)   filters.date_to   = date_to;
      const revenue = await DashboardService.getMonthlyRevenue(
        isAllEntities ? null : entityId, parseInt(months), filters
      );
      return res.json({ message: 'Monthly revenue retrieved successfully', code: 'MONTHLY_REVENUE_FETCH_SUCCESS', success: true, results: revenue });
    } catch (error) { return this.handleError(error, res); }
  };

  getCustomerStats = async (req, res) => {
    try {
      const entityId = getCurrentEntity(req);
      const { date_from, date_to } = req.query;
      const isAllEntities = entityId === 'ALL_ENTITIES';
      const filters = {};
      if (date_from) filters.date_from = date_from;
      if (date_to)   filters.date_to   = date_to;
      const stats = await DashboardService.getCustomerStats(
        isAllEntities ? null : entityId, filters
      );
      return res.json({ message: 'Customer statistics retrieved successfully', code: 'CUSTOMER_STATS_FETCH_SUCCESS', success: true, results: stats });
    } catch (error) { return this.handleError(error, res); }
  };

  getInventoryByType = async (req, res) => {
    try {
      const entityId = getCurrentEntity(req);
      const isAllEntities = entityId === 'ALL_ENTITIES';
      const types = await DashboardService.getInventoryByType(
        isAllEntities ? null : entityId
      );
      return res.json({ message: 'Inventory by type retrieved successfully', code: 'INVENTORY_BY_TYPE_FETCH_SUCCESS', success: true, results: types });
    } catch (error) { return this.handleError(error, res); }
  };

  getLowStockCount = async (req, res) => {
    try {
      const entityId = getCurrentEntity(req);
      const isAllEntities = entityId === 'ALL_ENTITIES';
      const count = await DashboardService.getLowStockCount(
        isAllEntities ? null : entityId
      );
      return res.json({ message: 'Low stock count retrieved successfully', code: 'LOW_STOCK_COUNT_FETCH_SUCCESS', success: true, results: count });
    } catch (error) { return this.handleError(error, res); }
  };

  getInvoiceStatusBreakdown = async (req, res) => {
    try {
      const entityId = getCurrentEntity(req);
      const { date_from, date_to } = req.query;
      const isAllEntities = entityId === 'ALL_ENTITIES';
      const filters = {};
      if (date_from) filters.date_from = date_from;
      if (date_to)   filters.date_to   = date_to;
      const breakdown = await DashboardService.getInvoiceStatusBreakdown(
        isAllEntities ? null : entityId, filters
      );
      return res.json({ message: 'Invoice status breakdown retrieved successfully', code: 'INVOICE_STATUS_BREAKDOWN_FETCH_SUCCESS', success: true, results: breakdown });
    } catch (error) { return this.handleError(error, res); }
  };

  handleError(error, res) {
    console.error('Dashboard Controller Error:', error);
    const errorMap = {
      'ENTITY_ID_REQUIRED': { status: 400, message: 'Entity ID is required', code: 'ENTITY_ID_REQUIRED' },
    };
    const errorConfig = errorMap[error.message] || { status: 500, message: error.message || 'Internal server error', code: 'SERVER_ERROR' };
    return res.status(errorConfig.status).json({ message: errorConfig.message, code: errorConfig.code, success: false });
  }
}

module.exports = new DashboardController();