// controllers/ExpenseController.js
const ExpenseService = require('../services/Expense');
const { getCurrentEntity } = require('../middleware/auth');
const { ApiResponse, ErrorResponse } = require('../utils/response');
const Pagination = require('../utils/pagination');

class ExpenseController {
  /**
   * GET /api/expenses
   * Get all expenses with pagination and filters
   */
  getExpenses = async (req, res) => {
    try {
      const entityId = getCurrentEntity(req);
      const {
        search,
        category,
        status,
        payment_method,
        vendor,
        start_date,
        end_date,
        page = 1,
        limit = 10,
        sort_by = 'created_at',
        sort_order = 'desc',
      } = req.query;

      const filters = {
        entity_id: entityId,
        search,
        category,
        status,
        payment_method,
        vendor,
        start_date,
        end_date,
      };

      const pagination = {
        page: parseInt(page),
        limit: parseInt(limit),
        sort_by,
        sort_order,
      };

      const result = await ExpenseService.getExpenses(filters, pagination);

      // Generate pagination links
      const baseUrl = `${req.protocol}://${req.get('host')}${req.baseUrl}${req.path}`;
      const paginationLinks = Pagination.generatePaginationResponse(
        result.expenses,
        result.count,
        parseInt(page),
        parseInt(limit),
        baseUrl,
        req.query
      );

      const response = new ApiResponse(
        result.expenses,
        "Expenses retrieved successfully",
        paginationLinks
      );
      return res.json(response);
    } catch (error) {
      return this.handleError(error, res);
    }
  };

  /**
   * GET /api/expenses/:uuid
   * Get expense by UUID
   */
  getExpenseByUuid = async (req, res) => {
    try {
      const { uuid } = req.params;
      const entityId = getCurrentEntity(req);

      const expense = await ExpenseService.getExpenseByUuid(uuid, entityId);

      const response = new ApiResponse(expense, "Expense retrieved successfully");
      return res.json(response);
    } catch (error) {
      return this.handleError(error, res);
    }
  };

  /**
   * POST /api/expenses
   * Create a new expense
   */
  createExpense = async (req, res) => {
    try {
      const { body, user } = req;
      const expense = await ExpenseService.createExpense(body, user, req);

      const response = new ApiResponse(expense, "Expense created successfully");
      return res.json(response);
    } catch (error) {
      return this.handleError(error, res);
    }
  };

  /**
   * PUT /api/expenses/:uuid
   * Update expense
   */
  updateExpense = async (req, res) => {
    try {
      const { uuid } = req.params;
      const { body, user } = req;

      const expense = await ExpenseService.updateExpense(uuid, body, user, req);

      const response = new ApiResponse(expense, "Expense updated successfully");
      return res.json(response);
    } catch (error) {
      return this.handleError(error, res);
    }
  };

  /**
   * PATCH /api/expenses/:uuid/pay
   * Mark expense as paid
   */
  markExpenseAsPaid = async (req, res) => {
    try {
      const { uuid } = req.params;
      const { user } = req;

      const expense = await ExpenseService.markExpenseAsPaid(uuid, user, req);

      const response = new ApiResponse(expense, "Expense marked as paid successfully");
      return res.json(response);
    } catch (error) {
      return this.handleError(error, res);
    }
  };

  /**
   * DELETE /api/expenses/:uuid
   * Delete expense
   */
  deleteExpense = async (req, res) => {
    try {
      const { uuid } = req.params;
      const { user } = req;

      const result = await ExpenseService.deleteExpense(uuid, user, req);

      const response = new ApiResponse(null, result.message || "Expense deleted successfully");
      return res.json(response);
    } catch (error) {
      return this.handleError(error, res);
    }
  };

  /**
   * GET /api/expenses/stats
   * Get expense statistics
   */
  getExpenseStats = async (req, res) => {
    try {
      const { start_date, end_date, entity_id } = req.query;

      // IMPORTANT: Get entity ID from the request
      // If entity_id is provided in query, use it, otherwise use getCurrentEntity
      let entityId = entity_id || getCurrentEntity(req);

      // If entity_id is 'ALL_ENTITIES' and user is admin, set to null (all entities)
      const isAdmin = req.user?.role === 'super_admin' || req.user?.role === 'admin';
      if (entityId === 'ALL_ENTITIES' && isAdmin) {
        entityId = null;
      }

      // Build date filters
      const dateFilter = {};
      if (start_date) dateFilter.start_date = start_date;
      if (end_date) dateFilter.end_date = end_date;

      console.log('Fetching stats with entityId:', entityId); // Debug log

      const stats = await ExpenseService.getExpenseStats(entityId, dateFilter);

      const response = new ApiResponse(stats, "Expense statistics retrieved successfully");
      return res.json(response);
    } catch (error) {
      return this.handleError(error, res);
    }
  };

  /**
   * GET /api/expenses/stats/categories
   * Get expense category breakdown
   */
  getExpenseCategoryBreakdown = async (req, res) => {
    try {
      const { start_date, end_date, entity_id } = req.query;

      // IMPORTANT: Get entity ID from the request
      let entityId = entity_id || getCurrentEntity(req);

      const isAdmin = req.user?.role === 'super_admin' || req.user?.role === 'admin';
      if (entityId === 'ALL_ENTITIES' && isAdmin) {
        entityId = null;
      }

      // Build date filters
      const dateFilter = {};
      if (start_date) dateFilter.start_date = start_date;
      if (end_date) dateFilter.end_date = end_date;

      console.log('Fetching category breakdown with entityId:', entityId); // Debug log

      const breakdown = await ExpenseService.getExpenseCategoryBreakdown(entityId, dateFilter);

      const response = new ApiResponse(breakdown, "Expense category breakdown retrieved successfully");
      return res.json(response);
    } catch (error) {
      return this.handleError(error, res);
    }
  };

  /**
   * GET /api/expenses/stats/status
   * Get expense status breakdown
   */
  getExpenseStatusBreakdown = async (req, res) => {
    try {
      const { start_date, end_date, entity_id } = req.query;

      // IMPORTANT: Get entity ID from the request
      let entityId = entity_id || getCurrentEntity(req);

      const isAdmin = req.user?.role === 'super_admin' || req.user?.role === 'admin';
      if (entityId === 'ALL_ENTITIES' && isAdmin) {
        entityId = null;
      }

      // Build date filters
      const dateFilter = {};
      if (start_date) dateFilter.start_date = start_date;
      if (end_date) dateFilter.end_date = end_date;

      console.log('Fetching status breakdown with entityId:', entityId); // Debug log

      const breakdown = await ExpenseService.getExpenseStatusBreakdown(entityId, dateFilter);

      const response = new ApiResponse(breakdown, "Expense status breakdown retrieved successfully");
      return res.json(response);
    } catch (error) {
      return this.handleError(error, res);
    }
  };

  /**
   * GET /api/expenses/options
   * Get expense options (categories, statuses, payment methods)
   */
  getExpenseOptions = async (req, res) => {
    try {
      const options = await ExpenseService.getExpenseOptions();

      const response = new ApiResponse(options, "Expense options retrieved successfully");
      return res.json(response);
    } catch (error) {
      return this.handleError(error, res);
    }
  };

  /**
   * Handle errors
   */
  handleError(error, res) {
    console.error('Expense Controller Error:', error);

    const errorMap = {
      'EXPENSE_NOT_FOUND': { status: 404, message: 'Expense not found' },
      'EXPENSE_NOT_EDITABLE': { status: 400, message: 'Expense cannot be edited in its current status' },
      'EXPENSE_NOT_PAYABLE': { status: 400, message: 'Expense cannot be marked as paid in its current status' },
      'EXPENSE_NOT_DELETABLE': { status: 400, message: 'Expense cannot be deleted in its current status' },
      'INVALID_STATUS_TRANSITION': { status: 400, message: 'Invalid status transition. Only pending -> paid is allowed' },
      'ENTITY_ID_REQUIRED': { status: 400, message: 'Entity ID is required' },
    };

    // Check for MongoDB validation error
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map((err) => err.message);
      const errorResponse = new ErrorResponse('Validation error: ' + messages.join(', '));
      return res.status(400).json(errorResponse);
    }

    // Check for MongoDB duplicate key error
    if (error.code === 11000) {
      const errorResponse = new ErrorResponse('Duplicate entry detected');
      return res.status(409).json(errorResponse);
    }

    const errorConfig = errorMap[error.message] || {
      status: error.status || 500,
      message: error.message || 'Internal server error'
    };

    const errorResponse = new ErrorResponse(errorConfig.message);
    return res.status(errorConfig.status).json(errorResponse);
  }
}

module.exports = new ExpenseController();