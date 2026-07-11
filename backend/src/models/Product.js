const mongoose = require('mongoose');

const variantSchema = new mongoose.Schema({
  name: { type: String, required: true },
  price: { type: Number, required: true },
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
  price: {
    type: Number,
    required: [true, 'El precio es obligatorio'],
    min: [0, 'El precio no puede ser negativo'],
  },
  image: {
    type: String,
    default: '',
  },
  category: {
    type: String,
    required: [true, 'La categoría es obligatoria'],
    enum: ['Pollo', 'Carnes', 'Lácteos', 'Aguas', 'Helados', 'Condimentos', 'Bebidas', 'Extras'],
  },
  variants: [variantSchema],
  extras: [extraSchema],
  available: {
    type: Boolean,
    default: true,
  },
}, {
  timestamps: true,
});

productSchema.index({ category: 1, available: 1 });

module.exports = mongoose.model('Product', productSchema);
