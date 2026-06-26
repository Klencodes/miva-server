// models/Payment.js
const mongoose = require("mongoose");
const uuid = require('uuid');
const { v4: uuidv4 } = uuid;

const PaymentSchema = new mongoose.Schema(
  {
    uuid: {
      type: String,
      unique: true,
      default: uuidv4,
      immutable: true,
    },
    entity_id: {
      type: String,
      required: true,
      index: true,
    },
    invoice_id: {
      type: String,
      required: true,
      index: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    method: {
      type: String,
      enum: ['Cash', 'MoMo', 'Bank', 'Credit'],
      required: true,
    },
    reference: {
      type: String,
      trim: true,
    },
    bank_branch: {
      type: String,
      trim: true,
    },
    date: {
      type: Date,
      default: Date.now,
    },
    notes: {
      type: String,
      trim: true,
    },
    status: {
      type: String,
      enum: ['pending', 'completed', 'failed', 'refunded'],
      default: 'completed',
    },
    created_by: { type: String },
    updated_by: { type: String },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } }
);

// Indexes
PaymentSchema.index({ entity_id: 1, invoice_id: 1 });
PaymentSchema.index({ entity_id: 1, date: -1 });
PaymentSchema.index({ reference: 1 });

const Payment = mongoose.model("Payment", PaymentSchema);

module.exports = Payment;