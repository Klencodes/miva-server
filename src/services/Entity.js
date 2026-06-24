// services/entityService.js
const Entity = require("../models/Entity");
const { User } = require("../models/User");
const { logActivity } = require("../utils/ActivityLogger");
const { ActivityActions } = require("../models/ActivityLog");

class EntityService {
  /**
   * Format number to 2 decimal places
   */
  formatCurrency(value) {
    if (value === undefined || value === null || isNaN(value)) return 0;
    return Math.round(value * 100) / 100;
  }

  /**
   * Get all entities with pagination and filtering
   */
  getEntities = async (filters = {}, page = 1, limit = 10) => {
    const skip = (page - 1) * limit;
    const query = {};

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
      query.is_active = filters.is_active === "true" || filters.is_active === true;
    }

    if (filters.branch) {
      query.branch = filters.branch;
    }

    const [entities, total] = await Promise.all([
      Entity.find(query).sort({ created_at: -1 }).skip(skip).limit(limit),
      Entity.countDocuments(query),
    ]);

    const sanitizedEntities = entities.map((e) => this.sanitizeEntity(e));

    return {
      results: sanitizedEntities,
      count: total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
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
   * Create entity
   */
  createEntity = async (entityData, req) => {
    const {
      name, email, phone, website, branch, address, city, state,
      country, zip_code, registration_number, tax_id, currency, metadata = {},
    } = entityData;

    if (!name || !email) throw new Error("MISSING_REQUIRED_FIELDS");

    // Uniqueness checks
    if (await Entity.findOne({ email: email.toLowerCase() }))
      throw new Error("EMAIL_ALREADY_EXISTS");
    if (registration_number && await Entity.findOne({ registration_number }))
      throw new Error("REGISTRATION_NUMBER_ALREADY_EXISTS");
    if (tax_id && await Entity.findOne({ tax_id }))
      throw new Error("TAX_ID_ALREADY_EXISTS");

    const { User } = require('../models/User');
    const actor = req.user;

    // ─── Ensure "All Entities" system entity exists ───────────────────────────
    const allEntitiesExists = await Entity.findOne({ uuid: "ALL_ENTITIES" });

    if (!allEntitiesExists) {
      const systemIdentifier = `SYS-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      const totalEntities = await Entity.countDocuments();

      const allEntities = await new Entity({
        uuid: "ALL_ENTITIES",
        name: "All Entities",
        branch: "All",
        email: "system@all-entities.local",
        phone, website, address, city, state, country, zip_code,
        registration_number: registration_number || `SYS-REG-${Date.now()}`,
        tax_id: tax_id || `SYS-TAX-${Date.now()}`,
        currency: currency || "GHS",
        is_active: true,
        is_system_entity: true,
        created_by: actor?.uuid || null,
        updated_by: actor?.uuid || null,
        metadata: {
          is_system_entity: true,
          created_automatically: true,
          system_identifier: systemIdentifier,
          original_entity_name: name,
          original_entity_email: email,
          original_entity_branch: branch || "Head Quarters",
          original_registration_number: registration_number || null,
          original_tax_id: tax_id || null,
          created_from_entity_data: true,
          ...(totalEntities === 0
            ? { created_when_no_entities_existed: true }
            : { created_when_no_all_entities_existed: true }),
          ...metadata,
        },
      }).save();

      await logActivity({
        user_id: actor?._id || actor?.uuid || null,
        user_name: actor?.name || "system",
        user_role: actor?.role || "system",
        action: "SYSTEM_ENTITY_CREATED",
        description: `System entity created: All Entities from ${name}`,
        metadata: {
          entity_id: allEntities.uuid,
          entity_name: allEntities.name,
          original_entity_name: name,
          original_entity_email: email,
          created_by: actor?.email || "system",
          is_system_entity: true,
        },
        req,
        status: "success",
      });

      // Assign "All Entities" to creator
      if (actor?.uuid) {
        const user = await User.findOne({ uuid: actor.uuid });
        const hasIt = user?.entities?.some(e => e.entity_id === "ALL_ENTITIES");
        if (!hasIt) {
          await User.findOneAndUpdate(
            { uuid: actor.uuid },
            {
              $push: { entities: { entity_id: allEntities.uuid, role: actor.role || 'admin', is_primary: totalEntities === 0, joined_at: new Date() } },
              ...(totalEntities === 0 && { $set: { primary_entity_id: allEntities.uuid } }),
            }
          );
        }
      }
    }

    // ─── Create the new entity ────────────────────────────────────────────────
    const entity = await new Entity({
      name, branch: branch || "Head Quarters",
      email: email.toLowerCase(),
      phone, website, address, city, state, country, zip_code,
      registration_number, tax_id,
      currency: currency || "GHS",
      metadata,
      is_active: true,
      created_by: actor?.uuid || null,
      updated_by: actor?.uuid || null,
    }).save();

    // Assign new entity to creator
    if (actor?.uuid) {
      const user = await User.findOne({ uuid: actor.uuid });
      if (!user?.entities?.some(e => e.entity_id === entity.uuid)) {
        await User.findOneAndUpdate(
          { uuid: actor.uuid },
          { $push: { entities: { entity_id: entity.uuid, role: actor.role || 'admin', is_primary: false, joined_at: new Date() } } }
        );
        const updated = await User.findOne({ uuid: actor.uuid });
        if (!updated?.primary_entity_id) {
          await User.findOneAndUpdate({ uuid: actor.uuid }, { $set: { primary_entity_id: entity.uuid } });
        }
      }
    }

    await logActivity({
      user_id: actor?._id || actor?.uuid || null,
      user_name: actor?.name || "system",
      user_role: actor?.role || "system",
      action: "ENTITY_CREATED",
      description: `Entity created: ${entity.name}`,
      metadata: {
        entity_id: entity.uuid, entity_name: entity.name, email: entity.email,
        registration_number: entity.registration_number, tax_id: entity.tax_id,
        created_by: actor?.email || "system",
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
      branch,
      currency,
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
    if (registration_number && registration_number !== entity.registration_number) {
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
    if (registration_number !== undefined) entity.registration_number = registration_number;
    if (tax_id !== undefined) entity.tax_id = tax_id;
    if (branch !== undefined) entity.branch = branch;
    if (currency !== undefined) entity.currency = currency;
    
    // Handle metadata properly
    if (metadata !== undefined) {
      // Check if entity.metadata is a Map
      if (entity.metadata instanceof Map) {
        // Merge new metadata into existing Map
        Object.entries(metadata).forEach(([key, value]) => {
          entity.metadata.set(key, value);
        });
      } else {
        // If it's a plain object, merge normally
        entity.metadata = { ...entity.metadata, ...metadata };
      }
    }
    
    if (is_active !== undefined) entity.is_active = is_active;

    entity.updated_by = req.user?.uuid || null;
    
    // Save the entity
    await entity.save();
    
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
      user_id: req.user?._id || req.user?.uuid || null,
      user_name: req.user?.name || "system",
      user_role: req.user?.role || "system",
      action: ActivityActions.ENTITY_DELETED,
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
      { $pull: { entities: { entity_id: uuid } } }
    );

    // Remove entity
    await entity.deleteOne();

    // Log permanent deletion
    await logActivity({
      user_id: req.user?._id || req.user?.uuid || null,
      user_name: req.user?.name || "system",
      user_role: req.user?.role || "system",
      action: ActivityActions.ENTITY_DELETED,
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
      user_id: req.user?._id || req.user?.uuid || null,
      user_name: req.user?.name || "system",
      user_role: req.user?.role || "system",
      action: ActivityActions.ENTITY_UPDATED,
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

    const userList = users.map((u) => ({
      uuid: u.uuid,
      name: u.name,
      email: u.email,
      role: u.role,
      entity_role: u.entities.find((e) => e.entity_id === entityUuid)?.role || "member",
      is_primary: u.entities.find((e) => e.entity_id === entityUuid)?.is_primary || false,
      joined_at: u.entities.find((e) => e.entity_id === entityUuid)?.joined_at,
      is_active: u.is_active,
      verified: u.verified,
      last_login: u.last_login,
      created_at: u.created_at,
    }));

    return {
      users: userList,
      count: total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
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
      entityByBranch,
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
        { $group: { _id: "$branch", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),
    ]);

    return {
      total: totalEntities,
      active: activeEntities,
      inactive: inactiveEntities,
      by_country: entityByCountry.map(item => ({
        country: item._id || 'Unknown',
        count: item.count || 0
      })),
      by_branch: entityByBranch.map(item => ({
        branch: item._id || 'Unknown',
        count: item.count || 0
      })),
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
      branch: entityObj.branch,
      currency: entityObj.currency || "GHS",
      is_active: entityObj.is_active,
      is_system_entity: entityObj.is_system_entity || false,
      settings: entityObj.settings || {},
      metadata: entityObj.metadata || {},
      created_at: entityObj.created_at,
      updated_at: entityObj.updated_at,
    };
  }
}

module.exports = new EntityService();