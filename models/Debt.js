const mongoose = require('mongoose');

const DEBT_TYPES = ['GIVEN', 'RECEIVED_REPAYMENT', 'BORROWED', 'REPAID_BORROWING'];
const PAYMENT_SOURCES = ['CASH', 'BANK'];

const debtSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    personName: {
      type: String,
      required: [true, 'Person name is required'],
      trim: true,
      maxlength: [100, 'Person name cannot exceed 100 characters']
    },
    type: {
      type: String,
      enum: DEBT_TYPES,
      required: [true, 'Debt type is required']
    },
    amount: {
      type: Number,
      required: [true, 'Amount is required'],
      min: [0.01, 'Amount must be positive']
    },
    paymentSource: {
      type: String,
      enum: PAYMENT_SOURCES,
      required: [true, 'Payment source is required']
    },
    date: {
      type: Date,
      default: Date.now
    },
    notes: {
      type: String,
      trim: true,
      maxlength: [500, 'Notes cannot exceed 500 characters']
    },
    isSettled: {
      type: Boolean,
      default: false
    }
  },
  {
    timestamps: true
  }
);

// Compound indexes for efficient querying
debtSchema.index({ user: 1, personName: 1 });
debtSchema.index({ user: 1, type: 1 });
debtSchema.index({ user: 1, date: -1 });
debtSchema.index({ user: 1, isSettled: 1 });

const Debt = mongoose.model('Debt', debtSchema);

module.exports = Debt;
module.exports.DEBT_TYPES = DEBT_TYPES;
module.exports.PAYMENT_SOURCES = PAYMENT_SOURCES;
