const DashboardService = require('../services/Dashboard');

class DashboardController {
  /**
   * Get dashboard statistics
   * entity_id comes from query params
   * - Admin can send entity_id: 'ALL_ENTITIES' to get all
   * - Admin can send specific entity_id to get that entity
   * - Non-admin users can also pass entity_id in params
   * - If no entity_id provided, fallback to primary_entity_id
   */
  getDashboardStats = async (req, res) => {
    try {
      const { date_from, date_to, entity_id } = req.query;
      
      // Build filters object with proper date handling
      const filters = {};
      if (date_from) filters.date_from = date_from;
      if (date_to) filters.date_to = date_to;

      // Determine which entity to use
      let entityId = null;
      const isAdmin = req.user?.role === 'super_admin' || req.user?.role === 'admin';
      
      if (entity_id === 'ALL_ENTITIES') {
        // Only admin can see ALL_ENTITIES
        if (isAdmin) {
          entityId = null; // null = all entities
        } else {
          // Non-admin cannot see ALL_ENTITIES, use their primary entity
          entityId = req.user?.primary_entity_id || null;
        }
      } else if (entity_id && entity_id !== '') {
        // User can pass specific entity_id (both admin and non-admin)
        entityId = entity_id;
      } else {
        // Fallback to user's primary entity
        entityId = req.user?.primary_entity_id || null;
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
      const { date_from, date_to, entity_id } = req.query;
      
      const filters = {};
      if (date_from) filters.date_from = date_from;
      if (date_to) filters.date_to = date_to;

      const isAdmin = req.user?.role === 'super_admin' || req.user?.role === 'admin';
      let entityId = null;
      
      if (entity_id === 'ALL_ENTITIES') {
        if (isAdmin) {
          entityId = null;
        } else {
          entityId = req.user?.primary_entity_id || null;
        }
      } else if (entity_id && entity_id !== '') {
        entityId = entity_id;
      } else {
        entityId = req.user?.primary_entity_id || null;
      }
      
      const stats = await DashboardService.getInventoryStats(entityId, filters);
      return res.json({ 
        message: 'Inventory statistics retrieved successfully', 
        code: 'INVENTORY_STATS_FETCH_SUCCESS', 
        success: true, 
        results: stats 
      });
    } catch (error) { 
      return this.handleError(error, res); 
    }
  };

  getInvoiceStats = async (req, res) => {
    try {
      const { date_from, date_to, entity_id } = req.query;
      
      const filters = {};
      if (date_from) filters.date_from = date_from;
      if (date_to) filters.date_to = date_to;

      const isAdmin = req.user?.role === 'super_admin' || req.user?.role === 'admin';
      let entityId = null;
      
      if (entity_id === 'ALL_ENTITIES') {
        if (isAdmin) {
          entityId = null;
        } else {
          entityId = req.user?.primary_entity_id || null;
        }
      } else if (entity_id && entity_id !== '') {
        entityId = entity_id;
      } else {
        entityId = req.user?.primary_entity_id || null;
      }
      
      const stats = await DashboardService.getInvoiceStats(entityId, filters);
      return res.json({ 
        message: 'Invoice statistics retrieved successfully', 
        code: 'INVOICE_STATS_FETCH_SUCCESS', 
        success: true, 
        results: stats 
      });
    } catch (error) { 
      return this.handleError(error, res); 
    }
  };

  getWeeklySales = async (req, res) => {
    try {
      const { date_from, date_to, entity_id } = req.query;
      
      const filters = {};
      if (date_from) filters.date_from = date_from;
      if (date_to) filters.date_to = date_to;

      const isAdmin = req.user?.role === 'super_admin' || req.user?.role === 'admin';
      let entityId = null;
      
      if (entity_id === 'ALL_ENTITIES') {
        if (isAdmin) {
          entityId = null;
        } else {
          entityId = req.user?.primary_entity_id || null;
        }
      } else if (entity_id && entity_id !== '') {
        entityId = entity_id;
      } else {
        entityId = req.user?.primary_entity_id || null;
      }
      
      const sales = await DashboardService.getWeeklySales(entityId, filters);
      return res.json({ 
        message: 'Weekly sales retrieved successfully', 
        code: 'WEEKLY_SALES_FETCH_SUCCESS', 
        success: true, 
        results: sales 
      });
    } catch (error) { 
      return this.handleError(error, res); 
    }
  };

  getTopSelling = async (req, res) => {
    try {
      const { limit = 5, date_from, date_to, entity_id } = req.query;
      
      const filters = {};
      if (date_from) filters.date_from = date_from;
      if (date_to) filters.date_to = date_to;

      const isAdmin = req.user?.role === 'super_admin' || req.user?.role === 'admin';
      let entityId = null;
      
      if (entity_id === 'ALL_ENTITIES') {
        if (isAdmin) {
          entityId = null;
        } else {
          entityId = req.user?.primary_entity_id || null;
        }
      } else if (entity_id && entity_id !== '') {
        entityId = entity_id;
      } else {
        entityId = req.user?.primary_entity_id || null;
      }
      
      const items = await DashboardService.getTopSellingItems(entityId, parseInt(limit), filters);
      return res.json({ 
        message: 'Top selling items retrieved successfully', 
        code: 'TOP_SELLING_FETCH_SUCCESS', 
        success: true, 
        results: items 
      });
    } catch (error) { 
      return this.handleError(error, res); 
    }
  };

  getRecentTransactions = async (req, res) => {
    try {
      const { limit = 10, date_from, date_to, entity_id } = req.query;
      
      const filters = {};
      if (date_from) filters.date_from = date_from;
      if (date_to) filters.date_to = date_to;

      const isAdmin = req.user?.role === 'super_admin' || req.user?.role === 'admin';
      let entityId = null;
      
      if (entity_id === 'ALL_ENTITIES') {
        if (isAdmin) {
          entityId = null;
        } else {
          entityId = req.user?.primary_entity_id || null;
        }
      } else if (entity_id && entity_id !== '') {
        entityId = entity_id;
      } else {
        entityId = req.user?.primary_entity_id || null;
      }
      
      const transactions = await DashboardService.getRecentTransactions(entityId, parseInt(limit), filters);
      return res.json({ 
        message: 'Recent transactions retrieved successfully', 
        code: 'RECENT_TRANSACTIONS_FETCH_SUCCESS', 
        success: true, 
        results: transactions 
      });
    } catch (error) { 
      return this.handleError(error, res); 
    }
  };

  getMonthlyRevenue = async (req, res) => {
    try {
      const { months = 12, date_from, date_to, entity_id } = req.query;
      
      const filters = {};
      if (date_from) filters.date_from = date_from;
      if (date_to) filters.date_to = date_to;

      const isAdmin = req.user?.role === 'super_admin' || req.user?.role === 'admin';
      let entityId = null;
      
      if (entity_id === 'ALL_ENTITIES') {
        if (isAdmin) {
          entityId = null;
        } else {
          entityId = req.user?.primary_entity_id || null;
        }
      } else if (entity_id && entity_id !== '') {
        entityId = entity_id;
      } else {
        entityId = req.user?.primary_entity_id || null;
      }
      
      const revenue = await DashboardService.getMonthlyRevenue(entityId, parseInt(months), filters);
      return res.json({ 
        message: 'Monthly revenue retrieved successfully', 
        code: 'MONTHLY_REVENUE_FETCH_SUCCESS', 
        success: true, 
        results: revenue 
      });
    } catch (error) { 
      return this.handleError(error, res); 
    }
  };

  getCustomerStats = async (req, res) => {
    try {
      const { date_from, date_to, entity_id } = req.query;
      
      const filters = {};
      if (date_from) filters.date_from = date_from;
      if (date_to) filters.date_to = date_to;

      const isAdmin = req.user?.role === 'super_admin' || req.user?.role === 'admin';
      let entityId = null;
      
      if (entity_id === 'ALL_ENTITIES') {
        if (isAdmin) {
          entityId = null;
        } else {
          entityId = req.user?.primary_entity_id || null;
        }
      } else if (entity_id && entity_id !== '') {
        entityId = entity_id;
      } else {
        entityId = req.user?.primary_entity_id || null;
      }
      
      const stats = await DashboardService.getCustomerStats(entityId, filters);
      return res.json({ 
        message: 'Customer statistics retrieved successfully', 
        code: 'CUSTOMER_STATS_FETCH_SUCCESS', 
        success: true, 
        results: stats 
      });
    } catch (error) { 
      return this.handleError(error, res); 
    }
  };

  getInventoryByType = async (req, res) => {
    try {
      const { entity_id } = req.query;

      const isAdmin = req.user?.role === 'super_admin' || req.user?.role === 'admin';
      let entityId = null;
      
      if (entity_id === 'ALL_ENTITIES') {
        if (isAdmin) {
          entityId = null;
        } else {
          entityId = req.user?.primary_entity_id || null;
        }
      } else if (entity_id && entity_id !== '') {
        entityId = entity_id;
      } else {
        entityId = req.user?.primary_entity_id || null;
      }
      
      const types = await DashboardService.getInventoryByType(entityId);
      return res.json({ 
        message: 'Inventory by type retrieved successfully', 
        code: 'INVENTORY_BY_TYPE_FETCH_SUCCESS', 
        success: true, 
        results: types 
      });
    } catch (error) { 
      return this.handleError(error, res); 
    }
  };

  getLowStockCount = async (req, res) => {
    try {
      const { entity_id } = req.query;

      const isAdmin = req.user?.role === 'super_admin' || req.user?.role === 'admin';
      let entityId = null;
      
      if (entity_id === 'ALL_ENTITIES') {
        if (isAdmin) {
          entityId = null;
        } else {
          entityId = req.user?.primary_entity_id || null;
        }
      } else if (entity_id && entity_id !== '') {
        entityId = entity_id;
      } else {
        entityId = req.user?.primary_entity_id || null;
      }
      
      const count = await DashboardService.getLowStockCount(entityId);
      return res.json({ 
        message: 'Low stock count retrieved successfully', 
        code: 'LOW_STOCK_COUNT_FETCH_SUCCESS', 
        success: true, 
        results: count 
      });
    } catch (error) { 
      return this.handleError(error, res); 
    }
  };

  getInvoiceStatusBreakdown = async (req, res) => {
    try {
      const { date_from, date_to, entity_id } = req.query;
      
      const filters = {};
      if (date_from) filters.date_from = date_from;
      if (date_to) filters.date_to = date_to;

      const isAdmin = req.user?.role === 'super_admin' || req.user?.role === 'admin';
      let entityId = null;
      
      if (entity_id === 'ALL_ENTITIES') {
        if (isAdmin) {
          entityId = null;
        } else {
          entityId = req.user?.primary_entity_id || null;
        }
      } else if (entity_id && entity_id !== '') {
        entityId = entity_id;
      } else {
        entityId = req.user?.primary_entity_id || null;
      }
      
      const breakdown = await DashboardService.getInvoiceStatusBreakdown(entityId, filters);
      return res.json({ 
        message: 'Invoice status breakdown retrieved successfully', 
        code: 'INVOICE_STATUS_BREAKDOWN_FETCH_SUCCESS', 
        success: true, 
        results: breakdown 
      });
    } catch (error) { 
      return this.handleError(error, res); 
    }
  };

  handleError(error, res) {
    console.error('Dashboard Controller Error:', error);
    const errorMap = {
      'ENTITY_ID_REQUIRED': { status: 400, message: 'Entity ID is required', code: 'ENTITY_ID_REQUIRED' },
    };
    const errorConfig = errorMap[error.message] || { status: 500, message: error.message || 'Internal server error', code: 'SERVER_ERROR' };
    return res.status(errorConfig.status).json({ 
      message: errorConfig.message, 
      code: errorConfig.code, 
      success: false 
    });
  }
}

module.exports = new DashboardController();