const transactionModel = require('../models/transactionModel');

// Create a new transaction
const createTransaction = async (req, res) => {
  try {
    req.body.receiptNumber = await generateReceiptNumber(req.body.type);

    const newTransaction = new transactionModel(req.body);
    await newTransaction.save();

    res.status(201).json({ success: true, transaction: newTransaction });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message || error });
  }
};


const generateReceiptNumber = async (type) => {
  if (!['income', 'expense'].includes(type)) {
    throw new Error('Invalid transaction type.');
  }

  const prefix = type === 'income' ? 'FH-00' : 'EX-0';
  const startNumber = 1;

  const lastTransaction = await transactionModel
    .findOne({ type })
    .sort({ createdAt: -1 })
    .lean();

  let nextNumber;
  if (!lastTransaction || !lastTransaction.receiptNumber) {
    nextNumber = startNumber;
  } else {
    const lastNum = parseInt(lastTransaction.receiptNumber.replace(prefix, ''), 10);
    nextNumber = lastNum + 1;
  }

  return prefix + nextNumber;
};



// ✅ Get all transactions (with optional filters)
const getAllTransactions = async (req, res) => {
  try {
    const { type, category, user, startDate, endDate, search } = req.query;

    const filter = {};

    if (type) filter.type = type;
    if (category) filter.category = category;
    if (user) filter.user = user;
    
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
        { receiptNumber: { $regex: search, $options: 'i' } },
      ];
    }
    
    const transactions = await transactionModel.find(filter)
    .populate('category') // pulls category object with name
    .populate('user') // pulls user object with name
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

// Added it to handle when transaction type is changed by user , but there is no option for user to do it. so no need this function.
// const updateTransaction = async (req, res) => {
//   try {
//     const existingTransaction = await transactionModel.findById(req.params.id);
//     if (!existingTransaction) {
//       return res.status(404).json({ success: false, message: 'Transaction not found' });
//     }

//     if (req.body.type && req.body.type !== existingTransaction.type) {
//       req.body.receiptNumber = await generateReceiptNumber(req.body.type);
//     }

//     const updated = await transactionModel.findByIdAndUpdate(
//       req.params.id,
//       req.body,
//       { new: true }
//     );

//     res.status(200).json({ success: true, transaction: updated });
//   } catch (error) {
//     res.status(400).json({ success: false, message: error.message || error });
//   }
// };


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
