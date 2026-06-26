const mongoose = require("mongoose");
const { randomUUID } = require('crypto');


const InventorySchema = new mongoose.Schema(
  {
    uuid: {
      type: String,
      unique: true,
      default: randomUUID(),
      immutable: true,
    },
     entity_id: {
    type: String,
    required: true,
    index: true,
    default: null,
  },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    part_number: {
      type: String,
      trim: true,
      index: true,
    },
    type: {
      type: String,
      enum: [ "hose", "fitting", "ferrule", "assembly", "adapter", "coupling", "other", ],
      required: true,
      default: "other",
    },
    unit: {
      type: String,
      enum: ["meters", "feet", "pieces"],
      required: true,
      default: "pieces",
    },
    quantity: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
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
    supplier: {
      type: String,
      trim: true,
    },
    image: {
      type: String,
      trim: true,
    },

    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    created_by: { type: String },
    updated_by: { type: String },
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

// Virtual for stock status
InventorySchema.virtual("stock_status").get(function () {
  if (this.quantity <= 0) return "out_of_stock";
  if (this.quantity <= this.reorder_threshold) return "low_stock";
  return "in_stock";
});

// Virtual for total value
InventorySchema.virtual("total_value").get(function () {
  return this.quantity * this.cost;
});

// Virtual for total price
InventorySchema.virtual("total_price_value").get(function () {
  return this.quantity * this.price;
});

// Indexes
InventorySchema.index({ entity_id: 1, name: 1 });
InventorySchema.index({ entity_id: 1, part_number: 1 });
InventorySchema.index({ entity_id: 1, type: 1 });
InventorySchema.index({ entity_id: 1, supplier: 1 });
InventorySchema.index({ entity_id: 1, quantity: 1 });
InventorySchema.index({ entity_id: 1, "metadata.$**": 1 });

// Pre-save middleware
InventorySchema.pre("save", function (next) {
  // Trim name
  if (this.name) {
    this.name = this.name.trim();
  }
  // Trim part_number
  if (this.part_number) {
    this.part_number = this.part_number.trim();
  }
  next();
});

// Methods
InventorySchema.methods.toSafeObject = function () {
  const obj = this.toObject();
  delete obj.__v;
  return obj;
};

InventorySchema.methods.hasStock = function (quantity = 1) {
  return this.quantity >= quantity;
};

InventorySchema.methods.reduceStock = function (quantity) {
  if (!this.hasStock(quantity)) {
    throw new Error("INSUFFICIENT_STOCK");
  }
  this.quantity -= quantity;
  return this;
};

InventorySchema.methods.increaseStock = function (quantity) {
  this.quantity += quantity;
  return this;
};

// Static method to get stock summary
InventorySchema.statics.getStockSummary = async function (entityId) {
  return this.aggregate([
    { $match: { entity_id: entityId } },
    {
      $group: {
        _id: "$type",
        total_items: { $sum: 1 },
        total_quantity: { $sum: "$quantity" },
        total_value: { $sum: { $multiply: ["$quantity", "$cost"] } },
        avg_cost: { $avg: "$cost" },
        avg_price: { $avg: "$price" },
      },
    },
  ]);
};

const Inventory = mongoose.model("Inventory", InventorySchema);

module.exports = Inventory;
