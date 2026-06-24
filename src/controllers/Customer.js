// controllers/customerController.js
const CustomerService = require('../services/Customer');
const { ApiResponse, ErrorResponse } = require('../utils/response');
const Pagination = require('../utils/pagination'); // Your pagination utility

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

      // Generate pagination links
      const baseUrl = `${req.protocol}://${req.get('host')}${req.baseUrl}${req.path}`;
      const pagination = Pagination.generatePaginationResponse(
        result.customers,
        result.count,
        parseInt(page),
        parseInt(limit),
        baseUrl,
        req.query
      );

      const response = new ApiResponse(
        result.customers,
        "Customers retrieved successfully",
        pagination
      );
      return res.json(response);
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

      const response = new ApiResponse(customer, "Customer retrieved successfully");
      return res.json(response);
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

      const response = new ApiResponse(customer, "Customer retrieved successfully");
      return res.json(response);
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

      const response = new ApiResponse(stats, "Customer statistics retrieved successfully");
      return res.json(response);
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
        const error = new Error('SEARCH_TERM_REQUIRED');
        error.status = 400;
        throw error;
      }

      const customers = await CustomerService.searchCustomers(q, parseInt(limit));

      const response = new ApiResponse({ customers }, "Customers searched successfully");
      return res.json(response);
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

      const response = new ApiResponse(customer, "Customer created successfully");
      return res.json(response);
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
        const error = new Error('CUSTOMERS_ARRAY_REQUIRED');
        error.status = 400;
        throw error;
      }

      const result = await CustomerService.bulkCreateCustomers(customers, req);

      const response = new ApiResponse(result, "Bulk customer creation completed");
      return res.json(response);
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

      const response = new ApiResponse(customer, "Customer updated successfully");
      return res.json(response);
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
        const error = new Error('MISSING_ACTIVE_STATUS');
        error.status = 400;
        throw error;
      }

      const customer = await CustomerService.toggleCustomerActive(uuid, is_active, req);

      const message = is_active ? "Customer activated successfully" : "Customer deactivated successfully";
      const response = new ApiResponse(customer, message);
      return res.json(response);
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

      const response = new ApiResponse(
        result.soft_delete ? { customer: result.customer } : null,
        result.message
      );
      return res.json(response);
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
      'NAME_REQUIRED': { status: 400, message: 'Customer name is required' },
      'EMAIL_ALREADY_EXISTS': { status: 409, message: 'Email already exists' },
      'PHONE_ALREADY_EXISTS': { status: 409, message: 'Phone number already exists' },
      'CUSTOMER_NOT_FOUND': { status: 404, message: 'Customer not found' },
      'MISSING_ACTIVE_STATUS': { status: 400, message: 'Active status (is_active) is required' },
      'CUSTOMERS_ARRAY_REQUIRED': { status: 400, message: 'Customers array is required for bulk creation' },
      'SEARCH_TERM_REQUIRED': { status: 400, message: 'Search term is required' }
    };

    // Check for MongoDB duplicate key error
    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern)[0];
      const errorResponse = new ErrorResponse(
        `${field.charAt(0).toUpperCase() + field.slice(1)} already exists`
      );
      return res.status(409).json(errorResponse);
    }

    // Check for validation error
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(err => err.message);
      const errorResponse = new ErrorResponse('Validation error: ' + messages.join(', '));
      return res.status(400).json(errorResponse);
    }

    const errorConfig = errorMap[error.message] || {
      status: error.status || 500,
      message: error.message || 'Internal server error'
    };

    const errorResponse = new ErrorResponse(errorConfig.message);
    return res.status(errorConfig.status).json(errorResponse);
  }
}

module.exports = new CustomerController();