const mongoose = require('mongoose');
const Debt = require('../models/Debt');
const MonthlyBalance = require('../models/MonthlyBalance');

// Helper: adjust the current month's MonthlyBalance based on a debt operation.
// direction: +1 = add to balance (money coming in), -1 = subtract (money going out)
async function adjustBalance(userId, paymentSource, amount, direction) {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  // Map payment source to balance field
  const updateField =
    paymentSource === 'CASH' ? 'startingCashInHand' : 'startingCashInBank';

  const delta = Number(amount) * direction;

  await MonthlyBalance.findOneAndUpdate(
    { user: userId, year, month },
    { $inc: { [updateField]: delta } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
}

// @desc   Get all debt records with optional filters
// @route  GET /api/debts
// @access Private
exports.getDebts = async (req, res, next) => {
  try {
    const { personName, type, isSettled, page = 1, limit = 200 } = req.query;
    const filter = { user: req.user._id };

    if (personName) filter.personName = { $regex: personName, $options: 'i' };
    if (type) filter.type = type;
    if (isSettled !== undefined && isSettled !== '') {
      filter.isSettled = isSettled === 'true';
    }

    const skip = (Number(page) - 1) * Number(limit);

    const [debts, total] = await Promise.all([
      Debt.find(filter).sort({ date: -1, createdAt: -1 }).skip(skip).limit(Number(limit)),
      Debt.countDocuments(filter)
    ]);

    res.json({ success: true, data: debts, total, page: Number(page) });
  } catch (err) {
    next(err);
  }
};

// @desc   Get debt summary: overall totals and per-person ledger
// @route  GET /api/debts/summary
// @access Private
exports.getDebtSummary = async (req, res, next) => {
  try {
    const userId = req.user._id;

    // Aggregate totals by type
    const totals = await Debt.aggregate([
      { $match: { user: new mongoose.Types.ObjectId(userId) } },
      {
        $group: {
          _id: '$type',
          total: { $sum: '$amount' },
          count: { $sum: 1 }
        }
      }
    ]);

    const summary = { GIVEN: 0, RECEIVED_REPAYMENT: 0, BORROWED: 0, REPAID_BORROWING: 0 };
    const counts = { GIVEN: 0, RECEIVED_REPAYMENT: 0, BORROWED: 0, REPAID_BORROWING: 0 };

    totals.forEach((t) => {
      summary[t._id] = t.total;
      counts[t._id] = t.count;
    });

    // Per-person aggregation — group amounts by type per person
    const perPerson = await Debt.aggregate([
      { $match: { user: new mongoose.Types.ObjectId(userId) } },
      {
        $group: {
          _id: { personName: '$personName', type: '$type' },
          total: { $sum: '$amount' },
          lastDate: { $max: '$date' },
          entryCount: { $sum: 1 }
        }
      },
      {
        $group: {
          _id: '$_id.personName',
          typeBreakdown: {
            $push: {
              type: '$_id.type',
              total: '$total',
              lastDate: '$lastDate',
              count: '$entryCount'
            }
          },
          totalTransactions: { $sum: '$entryCount' },
          lastActivity: { $max: '$lastDate' }
        }
      },
      { $sort: { lastActivity: -1 } }
    ]);

    // Build per-person net balance objects
    const personLedger = perPerson.map((p) => {
      let given = 0,
        receivedBack = 0,
        borrowed = 0,
        repaid = 0;

      p.typeBreakdown.forEach((e) => {
        if (e.type === 'GIVEN') given += e.total;
        else if (e.type === 'RECEIVED_REPAYMENT') receivedBack += e.total;
        else if (e.type === 'BORROWED') borrowed += e.total;
        else if (e.type === 'REPAID_BORROWING') repaid += e.total;
      });

      const rawReceivable = given - receivedBack; // how much they owe you
      const rawPayable = borrowed - repaid; // how much you owe them
      const netBalance = rawReceivable - rawPayable; // positive = person owes you net

      return {
        personName: p._id,
        given,
        receivedBack,
        borrowed,
        repaid,
        netReceivable: Math.max(0, rawReceivable),
        netPayable: Math.max(0, rawPayable),
        netBalance,
        totalTransactions: p.totalTransactions,
        lastActivity: p.lastActivity
      };
    });

    // Sort: people with outstanding balances first (highest absolute net)
    personLedger.sort((a, b) => Math.abs(b.netBalance) - Math.abs(a.netBalance));

    const totalGiven = summary.GIVEN;
    const totalReceivedBack = summary.RECEIVED_REPAYMENT;
    const totalBorrowed = summary.BORROWED;
    const totalRepaid = summary.REPAID_BORROWING;

    res.json({
      success: true,
      data: {
        totalGiven,
        totalReceivedBack,
        totalBorrowed,
        totalRepaid,
        netReceivable: Math.max(0, totalGiven - totalReceivedBack),
        netPayable: Math.max(0, totalBorrowed - totalRepaid),
        counts,
        personLedger
      }
    });
  } catch (err) {
    next(err);
  }
};

// @desc   Create a new debt record
// @route  POST /api/debts
// @access Private
exports.createDebt = async (req, res, next) => {
  try {
    const { personName, type, amount, paymentSource, date, notes } = req.body;

    // Basic validation
    if (!personName || !type || !amount || !paymentSource) {
      return res.status(400).json({
        success: false,
        message: 'personName, type, amount, and paymentSource are required'
      });
    }

    const validTypes = ['GIVEN', 'RECEIVED_REPAYMENT', 'BORROWED', 'REPAID_BORROWING'];
    if (!validTypes.includes(type)) {
      return res.status(400).json({ success: false, message: 'Invalid debt type' });
    }

    const validSources = ['CASH', 'BANK'];
    if (!validSources.includes(paymentSource)) {
      return res.status(400).json({ success: false, message: 'Invalid payment source' });
    }

    const numAmount = Number(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      return res.status(400).json({ success: false, message: 'Amount must be a positive number' });
    }

    const debt = await Debt.create({
      user: req.user._id,
      personName: personName.trim(),
      type,
      amount: numAmount,
      paymentSource,
      date: date ? new Date(date) : new Date(),
      notes: notes ? notes.trim() : ''
    });

    // Balance sync:
    //   GIVEN (you lent money out)         → deduct from your balance
    //   REPAID_BORROWING (you repaid debt) → deduct from your balance
    //   BORROWED (you received a loan)     → add to your balance
    //   RECEIVED_REPAYMENT (got money back)→ add to your balance
    if (type === 'GIVEN' || type === 'REPAID_BORROWING') {
      await adjustBalance(req.user._id, paymentSource, numAmount, -1);
    } else if (type === 'BORROWED' || type === 'RECEIVED_REPAYMENT') {
      await adjustBalance(req.user._id, paymentSource, numAmount, +1);
    }

    res.status(201).json({
      success: true,
      data: debt,
      message: 'Udhar record saved successfully'
    });
  } catch (err) {
    next(err);
  }
};

// @desc   Update a debt record
// @route  PUT /api/debts/:id
// @access Private
exports.updateDebt = async (req, res, next) => {
  try {
    const debt = await Debt.findOne({ _id: req.params.id, user: req.user._id });
    if (!debt) {
      return res.status(404).json({ success: false, message: 'Debt record not found' });
    }

    const { personName, type, amount, paymentSource, date, notes, isSettled } = req.body;

    // Step 1: Reverse the OLD balance effect
    if (debt.type === 'GIVEN' || debt.type === 'REPAID_BORROWING') {
      await adjustBalance(req.user._id, debt.paymentSource, debt.amount, +1);
    } else if (debt.type === 'BORROWED' || debt.type === 'RECEIVED_REPAYMENT') {
      await adjustBalance(req.user._id, debt.paymentSource, debt.amount, -1);
    }

    // Step 2: Apply field updates
    const newType = type || debt.type;
    const newAmount = amount !== undefined ? Number(amount) : debt.amount;
    const newPaymentSource = paymentSource || debt.paymentSource;

    if (personName) debt.personName = personName.trim();
    debt.type = newType;
    debt.amount = newAmount;
    debt.paymentSource = newPaymentSource;
    if (date) debt.date = new Date(date);
    if (notes !== undefined) debt.notes = notes.trim();
    if (isSettled !== undefined) debt.isSettled = Boolean(isSettled);

    await debt.save();

    // Step 3: Apply NEW balance effect
    if (newType === 'GIVEN' || newType === 'REPAID_BORROWING') {
      await adjustBalance(req.user._id, newPaymentSource, newAmount, -1);
    } else if (newType === 'BORROWED' || newType === 'RECEIVED_REPAYMENT') {
      await adjustBalance(req.user._id, newPaymentSource, newAmount, +1);
    }

    res.json({ success: true, data: debt, message: 'Debt record updated successfully' });
  } catch (err) {
    next(err);
  }
};

// @desc   Delete a debt record and reverse balance effect
// @route  DELETE /api/debts/:id
// @access Private
exports.deleteDebt = async (req, res, next) => {
  try {
    const debt = await Debt.findOne({ _id: req.params.id, user: req.user._id });
    if (!debt) {
      return res.status(404).json({ success: false, message: 'Debt record not found' });
    }

    // Reverse the balance effect before deletion
    if (debt.type === 'GIVEN' || debt.type === 'REPAID_BORROWING') {
      await adjustBalance(req.user._id, debt.paymentSource, debt.amount, +1);
    } else if (debt.type === 'BORROWED' || debt.type === 'RECEIVED_REPAYMENT') {
      await adjustBalance(req.user._id, debt.paymentSource, debt.amount, -1);
    }

    await Debt.deleteOne({ _id: debt._id });

    res.json({ success: true, message: 'Debt record deleted and balance restored' });
  } catch (err) {
    next(err);
  }
};
