// models/Invoice.js
const mongoose = require("mongoose");
const uuid = require('uuid');
const { v4: uuidv4 } = uuid;

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
      part_number: { type: String, required: true },
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
    nhil_rate: {
      type: Number,
      default: 0,
    },
    getfund: {
      type: Number,
      default: 0,
    },
    getfund_rate: {
      type: Number,
      default: 0,
    },
    covid_levy: {
      type: Number,
      default: 0,
    },
    covid_levy_rate: {
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
    status: {
      type: String,
      enum: ['draft', 'quoted', 'invoiced', 'cancelled'],
      default: 'draft',
    },
    payment_status: {
      type: String,
      enum: ['unpaid', 'paid', 'overdue', 'partially'],
      default: 'unpaid',
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

// Virtual for remaining balance
InvoiceSchema.virtual('remaining_balance').get(function() {
  return this.total - (this.amount_paid || 0);
});

// Virtual for payment status (computed from payment_status field)
InvoiceSchema.virtual('payment_status_display').get(function() {
  return this.payment_status || 'unpaid';
});

// Indexes
InvoiceSchema.index({ entity_id: 1, number: 1 });
InvoiceSchema.index({ entity_id: 1, status: 1 });
InvoiceSchema.index({ entity_id: 1, payment_status: 1 });
InvoiceSchema.index({ entity_id: 1, date: -1 });
InvoiceSchema.index({ 'customer.email': 1 });
InvoiceSchema.index({ 'customer.phone': 1 });

// Pre-save middleware to calculate totals and update statuses
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
  this.nhil = (taxableAmount * (this.nhil_rate || 0)) / 100;
  this.getfund = (taxableAmount * (this.getfund_rate || 0)) / 100;
  this.covid_levy = (taxableAmount * (this.covid_levy_rate || 0)) / 100;
  
  // Calculate total
  this.total = taxableAmount + this.vat + this.nhil + this.getfund + this.covid_levy;
  
  // Update payment_status based on payment
  this.updatePaymentStatus();
  
  // Update status based on invoice state
  this.updateInvoiceStatus();
  
  next();
});

// Method to update payment status
InvoiceSchema.methods.updatePaymentStatus = function() {
  const remaining = this.total - (this.amount_paid || 0);
  const now = new Date();
  const dueDate = this.due_date ? new Date(this.due_date) : null;
  
  // Don't update payment status for draft or cancelled
  if (this.status === 'draft' || this.status === 'cancelled') {
    this.payment_status = 'unpaid';
    return;
  }
  
  // Check if fully paid
  if (remaining <= 0) {
    this.payment_status = 'paid';
    return;
  }
  
  // Check if partially paid
  if (this.amount_paid > 0 && remaining > 0) {
    this.payment_status = 'partially';
    return;
  }
  
  // Check if overdue (no payment and past due date)
  if (this.amount_paid === 0 && dueDate && now > dueDate) {
    this.payment_status = 'overdue';
    return;
  }
  
  // Default: unpaid
  this.payment_status = 'unpaid';
};

// Method to update invoice status
InvoiceSchema.methods.updateInvoiceStatus = function() {
  // Don't override draft or cancelled status
  if (this.status === 'draft' || this.status === 'cancelled') {
    return;
  }
  
  // If quoted, keep as quoted unless paid
  if (this.status === 'quoted' || this.status === 'draft') {
  // AUTOMATIC: Change to invoiced if paid
  if (this.payment_status === 'paid' || this.amount_paid >= this.total) {
    this.status = 'invoiced';
  }
  return;
}
  
  
  // For invoiced status
  if (this.status === 'invoiced') {
    // If fully paid, keep as invoiced (payment_status handles the rest)
    // No need to change status
    return;
  }
  
  // Default to invoiced if not draft, quoted, or cancelled
  if (!this.status || this.status === '') {
    this.status = 'invoiced';
  }
};

// Methods
InvoiceSchema.methods.toSafeObject = function() {
  const obj = this.toObject();
  delete obj.__v;
  return obj;
};

InvoiceSchema.methods.addPayment = function(paymentData) {
  this.payments.push(paymentData);
  this.amount_paid = (this.amount_paid || 0) + paymentData.amount;
  
  // Update statuses
  this.updatePaymentStatus();
  this.updateInvoiceStatus();
  
  return this;
};

InvoiceSchema.methods.cancel = function() {
  this.status = 'cancelled';
  this.payment_status = 'unpaid';
  return this;
};

InvoiceSchema.methods.markAsPaid = function() {
  this.amount_paid = this.total;
  this.payment_status = 'paid';
  // Keep status as invoiced
  if (this.status !== 'draft' && this.status !== 'quoted') {
    this.status = 'invoiced';
  }
  return this;
};

const Invoice = mongoose.model("Invoice", InvoiceSchema);

module.exports = Invoice;