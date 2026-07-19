const mongoose = require('mongoose');

const variantSchema = new mongoose.Schema({
  name: { type: String, required: true },
  price: { type: Number, required: true, min: 0 },
  /** unit = por unidad/pieza · weight = por peso */
  kind: {
    type: String,
    enum: ['unit', 'weight'],
    default: 'unit',
  },
}, { _id: false });

const extraSchema = new mongoose.Schema({
  name: { type: String, required: true },
  price: { type: Number, required: true },
}, { _id: false });

const productSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'El nombre del producto es obligatorio'],
    trim: true,
  },
  description: {
    type: String,
    trim: true,
    default: '',
  },
  /**
   * Precio de vitrina (mínimo de variantes).
   * El precio real de venta siempre es el de la variante elegida.
   */
  price: {
    type: Number,
    default: 0,
    min: [0, 'El precio no puede ser negativo'],
  },
  image: {
    type: String,
    default: '',
  },
  category: {
    type: String,
    required: [true, 'La categoría es obligatoria'],
    trim: true,
  },
  /** Cómo se vende: unidad, peso o ambos */
  sellByUnit: {
    type: Boolean,
    default: true,
  },
  sellByWeight: {
    type: Boolean,
    default: false,
  },
  variants: [variantSchema],
  extras: [extraSchema],
  available: {
    type: Boolean,
    default: true,
  },
  featured: {
    type: Boolean,
    default: false,
  },
  trackStock: {
    type: Boolean,
    default: true,
  },
  stock: {
    type: Number,
    default: 20,
    min: [0, 'El stock no puede ser negativo'],
  },
  lowStockThreshold: {
    type: Number,
    default: 5,
    min: [0, 'El umbral no puede ser negativo'],
  },
}, {
  timestamps: true,
});

productSchema.index({ category: 1, available: 1 });
productSchema.index({ featured: 1, available: 1 });
productSchema.index({ stock: 1, trackStock: 1 });
productSchema.index({ name: 'text', description: 'text' });

module.exports = mongoose.model('Product', productSchema);
