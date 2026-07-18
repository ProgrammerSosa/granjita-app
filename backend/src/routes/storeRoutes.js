const express = require('express');
const {
  getPublicStatus,
  getZones,
  getAdminSettings,
  setClosed,
  addRest,
  removeRest,
  setMinOrder,
  toggleDay,
  getDay,
} = require('../controllers/storeController');
const { authenticateAdmin } = require('../middleware/auth');

const router = express.Router();

// Público
router.get('/status', getPublicStatus);
router.get('/zones', getZones);

// Admin
router.get('/admin', authenticateAdmin, getAdminSettings);
router.get('/admin/day/:date', authenticateAdmin, getDay);
router.put('/admin/closed', authenticateAdmin, setClosed);
router.post('/admin/rest-days', authenticateAdmin, addRest);
router.post('/admin/day/toggle', authenticateAdmin, toggleDay);
router.delete('/admin/rest-days/:id', authenticateAdmin, removeRest);
router.put('/admin/min-order', authenticateAdmin, setMinOrder);

module.exports = router;
