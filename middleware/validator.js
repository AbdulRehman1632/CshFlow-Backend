const { validationResult, check } = require('express-validator');

// Middleware to evaluate validation result
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      errors: errors.array().map(err => ({
        field: err.path || err.param,
        message: err.msg
      }))
    });
  }
  next();
};

// Auth Validations
const registerValidation = [
  check('name', 'Name is required').trim().notEmpty(),
  check('email', 'Please provide a valid email address').isEmail().normalizeEmail(),
  check('password', 'Password must be at least 6 characters').isLength({ min: 6 }),
  validate
];

const loginValidation = [
  check('email', 'Please provide a valid email address').isEmail().normalizeEmail(),
  check('password', 'Password is required').notEmpty(),
  validate
];

// Monthly Balance Validations
const monthlyBalanceValidation = [
  check('month', 'Month is required in YYYY-MM format').matches(/^\d{4}-(0[1-9]|1[0-2])$/),
  check('startingCashInHand', 'Starting Cash in Hand must be a positive number or zero').isFloat({ min: 0 }),
  check('startingCashInBank', 'Starting Cash in Bank must be a positive number or zero').isFloat({ min: 0 }),
  validate
];

// Transaction Validations
const transactionValidation = [
  check('title', 'Title is required').trim().notEmpty(),
  check('amount', 'Amount must be greater than zero').isFloat({ gt: 0 }),
  check('type', 'Transaction type must be expense, income, withdrawal, or transfer').isIn([
    'expense',
    'income',
    'withdrawal',
    'transfer'
  ]),
  check('paymentMethod', 'Payment method must be cash or bank').isIn(['cash', 'bank']),
  check('category', 'Category is required').trim().notEmpty(),
  check('date', 'Valid date is required').isISO8601().toDate(),
  validate
];

module.exports = {
  validate,
  registerValidation,
  loginValidation,
  monthlyBalanceValidation,
  transactionValidation
};
