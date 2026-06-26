// services/customerService.js
const Customer = require('../models/Customer');
const Invoice = require('../models/Invoice');
const { logActivity } = require('../utils/activityLogger');

class CustomerService {
  /**
   * Format number to 2 decimal places
   */
  formatCurrency(value) {
    if (value === undefined || value === null || isNaN(value)) return 0;
    return Math.round(value * 100) / 100;
  }

  /**
   * Get all customers with pagination and filtering
   */
  async getCustomers(filters = {}, page = 1, limit = 10) {
    const skip = (page - 1) * limit;
    const query = {};

    // Apply filters
    if (filters.search) {
      query.$or = [
        { name: { $regex: filters.search, $options: 'i' } },
        { email: { $regex: filters.search, $options: 'i' } },
        { phone: { $regex: filters.search, $options: 'i' } },
        { tax_id: { $regex: filters.search, $options: 'i' } },
      ];
    }

    if (filters.email) {
      query.email = { $regex: filters.email, $options: 'i' };
    }

    if (filters.phone) {
      query.phone = { $regex: filters.phone, $options: 'i' };
    }

    if (filters.is_active !== undefined) {
      query.is_active = filters.is_active === 'true' || filters.is_active === true;
    }

    if (filters.min_balance !== undefined) {
      query.balance = { ...query.balance, $gte: parseFloat(filters.min_balance) };
    }

    if (filters.max_balance !== undefined) {
      query.balance = { ...query.balance, $lte: parseFloat(filters.max_balance) };
    }

    const [customers, total] = await Promise.all([
      Customer.find(query)
        .sort({ name: 1 })
        .skip(skip)
        .limit(limit),
      Customer.countDocuments(query),
    ]);

    // Get invoice stats for each customer
    const customersWithStats = await Promise.all(
      customers.map(async (customer) => {
        const customerObj = customer.toSafeObject();
        
        const stats = await Invoice.aggregate([
          {
            $match: {
              'customer.name': customer.name,
              status: { $in: ['invoiced', 'partially', 'paid'] },
            },
          },
          {
            $group: {
              _id: null,
              total_invoices: { $sum: 1 },
              total_spent: { $sum: '$total' },
              total_paid: { $sum: '$amount_paid' },
              total_balance: { $sum: { $subtract: ['$total', '$amount_paid'] } },
            },
          },
        ]);

        if (stats.length > 0) {
          customerObj.total_invoices = stats[0].total_invoices || 0;
          customerObj.total_spent = this.formatCurrency(stats[0].total_spent || 0);
          customerObj.total_paid = this.formatCurrency(stats[0].total_paid || 0);
          customerObj.total_balance = this.formatCurrency(stats[0].total_balance || 0);
        } else {
          customerObj.total_invoices = 0;
          customerObj.total_spent = 0;
          customerObj.total_paid = 0;
          customerObj.total_balance = 0;
        }

        // Format balance if it exists
        if (customerObj.balance !== undefined) {
          customerObj.balance = this.formatCurrency(customerObj.balance);
        }

        return customerObj;
      })
    );

    return {
      customers: customersWithStats,
      count: total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Get customer by UUID
   */
  async getCustomerByUuid(uuid) {
    const customer = await Customer.findOne({ uuid });
    if (!customer) {
      throw new Error('CUSTOMER_NOT_FOUND');
    }

    const customerObj = customer.toSafeObject();
    
    // Format balance
    if (customerObj.balance !== undefined) {
      customerObj.balance = this.formatCurrency(customerObj.balance);
    }
    
    // Get invoice stats
    const stats = await Invoice.aggregate([
      {
        $match: {
          'customer.name': customer.name,
          status: { $in: ['invoiced', 'partially', 'paid'] },
        },
      },
      {
        $group: {
          _id: null,
          total_invoices: { $sum: 1 },
          total_spent: { $sum: '$total' },
          total_paid: { $sum: '$amount_paid' },
          total_balance: { $sum: { $subtract: ['$total', '$amount_paid'] } },
        },
      },
    ]);

    if (stats.length > 0) {
      customerObj.total_invoices = stats[0].total_invoices || 0;
      customerObj.total_spent = this.formatCurrency(stats[0].total_spent || 0);
      customerObj.total_paid = this.formatCurrency(stats[0].total_paid || 0);
      customerObj.total_balance = this.formatCurrency(stats[0].total_balance || 0);
    } else {
      customerObj.total_invoices = 0;
      customerObj.total_spent = 0;
      customerObj.total_paid = 0;
      customerObj.total_balance = 0;
    }

    // Get customer's invoices
    const invoices = await Invoice.find({
      'customer.name': customer.name,
    })
      .sort({ created_at: -1 })
      .limit(10)
      .select('uuid number total status created_at');

    customerObj.recent_invoices = invoices.map(inv => ({
      uuid: inv.uuid,
      number: inv.number,
      total: this.formatCurrency(inv.total || 0),
      status: inv.status,
      created_at: inv.created_at,
    }));

    return customerObj;
  }

  /**
   * Get customer by email
   */
  async getCustomerByEmail(email) {
    const customer = await Customer.findOne({ 
      email: email.toLowerCase() 
    });
    if (!customer) {
      throw new Error('CUSTOMER_NOT_FOUND');
    }
    
    const customerObj = customer.toSafeObject();
    if (customerObj.balance !== undefined) {
      customerObj.balance = this.formatCurrency(customerObj.balance);
    }
    
    return customerObj;
  }

  /**
   * Create customer
   */
  async createCustomer(data, req) {
    const {
      name,
      email,
      phone,
      address,
      tax_id,
      notes,
      opening_balance = 0,
    } = data;

    if (!name) {
      throw new Error('NAME_REQUIRED');
    }

    if (email) {
      const existing = await Customer.findOne({ email: email.toLowerCase() });
      if (existing) {
        throw new Error('EMAIL_ALREADY_EXISTS');
      }
    }

    if (phone) {
      const existing = await Customer.findOne({ phone });
      if (existing) {
        throw new Error('PHONE_ALREADY_EXISTS');
      }
    }

    const customer = new Customer({
      name,
      email: email ? email.toLowerCase() : undefined,
      phone,
      address,
      tax_id,
      notes,
      is_active: true,
      balance: this.formatCurrency(opening_balance),
      created_by: req.user?.uuid || null,
      updated_by: req.user?.uuid || null,
    });

    await customer.save();

    await logActivity({
      user_id: req.user?.uuid || null,
      user_name: req.user?.name || 'system',
      user_role: req.user?.role || 'system',
      action: 'customer_created',
      description: `Customer created: ${customer.name}`,
      metadata: {
        customer_id: customer.uuid,
        customer_name: customer.name,
        email: customer.email,
        phone: customer.phone,
        created_by: req.user?.email || 'system',
      },
      req,
      status: 'success'
    });

    const customerObj = customer.toSafeObject();
    if (customerObj.balance !== undefined) {
      customerObj.balance = this.formatCurrency(customerObj.balance);
    }
    
    return customerObj;
  }

  /**
   * Update customer
   */
  async updateCustomer(uuid, data, req) {
    const customer = await Customer.findOne({ uuid });
    if (!customer) {
      throw new Error('CUSTOMER_NOT_FOUND');
    }

    const { name, email, phone, address, tax_id, notes, is_active, balance } = data;

    // Check email uniqueness if being updated
    if (email && email !== customer.email) {
      const existing = await Customer.findOne({ 
        email: email.toLowerCase(),
        uuid: { $ne: uuid }
      });
      if (existing) {
        throw new Error('EMAIL_ALREADY_EXISTS');
      }
      customer.email = email.toLowerCase();
    }

    // Check phone uniqueness if being updated
    if (phone && phone !== customer.phone) {
      const existing = await Customer.findOne({ 
        phone,
        uuid: { $ne: uuid }
      });
      if (existing) {
        throw new Error('PHONE_ALREADY_EXISTS');
      }
      customer.phone = phone;
    }

    if (name) customer.name = name;
    if (address) customer.address = address;
    if (tax_id !== undefined) customer.tax_id = tax_id;
    if (notes !== undefined) customer.notes = notes;
    if (is_active !== undefined) customer.is_active = is_active;
    if (balance !== undefined) customer.balance = this.formatCurrency(balance);
    
    customer.updated_by = req.user?.uuid || null;
    customer.updated_at = new Date();

    await customer.save();

    await logActivity({
      user_id: req.user?.uuid || null,
      user_name: req.user?.name || 'system',
      user_role: req.user?.role || 'system',
      action: 'customer_updated',
      description: `Customer updated: ${customer.name}`,
      metadata: {
        customer_id: customer.uuid,
        customer_name: customer.name,
        updated_fields: Object.keys(data),
        updated_by: req.user?.email || 'system',
      },
      req,
      status: 'success'
    });

    const customerObj = customer.toSafeObject();
    if (customerObj.balance !== undefined) {
      customerObj.balance = this.formatCurrency(customerObj.balance);
    }
    
    return customerObj;
  }

  /**
   * Toggle customer active status
   */
  async toggleCustomerActive(uuid, is_active, req) {
    const customer = await Customer.findOne({ uuid });
    if (!customer) {
      throw new Error('CUSTOMER_NOT_FOUND');
    }

    customer.is_active = is_active;
    customer.updated_by = req.user?.uuid || null;
    customer.updated_at = new Date();

    await customer.save();

    await logActivity({
      user_id: req.user?.uuid || null,
      user_name: req.user?.name || 'system',
      user_role: req.user?.role || 'system',
      action: 'customer_status_changed',
      description: `Customer ${is_active ? 'activated' : 'deactivated'}: ${customer.name}`,
      metadata: {
        customer_id: customer.uuid,
        customer_name: customer.name,
        is_active,
        updated_by: req.user?.email || 'system',
      },
      req,
      status: 'success'
    });

    const customerObj = customer.toSafeObject();
    if (customerObj.balance !== undefined) {
      customerObj.balance = this.formatCurrency(customerObj.balance);
    }
    
    return customerObj;
  }

  /**
   * Delete customer (soft delete if has invoices)
   */
  async deleteCustomer(uuid, req) {
    const customer = await Customer.findOne({ uuid });
    if (!customer) {
      throw new Error('CUSTOMER_NOT_FOUND');
    }

    // Check if customer has invoices
    const invoiceCount = await Invoice.countDocuments({
      'customer.name': customer.name
    });

    if (invoiceCount > 0) {
      // Soft delete - deactivate instead
      customer.is_active = false;
      customer.updated_by = req.user?.uuid || null;
      customer.updated_at = new Date();
      await customer.save();

      await logActivity({
        user_id: req.user?.uuid || null,
        user_name: req.user?.name || 'system',
        user_role: req.user?.role || 'system',
        action: 'customer_deactivated',
        description: `Customer deactivated (has invoices): ${customer.name}`,
        metadata: {
          customer_id: customer.uuid,
          customer_name: customer.name,
          invoice_count: invoiceCount,
          updated_by: req.user?.email || 'system',
        },
        req,
        status: 'success'
      });

      const customerObj = customer.toSafeObject();
      if (customerObj.balance !== undefined) {
        customerObj.balance = this.formatCurrency(customerObj.balance);
      }

      return {
        message: 'Customer deactivated successfully (has invoices)',
        soft_delete: true,
        customer: customerObj
      };
    }

    // Hard delete
    await Customer.deleteOne({ uuid });

    await logActivity({
      user_id: req.user?.uuid || null,
      user_name: req.user?.name || 'system',
      user_role: req.user?.role || 'system',
      action: 'customer_deleted',
      description: `Customer permanently deleted: ${customer.name}`,
      metadata: {
        customer_id: customer.uuid,
        customer_name: customer.name,
        deleted_by: req.user?.email || 'system',
      },
      req,
      status: 'success'
    });

    return {
      message: 'Customer permanently deleted',
      soft_delete: false
    };
  }

  /**
   * Get customer statistics
   */
  async getCustomerStats() {
    const total = await Customer.countDocuments();
    const active = await Customer.countDocuments({ is_active: true });
    const inactive = await Customer.countDocuments({ is_active: false });

    const stats = await Invoice.aggregate([
      {
        $match: {
          status: { $in: ['invoiced', 'partially', 'paid'] }
        }
      },
      {
        $group: {
          _id: null,
          total_customers_with_invoices: { $addToSet: '$customer.name' }
        }
      }
    ]);

    const customersWithInvoices = stats.length > 0 ? stats[0].total_customers_with_invoices.length : 0;

    return {
      total,
      active,
      inactive,
      customers_with_invoices: customersWithInvoices,
      customers_without_invoices: total - customersWithInvoices,
    };
  }

  /**
   * Search customers
   */
  async searchCustomers(query, limit = 10) {
    if (!query) {
      throw new Error('SEARCH_TERM_REQUIRED');
    }

    const customers = await Customer.find({
      $or: [
        { name: { $regex: query, $options: 'i' } },
        { email: { $regex: query, $options: 'i' } },
        { phone: { $regex: query, $options: 'i' } },
        { tax_id: { $regex: query, $options: 'i' } },
      ]
    })
    .limit(limit)
    .sort({ name: 1 });

    return customers.map(c => {
      const obj = c.toSafeObject();
      if (obj.balance !== undefined) {
        obj.balance = this.formatCurrency(obj.balance);
      }
      return obj;
    });
  }

  /**
   * Bulk create customers
   */
  async bulkCreateCustomers(customersData, req) {
    const results = {
      created: [],
      failed: [],
      total: customersData.length,
      success_count: 0,
      failure_count: 0
    };

    for (const data of customersData) {
      try {
        const customer = await this.createCustomer(data, req);
        results.created.push(customer);
        results.success_count++;
      } catch (error) {
        results.failed.push({
          data,
          error: error.message
        });
        results.failure_count++;
      }
    }

    return results;
  }
}

module.exports = new CustomerService();