// src/models/Expense.js

const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid/dist/cjs');
const expenseSchema = new mongoose.Schema({
  uuid: {
    type: String,
    required: true,
    unique: true,
    default: uuidv4,
  },
  entity_id: {
    type: String,
    required: true,
    index: true,
  },
  title: {
    type: String,
    required: true,
    trim: true,
  },
  description: {
    type: String,
    trim: true,
  },
  amount: {
    type: Number,
    required: true,
    min: 0,
  },
  category: {
    type: String,
    required: true,
    enum: [
      'Office Supplies',
      'Utilities',
      'Rent',
      'Salaries',
      'Marketing',
      'Transport',
      'Equipment',
      'Food & Drinks',
      'Software',
      'Maintenance',
      'Insurance',
      'Travel',
      'Training',
      'Other',
    ],
  },
  sub_category: {
    type: String,
    trim: true,
  },
  date: {
    type: Date,
    required: true,
    default: Date.now,
  },
  payment_method: {
    type: String,
    required: true,
    enum: ['cash', 'bank', 'mobile_money', 'credit_card'],
    default: 'cash',
  },
  status: {
    type: String,
    required: true,
    enum: ['pending', 'paid'], // Only pending and paid
    default: 'pending',
  },
  vendor: {
    type: String,
    trim: true,
  },
  vendor_contact: {
    type: String,
    trim: true,
  },
  receipt_url: {
    type: String,
    trim: true,
  },
  receipt_public_id: {
    type: String,
    trim: true,
  },
  created_by: {
    type: String,
    required: true,
  },
  created_by_name: {
    type: String,
    required: true,
  },
  paid_by: {
    type: String,
  },
  paid_by_name: {
    type: String,
  },
  paid_at: {
    type: Date,
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {},
  },
  created_at: {
    type: Date,
    default: Date.now,
  },
  updated_at: {
    type: Date,
    default: Date.now,
  },
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
});

// Indexes
expenseSchema.index({ entity_id: 1, date: -1 });
expenseSchema.index({ entity_id: 1, category: 1 });
expenseSchema.index({ entity_id: 1, status: 1 });
expenseSchema.index({ entity_id: 1, vendor: 1 });
expenseSchema.index({ created_at: -1 });

// Generate UUID before saving
expenseSchema.pre('save', function(next) {
  if (!this.uuid) {
    const prefix = 'EXP';
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    this.uuid = `${prefix}-${timestamp}-${random}`;
  }
  this.updated_at = new Date();
  next();
});

// Virtual for formatted amount
expenseSchema.virtual('formatted_amount').get(function() {
  return `GHC ${this.amount.toFixed(2)}`;
});

// Virtual for status label
expenseSchema.virtual('status_label').get(function() {
  const labels = {
    pending: 'Pending',
    paid: 'Paid',
  };
  return labels[this.status] || this.status;
});

// Virtual for payment method label
expenseSchema.virtual('payment_method_label').get(function() {
  const labels = {
    cash: 'Cash',
    bank: 'Bank Transfer',
    mobile_money: 'Mobile Money',
    credit_card: 'Credit Card',
  };
  return labels[this.payment_method] || this.payment_method;
});

// Static method to get expense categories
expenseSchema.statics.getCategories = function() {
  return [
    'Office Supplies',
    'Utilities',
    'Rent',
    'Salaries',
    'Marketing',
    'Transport',
    'Equipment',
    'Food & Drinks',
    'Software',
    'Maintenance',
    'Insurance',
    'Travel',
    'Training',
    'Other',
  ];
};

// Static method to get status options
expenseSchema.statics.getStatusOptions = function() {
  return ['pending', 'paid'];
};

// Static method to get payment method options
expenseSchema.statics.getPaymentMethods = function() {
  return ['cash', 'bank', 'mobile_money', 'credit_card'];
};

// Method to check if expense can be edited
expenseSchema.methods.canEdit = function() {
  return this.status === 'pending';
};

// Method to check if expense can be paid
expenseSchema.methods.canPay = function() {
  return this.status === 'pending';
};

const Expense = mongoose.model('Expense', expenseSchema);

module.exports = Expense;