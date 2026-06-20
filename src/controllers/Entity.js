// controllers/entityController.js
const EntityService = require("../services/Entity");

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

      return res.json({
        message: "Entities retrieved successfully",
        code: "ENTITIES_FETCH_SUCCESS",
        success: true,
        results: result,
      });
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

      return res.json({
        message: "Entity retrieved successfully",
        code: "ENTITY_FETCH_SUCCESS",
        success: true,
        results: entity,
      });
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

      return res.json({
        message: "Entity retrieved successfully",
        code: "ENTITY_FETCH_SUCCESS",
        success: true,
        results: entity,
      });
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

      return res.json({
        message: "Entity created successfully",
        code: "ENTITY_CREATED_SUCCESS",
        success: true,
        results: entity,
      });
    } catch (error) {
      return this.handleError(error, res);
    }
  };

  /**
   * PUT /api/entities/:uuid
   * Update entity
   */
  updateEntity = async (req, res) => {
    try {
      const { uuid } = req.params;
      const updateData = req.body;

      const entity = await EntityService.updateEntity(uuid, updateData, req);

      return res.json({
        message: "Entity updated successfully",
        code: "ENTITY_UPDATED_SUCCESS",
        success: true,
        results: entity,
      });
    } catch (error) {
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
        throw new Error("MISSING_ACTIVE_STATUS");
      }

      const entity = await EntityService.toggleEntityActive(
        uuid,
        is_active,
        req,
      );

      return res.json({
        message: is_active
          ? "Entity activated successfully"
          : "Entity deactivated successfully",
        code: "ENTITY_STATUS_UPDATED",
        success: true,
        results: entity,
      });
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

      return res.json({
        message: result.message,
        code: "ENTITY_DELETED_SUCCESS",
        success: true,
        results: { entity: result.entity },
      });
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

      return res.json({
        message: result.message,
        code: "ENTITY_PERMANENTLY_DELETED",
        success: true,
      });
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

      return res.json({
        message: "Entity users retrieved successfully",
        code: "ENTITY_USERS_FETCH_SUCCESS",
        success: true,
        results: result,
      });
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

      return res.json({
        message: "Entity statistics retrieved successfully",
        code: "ENTITY_STATS_FETCH_SUCCESS",
        success: true,
        results: stats,
      });
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
      MISSING_REQUIRED_FIELDS: {
        status: 400,
        message: "Name and email are required",
        code: "MISSING_REQUIRED_FIELDS",
      },
      EMAIL_ALREADY_EXISTS: {
        status: 409,
        message: "Email already registered",
        code: "EMAIL_ALREADY_EXISTS",
      },
      REGISTRATION_NUMBER_ALREADY_EXISTS: {
        status: 409,
        message: "Registration number already exists",
        code: "REGISTRATION_NUMBER_ALREADY_EXISTS",
      },
      TAX_ID_ALREADY_EXISTS: {
        status: 409,
        message: "Tax ID already exists",
        code: "TAX_ID_ALREADY_EXISTS",
      },
      ENTITY_NOT_FOUND: {
        status: 404,
        message: "Entity not found",
        code: "ENTITY_NOT_FOUND",
      },
      ENTITY_HAS_USERS: {
        status: 409,
        message: "Cannot delete entity with assigned users",
        code: "ENTITY_HAS_USERS",
      },
      MISSING_ACTIVE_STATUS: {
        status: 400,
        message: "Active status (is_active) is required",
        code: "MISSING_ACTIVE_STATUS",
      },
      INVALID_ENTITY_ID: {
        status: 400,
        message: "Invalid entity ID format",
        code: "INVALID_ENTITY_ID",
      },
    };

    const errorConfig = errorMap[error.message] || {
      status: 500,
      message: "Internal server error",
      code: "SERVER_ERROR",
    };

    return res.status(errorConfig.status).json({
      message: errorConfig.message,
      code: errorConfig.code,
      success: false,
    });
  }
}

module.exports = new EntityController();
