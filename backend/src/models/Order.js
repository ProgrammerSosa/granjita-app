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
    min: [0.5, 'La cantidad mínima es 0.5'],
  },
  unitPrice: {
    type: Number,
    required: true,
  },
  subtotal: {
    type: Number,
    required: true,
  },
  unitType: {
    type: String,
    enum: ['unit', 'weight'],
    default: 'unit',
  },
}, { _id: false });

const billLineSchema = new mongoose.Schema({
  denomination: { type: Number, required: true },
  count: { type: Number, required: true, min: 0 },
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
    /** Residencial de San José Pinula */
    zone: {
      type: String,
      trim: true,
      default: '',
    },
    municipality: {
      type: String,
      trim: true,
      default: 'San José Pinula',
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
  // cash = efectivo al llegar | card = terminal POS en casa del cliente
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
  // Factura se genera al pasar a "en camino"
  invoice: {
    number: { type: String, default: null },
    issuedAt: { type: Date, default: null },
    // Token aleatorio para el link público del PDF (lo usa WhatsApp Cloud API)
    publicToken: { type: String, default: null },
  },
  // Lo que el cliente DIJO que pagará (en el checkout)
  cashIntent: {
    bills: [billLineSchema],
    amountTendered: { type: Number, default: 0 },
    change: { type: Number, default: 0 },
    declaredAt: { type: Date, default: null },
  },
  // Cobro real en la puerta (repartidor confirma)
  cashPayment: {
    bills: [billLineSchema],
    amountTendered: { type: Number, default: 0 },
    change: { type: Number, default: 0 },
    notes: { type: String, default: '' },
    recordedAt: { type: Date, default: null },
  },
  whatsappSessionId: {
    type: String,
    default: '',
  },
}, {
  timestamps: true,
});

orderSchema.index({ createdAt: -1 });
orderSchema.index({ 'customer.phone': 1 });
orderSchema.index({ orderStatus: 1 });
orderSchema.index({ 'invoice.number': 1 });

module.exports = mongoose.model('Order', orderSchema);
