const express = require('express');
const router = express.Router();
const {
  register,
  login,
  getMe,
  updateProfile,
  seedDemoData
} = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');
const { registerValidation, loginValidation } = require('../middleware/validator');

router.post('/register', registerValidation, register);
router.post('/login', loginValidation, login);
router.get('/me', protect, getMe);
router.put('/profile', protect, updateProfile);
router.post('/seed-demo', protect, seedDemoData);

module.exports = router;
