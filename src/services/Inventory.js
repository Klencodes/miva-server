// services/inventoryService.js
const Inventory = require('../models/Inventory');
const { logActivity } = require('../utils/activityLogger');

class InventoryService {
  /**
   * Format number to 2 decimal places
   */
  formatCurrency(value) {
    if (value === undefined || value === null || isNaN(value)) return 0;
    return Math.round(value * 100) / 100;
  }

  /**
   * Get all inventory items with pagination and filtering
   */
  // services/inventoryService.js

async getItems(entityId, filters = {}, page = 1, limit = 10) {
  const skip = (page - 1) * limit;
  const query = {};

  // 🔥 FIX: Handle missing entity ID
  if (!entityId) {
    console.warn('⚠️ No entity ID provided for inventory query');
    // Option 1: Return empty result
    return {
      items: [],
      count: 0,
      page,
      limit,
      totalPages: 0,
    };
    
    // Option 2: Get items without entity filter (if you want to show all)
    // query = {};
  } else {
    query.entity_id = entityId;
  }

  // Apply filters
  if (filters.search) {
    query.$or = [
      { name: { $regex: filters.search, $options: 'i' } },
      { part_number: { $regex: filters.search, $options: 'i' } },
      { supplier: { $regex: filters.search, $options: 'i' } },
      { 'metadata.location': { $regex: filters.search, $options: 'i' } },
    ];
  }

  if (filters.type) {
    query.type = filters.type;
  }

  if (filters.min_quantity !== undefined) {
    query.quantity = { ...query.quantity, $gte: parseInt(filters.min_quantity) };
  }

  if (filters.max_quantity !== undefined) {
    query.quantity = { ...query.quantity, $lte: parseInt(filters.max_quantity) };
  }

  if (filters.min_price !== undefined) {
    query.price = { ...query.price, $gte: parseFloat(filters.min_price) };
  }

  if (filters.max_price !== undefined) {
    query.price = { ...query.price, $lte: parseFloat(filters.max_price) };
  }

  if (filters.stock_status === 'low_stock') {
    query.$expr = { $lte: ['$quantity', '$reorder_threshold'] };
    query.quantity = { $gt: 0 };
  } else if (filters.stock_status === 'out_of_stock') {
    query.quantity = 0;
  } else if (filters.stock_status === 'in_stock') {
    query.quantity = { $gt: 0 };
  }

  if (filters.supplier) {
    query.supplier = { $regex: filters.supplier, $options: 'i' };
  }

  if (filters.metadata) {
    Object.entries(filters.metadata).forEach(([key, value]) => {
      query[`metadata.${key}`] = value;
    });
  }

  try {
    const [items, total] = await Promise.all([
      Inventory.find(query)
        .sort({ created_at: -1 })
        .skip(skip)
        .limit(limit),
      Inventory.countDocuments(query),
    ]);

    console.log(`✅ Found ${total} inventory items for entity ${entityId || 'all'}`);

    // Format currency values in items
    const formattedItems = items.map(i => {
      const item = i.toSafeObject ? i.toSafeObject() : i.toObject();
      if (item.cost !== undefined) item.cost = this.formatCurrency(item.cost);
      if (item.price !== undefined) item.price = this.formatCurrency(item.price);
      return item;
    });

    return {
      items: formattedItems,
      count: total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  } catch (error) {
    console.error('❌ Error fetching inventory items:', error);
    throw error;
  }
}

  /**
   * Get inventory item by UUID
   */
  async getItemByUuid(entityId, uuid) {
    const item = await Inventory.findOne({ entity_id: entityId, uuid });
    if (!item) {
      throw new Error('INVENTORY_ITEM_NOT_FOUND');
    }
    const safeItem = item.toSafeObject();
    if (safeItem.cost !== undefined) safeItem.cost = this.formatCurrency(safeItem.cost);
    if (safeItem.price !== undefined) safeItem.price = this.formatCurrency(safeItem.price);
    return safeItem;
  }

  /**
   * Get inventory item by part number
   */
  async getItemByPartNumber(entityId, partNumber) {
    const item = await Inventory.findOne({ 
      entity_id: entityId, 
      part_number: partNumber 
    });
    if (!item) {
      throw new Error('INVENTORY_ITEM_NOT_FOUND');
    }
    const safeItem = item.toSafeObject();
    if (safeItem.cost !== undefined) safeItem.cost = this.formatCurrency(safeItem.cost);
    if (safeItem.price !== undefined) safeItem.price = this.formatCurrency(safeItem.price);
    return safeItem;
  }

  /**
   * Create inventory item
   */
  async createItem(entityId, data, req) {
    const {
      name,
      part_number,
      type,
      unit,
      quantity = 0,
      metadata = {},
      reorder_threshold = 5,
      cost = 0,
      price = 0,
      supplier,
      image,
    } = data;

    // Validate required fields
    if (!name) {
      throw new Error('NAME_REQUIRED');
    }

    // Check for duplicate part number
    if (part_number) {
      const existing = await Inventory.findOne({ 
        entity_id: entityId, 
        part_number: part_number 
      });
      if (existing) {
        throw new Error('PART_NUMBER_ALREADY_EXISTS');
      }
    }

    // Create a Map for metadata if needed
    let metadataMap;
    if (metadata && typeof metadata === 'object') {
      metadataMap = new Map(Object.entries(metadata));
    } else {
      metadataMap = new Map();
    }

    // Create item
    const item = new Inventory({
      entity_id: entityId,
      name,
      part_number: part_number || undefined,
      type: type || 'other',
      unit: unit || 'pieces',
      quantity: Math.max(0, quantity),
      metadata: metadataMap,
      reorder_threshold: Math.max(0, reorder_threshold),
      cost: this.formatCurrency(Math.max(0, cost)),
      price: this.formatCurrency(Math.max(0, price)),
      supplier,
      image,
      created_by: req.user?.uuid || null,
      updated_by: req.user?.uuid || null,
    });

    await item.save();

    // Log activity
    await logActivity({
      user_id: req.user?._id || null,
      user_name: req.user?.name || 'system',
      user_role: req.user?.role || 'system',
      action: 'inventory_created',
      description: `Inventory item created: ${item.name}`,
      metadata: {
        item_id: item.uuid,
        item_name: item.name,
        part_number: item.part_number,
        type: item.type,
        quantity: item.quantity,
        created_by: req.user?.email || 'system',
      },
      req,
      status: 'success'
    });

    const safeItem = item.toSafeObject();
    if (safeItem.cost !== undefined) safeItem.cost = this.formatCurrency(safeItem.cost);
    if (safeItem.price !== undefined) safeItem.price = this.formatCurrency(safeItem.price);
    return safeItem;
  }

  /**
   * Update inventory item
   */
  async updateItem(entityId, uuid, data, req) {
    const item = await Inventory.findOne({ entity_id: entityId, uuid });
    if (!item) {
      throw new Error('INVENTORY_ITEM_NOT_FOUND');
    }

    const {
      name,
      part_number,
      type,
      unit,
      quantity,
      metadata,
      reorder_threshold,
      cost,
      price,
      supplier,
      image,
    } = data;

    // Check for duplicate part number
    if (part_number && part_number !== item.part_number) {
      const existing = await Inventory.findOne({ 
        entity_id: entityId, 
        part_number: part_number,
        uuid: { $ne: uuid }
      });
      if (existing) {
        throw new Error('PART_NUMBER_ALREADY_EXISTS');
      }
    }

    // Update fields
    if (name) item.name = name;
    if (part_number !== undefined) item.part_number = part_number || undefined;
    if (type) item.type = type;
    if (unit) item.unit = unit;
    if (quantity !== undefined) item.quantity = Math.max(0, quantity);
    
    // Handle metadata update with Map
    if (metadata) {
      if (metadata instanceof Map) {
        item.metadata = metadata;
      } else if (typeof metadata === 'object') {
        const currentMetadata = item.metadata instanceof Map 
          ? Object.fromEntries(item.metadata) 
          : item.metadata || {};
        const mergedMetadata = { ...currentMetadata, ...metadata };
        item.metadata = new Map(Object.entries(mergedMetadata));
      }
    }
    
    if (reorder_threshold !== undefined) item.reorder_threshold = Math.max(0, reorder_threshold);
    if (cost !== undefined) item.cost = this.formatCurrency(Math.max(0, cost));
    if (price !== undefined) item.price = this.formatCurrency(Math.max(0, price));
    if (supplier !== undefined) item.supplier = supplier;
    if (image !== undefined) item.image = image;

    item.updated_by = req.user?.uuid || null;
    await item.save();

    // Log activity
    await logActivity({
      user_id: req.user?._id || null,
      user_name: req.user?.name || 'system',
      user_role: req.user?.role || 'system',
      action: 'inventory_updated',
      description: `Inventory item updated: ${item.name}`,
      metadata: {
        item_id: item.uuid,
        item_name: item.name,
        part_number: item.part_number,
        updated_fields: Object.keys(data),
        updated_by: req.user?.email || 'system',
      },
      req,
      status: 'success'
    });

    const safeItem = item.toSafeObject();
    if (safeItem.cost !== undefined) safeItem.cost = this.formatCurrency(safeItem.cost);
    if (safeItem.price !== undefined) safeItem.price = this.formatCurrency(safeItem.price);
    return safeItem;
  }

  /**
   * Delete inventory item
   */
  async deleteItem(entityId, uuid, req) {
    const item = await Inventory.findOne({ entity_id: entityId, uuid });
    if (!item) {
      throw new Error('INVENTORY_ITEM_NOT_FOUND');
    }

    await item.deleteOne();

    // Log activity
    await logActivity({
      user_id: req.user?._id || null,
      user_name: req.user?.name || 'system',
      user_role: req.user?.role || 'system',
      action: 'inventory_deleted',
      description: `Inventory item deleted: ${item.name}`,
      metadata: {
        item_id: item.uuid,
        item_name: item.name,
        part_number: item.part_number,
        deleted_by: req.user?.email || 'system',
      },
      req,
      status: 'success'
    });

    return { message: 'Inventory item deleted successfully' };
  }

  /**
   * Adjust stock quantity
   */
  async adjustStock(entityId, uuid, adjustment, req) {
    const item = await Inventory.findOne({ entity_id: entityId, uuid });
    if (!item) {
      throw new Error('INVENTORY_ITEM_NOT_FOUND');
    }

    const { quantity, type = 'set', reason } = adjustment;

    if (quantity === undefined || quantity === null) {
      throw new Error('QUANTITY_REQUIRED');
    }

    let oldQuantity = item.quantity;
    let newQuantity;

    switch (type) {
      case 'add':
        newQuantity = item.quantity + quantity;
        break;
      case 'subtract':
        if (item.quantity < quantity) {
          throw new Error('INSUFFICIENT_STOCK');
        }
        newQuantity = item.quantity - quantity;
        break;
      case 'set':
      default:
        newQuantity = Math.max(0, quantity);
        break;
    }

    item.quantity = newQuantity;
    item.updated_by = req.user?.uuid || null;
    await item.save();

    // Log activity
    await logActivity({
      user_id: req.user?._id || null,
      user_name: req.user?.name || 'system',
      user_role: req.user?.role || 'system',
      action: 'inventory_stock_adjusted',
      description: `Stock adjusted for ${item.name}`,
      metadata: {
        item_id: item.uuid,
        item_name: item.name,
        part_number: item.part_number,
        old_quantity: oldQuantity,
        new_quantity: newQuantity,
        adjustment_type: type,
        adjustment_amount: quantity,
        reason: reason || 'Manual adjustment',
        adjusted_by: req.user?.email || 'system',
      },
      req,
      status: 'success'
    });

    const safeItem = item.toSafeObject();
    if (safeItem.cost !== undefined) safeItem.cost = this.formatCurrency(safeItem.cost);
    if (safeItem.price !== undefined) safeItem.price = this.formatCurrency(safeItem.price);
    return safeItem;
  }

  /**
   * Get inventory statistics
   */
  async getInventoryStats(entityId) {
    const stats = await Inventory.aggregate([
      { $match: { entity_id: entityId } },
      {
        $group: {
          _id: null,
          total_items: { $sum: 1 },
          total_quantity: { $sum: '$quantity' },
          total_value: { $sum: { $multiply: ['$quantity', '$cost'] } },
          total_price: { $sum: { $multiply: ['$quantity', '$price'] } },
          avg_cost: { $avg: '$cost' },
          avg_price: { $avg: '$price' },
        },
      },
    ]);

    const typeStats = await Inventory.aggregate([
      { $match: { entity_id: entityId } },
      {
        $group: {
          _id: '$type',
          count: { $sum: 1 },
          quantity: { $sum: '$quantity' },
        },
      },
    ]);

    const stockStatus = await Inventory.aggregate([
      { $match: { entity_id: entityId } },
      {
        $group: {
          _id: {
            $switch: {
              branches: [
                { case: { $eq: ['$quantity', 0] }, then: 'out_of_stock' },
                { case: { $lte: ['$quantity', '$reorder_threshold'] }, then: 'low_stock' },
              ],
              default: 'in_stock',
            },
          },
          count: { $sum: 1 },
          quantity: { $sum: '$quantity' },
        },
      },
    ]);

    const result = stats[0] || {
      total_items: 0,
      total_quantity: 0,
      total_value: 0,
      total_price: 0,
      avg_cost: 0,
      avg_price: 0,
    };

    return {
      totals: {
        total_items: result.total_items || 0,
        total_quantity: result.total_quantity || 0,
        total_value: this.formatCurrency(result.total_value || 0),
        total_price: this.formatCurrency(result.total_price || 0),
        avg_cost: this.formatCurrency(result.avg_cost || 0),
        avg_price: this.formatCurrency(result.avg_price || 0),
      },
      by_type: typeStats.map(t => ({
        type: t._id || 'Unknown',
        count: t.count || 0,
        quantity: t.quantity || 0,
      })),
      by_stock_status: stockStatus.map(s => ({
        status: s._id || 'unknown',
        count: s.count || 0,
        quantity: s.quantity || 0,
      })),
    };
  }

  /**
   * Get low stock items
   */
  async getLowStockItems(entityId, page = 1, limit = 10) {
    const skip = (page - 1) * limit;
    const query = {
      entity_id: entityId,
      $expr: { $lte: ['$quantity', '$reorder_threshold'] },
      quantity: { $gt: 0 },
    };

    const [items, total] = await Promise.all([
      Inventory.find(query)
        .sort({ quantity: 1 })
        .skip(skip)
        .limit(limit),
      Inventory.countDocuments(query),
    ]);

    const formattedItems = items.map(i => {
      const item = i.toSafeObject();
      if (item.cost !== undefined) item.cost = this.formatCurrency(item.cost);
      if (item.price !== undefined) item.price = this.formatCurrency(item.price);
      return item;
    });

    return {
      items: formattedItems,
      count: total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Bulk create inventory items
   */
  async bulkCreateItems(entityId, itemsData, req) {
    const results = [];
    const errors = [];

    for (const data of itemsData) {
      try {
        const item = await this.createItem(entityId, data, req);
        results.push(item);
      } catch (error) {
        errors.push({
          data,
          error: error.message,
        });
      }
    }

    return {
      created: results,
      failed: errors,
      total: itemsData.length,
      success_count: results.length,
      failure_count: errors.length,
    };
  }

  /**
   * Get items by metadata field
   */
  async getItemsByMetadata(entityId, metadataKey, metadataValue, page = 1, limit = 10) {
    const skip = (page - 1) * limit;
    const query = { 
      entity_id: entityId,
      [`metadata.${metadataKey}`]: metadataValue 
    };

    const [items, total] = await Promise.all([
      Inventory.find(query)
        .sort({ created_at: -1 })
        .skip(skip)
        .limit(limit),
      Inventory.countDocuments(query),
    ]);

    const formattedItems = items.map(i => {
      const item = i.toSafeObject();
      if (item.cost !== undefined) item.cost = this.formatCurrency(item.cost);
      if (item.price !== undefined) item.price = this.formatCurrency(item.price);
      return item;
    });

    return {
      items: formattedItems,
      count: total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }
}

module.exports = new InventoryService();