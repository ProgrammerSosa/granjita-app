const { Router } = require('express');
const {
  getPublicCategories,
  getAdminCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  reorderCategories,
} = require('../controllers/categoryController');
const { authenticateAdmin } = require('../middleware/auth');

const router = Router();

router.get('/', getPublicCategories);
router.get('/admin', authenticateAdmin, getAdminCategories);
router.post('/', authenticateAdmin, createCategory);
router.put('/reorder', authenticateAdmin, reorderCategories);
router.put('/:id', authenticateAdmin, updateCategory);
router.delete('/:id', authenticateAdmin, deleteCategory);

module.exports = router;
