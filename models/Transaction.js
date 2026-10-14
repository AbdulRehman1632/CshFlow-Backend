const mongoose = require('mongoose');

const TransactionSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    title: {
      type: String,
      required: [true, 'Transaction title is required'],
      trim: true,
      maxlength: [120, 'Title cannot exceed 120 characters']
    },
    description: {
      type: String,
      trim: true,
      default: '',
      maxlength: [300, 'Description cannot exceed 300 characters']
    },
    amount: {
      type: Number,
      required: [true, 'Amount is required'],
      min: [0.01, 'Amount must be greater than zero']
    },
    type: {
      type: String,
      required: [true, 'Transaction type is required'],
      enum: {
        values: ['expense', 'income', 'withdrawal', 'transfer'],
        message: '{VALUE} is not a valid transaction type'
      }
    },
    paymentMethod: {
      type: String,
      required: [true, 'Payment method is required'],
      enum: {
        values: ['cash', 'bank'],
        message: '{VALUE} must be either cash or bank'
      }
    },
    paymentChannel: {
      type: String,
      default: 'Cash',
      trim: true
    },
    category: {
      type: String,
      required: [true, 'Category is required'],
      default: 'Other'
    },
    date: {
      type: Date,
      required: [true, 'Transaction date is required'],
      default: Date.now,
      index: true
    },
    month: {
      type: String,
      required: true,
      index: true,
      match: [/^\d{4}-(0[1-9]|1[0-2])$/, 'Month format must be YYYY-MM']
    },
    tags: {
      type: [String],
      default: []
    }
  },
  {
    timestamps: true
  }
);

// Pre-validate or pre-save hook to populate 'month' from 'date' if not specified
TransactionSchema.pre('validate', function (next) {
  if (this.date && !this.month) {
    const d = new Date(this.date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    this.month = `${year}-${month}`;
  }
  next();
});

// Compound indexes for high-speed filtered queries
TransactionSchema.index({ user: 1, month: 1, date: -1 });
TransactionSchema.index({ user: 1, type: 1 });
TransactionSchema.index({ user: 1, paymentMethod: 1 });

module.exports = mongoose.model('Transaction', TransactionSchema);
