const { Router } = require('express');
const { login, verify } = require('../controllers/authController');

const router = Router();

router.post('/login', login);
router.post('/verify', verify);

module.exports = router;
