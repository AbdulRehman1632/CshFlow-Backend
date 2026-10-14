const Transaction = require('../models/Transaction');

const DEFAULT_CATEGORIES = [
  'Food & Dining',
  'Groceries',
  'Utilities & Bills',
  'Rent & Housing',
  'Transport & Fuel',
  'Shopping & Clothing',
  'Health & Medical',
  'Entertainment & Leisure',
  'Education',
  'Salary & Wages',
  'Business & Freelance',
  'Investment & Returns',
  'ATM Withdrawal',
  'Bank Deposit',
  'Other'
];

// @desc    Get all transactions with filtering, search, and pagination
// @route   GET /api/transactions
// @access  Private
const getTransactions = async (req, res, next) => {
  try {
    const {
      month,
      type,
      paymentMethod,
      category,
      search,
      startDate,
      endDate,
      sort = '-date',
      page = 1,
      limit = 50
    } = req.query;

    const query = { user: req.user.id };

    if (month) {
      query.month = month;
    }

    if (type) {
      query.type = type;
    }

    if (paymentMethod) {
      query.paymentMethod = paymentMethod;
    }

    if (req.query.paymentChannel) {
      query.paymentChannel = req.query.paymentChannel;
    }

    if (category) {
      query.category = category;
    }

    if (startDate || endDate) {
      query.date = {};
      if (startDate) query.date.$gte = new Date(startDate);
      if (endDate) query.date.$lte = new Date(endDate);
    }

    if (search) {
      const searchRegex = new RegExp(search, 'i');
      query.$or = [{ title: searchRegex }, { description: searchRegex }];
    }

    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    const skip = (pageNum - 1) * limitNum;

    const [transactions, total] = await Promise.all([
      Transaction.find(query)
        .sort(sort)
        .skip(skip)
        .limit(limitNum),
      Transaction.countDocuments(query)
    ]);

    res.status(200).json({
      success: true,
      count: transactions.length,
      total,
      page: pageNum,
      totalPages: Math.ceil(total / limitNum) || 1,
      data: transactions
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Get single transaction by ID
// @route   GET /api/transactions/:id
// @access  Private
const getTransactionById = async (req, res, next) => {
  try {
    const transaction = await Transaction.findOne({
      _id: req.params.id,
      user: req.user.id
    });

    if (!transaction) {
      return res.status(404).json({
        success: false,
        message: 'Transaction not found'
      });
    }

    res.status(200).json({
      success: true,
      data: transaction
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Create a new transaction
// @route   POST /api/transactions
// @access  Private
const createTransaction = async (req, res, next) => {
  try {
    const { title, description, amount, type, paymentMethod, paymentChannel, category, date, tags } = req.body;

    const txDate = date ? new Date(date) : new Date();
    const year = txDate.getFullYear();
    const month = `${year}-${String(txDate.getMonth() + 1).padStart(2, '0')}`;

    // Auto category fallback for transfers/withdrawals if not set
    let finalCategory = category;
    if (!finalCategory) {
      if (type === 'withdrawal') finalCategory = 'ATM Withdrawal';
      else if (type === 'transfer') finalCategory = 'Bank Deposit';
      else finalCategory = 'Other';
    }

    // Default paymentChannel based on paymentMethod if not specified
    let finalChannel = paymentChannel;
    if (!finalChannel) {
      if (paymentMethod === 'cash') finalChannel = 'Cash in Hand';
      else if (type === 'withdrawal') finalChannel = 'ATM / Cash-Out';
      else finalChannel = 'Bank Account / Raast';
    }

    const transaction = await Transaction.create({
      user: req.user.id,
      title,
      description: description || '',
      amount: Number(amount),
      type,
      paymentMethod,
      paymentChannel: finalChannel,
      category: finalCategory,
      date: txDate,
      month,
      tags: tags || []
    });

    res.status(201).json({
      success: true,
      message: 'Transaction recorded successfully',
      data: transaction
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Update an existing transaction
// @route   PUT /api/transactions/:id
// @access  Private
const updateTransaction = async (req, res, next) => {
  try {
    const transaction = await Transaction.findOne({
      _id: req.params.id,
      user: req.user.id
    });

    if (!transaction) {
      return res.status(404).json({
        success: false,
        message: 'Transaction not found'
      });
    }

    const { title, description, amount, type, paymentMethod, paymentChannel, category, date, tags } = req.body;

    if (title !== undefined) transaction.title = title;
    if (description !== undefined) transaction.description = description;
    if (amount !== undefined) transaction.amount = Number(amount);
    if (type !== undefined) transaction.type = type;
    if (paymentMethod !== undefined) transaction.paymentMethod = paymentMethod;
    if (paymentChannel !== undefined) transaction.paymentChannel = paymentChannel;
    if (category !== undefined) transaction.category = category;
    if (tags !== undefined) transaction.tags = tags;

    if (date !== undefined) {
      const txDate = new Date(date);
      transaction.date = txDate;
      const year = txDate.getFullYear();
      transaction.month = `${year}-${String(txDate.getMonth() + 1).padStart(2, '0')}`;
    }

    await transaction.save();

    res.status(200).json({
      success: true,
      message: 'Transaction updated successfully',
      data: transaction
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Delete a transaction
// @route   DELETE /api/transactions/:id
// @access  Private
const deleteTransaction = async (req, res, next) => {
  try {
    const transaction = await Transaction.findOneAndDelete({
      _id: req.params.id,
      user: req.user.id
    });

    if (!transaction) {
      return res.status(404).json({
        success: false,
        message: 'Transaction not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Transaction deleted successfully',
      data: { id: req.params.id }
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Get categories (defaults + any custom ones created by user)
// @route   GET /api/transactions/categories
// @access  Private
const getCategories = async (req, res, next) => {
  try {
    const userCategories = await Transaction.distinct('category', { user: req.user.id });
    const allCategories = Array.from(new Set([...DEFAULT_CATEGORIES, ...userCategories])).sort();

    res.status(200).json({
      success: true,
      data: allCategories
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getTransactions,
  getTransactionById,
  createTransaction,
  updateTransaction,
  deleteTransaction,
  getCategories
};
