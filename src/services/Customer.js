// services/customerService.js
const Customer = require('../models/Customer');
const Invoice = require('../models/Invoice');
const { logActivity } = require('../utils/ActivityLogger');

class CustomerService {
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
          customerObj.total_spent = stats[0].total_spent || 0;
          customerObj.total_paid = stats[0].total_paid || 0;
          customerObj.total_balance = stats[0].total_balance || 0;
        } else {
          customerObj.total_invoices = 0;
          customerObj.total_spent = 0;
          customerObj.total_paid = 0;
          customerObj.total_balance = 0;
        }

        return customerObj;
      })
    );

    return {
      customers: customersWithStats,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
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
      customerObj.total_spent = stats[0].total_spent || 0;
      customerObj.total_paid = stats[0].total_paid || 0;
      customerObj.total_balance = stats[0].total_balance || 0;
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
      total: inv.total,
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
    return customer.toSafeObject();
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
      balance: 0,
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

    return customer.toSafeObject();
  }

}

module.exports = new CustomerService();