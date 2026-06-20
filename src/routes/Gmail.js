const express = require('express');
const router = express.Router();
const gmailController = require('../controllers/Gmail');

// ==================== AUTH ROUTES ====================
router.get('/auth-url', gmailController.getAuthUrl);
router.get('/callback', gmailController.handleCallback);
router.get('/check-connection', gmailController.checkConnection);
router.post('/disconnect', gmailController.disconnectGmail);

// ==================== MESSAGE ROUTES ====================
router.get('/messages', gmailController.getMessages);
router.get('/messages/:messageId', gmailController.getMessageById);
router.post('/send', gmailController.sendMessage);
router.post('/reply', gmailController.replyToMessage);

// ==================== MODIFICATION ROUTES ====================
router.put('/modify', gmailController.modifyMessage);
router.post('/batch-modify', gmailController.batchModifyMessages);

// ==================== PROFILE ROUTES ====================
router.get('/profile', gmailController.getUserProfile);

module.exports = router;