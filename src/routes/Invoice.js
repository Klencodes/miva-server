// routes/invoiceRoutes.js
const express = require('express');
const router = express.Router();
const InvoiceController = require('../controllers/Invoice');
const { authenticate, requireEntity } = require('../middleware/auth');

// All routes require authentication
router.use(authenticate);

// All routes require entity access (X-Entity header)
router.use(requireEntity);

// Invoice CRUD operations
router.get('/', InvoiceController.getInvoices);
router.get('/stats', InvoiceController.getInvoiceStats);
router.get('/next-number', InvoiceController.getNextInvoiceNumber);
router.post('/', InvoiceController.createInvoice);
router.post('/bulk', InvoiceController.bulkCreateInvoices);

// Invoice by number
router.get('/number/:number', InvoiceController.getInvoiceByNumber);

// Overdue invoices
router.get('/overdue', InvoiceController.getOverdueInvoices);

// Customer invoices
router.get('/customer/:customerId', InvoiceController.getInvoicesByCustomer);

// Invoice by UUID
router.get('/:uuid', InvoiceController.getInvoice);
router.put('/:uuid', InvoiceController.updateInvoice);
router.delete('/:uuid', InvoiceController.deleteInvoice);

// Invoice actions
router.post('/:uuid/payments', InvoiceController.addPayment);
router.patch('/:uuid/paid', InvoiceController.markAsPaid);
router.patch('/:uuid/cancel', InvoiceController.cancelInvoice);
router.post('/:uuid/send', InvoiceController.sendInvoice);
router.get('/:uuid/export', InvoiceController.exportInvoice);

module.exports = router;