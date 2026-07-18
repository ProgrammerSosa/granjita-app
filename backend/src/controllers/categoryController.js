const Category = require('../models/Category');
const Product = require('../models/Product');

const DEFAULT_CATEGORIES = [
  { name: 'Pollo', icon: '🐔', order: 1 },
  { name: 'Carnes', icon: '🥩', order: 2 },
  { name: 'Lácteos', icon: '🧀', order: 3 },
  { name: 'Aguas', icon: '💧', order: 4 },
  { name: 'Helados', icon: '🍦', order: 5 },
  { name: 'Condimentos', icon: '🧂', order: 6 },
  { name: 'Bebidas', icon: '🥤', order: 7 },
  { name: 'Extras', icon: '🍟', order: 8 },
];

exports.seedDefaultCategories = async () => {
  try {
    const count = await Category.countDocuments();
    if (count > 0) return;
    await Category.insertMany(DEFAULT_CATEGORIES);
    console.log('[Categories] Categorías por defecto creadas');
  } catch (err) {
    console.error('[Categories] Error seed:', err.message);
  }
};

exports.getPublicCategories = async (_req, res) => {
  try {
    const categories = await Category.find({ active: true }).sort({ order: 1, name: 1 });
    return res.json({ success: true, data: categories });
  } catch (error) {
    console.error('Error al obtener categorías:', error);
    return res.status(500).json({ success: false, message: 'Error al obtener categorías' });
  }
};

exports.getAdminCategories = async (_req, res) => {
  try {
    const categories = await Category.find().sort({ order: 1, name: 1 });
    const withCounts = await Promise.all(
      categories.map(async (cat) => {
        const productCount = await Product.countDocuments({ category: cat.name });
        return { ...cat.toObject(), productCount };
      })
    );
    return res.json({ success: true, data: withCounts });
  } catch (error) {
    console.error('Error al obtener categorías admin:', error);
    return res.status(500).json({ success: false, message: 'Error al obtener categorías' });
  }
};

exports.createCategory = async (req, res) => {
  try {
    const { name, icon, description, order, active } = req.body;
    if (!name?.trim()) {
      return res.status(400).json({ success: false, message: 'El nombre es obligatorio' });
    }

    const exists = await Category.findOne({ name: name.trim() });
    if (exists) {
      return res.status(400).json({ success: false, message: 'Ya existe una categoría con ese nombre' });
    }

    const maxOrder = await Category.findOne().sort({ order: -1 }).select('order');
    const category = await Category.create({
      name: name.trim(),
      icon: (icon || '📦').trim(),
      description: (description || '').trim(),
      order: typeof order === 'number' ? order : (maxOrder?.order || 0) + 1,
      active: active !== false,
    });

    return res.status(201).json({ success: true, data: category });
  } catch (error) {
    console.error('Error al crear categoría:', error);
    return res.status(400).json({ success: false, message: error.message });
  }
};

exports.updateCategory = async (req, res) => {
  try {
    const category = await Category.findById(req.params.id);
    if (!category) {
      return res.status(404).json({ success: false, message: 'Categoría no encontrada' });
    }

    const { name, icon, description, order, active } = req.body;
    const oldName = category.name;

    if (name?.trim() && name.trim() !== oldName) {
      const exists = await Category.findOne({ name: name.trim(), _id: { $ne: category._id } });
      if (exists) {
        return res.status(400).json({ success: false, message: 'Ya existe una categoría con ese nombre' });
      }
      category.name = name.trim();
    }

    if (icon !== undefined) category.icon = (icon || '📦').trim();
    if (description !== undefined) category.description = String(description).trim();
    if (typeof order === 'number') category.order = order;
    if (typeof active === 'boolean') category.active = active;

    await category.save();

    // Si cambió el nombre, actualizar productos vinculados
    if (category.name !== oldName) {
      await Product.updateMany({ category: oldName }, { $set: { category: category.name } });
    }

    return res.json({ success: true, data: category });
  } catch (error) {
    console.error('Error al actualizar categoría:', error);
    return res.status(400).json({ success: false, message: error.message });
  }
};

exports.deleteCategory = async (req, res) => {
  try {
    const category = await Category.findById(req.params.id);
    if (!category) {
      return res.status(404).json({ success: false, message: 'Categoría no encontrada' });
    }

    const productCount = await Product.countDocuments({ category: category.name });
    if (productCount > 0) {
      return res.status(400).json({
        success: false,
        message: `No se puede eliminar: hay ${productCount} producto(s) en esta categoría. Movélos o eliminalos primero.`,
      });
    }

    await category.deleteOne();
    return res.json({ success: true, message: 'Categoría eliminada' });
  } catch (error) {
    console.error('Error al eliminar categoría:', error);
    return res.status(500).json({ success: false, message: 'Error al eliminar categoría' });
  }
};

exports.reorderCategories = async (req, res) => {
  try {
    const { orderedIds } = req.body;
    if (!Array.isArray(orderedIds) || orderedIds.length === 0) {
      return res.status(400).json({ success: false, message: 'orderedIds es requerido' });
    }

    await Promise.all(
      orderedIds.map((id, index) =>
        Category.findByIdAndUpdate(id, { order: index + 1 })
      )
    );

    const categories = await Category.find().sort({ order: 1, name: 1 });
    return res.json({ success: true, data: categories });
  } catch (error) {
    console.error('Error al reordenar categorías:', error);
    return res.status(500).json({ success: false, message: 'Error al reordenar' });
  }
};
