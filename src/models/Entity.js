// models/Entity.js
const mongoose = require("mongoose");
const { v4: uuidv4 } = require("uuid");

const EntitySchema = new mongoose.Schema(
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
    },
    branch: {
      type: String,
      trim: true,
      default: "Head Quarters",
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, "Invalid email format"],
    },
    phone: {
      type: String,
      trim: true,
    },
    website: {
      type: String,
      trim: true,
    },
    address: {
      type: String,
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
    },
    zip_code: {
      type: String,
      trim: true,
    },
    registration_number: {
      type: String,
      trim: true,
      unique: false,
      sparse: true,
    },
    tax_id: {
      type: String,
      trim: true,
      unique: false,
      sparse: true,
    },
    currency: {
      type: String,
      default: "GHS",
      trim: true,
    },
    is_active: {
      type: Boolean,
      default: true,
    },
    metadata: {
      type: Map,
      of: mongoose.Schema.Types.Mixed,
      default: {},
    },
    created_by: {
      type: String,
    },
    updated_by: {
      type: String,
    },
  },
  { timestamps: { createdAt: "created_at", updatedAt: "updated_at" } },
);

// Indexes
EntitySchema.index({ uuid: 1 });
EntitySchema.index({ email: 1 });
EntitySchema.index({ name: 1 });
EntitySchema.index({ registration_number: 1 });
EntitySchema.index({ tax_id: 1 });

// Methods
EntitySchema.methods.toSafeObject = function () {
  const obj = this.toObject();
  delete obj.__v;
  return obj;
};

const Entity = mongoose.model("Entity", EntitySchema);

module.exports = Entity;