// routes/customerRoutes.js
const express = require('express');
const router = express.Router();
const CustomerController = require('../controllers/Customer');
const { 
  authenticate, 
} = require('../middleware/auth');

// All routes require authentication
router.use(authenticate);

// Customer CRUD operations
router.get('/', CustomerController.getCustomers);
router.get('/stats', CustomerController.getCustomerStats);
router.get('/search', CustomerController.searchCustomers);
router.post('/', CustomerController.createCustomer);
router.post('/bulk', CustomerController.bulkCreateCustomers);

// Get by email
router.get('/email/:email', CustomerController.getCustomerByEmail);

// Get by UUID
router.get('/:uuid', CustomerController.getCustomer);
router.put('/:uuid', CustomerController.updateCustomer);
router.delete('/:uuid', CustomerController.deleteCustomer);

// Toggle active status
router.patch('/:uuid/active', CustomerController.toggleCustomerActive);

module.exports = router;