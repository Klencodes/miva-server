// controllers/userController.js
const UserService = require("../services/User");
const { User } = require("../models/User")
class UserController {
  /**
   * GET /api/users
   * Get all users with pagination
   */
  getUsers = async (req, res) => {
    try {
      const { page = 1, limit = 10, search, role, is_active } = req.query;

      const result = await UserService.getUsers(
        { search, role, is_active },
        parseInt(page),
        parseInt(limit),
      );

      return res.json({
        message: "Users retrieved successfully",
        code: "USERS_FETCH_SUCCESS",
        success: true,
        results: result,
      });
    } catch (error) {
      return this.handleError(error, res);
    }
  };

  /**
   * GET /api/users/:uuid
   * Get user by UUID
   */
  getUser = async (req, res) => {
    try {
      const { uuid } = req.params;

      const user = await UserService.getUserByUuid(uuid);

      return res.json({
        message: "User retrieved successfully",
        code: "USER_FETCH_SUCCESS",
        success: true,
        results: user,
      });
    } catch (error) {
      return this.handleError(error, res);
    }
  };

  /**
   * POST /api/users
   * Create a new user
   */
  createUser = async (req, res) => {
    try {
      const userData = req.body;

      const user = await UserService.createUser(userData, req);

      return res.json({
        message: "User created successfully",
        code: "USER_CREATED_SUCCESS",
        success: true,
        results: user,
      });
    } catch (error) {
      return this.handleError(error, res);
    }
  };

  /**
   * PUT /api/users/:uuid
   * Update user
   */
  updateUser = async (req, res) => {
    try {
      const { uuid } = req.params;
      const updateData = req.body;

      const user = await UserService.updateUser(uuid, updateData, req);

      return res.json({
        message: "User updated successfully",
        code: "USER_UPDATED_SUCCESS",
        success: true,
        results: user ,
      });
    } catch (error) {
      return this.handleError(error, res);
    }
  };

  /**
   * PATCH /api/users/:uuid/active
   * Toggle user active status
   */
  toggleUserActive = async (req, res) => {
    try {
      const { uuid } = req.params;
      const { is_active } = req.body;

      if (is_active === undefined) {
        throw new Error("MISSING_ACTIVE_STATUS");
      }

      const user = await UserService.toggleUserActive(uuid, is_active, req);

      return res.json({
        message: is_active
          ? "User activated successfully"
          : "User deactivated successfully",
        code: "USER_STATUS_UPDATED",
        success: true,
        results: user,
      });
    } catch (error) {
      return this.handleError(error, res);
    }
  };

  /**
   * DELETE /api/users/:uuid
   * Soft delete user (deactivate)
   */
  deleteUser = async (req, res) => {
    try {
      const { uuid } = req.params;

      const result = await UserService.deleteUser(uuid, req);

      return res.json({
        message: result.message,
        code: "USER_DELETED_SUCCESS",
        success: true,
        results: { user: result.user },
      });
    } catch (error) {
      return this.handleError(error, res);
    }
  };

  /**
   * DELETE /api/users/:uuid/permanent
   * Permanently delete user
   */
  permanentDeleteUser = async (req, res) => {
    try {
      const { uuid } = req.params;

      const result = await UserService.permanentlyDeleteUser(uuid, req);

      return res.json({
        message: result.message,
        code: "USER_PERMANENTLY_DELETED",
        success: true,
      });
    } catch (error) {
      return this.handleError(error, res);
    }
  };

  /**
   * PATCH /api/users/:uuid/password
   * Update user password (admin only)
   */
  updateUserPassword = async (req, res) => {
    try {
      const { uuid } = req.params;
      const { new_password, confirm_password } = req.body;

      // Validate input
      if (!new_password || !confirm_password) {
        throw new Error("MISSING_FIELDS");
      }

      const result = await UserService.updateUserPassword(
        uuid,
        new_password,
        confirm_password,
        req,
      );

      return res.json({
        message: result.message,
        code: "PASSWORD_UPDATED_SUCCESS",
        success: true,
      });
    } catch (error) {
      return this.handleError(error, res);
    }
  };

  /**
   * POST /api/users/:uuid/entities
   * Assign entity to user
   */
  assignEntityToUser = async (req, res) => {
    try {
      const { uuid } = req.params;
      const { entity_id, role = "member", is_primary = false } = req.body;

      if (!entity_id) {
        throw new Error("ENTITY_ID_REQUIRED");
      }

      const user = await UserService.assignEntityToUser(
        uuid,
        entity_id,
        role,
        is_primary,
        req,
      );

      return res.json({
        message: "Entity assigned successfully",
        code: "ENTITY_ASSIGNED_SUCCESS",
        success: true,
        results: user,
      });
    } catch (error) {
      return this.handleError(error, res);
    }
  };

  /**
   * POST /api/users/:uuid/entities/batch
   * Assign multiple entities to user
{
  "entities": [
    {
      "entity_id": "entity-uuid-1",
      "role": "admin",
      "is_primary": true
    },
    {
      "entity_id": "entity-uuid-2",
      "role": "sales"
    }
  ]
}
   */
  assignMultipleEntitiesToUser = async (req, res) => {
    try {
      const { uuid } = req.params;
      const { entities } = req.body;

      if (!entities || !Array.isArray(entities) || entities.length === 0) {
        throw new Error("ENTITIES_ARRAY_REQUIRED");
      }

      const user = await UserService.assignMultipleEntitiesToUser(
        uuid,
        entities,
        req,
      );

      return res.json({
        message: "Entities assigned successfully",
        code: "ENTITIES_ASSIGNED_SUCCESS",
        success: true,
        results: user,
      });
    } catch (error) {
      return this.handleError(error, res);
    }
  };

  /**
   * DELETE /api/users/:uuid/entities/:entity_id
   * Remove entity from user
   */
  removeEntityFromUser = async (req, res) => {
    try {
      const { uuid, entity_id } = req.params;

      const user = await UserService.removeEntityFromUser(uuid, entity_id, req);

      return res.json({
        message: "Entity removed successfully",
        code: "ENTITY_REMOVED_SUCCESS",
        success: true,
        results: user,
      });
    } catch (error) {
      return this.handleError(error, res);
    }
  };

  /**
   * PATCH /api/users/:uuid/entities/:entity_id/primary
   * Set primary entity
   */
  setPrimaryEntity = async (req, res) => {
    try {
      const { uuid, entity_id } = req.params;

      const user = await UserService.setPrimaryEntity(uuid, entity_id, req);

      return res.json({
        message: "Primary entity updated successfully",
        code: "PRIMARY_ENTITY_UPDATED",
        success: true,
        results: user,
      });
    } catch (error) {
      return this.handleError(error, res);
    }
  };

  /**
   * GET /api/users/me/entities
   * Get current user's entities
   */
 getMyEntities = async (req, res) => {
  try {
    if (!req.user) throw new Error("UNAUTHORIZED");

    const user = await User.findOne({ uuid: req.user.uuid })
      .select("entities primary_entity_id");

    if (!user) throw new Error("USER_NOT_FOUND");

    // Populate with actual entity data
    const Entity = require('../models/Entity');
    const entityIds = user.entities.map(e => e.entity_id);
    const entityDocs = await Entity.find({ 
      uuid: { $in: entityIds }, 
      is_active: true 
    });

    const entities = entityDocs.map(doc => {
      const assignment = user.entities.find(e => e.entity_id === doc.uuid);
      return {
        uuid: doc.uuid,
        name: doc.name,
        email: doc.email,
        phone: doc.phone,
        country: doc.country,
        branch: doc.branch,
        is_active: doc.is_active,
        entity_role: assignment?.role || 'member',
        is_primary: assignment?.is_primary || false,
        joined_at: assignment?.joined_at,
      };
    });

    return res.json({
      message: "User entities retrieved successfully",
      code: "USER_ENTITIES_FETCH_SUCCESS",
      success: true,
      results: { entities, primary_entity_id: user.primary_entity_id }
    });
  } catch (error) {
    return this.handleError(error, res);
  }
};
  

  /**
   * GET /api/users/me/permissions
   * Get current user's permissions
   */
  getMyPermissions = async (req, res) => {
    try {
      if (!req.user) {
        throw new Error("UNAUTHORIZED");
      }

      const user = await UserService.getUserByUuid(req.user.uuid);

      return res.json({
        message: "User permissions retrieved successfully",
        code: "USER_PERMISSIONS_FETCH_SUCCESS",
        success: true,
        results: {
          role: user.role,
          permissions: user.permissions || {},
          permissions_array: user.permissions
            ? Object.keys(user.permissions).filter(
                (key) => user.permissions[key],
              )
            : [],
        },
      });
    } catch (error) {
      return this.handleError(error, res);
    }
  };

  /**
   * Handle errors
   */
  handleError(error, res) {
    console.error("User Controller Error:", error);

    const errorMap = {
      MISSING_REQUIRED_FIELDS: {
        status: 400,
        message: "Name, email, password, and confirm password are required",
        code: "MISSING_REQUIRED_FIELDS",
      },
      PASSWORD_MISMATCH: {
        status: 400,
        message: "Passwords do not match",
        code: "PASSWORD_MISMATCH",
      },
      PASSWORD_TOO_SHORT: {
        status: 400,
        message: "Password must be at least 8 characters long",
        code: "PASSWORD_TOO_SHORT",
      },
      EMAIL_ALREADY_EXISTS: {
        status: 409,
        message: "Email already registered",
        code: "EMAIL_ALREADY_EXISTS",
      },
      USER_NOT_FOUND: {
        status: 404,
        message: "User not found",
        code: "USER_NOT_FOUND",
      },
      INVALID_ROLE: {
        status: 400,
        message: "Invalid role specified",
        code: "INVALID_ROLE",
      },
      MISSING_ACTIVE_STATUS: {
        status: 400,
        message: "Active status (is_active) is required",
        code: "MISSING_ACTIVE_STATUS",
      },
      CANNOT_DELETE_SELF: {
        status: 403,
        message: "You cannot delete your own account",
        code: "CANNOT_DELETE_SELF",
      },
      CANNOT_DEACTIVATE_SELF: {
        status: 403,
        message: "You cannot deactivate your own account",
        code: "CANNOT_DEACTIVATE_SELF",
      },
      ENTITY_ID_REQUIRED: {
        status: 400,
        message: "Entity ID is required",
        code: "ENTITY_ID_REQUIRED",
      },
      ENTITIES_ARRAY_REQUIRED: {
        status: 400,
        message: "Entities array is required with at least one entity",
        code: "ENTITIES_ARRAY_REQUIRED",
      },
      ENTITY_NOT_FOUND: {
        status: 404,
        message: "Entity not found",
        code: "ENTITY_NOT_FOUND",
      },
      ENTITY_ALREADY_ASSIGNED: {
        status: 409,
        message: "Entity is already assigned to this user",
        code: "ENTITY_ALREADY_ASSIGNED",
      },
      MISSING_FIELDS: {
        status: 400,
        message: "New password and confirm password are required",
        code: "MISSING_FIELDS",
      },
      UNAUTHORIZED: {
        status: 401,
        message: "Authentication required",
        code: "UNAUTHORIZED",
      },
      FORBIDDEN: {
        status: 403,
        message: "You do not have permission to perform this action",
        code: "FORBIDDEN",
      },
      INVALID_ENTITY_ID: {
        status: 400,
        message: "Invalid entity ID format",
        code: "INVALID_ENTITY_ID",
      },
      PERMISSION_DENIED: {
        status: 403,
        message: "Insufficient permissions",
        code: "PERMISSION_DENIED",
      },
      VALIDATION_ERROR: {
        status: 400,
        message: "Validation error occurred",
        code: "VALIDATION_ERROR",
      },
      DATABASE_ERROR: {
        status: 500,
        message: "Database operation failed",
        code: "DATABASE_ERROR",
      },
    };

    // Handle mongoose validation errors
    if (error.name === "ValidationError") {
      const messages = Object.values(error.errors).map((err) => err.message);
      return res.status(400).json({
        message: "Validation error: " + messages.join(", "),
        code: "VALIDATION_ERROR",
        success: false,
        errors: messages,
      });
    }

    // Handle duplicate key errors (MongoDB)
    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern)[0];
      return res.status(409).json({
        message: `${field.charAt(0).toUpperCase() + field.slice(1)} already exists`,
        code: "DUPLICATE_FIELD",
        success: false,
        field: field,
      });
    }

    const errorConfig = errorMap[error.message] || {
      status: 500,
      message: error.message || "Internal server error",
      code: "SERVER_ERROR",
    };

    return res.status(errorConfig.status).json({
      message: errorConfig.message,
      code: errorConfig.code,
      success: false,
    });
  }
}

module.exports = new UserController();
