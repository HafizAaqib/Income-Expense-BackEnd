//const transactionModel = require('../models/transactionModel');
const cloudinary = require('cloudinary').v2;


// Create a new transaction
const createTransaction = async (req, res) => {
  try {
    req.body.receiptNumber = await generateReceiptNumber(req.body.type , req);

    const newTransaction = new req.db.transactionModel(req.body);
    await newTransaction.save();

    res.status(201).json({ success: true, transaction: newTransaction });
  } catch (error) {
    console.log('error' , error);
    res.status(400).json({ success: false, message: error.message || error });
  }
};


const generateReceiptNumber = async (type , req) => {
  if (!['income', 'expense' , 'asset'].includes(type)) {
    throw new Error('Invalid transaction type.');
  }

  const prefix = type === 'income' ? 'IN-00' : (type === 'expense' ? 'EX-0' : 'AS-');
  const startNumber = 1;

  const lastTransaction = await req.db.transactionModel
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
    
    const transactions = await req.db.transactionModel.find(filter)
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

    // ✅ fetch transactions with category populated
    const allTransactions = await req.db.transactionModel.find({
      date: { $gte: startDate, $lte: endDate }
    }).populate('category');

    // ✅ separate by type
    const income = allTransactions.filter(t => t.type === 'income');
    const expense = allTransactions.filter(t => t.type === 'expense');

    // ✅ totals
    const incomeTotal = income.reduce((sum, t) => sum + t.amount, 0);
    const expenseTotal = expense.reduce((sum, t) => sum + t.amount, 0);
    const balance = incomeTotal - expenseTotal;

    // ✅ category totals
    const getCategoryTotals = (transactions) => {
      const categoryMap = {};
      for (const t of transactions) {
        const cat = t.category?.name || '';
        categoryMap[cat] = (categoryMap[cat] || 0) + t.amount;
      }
      return Object.entries(categoryMap).map(([name, amount]) => ({ name, amount }));
    };

    const incomeByCategory = getCategoryTotals(income);
    const expenseByCategory = getCategoryTotals(expense);

    // ✅ top income & expense entries by amount
    const topIncome = [...income]
      .sort((a, b) => b.amount - a.amount)   // sort desc by amount
      .slice(0, 10)                           // top 5
      .map(t => ({
        receiptNumber: t.receiptNumber,
        reference: t.reference,   // donor name / expense name
        phoneNumber: t.phoneNumber,
        amount: t.amount,
        category: t.category?.name || '',
        date: t.date,
        description: t.description
      }));

    const topExpense = [...expense]
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 10)
      .map(t => ({
        receiptNumber: t.receiptNumber,
        reference: t.reference,
        phoneNumber: t.phoneNumber,
        amount: t.amount,
        category: t.category?.name || '',
        date: t.date,
        description: t.description
      }));

    res.json({
      success: true,
      data: {
        summary: { incomeTotal, expenseTotal, balance },
        incomeByCategory,
        expenseByCategory,
        topIncome,
        topExpense
      }
    });

  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};



const updateTransaction = async (req, res) => {
  try {
    const updated = await req.db.transactionModel.findByIdAndUpdate(
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

const deleteTransaction = async (req, res) => {
  try {
    // Find the transaction first (to get imagePublicIds)
    const transaction = await req.db.transactionModel.findById(req.params.id);
    if (!transaction) {
      return res.status(404).json({ success: false, message: 'Transaction not found' });
    }

    // If there are images, delete them from Cloudinary
    if (transaction.imagePublicIds && transaction.imagePublicIds.trim() !== '') {
      const publicIds = transaction.imagePublicIds.split(',').map(id => id.trim());

      // Delete each image from Cloudinary (remove file extension)
      await Promise.all(
        publicIds.map(id => {
          const withoutExt = id.substring(0, id.lastIndexOf('.')) || id; // removes .jpg, .png, etc.
          cloudinary.config(req.cloudinaryConfig);
          return cloudinary.uploader.destroy(withoutExt);
        })
      );
    }

    // Now delete the transaction from DB
    await req.db.transactionModel.findByIdAndDelete(req.params.id);

    res.status(200).json({ success: true, message: 'Transaction and its images deleted successfully' });

  } catch (error) {
    console.error('Delete Transaction Error:', error);
    res.status(500).json({ success: false, message: error.message || error });
  }
};

const deleteTransactionImage = async (req, res) => {
    try {
        const { transactionId, publicId } = req.params;

        // 1. Find the transaction
        const transaction = await req.db.transactionModel.findById(transactionId);
        if (!transaction) {
            return res.status(404).json({ success: false, message: "Transaction not found" });
        }

        // 2. Remove from Cloudinary
        //console.log('req.cloudinaryConfig' , req.cloudinaryConfig);
        cloudinary.config(req.cloudinaryConfig);
        await cloudinary.uploader.destroy(publicId);

        // 3. Remove publicId from DB list
        const updatedImagePublicIds = transaction.imagePublicIds
            .split(',')
            .filter(id => id.trim() !== publicId)
            .join(',');

        transaction.imagePublicIds = updatedImagePublicIds;
        await transaction.save();

        res.json({ success: true, message: "Image deleted successfully", updatedImagePublicIds });
    } catch (error) {
        console.error("Error deleting transaction image:", error);
        res.status(500).json({ success: false, message: "Failed to delete image" });
    }
};


module.exports = {
  createTransaction,
  getAllTransactions,
  updateTransaction,
  deleteTransaction,
  getDashboardSummary,
  deleteTransactionImage 
};
