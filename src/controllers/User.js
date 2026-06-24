const UserService = require("../services/User");
const { User } = require("../models/User");
const Entity = require("../models/Entity");
const { ApiResponse, ErrorResponse } = require("../utils/response");
const Pagination = require("../utils/pagination");

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

      // Generate pagination links
      const baseUrl = `${req.protocol}://${req.get("host")}${req.baseUrl}${req.path}`;
      const pagination = Pagination.generatePaginationResponse(
        result.users,
        result.count,
        parseInt(page),
        parseInt(limit),
        baseUrl,
        req.query,
      );

      const response = new ApiResponse(
        result.users,
        "Users retrieved successfully",
        pagination,
      );
      return res.json(response);
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

      const response = new ApiResponse(user, "User retrieved successfully");
      return res.json(response);
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

      const response = new ApiResponse(user, "User created successfully");
      return res.json(response);
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

      const response = new ApiResponse(user, "User updated successfully");
      return res.json(response);
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
        const error = new Error("MISSING_ACTIVE_STATUS");
        error.status = 400;
        throw error;
      }

      const user = await UserService.toggleUserActive(uuid, is_active, req);

      const message = is_active
        ? "User activated successfully"
        : "User deactivated successfully";
      const response = new ApiResponse(user, message);
      return res.json(response);
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

      const response = new ApiResponse({ user: result.user }, result.message);
      return res.json(response);
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

      const response = new ApiResponse(null, result.message);
      return res.json(response);
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

      if (!new_password || !confirm_password) {
        const error = new Error("MISSING_FIELDS");
        error.status = 400;
        throw error;
      }

      const result = await UserService.updateUserPassword(
        uuid,
        new_password,
        confirm_password,
        req,
      );

      const response = new ApiResponse(null, result.message);
      return res.json(response);
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
        const error = new Error("ENTITY_ID_REQUIRED");
        error.status = 400;
        throw error;
      }

      const user = await UserService.assignEntityToUser(
        uuid,
        entity_id,
        role,
        is_primary,
        req,
      );

      const response = new ApiResponse(user, "Entity assigned successfully");
      return res.json(response);
    } catch (error) {
      return this.handleError(error, res);
    }
  };

  /**
   * POST /api/users/:uuid/entities/batch
   * Assign multiple entities to user
   */
  assignMultipleEntitiesToUser = async (req, res) => {
    try {
      const { uuid } = req.params;
      const { entities } = req.body;

      if (!entities || !Array.isArray(entities) || entities.length === 0) {
        const error = new Error("ENTITIES_ARRAY_REQUIRED");
        error.status = 400;
        throw error;
      }

      const user = await UserService.assignMultipleEntitiesToUser(
        uuid,
        entities,
        req,
      );

      const response = new ApiResponse(user, "Entities assigned successfully");
      return res.json(response);
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

      const response = new ApiResponse(user, "Entity removed successfully");
      return res.json(response);
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

      const response = new ApiResponse(
        user,
        "Primary entity updated successfully",
      );
      return res.json(response);
    } catch (error) {
      return this.handleError(error, res);
    }
  };

  /**
   * GET /api/users/me/entities
   * Get current user's entities with pagination
   */
  getMyEntities = async (req, res) => {
    try {
      if (!req.user) {
        const error = new Error("UNAUTHORIZED");
        error.status = 401;
        throw error;
      }

      const { page = 1, limit = 10, search } = req.query;

      const user = await User.findOne({ uuid: req.user.uuid }).select(
        "entities primary_entity_id",
      );

      if (!user) {
        const error = new Error("USER_NOT_FOUND");
        error.status = 404;
        throw error;
      }

      // Get all entity IDs from user
      const entityIds = user.entities.map((e) => e.entity_id);

      if (entityIds.length === 0) {
        const response = new ApiResponse(
          [],
          "User entities retrieved successfully",
        );
        // Add primary_entity_id to the response
        response.primary_entity_id = user.primary_entity_id;
        response.count = 0;
        response.totalPages = 0;
        response.currentPage = parseInt(page);
        return res.json(response);
      }

      // Build query for entities
      const query = {
        uuid: { $in: entityIds },
        is_active: true,
      };

      // Apply search filter if provided
      if (search) {
        query.$or = [
          { name: { $regex: search, $options: "i" } },
          { email: { $regex: search, $options: "i" } },
          { branch: { $regex: search, $options: "i" } },
          { city: { $regex: search, $options: "i" } },
          { country: { $regex: search, $options: "i" } },
        ];
      }

      const skip = (parseInt(page) - 1) * parseInt(limit);

      // Get paginated entities
      const [entityDocs, total] = await Promise.all([
        Entity.find(query).sort({ name: 1 }).skip(skip).limit(parseInt(limit)),
        Entity.countDocuments(query),
      ]);

      // Format entities with user-specific data
      const entities = entityDocs.map((doc) => {
        const assignment = user.entities.find((e) => e.entity_id === doc.uuid);
        return {
          uuid: doc.uuid,
          name: doc.name,
          email: doc.email,
          phone: doc.phone,
          branch: doc.branch,
          website: doc.website,
          address: doc.address,
          city: doc.city,
          state: doc.state,
          country: doc.country,
          zip_code: doc.zip_code,
          registration_number: doc.registration_number,
          tax_id: doc.tax_id,
          currency: doc.currency,
          metadata: doc.metadata,
          is_active: doc.is_active,
          entity_role: assignment?.role || "member",
          is_primary: assignment?.is_primary || false,
          joined_at: assignment?.joined_at,
        };
      });

      // Generate pagination links
      const baseUrl = `${req.protocol}://${req.get("host")}${req.baseUrl}${req.path}`;
      const pagination = Pagination.generatePaginationResponse(
        entities,
        total,
        parseInt(page),
        parseInt(limit),
        baseUrl,
        req.query,
      );

      // Create response with entities as results
      const response = new ApiResponse(
        entities,
        "User entities retrieved successfully",
        pagination,
      );

      // Add primary_entity_id to the response at root level
      response.primary_entity_id = user.primary_entity_id;

      return res.json(response);
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
        const error = new Error("UNAUTHORIZED");
        error.status = 401;
        throw error;
      }

      const user = await UserService.getUserByUuid(req.user.uuid);

      const response = new ApiResponse(
        {
          role: user.role,
          permissions: user.permissions || {},
          permissions_array: user.permissions
            ? Object.keys(user.permissions).filter(
                (key) => user.permissions[key],
              )
            : [],
        },
        "User permissions retrieved successfully",
      );
      return res.json(response);
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
      },
      PASSWORD_MISMATCH: { status: 400, message: "Passwords do not match" },
      PASSWORD_TOO_SHORT: {
        status: 400,
        message: "Password must be at least 8 characters long",
      },
      EMAIL_ALREADY_EXISTS: {
        status: 409,
        message: "Email already registered",
      },
      USER_NOT_FOUND: { status: 404, message: "User not found" },
      INVALID_ROLE: { status: 400, message: "Invalid role specified" },
      MISSING_ACTIVE_STATUS: {
        status: 400,
        message: "Active status (is_active) is required",
      },
      CANNOT_DELETE_SELF: {
        status: 403,
        message: "You cannot delete your own account",
      },
      CANNOT_DEACTIVATE_SELF: {
        status: 403,
        message: "You cannot deactivate your own account",
      },
      ENTITY_ID_REQUIRED: { status: 400, message: "Entity ID is required" },
      ENTITIES_ARRAY_REQUIRED: {
        status: 400,
        message: "Entities array is required with at least one entity",
      },
      ENTITY_NOT_FOUND: { status: 404, message: "Entity not found" },
      ENTITY_ALREADY_ASSIGNED: {
        status: 409,
        message: "Entity is already assigned to this user",
      },
      MISSING_FIELDS: {
        status: 400,
        message: "New password and confirm password are required",
      },
      UNAUTHORIZED: { status: 401, message: "Authentication required" },
      FORBIDDEN: {
        status: 403,
        message: "You do not have permission to perform this action",
      },
      INVALID_ENTITY_ID: { status: 400, message: "Invalid entity ID format" },
      PERMISSION_DENIED: { status: 403, message: "Insufficient permissions" },
      VALIDATION_ERROR: { status: 400, message: "Validation error occurred" },
      DATABASE_ERROR: { status: 500, message: "Database operation failed" },
    };

    // Handle mongoose validation errors
    if (error.name === "ValidationError") {
      const messages = Object.values(error.errors).map((err) => err.message);
      const errorResponse = new ErrorResponse(
        "Validation error: " + messages.join(", "),
      );
      return res.status(400).json(errorResponse);
    }

    // Handle duplicate key errors (MongoDB)
    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern)[0];
      const errorResponse = new ErrorResponse(
        `${field.charAt(0).toUpperCase() + field.slice(1)} already exists`,
      );
      return res.status(409).json(errorResponse);
    }

    const errorConfig = errorMap[error.message] || {
      status: error.status || 500,
      message: error.message || "Internal server error",
    };

    const errorResponse = new ErrorResponse(errorConfig.message);
    return res.status(errorConfig.status).json(errorResponse);
  }
}

module.exports = new UserController();
