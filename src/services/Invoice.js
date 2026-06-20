// services/invoiceService.js
const Invoice = require('../models/Invoice');
const Payment = require('../models/Payment');
const { logActivity } = require('../utils/ActivityLogger');

class InvoiceService {
  /**
   * Generate invoice number
   */
  generateInvoiceNumber(entityId) {
    const prefix = 'INV';
    const timestamp = new Date().getTime().toString().slice(-8);
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    return `${prefix}-${entityId.slice(0, 6)}-${timestamp}-${random}`;
  }

  /**
   * Get all invoices with pagination and filtering
   */
  async getInvoices(entityId, filters = {}, page = 1, limit = 10) {
    const skip = (page - 1) * limit;
    const query = { entity_id: entityId };

    // Apply filters
    if (filters.search) {
      query.$or = [
        { number: { $regex: filters.search, $options: 'i' } },
        { 'customer.name': { $regex: filters.search, $options: 'i' } },
        { 'customer.email': { $regex: filters.search, $options: 'i' } },
        { 'customer.phone': { $regex: filters.search, $options: 'i' } },
      ];
    }

    if (filters.status) {
      query.status = filters.status;
    }

    if (filters.date_from) {
      query.date = { ...query.date, $gte: new Date(filters.date_from) };
    }

    if (filters.date_to) {
      query.date = { ...query.date, $lte: new Date(filters.date_to) };
    }

    if (filters.customer) {
      query['customer.name'] = { $regex: filters.customer, $options: 'i' };
    }

    if (filters.min_total) {
      query.total = { ...query.total, $gte: parseFloat(filters.min_total) };
    }

    if (filters.max_total) {
      query.total = { ...query.total, $lte: parseFloat(filters.max_total) };
    }

    const [invoices, total] = await Promise.all([
      Invoice.find(query)
        .sort({ date: -1 })
        .skip(skip)
        .limit(limit),
      Invoice.countDocuments(query),
    ]);

    return {
      invoices: invoices.map(i => i.toSafeObject()),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get invoice by UUID
   */
  async getInvoiceByUuid(entityId, uuid) {
    const invoice = await Invoice.findOne({ entity_id: entityId, uuid });
    if (!invoice) {
      throw new Error('INVOICE_NOT_FOUND');
    }
    return invoice.toSafeObject();
  }

  /**
   * Get invoice by number
   */
  async getInvoiceByNumber(entityId, number) {
    const invoice = await Invoice.findOne({ entity_id: entityId, number });
    if (!invoice) {
      throw new Error('INVOICE_NOT_FOUND');
    }
    return invoice.toSafeObject();
  }

  /**
   * Create invoice
   */
  async createInvoice(entityId, data, req) {
    const {
      date,
      due_date,
      customer,
      items,
      discount_type = 'percentage',
      discount_rate = 0,
      vat_rate = 0,
      notes,
      terms,
      currency = 'GHS',
      status = 'draft',
    } = data;

    // Validate required fields
    if (!customer || !customer.name) {
      throw new Error('CUSTOMER_NAME_REQUIRED');
    }

    if (!items || items.length === 0) {
      throw new Error('ITEMS_REQUIRED');
    }

    // Validate items
    for (const item of items) {
      if (!item.name || !item.price || !item.quantity) {
        throw new Error('INVALID_ITEM_DATA');
      }
    }

    // Generate invoice number
    const number = this.generateInvoiceNumber(entityId);

    // Create invoice
    const invoice = new Invoice({
      entity_id: entityId,
      number,
      date: date || new Date(),
      due_date,
      customer,
      items,
      discount_type,
      discount_rate,
      vat_rate,
      notes,
      terms,
      currency,
      status,
      created_by: req.user?.uuid || null,
      updated_by: req.user?.uuid || null,
    });

    // Calculate totals (triggered by pre-save hook)
    await invoice.save();

    // Log activity
    await logActivity({
      user_id: req.user?._id || null,
      user_name: req.user?.name || 'system',
      user_role: req.user?.role || 'system',
      action: 'invoice_created',
      description: `Invoice created: ${invoice.number}`,
      metadata: {
        invoice_id: invoice.uuid,
        invoice_number: invoice.number,
        total: invoice.total,
        customer: customer.name,
        created_by: req.user?.email || 'system',
      },
      req,
      status: 'success'
    });

    return invoice.toSafeObject();
  }

  /**
   * Update invoice
   */
  async updateInvoice(entityId, uuid, data, req) {
    const invoice = await Invoice.findOne({ entity_id: entityId, uuid });
    if (!invoice) {
      throw new Error('INVOICE_NOT_FOUND');
    }

    // Prevent editing paid or cancelled invoices
    if (invoice.status === 'paid' || invoice.status === 'cancelled') {
      throw new Error('INVOICE_CANNOT_BE_MODIFIED');
    }

    const {
      date,
      due_date,
      customer,
      items,
      discount_type,
      discount_rate,
      vat_rate,
      notes,
      terms,
      currency,
      status,
    } = data;

    // Update fields
    if (date) invoice.date = date;
    if (due_date) invoice.due_date = due_date;
    if (customer) invoice.customer = { ...invoice.customer, ...customer };
    if (items) invoice.items = items;
    if (discount_type) invoice.discount_type = discount_type;
    if (discount_rate !== undefined) invoice.discount_rate = discount_rate;
    if (vat_rate !== undefined) invoice.vat_rate = vat_rate;
    if (notes !== undefined) invoice.notes = notes;
    if (terms !== undefined) invoice.terms = terms;
    if (currency) invoice.currency = currency;
    if (status && status !== 'paid' && status !== 'cancelled') {
      invoice.status = status;
    }

    invoice.updated_by = req.user?.uuid || null;

    // Save will trigger pre-save hook for recalculation
    await invoice.save();

    // Log activity
    await logActivity({
      user_id: req.user?._id || null,
      user_name: req.user?.name || 'system',
      user_role: req.user?.role || 'system',
      action: 'invoice_updated',
      description: `Invoice updated: ${invoice.number}`,
      metadata: {
        invoice_id: invoice.uuid,
        invoice_number: invoice.number,
        updated_by: req.user?.email || 'system',
        updated_fields: Object.keys(data),
      },
      req,
      status: 'success'
    });

    return invoice.toSafeObject();
  }

  /**
   * Add payment to invoice
   */
  async addPayment(entityId, uuid, paymentData, req) {
    const invoice = await Invoice.findOne({ entity_id: entityId, uuid });
    if (!invoice) {
      throw new Error('INVOICE_NOT_FOUND');
    }

    if (invoice.status === 'cancelled') {
      throw new Error('INVOICE_CANCELLED');
    }

    if (invoice.status === 'paid') {
      throw new Error('INVOICE_ALREADY_PAID');
    }

    const { amount, method, reference, bank_branch, date, notes } = paymentData;

    if (!amount || amount <= 0) {
      throw new Error('INVALID_PAYMENT_AMOUNT');
    }

    if (amount > invoice.remaining_balance) {
      throw new Error('PAYMENT_EXCEEDS_BALANCE');
    }

    // Create payment record
    const payment = new Payment({
      entity_id: entityId,
      invoice_id: invoice.uuid,
      amount,
      method,
      reference,
      bank_branch,
      date: date || new Date(),
      notes,
      created_by: req.user?.uuid || null,
      updated_by: req.user?.uuid || null,
    });

    await payment.save();

    // Add payment to invoice
    invoice.addPayment({
      payment_id: payment.uuid,
      amount,
      method,
      reference,
      bank_branch,
      date: date || new Date(),
      notes,
    });

    invoice.updated_by = req.user?.uuid || null;
    await invoice.save();

    // Log activity
    await logActivity({
      user_id: req.user?._id || null,
      user_name: req.user?.name || 'system',
      user_role: req.user?.role || 'system',
      action: 'invoice_payment_added',
      description: `Payment added to invoice: ${invoice.number}`,
      metadata: {
        invoice_id: invoice.uuid,
        invoice_number: invoice.number,
        amount,
        method,
        remaining_balance: invoice.remaining_balance,
        updated_by: req.user?.email || 'system',
      },
      req,
      status: 'success'
    });

    return {
      invoice: invoice.toSafeObject(),
      payment: payment.toSafeObject(),
    };
  }

  /**
   * Mark invoice as paid
   */
  async markAsPaid(entityId, uuid, req) {
    const invoice = await Invoice.findOne({ entity_id: entityId, uuid });
    if (!invoice) {
      throw new Error('INVOICE_NOT_FOUND');
    }

    if (invoice.status === 'cancelled') {
      throw new Error('INVOICE_CANCELLED');
    }

    if (invoice.status === 'paid') {
      throw new Error('INVOICE_ALREADY_PAID');
    }

    // Create payment record for full amount
    const payment = new Payment({
      entity_id: entityId,
      invoice_id: invoice.uuid,
      amount: invoice.remaining_balance,
      method: 'Credit',
      reference: `PAID-${invoice.number}`,
      date: new Date(),
      notes: 'Full payment via mark as paid',
      created_by: req.user?.uuid || null,
      updated_by: req.user?.uuid || null,
    });

    await payment.save();

    // Mark invoice as paid
    invoice.markAsPaid();
    invoice.updated_by = req.user?.uuid || null;
    await invoice.save();

    // Log activity
    await logActivity({
      user_id: req.user?._id || null,
      user_name: req.user?.name || 'system',
      user_role: req.user?.role || 'system',
      action: 'invoice_marked_paid',
      description: `Invoice marked as paid: ${invoice.number}`,
      metadata: {
        invoice_id: invoice.uuid,
        invoice_number: invoice.number,
        amount: invoice.total,
        updated_by: req.user?.email || 'system',
      },
      req,
      status: 'success'
    });

    return invoice.toSafeObject();
  }

  /**
   * Cancel invoice
   */
  async cancelInvoice(entityId, uuid, req) {
    const invoice = await Invoice.findOne({ entity_id: entityId, uuid });
    if (!invoice) {
      throw new Error('INVOICE_NOT_FOUND');
    }

    if (invoice.status === 'cancelled') {
      throw new Error('INVOICE_ALREADY_CANCELLED');
    }

    if (invoice.status === 'paid') {
      throw new Error('PAID_INVOICE_CANNOT_BE_CANCELLED');
    }

    invoice.cancel();
    invoice.updated_by = req.user?.uuid || null;
    await invoice.save();

    // Log activity
    await logActivity({
      user_id: req.user?._id || null,
      user_name: req.user?.name || 'system',
      user_role: req.user?.role || 'system',
      action: 'invoice_cancelled',
      description: `Invoice cancelled: ${invoice.number}`,
      metadata: {
        invoice_id: invoice.uuid,
        invoice_number: invoice.number,
        updated_by: req.user?.email || 'system',
      },
      req,
      status: 'success'
    });

    return invoice.toSafeObject();
  }

  /**
   * Delete invoice (only if draft or cancelled)
   */
  async deleteInvoice(entityId, uuid, req) {
    const invoice = await Invoice.findOne({ entity_id: entityId, uuid });
    if (!invoice) {
      throw new Error('INVOICE_NOT_FOUND');
    }

    if (invoice.status !== 'draft' && invoice.status !== 'cancelled') {
      throw new Error('INVOICE_CANNOT_BE_DELETED');
    }

    // Delete associated payments
    await Payment.deleteMany({ invoice_id: invoice.uuid });

    await invoice.deleteOne();

    // Log activity
    await logActivity({
      user_id: req.user?._id || null,
      user_name: req.user?.name || 'system',
      user_role: req.user?.role || 'system',
      action: 'invoice_deleted',
      description: `Invoice deleted: ${invoice.number}`,
      metadata: {
        invoice_id: invoice.uuid,
        invoice_number: invoice.number,
        deleted_by: req.user?.email || 'system',
      },
      req,
      status: 'success'
    });

    return { message: 'Invoice deleted successfully' };
  }

  /**
   * Get invoice statistics
   */
  async getInvoiceStats(entityId) {
    const stats = await Invoice.aggregate([
      { $match: { entity_id: entityId } },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          total_amount: { $sum: '$total' },
          total_paid: { $sum: '$amount_paid' },
        },
      },
    ]);

    const totals = await Invoice.aggregate([
      { $match: { entity_id: entityId } },
      {
        $group: {
          _id: null,
          total_invoices: { $sum: 1 },
          total_amount: { $sum: '$total' },
          total_paid: { $sum: '$amount_paid' },
          total_remaining: { $sum: '$remaining_balance' },
        },
      },
    ]);

    const result = {
      by_status: stats.map(s => ({
        status: s._id,
        count: s.count,
        total_amount: s.total_amount,
        total_paid: s.total_paid,
      })),
      totals: totals[0] || {
        total_invoices: 0,
        total_amount: 0,
        total_paid: 0,
        total_remaining: 0,
      },
    };

    return result;
  }
}

module.exports = new InvoiceService();