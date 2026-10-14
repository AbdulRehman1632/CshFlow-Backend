const jwt = require('jsonwebtoken');
const User = require('../models/User');
const MonthlyBalance = require('../models/MonthlyBalance');
const Transaction = require('../models/Transaction');

// Helper to generate JWT Token
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET || 'secret_fallback_key', {
    expiresIn: process.env.JWT_EXPIRE || '30d'
  });
};

// @desc    Register a new user
// @route   POST /api/auth/register
// @access  Public
const register = async (req, res, next) => {
  try {
    const { name, email, password, currency, currencySymbol } = req.body;

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'An account with this email already exists'
      });
    }

    const user = await User.create({
      name,
      email,
      password,
      currency: currency || 'PKR',
      currencySymbol: currencySymbol || 'Rs '
    });

    const token = generateToken(user._id);

    // Auto-create current month's starting balance as baseline
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const isPkr = (currency || 'PKR') === 'PKR';
    await MonthlyBalance.create({
      user: user._id,
      month: currentMonth,
      startingCashInHand: isPkr ? 25000 : 500,
      startingCashInBank: isPkr ? 150000 : 2500,
      notes: 'Initial starting balance'
    }).catch(() => {});

    res.status(201).json({
      success: true,
      message: 'Account registered successfully',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        currency: user.currency,
        currencySymbol: user.currencySymbol
      }
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email }).select('+password');
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    const token = generateToken(user._id);

    res.status(200).json({
      success: true,
      message: 'Logged in successfully',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        currency: user.currency,
        currencySymbol: user.currencySymbol
      }
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Get current logged in user
// @route   GET /api/auth/me
// @access  Private
const getMe = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    res.status(200).json({
      success: true,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        currency: user.currency,
        currencySymbol: user.currencySymbol,
        createdAt: user.createdAt
      }
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Update user profile & currency settings
// @route   PUT /api/auth/profile
// @access  Private
const updateProfile = async (req, res, next) => {
  try {
    const { name, currency, currencySymbol } = req.body;
    const user = await User.findById(req.user.id);

    if (name) user.name = name;
    if (currency) user.currency = currency;
    if (currencySymbol) user.currencySymbol = currencySymbol;

    await user.save();

    res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        currency: user.currency,
        currencySymbol: user.currencySymbol
      }
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Seed rich sample demo data for current and previous month
// @route   POST /api/auth/seed-demo
// @access  Private
const seedDemoData = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const user = await User.findById(userId);
    const isPkr = !user || user.currency === 'PKR';

    // Remove existing test data for clean demo
    await Transaction.deleteMany({ user: userId });
    await MonthlyBalance.deleteMany({ user: userId });

    const now = new Date();
    const curYear = now.getFullYear();
    const curMonthNum = now.getMonth() + 1;
    const curMonth = `${curYear}-${String(curMonthNum).padStart(2, '0')}`;

    // Previous month
    const prevDate = new Date(curYear, now.getMonth() - 1, 1);
    const prevMonth = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`;

    // 1. Create Monthly Balances
    await MonthlyBalance.create([
      {
        user: userId,
        month: prevMonth,
        startingCashInHand: isPkr ? 20000 : 450,
        startingCashInBank: isPkr ? 140000 : 3200,
        notes: 'Opening balance for previous month'
      },
      {
        user: userId,
        month: curMonth,
        startingCashInHand: isPkr ? 25000 : 600,
        startingCashInBank: isPkr ? 185000 : 4100,
        notes: 'Opening balance for current month'
      }
    ]);

    // 2. Create Sample Transactions for Current Month
    const sampleTransactions = isPkr
      ? [
          {
            user: userId,
            title: 'Monthly Tech Salary',
            description: 'Direct corporate deposit via Raast',
            amount: 220000,
            type: 'income',
            paymentMethod: 'bank',
            paymentChannel: 'Bank Transfer / Raast',
            category: 'Salary & Wages',
            date: new Date(curYear, now.getMonth(), 1, 10, 0),
            month: curMonth
          },
          {
            user: userId,
            title: 'Apartment Rent',
            description: 'Monthly flat rent wire transfer',
            amount: 45000,
            type: 'expense',
            paymentMethod: 'bank',
            paymentChannel: 'Bank Transfer / Raast',
            category: 'Rent & Housing',
            date: new Date(curYear, now.getMonth(), 2, 11, 30),
            month: curMonth
          },
          {
            user: userId,
            title: 'ATM Cash Withdrawal',
            description: 'Withdrew pocket cash from Meezan ATM',
            amount: 20000,
            type: 'withdrawal',
            paymentMethod: 'bank',
            paymentChannel: 'ATM / Cash-Out',
            category: 'ATM Withdrawal',
            date: new Date(curYear, now.getMonth(), 3, 14, 15),
            month: curMonth
          },
          {
            user: userId,
            title: 'Imtiaz Super Market Grocery',
            description: 'Monthly pantry & fresh produce',
            amount: 18500,
            type: 'expense',
            paymentMethod: 'cash',
            paymentChannel: 'Cash in Hand',
            category: 'Groceries',
            date: new Date(curYear, now.getMonth(), 4, 16, 45),
            month: curMonth
          },
          {
            user: userId,
            title: 'K-Electric Electricity Bill',
            description: 'Paid via Easypaisa App',
            amount: 14200,
            type: 'expense',
            paymentMethod: 'bank',
            paymentChannel: 'Easypaisa',
            category: 'Utilities & Bills',
            date: new Date(curYear, now.getMonth(), 5, 9, 20),
            month: curMonth
          },
          {
            user: userId,
            title: 'StormFiber High-Speed Internet',
            description: 'Monthly fiber broadband via JazzCash',
            amount: 3850,
            type: 'expense',
            paymentMethod: 'bank',
            paymentChannel: 'JazzCash',
            category: 'Utilities & Bills',
            date: new Date(curYear, now.getMonth(), 6, 8, 30),
            month: curMonth
          },
          {
            user: userId,
            title: 'Upwork Freelance Consulting',
            description: 'Design milestone payment received',
            amount: 65000,
            type: 'income',
            paymentMethod: 'bank',
            paymentChannel: 'Bank Transfer / Raast',
            category: 'Business & Freelance',
            date: new Date(curYear, now.getMonth(), 8, 17, 0),
            month: curMonth
          },
          {
            user: userId,
            title: 'PSO Fuel & Petrol',
            description: 'Car fuel refill via SadaPay card',
            amount: 7500,
            type: 'expense',
            paymentMethod: 'bank',
            paymentChannel: 'SadaPay',
            category: 'Transport & Fuel',
            date: new Date(curYear, now.getMonth(), 9, 12, 10),
            month: curMonth
          },
          {
            user: userId,
            title: 'Cafe & Dining Out',
            description: 'Weekend dinner via NayaPay',
            amount: 3200,
            type: 'expense',
            paymentMethod: 'bank',
            paymentChannel: 'NayaPay',
            category: 'Food & Dining',
            date: new Date(curYear, now.getMonth(), 10, 20, 30),
            month: curMonth
          },
          {
            user: userId,
            title: 'Chai Dhaba & Bakery',
            description: 'Evening tea and bakery snacks',
            amount: 850,
            type: 'expense',
            paymentMethod: 'cash',
            paymentChannel: 'Cash in Hand',
            category: 'Food & Dining',
            date: new Date(curYear, now.getMonth(), 11, 18, 0),
            month: curMonth
          }
        ]
      : [
          {
            user: userId,
            title: 'Monthly Tech Salary',
            description: 'Direct corporate deposit',
            amount: 5200,
            type: 'income',
            paymentMethod: 'bank',
            paymentChannel: 'Bank / Online',
            category: 'Salary & Wages',
            date: new Date(curYear, now.getMonth(), 1, 10, 0),
            month: curMonth
          },
          {
            user: userId,
            title: 'Apartment Rent',
            description: 'Monthly flat rent wire transfer',
            amount: 1450,
            type: 'expense',
            paymentMethod: 'bank',
            paymentChannel: 'Bank / Online',
            category: 'Rent & Housing',
            date: new Date(curYear, now.getMonth(), 2, 11, 30),
            month: curMonth
          },
          {
            user: userId,
            title: 'ATM Cash Withdrawal',
            description: 'Withdrew pocket cash from Downtown ATM',
            amount: 300,
            type: 'withdrawal',
            paymentMethod: 'bank',
            paymentChannel: 'ATM / Cash-Out',
            category: 'ATM Withdrawal',
            date: new Date(curYear, now.getMonth(), 3, 14, 15),
            month: curMonth
          },
      {
        user: userId,
        title: 'Supermarket Groceries',
        description: 'Weekly organic pantry & fresh produce',
        amount: 142.50,
        type: 'expense',
        paymentMethod: 'cash',
        category: 'Groceries',
        date: new Date(curYear, now.getMonth(), 4, 16, 45),
        month: curMonth
      },
      {
        user: userId,
        title: 'High-Speed Fiber Internet',
        description: 'Monthly broadband subscription',
        amount: 75.00,
        type: 'expense',
        paymentMethod: 'bank',
        category: 'Utilities & Bills',
        date: new Date(curYear, now.getMonth(), 5, 9, 20),
        month: curMonth
      },
      {
        user: userId,
        title: 'Coffee & Artisanal Bakery',
        description: 'Espresso and croissants with team',
        amount: 22.80,
        type: 'expense',
        paymentMethod: 'cash',
        category: 'Food & Dining',
        date: new Date(curYear, now.getMonth(), 6, 8, 30),
        month: curMonth
      },
      {
        user: userId,
        title: 'Freelance Design Consulting',
        description: 'Brand identity milestone payment',
        amount: 850,
        type: 'income',
        paymentMethod: 'bank',
        category: 'Business & Freelance',
        date: new Date(curYear, now.getMonth(), 8, 17, 0),
        month: curMonth
      },
      {
        user: userId,
        title: 'Metro / Fuel Card Reload',
        description: 'Commute transit pass',
        amount: 60.00,
        type: 'expense',
        paymentMethod: 'bank',
        category: 'Transport & Fuel',
        date: new Date(curYear, now.getMonth(), 9, 12, 10),
        month: curMonth
      },
      {
        user: userId,
        title: 'Neighborhood Farmers Market',
        description: 'Fresh fruits and bakery items',
        amount: 48.00,
        type: 'expense',
        paymentMethod: 'cash',
        category: 'Groceries',
        date: new Date(curYear, now.getMonth(), 10, 11, 0),
        month: curMonth
      },
      {
        user: userId,
        title: 'Fitness Gym Membership',
        description: 'Monthly recurring gym access',
        amount: 55.00,
        type: 'expense',
        paymentMethod: 'bank',
        category: 'Health & Medical',
        date: new Date(curYear, now.getMonth(), 11, 10, 0),
        month: curMonth
      },
      {
        user: userId,
        title: 'Weekend Bistro Dinner',
        description: 'Dinner with family',
        amount: 110.00,
        type: 'expense',
        paymentMethod: 'bank',
        category: 'Food & Dining',
        date: new Date(curYear, now.getMonth(), 12, 20, 30),
        month: curMonth
      }
    ];

    // Previous month transactions for comparisons
    sampleTransactions.push(
      {
        user: userId,
        title: 'Previous Tech Salary',
        description: 'Monthly paycheck',
        amount: 5200,
        type: 'income',
        paymentMethod: 'bank',
        category: 'Salary & Wages',
        date: new Date(prevDate.getFullYear(), prevDate.getMonth(), 1, 10, 0),
        month: prevMonth
      },
      {
        user: userId,
        title: 'Apartment Rent',
        description: 'Wire transfer',
        amount: 1450,
        type: 'expense',
        paymentMethod: 'bank',
        category: 'Rent & Housing',
        date: new Date(prevDate.getFullYear(), prevDate.getMonth(), 2, 11, 0),
        month: prevMonth
      },
      {
        user: userId,
        title: 'ATM Cash Withdrawal',
        description: 'Cash for month',
        amount: 400,
        type: 'withdrawal',
        paymentMethod: 'bank',
        category: 'ATM Withdrawal',
        date: new Date(prevDate.getFullYear(), prevDate.getMonth(), 4, 15, 0),
        month: prevMonth
      },
      {
        user: userId,
        title: 'Groceries & Sundries',
        description: 'Supermarket visit',
        amount: 320,
        type: 'expense',
        paymentMethod: 'cash',
        category: 'Groceries',
        date: new Date(prevDate.getFullYear(), prevDate.getMonth(), 7, 18, 0),
        month: prevMonth
      },
      {
        user: userId,
        title: 'Electricity & Gas Bill',
        description: 'Municipal utility invoice',
        amount: 115,
        type: 'expense',
        paymentMethod: 'bank',
        category: 'Utilities & Bills',
        date: new Date(prevDate.getFullYear(), prevDate.getMonth(), 14, 10, 0),
        month: prevMonth
      }
    );

    await Transaction.create(sampleTransactions);

    res.status(200).json({
      success: true,
      message: 'Demo financial data loaded successfully!'
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  register,
  login,
  getMe,
  updateProfile,
  seedDemoData
};
