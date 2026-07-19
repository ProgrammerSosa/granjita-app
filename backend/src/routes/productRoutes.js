const { Router } = require('express');
const {
  getAllProducts,
  getAllProductsAdmin,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
  getStockAdmin,
  adjustStock,
  getAdminAlerts,
  markAdminAlertsRead,
} = require('../controllers/productController');
const { authenticateAdmin } = require('../middleware/auth');

const router = Router();

router.get('/', getAllProducts);
router.get('/admin', authenticateAdmin, getAllProductsAdmin);
router.get('/admin/stock', authenticateAdmin, getStockAdmin);
router.get('/admin/alerts', authenticateAdmin, getAdminAlerts);
router.post('/admin/alerts/read', authenticateAdmin, markAdminAlertsRead);
router.patch('/admin/stock/:id', authenticateAdmin, adjustStock);
router.get('/:id', getProductById);
router.post('/', authenticateAdmin, createProduct);
router.put('/:id', authenticateAdmin, updateProduct);
router.delete('/:id', authenticateAdmin, deleteProduct);

module.exports = router;
