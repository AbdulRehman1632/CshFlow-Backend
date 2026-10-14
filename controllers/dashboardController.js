const MonthlyBalance = require('../models/MonthlyBalance');
const Transaction = require('../models/Transaction');
const { calculateMonthlyMetrics } = require('./balanceController');

// @desc    Get All-Time / Overall dashboard analytics & month-over-month history
// @route   GET /api/dashboard/overall
// @access  Private
const getOverallAnalytics = async (req, res, next) => {
  try {
    const userId = req.user.id;

    // Fetch all balances and transactions for user
    const [allBalances, allTransactions] = await Promise.all([
      MonthlyBalance.find({ user: userId }).sort({ month: 1 }),
      Transaction.find({ user: userId }).sort({ date: 1 })
    ]);

    // Collect all unique months from both balances and transactions
    const monthsSet = new Set();
    allBalances.forEach((b) => monthsSet.add(b.month));
    allTransactions.forEach((t) => monthsSet.add(t.month));

    const sortedMonths = Array.from(monthsSet).sort();

    // Map balances by month
    const balanceMap = {};
    allBalances.forEach((b) => {
      balanceMap[b.month] = b;
    });

    // Group transactions by month
    const txByMonth = {};
    sortedMonths.forEach((m) => {
      txByMonth[m] = [];
    });
    allTransactions.forEach((t) => {
      if (txByMonth[t.month]) {
        txByMonth[t.month].push(t);
      }
    });

    // Compute metrics per month
    const monthlyHistory = [];
    let lifetimeTotalExpenses = 0;
    let lifetimeCashExpenses = 0;
    let lifetimeBankExpenses = 0;
    let lifetimeTotalIncome = 0;
    let lifetimeCashIncome = 0;
    let lifetimeBankIncome = 0;
    let lifetimeWithdrawals = 0;
    let lifetimeTransfers = 0;

    sortedMonths.forEach((month) => {
      const b = balanceMap[month] || { startingCashInHand: 0, startingCashInBank: 0 };
      const txs = txByMonth[month] || [];
      const metrics = calculateMonthlyMetrics(b, txs);

      lifetimeTotalExpenses += metrics.totalExpenses;
      lifetimeCashExpenses += metrics.cashExpenses;
      lifetimeBankExpenses += metrics.bankExpenses;
      lifetimeTotalIncome += metrics.totalIncome;
      lifetimeCashIncome += metrics.cashIncome;
      lifetimeBankIncome += metrics.bankIncome;
      lifetimeWithdrawals += metrics.withdrawals;
      lifetimeTransfers += metrics.transfers;

      monthlyHistory.push({
        month,
        ...metrics
      });
    });

    // Category breakdown across all time
    const lifetimeCategoryMap = {};
    allTransactions
      .filter((t) => t.type === 'expense')
      .forEach((t) => {
        const cat = t.category || 'Other';
        lifetimeCategoryMap[cat] = (lifetimeCategoryMap[cat] || 0) + Number(t.amount);
      });

    const lifetimeCategories = Object.entries(lifetimeCategoryMap)
      .map(([name, value]) => ({
        name,
        value: Number(value.toFixed(2))
      }))
      .sort((a, b) => b.value - a.value);

    // Latest month balances as current live position
    const latestMonthMetrics = monthlyHistory.length > 0 ? monthlyHistory[monthlyHistory.length - 1] : null;

    res.status(200).json({
      success: true,
      lifetime: {
        totalExpenses: Number(lifetimeTotalExpenses.toFixed(2)),
        cashExpenses: Number(lifetimeCashExpenses.toFixed(2)),
        bankExpenses: Number(lifetimeBankExpenses.toFixed(2)),
        totalIncome: Number(lifetimeTotalIncome.toFixed(2)),
        cashIncome: Number(lifetimeCashIncome.toFixed(2)),
        bankIncome: Number(lifetimeBankIncome.toFixed(2)),
        withdrawals: Number(lifetimeWithdrawals.toFixed(2)),
        transfers: Number(lifetimeTransfers.toFixed(2)),
        netSavings: Number((lifetimeTotalIncome - lifetimeTotalExpenses).toFixed(2)),
        totalTransactions: allTransactions.length,
        currentCashInHand: latestMonthMetrics ? latestMonthMetrics.closingCashInHand : 0,
        currentCashInBank: latestMonthMetrics ? latestMonthMetrics.closingCashInBank : 0,
        totalCurrentWealth: latestMonthMetrics ? latestMonthMetrics.totalClosingBalance : 0
      },
      monthlyHistory,
      lifetimeCategories
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Export transactions to CSV
// @route   GET /api/dashboard/export-csv
// @access  Private
const exportCSV = async (req, res, next) => {
  try {
    const { month } = req.query;
    const query = { user: req.user.id };
    if (month) query.month = month;

    const transactions = await Transaction.find(query).sort({ date: -1 });

    const headers = ['Date', 'Title', 'Type', 'Payment Method', 'Payment Channel', 'Category', 'Amount', 'Description', 'Month'];
    const rows = transactions.map((t) => [
      new Date(t.date).toISOString().slice(0, 10),
      `"${(t.title || '').replace(/"/g, '""')}"`,
      t.type,
      t.paymentMethod,
      `"${(t.paymentChannel || (t.paymentMethod === 'cash' ? 'Cash in Hand' : 'Bank / Raast')).replace(/"/g, '""')}"`,
      `"${(t.category || '').replace(/"/g, '""')}"`,
      t.amount,
      `"${(t.description || '').replace(/"/g, '""')}"`,
      t.month
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=transactions-${month || 'all'}.csv`);
    res.status(200).send(csvContent);
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getOverallAnalytics,
  exportCSV
};
