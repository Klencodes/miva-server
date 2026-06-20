const mongoose = require("mongoose");
const { v4: uuidv4 } = require('uuid');

const InventorySchema = new mongoose.Schema(
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
    name: {
      type: String,
      required: true,
      trim: true,
    },
    type: {
      type: String,
      enum: ['hose', 'fitting', 'ferrule', 'assembly', 'adapter', 'coupling', 'other'],
      required: true,
      default: 'other',
    },
    unit: {
      type: String,
      enum: ['meters', 'feet', 'pieces'],
      required: true,
      default: 'pieces',
    },
    quantity: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    specs: {
      sae: { type: String, trim: true },
      pressure: { type: Number, min: 0 },
      thread_type: {
        type: String,
        enum: ['BSP', 'JIC', 'NPT', 'ORFS', 'SAE', 'Komatsu', 'Metric'],
      },
      diameter: { type: Number, min: 0 },
      material: { type: String, trim: true },
      part_number: { type: String, trim: true },
      angle: { type: Number, min: 0, max: 360 },
      working_temp: { type: String, trim: true },
      assembly_length: { type: Number, min: 0 },
    },
    reorder_threshold: {
      type: Number,
      required: true,
      default: 5,
      min: 0,
    },
    cost: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    price: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    location: {
      type: String,
      trim: true,
    },
    supplier: {
      type: String,
      trim: true,
    },
    image: {
      type: String,
      trim: true,
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

// Virtual for stock status
InventorySchema.virtual('stock_status').get(function() {
  if (this.quantity <= 0) return 'out_of_stock';
  if (this.quantity <= this.reorder_threshold) return 'low_stock';
  return 'in_stock';
});

// Virtual for total value
InventorySchema.virtual('total_value').get(function() {
  return this.quantity * this.cost;
});

// Indexes
InventorySchema.index({ entity_id: 1, name: 1 });
InventorySchema.index({ entity_id: 1, type: 1 });
InventorySchema.index({ entity_id: 1, 'specs.part_number': 1 });
InventorySchema.index({ entity_id: 1, supplier: 1 });
InventorySchema.index({ entity_id: 1, quantity: 1 });

// Pre-save middleware
InventorySchema.pre('save', function(next) {
  // Trim name
  if (this.name) {
    this.name = this.name.trim();
  }
  next();
});

// Methods
InventorySchema.methods.toSafeObject = function() {
  const obj = this.toObject();
  delete obj.__v;
  return obj;
};

InventorySchema.methods.hasStock = function(quantity = 1) {
  return this.quantity >= quantity;
};

InventorySchema.methods.reduceStock = function(quantity) {
  if (!this.hasStock(quantity)) {
    throw new Error('INSUFFICIENT_STOCK');
  }
  this.quantity -= quantity;
  return this;
};

InventorySchema.methods.increaseStock = function(quantity) {
  this.quantity += quantity;
  return this;
};

const Inventory = mongoose.model("Inventory", InventorySchema);

module.exports = Inventory;