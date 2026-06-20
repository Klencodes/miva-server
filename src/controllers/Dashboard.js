// controllers/dashboardController.js
const DashboardService = require('../services/dashboardService');
const { getCurrentEntity } = require('../middleware/auth');

class DashboardController {
  /**
   * GET /api/dashboard
   * Get dashboard statistics
   */
   getDashboardStats =  (req, res) => {
    try {
      const entityId = getCurrentEntity(req);
      const { date_from, date_to } = req.query;
      
      const filters = {};
      if (date_from) filters.date_from = date_from;
      if (date_to) filters.date_to = date_to;

      const stats =  DashboardService.getDashboardStats(entityId, filters, req);

      return res.json({
        message: "Dashboard statistics retrieved successfully",
        code: "DASHBOARD_STATS_FETCH_SUCCESS",
        success: true,
        results: stats
      });
    } catch (error) {
      return this.handleError(error, res);
    }
  };

  /**
   * GET /api/dashboard/inventory
   * Get inventory statistics
   */
  getInventoryStats = async (req, res) => {
    try {
      const entityId = getCurrentEntity(req);
      const stats = await DashboardService.getInventoryStats(entityId);

      return res.json({
        message: "Inventory statistics retrieved successfully",
        code: "INVENTORY_STATS_FETCH_SUCCESS",
        success: true,
        results: stats
      });
    } catch (error) {
      return this.handleError(error, res);
    }
  };

  /**
   * GET /api/dashboard/invoices
   * Get invoice statistics
   */
  getInvoiceStats = async (req, res) => {
    try {
      const entityId = getCurrentEntity(req);
      const stats = await DashboardService.getInvoiceStats(entityId);

      return res.json({
        message: "Invoice statistics retrieved successfully",
        code: "INVOICE_STATS_FETCH_SUCCESS",
        success: true,
        results: stats
      });
    } catch (error) {
      return this.handleError(error, res);
    }
  };

  /**
   * GET /api/dashboard/weekly-sales
   * Get weekly sales data
   */
  getWeeklySales = async (req, res) => {
    try {
      const entityId = getCurrentEntity(req);
      const sales = await DashboardService.getWeeklySales(entityId);

      return res.json({
        message: "Weekly sales retrieved successfully",
        code: "WEEKLY_SALES_FETCH_SUCCESS",
        success: true,
        results: sales
      });
    } catch (error) {
      return this.handleError(error, res);
    }
  };

  /**
   * GET /api/dashboard/top-selling
   * Get top selling items
   */
  getTopSelling = async (req, res) => {
    try {
      const entityId = getCurrentEntity(req);
      const { limit = 5 } = req.query;
      const items = await DashboardService.getTopSellingItems(entityId, parseInt(limit));

      return res.json({
        message: "Top selling items retrieved successfully",
        code: "TOP_SELLING_FETCH_SUCCESS",
        success: true,
        results: items
      });
    } catch (error) {
      return this.handleError(error, res);
    }
  };

  /**
   * GET /api/dashboard/recent-transactions
   * Get recent transactions
   */
  getRecentTransactions = async (req, res) => {
    try {
      const entityId = getCurrentEntity(req);
      const { limit = 10 } = req.query;
      const transactions = await DashboardService.getRecentTransactions(entityId, parseInt(limit));

      return res.json({
        message: "Recent transactions retrieved successfully",
        code: "RECENT_TRANSACTIONS_FETCH_SUCCESS",
        success: true,
        results: transactions
      });
    } catch (error) {
      return this.handleError(error, res);
    }
  };

  /**
   * GET /api/dashboard/monthly-revenue
   * Get monthly revenue trend
   */
  getMonthlyRevenue = async (req, res) => {
    try {
      const entityId = getCurrentEntity(req);
      const { months = 12 } = req.query;
      const revenue = await DashboardService.getMonthlyRevenue(entityId, parseInt(months));

      return res.json({
        message: "Monthly revenue retrieved successfully",
        code: "MONTHLY_REVENUE_FETCH_SUCCESS",
        success: true,
        results: revenue
      });
    } catch (error) {
      return this.handleError(error, res);
    }
  };

  /**
   * GET /api/dashboard/customers
   * Get customer statistics
   */
  getCustomerStats = async (req, res) => {
    try {
      const entityId = getCurrentEntity(req);
      const stats = await DashboardService.getCustomerStats(entityId);

      return res.json({
        message: "Customer statistics retrieved successfully",
        code: "CUSTOMER_STATS_FETCH_SUCCESS",
        success: true,
        results: stats
      });
    } catch (error) {
      return this.handleError(error, res);
    }
  };

  /**
   * GET /api/dashboard/inventory-by-type
   * Get inventory by type
   */
  getInventoryByType = async (req, res) => {
    try {
      const entityId = getCurrentEntity(req);
      const types = await DashboardService.getInventoryByType(entityId);

      return res.json({
        message: "Inventory by type retrieved successfully",
        code: "INVENTORY_BY_TYPE_FETCH_SUCCESS",
        success: true,
        results: types
      });
    } catch (error) {
      return this.handleError(error, res);
    }
  };

  /**
   * GET /api/dashboard/low-stock
   * Get low stock items count
   */
  getLowStockCount = async (req, res) => {
    try {
      const entityId = getCurrentEntity(req);
      const count = await DashboardService.getLowStockCount(entityId);

      return res.json({
        message: "Low stock count retrieved successfully",
        code: "LOW_STOCK_COUNT_FETCH_SUCCESS",
        success: true,
        results: count
      });
    } catch (error) {
      return this.handleError(error, res);
    }
  };

  /**
   * GET /api/dashboard/invoice-status
   * Get invoice status breakdown
   */
  getInvoiceStatusBreakdown = async (req, res) => {
    try {
      const entityId = getCurrentEntity(req);
      const breakdown = await DashboardService.getInvoiceStatusBreakdown(entityId);

      return res.json({
        message: "Invoice status breakdown retrieved successfully",
        code: "INVOICE_STATUS_BREAKDOWN_FETCH_SUCCESS",
        success: true,
        results: breakdown
      });
    } catch (error) {
      return this.handleError(error, res);
    }
  };

  /**
   * Handle errors
   */
  handleError(error, res) {
    console.error('Dashboard Controller Error:', error);

    const errorMap = {
      'ENTITY_ID_REQUIRED': {
        status: 400,
        message: 'Entity ID is required',
        code: 'ENTITY_ID_REQUIRED'
      }
    };

    const errorConfig = errorMap[error.message] || {
      status: 500,
      message: error.message || 'Internal server error',
      code: 'SERVER_ERROR'
    };

    return res.status(errorConfig.status).json({
      message: errorConfig.message,
      code: errorConfig.code,
      success: false
    });
  }
}

module.exports = new DashboardController();