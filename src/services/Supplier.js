const Supplier = require('../models/Supplier');
const { logActivity } = require('../utils/ActivityLogger');

class SupplierService {
  /**
   * Get all suppliers with pagination and filtering
   */
  async getSuppliers(filters = {}, page = 1, limit = 10) {
    const skip = (page - 1) * limit;
    const query = {};

    if (filters.search) {
      query.$or = [
        { name: { $regex: filters.search, $options: 'i' } },
        { email: { $regex: filters.search, $options: 'i' } },
        { phone_number: { $regex: filters.search, $options: 'i' } },
        { address: { $regex: filters.search, $options: 'i' } },
        { tax_id: { $regex: filters.search, $options: 'i' } },
        { registration_number: { $regex: filters.search, $options: 'i' } },
      ];
    }

    if (filters.status) {
      query.status = filters.status;
    }

    if (filters.city) {
      query.city = { $regex: filters.city, $options: 'i' };
    }

    if (filters.country) {
      query.country = filters.country;
    }

    const sort = {};
    if (filters.sort_by) {
      const sortOrder = filters.sort_order === 'desc' ? -1 : 1;
      sort[filters.sort_by] = sortOrder;
    } else {
      sort.created_at = -1;
    }

    const [items, total] = await Promise.all([
      Supplier.find(query)
        .sort(sort)
        .skip(skip)
        .limit(limit),
      Supplier.countDocuments(query),
    ]);

    return {
      suppliers: items.map(i => i.toSafeObject()),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get supplier by UUID
   */
  async getSupplierByUuid(uuid) {
    const supplier = await Supplier.findOne({ uuid });
    if (!supplier) {
      throw new Error('SUPPLIER_NOT_FOUND');
    }
    return supplier.toSafeObject();
  }

  /**
   * Get supplier by email
   */
  async getSupplierByEmail(email) {
    const supplier = await Supplier.findOne({ 
      email: email.toLowerCase() 
    });
    return supplier ? supplier.toSafeObject() : null;
  }

  /**
   * Create a new supplier
   */
  async createSupplier(data, req) {
    const {
      name,
      email,
      phone_code,
      phone_number,
      secondary_code,
      secondary_number,
      address,
      city,
      state,
      country,
      zip_code,
      website,
      tax_id,
      registration_number,
      notes,
      status = 'active',
      metadata = {},
    } = data;

    if (!name) throw new Error('NAME_REQUIRED');
    if (!email) throw new Error('EMAIL_REQUIRED');
    if (!phone_number) throw new Error('PHONE_NUMBER_REQUIRED');
    if (!address) throw new Error('ADDRESS_REQUIRED');

    const existingEmail = await Supplier.findOne({ 
      email: email.toLowerCase() 
    });
    if (existingEmail) {
      throw new Error('EMAIL_ALREADY_EXISTS');
    }

    if (tax_id) {
      const existingTax = await Supplier.findOne({ 
        tax_id: tax_id 
      });
      if (existingTax) {
        throw new Error('TAX_ID_ALREADY_EXISTS');
      }
    }

    if (registration_number) {
      const existingReg = await Supplier.findOne({ 
        registration_number: registration_number 
      });
      if (existingReg) {
        throw new Error('REGISTRATION_NUMBER_ALREADY_EXISTS');
      }
    }

    const supplier = new Supplier({
      name,
      email: email.toLowerCase(),
      phone_code: phone_code || '+233',
      phone_number,
      secondary_code: secondary_code || '+233',
      secondary_number: secondary_number || '',
      address,
      city: city || '',
      state: state || '',
      country: country || 'Ghana',
      zip_code: zip_code || '',
      website: website || '',
      tax_id: tax_id || '',
      registration_number: registration_number || '',
      notes: notes || '',
      status,
      metadata: metadata || {},
      created_by: req.user?.uuid || null,
      updated_by: req.user?.uuid || null,
    });

    await supplier.save();

    await logActivity({
      user_id: req.user?._id || null,
      user_name: req.user?.name || 'system',
      user_role: req.user?.role || 'system',
      action: 'supplier_created',
      description: `Supplier created: ${supplier.name}`,
      metadata: {
        supplier_id: supplier.uuid,
        supplier_name: supplier.name,
        email: supplier.email,
        created_by: req.user?.email || 'system',
      },
      req,
      status: 'success',
    });

    return supplier.toSafeObject();
  }

  /**
   * Update a supplier
   */
  async updateSupplier(uuid, data, req) {
    const supplier = await Supplier.findOne({ uuid });
    if (!supplier) {
      throw new Error('SUPPLIER_NOT_FOUND');
    }

    const {
      name,
      email,
      phone_code,
      phone_number,
      secondary_code,
      secondary_number,
      address,
      city,
      state,
      country,
      zip_code,
      website,
      tax_id,
      registration_number,
      notes,
      status,
      metadata,
    } = data;

    if (email && email.toLowerCase() !== supplier.email) {
      const existingEmail = await Supplier.findOne({ 
        email: email.toLowerCase(),
        uuid: { $ne: uuid }
      });
      if (existingEmail) {
        throw new Error('EMAIL_ALREADY_EXISTS');
      }
      supplier.email = email.toLowerCase();
    }

    if (tax_id && tax_id !== supplier.tax_id) {
      const existingTax = await Supplier.findOne({ 
        tax_id: tax_id,
        uuid: { $ne: uuid }
      });
      if (existingTax) {
        throw new Error('TAX_ID_ALREADY_EXISTS');
      }
      supplier.tax_id = tax_id;
    }

    if (registration_number && registration_number !== supplier.registration_number) {
      const existingReg = await Supplier.findOne({ 
        registration_number: registration_number,
        uuid: { $ne: uuid }
      });
      if (existingReg) {
        throw new Error('REGISTRATION_NUMBER_ALREADY_EXISTS');
      }
      supplier.registration_number = registration_number;
    }

    if (name) supplier.name = name;
    if (phone_code) supplier.phone_code = phone_code;
    if (phone_number) supplier.phone_number = phone_number;
    if (secondary_code !== undefined) supplier.secondary_code = secondary_code || '+233';
    if (secondary_number !== undefined) supplier.secondary_number = secondary_number || '';
    if (address) supplier.address = address;
    if (city !== undefined) supplier.city = city || '';
    if (state !== undefined) supplier.state = state || '';
    if (country) supplier.country = country;
    if (zip_code !== undefined) supplier.zip_code = zip_code || '';
    if (website !== undefined) supplier.website = website || '';
    if (notes !== undefined) supplier.notes = notes || '';
    if (status) supplier.status = status;
    if (metadata) {
      supplier.metadata = { ...supplier.metadata, ...metadata };
    }

    supplier.updated_by = req.user?.uuid || null;
    await supplier.save();

    await logActivity({
      user_id: req.user?._id || null,
      user_name: req.user?.name || 'system',
      user_role: req.user?.role || 'system',
      action: 'supplier_updated',
      description: `Supplier updated: ${supplier.name}`,
      metadata: {
        supplier_id: supplier.uuid,
        supplier_name: supplier.name,
        updated_fields: Object.keys(data),
        updated_by: req.user?.email || 'system',
      },
      req,
      status: 'success',
    });

    return supplier.toSafeObject();
  }

  /**
   * Delete a supplier
   */
  async deleteSupplier(uuid, req) {
    const supplier = await Supplier.findOne({ uuid });
    if (!supplier) {
      throw new Error('SUPPLIER_NOT_FOUND');
    }

    await supplier.deleteOne();

    await logActivity({
      user_id: req.user?._id || null,
      user_name: req.user?.name || 'system',
      user_role: req.user?.role || 'system',
      action: 'supplier_deleted',
      description: `Supplier deleted: ${supplier.name}`,
      metadata: {
        supplier_id: supplier.uuid,
        supplier_name: supplier.name,
        deleted_by: req.user?.email || 'system',
      },
      req,
      status: 'success',
    });

    return { message: 'Supplier deleted successfully' };
  }

  /**
   * Get supplier statistics
   */
  async getSupplierStats() {
    const stats = await Supplier.aggregate([
      {
        $group: {
          _id: null,
          total_suppliers: { $sum: 1 },
          active_suppliers: {
            $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] }
          },
          inactive_suppliers: {
            $sum: { $cond: [{ $eq: ['$status', 'inactive'] }, 1, 0] }
          },
        },
      },
    ]);
    
    const result = stats[0] || {
      total_suppliers: 0,
      active_suppliers: 0,
      inactive_suppliers: 0,
    };

    return result;
  }

  /**
   * Bulk import suppliers
   */
  async bulkImportSuppliers(suppliersData, req) {
    const results = [];
    const errors = [];

    for (const data of suppliersData) {
      try {
        const supplier = await this.createSupplier(data, req);
        results.push(supplier);
      } catch (error) {
        errors.push({
          data,
          error: error.message,
        });
      }
    }

    return {
      created: results,
      failed: errors,
      total: suppliersData.length,
      success_count: results.length,
      failure_count: errors.length,
    };
  }

  /**
   * Search suppliers by metadata
   */
  async searchSuppliersByMetadata(metadataKey, metadataValue) {
    const query = {
      [`metadata.${metadataKey}`]: metadataValue,
    };

    const suppliers = await Supplier.find(query)
      .sort({ created_at: -1 });

    return suppliers.map(s => s.toSafeObject());
  }

  /**
   * Get suppliers by status
   */
  async getSuppliersByStatus(status, page = 1, limit = 10) {
    const skip = (page - 1) * limit;
    const query = { status };

    const [suppliers, total] = await Promise.all([
      Supplier.find(query)
        .sort({ created_at: -1 })
        .skip(skip)
        .limit(limit),
      Supplier.countDocuments(query),
    ]);

    return {
      suppliers: suppliers.map(s => s.toSafeObject()),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}

module.exports = new SupplierService();