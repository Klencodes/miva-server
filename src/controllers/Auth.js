// controllers/authController.js
const AuthService = require('../services/Auth');
const OTPService = require('../services/OTP');
const { User } = require("../models/User");
const { logActivity } = require("../utils/ActivityLogger");
const { ActivityActions } = require("../models/ActivityLog");
class AuthController {
  /**
   * GET /api/auth/check-users
   * Check if any user exists in the database
   */
  checkUsers = async (req, res) => {
    try {
      const result = await AuthService.checkAnyUserExists();

      return res.json({
        message: result.exists ? "Users exist in the system" : "No users found in the system",
        code: "USER_CHECK_SUCCESS",
        success: true,
        results: {
          exists: result.exists,
          count: result.count
        }
      });
    } catch (error) {
      return this.handleError(error, res);
    }
  };

  /**
   * POST /api/auth/create-admin
   * Create admin account (only if no admin exists)
   */
  createAdmin = async (req, res) => {
    try {
      const adminData = req.body;

      // Create admin
      const admin = await AuthService.createAdminAccount(adminData, req);

      // Send OTP for verification
      await OTPService.sendOTP(admin.email, "verification", req);

      return res.json({
        message: "Admin account created. Please verify your email.",
        code: "ADMIN_CREATED",
        success: true,
        results: {
          ...admin,
        },
      });
    } catch (error) {
      return this.handleError(error, res);
    }
  };

  /**
   * POST /api/auth/login
   * Authenticate user and return JWT token
   */
    login = async (req, res) => {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(400).json({
          message: "Email and password are required",
          code: "MISSING_CREDENTIALS",
          success: false,
        });
      }

      // Attempt login
      const loginResult = await AuthService.login(email, password, req);

      // Check if user is verified
      const user = await User.findOne({ email: email.toLowerCase() });
      
      if (user && !user.verified) {
        // Send OTP for verification
        await OTPService.sendOTP(email, "verification", req);

        return res.json({
          message: "Please verify your email. A code has been sent.",
          code: "EMAIL_NOT_VERIFIED",
          success: true,
          results: {
            ...user
          },
        });
      }

      return res.json({
        message: "Login successful",
        code: "LOGIN_SUCCESS",
        success: true,
        results: loginResult,
      });
    } catch (error) {
      return this.handleError(error, res);
    }
  };

  /**
   * POST /api/auth/logout
   * Logout user (client-side token discard)
   */
  logout = async (req, res) => {
    try {
      await AuthService.logout(req.user, req);

      return res.json({
        message: "Logged out successfully",
        code: "LOGOUT_SUCCESS",
        success: true
      });
    } catch (error) {
      return this.handleError(error, res);
    }
  };

  /**
   * POST /api/auth/forgot-password
   * Request password reset
   */
  forgotPassword = async (req, res) => {
    try {
      const { email } = req.body;

      if (!email) {
        return res.status(400).json({
          message: "Email is required",
          code: "MISSING_EMAIL",
          success: false,
        });
      }

      // Check if user exists
      const user = await User.findOne({ email: email.toLowerCase() });
      if (!user) {
        return res.status(404).json({
          message: "User not found",
          code: "USER_NOT_FOUND",
          success: false,
        });
      }

      // Send OTP for password reset
      await OTPService.sendOTP(email, "password_reset", req);

      return res.json({
        message: "Password reset code sent to your email",
        code: "PASSWORD_RESET_OTP_SENT",
        success: true,
        results: {
          email,
        },
      });
    } catch (error) {
      return this.handleError(error, res);
    }
  };

  /**
   * POST /api/auth/reset-password
   * Reset password using token
   */
  resetPassword = async (req, res) => {
    try {
      const { token, new_password, confirm_password } = req.body;

      const result = await AuthService.resetPassword(
        token,
        new_password,
        confirm_password,
        req
      );

      return res.json({
        message: "Password has been reset successfully",
        code: "RESET_PASSWORD_SUCCESS",
        success: true,
        results: result
      });
    } catch (error) {
      return this.handleError(error, res);
    }
  };

  /**
   * POST /api/auth/change-password
   * Change password (authenticated user)
   */
  changePassword = async (req, res) => {
    try {
      const { currentPassword, new_password, confirm_password } = req.body;

      await AuthService.changePassword(
        req.user.uuid,
        currentPassword,
        new_password,
        confirm_password,
        req
      );

      return res.json({
        message: "Password changed successfully",
        code: "CHANGE_PASSWORD_SUCCESS",
        success: true
      });
    } catch (error) {
      return this.handleError(error, res);
    }
  };

  /**
   * GET /api/auth/me
   * Get current authenticated user
   */
  getCurrentUser = async (req, res) => {
    try {
      const user = await AuthService.getCurrentUser(req.user.uuid);

      return res.json({
        message: "User fetched successfully",
        code: "USER_FETCH_SUCCESS",
        success: true,
        results: { user }
      });
    } catch (error) {
      return this.handleError(error, res);
    }
  };



  // __________________________________________________________________________________________
  // OTP CONTROLLERS
  // __________________________________________________________________________________________
  /**
   * POST /api/otp/send
   * Send OTP for various purposes
   */
  sendOTP = async (req, res) => {
    try {
      const { email, type = "verification" } = req.body;

      if (!email) {
        return res.status(400).json({
          message: "Email is required",
          code: "MISSING_EMAIL",
          success: false,
        });
      }

      // Validate type
      const validTypes = ["verification", "login", "password_reset"];
      if (!validTypes.includes(type)) {
        return res.status(400).json({
          message: "Invalid OTP type",
          code: "INVALID_OTP_TYPE",
          success: false,
        });
      }

      // Check if user exists for password_reset
      if (type === "password_reset") {
        const user = await User.findOne({ email: email.toLowerCase() });
        if (!user) {
          return res.status(404).json({
            message: "User not found with this email",
            code: "USER_NOT_FOUND",
            success: false,
          });
        }
      }

      // Send OTP
      const result = await OTPService.sendOTP(email, type, req);

      return res.json({
        message: `Verification code sent to ${email}`,
        code: "OTP_SENT",
        success: true,
        results: {
          email,
          type,
          expires_at: result.expires_at,
          email_sent: result.email_sent,
        },
      });
    } catch (error) {
      console.error("Send OTP error:", error);
      return res.status(500).json({
        message: "Failed to send verification code",
        code: "OTP_SEND_FAILED",
        success: false,
      });
    }
  };

  /**
   * Verify OTP
   */
verifyOTP = async (req, res) => {
    try {
      const { email, otp, type = "verification" } = req.body;

      if (!email || !otp) {
        return res.status(400).json({
          message: "Email and OTP are required",
          code: "MISSING_OTP_FIELDS",
          success: false,
        });
      }

      const result = await OTPService.verifyOTP(email, otp, type);

      if (!result.success) {
        return res.status(400).json({
          message: result.message,
          code: result.error,
          success: false,
        });
      }

      // Get user
      const user = await User.findOne({ email: email.toLowerCase() })
        .select("-password -reset_password_token -reset_password_expires");

      if (!user) {
        return res.status(404).json({
          message: "User not found",
          code: "USER_NOT_FOUND",
          success: false,
        });
      }

      // Mark as verified if verification type
      if (type === "verification" && !user.verified) {
        user.verified = true;
        await user.save();

        await logActivity({
          user_id: user._id,
          user_name: user.name,
          user_role: user.role,
          action: ActivityActions.EMAIL_VERIFIED,
          description: `Email verified for user: ${user.email}`,
          metadata: { email: user.email },
          req,
          status: "success",
        });
      }

      // Generate token
      const token = AuthService.generateToken(user);

      // Sanitize user
      const sanitizedUser = {
        uuid: user.uuid,
        name: user.name,
        email: user.email,
        role: user.role,
        permissions: user.permissions,
        phone: user.phone,
        address: user.address,
        verified: user.verified,
        is_active: user.is_active,
        last_login: user.last_login,
        entities: user.entities || [],
        primary_entity_id: user.primary_entity_id,
        created_at: user.created_at,
        updated_at: user.updated_at,
      };

      return res.json({
        message: "OTP verified successfully",
        code: "OTP_VERIFIED",
        success: true,
        results: {
          ...sanitizedUser,
          auth_token: token,
          verified: true,
        },
      });
    } catch (error) {
      console.error("Verify OTP error:", error);
      return res.status(500).json({
        message: "Failed to verify OTP",
        code: "OTP_VERIFY_FAILED",
        success: false,
      });
    }
  };

  /**
   * Resend OTP
   */
  resendOTP = async (req, res) => {
    try {
      const { email, type = "verification" } = req.body;

      if (!email) {
        return res.status(400).json({
          message: "Email is required",
          code: "MISSING_EMAIL",
          success: false,
        });
      }

      const result = await OTPService.resendOTP(email, type, req);

      if (!result.success) {
        return res.status(400).json({
          message: result.message,
          code: result.error,
          success: false,
          wait_seconds: result.wait_seconds,
        });
      }

      return res.json({
        message: "New verification code sent",
        code: "OTP_RESENT",
        success: true,
        results: {
          email,
          type,
          expires_at: result.expires_at,
        },
      });
    } catch (error) {
      console.error("Resend OTP error:", error);
      return res.status(500).json({
        message: "Failed to resend verification code",
        code: "OTP_RESEND_FAILED",
        success: false,
      });
    }
  };



  /**
   * Handle errors and return appropriate response
   */
  handleError(error, res) {
    console.error('Auth error:', error);

    const errorMap = {
      'MISSING_ADMIN_FIELDS': {
        status: 400,
        message: 'Name, email, password, and confirm password are required',
        code: 'MISSING_ADMIN_FIELDS'
      },
      'ADMIN_ALREADY_EXISTS': {
        status: 409,
        message: 'An admin account already exists',
        code: 'ADMIN_ALREADY_EXISTS'
      },
      'EMAIL_ALREADY_EXISTS': {
        status: 409,
        message: 'Email already registered',
        code: 'EMAIL_ALREADY_EXISTS'
      },
      'MISSING_CREDENTIALS': {
        status: 400,
        message: 'Email and password are required',
        code: 'MISSING_CREDENTIALS'
      },
      'INVALID_CREDENTIALS': {
        status: 401,
        message: 'Invalid email or password',
        code: 'INVALID_CREDENTIALS'
      },
      'ACCOUNT_DEACTIVATED': {
        status: 403,
        message: 'Account is deactivated. Please contact an administrator.',
        code: 'ACCOUNT_DEACTIVATED'
      },
      'MISSING_EMAIL': {
        status: 400,
        message: 'Email is required',
        code: 'MISSING_EMAIL'
      },
      'MISSING_FIELDS': {
        status: 400,
        message: 'All fields are required',
        code: 'MISSING_FIELDS'
      },
      'PASSWORD_MISMATCH': {
        status: 400,
        message: 'Passwords do not match',
        code: 'PASSWORD_MISMATCH'
      },
      'PASSWORD_TOO_SHORT': {
        status: 400,
        message: 'Password must be at least 8 characters long',
        code: 'PASSWORD_TOO_SHORT'
      },
      'INVALID_TOKEN': {
        status: 400,
        message: 'Invalid or expired reset token',
        code: 'INVALID_TOKEN'
      },
      'USER_NOT_FOUND': {
        status: 404,
        message: 'User not found',
        code: 'USER_NOT_FOUND'
      },
      'INVALID_PASSWORD': {
        status: 401,
        message: 'Current password is incorrect',
        code: 'INVALID_PASSWORD'
      }
    };

    const errorConfig = errorMap[error.message] || {
      status: 500,
      message: 'Internal server error',
      code: 'SERVER_ERROR'
    };

    return res.status(errorConfig.status).json({
      message: errorConfig.message,
      code: errorConfig.code,
      success: false
    });
  }
}

module.exports = new AuthController();