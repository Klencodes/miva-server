// services/entityService.js
const Entity = require("../models/Entity");
const { User } = require("../models/User");
const { logActivity } = require("../utils/ActivityLogger");
const { ActivityActions } = require("../models/ActivityLog");

class EntityService {
  /**
   * Get all entities with pagination and filtering
   */
  getEntities = async (filters = {}, page = 1, limit = 10) => {
    const skip = (page - 1) * limit;
    const query = {};

    // Apply filters
    if (filters.search) {
      query.$or = [
        { name: { $regex: filters.search, $options: "i" } },
        { email: { $regex: filters.search, $options: "i" } },
        { registration_number: { $regex: filters.search, $options: "i" } },
        { tax_id: { $regex: filters.search, $options: "i" } },
      ];
    }

    if (filters.country) {
      query.country = filters.country;
    }

    if (filters.is_active !== undefined) {
      query.is_active =
        filters.is_active === "true" || filters.is_active === true;
    }

    if (filters.currency) {
      query.currency = filters.currency;
    }

    const [entities, total] = await Promise.all([
      Entity.find(query).sort({ created_at: -1 }).skip(skip).limit(limit),
      Entity.countDocuments(query),
    ]);

    return {
      entities: entities.map((e) => this.sanitizeEntity(e)),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  };

  /**
   * Get entity by UUID
   */
  getEntityByUuid = async (uuid) => {
    const entity = await Entity.findOne({ uuid });
    if (!entity) {
      throw new Error("ENTITY_NOT_FOUND");
    }
    return this.sanitizeEntity(entity);
  };

  /**
   * Get entity by ID (MongoDB _id)
   */
  getEntityById = async (id) => {
    const entity = await Entity.findById(id);
    if (!entity) {
      throw new Error("ENTITY_NOT_FOUND");
    }
    return this.sanitizeEntity(entity);
  };

  /**
   * Get entity by email
   */
  getEntityByEmail = async (email) => {
    const entity = await Entity.findOne({ email: email.toLowerCase() });
    if (!entity) {
      throw new Error("ENTITY_NOT_FOUND");
    }
    return this.sanitizeEntity(entity);
  };

  /**
   * Create a new entity
   */
  createEntity = async (entityData, req) => {
    const {
      name,
      email,
      phone,
      website,
      address,
      city,
      state,
      country,
      zip_code,
      registration_number,
      tax_id,
      currency,
      settings = {},
      metadata = {},
    } = entityData;

    // Validate required fields
    if (!name || !email) {
      throw new Error("MISSING_REQUIRED_FIELDS");
    }

    // Check if email already exists
    const existingEntity = await Entity.findOne({ email: email.toLowerCase() });
    if (existingEntity) {
      throw new Error("EMAIL_ALREADY_EXISTS");
    }

    // Check if registration number already exists (if provided)
    if (registration_number) {
      const existingReg = await Entity.findOne({ registration_number });
      if (existingReg) {
        throw new Error("REGISTRATION_NUMBER_ALREADY_EXISTS");
      }
    }

    // Check if tax ID already exists (if provided)
    if (tax_id) {
      const existingTax = await Entity.findOne({ tax_id });
      if (existingTax) {
        throw new Error("TAX_ID_ALREADY_EXISTS");
      }
    }

    // Create entity
    const entity = new Entity({
      name,
      email: email.toLowerCase(),
      phone: phone || "",
      website: website || "",
      address: address || "",
      city: city || "",
      state: state || "",
      country: country || "",
      zip_code: zip_code || "",
      registration_number: registration_number || "",
      tax_id: tax_id || "",
      currency: currency || "USD",
      settings,
      metadata,
      is_active: true,
      created_by: req.user?.uuid || null,
      updated_by: req.user?.uuid || null,
    });

    await entity.save();

    // Log entity creation
    await logActivity({
      user_id: req.user?.uuid || req.user?.id || null,
      user_name: req.user?.name || "system",
      user_role: req.user?.role || "system",
      action: ActivityActions.ENTITY_CREATED ,
      description: `Entity created: ${entity.name}`,
      metadata: {
        entity_id: entity.uuid,
        entity_name: entity.name,
        email: entity.email,
        registration_number: entity.registration_number,
        created_by: req.user?.email || "system",
      },
      req,
      status: "success",
    });

    return this.sanitizeEntity(entity);
  };

  /**
   * Update entity
   */
  updateEntity = async (uuid, updateData, req) => {
    const {
      name,
      email,
      phone,
      website,
      address,
      city,
      state,
      country,
      zip_code,
      registration_number,
      tax_id,
      currency,
      settings,
      metadata,
      is_active,
    } = updateData;

    // Find entity
    const entity = await Entity.findOne({ uuid });
    if (!entity) {
      throw new Error("ENTITY_NOT_FOUND");
    }

    // Check email uniqueness if being updated
    if (email && email.toLowerCase() !== entity.email) {
      const existingEntity = await Entity.findOne({
        email: email.toLowerCase(),
        _id: { $ne: entity._id },
      });
      if (existingEntity) {
        throw new Error("EMAIL_ALREADY_EXISTS");
      }
    }

    // Check registration number uniqueness if being updated
    if (
      registration_number &&
      registration_number !== entity.registration_number
    ) {
      const existingReg = await Entity.findOne({
        registration_number,
        _id: { $ne: entity._id },
      });
      if (existingReg) {
        throw new Error("REGISTRATION_NUMBER_ALREADY_EXISTS");
      }
    }

    // Check tax ID uniqueness if being updated
    if (tax_id && tax_id !== entity.tax_id) {
      const existingTax = await Entity.findOne({
        tax_id,
        _id: { $ne: entity._id },
      });
      if (existingTax) {
        throw new Error("TAX_ID_ALREADY_EXISTS");
      }
    }

    // Update fields
    if (name) entity.name = name;
    if (email) entity.email = email.toLowerCase();
    if (phone !== undefined) entity.phone = phone;
    if (website !== undefined) entity.website = website;
    if (address !== undefined) entity.address = address;
    if (city !== undefined) entity.city = city;
    if (state !== undefined) entity.state = state;
    if (country !== undefined) entity.country = country;
    if (zip_code !== undefined) entity.zip_code = zip_code;
    if (registration_number !== undefined)
      entity.registration_number = registration_number;
    if (tax_id !== undefined) entity.tax_id = tax_id;
    if (currency) entity.currency = currency;
    if (settings) entity.settings = { ...entity.settings, ...settings };
    if (metadata) entity.metadata = { ...entity.metadata, ...metadata };
    if (is_active !== undefined) entity.is_active = is_active;

    entity.updated_by = req.user?.uuid || null;
    await entity.save();

    // Log entity update
    await logActivity({
      user_id: req.user?.uuid || req.user?.id || null,
      user_name: req.user?.name || "system",
      user_role: req.user?.role || "system",
      action: ActivityActions.ENTITY_UPDATED || "entity_updated",
      description: `Entity updated: ${entity.name}`,
      metadata: {
        entity_id: entity.uuid,
        entity_name: entity.name,
        updated_fields: Object.keys(updateData),
        updated_by: req.user?.email || "system",
      },
      req,
      status: "success",
    });

    return this.sanitizeEntity(entity);
  };

  /**
   * Delete entity (soft delete)
   */
  deleteEntity = async (uuid, req) => {
    const entity = await Entity.findOne({ uuid });
    if (!entity) {
      throw new Error("ENTITY_NOT_FOUND");
    }

    // Check if any users are assigned to this entity
    const usersWithEntity = await User.find({ "entities.entity_id": uuid });
    if (usersWithEntity.length > 0) {
      throw new Error("ENTITY_HAS_USERS");
    }

    // Soft delete
    entity.is_active = false;
    entity.updated_by = req.user?.uuid || null;
    await entity.save();

    // Log entity deletion
    await logActivity({
      user_id: req.user?.uuid || req.user?.id || null,
      user_name: req.user?.name || "system",
      user_role: req.user?.role || "system",
      action: ActivityActions.ENTITY_DELETED || "entity_deleted",
      description: `Entity deactivated: ${entity.name}`,
      metadata: {
        entity_id: entity.uuid,
        entity_name: entity.name,
        deleted_by: req.user?.email || "system",
      },
      req,
      status: "success",
    });

    return {
      message: "Entity deactivated successfully",
      entity: this.sanitizeEntity(entity),
    };
  };

  /**
   * Permanently delete entity
   */
  permanentlyDeleteEntity = async (uuid, req) => {
    const entity = await Entity.findOne({ uuid });
    if (!entity) {
      throw new Error("ENTITY_NOT_FOUND");
    }

    // Check if any users are assigned to this entity
    const usersWithEntity = await User.find({ "entities.entity_id": uuid });
    if (usersWithEntity.length > 0) {
      throw new Error("ENTITY_HAS_USERS");
    }

    // Remove entity from all users
    await User.updateMany(
      { "entities.entity_id": uuid },
      { $pull: { entities: { entity_id: uuid } } },
    );

    // Remove entity
    await entity.deleteOne();

    // Log permanent deletion
    await logActivity({
      user_id: req.user?.uuid || req.user?.id || null,
      user_name: req.user?.name || "system",
      user_role: req.user?.role || "system",
      action: ActivityActions.ENTITY_DELETED || "entity_deleted",
      description: `Entity permanently deleted: ${entity.name}`,
      metadata: {
        entity_id: entity.uuid,
        entity_name: entity.name,
        deleted_by: req.user?.email || "system",
        permanent: true,
      },
      req,
      status: "success",
    });

    return { message: "Entity permanently deleted successfully" };
  };

  /**
   * Toggle entity active status
   */
  toggleEntityActive = async (uuid, is_active, req) => {
    const entity = await Entity.findOne({ uuid });
    if (!entity) {
      throw new Error("ENTITY_NOT_FOUND");
    }

    entity.is_active = is_active;
    entity.updated_by = req.user?.uuid || null;
    await entity.save();

    await logActivity({
      user_id: req.user?.uuid || req.user?.id || null,
      user_name: req.user?.name || "system",
      user_role: req.user?.role || "system",
      action: ActivityActions.ENTITY_UPDATED || "entity_updated",
      description: `Entity ${is_active ? "activated" : "deactivated"}: ${entity.name}`,
      metadata: {
        entity_id: entity.uuid,
        entity_name: entity.name,
        is_active,
        updated_by: req.user?.email || "system",
      },
      req,
      status: "success",
    });

    return this.sanitizeEntity(entity);
  };

  /**
   * Get users by entity
   */
  getEntityUsers = async (entityUuid, page = 1, limit = 10) => {
    const skip = (page - 1) * limit;

    const entity = await Entity.findOne({ uuid: entityUuid });
    if (!entity) {
      throw new Error("ENTITY_NOT_FOUND");
    }

    const query = { "entities.entity_id": entityUuid };

    const [users, total] = await Promise.all([
      User.find(query)
        .select("-password -reset_password_token -reset_password_expires")
        .sort({ created_at: -1 })
        .skip(skip)
        .limit(limit),
      User.countDocuments(query),
    ]);

    return {
      users: users.map((u) => ({
        uuid: u.uuid,
        name: u.name,
        email: u.email,
        role: u.role,
        entity_role:
          u.entities.find((e) => e.entity_id === entityUuid)?.role || "member",
        is_primary:
          u.entities.find((e) => e.entity_id === entityUuid)?.is_primary ||
          false,
        joined_at: u.entities.find((e) => e.entity_id === entityUuid)
          ?.joined_at,
        is_active: u.is_active,
        verified: u.verified,
        last_login: u.last_login,
        created_at: u.created_at,
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  };

  /**
   * Get entity statistics
   */
  getEntityStats = async () => {
    const [
      totalEntities,
      activeEntities,
      inactiveEntities,
      entityByCountry,
      entityByCurrency,
    ] = await Promise.all([
      Entity.countDocuments(),
      Entity.countDocuments({ is_active: true }),
      Entity.countDocuments({ is_active: false }),
      Entity.aggregate([
        { $match: { country: { $ne: "" } } },
        { $group: { _id: "$country", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 10 },
      ]),
      Entity.aggregate([
        { $group: { _id: "$currency", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),
    ]);

    return {
      total: totalEntities,
      active: activeEntities,
      inactive: inactiveEntities,
      by_country: entityByCountry,
      by_currency: entityByCurrency,
    };
  };

  /**
   * Sanitize entity object
   */
  sanitizeEntity(entity) {
    const entityObj = entity.toObject ? entity.toObject() : entity;
    return {
      uuid: entityObj.uuid,
      name: entityObj.name,
      email: entityObj.email,
      phone: entityObj.phone,
      website: entityObj.website,
      address: entityObj.address,
      city: entityObj.city,
      state: entityObj.state,
      country: entityObj.country,
      zip_code: entityObj.zip_code,
      registration_number: entityObj.registration_number,
      tax_id: entityObj.tax_id,
      currency: entityObj.currency,
      is_active: entityObj.is_active,
      settings: entityObj.settings || {},
      metadata: entityObj.metadata || {},
      created_at: entityObj.created_at,
      updated_at: entityObj.updated_at,
    };
  }
}

module.exports = new EntityService();
