const mongoose = require('mongoose');

const orderItemSchema = new mongoose.Schema({
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true,
  },
  productName: { type: String, required: true },
  variant: {
    name: { type: String, default: null },
    price: { type: Number, default: 0 },
  },
  extras: [{
    name: { type: String },
    price: { type: Number },
  }],
  quantity: {
    type: Number,
    required: true,
    min: [1, 'La cantidad mínima es 1'],
  },
  unitPrice: {
    type: Number,
    required: true,
  },
  subtotal: {
    type: Number,
    required: true,
  },
}, { _id: false });

const orderSchema = new mongoose.Schema({
  customer: {
    name: {
      type: String,
      required: [true, 'El nombre del cliente es obligatorio'],
      trim: true,
    },
    phone: {
      type: String,
      required: [true, 'El teléfono es obligatorio'],
      trim: true,
    },
    address: {
      type: String,
      required: [true, 'La dirección de entrega es obligatoria'],
      trim: true,
    },
    notes: {
      type: String,
      trim: true,
      default: '',
    },
  },
  items: [orderItemSchema],
  subtotal: {
    type: Number,
    required: true,
  },
  deliveryFee: {
    type: Number,
    default: 0,
  },
  total: {
    type: Number,
    required: true,
  },
  paymentMethod: {
    type: String,
    enum: ['cash', 'card'],
    required: [true, 'El método de pago es obligatorio'],
  },
  paymentStatus: {
    type: String,
    enum: ['pending', 'paid', 'failed'],
    default: 'pending',
  },
  orderStatus: {
    type: String,
    enum: ['pending', 'confirmed', 'preparing', 'in_transit', 'delivered', 'cancelled'],
    default: 'pending',
  },
  paymentLink: {
    type: String,
    default: '',
  },
}, {
  timestamps: true,
});

orderSchema.index({ createdAt: -1 });
orderSchema.index({ 'customer.phone': 1 });
orderSchema.index({ orderStatus: 1 });

module.exports = mongoose.model('Order', orderSchema);
