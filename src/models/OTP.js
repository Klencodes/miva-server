// models/OTP.js
const mongoose = require("mongoose");
const { v4: uuidv4 } = require("uuid");

const OTPSchema = new mongoose.Schema(
  {
    uuid: {
      type: String,
      unique: true,
      default: uuidv4,
      immutable: true,
    },
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    otp: {
      type: String,
      required: true,
    },
    type: {
      type: String,
      enum: ["verification", "login", "password_reset"],
      default: "verification",
    },
    expires_at: {
      type: Date,
      required: true,
      index: { expires: 0 }, // TTL index - auto delete after expiry
    },
    verified: {
      type: Boolean,
      default: false,
    },
    attempts: {
      type: Number,
      default: 0,
    },
    max_attempts: {
      type: Number,
      default: 5,
    },
    created_by: {
      type: String,
    },
    metadata: {
      type: Map,
      of: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  { timestamps: { createdAt: "created_at", updatedAt: "updated_at" } }
);

// Indexes
OTPSchema.index({ email: 1, otp: 1 });
OTPSchema.index({ expires_at: 1 }, { expireAfterSeconds: 0 });

// Methods
OTPSchema.methods.isExpired = function () {
  return new Date() > this.expires_at;
};

OTPSchema.methods.hasExceededAttempts = function () {
  return this.attempts >= this.max_attempts;
};

OTPSchema.methods.incrementAttempts = async function () {
  this.attempts += 1;
  await this.save();
  return this.attempts;
};

const OTP = mongoose.model("OTP", OTPSchema);

module.exports = OTP;