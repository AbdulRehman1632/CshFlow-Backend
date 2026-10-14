const mongoose = require('mongoose');

const MonthlyBalanceSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    month: {
      type: String,
      required: [true, 'Month is required in YYYY-MM format'],
      match: [/^\d{4}-(0[1-9]|1[0-2])$/, 'Month format must be YYYY-MM (e.g. 2026-10)'],
      index: true
    },
    startingCashInHand: {
      type: Number,
      required: [true, 'Starting Cash in Hand balance is required'],
      default: 0,
      min: [0, 'Starting cash balance cannot be negative']
    },
    startingCashInBank: {
      type: Number,
      required: [true, 'Starting Cash in Bank balance is required'],
      default: 0,
      min: [0, 'Starting bank balance cannot be negative']
    },
    notes: {
      type: String,
      default: '',
      maxlength: [500, 'Notes cannot exceed 500 characters']
    }
  },
  {
    timestamps: true
  }
);

// Ensure one monthly opening balance document per user per month
MonthlyBalanceSchema.index({ user: 1, month: 1 }, { unique: true });

module.exports = mongoose.model('MonthlyBalance', MonthlyBalanceSchema);
