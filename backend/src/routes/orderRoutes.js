const { Router } = require('express');
const {
  createOrder,
  getOrderById,
  updateOrderStatus,
  updateOrderItems,
  getAllOrders,
  getAdminStats,
} = require('../controllers/orderController');
const { authenticateAdmin } = require('../middleware/auth');

const router = Router();

router.get('/admin/stats', authenticateAdmin, getAdminStats);
router.get('/admin', authenticateAdmin, getAllOrders);
router.post('/', createOrder);
router.get('/:id', getOrderById);
router.patch('/:id/status', authenticateAdmin, updateOrderStatus);
router.patch('/:id/items', authenticateAdmin, updateOrderItems);

module.exports = router;
