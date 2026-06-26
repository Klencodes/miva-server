const mongoose = require("mongoose");
const uuid = require('uuid');
const { v4: uuidv4 } = uuid;

const SupplierSchema = new mongoose.Schema(
  {
    uuid: {
      type: String,
      unique: true,
      default: uuidv4,
      immutable: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      index: true,
    },
    phone_code: {
      type: String,
      required: true,
      default: '+233',
    },
    phone_number: {
      type: String,
      required: true,
      trim: true,
    },
    secondary_code: {
      type: String,
      default: '+233',
    },
    secondary_number: {
      type: String,
      trim: true,
    },
    address: {
      type: String,
      required: true,
      trim: true,
    },
    city: {
      type: String,
      trim: true,
    },
    state: {
      type: String,
      trim: true,
    },
    country: {
      type: String,
      trim: true,
      default: 'Ghana',
    },
    zip_code: {
      type: String,
      trim: true,
    },
    website: {
      type: String,
      trim: true,
    },
    tax_id: {
      type: String,
      trim: true,
      index: true,
      sparse: true,
    },
    registration_number: {
      type: String,
      trim: true,
      index: true,
      sparse: true,
    },
    notes: {
      type: String,
      trim: true,
    },
    status: {
      type: String,
      enum: ['active', 'inactive'],
      default: 'active',
      index: true,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    created_by: { type: String },
    updated_by: { type: String },
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Virtual for full phone number
SupplierSchema.virtual('full_phone_number').get(function() {
  return `${this.phone_code}${this.phone_number}`;
});

// Virtual for full secondary phone number
SupplierSchema.virtual('full_secondary_number').get(function() {
  if (this.secondary_number) {
    return `${this.secondary_code}${this.secondary_number}`;
  }
  return null;
});

// Virtual for full address
SupplierSchema.virtual('full_address').get(function() {
  const parts = [this.address];
  if (this.city) parts.push(this.city);
  if (this.state) parts.push(this.state);
  if (this.country) parts.push(this.country);
  if (this.zip_code) parts.push(this.zip_code);
  return parts.join(', ');
});

// Indexes
SupplierSchema.index({ entity_id: 1, name: 1 });
SupplierSchema.index({ entity_id: 1, email: 1 });
SupplierSchema.index({ entity_id: 1, status: 1 });
SupplierSchema.index({ entity_id: 1, 'metadata.$**': 1 });

// Pre-save middleware
SupplierSchema.pre('save', function(next) {
  if (this.name) {
    this.name = this.name.trim();
  }
  if (this.email) {
    this.email = this.email.trim().toLowerCase();
  }
  if (this.phone_number) {
    this.phone_number = this.phone_number.trim();
  }
  if (this.secondary_number) {
    this.secondary_number = this.secondary_number.trim();
  }
  next();
});

// Methods
SupplierSchema.methods.toSafeObject = function() {
  const obj = this.toObject();
  delete obj.__v;
  return obj;
};

// Static methods
SupplierSchema.statics.getStats = async function(entityId) {
  return this.aggregate([
    { $match: { entity_id: entityId } },
    {
      $group: {
        _id: null,
        total_suppliers: { $sum: 1 },
        active_suppliers: {
          $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] }
        },
        inactive_suppliers: {
          $sum: { $cond: [{ $eq: ['$status', 'inactive'] }, 1, 0] }
        },
      },
    },
  ]);
};

const Supplier = mongoose.model("Supplier", SupplierSchema);

module.exports = Supplier;