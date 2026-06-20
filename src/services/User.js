// services/User.js
const { User, UserRoles, defaultPermissionsForRole } = require("../models/User");
const Entity = require("../models/Entity");
const { logActivity } = require("../utils/ActivityLogger");
const { ActivityActions } = require("../models/ActivityLog");

class UserService {
  /**
   * Get all users with pagination and filtering
   */
  getUsers = async (filters = {}, page = 1, limit = 10) => {
    const skip = (page - 1) * limit;
    const query = {};

    // Apply filters
    if (filters.search) {
      query.$or = [
        { name: { $regex: filters.search, $options: "i" } },
        { email: { $regex: filters.search, $options: "i" } },
      ];
    }

    if (filters.role) {
      query.role = filters.role;
    }

    if (filters.is_active !== undefined) {
      query.is_active = filters.is_active === "true" || filters.is_active === true;
    }

    const [users, total] = await Promise.all([
      User.find(query)
        .select("-password -reset_password_token -reset_password_expires")
        .sort({ created_at: -1 })
        .skip(skip)
        .limit(limit),
      User.countDocuments(query),
    ]);

    return {
      users: users.map((u) => this.sanitizeUser(u)),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  };

  /**
   * Get user by UUID
   */
  getUserByUuid = async (uuid) => {
    const user = await User.findOne({ uuid }).select(
      "-password -reset_password_token -reset_password_expires"
    );
    if (!user) {
      throw new Error("USER_NOT_FOUND");
    }
    return this.sanitizeUser(user);
  };

  /**
   * Get user by email
   */
  getUserByEmail = async (email) => {
    const user = await User.findOne({ email: email.toLowerCase() }).select(
      "-password -reset_password_token -reset_password_expires"
    );
    if (!user) {
      throw new Error("USER_NOT_FOUND");
    }
    return this.sanitizeUser(user);
  };

  /**
   * Create a new user
   */
  createUser = async (userData, req) => {
    const { first_name, last_name, email, password, role, phone, address, entity_id } =
      userData;

    // Validate required fields
    if (!first_name || !last_name || !email || !password) {
      throw new Error("MISSING_REQUIRED_FIELDS");
    }

    if (password.length < 6) {
      throw new Error("PASSWORD_TOO_SHORT");
    }

    // Check if email already exists
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      throw new Error("EMAIL_ALREADY_EXISTS");
    }

    // Validate role
    const userRole = role || UserRoles.VIEWER;
    if (!Object.values(UserRoles).includes(userRole)) {
      throw new Error("INVALID_ROLE");
    }

    // If entity_id is provided, validate entity exists
    let entities = [];
    if (entity_id) {
      const entity = await Entity.findOne({ uuid: entity_id });
      if (!entity) {
        throw new Error("ENTITY_NOT_FOUND");
      }
      entities = [{
        entity_id: entity.uuid,
        role: userRole,
        name: entity.name,
        branch: entity.branch,
        is_primary: true,
        joined_at: new Date()
      }];
    }

    // Create user
    const user = new User({
      first_name,
      last_name,
      name: `${first_name} ${last_name}`,
      email: email.toLowerCase(),
      password,
      role: userRole,
      phone: phone || "",
      address: address || "",
      is_active: true,
      verified: true,
      permissions: defaultPermissionsForRole(userRole),
      created_by: req.user?.uuid || null,
      updated_by: req.user?.uuid || null,
      entities: entities,
      primary_entity_id: entities.length > 0 ? entities[0].entity_id : null
    });

    await user.save();

    // Log user creation
    await logActivity({
      user_id: req.user?.uuid || req.user?.id || null,
      user_name: req.user?.name || "system",
      user_role: req.user?.role || "system",
      action: ActivityActions.USER_CREATED || "user_created",
      description: `User created: ${user.name}`,
      metadata: {
        user_id: user.uuid,
        user_name: user.name,
        email: user.email,
        role: user.role,
        created_by: req.user?.email || "system",
      },
      req,
      status: "success",
    });

    return this.sanitizeUser(user);
  };

  /**
   * Update user
   */
  updateUser = async (uuid, updateData, req) => {
    const { first_name, last_name, email, phone, address, role, permissions } = updateData;

    // Find user
    const user = await User.findOne({ uuid });
    if (!user) {
      throw new Error("USER_NOT_FOUND");
    }

    // Check email uniqueness if being updated
    if (email && email.toLowerCase() !== user.email) {
      const existingUser = await User.findOne({
        email: email.toLowerCase(),
        _id: { $ne: user._id },
      });
      if (existingUser) {
        throw new Error("EMAIL_ALREADY_EXISTS");
      }
    }

    // Update fields
    if (first_name) user.first_name = first_name;
    if (last_name) user.last_name = last_name;
    if (email) user.email = email.toLowerCase();
    if (phone !== undefined) user.phone = phone;
    if (address !== undefined) user.address = address;
    if (role) {
      if (!Object.values(UserRoles).includes(role)) {
        throw new Error("INVALID_ROLE");
      }
      user.role = role;
    }
    if (permissions) {
      user.permissions = { ...user.permissions, ...permissions };
    }

    user.updated_by = req.user?.uuid || null;
    await user.save();

    // Log user update
    await logActivity({
      user_id: req.user?.uuid || req.user?.id || null,
      user_name: req.user?.name || "system",
      user_role: req.user?.role || "system",
      action: ActivityActions.USER_UPDATED || "user_updated",
      description: `User updated: ${user.name}`,
      metadata: {
        user_id: user.uuid,
        user_name: user.name,
        updated_fields: Object.keys(updateData),
        updated_by: req.user?.email || "system",
      },
      req,
      status: "success",
    });

    return this.sanitizeUser(user);
  };

  /**
   * Toggle user active status
   */
  toggleUserActive = async (uuid, is_active, req) => {
    const user = await User.findOne({ uuid });
    if (!user) {
      throw new Error("USER_NOT_FOUND");
    }

    // Prevent self-deactivation/deletion
    if (req.user && req.user.uuid === uuid) {
      throw new Error("CANNOT_DEACTIVATE_SELF");
    }

    user.is_active = is_active;
    user.updated_by = req.user?.uuid || null;
    await user.save();

    await logActivity({
      user_id: req.user?.uuid || req.user?.id || null,
      user_name: req.user?.name || "system",
      user_role: req.user?.role || "system",
      action: ActivityActions.USER_UPDATED || "user_updated",
      description: `User ${is_active ? "activated" : "deactivated"}: ${user.name}`,
      metadata: {
        user_id: user.uuid,
        user_name: user.name,
        is_active,
        updated_by: req.user?.email || "system",
      },
      req,
      status: "success",
    });

    return this.sanitizeUser(user);
  };

  /**
   * Delete user (soft delete)
   */
  deleteUser = async (uuid, req) => {
    const user = await User.findOne({ uuid });
    if (!user) {
      throw new Error("USER_NOT_FOUND");
    }

    // Prevent self-deletion
    if (req.user && req.user.uuid === uuid) {
      throw new Error("CANNOT_DELETE_SELF");
    }

    // Soft delete
    user.is_active = false;
    user.updated_by = req.user?.uuid || null;
    await user.save();

    await logActivity({
      user_id: req.user?.uuid || req.user?.id || null,
      user_name: req.user?.name || "system",
      user_role: req.user?.role || "system",
      action: ActivityActions.USER_DELETED || "user_deleted",
      description: `User deactivated: ${user.name}`,
      metadata: {
        user_id: user.uuid,
        user_name: user.name,
        deleted_by: req.user?.email || "system",
      },
      req,
      status: "success",
    });

    return {
      message: "User deactivated successfully",
      user: this.sanitizeUser(user),
    };
  };

  /**
   * Permanently delete user
   */
  permanentlyDeleteUser = async (uuid, req) => {
    const user = await User.findOne({ uuid });
    if (!user) {
      throw new Error("USER_NOT_FOUND");
    }

    // Prevent self-deletion
    if (req.user && req.user.uuid === uuid) {
      throw new Error("CANNOT_DELETE_SELF");
    }

    await user.deleteOne();

    await logActivity({
      user_id: req.user?.uuid || req.user?.id || null,
      user_name: req.user?.name || "system",
      user_role: req.user?.role || "system",
      action: ActivityActions.USER_DELETED || "user_deleted",
      description: `User permanently deleted: ${user.name}`,
      metadata: {
        user_id: user.uuid,
        user_name: user.name,
        deleted_by: req.user?.email || "system",
        permanent: true,
      },
      req,
      status: "success",
    });

    return { message: "User permanently deleted successfully" };
  };

  /**
   * Update user password
   */
  updateUserPassword = async (uuid, new_password, confirm_password, req) => {
    if (new_password !== confirm_password) {
      throw new Error("PASSWORD_MISMATCH");
    }

    if (new_password.length < 8) {
      throw new Error("PASSWORD_TOO_SHORT");
    }

    const user = await User.findOne({ uuid }).select("+password");
    if (!user) {
      throw new Error("USER_NOT_FOUND");
    }

    user.password = new_password;
    await user.save();

    await logActivity({
      user_id: req.user?.uuid || req.user?.id || null,
      user_name: req.user?.name || "system",
      user_role: req.user?.role || "system",
      action: ActivityActions.USER_UPDATED || "user_updated",
      description: `Password updated for user: ${user.name}`,
      metadata: {
        user_id: user.uuid,
        user_name: user.name,
        updated_by: req.user?.email || "system",
      },
      req,
      status: "success",
    });

    return { message: "Password updated successfully" };
  };

  /**
   * FIXED: Assign entity to user
   * Admin can assign one or more entities to a user
   */
  assignEntityToUser = async (uuid, entity_id, role = 'member', is_primary = false, req) => {
    // Validate user exists
    const user = await User.findOne({ uuid });
    if (!user) {
      throw new Error("USER_NOT_FOUND");
    }

    // Validate entity exists
    const entity = await Entity.findOne({ uuid: entity_id });
    if (!entity) {
      throw new Error("ENTITY_NOT_FOUND");
    }

    // Check if entity is already assigned
    const existingEntity = user.entities.find(e => e.entity_id === entity_id);
    if (existingEntity) {
      throw new Error("ENTITY_ALREADY_ASSIGNED");
    }

    // Add entity to user
    user.entities.push({
      entity_id: entity.uuid,
      role: role || 'member',
      is_primary: is_primary || false,
      joined_at: new Date()
    });

    // If this is the first entity, set as primary
    if (user.entities.length === 1) {
      user.entities[0].is_primary = true;
      user.primary_entity_id = entity.uuid;
    } else if (is_primary) {
      // If setting as primary, remove primary from others
      user.entities.forEach(e => {
        if (e.entity_id !== entity_id) {
          e.is_primary = false;
        }
      });
      user.primary_entity_id = entity.uuid;
    }

    user.updated_by = req.user?.uuid || null;
    await user.save();

    // Log entity assignment
    await logActivity({
      user_id: req.user?.uuid || req.user?.id || null,
      user_name: req.user?.name || "system",
      user_role: req.user?.role || "system",
      action: ActivityActions.ENTITY_ASSIGNED || "entity_assigned",
      description: `Entity ${entity.name} assigned to user ${user.name}`,
      metadata: {
        user_id: user.uuid,
        user_name: user.name,
        entity_id: entity.uuid,
        entity_name: entity.name,
        role: role,
        is_primary: is_primary,
        assigned_by: req.user?.email || "system",
      },
      req,
      status: "success",
    });

    return this.sanitizeUser(user);
  };

  /**
   * NEW: Assign multiple entities to user
   * Admin can assign multiple entities at once
   */
  assignMultipleEntitiesToUser = async (uuid, entities, req) => {
    // Validate user exists
    const user = await User.findOne({ uuid });
    if (!user) {
      throw new Error("USER_NOT_FOUND");
    }

    if (!entities || !Array.isArray(entities) || entities.length === 0) {
      throw new Error("ENTITIES_ARRAY_REQUIRED");
    }

    const assignedEntities = [];
    const skippedEntities = [];

    // Process each entity
    for (const entityData of entities) {
      const { entity_id, role = 'member', is_primary = false } = entityData;

      // Validate entity exists
      const entity = await Entity.findOne({ uuid: entity_id });
      if (!entity) {
        skippedEntities.push({ entity_id, reason: "ENTITY_NOT_FOUND" });
        continue;
      }

      // Check if entity is already assigned
      const existingEntity = user.entities.find(e => e.entity_id === entity_id);
      if (existingEntity) {
        skippedEntities.push({ entity_id, reason: "ENTITY_ALREADY_ASSIGNED" });
        continue;
      }

      // Add entity to user
      user.entities.push({
        entity_id: entity.uuid,
        role: role || 'member',
        is_primary: is_primary || false,
        joined_at: new Date()
      });

      assignedEntities.push({ entity_id, name: entity.name, role, is_primary });
    }

    // If no entities were assigned
    if (assignedEntities.length === 0) {
      throw new Error("NO_ENTITIES_ASSIGNED");
    }

    // If this is the first entity, set as primary
    if (user.entities.length === assignedEntities.length) {
      user.entities[0].is_primary = true;
      user.primary_entity_id = user.entities[0].entity_id;
    } else {
      // Check if any entity is marked as primary
      const hasPrimary = user.entities.some(e => e.is_primary);
      if (!hasPrimary) {
        // Set the first assigned entity as primary
        const firstAssigned = user.entities.find(e => 
          assignedEntities.some(a => a.entity_id === e.entity_id)
        );
        if (firstAssigned) {
          firstAssigned.is_primary = true;
          user.primary_entity_id = firstAssigned.entity_id;
        }
      }
    }

    user.updated_by = req.user?.uuid || null;
    await user.save();

    // Log entity assignments
    for (const assigned of assignedEntities) {
      await logActivity({
        user_id: req.user?.uuid || req.user?.id || null,
        user_name: req.user?.name || "system",
        user_role: req.user?.role || "system",
        action: ActivityActions.ENTITY_ASSIGNED || "entity_assigned",
        description: `Entity ${assigned.name} assigned to user ${user.name}`,
        metadata: {
          user_id: user.uuid,
          user_name: user.name,
          entity_id: assigned.entity_id,
          entity_name: assigned.name,
          role: assigned.role,
          is_primary: assigned.is_primary,
          assigned_by: req.user?.email || "system",
        },
        req,
        status: "success",
      });
    }

    return {
      ...this.sanitizeUser(user),
      assigned_entities: assignedEntities,
      skipped_entities: skippedEntities
    };
  };

  /**
   * Remove entity from user
   */
  removeEntityFromUser = async (uuid, entity_id, req) => {
    const user = await User.findOne({ uuid });
    if (!user) {
      throw new Error("USER_NOT_FOUND");
    }

    // Check if entity exists in user's entities
    const entityIndex = user.entities.findIndex(e => e.entity_id === entity_id);
    if (entityIndex === -1) {
      throw new Error("ENTITY_NOT_FOUND");
    }

    // Get entity name for logging
    const entity = await Entity.findOne({ uuid: entity_id });
    
    // Remove entity
    user.entities.splice(entityIndex, 1);

    // If removed entity was primary, set a new primary
    if (user.primary_entity_id === entity_id) {
      if (user.entities.length > 0) {
        user.entities[0].is_primary = true;
        user.primary_entity_id = user.entities[0].entity_id;
      } else {
        user.primary_entity_id = null;
      }
    }

    user.updated_by = req.user?.uuid || null;
    await user.save();

    // Log entity removal
    await logActivity({
      user_id: req.user?.uuid || req.user?.id || null,
      user_name: req.user?.name || "system",
      user_role: req.user?.role || "system",
      action: ActivityActions.ENTITY_REMOVED || "entity_removed",
      description: `Entity ${entity?.name || entity_id} removed from user ${user.name}`,
      metadata: {
        user_id: user.uuid,
        user_name: user.name,
        entity_id: entity_id,
        entity_name: entity?.name || "Unknown",
        removed_by: req.user?.email || "system",
      },
      req,
      status: "success",
    });

    return this.sanitizeUser(user);
  };

  /**
   * Set primary entity
   */
  setPrimaryEntity = async (uuid, entity_id, req) => {
    const user = await User.findOne({ uuid });
    if (!user) {
      throw new Error("USER_NOT_FOUND");
    }

    // Check if entity exists in user's entities
    const entityIndex = user.entities.findIndex(e => e.entity_id === entity_id);
    if (entityIndex === -1) {
      throw new Error("ENTITY_NOT_FOUND");
    }

    // Update primary
    user.entities.forEach(e => {
      e.is_primary = e.entity_id === entity_id;
    });
    user.primary_entity_id = entity_id;

    user.updated_by = req.user?.uuid || null;
    await user.save();

    const entity = await Entity.findOne({ uuid: entity_id });

    // Log primary entity change
    await logActivity({
      user_id: req.user?.uuid || req.user?.id || null,
      user_name: req.user?.name || "system",
      user_role: req.user?.role || "system",
      action: ActivityActions.ENTITY_UPDATED || "entity_updated",
      description: `Primary entity changed to ${entity?.name || entity_id} for user ${user.name}`,
      metadata: {
        user_id: user.uuid,
        user_name: user.name,
        entity_id: entity_id,
        entity_name: entity?.name || "Unknown",
        updated_by: req.user?.email || "system",
      },
      req,
      status: "success",
    });

    return this.sanitizeUser(user);
  };

  /**
   * Get user's entities with details
   */
  getUserEntities = async (uuid) => {
    const user = await User.findOne({ uuid });
    if (!user) {
      throw new Error("USER_NOT_FOUND");
    }

    const entityDetails = [];
    for (const entityRef of user.entities) {
      const entity = await Entity.findOne({ uuid: entityRef.entity_id });
      if (entity) {
        entityDetails.push({
          ...entityRef.toObject(),
          name: entity.name,
          email: entity.email,
          is_active: entity.is_active
        });
      }
    }

    return {
      user_id: user.uuid,
      user_name: user.name,
      primary_entity_id: user.primary_entity_id,
      entities: entityDetails
    };
  };

  /**
   * Sanitize user object
   */
  sanitizeUser(user) {
    const userObj = user.toObject ? user.toObject() : user;
    const sanitized = {
      uuid: userObj.uuid,
      name: userObj.name,
      first_name: userObj.first_name,
      last_name: userObj.last_name,
      email: userObj.email,
      phone: userObj.phone || "",
      address: userObj.address || "",
      role: userObj.role,
      is_active: userObj.is_active,
      verified: userObj.verified,
      permissions: userObj.permissions || {},
      entities: userObj.entities || [],
      primary_entity_id: userObj.primary_entity_id || null,
      created_at: userObj.created_at,
      updated_at: userObj.updated_at
    };
    return sanitized;
  }
}

module.exports = new UserService();