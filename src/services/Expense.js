// src/services/ExpenseService.js

const Expense = require('../models/Expense');
const { logActivity, ActivityActions } = require('../utils/ActivityLogger');

class ExpenseService {
  /**
   * Format number to 2 decimal places
   */
  formatCurrency(value) {
    if (value === undefined || value === null || isNaN(value)) return 0;
    return Math.round(value * 100) / 100;
  }

  /**
   * Build a MongoDB entity match object from an entityId string.
   * Returns {} when entityId is null (= all entities).
   */
  _entityMatch(entityId) {
    return entityId ? { entity_id: entityId } : {};
  }

  /**
   * Apply date filters to a query
   */
  _applyDateFilters(query, dateFilter) {
    if (Object.keys(dateFilter).length > 0) {
      const dateQuery = {};
      if (dateFilter.$gte) dateQuery.$gte = dateFilter.$gte;
      if (dateFilter.$lte) dateQuery.$lte = dateFilter.$lte;
      
      if (Object.keys(dateQuery).length > 0) {
        query.date = dateQuery;
      }
    }
    return query;
  }

  /**
   * Generate UUID
   */
  _generateUUID() {
    const prefix = 'EXP';
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `${prefix}-${timestamp}-${random}`;
  }

  /**
   * Create a new expense
   */
  async createExpense(data, user, req = null) {
    try {
      const expense = new Expense({
        uuid: this._generateUUID(),
        entity_id: data.entity_id || user?.primary_entity_id,
        title: data.title,
        description: data.description,
        amount: this.formatCurrency(data.amount),
        category: data.category,
        sub_category: data.sub_category,
        date: data.date || new Date(),
        payment_method: data.payment_method || 'cash',
        status: 'pending',
        vendor: data.vendor,
        vendor_contact: data.vendor_contact,
        receipt_url: data.receipt_url,
        receipt_public_id: data.receipt_public_id,
        created_by: user?.uuid || user?._id || 'system',
        created_by_name: user?.name || 'System',
        metadata: data.metadata || {},
      });

      await expense.save();

      if (req) {
        await logActivity({
          user_id: user?.uuid || user?._id || null,
          user_name: user?.name || 'system',
          user_role: user?.role || 'system',
          action: ActivityActions.EXPENSE_CREATE,
          description: `Expense created: ${expense.title}`,
          metadata: {
            expense_id: expense.uuid,
            amount: expense.amount,
            category: expense.category,
            entity_id: expense.entity_id,
          },
          req,
          status: 'success',
        });
      }

      const expenseObj = expense.toObject ? expense.toObject() : expense;
      expenseObj.amount = this.formatCurrency(expenseObj.amount);
      return expenseObj;
    } catch (error) {
      console.error('Error creating expense:', error);
      throw error;
    }
  }

  /**
   * Get expense by UUID
   */
  async getExpenseByUuid(uuid, entityId = null) {
    try {
      const query = { uuid };
      if (entityId) {
        query.entity_id = entityId;
      }

      const expense = await Expense.findOne(query);

      if (!expense) {
        throw new Error('EXPENSE_NOT_FOUND');
      }

      const expenseObj = expense.toObject ? expense.toObject() : expense;
      expenseObj.amount = this.formatCurrency(expenseObj.amount);
      return expenseObj;
    } catch (error) {
      console.error('Error getting expense:', error);
      throw error;
    }
  }

  /**
   * Get expenses with filters
   */
  async getExpenses(filters = {}, pagination = {}) {
    try {
      const { page = 1, limit = 10, sort_by = 'created_at', sort_order = 'desc' } = pagination;
      const { entity_id, search, category, status, payment_method, vendor, start_date, end_date } = filters;

      const query = {};

      // Entity filter
      if (entity_id) {
        query.entity_id = entity_id;
      }

      // Search filter
      if (search) {
        query.$or = [
          { title: { $regex: search, $options: 'i' } },
          { description: { $regex: search, $options: 'i' } },
          { vendor: { $regex: search, $options: 'i' } },
        ];
      }

      // Category filter
      if (category) {
        query.category = category;
      }

      // Status filter - only allow pending or paid
      if (status) {
        const validStatuses = ['pending', 'paid'];
        if (validStatuses.includes(status)) {
          query.status = status;
        }
      } else {
        query.status = { $in: ['pending', 'paid'] };
      }

      // Payment method filter
      if (payment_method) {
        query.payment_method = payment_method;
      }

      // Vendor filter
      if (vendor) {
        query.vendor = { $regex: vendor, $options: 'i' };
      }

      // Date range filter
      const dateFilter = {};
      if (start_date) {
        const start = new Date(start_date);
        start.setHours(0, 0, 0, 0);
        dateFilter.$gte = start;
      }
      if (end_date) {
        const end = new Date(end_date);
        end.setHours(23, 59, 59, 999);
        dateFilter.$lte = end;
      }
      if (Object.keys(dateFilter).length > 0) {
        query.date = dateFilter;
      }

      const skip = (page - 1) * limit;
      const sortOptions = {};
      sortOptions[sort_by] = sort_order === 'desc' ? -1 : 1;

      const [expenses, total] = await Promise.all([
        Expense.find(query)
          .sort(sortOptions)
          .skip(skip)
          .limit(limit)
          .lean(),
        Expense.countDocuments(query),
      ]);

      // Format currency values in expenses
      const formattedExpenses = expenses.map(exp => ({
        ...exp,
        amount: this.formatCurrency(exp.amount || 0),
      }));

      return {
        expenses: formattedExpenses,
        count: total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      };
    } catch (error) {
      console.error('Error getting expenses:', error);
      throw error;
    }
  }

  /**
   * Update expense
   */
  async updateExpense(uuid, data, user, req = null) {
    try {
      const expense = await Expense.findOne({ uuid });

      if (!expense) {
        throw new Error('EXPENSE_NOT_FOUND');
      }

      // Check if expense can be edited (only pending expenses can be edited)
      if (expense.status !== 'pending') {
        throw new Error('EXPENSE_NOT_EDITABLE');
      }

      const updatedFields = {};

      if (data.title) updatedFields.title = data.title;
      if (data.description !== undefined) updatedFields.description = data.description;
      if (data.amount !== undefined) updatedFields.amount = this.formatCurrency(data.amount);
      if (data.category) updatedFields.category = data.category;
      if (data.sub_category !== undefined) updatedFields.sub_category = data.sub_category;
      if (data.date) updatedFields.date = data.date;
      if (data.payment_method) updatedFields.payment_method = data.payment_method;
      if (data.vendor !== undefined) updatedFields.vendor = data.vendor;
      if (data.vendor_contact !== undefined) updatedFields.vendor_contact = data.vendor_contact;
      if (data.receipt_url) updatedFields.receipt_url = data.receipt_url;
      if (data.receipt_public_id) updatedFields.receipt_public_id = data.receipt_public_id;
      if (data.metadata) updatedFields.metadata = data.metadata;

      // Handle status transitions - only pending -> paid
      if (data.status && data.status !== expense.status) {
        if (expense.status === 'pending' && data.status === 'paid') {
          updatedFields.status = 'paid';
          updatedFields.paid_by = user?.uuid || user?._id || 'system';
          updatedFields.paid_by_name = user?.name || 'System';
          updatedFields.paid_at = new Date();
        } else {
          throw new Error('INVALID_STATUS_TRANSITION');
        }
      }

      const updatedExpense = await Expense.findOneAndUpdate(
        { uuid },
        { $set: updatedFields },
        { new: true, runValidators: true }
      );

      if (req) {
        await logActivity({
          user_id: user?.uuid || user?._id || null,
          user_name: user?.name || 'system',
          user_role: user?.role || 'system',
          action: ActivityActions.EXPENSE_UPDATE,
          description: `Expense updated: ${updatedExpense.title}`,
          metadata: {
            expense_id: updatedExpense.uuid,
            status: updatedExpense.status,
            entity_id: updatedExpense.entity_id,
          },
          req,
          status: 'success',
        });
      }

      const expenseObj = updatedExpense.toObject ? updatedExpense.toObject() : updatedExpense;
      expenseObj.amount = this.formatCurrency(expenseObj.amount);
      return expenseObj;
    } catch (error) {
      console.error('Error updating expense:', error);
      throw error;
    }
  }

  /**
   * Mark expense as paid (directly from pending to paid)
   */
  async markExpenseAsPaid(uuid, user, req = null) {
    try {
      const expense = await Expense.findOne({ uuid });

      if (!expense) {
        throw new Error('EXPENSE_NOT_FOUND');
      }

      // Only pending expenses can be marked as paid
      if (expense.status !== 'pending') {
        throw new Error('EXPENSE_NOT_PAYABLE');
      }

      const updatedExpense = await Expense.findOneAndUpdate(
        { uuid },
        {
          $set: {
            status: 'paid',
            paid_by: user?.uuid || user?._id || 'system',
            paid_by_name: user?.name || 'System',
            paid_at: new Date(),
          },
        },
        { new: true, runValidators: true }
      );

      if (req) {
        await logActivity({
          user_id: user?.uuid || user?._id || null,
          user_name: user?.name || 'system',
          user_role: user?.role || 'system',
          action: ActivityActions.EXPENSE_PAY,
          description: `Expense marked as paid: ${updatedExpense.title}`,
          metadata: {
            expense_id: updatedExpense.uuid,
            amount: updatedExpense.amount,
            entity_id: updatedExpense.entity_id,
          },
          req,
          status: 'success',
        });
      }

      const expenseObj = updatedExpense.toObject ? updatedExpense.toObject() : updatedExpense;
      expenseObj.amount = this.formatCurrency(expenseObj.amount);
      return expenseObj;
    } catch (error) {
      console.error('Error marking expense as paid:', error);
      throw error;
    }
  }

  /**
   * Delete expense
   */
  async deleteExpense(uuid, user, req = null) {
    try {
      const expense = await Expense.findOne({ uuid });

      if (!expense) {
        throw new Error('EXPENSE_NOT_FOUND');
      }

      // Only allow deletion of pending expenses
      if (expense.status !== 'pending') {
        throw new Error('EXPENSE_NOT_DELETABLE');
      }

      await expense.deleteOne();

      if (req) {
        await logActivity({
          user_id: user?.uuid || user?._id || null,
          user_name: user?.name || 'system',
          user_role: user?.role || 'system',
          action: ActivityActions.EXPENSE_DELETE,
          description: `Expense deleted: ${expense.title}`,
          metadata: {
            expense_id: expense.uuid,
            amount: expense.amount,
            entity_id: expense.entity_id,
          },
          req,
          status: 'success',
        });
      }

      return { success: true, message: 'Expense deleted successfully' };
    } catch (error) {
      console.error('Error deleting expense:', error);
      throw error;
    }
  }

  /**
   * Get expense statistics
   */
  async getExpenseStats(entityId = null, dateFilter = {}) {
    try {
      const matchQuery = this._entityMatch(entityId);
      this._applyDateFilters(matchQuery, dateFilter);

      const stats = await Expense.aggregate([
        { $match: matchQuery },
        {
          $group: {
            _id: null,
            total_expenses: { $sum: '$amount' },
            count: { $sum: 1 },
            avg_amount: { $avg: '$amount' },
            max_amount: { $max: '$amount' },
            min_amount: { $min: '$amount' },
          },
        },
      ]);

      const result = stats[0] || {
        total_expenses: 0,
        count: 0,
        avg_amount: 0,
        max_amount: 0,
        min_amount: 0,
      };

      return {
        total_expenses: this.formatCurrency(result.total_expenses || 0),
        count: result.count || 0,
        avg_amount: this.formatCurrency(result.avg_amount || 0),
        max_amount: this.formatCurrency(result.max_amount || 0),
        min_amount: this.formatCurrency(result.min_amount || 0),
      };
    } catch (error) {
      console.error('Error getting expense stats:', error);
      throw error;
    }
  }

  /**
   * Get expense categories breakdown
   */
  async getExpenseCategoryBreakdown(entityId = null, dateFilter = {}) {
    try {
      const matchQuery = this._entityMatch(entityId);
      this._applyDateFilters(matchQuery, dateFilter);

      const breakdown = await Expense.aggregate([
        { $match: matchQuery },
        {
          $group: {
            _id: '$category',
            count: { $sum: 1 },
            amount: { $sum: '$amount' },
          },
        },
        { $sort: { amount: -1 } },
      ]);

      return breakdown.map(item => ({
        category: item._id || 'Unknown',
        count: item.count || 0,
        amount: this.formatCurrency(item.amount || 0),
      }));
    } catch (error) {
      console.error('Error getting expense category breakdown:', error);
      throw error;
    }
  }

  /**
   * Get expense status breakdown (only pending and paid)
   */
  async getExpenseStatusBreakdown(entityId = null, dateFilter = {}) {
    try {
      const matchQuery = this._entityMatch(entityId);
      this._applyDateFilters(matchQuery, dateFilter);

      const breakdown = await Expense.aggregate([
        { $match: matchQuery },
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 },
            amount: { $sum: '$amount' },
          },
        },
      ]);

      const statusMap = {
        pending: { status: 'pending', count: 0, amount: 0 },
        paid: { status: 'paid', count: 0, amount: 0 },
      };

      breakdown.forEach(item => {
        if (statusMap[item._id]) {
          statusMap[item._id].count = item.count || 0;
          statusMap[item._id].amount = this.formatCurrency(item.amount || 0);
        }
      });

      return Object.values(statusMap);
    } catch (error) {
      console.error('Error getting expense status breakdown:', error);
      throw error;
    }
  }

  /**
   * Get expense options
   */
  async getExpenseOptions() {
    try {
      const categories = Expense.getCategories ? Expense.getCategories() : [
        'Office Supplies',
        'Utilities',
        'Rent',
        'Salaries',
        'Marketing',
        'Transport',
        'Equipment',
        'Food & Drinks',
        'Software',
        'Maintenance',
        'Insurance',
        'Travel',
        'Training',
        'Other',
      ];

      const statuses = ['pending', 'paid'];
      const paymentMethods = ['cash', 'bank', 'mobile_money', 'credit_card'];

      return {
        categories,
        statuses,
        payment_methods: paymentMethods,
      };
    } catch (error) {
      console.error('Error getting expense options:', error);
      throw error;
    }
  }
}

module.exports = new ExpenseService();