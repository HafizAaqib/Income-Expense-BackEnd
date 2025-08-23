const mongoose = require('mongoose');

const categorySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Category name is required'],
      trim: true,
    },
    type: {
      type: String,
      enum: ['income', 'expense' , 'asset'],
      required: [true, 'Category type is required'],
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Category', categorySchema);
