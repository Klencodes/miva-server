// routes/authRoutes.js
const express = require('express');
const router = express.Router();
const AuthController = require('../controllers/Auth');
const { authenticate } = require('../middleware/auth');

/**
 * GET /api/auth/check-users
 * Check if any user exists in the database (Public)
 */
router.get('/check-users', AuthController.checkUsers);

/**
 * POST /api/auth/create-admin
 * Create admin account (Public - only if no admin exists)
 */
router.post('/create-admin', AuthController.createAdmin);

/**
 * POST /api/auth/login
 * Authenticate user and return JWT token
 */
router.post('/login', AuthController.login);

/**
 * POST /api/auth/logout
 * Logout user (client-side token discard)
 */
router.post('/logout', authenticate, AuthController.logout);

/**
 * POST /api/auth/forgot-password
 * Request password reset
 */
router.post('/forgot-password', AuthController.forgotPassword);

/**
 * POST /api/auth/reset-password
 * Reset password using token
 */
router.post('/reset-password', AuthController.resetPassword);

/**
 * POST /api/auth/change-password
 * Change password (authenticated user)
 */
router.post('/change-password', authenticate, AuthController.changePassword);

/**
 * GET /api/auth/me
 * Get current authenticated user
 */
router.get('/me', authenticate, AuthController.getCurrentUser);

/**
 * POST /api/auth/send-otp
 * Send OTP code to user
 */
router.post("/send-otp", AuthController.sendOTP);

/**
 * POST /api/auth/verify-otp
 * Verify OTP code from user
 */
router.post("/verify-otp", AuthController.verifyOTP);

/**
 * POST /api/auth/resend-otp
 * Resend OTP code to user
 */
router.post("/resend-otp", AuthController.resendOTP);

module.exports = router;