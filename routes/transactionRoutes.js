const express = require('express');
const router = express.Router();
const {
  getTransactions,
  getTransactionById,
  createTransaction,
  updateTransaction,
  deleteTransaction,
  getCategories
} = require('../controllers/transactionController');
const { protect } = require('../middleware/authMiddleware');
const { transactionValidation } = require('../middleware/validator');

router.use(protect);

router.get('/categories', getCategories);
router.get('/', getTransactions);
router.post('/', transactionValidation, createTransaction);
router.get('/:id', getTransactionById);
router.put('/:id', updateTransaction);
router.delete('/:id', deleteTransaction);

module.exports = router;
