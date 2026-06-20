const InventoryService = require('../services/Inventory');
const { getCurrentEntity } = require('../middleware/auth');

class InventoryController {
  /**
   * GET /api/inventory
   * Get all inventory items with pagination
   */
  getItems = async (req, res) => {
    try {
      const entityId = getCurrentEntity(req);
      const { 
        page = 1, 
        limit = 10, 
        search, 
        type, 
        min_quantity, 
        max_quantity,
        min_price,
        max_price,
        stock_status,
        supplier,
      } = req.query;

      const result = await InventoryService.getItems(
        entityId,
        { search, type, min_quantity, max_quantity, min_price, max_price, stock_status, supplier },
        parseInt(page),
        parseInt(limit)
      );

      return res.json({
        message: "Inventory items retrieved successfully",
        code: "INVENTORY_FETCH_SUCCESS",
        success: true,
        results: result
      });
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

      return res.json({
        message: "Inventory item retrieved successfully",
        code: "INVENTORY_ITEM_FETCH_SUCCESS",
        success: true,
        results: { item }
      });
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

      return res.json({
        message: "Inventory item retrieved successfully",
        code: "INVENTORY_ITEM_FETCH_SUCCESS",
        success: true,
        results: { item }
      });
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

      return res.json({
        message: "Low stock items retrieved successfully",
        code: "LOW_STOCK_FETCH_SUCCESS",
        success: true,
        results: result
      });
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
   * POST /api/inventory
   * Create a new inventory item
   */
  createItem = async (req, res) => {
    try {
      const entityId = getCurrentEntity(req);
      const itemData = req.body;

      const item = await InventoryService.createItem(entityId, itemData, req);

      return res.json({
        message: "Inventory item created successfully",
        code: "INVENTORY_CREATED_SUCCESS",
        success: true,
        results: { item }
      });
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
        throw new Error('ITEMS_ARRAY_REQUIRED');
      }

      const result = await InventoryService.bulkCreateItems(entityId, items, req);

      return res.json({
        message: "Bulk inventory creation completed",
        code: "BULK_INVENTORY_CREATED",
        success: true,
        results: result
      });
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

      return res.json({
        message: "Inventory item updated successfully",
        code: "INVENTORY_UPDATED_SUCCESS",
        success: true,
        results: { item }
      });
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

      return res.json({
        message: "Stock adjusted successfully",
        code: "STOCK_ADJUSTED_SUCCESS",
        success: true,
        results: { item }
      });
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

      return res.json({
        message: result.message,
        code: "INVENTORY_DELETED_SUCCESS",
        success: true
      });
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
      'NAME_REQUIRED': {
        status: 400,
        message: 'Item name is required',
        code: 'NAME_REQUIRED'
      },
      'PART_NUMBER_ALREADY_EXISTS': {
        status: 409,
        message: 'Part number already exists',
        code: 'PART_NUMBER_ALREADY_EXISTS'
      },
      'INVENTORY_ITEM_NOT_FOUND': {
        status: 404,
        message: 'Inventory item not found',
        code: 'INVENTORY_ITEM_NOT_FOUND'
      },
      'QUANTITY_REQUIRED': {
        status: 400,
        message: 'Quantity is required for stock adjustment',
        code: 'QUANTITY_REQUIRED'
      },
      'INSUFFICIENT_STOCK': {
        status: 400,
        message: 'Insufficient stock for this operation',
        code: 'INSUFFICIENT_STOCK'
      },
      'ITEMS_ARRAY_REQUIRED': {
        status: 400,
        message: 'Items array is required for bulk creation',
        code: 'ITEMS_ARRAY_REQUIRED'
      },
      'ENTITY_ID_REQUIRED': {
        status: 400,
        message: 'Entity ID is required',
        code: 'ENTITY_ID_REQUIRED'
      }
    };

    // Check for MongoDB duplicate key error
    if (error.code === 11000) {
      return res.status(409).json({
        message: 'Duplicate entry detected',
        code: 'DUPLICATE_ENTRY',
        success: false
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

module.exports = new InventoryController();