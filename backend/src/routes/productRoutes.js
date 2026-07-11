const { Router } = require('express');
const {
  getAllProducts,
  getAllProductsAdmin,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
} = require('../controllers/productController');
const { authenticateAdmin } = require('../middleware/auth');

const router = Router();

router.get('/', getAllProducts);
router.get('/admin', authenticateAdmin, getAllProductsAdmin);
router.get('/:id', getProductById);
router.post('/', authenticateAdmin, createProduct);
router.put('/:id', authenticateAdmin, updateProduct);
router.delete('/:id', authenticateAdmin, deleteProduct);

module.exports = router;
