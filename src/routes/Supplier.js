const express = require('express');
const router = express.Router();
const SupplierController = require('../controllers/Supplier');
const { authenticate } = require('../middleware/auth');

// All routes require authentication
router.use(authenticate);

// Supplier CRUD operations
router.get('/', SupplierController.getSuppliers.bind(SupplierController));
router.get('/stats', SupplierController.getSupplierStats.bind(SupplierController));
router.post('/bulk-import', SupplierController.bulkImportSuppliers.bind(SupplierController));
router.get('/:uuid', SupplierController.getSupplierByUuid.bind(SupplierController));
router.post('/', SupplierController.createSupplier.bind(SupplierController));
router.put('/:uuid', SupplierController.updateSupplier.bind(SupplierController));
router.delete('/:uuid', SupplierController.deleteSupplier.bind(SupplierController));

module.exports = router;