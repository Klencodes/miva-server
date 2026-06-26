// services/authService.js
const { User } = require("../models/User");
const OTP = require("../models/OTP");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const { logActivity, ActivityActions } = require("../utils/activityLogger");

class AuthService {
  /**
   * Check if any user exists in the database
   */
  checkAnyUserExists = async () => {
    const count = await User.countDocuments();
    return { exists: count > 0, count };
  };

  /**
   * Create admin account (only if no admin exists)
   */
  createAdminAccount = async (adminData, req) => {
    const {
      first_name,
      last_name,
      email,
      password,
      confirm_password,
      phone,
      address,
    } = adminData;

    // Validate input
    if (!first_name || !last_name || !email || !password || !confirm_password) {
      throw new Error("MISSING_ADMIN_FIELDS");
    }

    if (password !== confirm_password) {
      throw new Error("PASSWORD_MISMATCH");
    }

    if (password.length < 8) {
      throw new Error("PASSWORD_TOO_SHORT");
    }

    // Check if any admin already exists
    const existingAdmin = await User.findOne({ role: "admin" });
    if (existingAdmin) {
      throw new Error("ADMIN_ALREADY_EXISTS");
    }

    // Check if email already exists
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      throw new Error("EMAIL_ALREADY_EXISTS");
    }

    // Create admin user with all permissions
    const admin = new User({
      first_name,
      last_name,
      name: `${first_name} ${last_name}`,
      email: email.toLowerCase(),
      password,
      phone: phone || "",
      address: address || "",
      role: "admin",
      permissions: {
        can_edit_inventory: true,
        can_delete_inventory: true,
        can_create_invoice: true,
        can_edit_invoice: true,
        can_delete_invoice: true,
        can_build_assembly: true,
        can_manage_users: true,
        can_view_reports: true,
        can_manage_settings: true,
        can_view_activity_logs: true,
      },
      is_active: true,
      verified: true,
    });

    await admin.save();

    // Log admin creation
    await logActivity({
      user_id: admin._id,
      user_name: admin.name,
      user_role: admin.role,
      action: ActivityActions.USER_CREATED,
      description: `Admin account created: ${admin.email}`,
      metadata: {
        email: admin.email,
        role: "admin",
        action: "admin_created",
      },
      req,
      status: "success",
    });

    // Generate JWT token
    const token = this.generateToken(admin);

    return {
      auth_token: token,
      ...this.sanitizeUser(admin),
    };
  };

  /**
   * Login user
   */
  login = async (email, password, req) => {
    // Validate input
    if (!email || !password) {
      throw new Error("MISSING_CREDENTIALS");
    }

    // Find user with password
    const user = await User.findOne({ email: email.toLowerCase() }).select(
      "+password",
    );

    if (!user) {
      // Log failed login attempt
      await logActivity({
        user_id: null,
        user_name: "Unknown",
        user_role: "unknown",
        action: ActivityActions.LOGIN,
        description: `Failed login attempt for email: ${email}`,
        metadata: { email, reason: "User not found" },
        req,
        status: "failure",
      });

      throw new Error("INVALID_CREDENTIALS");
    }

    // Check if user is active
    if (!user.is_active) {
      await logActivity({
        user_id: user._id,
        user_name: user.name,
        user_role: user.role,
        action: ActivityActions.LOGIN,
        description: `Deactivated user attempted login: ${user.email}`,
        metadata: { email: user.email },
        req,
        status: "failure",
      });

      throw new Error("ACCOUNT_DEACTIVATED");
    }

    // Check password
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      await logActivity({
        user_id: user._id,
        user_name: user.name,
        user_role: user.role,
        action: ActivityActions.LOGIN,
        description: `Failed login attempt for user: ${user.email}`,
        metadata: { email: user.email },
        req,
        status: "failure",
      });

      throw new Error("INVALID_CREDENTIALS");
    }

    // Update last login
    user.last_login = new Date();
    await user.save({ validateBeforeSave: false });

    // Generate JWT token with entities
    const token = this.generateToken(user);

    // Log successful login
    await logActivity({
      user_id: user._id,
      user_name: user.name,
      user_role: user.role,
      action: ActivityActions.LOGIN,
      description: `User logged in: ${user.email}`,
      metadata: { email: user.email },
      req,
      status: "success",
    });

    // Get sanitized user data with entity information
    const sanitizedUser = this.sanitizeUser(user);

    // Extract entity information
    const userEntities = user.entities || [];
    const entityIds = userEntities.map((e) => e.entity_id);
    const hasEntities = userEntities.length > 0;
    const primaryEntityId = user.primary_entity_id || 
      (hasEntities ? userEntities[0].entity_id : null);

    // Determine redirect path based on role and entities
    let redirectPath = "/dashboard";

    if (user.role === "super_admin" || user.role === "admin") {
      redirectPath = "/dashboard";
    } else {
      // Regular user (sales, viewer, technician, etc.)
      redirectPath = hasEntities ? "/dashboard" : "/contact-admin";
    }

    // Check if user needs to setup entity
    const needsEntitySetup = !hasEntities && 
      user.role !== "super_admin" && 
      user.role !== "admin";

    // Return full user data with entities
    return {
      auth_token: token,
      ...sanitizedUser,
      // Entity information
      entities: userEntities,
      entity_ids: entityIds,
      primary_entity_id: primaryEntityId,
      has_entities: hasEntities,
      // Routing information for frontend
      redirect_path: redirectPath,
      needs_entity_setup: needsEntitySetup,
      is_super_admin: user.role === "super_admin",
      is_admin: user.role === "admin",
    };
  };

  /**
   * Logout user
   */
  logout = async (user, req) => {
    // Log the logout
    await logActivity({
      user_id: user.id,
      user_name: user.name,
      user_role: user.role,
      action: ActivityActions.LOGOUT,
      description: `User logged out: ${user.email}`,
      metadata: { email: user.email },
      req,
      status: "success",
    });

    return { success: true };
  };


/**
 * Request password reset - uses OTP instead of token
 */
forgotPassword = async (email, req) => {
  if (!email) {
    throw new Error("MISSING_EMAIL");
  }

  // Find user
  const user = await User.findOne({ email: email.toLowerCase() });
  
  // If user doesn't exist or is inactive, still return success for security
  if (!user || !user.is_active) {
    // Return null user to indicate no valid user found
    return {
      success: true, // Always return success for security
      user: null,
      message: "If an account exists with that email, you will receive password reset instructions.",
    };
  }
  
  // Log password reset request
  await logActivity({
    user_id: user._id,
    user_name: user.name,
    user_role: user.role,
    action: ActivityActions.PASSWORD_CHANGED,
    description: `Password reset requested for user: ${user.email}`,
    metadata: { email: user.email, action: "reset_requested" },
    req,
    status: "success",
  });

  return {
    success: true,
    user: user,
    message: "If an account exists with that email, you will receive password reset instructions.",
  };
};

  /**
   * Reset password using OTP
   * Payload: { otp, email, new_password, confirm_password }
   */
  resetPassword = async (otp, email, new_password, confirm_password, req) => {
    // Validate input
    if (!otp || !email || !new_password || !confirm_password) {
      throw new Error("MISSING_RESET_FIELDS");
    }

    if (new_password !== confirm_password) {
      throw new Error("PASSWORD_MISMATCH");
    }

    if (new_password.length < 8) {
      throw new Error("PASSWORD_TOO_SHORT");
    }

    // Find the OTP record
    const otpRecord = await OTP.findOne({
      email: email.toLowerCase(),
      otp: otp,
      type: "password_reset",
      expires_at: { $gt: new Date() },
    });

    if (!otpRecord) {
      throw new Error("INVALID_TOKEN");
    }

    // Check if OTP has been verified for password reset
    if (!otpRecord.can_create_password) {
      throw new Error("CANNOT_CREATE_PASSWORD");
    }

    // Find user
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      throw new Error("USER_NOT_FOUND");
    }

    // Update password
    user.password = new_password;
    await user.save();

    // Delete the OTP record after successful password reset
    await OTP.deleteOne({ _id: otpRecord._id });

    // Log password change
    await logActivity({
      user_id: user._id,
      user_name: user.name,
      user_role: user.role,
      action: ActivityActions.PASSWORD_CHANGED,
      description: `Password reset completed for user: ${user.email}`,
      metadata: { email: user.email, action: "reset_completed" },
      req,
      status: "success",
    });

    // Generate new JWT for auto-login
    const jwtToken = this.generateToken(user);

    return {
      token: jwtToken,
      user: this.sanitizeUser(user),
    };
  };

  /**
   * Change password (authenticated user)
   */
  changePassword = async (
    userId,
    current_password,
    new_password,
    confirm_password,
    req,
  ) => {
    // Validate input
    if (!current_password || !new_password || !confirm_password) {
      throw new Error("MISSING_FIELDS");
    }

    if (new_password !== confirm_password) {
      throw new Error("PASSWORD_MISMATCH");
    }

    if (new_password.length < 8) {
      throw new Error("PASSWORD_TOO_SHORT");
    }

    // Get user with password
    const user = await User.findOne({ uuid: userId }).select("+password");

    if (!user) {
      throw new Error("USER_NOT_FOUND");
    }

    // Verify current password
    const isPasswordValid = await user.comparePassword(current_password);
    if (!isPasswordValid) {
      throw new Error("INVALID_PASSWORD");
    }

    // Update password
    user.password = new_password;
    await user.save();

    // Log password change
    await logActivity({
      user_id: user._id,
      user_name: user.name,
      user_role: user.role,
      action: ActivityActions.PASSWORD_CHANGED,
      description: `Password changed for user: ${user.email}`,
      metadata: { email: user.email, action: "password_changed" },
      req,
      status: "success",
    });

    return { success: true };
  };

  /**
   * Get current authenticated user
   */
  getCurrentUser = async (userId) => {
    const user = await User.findOne({ uuid: userId });
    if (!user) {
      throw new Error("USER_NOT_FOUND");
    }
    return this.sanitizeUser(user);
  };

  /**
   * Generate JWT token with user information including entities
   */
  generateToken(user) {
    // Extract entity IDs from user's entities array
    const entityIds = user.entities?.map(e => e.entity_id) || [];
    
    // Get permissions object
    const permObj = user.permissions?.toObject?.() || user.permissions || {};

    return jwt.sign(
      {
        id: user.uuid,
        uuid: user.uuid,
        email: user.email,
        name: user.name,
        role: user.role,
        permissions: permObj,
        entities: entityIds,
        primary_entity_id: user.primary_entity_id || null,
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || "7d" },
    );
  }

  /**
   * Sanitize user object (remove sensitive data and format entities)
   */
  sanitizeUser = (user) => {
    const userObj = user.toObject ? user.toObject() : user;
    
    // Remove sensitive data
    delete userObj.password;
    delete userObj.__v;
    delete userObj.reset_password_token;
    delete userObj.reset_password_expires;
    
    // Format entities
    let formattedEntities = [];
    if (userObj.entities && Array.isArray(userObj.entities)) {
      formattedEntities = userObj.entities.map(e => ({
        entity_id: e.entity_id,
        role: e.role || userObj.role,
        name: e.name,
        branch: e.branch,
        is_primary: e.is_primary || false,
        joined_at: e.joined_at,
        metadata: e.metadata || {},
      }));
    }
    
    return {
      uuid: userObj.uuid,
      name: userObj.name,
      first_name: userObj.first_name,
      last_name: userObj.last_name,
      email: userObj.email,
      role: userObj.role,
      permissions: userObj.permissions || {},
      phone: userObj.phone || "",
      address: userObj.address || "",
      verified: userObj.verified || false,
      is_active: userObj.is_active !== undefined ? userObj.is_active : true,
      last_login: userObj.last_login || null,
      created_at: userObj.created_at,
      updated_at: userObj.updated_at,
      entities: formattedEntities,
      primary_entity_id: userObj.primary_entity_id || null,
    };
  };
}

module.exports = new AuthService();