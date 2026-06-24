// controllers/InventoryController.js
const InventoryService = require('../services/Inventory');
const { getCurrentEntity } = require('../middleware/auth');
const { ApiResponse, ErrorResponse } = require('../utils/response');
const Pagination = require('../utils/pagination');

class InventoryController {
  /**
   * GET /api/inventory
   * Get all inventory items with pagination
   */
  getItems = async (req, res) => {
    try {
      const entityId = getCurrentEntity(req);
      const { page = 1, limit = 10, search, type, min_quantity, max_quantity,min_price,max_price,stock_status,supplier,} = req.query;

      const result = await InventoryService.getItems(
        entityId,
        { search, type, min_quantity, max_quantity, min_price, max_price, stock_status, supplier },
        parseInt(page),
        parseInt(limit)
      );

      // Generate pagination links
      const baseUrl = `${req.protocol}://${req.get('host')}${req.baseUrl}${req.path}`;
      const pagination = Pagination.generatePaginationResponse(
        result.items,
        result.count,
        parseInt(page),
        parseInt(limit),
        baseUrl,
        req.query
      );

      const response = new ApiResponse(
        result.items,
        "Inventory items retrieved successfully",
        pagination
      );
      return res.json(response);
    } catch (error) {
      return this.handleError(error, res);
    }
  };

  /**
   * GET /api/inventory/:uuid
   * Get inventory item by UUID
   */
  getItem = async (req, res) => {
    try {
      const { uuid } = req.params;
      const entityId = getCurrentEntity(req);

      const item = await InventoryService.getItemByUuid(entityId, uuid);

      const response = new ApiResponse(item, "Inventory item retrieved successfully");
      return res.json(response);
    } catch (error) {
      return this.handleError(error, res);
    }
  };

  /**
   * GET /api/inventory/part-number/:partNumber
   * Get inventory item by part number
   */
  getItemByPartNumber = async (req, res) => {
    try {
      const { partNumber } = req.params;
      const entityId = getCurrentEntity(req);

      const item = await InventoryService.getItemByPartNumber(entityId, partNumber);

      const response = new ApiResponse(item, "Inventory item retrieved successfully");
      return res.json(response);
    } catch (error) {
      return this.handleError(error, res);
    }
  };

  /**
   * GET /api/inventory/low-stock
   * Get low stock items
   */
  getLowStockItems = async (req, res) => {
    try {
      const entityId = getCurrentEntity(req);
      const { page = 1, limit = 10 } = req.query;

      const result = await InventoryService.getLowStockItems(
        entityId,
        parseInt(page),
        parseInt(limit)
      );

      // Generate pagination links
      const baseUrl = `${req.protocol}://${req.get('host')}${req.baseUrl}${req.path}`;
      const pagination = Pagination.generatePaginationResponse(
        result.items,
        result.count,
        parseInt(page),
        parseInt(limit),
        baseUrl,
        req.query
      );

      const response = new ApiResponse(
        result.items,
        "Low stock items retrieved successfully",
        pagination
      );
      return res.json(response);
    } catch (error) {
      return this.handleError(error, res);
    }
  };

  /**
   * GET /api/inventory/stats
   * Get inventory statistics
   */
  getInventoryStats = async (req, res) => {
    try {
      const entityId = getCurrentEntity(req);

      const stats = await InventoryService.getInventoryStats(entityId);

      const response = new ApiResponse(stats, "Inventory statistics retrieved successfully");
      return res.json(response);
    } catch (error) {
      return this.handleError(error, res);
    }
  };

  /**
   * POST /api/inventory
   * Create a new inventory item
   */
  createItem = async (req, res) => {
    try {
      const entityId = getCurrentEntity(req);
      const itemData = req.body;

      const item = await InventoryService.createItem(entityId, itemData, req);

      const response = new ApiResponse(item, "Inventory item created successfully");
      return res.json(response);
    } catch (error) {
      return this.handleError(error, res);
    }
  };

  /**
   * POST /api/inventory/bulk
   * Bulk create inventory items
   */
  bulkCreateItems = async (req, res) => {
    try {
      const entityId = getCurrentEntity(req);
      const { items } = req.body;

      if (!items || !Array.isArray(items) || items.length === 0) {
        const error = new Error('ITEMS_ARRAY_REQUIRED');
        error.status = 400;
        throw error;
      }

      const result = await InventoryService.bulkCreateItems(entityId, items, req);

      const response = new ApiResponse(result, "Bulk inventory creation completed");
      return res.json(response);
    } catch (error) {
      return this.handleError(error, res);
    }
  };

  /**
   * PUT /api/inventory/:uuid
   * Update inventory item
   */
  updateItem = async (req, res) => {
    try {
      const { uuid } = req.params;
      const entityId = getCurrentEntity(req);
      const updateData = req.body;

      const item = await InventoryService.updateItem(entityId, uuid, updateData, req);

      const response = new ApiResponse(item, "Inventory item updated successfully");
      return res.json(response);
    } catch (error) {
      return this.handleError(error, res);
    }
  };

  /**
   * PATCH /api/inventory/:uuid/stock
   * Adjust stock quantity
   */
  adjustStock = async (req, res) => {
    try {
      const { uuid } = req.params;
      const entityId = getCurrentEntity(req);
      const adjustmentData = req.body;

      const item = await InventoryService.adjustStock(entityId, uuid, adjustmentData, req);

      const response = new ApiResponse(item, "Stock adjusted successfully");
      return res.json(response);
    } catch (error) {
      return this.handleError(error, res);
    }
  };

  /**
   * DELETE /api/inventory/:uuid
   * Delete inventory item
   */
  deleteItem = async (req, res) => {
    try {
      const { uuid } = req.params;
      const entityId = getCurrentEntity(req);

      const result = await InventoryService.deleteItem(entityId, uuid, req);

      const response = new ApiResponse(null, result.message);
      return res.json(response);
    } catch (error) {
      return this.handleError(error, res);
    }
  };

  /**
   * Handle errors
   */
  handleError(error, res) {
    console.error('Inventory Controller Error:', error);

    const errorMap = {
      'NAME_REQUIRED': { status: 400, message: 'Item name is required' },
      'PART_NUMBER_ALREADY_EXISTS': { status: 409, message: 'Part number already exists' },
      'INVENTORY_ITEM_NOT_FOUND': { status: 404, message: 'Inventory item not found' },
      'QUANTITY_REQUIRED': { status: 400, message: 'Quantity is required for stock adjustment' },
      'INSUFFICIENT_STOCK': { status: 400, message: 'Insufficient stock for this operation' },
      'ITEMS_ARRAY_REQUIRED': { status: 400, message: 'Items array is required for bulk creation' },
      'ENTITY_ID_REQUIRED': { status: 400, message: 'Entity ID is required' }
    };

    // Check for MongoDB duplicate key error
    if (error.code === 11000) {
      const errorResponse = new ErrorResponse('Duplicate entry detected');
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

module.exports = new InventoryController();