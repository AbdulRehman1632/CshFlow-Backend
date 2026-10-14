const express = require('express');
const router = express.Router();
const {
  getMonthlyBalance,
  setMonthlyBalance,
  getMonthlySummary
} = require('../controllers/balanceController');
const { protect } = require('../middleware/authMiddleware');
const { monthlyBalanceValidation } = require('../middleware/validator');

router.use(protect);

router.get('/:month', getMonthlyBalance);
router.post('/', monthlyBalanceValidation, setMonthlyBalance);
router.get('/:month/summary', getMonthlySummary);

module.exports = router;
