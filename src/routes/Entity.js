// routes/entityRoutes.js
const express = require('express');
const router = express.Router();
const EntityController = require('../controllers/Entity');
const { authenticate, authorize } = require('../middleware/auth');

// All routes require authentication
router.use(authenticate);

// Entity CRUD operations
router.get('/', authorize('admin', 'super_admin'), EntityController.getEntities);
router.post('/', authorize('admin', 'super_admin'), EntityController.createEntity);

router.get('/stats', authorize('admin', 'super_admin', 'viewer'), EntityController.getEntityStats);
router.get('/:uuid', authorize('admin', 'super_admin', 'viewer'), EntityController.getEntity);
router.get('/email/:email', authorize('admin', 'super_admin'), EntityController.getEntityByEmail);
router.put('/:uuid', authorize('admin', 'super_admin'), EntityController.updateEntity);
router.patch('/:uuid/active', authorize('admin', 'super_admin'), EntityController.toggleEntityActive);
router.delete('/:uuid', authorize('admin', 'super_admin'), EntityController.deleteEntity);
router.delete('/:uuid/permanent', authorize('super_admin', 'admin'), EntityController.permanentDeleteEntity);

// Entity user management
router.get('/:uuid/users', authorize('admin', 'super_admin'), EntityController.getEntityUsers);

module.exports = router;