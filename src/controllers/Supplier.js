// controllers/supplierController.js
const SupplierService = require('../services/Supplier');
const { ApiResponse, ErrorResponse } = require('../utils/response');
const Pagination = require('../utils/pagination');

class SupplierController {
  /**
   * Get all suppliers
   */
  async getSuppliers(req, res) {
    try {
      const {
        page = 1,
        limit = 10,
        search,
        status,
        city,
        country,
        sort_by,
        sort_order,
      } = req.query;

      const filters = { search, status, city, country, sort_by, sort_order };

      const result = await SupplierService.getSuppliers(
        filters,
        parseInt(page),
        parseInt(limit)
      );

      // Generate pagination links
      const baseUrl = `${req.protocol}://${req.get('host')}${req.baseUrl}${req.path}`;
      const pagination = Pagination.generatePaginationResponse(
        result.suppliers,
        result.count,
        parseInt(page),
        parseInt(limit),
        baseUrl,
        req.query
      );

      const response = new ApiResponse(
        result.suppliers,
        "Suppliers retrieved successfully",
        pagination
      );
      return res.json(response);
    } catch (error) {
      return this.handleError(error, res);
    }
  }

  /**
   * Get supplier by UUID
   */
  async getSupplierByUuid(req, res) {
    try {
      const { uuid } = req.params;
      const supplier = await SupplierService.getSupplierByUuid(uuid);

      const response = new ApiResponse(supplier, "Supplier retrieved successfully");
      return res.json(response);
    } catch (error) {
      return this.handleError(error, res);
    }
  }

  /**
   * Create a new supplier
   */
  async createSupplier(req, res) {
    try {
      const data = req.body;
      const supplier = await SupplierService.createSupplier(data, req);

      const response = new ApiResponse(supplier, "Supplier created successfully");
      return res.json(response);
    } catch (error) {
      return this.handleError(error, res);
    }
  }

  /**
   * Update a supplier
   */
  async updateSupplier(req, res) {
    try {
      const { uuid } = req.params;
      const data = req.body;

      const supplier = await SupplierService.updateSupplier(uuid, data, req);

      const response = new ApiResponse(supplier, "Supplier updated successfully");
      return res.json(response);
    } catch (error) {
      return this.handleError(error, res);
    }
  }

  /**
   * Delete a supplier
   */
  async deleteSupplier(req, res) {
    try {
      const { uuid } = req.params;
      const result = await SupplierService.deleteSupplier(uuid, req);

      const response = new ApiResponse(null, result.message);
      return res.json(response);
    } catch (error) {
      return this.handleError(error, res);
    }
  }

  /**
   * Get supplier statistics
   */
  async getSupplierStats(req, res) {
    try {
      const stats = await SupplierService.getSupplierStats();

      const response = new ApiResponse(stats, "Supplier statistics retrieved successfully");
      return res.json(response);
    } catch (error) {
      return this.handleError(error, res);
    }
  }

  /**
   * Bulk import suppliers
   */
  async bulkImportSuppliers(req, res) {
    try {
      const { suppliers } = req.body;

      if (!suppliers || !Array.isArray(suppliers) || suppliers.length === 0) {
        const error = new Error('NO_SUPPLIERS_TO_IMPORT');
        error.status = 400;
        throw error;
      }

      const result = await SupplierService.bulkImportSuppliers(suppliers, req);

      const response = new ApiResponse(result, "Suppliers imported successfully");
      return res.json(response);
    } catch (error) {
      return this.handleError(error, res);
    }
  }

  handleError(error, res) {
    console.error('Supplier Controller Error:', error);

    const errorMap = {
      SUPPLIER_NOT_FOUND: { status: 404, message: 'Supplier not found' },
      NAME_REQUIRED: { status: 400, message: 'Supplier name is required' },
      EMAIL_REQUIRED: { status: 400, message: 'Email is required' },
      PHONE_NUMBER_REQUIRED: { status: 400, message: 'Phone number is required' },
      ADDRESS_REQUIRED: { status: 400, message: 'Address is required' },
      EMAIL_ALREADY_EXISTS: { status: 409, message: 'Email already exists' },
      TAX_ID_ALREADY_EXISTS: { status: 409, message: 'Tax ID already exists' },
      REGISTRATION_NUMBER_ALREADY_EXISTS: { status: 409, message: 'Registration number already exists' },
      NO_SUPPLIERS_TO_IMPORT: { status: 400, message: 'No suppliers to import' },
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

    const errorInfo = errorMap[error.message];
    if (errorInfo) {
      const errorResponse = new ErrorResponse(errorInfo.message);
      return res.status(errorInfo.status).json(errorResponse);
    }

    const errorResponse = new ErrorResponse(error.message || 'Internal server error');
    return res.status(500).json(errorResponse);
  }
}

module.exports = new SupplierController();