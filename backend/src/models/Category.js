const mongoose = require('mongoose');

const categorySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'El nombre de la categoría es obligatorio'],
      trim: true,
      unique: true,
      maxlength: [40, 'Máximo 40 caracteres'],
    },
    icon: {
      type: String,
      default: '📦',
      trim: true,
      maxlength: [8, 'Icono demasiado largo'],
    },
    description: {
      type: String,
      default: '',
      trim: true,
      maxlength: [120, 'Máximo 120 caracteres'],
    },
    order: {
      type: Number,
      default: 0,
    },
    active: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

categorySchema.index({ order: 1, name: 1 });
categorySchema.index({ active: 1 });

module.exports = mongoose.model('Category', categorySchema);
