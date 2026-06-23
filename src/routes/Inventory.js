const express = require('express');
const router = express.Router();
const InventoryController = require('../controllers/Inventory');
const { 
  authenticate,
  requireEntity,
  authorize
} = require('../middleware/auth');

// All routes require authentication
router.use(authenticate);

// All routes require entity access (X-Entity header)
router.use(requireEntity);

// Inventory CRUD operations
router.get('/', InventoryController.getItems);
router.get('/stats', InventoryController.getInventoryStats);
router.get('/low-stock', InventoryController.getLowStockItems);
router.post('/', authorize('admin', 'super_admin'), InventoryController.createItem);
router.post('/bulk', authorize('admin', 'super_admin'), InventoryController.bulkCreateItems);

// Get by part number
router.get('/part-number/:partNumber', InventoryController.getItemByPartNumber);

// Get by UUID
router.get('/:uuid', InventoryController.getItem);
router.put('/:uuid', authorize('admin', 'super_admin'), InventoryController.updateItem);
router.delete('/:uuid', authorize('super_admin', 'admin'), InventoryController.deleteItem);

// Stock adjustment
router.patch('/:uuid/stock', authorize('super_admin', 'admin'), InventoryController.adjustStock);

module.exports = router;