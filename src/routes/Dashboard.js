// routes/dashboardRoutes.js
const express = require('express');
const router = express.Router();
const DashboardController = require('../controllers/Dashboard');
const { 
  authenticate, 
  requireEntity 
} = require('../middleware/auth');

// All routes require authentication
router.use(authenticate);
// Main dashboard endpoint
router.get('/', DashboardController.getDashboardStats);

// All routes require entity access (X-Entity header)
router.use(requireEntity);

// Individual endpoints for specific data
router.get('/inventory', DashboardController.getInventoryStats);
router.get('/invoices', DashboardController.getInvoiceStats);
router.get('/weekly-sales', DashboardController.getWeeklySales);
router.get('/top-selling', DashboardController.getTopSelling);
router.get('/recent-transactions', DashboardController.getRecentTransactions);
router.get('/monthly-revenue', DashboardController.getMonthlyRevenue);
router.get('/customers', DashboardController.getCustomerStats);
router.get('/inventory-by-type', DashboardController.getInventoryByType);
router.get('/low-stock', DashboardController.getLowStockCount);
router.get('/invoice-status', DashboardController.getInvoiceStatusBreakdown);

module.exports = router;