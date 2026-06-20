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
      required: false,
      trim: true,
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
    },
    tax_id: {
      type: String,
      trim: true,
    },
   
    is_active: {
      type: Boolean,
      default: true,
    },
    settings: {
      type: Map,
      of: mongoose.Schema.Types.Mixed,
      default: {},
    },
    metadata: {
      type: Map,
      of: mongoose.Schema.Types.Mixed,
      default: {},
    },
    created_by: {
      type: String, // UUID of user who created this entity
    },
    updated_by: {
      type: String, // UUID of user who last updated this entity
    },
  },
  { timestamps: { createdAt: "created_at", updatedAt: "updated_at" } },
);

// Indexes
EntitySchema.index({ uuid: 1 });
EntitySchema.index({ email: 1 });
EntitySchema.index({ name: 1 });
EntitySchema.index({ registration_number: 1 });

// Methods
EntitySchema.methods.toSafeObject = function () {
  const obj = this.toObject();
  delete obj.__v;
  return obj;
};

const Entity = mongoose.model("Entity", EntitySchema);

module.exports = Entity;