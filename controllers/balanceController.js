const MonthlyBalance = require('../models/MonthlyBalance');
const Transaction = require('../models/Transaction');

// Helper to compute cash flow balances
const calculateMonthlyMetrics = (startingBalance, transactions) => {
  const startingCashInHand = Number(startingBalance?.startingCashInHand || 0);
  const startingCashInBank = Number(startingBalance?.startingCashInBank || 0);

  let cashExpenses = 0;
  let bankExpenses = 0;
  let cashIncome = 0;
  let bankIncome = 0;
  let withdrawals = 0; // Bank -> Cash
  let transfers = 0;   // Cash -> Bank

  transactions.forEach((tx) => {
    const amt = Number(tx.amount);
    if (tx.type === 'expense') {
      if (tx.paymentMethod === 'cash') cashExpenses += amt;
      else bankExpenses += amt;
    } else if (tx.type === 'income') {
      if (tx.paymentMethod === 'cash') cashIncome += amt;
      else bankIncome += amt;
    } else if (tx.type === 'withdrawal') {
      // ATM / Bank to Cash
      withdrawals += amt;
    } else if (tx.type === 'transfer') {
      // Cash deposited into Bank
      transfers += amt;
    }
  });

  const totalExpenses = cashExpenses + bankExpenses;
  const totalIncome = cashIncome + bankIncome;

  // Running closing balances
  const closingCashInHand = startingCashInHand + cashIncome - cashExpenses + withdrawals - transfers;
  const closingCashInBank = startingCashInBank + bankIncome - bankExpenses - withdrawals + transfers;
  const totalStartingBalance = startingCashInHand + startingCashInBank;
  const totalClosingBalance = closingCashInHand + closingCashInBank;
  const netCashFlow = totalIncome - totalExpenses;

  return {
    startingCashInHand,
    startingCashInBank,
    totalStartingBalance,
    cashExpenses,
    bankExpenses,
    totalExpenses,
    cashIncome,
    bankIncome,
    totalIncome,
    withdrawals,
    transfers,
    closingCashInHand,
    closingCashInBank,
    totalClosingBalance,
    netCashFlow,
    transactionCount: transactions.length
  };
};

// @desc    Get opening balances for a given month
// @route   GET /api/balances/:month
// @access  Private
const getMonthlyBalance = async (req, res, next) => {
  try {
    const { month } = req.params;
    let balance = await MonthlyBalance.findOne({
      user: req.user.id,
      month
    });

    if (!balance) {
      return res.status(200).json({
        success: true,
        data: {
          month,
          startingCashInHand: 0,
          startingCashInBank: 0,
          notes: '',
          isDefault: true
        }
      });
    }

    res.status(200).json({
      success: true,
      data: balance
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Create or update opening balances for a month
// @route   POST /api/balances
// @access  Private
const setMonthlyBalance = async (req, res, next) => {
  try {
    const { month, startingCashInHand, startingCashInBank, notes } = req.body;

    const balance = await MonthlyBalance.findOneAndUpdate(
      { user: req.user.id, month },
      {
        user: req.user.id,
        month,
        startingCashInHand: Number(startingCashInHand),
        startingCashInBank: Number(startingCashInBank),
        notes: notes || ''
      },
      { new: true, upsert: true, runValidators: true }
    );

    res.status(200).json({
      success: true,
      message: `Starting balance for ${month} saved successfully`,
      data: balance
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Get detailed summary & metrics for a given month
// @route   GET /api/balances/:month/summary
// @access  Private
const getMonthlySummary = async (req, res, next) => {
  try {
    const { month } = req.params;

    const [balance, transactions] = await Promise.all([
      MonthlyBalance.findOne({ user: req.user.id, month }),
      Transaction.find({ user: req.user.id, month }).sort({ date: -1 })
    ]);

    const metrics = calculateMonthlyMetrics(balance, transactions);

    // Group expenses by category
    const categoryBreakdown = {};
    transactions
      .filter((t) => t.type === 'expense')
      .forEach((t) => {
        const cat = t.category || 'Other';
        categoryBreakdown[cat] = (categoryBreakdown[cat] || 0) + Number(t.amount);
      });

    const categoryArray = Object.entries(categoryBreakdown).map(([name, value]) => ({
      name,
      value: Number(value.toFixed(2))
    })).sort((a, b) => b.value - a.value);

    // Group daily expense trends
    const dailyMap = {};
    transactions.forEach((t) => {
      const day = new Date(t.date).toISOString().slice(0, 10);
      if (!dailyMap[day]) {
        dailyMap[day] = { date: day, expense: 0, income: 0, cashExpense: 0, bankExpense: 0 };
      }
      if (t.type === 'expense') {
        dailyMap[day].expense += Number(t.amount);
        if (t.paymentMethod === 'cash') dailyMap[day].cashExpense += Number(t.amount);
        else dailyMap[day].bankExpense += Number(t.amount);
      } else if (t.type === 'income') {
        dailyMap[day].income += Number(t.amount);
      }
    });

    const dailyTrends = Object.values(dailyMap).sort((a, b) => a.date.localeCompare(b.date));

    res.status(200).json({
      success: true,
      month,
      metrics,
      categoryBreakdown: categoryArray,
      dailyTrends
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getMonthlyBalance,
  setMonthlyBalance,
  getMonthlySummary,
  calculateMonthlyMetrics
};
