// controllers/customerController.js
const CustomerService = require('../services/Customer');

class CustomerController {
  /**
   * GET /api/customers
   * Get all customers with pagination
   */
  getCustomers = async (req, res) => {
    try {
      const { 
        page = 1, 
        limit = 10, 
        search, 
        email,
        phone,
        is_active,
        min_balance,
        max_balance,
      } = req.query;

      const result = await CustomerService.getCustomers(
        { search, email, phone, is_active, min_balance, max_balance },
        parseInt(page),
        parseInt(limit)
      );

      return res.json({
        message: "Customers retrieved successfully",
        code: "CUSTOMERS_FETCH_SUCCESS",
        success: true,
        results: result
      });
    } catch (error) {
      return this.handleError(error, res);
    }
  };

  /**
   * GET /api/customers/:uuid
   * Get customer by UUID
   */
  getCustomer = async (req, res) => {
    try {
      const { uuid } = req.params;
      const customer = await CustomerService.getCustomerByUuid(uuid);

      return res.json({
        message: "Customer retrieved successfully",
        code: "CUSTOMER_FETCH_SUCCESS",
        success: true,
        results: { customer }
      });
    } catch (error) {
      return this.handleError(error, res);
    }
  };

  /**
   * GET /api/customers/email/:email
   * Get customer by email
   */
  getCustomerByEmail = async (req, res) => {
    try {
      const { email } = req.params;
      const customer = await CustomerService.getCustomerByEmail(email);

      return res.json({
        message: "Customer retrieved successfully",
        code: "CUSTOMER_FETCH_SUCCESS",
        success: true,
        results: { customer }
      });
    } catch (error) {
      return this.handleError(error, res);
    }
  };

  /**
   * GET /api/customers/stats
   * Get customer statistics
   */
  getCustomerStats = async (req, res) => {
    try {
      const stats = await CustomerService.getCustomerStats();

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
   * GET /api/customers/search
   * Search customers
   */
  searchCustomers = async (req, res) => {
    try {
      const { q, limit = 10 } = req.query;

      if (!q) {
        throw new Error('SEARCH_TERM_REQUIRED');
      }

      const customers = await CustomerService.searchCustomers(
        q,
        parseInt(limit)
      );

      return res.json({
        message: "Customers searched successfully",
        code: "CUSTOMERS_SEARCH_SUCCESS",
        success: true,
        results: { customers }
      });
    } catch (error) {
      return this.handleError(error, res);
    }
  };

  /**
   * POST /api/customers
   * Create a new customer
   */
  createCustomer = async (req, res) => {
    try {
      const customerData = req.body;
      const customer = await CustomerService.createCustomer(customerData, req);

      return res.json({
        message: "Customer created successfully",
        code: "CUSTOMER_CREATED_SUCCESS",
        success: true,
        results: { customer }
      });
    } catch (error) {
      return this.handleError(error, res);
    }
  };

  /**
   * POST /api/customers/bulk
   * Bulk create customers
   */
  bulkCreateCustomers = async (req, res) => {
    try {
      const { customers } = req.body;

      if (!customers || !Array.isArray(customers) || customers.length === 0) {
        throw new Error('CUSTOMERS_ARRAY_REQUIRED');
      }

      const result = await CustomerService.bulkCreateCustomers(customers, req);

      return res.json({
        message: "Bulk customer creation completed",
        code: "BULK_CUSTOMER_CREATED",
        success: true,
        results: result
      });
    } catch (error) {
      return this.handleError(error, res);
    }
  };

  /**
   * PUT /api/customers/:uuid
   * Update customer
   */
  updateCustomer = async (req, res) => {
    try {
      const { uuid } = req.params;
      const updateData = req.body;
      const customer = await CustomerService.updateCustomer(uuid, updateData, req);

      return res.json({
        message: "Customer updated successfully",
        code: "CUSTOMER_UPDATED_SUCCESS",
        success: true,
        results: { customer }
      });
    } catch (error) {
      return this.handleError(error, res);
    }
  };

  /**
   * PATCH /api/customers/:uuid/active
   * Toggle customer active status
   */
  toggleCustomerActive = async (req, res) => {
    try {
      const { uuid } = req.params;
      const { is_active } = req.body;

      if (is_active === undefined) {
        throw new Error('MISSING_ACTIVE_STATUS');
      }

      const customer = await CustomerService.toggleCustomerActive(
        uuid,
        is_active,
        req
      );

      return res.json({
        message: is_active ? "Customer activated successfully" : "Customer deactivated successfully",
        code: "CUSTOMER_STATUS_UPDATED",
        success: true,
        results: { customer }
      });
    } catch (error) {
      return this.handleError(error, res);
    }
  };

  /**
   * DELETE /api/customers/:uuid
   * Delete customer (soft delete if has invoices)
   */
  deleteCustomer = async (req, res) => {
    try {
      const { uuid } = req.params;
      const result = await CustomerService.deleteCustomer(uuid, req);

      return res.json({
        message: result.message,
        code: result.soft_delete ? "CUSTOMER_DEACTIVATED" : "CUSTOMER_DELETED_SUCCESS",
        success: true,
        results: result.soft_delete ? { customer: result.customer } : undefined
      });
    } catch (error) {
      return this.handleError(error, res);
    }
  };

  /**
   * Handle errors
   */
  handleError(error, res) {
    console.error('Customer Controller Error:', error);

    const errorMap = {
      'NAME_REQUIRED': {
        status: 400,
        message: 'Customer name is required',
        code: 'NAME_REQUIRED'
      },
      'EMAIL_ALREADY_EXISTS': {
        status: 409,
        message: 'Email already exists',
        code: 'EMAIL_ALREADY_EXISTS'
      },
      'PHONE_ALREADY_EXISTS': {
        status: 409,
        message: 'Phone number already exists',
        code: 'PHONE_ALREADY_EXISTS'
      },
      'CUSTOMER_NOT_FOUND': {
        status: 404,
        message: 'Customer not found',
        code: 'CUSTOMER_NOT_FOUND'
      },
      'MISSING_ACTIVE_STATUS': {
        status: 400,
        message: 'Active status (is_active) is required',
        code: 'MISSING_ACTIVE_STATUS'
      },
      'CUSTOMERS_ARRAY_REQUIRED': {
        status: 400,
        message: 'Customers array is required for bulk creation',
        code: 'CUSTOMERS_ARRAY_REQUIRED'
      },
      'SEARCH_TERM_REQUIRED': {
        status: 400,
        message: 'Search term is required',
        code: 'SEARCH_TERM_REQUIRED'
      }
    };

    // Check for MongoDB duplicate key error
    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern)[0];
      return res.status(409).json({
        message: `${field.charAt(0).toUpperCase() + field.slice(1)} already exists`,
        code: 'DUPLICATE_ENTRY',
        success: false,
        field
      });
    }

    // Check for validation error
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        message: 'Validation error: ' + messages.join(', '),
        code: 'VALIDATION_ERROR',
        success: false,
        errors: messages
      });
    }

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

module.exports = new CustomerController();