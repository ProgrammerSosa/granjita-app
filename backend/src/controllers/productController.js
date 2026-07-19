const Product = require('../models/Product');

exports.getAllProducts = async (req, res) => {
  try {
    const { category } = req.query;
    const filter = { available: true, $or: [{ stock: null }, { stock: { $gt: 0 } }] };
    if (category) filter.category = category;

    const products = await Product.find(filter).sort({ category: 1, name: 1 });
    return res.json({ success: true, data: products });
  } catch (error) {
    console.error('Error al obtener productos:', error);
    return res.status(500).json({ success: false, message: 'Error al obtener productos' });
  }
};

exports.getAllProductsAdmin = async (req, res) => {
  try {
    const { category } = req.query;
    const filter = {};
    if (category) filter.category = category;
    const products = await Product.find(filter).sort({ category: 1, name: 1 });
    return res.json({ success: true, data: products });
  } catch (error) {
    console.error('Error al obtener productos admin:', error);
    return res.status(500).json({ success: false, message: 'Error al obtener productos' });
  }
};

exports.getProductById = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ success: false, message: 'Producto no encontrado' });
    }
    return res.json({ success: true, data: product });
  } catch (error) {
    console.error('Error al obtener producto:', error);
    return res.status(500).json({ success: false, message: 'Error al obtener producto' });
  }
};

exports.createProduct = async (req, res) => {
  try {
    const product = await Product.create(req.body);
    return res.status(201).json({ success: true, data: product });
  } catch (error) {
    console.error('Error al crear producto:', error);
    return res.status(400).json({ success: false, message: error.message });
  }
};

exports.updateProduct = async (req, res) => {
  try {
    const product = await Product.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });
    if (!product) {
      return res.status(404).json({ success: false, message: 'Producto no encontrado' });
    }
    return res.json({ success: true, data: product });
  } catch (error) {
    console.error('Error al actualizar producto:', error);
    return res.status(400).json({ success: false, message: error.message });
  }
};

exports.deleteProduct = async (req, res) => {
  try {
    const product = await Product.findByIdAndDelete(req.params.id);
    if (!product) {
      return res.status(404).json({ success: false, message: 'Producto no encontrado' });
    }
    return res.json({ success: true, message: 'Producto eliminado correctamente' });
  } catch (error) {
    console.error('Error al eliminar producto:', error);
    return res.status(500).json({ success: false, message: 'Error al eliminar producto' });
  }
};
