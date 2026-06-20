// routes/userRoutes.js
const express = require('express');
const router = express.Router();
const UserController = require('../controllers/User');
const { authenticate, authorize } = require('../middleware/auth');

// Protected routes - all require authentication
router.use(authenticate);

// Current user routes
router.get('/me/entities', UserController.getMyEntities);
router.get('/me/permissions', UserController.getMyPermissions);

// User management routes
router.get('/', authorize('admin', 'super_admin'), UserController.getUsers);
router.get('/:uuid', authorize('admin', 'super_admin'), UserController.getUser);
router.post('/', authorize('admin', 'super_admin'), UserController.createUser);
router.put('/:uuid', authorize('admin', 'super_admin'), UserController.updateUser);
router.patch('/:uuid/active', authorize('admin', 'super_admin'), UserController.toggleUserActive);
router.patch('/:uuid/password', authorize('admin', 'super_admin'), UserController.updateUserPassword);
router.delete('/:uuid', authorize('admin', 'super_admin'), UserController.deleteUser);
router.delete('/:uuid/permanent', authorize('super_admin'), UserController.permanentDeleteUser);

// Entity management routes - Admin can assign one or more entities
router.post('/:uuid/entities', authorize('admin', 'super_admin'), UserController.assignEntityToUser);
router.post('/:uuid/entities/batch', authorize('admin', 'super_admin'), UserController.assignMultipleEntitiesToUser);
router.delete('/:uuid/entities/:entity_id', authorize('admin', 'super_admin'), UserController.removeEntityFromUser);
router.patch('/:uuid/entities/:entity_id/primary', authorize('admin', 'super_admin'), UserController.setPrimaryEntity);

module.exports = router;