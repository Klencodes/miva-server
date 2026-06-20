const mongoose = require('mongoose');

const ActivityActions = {
  // Auth
  LOGIN: 'LOGIN',
  LOGOUT: 'LOGOUT',
  SESSION_EXPIRED: 'SESSION_EXPIRED',
  PASSWORD_CHANGED: 'PASSWORD_CHANGED',
  EMAIL_VERIFIED: 'EMAIL_VERIFIED',

  // Inventory
  INVENTORY_CREATED: 'INVENTORY_CREATED',
  INVENTORY_UPDATED: 'INVENTORY_UPDATED',
  INVENTORY_DELETED: 'INVENTORY_DELETED',

  // Invoice
  INVOICE_CREATED: 'INVOICE_CREATED',
  INVOICE_UPDATED: 'INVOICE_UPDATED',
  INVOICE_DELETED: 'INVOICE_DELETED',

  // Assembly
  ASSEMBLY_BUILT: 'ASSEMBLY_BUILT',

  // User management
  USER_CREATED: 'USER_CREATED',
  USER_UPDATED: 'USER_UPDATED',
  USER_DEACTIVATED: 'USER_DEACTIVATED',
  USER_ROLE_CHANGED: 'USER_ROLE_CHANGED',

  // Settings
  SETTINGS_UPDATED: 'SETTINGS_UPDATED',

  ENTITY_CREATED: 'entity_created',
  ENTITY_UPDATED: 'entity_updated',
  ENTITY_DELETED: 'entity_deleted',
};

const ActivityLogSchema = new mongoose.Schema(
  {
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    user_name: { type: String }, // denormalized for fast reads
    user_role: { type: String },
    action: {
      type: String,
      enum: Object.values(ActivityActions),
      required: true,
      index: true,
    },
    resource: { type: String }, // e.g. 'Invoice', 'User', 'InventoryItem'
    resource_id: { type: String }, // the affected document's id
    description: { type: String }, // human-readable summary
    metadata: { type: mongoose.Schema.Types.Mixed }, // any extra structured data
    ip_address: { type: String },
    user_agent: { type: String },
    status: { type: String, enum: ['success', 'failure'], default: 'success' },
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: false },
    // TTL: auto-delete logs older than 1 year
    expireAfterSeconds: 365 * 24 * 60 * 60,
  }
);

// Compound index for dashboard queries: "all actions by user in date range"
ActivityLogSchema.index({ user_id: 1, created_at: -1 });
ActivityLogSchema.index({ action: 1, created_at: -1 });

const ActivityLog = mongoose.model('ActivityLog', ActivityLogSchema);

module.exports = { ActivityLog, ActivityActions };