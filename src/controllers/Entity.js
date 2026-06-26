// controllers/entityController.js
const EntityService = require("../services/Entity");
const { ApiResponse, ErrorResponse } = require('../utils/response');
const Pagination = require('../utils/pagination');

class EntityController {
  /**
   * GET /api/entities
   * Get all entities with pagination
   */
  getEntities = async (req, res) => {
    try {
      const {
        page = 1,
        limit = 10,
        search,
        country,
        is_active,
        branch,
      } = req.query;

      const result = await EntityService.getEntities(
        { search, country, is_active, branch },
        parseInt(page),
        parseInt(limit),
      );

      // Generate pagination links
      const baseUrl = `${req.protocol}://${req.get('host')}${req.baseUrl}${req.path}`;
      const pagination = Pagination.generatePaginationResponse(
        result.results,
        result.count,
        parseInt(page),
        parseInt(limit),
        baseUrl,
        req.query
      );

      const response = new ApiResponse(
        result.results,
        "Entities retrieved successfully",
        pagination
      );
      return res.json(response);
    } catch (error) {
      return this.handleError(error, res);
    }
  };

  /**
   * GET /api/entities/:uuid
   * Get entity by UUID
   */
  getEntity = async (req, res) => {
    try {
      const { uuid } = req.params;
      const entity = await EntityService.getEntityByUuid(uuid);

      const response = new ApiResponse(entity, "Entity retrieved successfully");
      return res.json(response);
    } catch (error) {
      return this.handleError(error, res);
    }
  };

  /**
   * GET /api/entities/email/:email
   * Get entity by email
   */
  getEntityByEmail = async (req, res) => {
    try {
      const { email } = req.params;
      const entity = await EntityService.getEntityByEmail(email);

      const response = new ApiResponse(entity, "Entity retrieved successfully");
      return res.json(response);
    } catch (error) {
      return this.handleError(error, res);
    }
  };

  /**
   * POST /api/entities
   * Create a new entity
   */
  createEntity = async (req, res) => {
    try {
      const entityData = req.body;
      const entity = await EntityService.createEntity(entityData, req);

      const response = new ApiResponse(entity, "Entity created successfully");
      return res.json(response);
    } catch (error) {
      return this.handleError(error, res);
    }
  };

  /**
   * PUT /api/entities/:uuid
   * Update entity
   */
 // controllers/entityController.js

updateEntity = async (req, res) => {
  try {
    const { uuid } = req.params;
    const updateData = req.body;
    
    const result = await EntityService.updateEntity(uuid, updateData, req);
    
    
    const response = new ApiResponse(result, 'Entity updated successfully');
    return res.json(response);
  } catch (error) {
    console.error('❌ Update entity error:', error);
    return this.handleError(error, res);
  }
};

  /**
   * PATCH /api/entities/:uuid/active
   * Toggle entity active status
   */
  toggleEntityActive = async (req, res) => {
    try {
      const { uuid } = req.params;
      const { is_active } = req.body;

      if (is_active === undefined) {
        const error = new Error("MISSING_ACTIVE_STATUS");
        error.status = 400;
        throw error;
      }

      const entity = await EntityService.toggleEntityActive(uuid, is_active, req);

      const message = is_active ? "Entity activated successfully" : "Entity deactivated successfully";
      const response = new ApiResponse(entity, message);
      return res.json(response);
    } catch (error) {
      return this.handleError(error, res);
    }
  };

  /**
   * DELETE /api/entities/:uuid
   * Soft delete entity (deactivate)
   */
  deleteEntity = async (req, res) => {
    try {
      const { uuid } = req.params;
      const result = await EntityService.deleteEntity(uuid, req);

      const response = new ApiResponse({ entity: result.entity }, result.message);
      return res.json(response);
    } catch (error) {
      return this.handleError(error, res);
    }
  };

  /**
   * DELETE /api/entities/:uuid/permanent
   * Permanently delete entity
   */
  permanentDeleteEntity = async (req, res) => {
    try {
      const { uuid } = req.params;
      const result = await EntityService.permanentlyDeleteEntity(uuid, req);

      const response = new ApiResponse(null, result.message);
      return res.json(response);
    } catch (error) {
      return this.handleError(error, res);
    }
  };

  /**
   * GET /api/entities/:uuid/users
   * Get users by entity
   */
  getEntityUsers = async (req, res) => {
    try {
      const { uuid } = req.params;
      const { page = 1, limit = 10 } = req.query;

      const result = await EntityService.getEntityUsers(
        uuid,
        parseInt(page),
        parseInt(limit),
      );

      // Generate pagination links
      const baseUrl = `${req.protocol}://${req.get('host')}${req.baseUrl}${req.path}`;
      const pagination = Pagination.generatePaginationResponse(
        result.users,
        result.count,
        parseInt(page),
        parseInt(limit),
        baseUrl,
        req.query
      );

      const response = new ApiResponse(
        result.users,
        "Entity users retrieved successfully",
        pagination
      );
      return res.json(response);
    } catch (error) {
      return this.handleError(error, res);
    }
  };

  /**
   * GET /api/entities/stats
   * Get entity statistics
   */
  getEntityStats = async (req, res) => {
    try {
      const stats = await EntityService.getEntityStats();

      const response = new ApiResponse(stats, "Entity statistics retrieved successfully");
      return res.json(response);
    } catch (error) {
      return this.handleError(error, res);
    }
  };

  /**
   * Handle errors
   */
  handleError(error, res) {
    console.error("Entity Controller Error:", error);

    const errorMap = {
      MISSING_REQUIRED_FIELDS: { status: 400, message: "Name and email are required" },
      EMAIL_ALREADY_EXISTS: { status: 409, message: "Email already registered" },
      REGISTRATION_NUMBER_ALREADY_EXISTS: { status: 409, message: "Registration number already exists" },
      TAX_ID_ALREADY_EXISTS: { status: 409, message: "Tax ID already exists" },
      ENTITY_NOT_FOUND: { status: 404, message: "Entity not found" },
      ENTITY_HAS_USERS: { status: 409, message: "Cannot delete entity with assigned users" },
      MISSING_ACTIVE_STATUS: { status: 400, message: "Active status (is_active) is required" },
      INVALID_ENTITY_ID: { status: 400, message: "Invalid entity ID format" },
    };

    // Check for MongoDB duplicate key error
    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern)[0];
      const errorResponse = new ErrorResponse(
        `${field.charAt(0).toUpperCase() + field.slice(1)} already exists`
      );
      return res.status(409).json(errorResponse);
    }

    const errorConfig = errorMap[error.message] || {
      status: error.status || 500,
      message: error.message || "Internal server error"
    };

    const errorResponse = new ErrorResponse(errorConfig.message);
    return res.status(errorConfig.status).json(errorResponse);
  }
}

module.exports = new EntityController();