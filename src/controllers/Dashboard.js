// controllers/dashboardController.js
const DashboardService = require('../services/Dashboard');
const { ApiResponse, ErrorResponse } = require('../utils/response'); // Adjust path as needed

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
      
      const response = new ApiResponse(stats, "Dashboard statistics retrieved successfully");
      return res.json(response);
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
      const response = new ApiResponse(stats, "Inventory statistics retrieved successfully");
      return res.json(response);
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
      const response = new ApiResponse(stats, "Invoice statistics retrieved successfully");
      return res.json(response);
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
      const response = new ApiResponse(sales, "Weekly sales retrieved successfully");
      return res.json(response);
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
      const response = new ApiResponse(items, "Top selling items retrieved successfully");
      return res.json(response);
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
      const response = new ApiResponse(transactions, "Recent transactions retrieved successfully");
      return res.json(response);
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
      const response = new ApiResponse(revenue, "Monthly revenue retrieved successfully");
      return res.json(response);
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
      const response = new ApiResponse(stats, "Customer statistics retrieved successfully");
      return res.json(response);
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
      const response = new ApiResponse(types, "Inventory by type retrieved successfully");
      return res.json(response);
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
      const response = new ApiResponse(count, "Low stock count retrieved successfully");
      return res.json(response);
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
      const response = new ApiResponse(breakdown, "Invoice status breakdown retrieved successfully");
      return res.json(response);
    } catch (error) { 
      return this.handleError(error, res); 
    }
  };

  handleError(error, res) {
    console.error('Dashboard Controller Error:', error);
    
    const errorMap = {
      'ENTITY_ID_REQUIRED': { status: 400, message: 'Entity ID is required' },
    };
    
    const errorConfig = errorMap[error.message] || {
      status: error.status || 500,
      message: error.message || 'Internal server error'
    };
    
    const errorResponse = new ErrorResponse(errorConfig.message);
    return res.status(errorConfig.status).json(errorResponse);
  }
}

module.exports = new DashboardController();