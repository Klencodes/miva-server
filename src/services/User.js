// services/userService.js
const { User, UserRoles, defaultPermissionsForRole } = require('../models/User');
const { logActivity } = require('../utils/ActivityLogger');
const { ActivityActions } = require('../models/ActivityLog');

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
        { name: { $regex: filters.search, $options: 'i' } },
        { email: { $regex: filters.search, $options: 'i' } },
      ];
    }

    if (filters.role) {
      query.role = filters.role;
    }

    if (filters.is_active !== undefined) {
      query.is_active = filters.is_active === 'true' || filters.is_active === true;
    }

    const [users, total] = await Promise.all([
      User.find(query)
        .select('-password -reset_password_token -reset_password_expires')
        .sort({ created_at: -1 })
        .skip(skip)
        .limit(limit),
      User.countDocuments(query),
    ]);

    return {
      users: users.map(u => this.sanitizeUser(u)),
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
    const user = await User.findOne({ uuid })
      .select('-password -reset_password_token -reset_password_expires');

    if (!user) {
      throw new Error('USER_NOT_FOUND');
    }

    return this.sanitizeUser(user);
  };

  /**
   * Create a new user
   */
  createUser = async (userData, req) => {
    const {
      name,
      email,
      password,
      confirm_password,
      phone,
      address,
      role,
      permissions,
      verified = false,
      entities = [],
    } = userData;

    // Validate input
    if (!name || !email || !password || !confirm_password) {
      throw new Error('MISSING_REQUIRED_FIELDS');
    }

    if (password !== confirm_password) {
      throw new Error('PASSWORD_MISMATCH');
    }

    if (password.length < 8) {
      throw new Error('PASSWORD_TOO_SHORT');
    }

    // Check if email already exists
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      throw new Error('EMAIL_ALREADY_EXISTS');
    }

    // Validate role
    if (role && !Object.values(UserRoles).includes(role)) {
      throw new Error('INVALID_ROLE');
    }

    // Prepare permissions
    let userPermissions = {};
    if (permissions && typeof permissions === 'object') {
      userPermissions = permissions;
    } else if (role) {
      userPermissions = defaultPermissionsForRole(role);
    }

    // Prepare entities
    let userEntities = [];
    let primaryEntityId = null;
    
    if (entities && entities.length > 0) {
      userEntities = entities.map((entity, index) => ({
        entity_id: entity.entity_id,
        role: entity.role || 'member',
        joined_at: new Date(),
        is_primary: index === 0 || entity.is_primary || false
      }));
      
      const primary = userEntities.find(e => e.is_primary);
      if (primary) {
        primaryEntityId = primary.entity_id;
      } else if (userEntities.length > 0) {
        userEntities[0].is_primary = true;
        primaryEntityId = userEntities[0].entity_id;
      }
    }

    // Create user
    const user = new User({
      name,
      email: email.toLowerCase(),
      password,
      phone: phone || '',
      address: address || '',
      role: role || UserRoles.VIEWER,
      permissions: userPermissions,
      verified,
      is_active: true,
      created_by: req.user?.uuid || null,
      entities: userEntities,
      primary_entity_id: primaryEntityId,
    });

    await user.save();

    // Log user creation
    await logActivity({
      user_id: user._id,
      user_name: user.name,
      user_role: user.role,
      action: ActivityActions.USER_CREATED,
      description: `User created: ${user.email}`,
      metadata: {
        email: user.email,
        role: user.role,
        entities: userEntities.map(e => e.entity_id),
        created_by: req.user?.email || 'system',
      },
      req,
      status: 'success'
    });

    return this.sanitizeUser(user);
  };

  /**
   * Update user
   */
  updateUser = async (uuid, updateData, req) => {
    const {
      name,
      phone,
      address,
      role,
      permissions,
      verified,
      is_active,
    } = updateData;

    // Find user
    const user = await User.findOne({ uuid });
    if (!user) {
      throw new Error('USER_NOT_FOUND');
    }

    // Update fields
    if (name) user.name = name;
    if (phone !== undefined) user.phone = phone;
    if (address !== undefined) user.address = address;
    if (verified !== undefined) user.verified = verified;
    if (is_active !== undefined) user.is_active = is_active;

    // Update role and permissions
    if (role) {
      if (!Object.values(UserRoles).includes(role)) {
        throw new Error('INVALID_ROLE');
      }
      user.role = role;

      // If permissions are not explicitly provided, set default permissions for the new role
      if (!permissions || typeof permissions !== 'object') {
        user.permissions = defaultPermissionsForRole(role);
      }
    }

    // Update permissions if provided
    if (permissions && typeof permissions === 'object') {
      // Merge with existing permissions
      const currentPerms = user.permissions.toObject ? user.permissions.toObject() : user.permissions;
      user.permissions = { ...currentPerms, ...permissions };
    }

    user.updated_by = req.user?.uuid || null;
    await user.save();

    // Log user update
    await logActivity({
      user_id: user._id,
      user_name: user.name,
      user_role: user.role,
      action: ActivityActions.USER_UPDATED,
      description: `User updated: ${user.email}`,
      metadata: {
        email: user.email,
        updated_fields: Object.keys(updateData),
        updated_by: req.user?.email || 'system',
      },
      req,
      status: 'success'
    });

    return this.sanitizeUser(user);
  };

  /**
   * Assign entity to user
   */
  assignEntityToUser = async (uuid, entityId, role = 'member', isPrimary = false, req) => {
    const user = await User.findOne({ uuid });
    if (!user) {
      throw new Error('USER_NOT_FOUND');
    }

    // Check if entity already assigned
    const existingEntity = user.entities.find(e => e.entity_id === entityId);
    if (existingEntity) {
      throw new Error('ENTITY_ALREADY_ASSIGNED');
    }

    // Add entity
    user.entities.push({
      entity_id: entityId,
      role,
      joined_at: new Date(),
      is_primary: isPrimary
    });

    // If this is primary, update primary_entity_id
    if (isPrimary) {
      // Remove primary flag from other entities
      user.entities.forEach(e => e.is_primary = false);
      const newPrimary = user.entities.find(e => e.entity_id === entityId);
      if (newPrimary) {
        newPrimary.is_primary = true;
        user.primary_entity_id = entityId;
      }
    } else if (!user.primary_entity_id) {
      // If no primary exists, set this as primary
      const newEntity = user.entities.find(e => e.entity_id === entityId);
      if (newEntity) {
        newEntity.is_primary = true;
        user.primary_entity_id = entityId;
      }
    }

    user.updated_by = req.user?.uuid || null;
    await user.save();

    await logActivity({
      user_id: user._id,
      user_name: user.name,
      user_role: user.role,
      action: ActivityActions.USER_UPDATED,
      description: `Entity ${entityId} assigned to user: ${user.email}`,
      metadata: {
        email: user.email,
        entity_id: entityId,
        role: role,
        is_primary: isPrimary,
        updated_by: req.user?.email || 'system',
      },
      req,
      status: 'success'
    });

    return this.sanitizeUser(user);
  };

  /**
   * Remove entity from user
   */
  removeEntityFromUser = async (uuid, entityId, req) => {
    const user = await User.findOne({ uuid });
    if (!user) {
      throw new Error('USER_NOT_FOUND');
    }

    const entityIndex = user.entities.findIndex(e => e.entity_id === entityId);
    if (entityIndex === -1) {
      throw new Error('ENTITY_NOT_FOUND');
    }

    // Check if this is the primary entity
    const isPrimary = user.entities[entityIndex].is_primary;

    // Remove entity
    user.entities.splice(entityIndex, 1);

    // If removed entity was primary, set new primary if entities exist
    if (isPrimary && user.entities.length > 0) {
      user.entities[0].is_primary = true;
      user.primary_entity_id = user.entities[0].entity_id;
    } else if (isPrimary) {
      user.primary_entity_id = null;
    }

    user.updated_by = req.user?.uuid || null;
    await user.save();

    await logActivity({
      user_id: user._id,
      user_name: user.name,
      user_role: user.role,
      action: ActivityActions.USER_UPDATED,
      description: `Entity ${entityId} removed from user: ${user.email}`,
      metadata: {
        email: user.email,
        entity_id: entityId,
        updated_by: req.user?.email || 'system',
      },
      req,
      status: 'success'
    });

    return this.sanitizeUser(user);
  };

  /**
   * Set primary entity
   */
  setPrimaryEntity = async (uuid, entityId, req) => {
    const user = await User.findOne({ uuid });
    if (!user) {
      throw new Error('USER_NOT_FOUND');
    }

    const entity = user.entities.find(e => e.entity_id === entityId);
    if (!entity) {
      throw new Error('ENTITY_NOT_FOUND');
    }

    // Remove primary flag from all entities
    user.entities.forEach(e => e.is_primary = false);
    
    // Set new primary
    entity.is_primary = true;
    user.primary_entity_id = entityId;

    user.updated_by = req.user?.uuid || null;
    await user.save();

    await logActivity({
      user_id: user._id,
      user_name: user.name,
      user_role: user.role,
      action: ActivityActions.USER_UPDATED,
      description: `Primary entity updated to ${entityId} for user: ${user.email}`,
      metadata: {
        email: user.email,
        primary_entity_id: entityId,
        updated_by: req.user?.email || 'system',
      },
      req,
      status: 'success'
    });

    return this.sanitizeUser(user);
  };

  /**
   * Delete user (soft delete - deactivate)
   */
  deleteUser = async (uuid, req) => {
    // Find user
    const user = await User.findOne({ uuid });
    if (!user) {
      throw new Error('USER_NOT_FOUND');
    }

    // Prevent deleting self
    if (req.user && req.user.uuid === uuid) {
      throw new Error('CANNOT_DELETE_SELF');
    }

    // Soft delete - set is_active to false
    user.is_active = false;
    user.updated_by = req.user?.uuid || null;
    await user.save();

    // Log user deletion
    await logActivity({
      user_id: user._id,
      user_name: user.name,
      user_role: user.role,
      action: ActivityActions.USER_DELETED,
      description: `User deactivated: ${user.email}`,
      metadata: {
        email: user.email,
        deleted_by: req.user?.email || 'system',
      },
      req,
      status: 'success'
    });

    return {
      message: 'User deactivated successfully',
      user: this.sanitizeUser(user)
    };
  };

  /**
   * Permanently delete user
   */
  permanentlyDeleteUser = async (uuid, req) => {
    // Find user
    const user = await User.findOne({ uuid });
    if (!user) {
      throw new Error('USER_NOT_FOUND');
    }

    // Prevent deleting self
    if (req.user && req.user.uuid === uuid) {
      throw new Error('CANNOT_DELETE_SELF');
    }

    await user.deleteOne();

    // Log permanent deletion
    await logActivity({
      user_id: user._id,
      user_name: user.name,
      user_role: user.role,
      action: ActivityActions.USER_DELETED,
      description: `User permanently deleted: ${user.email}`,
      metadata: {
        email: user.email,
        deleted_by: req.user?.email || 'system',
        permanent: true
      },
      req,
      status: 'success'
    });

    return { message: 'User permanently deleted successfully' };
  };

  /**
   * Toggle user active status
   */
  toggleUserActive = async (uuid, is_active, req) => {
    // Find user
    const user = await User.findOne({ uuid });
    if (!user) {
      throw new Error('USER_NOT_FOUND');
    }

    // Prevent deactivating self
    if (req.user && req.user.uuid === uuid && !is_active) {
      throw new Error('CANNOT_DEACTIVATE_SELF');
    }

    user.is_active = is_active;
    user.updated_by = req.user?.uuid || null;
    await user.save();

    // Log status change
    await logActivity({
      user_id: user._id,
      user_name: user.name,
      user_role: user.role,
      action: ActivityActions.USER_UPDATED,
      description: `User ${is_active ? 'activated' : 'deactivated'}: ${user.email}`,
      metadata: {
        email: user.email,
        is_active,
        updated_by: req.user?.email || 'system',
      },
      req,
      status: 'success'
    });

    return this.sanitizeUser(user);
  };

  /**
   * Update user password (admin)
   */
  updateUserPassword = async (uuid, new_password, confirm_password, req) => {
    if (!new_password || !confirm_password) {
      throw new Error('MISSING_FIELDS');
    }

    if (new_password !== confirm_password) {
      throw new Error('PASSWORD_MISMATCH');
    }

    if (new_password.length < 8) {
      throw new Error('PASSWORD_TOO_SHORT');
    }

    const user = await User.findOne({ uuid }).select('+password');
    if (!user) {
      throw new Error('USER_NOT_FOUND');
    }

    user.password = new_password;
    user.updated_by = req.user?.uuid || null;
    await user.save();

    await logActivity({
      user_id: user._id,
      user_name: user.name,
      user_role: user.role,
      action: ActivityActions.PASSWORD_CHANGED,
      description: `Password updated by admin for user: ${user.email}`,
      metadata: {
        email: user.email,
        updated_by: req.user?.email || 'system',
      },
      req,
      status: 'success'
    });

    return { message: 'Password updated successfully' };
  };

  /**
   * Sanitize user object
   */
  sanitizeUser(user) {
    const userObj = user.toObject ? user.toObject() : user;
    return {
      uuid: userObj.uuid,
      name: userObj.name,
      email: userObj.email,
      role: userObj.role,
      permissions: userObj.permissions || {},
      phone: userObj.phone,
      address: userObj.address,
      verified: userObj.verified,
      is_active: userObj.is_active,
      last_login: userObj.last_login,
      created_at: userObj.created_at,
      entities: userObj.entities || [],
      primary_entity_id: userObj.primary_entity_id,
    };
  }
}

module.exports = new UserService();