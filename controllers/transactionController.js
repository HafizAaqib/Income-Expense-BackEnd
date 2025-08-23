const transactionModel = require('../models/transactionModel');
// import cloudinary from "cloudinary";
const cloudinary = require('cloudinary').v2;


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
  if (!['income', 'expense' , 'asset'].includes(type)) {
    throw new Error('Invalid transaction type.');
  }

  const prefix = type === 'income' ? 'FH-00' : (type === 'expense' ? 'EX-0' : 'AS-');
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

// const getDashboardSummary = async (req, res) => {
//   try {
//     const { month, year } = req.query;
//     const selectedMonth = parseInt(month);
//     const selectedYear = parseInt(year);

//     const startDate = new Date(selectedYear, selectedMonth - 1, 1);
//     const endDate = new Date(selectedYear, selectedMonth, 0, 23, 59, 59);

//     const allTransactions = await transactionModel.find({
//       date: { $gte: startDate, $lte: endDate }
//     }).populate('category');

//     const income = allTransactions.filter(t => t.type === 'income');
//     const expense = allTransactions.filter(t => t.type === 'expense');

//     const incomeTotal = income.reduce((sum, t) => sum + t.amount, 0);
//     const expenseTotal = expense.reduce((sum, t) => sum + t.amount, 0);
//     const balance = incomeTotal - expenseTotal;

//     const getCategoryTotals = (transactions) => {
//       const categoryMap = {};
//       for (const t of transactions) {
//         const cat = t.category?.name || '';
//         categoryMap[cat] = (categoryMap[cat] || 0) + t.amount;
//       }
//       return Object.entries(categoryMap).map(([name, amount]) => ({ name, amount }));
//     };

//     const incomeByCategory = getCategoryTotals(income);
//     const expenseByCategory = getCategoryTotals(expense);

//     res.json({
//       success: true,
//       data: {
//         summary: { incomeTotal, expenseTotal, balance },
//         incomeByCategory,
//         expenseByCategory
//       }
//     });
//   } catch (err) {
//     res.status(500).json({ success: false, message: err.message });
//   }
// };

// Update a transaction

const getDashboardSummary = async (req, res) => {
  try {
    const { month, year } = req.query;
    const selectedMonth = parseInt(month);
    const selectedYear = parseInt(year);

    const startDate = new Date(selectedYear, selectedMonth - 1, 1);
    const endDate = new Date(selectedYear, selectedMonth, 0, 23, 59, 59);

    // ✅ fetch transactions with category populated
    const allTransactions = await transactionModel.find({
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
    // Find the transaction first (to get imagePublicIds)
    const transaction = await transactionModel.findById(req.params.id);
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
          return cloudinary.uploader.destroy(withoutExt);
        })
      );
    }

    // Now delete the transaction from DB
    await transactionModel.findByIdAndDelete(req.params.id);

    res.status(200).json({ success: true, message: 'Transaction and its images deleted successfully' });

  } catch (error) {
    console.error('Delete Transaction Error:', error);
    res.status(500).json({ success: false, message: error.message || error });
  }
};



// const deleteTransaction = async (req, res) => {
//   try {
//   // Need to delete its images from cloudinary first.

//     const deleted = await transactionModel.findByIdAndDelete(req.params.id);
//     if (!deleted) {
//       return res.status(404).json({ success: false, message: 'Transaction not found' });
//     }
//     res.status(200).json({ success: true, message: 'Transaction deleted' });
//   } catch (error) {
//     res.status(500).json({ success: false, message: error.message || error });
//   }
// };


cloudinary.config({
    cloud_name: "drinjgbm5",
    api_key: "448227896933795",
    api_secret: "0r7c7F6w9l1ZTMN76zKmO57xc24"
});

const deleteTransactionImage = async (req, res) => {
    try {
        const { transactionId, publicId } = req.params;

        // 1. Find the transaction
        const transaction = await transactionModel.findById(transactionId);
        if (!transaction) {
            return res.status(404).json({ success: false, message: "Transaction not found" });
        }

        // 2. Remove from Cloudinary
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
