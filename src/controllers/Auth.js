// controllers/authController.js
const AuthService = require('../services/Auth');
const OTPService = require('../services/OTP');
const { User } = require("../models/User");
const { logActivity } = require("../utils/ActivityLogger");
const { ActivityActions } = require("../models/ActivityLog");
const { ApiResponse, ErrorResponse } = require('../utils/response'); 

class AuthController {
  /**
   * GET /api/auth/check-users
   * Check if any user exists in the database
   */
  checkUsers = async (req, res) => {
    try {
      const result = await AuthService.checkAnyUserExists();
      const response = new ApiResponse(
        { exists: result.exists, count: result.count },
        result.exists ? "Users exist in the system" : "No users found in the system"
      );
      return res.json(response);
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
      const admin = await AuthService.createAdminAccount(adminData, req);
      
      // Send OTP for verification
      await OTPService.sendOTP(admin.email, "verification", req);

      const response = new ApiResponse(
        admin,
        "Admin account created. Please verify your email."
      );
      return res.json(response);
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
        const error = new Error('MISSING_CREDENTIALS');
        error.status = 400;
        throw error;
      }

      // Attempt login
      const loginResult = await AuthService.login(email, password, req);

      // Check if user is verified
      const user = await User.findOne({ email: email.toLowerCase() });
      
      if (user && !user.verified) {
        // Send OTP for verification
        await OTPService.sendOTP(email, "verification", req);
        
        const response = new ApiResponse(
          user,
          "Please verify your email. A code has been sent."
        );
        return res.json(response);
      }

      const response = new ApiResponse(
        loginResult,
        "Login successful"
      );
      return res.json(response);
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
      const response = new ApiResponse(null, "Logged out successfully");
      return res.json(response);
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
      const error = new Error('MISSING_EMAIL');
      error.status = 400;
      throw error;
    }

    // 🔥 FIX: Add await here
    const result = await AuthService.forgotPassword(email, req);
    console.log("Forgot password result:", result);

    // 🔥 FIX: Only send OTP if user exists
    if (result.user) {
      await OTPService.sendOTP(email, "password_reset", req);
      console.log("OTP sent successfully for password reset");
    }

    const response = new ApiResponse(
      { email },
      "If an account exists with that email, you will receive password reset instructions."
    );
    return res.status(200).json(response);
    
  } catch (error) {
    console.error('Forgot password error:', error);
    return this.handleError(error, res);
  }
};
  /**
   * POST /api/auth/reset-password
   * Reset password using OTP
   * Payload: { otp, email, new_password, confirm_password }
   */
  resetPassword = async (req, res) => {
    try {
      const { otp, email, new_password, confirm_password } = req.body;

      // Validate required fields
      if (!otp || !email || !new_password || !confirm_password) {
        const error = new Error('MISSING_RESET_FIELDS');
        error.status = 400;
        throw error;
      }

      // Call AuthService.resetPassword with the new payload
      const result = await AuthService.resetPassword(
        otp,
        email,
        new_password,
        confirm_password,
        req
      );

      const response = new ApiResponse(
        result,
        "Password has been reset successfully"
      );
      return res.json(response);
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
      const { payload } = req.body;
      const {current_password, new_password, confirm_password } = payload;
      await AuthService.changePassword(
        req.user.uuid,
        current_password,
        new_password,
        confirm_password,
        req
      );

      const response = new ApiResponse(null, "Password changed successfully");
      return res.json(response);
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
      const response = new ApiResponse({ user }, "User fetched successfully");
      return res.json(response);
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
        const error = new Error('MISSING_EMAIL');
        error.status = 400;
        throw error;
      }

      // Validate type
      const validTypes = ["verification", "login", "password_reset"];
      if (!validTypes.includes(type)) {
        const error = new Error('INVALID_OTP_TYPE');
        error.status = 400;
        throw error;
      }

      // Check if user exists for password_reset
      if (type === "password_reset") {
        const user = await User.findOne({ email: email.toLowerCase() });
        if (!user) {
          const error = new Error('USER_NOT_FOUND');
          error.status = 404;
          throw error;
        }
      }

      // Send OTP
      const result = await OTPService.sendOTP(email, type, req);

      const response = new ApiResponse(
        {
          email,
          type,
          expires_at: result.expires_at,
          email_sent: result.email_sent,
        },
        `Verification code sent to ${email}`
      );
      return res.json(response);
    } catch (error) {
      console.error("Send OTP error:", error);
      if (error.status && error.message) {
        return this.handleError(error, res);
      }
      const errorResponse = new ErrorResponse("Failed to send verification code");
      return res.status(500).json(errorResponse);
    }
  };

  /**
   * Verify OTP
   */
verifyOTP = async (req, res) => {
  try {
    const { email, otp, type = "verification" } = req.body;

    console.log('🔍 Verifying OTP:', { email, otp, type }); // Add this

    if (!email || !otp) {
      const error = new Error('MISSING_OTP_FIELDS');
      error.status = 400;
      throw error;
    }

    const result = await OTPService.verifyOTP(email, otp, type);
    console.log('📝 OTP verification result:', result); // Add this

    if (!result.success) {
      const error = new Error(result.error || 'OTP_VERIFICATION_FAILED');
      error.status = 400;
      throw error;
    }

    // Get user
    const user = await User.findOne({ email: email.toLowerCase() })
      .select("-password -reset_password_token -reset_password_expires");

    console.log('👤 User found:', user ? user.email : 'Not found'); // Add this
    console.log('✅ User verified status:', user?.verified); // Add this

    if (!user) {
      const error = new Error('USER_NOT_FOUND');
      error.status = 404;
      throw error;
    }

      // Mark as verified if verification type
      if (type === "verification" && !user.verified) {
        user.verified = true;
        await user.save();
        console.log('✅ User marked as verified'); // Add this

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

      // For password_reset, set can_create_password flag on OTP
      // This is handled in OTPService.verifyOTP now

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
        auth_token: token,
      };

      const response = new ApiResponse(
        sanitizedUser,
        "OTP verified successfully"
      );
      return res.json(response);
    } catch (error) {
      console.error("Verify OTP error:", error);
      if (error.status && error.message) {
        return this.handleError(error, res);
      }
      const errorResponse = new ErrorResponse("Failed to verify OTP");
      return res.status(500).json(errorResponse);
    }
  };

  /**
   * Resend OTP
   */
  resendOTP = async (req, res) => {
    try {
      const { email, type = "verification" } = req.body;

      if (!email) {
        const error = new Error('MISSING_EMAIL');
        error.status = 400;
        throw error;
      }

      const result = await OTPService.resendOTP(email, type, req);

      if (!result.success) {
        const error = new Error(result.error || 'OTP_RESEND_FAILED');
        error.status = 400;
        throw error;
      }

      const response = new ApiResponse(
        {
          email,
          type,
          expires_at: result.expires_at,
        },
        "New verification code sent"
      );
      return res.json(response);
    } catch (error) {
      console.error("Resend OTP error:", error);
      if (error.status && error.message) {
        return this.handleError(error, res);
      }
      const errorResponse = new ErrorResponse("Failed to resend verification code");
      return res.status(500).json(errorResponse);
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
        message: 'Name, email, password, and confirm password are required'
      },
      'ADMIN_ALREADY_EXISTS': {
        status: 409,
        message: 'An admin account already exists'
      },
      'EMAIL_ALREADY_EXISTS': {
        status: 409,
        message: 'Email already registered'
      },
      'MISSING_CREDENTIALS': {
        status: 400,
        message: 'Email and password are required'
      },
      'INVALID_CREDENTIALS': {
        status: 401,
        message: 'Invalid email or password'
      },
      'ACCOUNT_DEACTIVATED': {
        status: 403,
        message: 'Account is deactivated. Please contact an administrator.'
      },
      'MISSING_EMAIL': {
        status: 400,
        message: 'Email is required'
      },
      'MISSING_FIELDS': {
        status: 400,
        message: 'All fields are required'
      },
      'MISSING_RESET_FIELDS': {
        status: 400,
        message: 'OTP, email, new password, and confirm password are required'
      },
      'PASSWORD_MISMATCH': {
        status: 400,
        message: 'Passwords do not match'
      },
      'PASSWORD_TOO_SHORT': {
        status: 400,
        message: 'Password must be at least 8 characters long'
      },
      'INVALID_TOKEN': {
        status: 400,
        message: 'Invalid or expired reset token'
      },
      'USER_NOT_FOUND': {
        status: 404,
        message: 'User not found'
      },
      'INVALID_PASSWORD': {
        status: 401,
        message: 'Current password is incorrect'
      },
      'MISSING_OTP_FIELDS': {
        status: 400,
        message: 'Email and OTP are required'
      },
      'INVALID_OTP_TYPE': {
        status: 400,
        message: 'Invalid OTP type'
      },
      'OTP_VERIFICATION_FAILED': {
        status: 400,
        message: 'Invalid or expired OTP'
      },
      'OTP_RESEND_FAILED': {
        status: 400,
        message: 'Failed to resend OTP'
      },
      'CANNOT_CREATE_PASSWORD': {
        status: 403,
        message: 'OTP not verified for password reset. Please verify first.'
      }
    };

    const errorConfig = errorMap[error.message] || {
      status: error.status || 500,
      message: error.message || 'Internal server error'
    };

    const errorResponse = new ErrorResponse(errorConfig.message);
    return res.status(errorConfig.status).json(errorResponse);
  }
}

module.exports = new AuthController();