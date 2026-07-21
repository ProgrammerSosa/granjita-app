const { Router } = require('express');
const {
  createOrder,
  getOrderById,
  updateOrderStatus,
  getAllOrders,
  getAdminStats,
  recordCashPayment,
  resendWhatsApp,
  listInvoices,
  downloadInvoicePdf,
  updateOrderItems,
  notifyMissing,
} = require('../controllers/orderController');
const { authenticateAdmin } = require('../middleware/auth');
const { rateLimit } = require('../middleware/security');

const router = Router();

// Admin
router.get('/admin/stats', authenticateAdmin, getAdminStats);
router.get('/admin/invoices', authenticateAdmin, listInvoices);
router.get('/admin', authenticateAdmin, getAllOrders);
router.patch('/:id/status', authenticateAdmin, updateOrderStatus);
router.patch('/:id/items', authenticateAdmin, updateOrderItems);
router.post('/:id/notify-missing', authenticateAdmin, notifyMissing);
router.post('/:id/cash-payment', authenticateAdmin, recordCashPayment);
router.post('/:id/resend-whatsapp', authenticateAdmin, resendWhatsApp);
router.get('/:id/invoice.pdf', authenticateAdmin, downloadInvoicePdf);

// Público: crear pedido (rate limit anti-spam)
router.post(
  '/',
  rateLimit({
    windowMs: 10 * 60 * 1000,
    max: 25,
    message: 'Demasiados pedidos desde esta red. Esperá unos minutos.',
  }),
  createOrder
);

// Público: ver un pedido por id (confirmación) — datos ya filtrados en controller
router.get(
  '/:id',
  rateLimit({ windowMs: 60_000, max: 40 }),
  getOrderById
);

module.exports = router;
