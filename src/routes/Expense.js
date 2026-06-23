// src/routes/expenseRoutes.js

const express = require('express');
const router = express.Router();
const ExpenseController = require('../controllers/Expense');
const { authenticate, requireEntity } = require('../middleware/auth');

// All routes require authentication
router.use(authenticate);

// Get expense options (categories, statuses, payment methods)
router.get('/options', ExpenseController.getExpenseOptions);

// Get expense statistics
router.get('/stats', ExpenseController.getExpenseStats);

// Get expense category breakdown
router.get('/stats/categories', ExpenseController.getExpenseCategoryBreakdown);

// Get expense status breakdown
router.get('/stats/status', ExpenseController.getExpenseStatusBreakdown);

// Get expenses with filters
router.get('/', ExpenseController.getExpenses);

// All routes below require entity access (X-Entity header)
router.use(requireEntity);

// Get expense by UUID
router.get('/:uuid', ExpenseController.getExpenseByUuid);

// Create expense
router.post('/', ExpenseController.createExpense);

// Update expense
router.put('/:uuid', ExpenseController.updateExpense);

// Mark expense as paid (pending -> paid only)
router.patch('/:uuid/pay', ExpenseController.markExpenseAsPaid);

// Delete expense (only pending can be deleted)
router.delete('/:uuid', ExpenseController.deleteExpense);

module.exports = router;