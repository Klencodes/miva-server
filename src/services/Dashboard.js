const Inventory = require('../models/Inventory');
const Invoice = require('../models/Invoice');
const { logActivity, ActivityActions } = require('../utils/ActivityLogger');

class DashboardService {
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
        query.created_at = dateQuery;
      }
    }
    return query;
  }

  /**
   * Get dashboard statistics for an entity or all entities with date range
   */
  async getDashboardStats(entityId, filters = {}, req = null) {
    try {
      const { date_from, date_to } = filters;

      const dateFilter = {};
      if (date_from) {
        const startDate = new Date(date_from);
        startDate.setHours(0, 0, 0, 0);
        dateFilter.$gte = startDate;
      }
      if (date_to) {
        const endDate = new Date(date_to);
        endDate.setHours(23, 59, 59, 999);
        dateFilter.$lte = endDate;
      }

      const [
        inventoryStats,
        invoiceStats,
        recentTransactions,
        weeklySales,
        topSelling,
        inventoryByType,
        lowStockCount,
        invoiceStatusBreakdown,
      ] = await Promise.all([
        this.getInventoryStats(entityId, dateFilter),
        this.getInvoiceStats(entityId, dateFilter),
        this.getRecentTransactions(entityId, 5, dateFilter),
        this.getWeeklySales(entityId, dateFilter),
        this.getTopSellingItems(entityId, 5, dateFilter),
        this.getInventoryByType(entityId),
        this.getLowStockCount(entityId),
        this.getInvoiceStatusBreakdown(entityId, dateFilter),
      ]);

      if (req) {
        await logActivity({
          user_id:  req.user?.uuid || req.user?._id || null,
          user_name: req.user?.name || 'system',
          user_role: req.user?.role || 'system',
          action: ActivityActions.DASHBOARD_VIEW,
          description: 'Dashboard viewed',
          metadata: {
            entity_id: entityId || 'ALL_ENTITIES',
            total_items: inventoryStats.total_items || 0,
            total_invoices: invoiceStats.total_invoices || 0,
            date_from: date_from || null,
            date_to: date_to || null,
          },
          req,
          status: 'success',
        });
      }

      return {
        inventory: inventoryStats,
        invoices: invoiceStats,
        recent_transactions: recentTransactions,
        weekly_sales: weeklySales,
        top_selling_items: topSelling,
        inventory_by_type: inventoryByType,
        low_stock_count: lowStockCount,
        invoice_status_breakdown: invoiceStatusBreakdown,
      };
    } catch (error) {
      console.error('Error getting dashboard stats:', error);
      throw error;
    }
  }

  /**
   * Get inventory statistics
   */
  async getInventoryStats(entityId = null, dateFilter = {}) {
    const matchQuery = this._entityMatch(entityId);

    const stats = await Inventory.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: null,
          total_items:    { $sum: 1 },
          total_quantity: { $sum: '$quantity' },
          total_value:    { $sum: { $multiply: ['$quantity', '$cost'] } },
          total_price:    { $sum: { $multiply: ['$quantity', '$price'] } },
          avg_cost:       { $avg: '$cost' },
          avg_price:      { $avg: '$price' },
        },
      },
    ]);

    return stats[0] || {
      total_items: 0,
      total_quantity: 0,
      total_value: 0,
      total_price: 0,
      avg_cost: 0,
      avg_price: 0,
    };
  }

  /**
   * Get invoice statistics
   */
  async getInvoiceStats(entityId = null, dateFilter = {}) {
    const matchQuery = this._entityMatch(entityId);
    this._applyDateFilters(matchQuery, dateFilter);

    const stats = await Invoice.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: null,
          total_invoices:  { $sum: 1 },
          total_amount:    { $sum: '$total' },
          total_paid:      { $sum: '$amount_paid' },
          total_remaining: { $sum: { $subtract: ['$total', '$amount_paid'] } },
        },
      },
    ]);

    return stats[0] || {
      total_invoices: 0,
      total_amount: 0,
      total_paid: 0,
      total_remaining: 0,
    };
  }

  /**
   * Get invoice status breakdown
   */
  async getInvoiceStatusBreakdown(entityId = null, dateFilter = {}) {
    const matchQuery = this._entityMatch(entityId);
    this._applyDateFilters(matchQuery, dateFilter);

    const breakdown = await Invoice.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id:    '$status',
          count:  { $sum: 1 },
          amount: { $sum: '$total' },
        },
      },
    ]);

    const result = {
      draft:           { count: 0, amount: 0 },
      quoted:          { count: 0, amount: 0 },
      invoiced:        { count: 0, amount: 0 },
      partially:       { count: 0, amount: 0 },
      paid:            { count: 0, amount: 0 },
      cancelled:       { count: 0, amount: 0 },
      overdue:         { count: 0, amount: 0 },
    };

    breakdown.forEach(item => {
      if (result[item._id] !== undefined) {
        result[item._id] = {
          count:  item.count,
          amount: item.amount || 0,
        };
      }
    });

    return result;
  }

  /**
   * Get recent transactions
   */
  async getRecentTransactions(entityId = null, limit = 10, dateFilter = {}) {
    const matchQuery = this._entityMatch(entityId);
    this._applyDateFilters(matchQuery, dateFilter);

    const invoices = await Invoice.find(matchQuery)
      .sort({ created_at: -1 })
      .limit(limit)
      .select('uuid number customer total status created_at');

    const transactions = invoices.map(inv => ({
      id:          inv.uuid,
      type:        'invoice',
      description: `Invoice ${inv.number} - ${inv.customer?.name || 'Unknown Customer'}`,
      amount:      inv.total,
      date:        inv.created_at,
      status:      inv.status,
      reference:   inv.number,
    }));

    const paymentQuery = {
      ...this._entityMatch(entityId),
      'payments.0': { $exists: true },
    };
    this._applyDateFilters(paymentQuery, dateFilter);

    const invoicesWithPayments = await Invoice.find(paymentQuery)
      .sort({ created_at: -1 })
      .limit(limit)
      .select('uuid number customer payments created_at');

    invoicesWithPayments.forEach(inv => {
      inv.payments?.forEach(payment => {
        const paymentDate = payment.date || inv.created_at;
        let include = true;
        if (dateFilter.$gte && new Date(paymentDate) < dateFilter.$gte) include = false;
        if (dateFilter.$lte && new Date(paymentDate) > dateFilter.$lte) include = false;

        if (include) {
          transactions.push({
            id:          payment.payment_id || `pay-${Date.now()}`,
            type:        'payment',
            description: `Payment for ${inv.number} - ${inv.customer?.name || 'Unknown Customer'}`,
            amount:      payment.amount,
            date:        paymentDate,
            status:      'completed',
            reference:   payment.reference || '',
          });
        }
      });
    });

    return transactions
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, limit);
  }

  /**
   * Get weekly sales data
   */
  async getWeeklySales(entityId = null, dateFilter = {}) {
    const matchQuery = {
      ...this._entityMatch(entityId),
      status: { $in: ['invoiced', 'partially', 'paid'] },
    };
    this._applyDateFilters(matchQuery, dateFilter);

    const sales = await Invoice.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: {
            day:  { $dayOfWeek: '$created_at' },
            week: { $week: '$created_at' },
            year: { $year: '$created_at' },
          },
          amount: { $sum: '$total' },
          count:  { $sum: 1 },
        },
      },
      { $sort: { '_id.year': 1, '_id.week': 1, '_id.day': 1 } },
    ]);

    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const result = [];

    let today = new Date();
    if (dateFilter.$lte) {
      today = new Date(dateFilter.$lte);
    }

    for (let i = 6; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dayName = dayNames[date.getDay()];
      const mongoDayOfWeek = date.getDay() + 1;

      const daySales = sales.find(s => s._id.day === mongoDayOfWeek);

      result.push({
        day:    dayName,
        amount: daySales?.amount || 0,
        count:  daySales?.count  || 0,
      });
    }

    return result;
  }

  /**
   * Get top selling items
   */
  async getTopSellingItems(entityId = null, limit = 5, dateFilter = {}) {
    const matchQuery = this._entityMatch(entityId);
    this._applyDateFilters(matchQuery, dateFilter);

    const items = await Invoice.aggregate([
      { $match: matchQuery },
      { $unwind: '$items' },
      {
        $group: {
          _id:      '$items.id',
          name:     { $first: '$items.name' },
          quantity: { $sum: '$items.quantity' },
          revenue:  { $sum: { $multiply: ['$items.quantity', '$items.price'] } },
        },
      },
      { $sort: { revenue: -1 } },
      { $limit: limit },
    ]);

    return items.map(item => ({
      id:       item._id,
      name:     item.name     || 'Unknown Item',
      quantity: item.quantity || 0,
      revenue:  item.revenue  || 0,
    }));
  }

  /**
   * Get inventory by type
   */
  async getInventoryByType(entityId = null) {
    const matchQuery = this._entityMatch(entityId);

    const types = await Inventory.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id:      '$type',
          count:    { $sum: 1 },
          quantity: { $sum: '$quantity' },
          value:    { $sum: { $multiply: ['$quantity', '$cost'] } },
        },
      },
    ]);

    return types.map(item => ({
      name:     item._id ? item._id.charAt(0).toUpperCase() + item._id.slice(1) : 'Unknown',
      count:    item.count    || 0,
      quantity: item.quantity || 0,
      value:    item.value    || 0,
    }));
  }

  /**
   * Get low stock items count
   */
  async getLowStockCount(entityId = null) {
    const matchQuery = this._entityMatch(entityId);

    const [low_stock, out_of_stock] = await Promise.all([
      Inventory.countDocuments({
        ...matchQuery,
        $expr: { $lte: ['$quantity', '$reorder_threshold'] },
        quantity: { $gt: 0 },
      }),
      Inventory.countDocuments({
        ...matchQuery,
        quantity: 0,
      }),
    ]);

    return {
      low_stock,
      out_of_stock,
      total: low_stock + out_of_stock,
    };
  }

  /**
   * Get monthly revenue trend
   */
  async getMonthlyRevenue(entityId = null, months = 12, dateFilter = {}) {
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - months);
    startDate.setHours(0, 0, 0, 0);

    const matchQuery = {
      ...this._entityMatch(entityId),
      created_at: { $gte: startDate },
      status: { $in: ['invoiced', 'partially', 'paid'] },
    };

    if (dateFilter.$gte) {
      matchQuery.created_at.$gte = new Date(
        Math.max(new Date(dateFilter.$gte).getTime(), startDate.getTime())
      );
    }
    if (dateFilter.$lte) {
      matchQuery.created_at.$lte = new Date(dateFilter.$lte);
    }

    const revenue = await Invoice.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: {
            year:  { $year: '$created_at' },
            month: { $month: '$created_at' },
          },
          amount: { $sum: '$total' },
          count:  { $sum: 1 },
        },
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } },
    ]);

    const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

    return revenue.map(item => ({
      month:  `${monthNames[item._id.month - 1]} ${item._id.year}`,
      amount: item.amount || 0,
      count:  item.count  || 0,
    }));
  }

  /**
   * Get customer statistics
   */
  async getCustomerStats(entityId = null, dateFilter = {}) {
    const matchQuery = this._entityMatch(entityId);
    this._applyDateFilters(matchQuery, dateFilter);

    const stats = await Invoice.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id:           '$customer.name',
          total_spent:   { $sum: '$total' },
          invoice_count: { $sum: 1 },
          last_invoice:  { $max: '$created_at' },
        },
      },
      { $sort: { total_spent: -1 } },
      { $limit: 10 },
    ]);

    return stats.map(item => ({
      name:          item._id || 'Unknown Customer',
      total_spent:   item.total_spent   || 0,
      invoice_count: item.invoice_count || 0,
      last_invoice:  item.last_invoice,
    }));
  }
}
module.exports = new DashboardService();