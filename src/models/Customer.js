const mongoose = require("mongoose");
const { v4: uuidv4 } = require('uuid/dist/cjs');

const CustomerSchema = new mongoose.Schema(
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
    email: {
      type: String,
      trim: true,
      lowercase: true,
      match: [/^\S+@\S+\.\S+$/, "Invalid email format"],
    },
    phone: {
      type: String,
      trim: true,
    },
    address: {
      type: String,
      trim: true,
    },
    tax_id: {
      type: String,
      trim: true,
    },
    balance: {
      type: Number,
      default: 0,
    },
    notes: {
      type: String,
      trim: true,
    },
    is_active: {
      type: Boolean,
      default: true,
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

// Virtual for total invoices
CustomerSchema.virtual('total_invoices', {
  ref: 'Invoice',
  localField: 'name',
  foreignField: 'customer.name',
  count: true,
});

// Virtual for total spent
CustomerSchema.virtual('total_spent', {
  ref: 'Invoice',
  localField: 'name',
  foreignField: 'customer.name',
  sum: 'total',
});

// Indexes - removed entity_id
CustomerSchema.index({ name: 1 });
CustomerSchema.index({ email: 1 });
CustomerSchema.index({ phone: 1 });
CustomerSchema.index({ tax_id: 1 });

// Pre-save middleware
CustomerSchema.pre('save', function(next) {
  if (this.name) {
    this.name = this.name.trim();
  }
  if (this.email) {
    this.email = this.email.toLowerCase().trim();
  }
  next();
});

// Methods
CustomerSchema.methods.toSafeObject = function() {
  const obj = this.toObject();
  delete obj.__v;
  return obj;
};

CustomerSchema.methods.updateBalance = async function() {
  const Invoice = mongoose.model('Invoice');
  
  // Calculate total from invoices - removed entity_id filter
  const result = await Invoice.aggregate([
    {
      $match: {
        'customer.name': this.name,
        status: { $in: ['invoiced', 'partially', 'paid'] },
      },
    },
    {
      $group: {
        _id: null,
        total: { $sum: '$total' },
        paid: { $sum: '$amount_paid' },
        remaining: { $sum: { $subtract: ['$total', '$amount_paid'] } },
      },
    },
  ]);

  if (result.length > 0) {
    this.balance = result[0].remaining || 0;
  } else {
    this.balance = 0;
  }
  
  await this.save();
  return this.balance;
};

const Customer = mongoose.model("Customer", CustomerSchema);

module.exports = Customer;