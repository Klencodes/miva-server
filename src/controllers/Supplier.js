const SupplierService = require('../services/supplierService');
const { BaseController } = require('./baseController');

class SupplierController extends BaseController {
  /**
   * Get all suppliers
   */
  async getSuppliers(req, res) {
    try {
      const { entity_id } = req;
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
        entity_id,
        filters,
        parseInt(page),
        parseInt(limit)
      );

      return res.json({
        message: 'Suppliers retrieved successfully',
        code: 'SUPPLIERS_FETCH_SUCCESS',
        success: true,
        results: result,
      });
    } catch (error) {
      return this.handleError(error, res);
    }
  }

  /**
   * Get supplier by UUID
   */
  async getSupplierByUuid(req, res) {
    try {
      const { entity_id } = req;
      const { uuid } = req.params;

      const supplier = await SupplierService.getSupplierByUuid(entity_id, uuid);

      return res.json({
        message: 'Supplier retrieved successfully',
        code: 'SUPPLIER_FETCH_SUCCESS',
        success: true,
        results: { supplier },
      });
    } catch (error) {
      return this.handleError(error, res);
    }
  }

  /**
   * Create a new supplier
   */
  async createSupplier(req, res) {
    try {
      const { entity_id } = req;
      const data = req.body;

      const supplier = await SupplierService.createSupplier(entity_id, data, req);

      return res.json({
        message: 'Supplier created successfully',
        code: 'SUPPLIER_CREATED',
        success: true,
        results: { supplier },
      });
    } catch (error) {
      return this.handleError(error, res);
    }
  }

  /**
   * Update a supplier
   */
  async updateSupplier(req, res) {
    try {
      const { entity_id } = req;
      const { uuid } = req.params;
      const data = req.body;

      const supplier = await SupplierService.updateSupplier(entity_id, uuid, data, req);

      return res.json({
        message: 'Supplier updated successfully',
        code: 'SUPPLIER_UPDATED',
        success: true,
        results: { supplier },
      });
    } catch (error) {
      return this.handleError(error, res);
    }
  }

  /**
   * Delete a supplier
   */
  async deleteSupplier(req, res) {
    try {
      const { entity_id } = req;
      const { uuid } = req.params;

      const result = await SupplierService.deleteSupplier(entity_id, uuid, req);

      return res.json({
        message: 'Supplier deleted successfully',
        code: 'SUPPLIER_DELETED',
        success: true,
        results: result,
      });
    } catch (error) {
      return this.handleError(error, res);
    }
  }

  /**
   * Get supplier statistics
   */
  async getSupplierStats(req, res) {
    try {
      const { entity_id } = req;

      const stats = await SupplierService.getSupplierStats(entity_id);

      return res.json({
        message: 'Supplier statistics retrieved successfully',
        code: 'SUPPLIER_STATS_FETCH_SUCCESS',
        success: true,
        results: stats,
      });
    } catch (error) {
      return this.handleError(error, res);
    }
  }

  /**
   * Bulk import suppliers
   */
  async bulkImportSuppliers(req, res) {
    try {
      const { entity_id } = req;
      const { suppliers } = req.body;

      if (!suppliers || !Array.isArray(suppliers) || suppliers.length === 0) {
        return res.status(400).json({
          message: 'No suppliers to import',
          code: 'NO_SUPPLIERS_TO_IMPORT',
          success: false,
        });
      }

      const result = await SupplierService.bulkImportSuppliers(entity_id, suppliers, req);

      return res.json({
        message: 'Suppliers imported successfully',
        code: 'SUPPLIERS_IMPORTED',
        success: true,
        results: result,
      });
    } catch (error) {
      return this.handleError(error, res);
    }
  }

  handleError(error, res) {
    console.error('Error:', error);

    const errorMap = {
      SUPPLIER_NOT_FOUND: { status: 404, message: 'Supplier not found' },
      NAME_REQUIRED: { status: 400, message: 'Supplier name is required' },
      EMAIL_REQUIRED: { status: 400, message: 'Email is required' },
      PHONE_NUMBER_REQUIRED: { status: 400, message: 'Phone number is required' },
      ADDRESS_REQUIRED: { status: 400, message: 'Address is required' },
      EMAIL_ALREADY_EXISTS: { status: 409, message: 'Email already exists' },
      TAX_ID_ALREADY_EXISTS: { status: 409, message: 'Tax ID already exists' },
      REGISTRATION_NUMBER_ALREADY_EXISTS: { status: 409, message: 'Registration number already exists' },
    };

    const errorInfo = errorMap[error.message];
    if (errorInfo) {
      return res.status(errorInfo.status).json({
        message: errorInfo.message,
        code: error.message,
        success: false,
      });
    }

    return res.status(500).json({
      message: error.message || 'Internal server error',
      code: 'INTERNAL_SERVER_ERROR',
      success: false,
    });
  }
}

module.exports = new SupplierController();