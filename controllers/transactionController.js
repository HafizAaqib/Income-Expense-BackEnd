const transactionModel = require('../models/transactionModel');

// Create a new transaction
const createTransaction = async (req, res) => {
  try {
    const newTransaction = new transactionModel(req.body);
    await newTransaction.save();
    res.status(201).json({ success: true, transaction: newTransaction });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message || error });
  }
};

// ✅ Get all transactions (with optional filters)
const getAllTransactions = async (req, res) => {
  try {
    const { type, category, startDate, endDate, search } = req.query;

    const filter = {};

    if (type) filter.type = type;
    if (category) filter.category = category;
    if (startDate || endDate) {
      filter.date = {};
      if (startDate) filter.date.$gte = new Date(startDate);
      if (endDate) filter.date.$lte = new Date(endDate);
    }
    if (search) {
      console.log('search' , search);
      filter.$or = [
        { phoneNumber: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { reference: { $regex: search, $options: 'i' } },
      ];
    }
    

    const transactions = await transactionModel.find(filter)
    .populate('category') // pulls category object with name
    .sort({ date: -1 });
    res.status(200).json({ success: true, transactions });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message || error });
  }
};

const getDashboardSummary = async (req, res) => {
  try {
    const { month, year } = req.query;
    const selectedMonth = parseInt(month);
    const selectedYear = parseInt(year);

    const startDate = new Date(selectedYear, selectedMonth - 1, 1);
    const endDate = new Date(selectedYear, selectedMonth, 0, 23, 59, 59);

    const allTransactions = await transactionModel.find({
      date: { $gte: startDate, $lte: endDate }
    }).populate('category');

    const income = allTransactions.filter(t => t.type === 'income');
    const expense = allTransactions.filter(t => t.type === 'expense');

    const incomeTotal = income.reduce((sum, t) => sum + t.amount, 0);
    const expenseTotal = expense.reduce((sum, t) => sum + t.amount, 0);
    const balance = incomeTotal - expenseTotal;

    const getCategoryTotals = (transactions) => {
      const categoryMap = {};
      for (const t of transactions) {
        const cat = t.category?.name || 'Unknown';
        categoryMap[cat] = (categoryMap[cat] || 0) + t.amount;
      }
      return Object.entries(categoryMap).map(([name, amount]) => ({ name, amount }));
    };

    const incomeByCategory = getCategoryTotals(income);
    const expenseByCategory = getCategoryTotals(expense);

    res.json({
      success: true,
      data: {
        summary: { incomeTotal, expenseTotal, balance },
        incomeByCategory,
        expenseByCategory
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Update a transaction
const updateTransaction = async (req, res) => {
  try {
    const updated = await transactionModel.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );
    if (!updated) {
      return res.status(404).json({ success: false, message: 'Transaction not found' });
    }
    res.status(200).json({ success: true, transaction: updated });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message || error });
  }
};

// Delete a transaction
const deleteTransaction = async (req, res) => {
  try {
    const deleted = await transactionModel.findByIdAndDelete(req.params.id);
    if (!deleted) {
      return res.status(404).json({ success: false, message: 'Transaction not found' });
    }
    res.status(200).json({ success: true, message: 'Transaction deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message || error });
  }
};

module.exports = {
  createTransaction,
  getAllTransactions,
  updateTransaction,
  deleteTransaction,
  getDashboardSummary 
};
