// models/Invoice.js
const mongoose = require("mongoose");
const { v4: uuidv4 } = require('uuid');

const InvoiceSchema = new mongoose.Schema(
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
    number: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    date: {
      type: Date,
      default: Date.now,
    },
    due_date: {
      type: Date,
    },
    customer: {
      name: { type: String, required: true, trim: true },
      email: { type: String, trim: true, lowercase: true },
      phone: { type: String, trim: true },
      address: { type: String, trim: true },
      tax_id: { type: String, trim: true },
    },
    items: [{
      id: { type: String, required: true },
      name: { type: String, required: true },
      type: { 
        type: String, 
        enum: ['hose', 'fitting', 'ferrule', 'assembly', 'adapter', 'coupling', 'other'],
        default: 'other'
      },
      unit: { 
        type: String, 
        enum: ['meters', 'feet', 'pieces'],
        default: 'pieces'
      },
      quantity: { type: Number, required: true, min: 0 },
      specs: {
        sae: String,
        pressure: Number,
        thread_type: {
          type: String,
          enum: ['BSP', 'JIC', 'NPT', 'ORFS', 'SAE', 'Komatsu', 'Metric']
        },
        diameter: Number,
        material: String,
        part_number: String,
        angle: Number,
        working_temp: String,
        assembly_length: Number,
      },
      cost: { type: Number, default: 0 },
      price: { type: Number, required: true, min: 0 },
      location: String,
      supplier: String,
      image: String,
    }],
    subtotal: {
      type: Number,
      required: true,
      default: 0,
    },
    discount_total: {
      type: Number,
      default: 0,
    },
    discount_type: {
      type: String,
      enum: ['percentage', 'fixed'],
      default: 'percentage',
    },
    discount_rate: {
      type: Number,
      default: 0,
    },
    vat: {
      type: Number,
      default: 0,
    },
    vat_rate: {
      type: Number,
      default: 0,
    },
    nhil: {
      type: Number,
      default: 0,
    },
    getfund: {
      type: Number,
      default: 0,
    },
    covid_levy: {
      type: Number,
      default: 0,
    },
    total: {
      type: Number,
      required: true,
      default: 0,
    },
    amount_paid: {
      type: Number,
      default: 0,
    },
    // REMOVED: remaining_balance from schema (now a virtual)
    status: {
      type: String,
      enum: ['draft', 'quoted', 'invoiced', 'partially_paid', 'paid', 'cancelled', 'overdue'],
      default: 'draft',
    },
    notes: {
      type: String,
      trim: true,
    },
    terms: {
      type: String,
      trim: true,
    },
    currency: {
      type: String,
      default: 'GHS',
    },
    payment_method: {
      type: String,
      enum: ['Cash', 'MoMo', 'Bank', 'Credit'],
    },
    payments: [{
      payment_id: { type: String },
      amount: { type: Number, required: true },
      method: {
        type: String,
        enum: ['Cash', 'MoMo', 'Bank', 'Credit'],
        required: true,
      },
      reference: String,
      bank_branch: String,
      date: { type: Date, default: Date.now },
      notes: String,
    }],
    created_by: { type: String },
    updated_by: { type: String },
  },
  { 
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Virtual for remaining balance - FIXED: removed from schema, now only virtual
InvoiceSchema.virtual('remaining_balance').get(function() {
  return this.total - (this.amount_paid || 0);
});

// Virtual for payment status
InvoiceSchema.virtual('payment_status').get(function() {
  const remaining = this.remaining_balance;
  if (remaining <= 0) return 'Paid';
  if (this.amount_paid > 0) return 'Partial';
  return 'Unpaid';
});

// Indexes
InvoiceSchema.index({ entity_id: 1, number: 1 });
InvoiceSchema.index({ entity_id: 1, status: 1 });
InvoiceSchema.index({ entity_id: 1, date: -1 });
InvoiceSchema.index({ 'customer.email': 1 });
InvoiceSchema.index({ 'customer.phone': 1 });

// Pre-save middleware to calculate totals
InvoiceSchema.pre('save', function(next) {
  // Calculate subtotal
  this.subtotal = this.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  
  // Calculate discount
  if (this.discount_type === 'percentage') {
    this.discount_total = (this.subtotal * (this.discount_rate || 0)) / 100;
  } else {
    this.discount_total = this.discount_rate || 0;
  }
  
  // Calculate taxes (based on subtotal after discount)
  const taxableAmount = this.subtotal - this.discount_total;
  this.vat = (taxableAmount * (this.vat_rate || 0)) / 100;
  this.nhil = (taxableAmount * 0.025); // 2.5% NHIL
  this.getfund = (taxableAmount * 0.025); // 2.5% GETFund
  this.covid_levy = (taxableAmount * 0.01); // 1% COVID-19 Levy
  
  // Calculate total
  this.total = taxableAmount + this.vat + this.nhil + this.getfund + this.covid_levy;
  
  // Update status based on payment (using virtual)
  const remaining = this.total - (this.amount_paid || 0);
  if (this.status !== 'cancelled' && this.status !== 'draft') {
    if (remaining <= 0) {
      this.status = 'paid';
    } else if (this.amount_paid > 0) {
      this.status = 'partially_paid';
    } else if (this.due_date && new Date() > this.due_date) {
      this.status = 'overdue';
    }
  }
  
  next();
});

// Methods
InvoiceSchema.methods.toSafeObject = function() {
  const obj = this.toObject();
  delete obj.__v;
  return obj;
};

InvoiceSchema.methods.addPayment = function(paymentData) {
  this.payments.push(paymentData);
  this.amount_paid = (this.amount_paid || 0) + paymentData.amount;
  // Remaining balance is now a virtual, no need to set it
  return this;
};

InvoiceSchema.methods.cancel = function() {
  this.status = 'cancelled';
  return this;
};

InvoiceSchema.methods.markAsPaid = function() {
  this.amount_paid = this.total;
  // Remaining balance is now a virtual
  this.status = 'paid';
  return this;
};

const Invoice = mongoose.model("Invoice", InvoiceSchema);

module.exports = Invoice;