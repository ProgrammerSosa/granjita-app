const { Router } = require('express');
const { uploadImage } = require('../controllers/uploadController');
const { authenticateAdmin } = require('../middleware/auth');

const router = Router();

router.post('/', authenticateAdmin, uploadImage);

module.exports = router;
