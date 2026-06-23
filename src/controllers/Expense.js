// src/controllers/ExpenseController.js

const ExpenseService = require('../services/Expense');
const { getCurrentEntity } = require('../middleware/auth');

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

      return res.json({
        message: 'Expenses retrieved successfully',
        code: 'EXPENSES_FETCH_SUCCESS',
        success: true,
        results: result,
      });
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

      return res.json({
        message: 'Expense retrieved successfully',
        code: 'EXPENSE_FETCH_SUCCESS',
        success: true,
        results: { expense },
      });
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

      return res.json({
        message: 'Expense created successfully',
        code: 'EXPENSE_CREATE_SUCCESS',
        success: true,
        results: { expense },
      });
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

      return res.json({
        message: 'Expense updated successfully',
        code: 'EXPENSE_UPDATE_SUCCESS',
        success: true,
        results: { expense },
      });
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

      return res.json({
        message: 'Expense marked as paid successfully',
        code: 'EXPENSE_PAY_SUCCESS',
        success: true,
        results: { expense },
      });
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

      return res.json({
        message: result.message || 'Expense deleted successfully',
        code: 'EXPENSE_DELETE_SUCCESS',
        success: true,
      });
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

      const filters = {};
      if (start_date) filters.start_date = start_date;
      if (end_date) filters.end_date = end_date;

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

      const stats = await ExpenseService.getExpenseStats(entityId, filters);

      return res.json({
        message: 'Expense statistics retrieved successfully',
        code: 'EXPENSE_STATS_FETCH_SUCCESS',
        success: true,
        results: stats,
      });
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

      const filters = {};
      if (start_date) filters.start_date = start_date;
      if (end_date) filters.end_date = end_date;

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

      const breakdown = await ExpenseService.getExpenseCategoryBreakdown(entityId, filters);

      return res.json({
        message: 'Expense category breakdown retrieved successfully',
        code: 'EXPENSE_CATEGORY_BREAKDOWN_FETCH_SUCCESS',
        success: true,
        results: breakdown,
      });
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

      const filters = {};
      if (start_date) filters.start_date = start_date;
      if (end_date) filters.end_date = end_date;

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

      const breakdown = await ExpenseService.getExpenseStatusBreakdown(entityId, filters);

      return res.json({
        message: 'Expense status breakdown retrieved successfully',
        code: 'EXPENSE_STATUS_BREAKDOWN_FETCH_SUCCESS',
        success: true,
        results: breakdown,
      });
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

      return res.json({
        message: 'Expense options retrieved successfully',
        code: 'EXPENSE_OPTIONS_FETCH_SUCCESS',
        success: true,
        results: options,
      });
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
      'EXPENSE_NOT_FOUND': {
        status: 404,
        message: 'Expense not found',
        code: 'EXPENSE_NOT_FOUND',
      },
      'EXPENSE_NOT_EDITABLE': {
        status: 400,
        message: 'Expense cannot be edited in its current status',
        code: 'EXPENSE_NOT_EDITABLE',
      },
      'EXPENSE_NOT_PAYABLE': {
        status: 400,
        message: 'Expense cannot be marked as paid in its current status',
        code: 'EXPENSE_NOT_PAYABLE',
      },
      'EXPENSE_NOT_DELETABLE': {
        status: 400,
        message: 'Expense cannot be deleted in its current status',
        code: 'EXPENSE_NOT_DELETABLE',
      },
      'INVALID_STATUS_TRANSITION': {
        status: 400,
        message: 'Invalid status transition. Only pending -> paid is allowed',
        code: 'INVALID_STATUS_TRANSITION',
      },
      'ENTITY_ID_REQUIRED': {
        status: 400,
        message: 'Entity ID is required',
        code: 'ENTITY_ID_REQUIRED',
      },
    };

    // Check for MongoDB validation error
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map((err) => err.message);
      return res.status(400).json({
        message: 'Validation error: ' + messages.join(', '),
        code: 'VALIDATION_ERROR',
        success: false,
        errors: messages,
      });
    }

    // Check for MongoDB duplicate key error
    if (error.code === 11000) {
      return res.status(409).json({
        message: 'Duplicate entry detected',
        code: 'DUPLICATE_ENTRY',
        success: false,
      });
    }

    const errorConfig = errorMap[error.message] || {
      status: 500,
      message: error.message || 'Internal server error',
      code: 'SERVER_ERROR',
    };

    return res.status(errorConfig.status).json({
      message: errorConfig.message,
      code: errorConfig.code,
      success: false,
    });
  }
}

module.exports = new ExpenseController();