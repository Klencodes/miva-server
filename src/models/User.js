// models/User.js
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const { randomUUID } = require('crypto');


const UserRoles = {
  SALES: "sales",
  VIEWER: "viewer",
  ADMIN: "admin",
  SUPER_ADMIN: "super_admin",
  TECHNICIAN: "technician",
};

// Permissions Schema (Object approach)
const PermissionsSchema = new mongoose.Schema({
  can_edit_inventory: { type: Boolean, default: false },
  can_delete_inventory: { type: Boolean, default: false },
  can_create_invoice: { type: Boolean, default: false },
  can_edit_invoice: { type: Boolean, default: false },
  can_delete_invoice: { type: Boolean, default: false },
  can_build_assembly: { type: Boolean, default: false },
  can_manage_users: { type: Boolean, default: false },
  can_view_reports: { type: Boolean, default: false },
  can_manage_settings: { type: Boolean, default: false },
  can_view_activity_logs: { type: Boolean, default: false },
}, { _id: false });

// Default permissions per role
const defaultPermissionsForRole = (role) => {
  const base = {
    can_edit_inventory: false,
    can_delete_inventory: false,
    can_create_invoice: false,
    can_edit_invoice: false,
    can_delete_invoice: false,
    can_build_assembly: false,
    can_manage_users: false,
    can_view_reports: false,
    can_manage_settings: false,
    can_view_activity_logs: false,
  };

  switch (role) {
    case UserRoles.SUPER_ADMIN:
      return Object.fromEntries(Object.keys(base).map((k) => [k, true]));
    case UserRoles.ADMIN:
      return {
        ...base,
        can_edit_inventory: true,
        can_create_invoice: true,
        can_edit_invoice: true,
        can_build_assembly: true,
        can_view_reports: true,
        can_view_activity_logs: true,
        can_manage_users: true,
      };
    case UserRoles.SALES:
      return { 
        ...base, 
        can_create_invoice: true, 
        can_view_reports: true,
        can_edit_invoice: true,
      };
    case UserRoles.TECHNICIAN:
      return { 
        ...base, 
        can_edit_inventory: true, 
        can_build_assembly: true 
      };
    case UserRoles.VIEWER:
    default:
      return { ...base, can_view_reports: true };
  }
};

const UserSchema = new mongoose.Schema(
  {
    uuid: {
      type: String,
      unique: true,
      default: randomUUID(),
      immutable: true,
    },
    first_name: { type: String, required: true, trim: true },
    last_name: { type: String, required: true, trim: true },
    name: { type: String, required: true, trim: true },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, "Invalid email format"],
    },
    password: { type: String, required: true, select: false, minlength: 8 },
    phone: { type: String, trim: true },
    address: { type: String, trim: true },
    role: {
      type: String,
      enum: Object.values(UserRoles),
      default: UserRoles.VIEWER,
    },
    is_active: { type: Boolean, default: true },
    verified: { type: Boolean, default: false },
    permissions: { type: PermissionsSchema, default: () => ({}) },
    last_login: { type: String },
    reset_password_token: { type: String, select: false },
    reset_password_expires: { type: Date, select: false },
    created_by: { type: String },
    updated_by: { type: String },
    
    // Entity/Organization associations - User can have multiple entities
    entities: [{
      entity_id: { type: String, required: true },
      name: { type: String, required: true },
      branch: { type: String, required: true },
      role: { 
        type: String, 
        enum: ['super_admin', 'admin', 'sales', 'viewer', 'technician'],
        default: 'sales'
      },
      joined_at: { type: Date, default: Date.now },
      is_primary: { type: Boolean, default: false }
    }],
    primary_entity_id: { type: String }, // UUID of primary entity
  },
  { timestamps: { createdAt: "created_at", updatedAt: "updated_at" } }
);

// Hash password before save
UserSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

// Set default permissions when role is assigned for the first time
UserSchema.pre("save", function (next) {
  if (this.isNew || this.isModified("role")) {
    const existing = this.permissions?.toObject?.() || this.permissions || {};
    const hasAnyPermission = Object.values(existing).some(Boolean);
    if (!hasAnyPermission) {
      this.permissions = defaultPermissionsForRole(this.role);
    }
  }
  next();
});

// Set primary entity if not set and has entities
UserSchema.pre("save", function (next) {
  if (this.entities && this.entities.length > 0 && !this.primary_entity_id) {
    const primaryEntity = this.entities.find(e => e.is_primary);
    if (primaryEntity) {
      this.primary_entity_id = primaryEntity.entity_id;
    } else {
      // Set first entity as primary
      this.entities[0].is_primary = true;
      this.primary_entity_id = this.entities[0].entity_id;
    }
  }
  next();
});

UserSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

UserSchema.methods.toSafeObject = function () {
  const obj = this.toObject();
  delete obj.password;
  delete obj.reset_password_token;
  delete obj.reset_password_expires;
  return obj;
};

UserSchema.methods.hasPermission = function(permission) {
  return this.permissions?.[permission] === true;
};

UserSchema.methods.hasAnyPermission = function(permissionList) {
  return permissionList.some(p => this.permissions?.[p] === true);
};

UserSchema.methods.hasAllPermissions = function(permissionList) {
  return permissionList.every(p => this.permissions?.[p] === true);
};

// Convert permissions object to array for JWT/frontend
UserSchema.methods.getPermissionsArray = function() {
  const perms = [];
  const permObj = this.permissions?.toObject?.() || this.permissions || {};
  Object.keys(permObj).forEach(key => {
    if (permObj[key] === true) {
      perms.push(key);
    }
  });
  return perms;
};

// Check if user has entity access
UserSchema.methods.hasEntityAccess = function(entityId) {
  if (this.role === UserRoles.SUPER_ADMIN) return true;
  return this.entities.some(e => e.entity_id === entityId);
};

// Get user's entities
UserSchema.methods.getEntityIds = function() {
  return this.entities.map(e => e.entity_id);
};

// Indexes
UserSchema.index({ uuid: 1 });
UserSchema.index({ email: 1 });
UserSchema.index({ role: 1, is_active: 1 });
UserSchema.index({ 'entities.entity_id': 1 });

const User = mongoose.model("User", UserSchema);

module.exports = { 
  User, 
  UserRoles, 
  PermissionsSchema,
  defaultPermissionsForRole 
};