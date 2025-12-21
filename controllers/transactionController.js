const cloudinary = require('cloudinary').v2;
const dayjs = require("dayjs");

// Create a new transaction
const createTransaction = async (req, res) => {
  try {
    if (req.body.user === 'superadmin-id') {
      req.body.user = null;
    }
    req.body.receiptNumber = await generateReceiptNumber(req.body.type, req);

    const newTransaction = new req.db.transactionModel(req.body);
    await newTransaction.save();

    // 3) If it's an expense and has a duePayment, mark it paid
    if (req.body.type === "expense" && req.body.duePayment) {
      await req.db.DuePayment.findByIdAndUpdate(
        req.body.duePayment,
        {
          $set: { status: "paid", receiptNumber: req.body.receiptNumber }
        },
        { new: true }
      );
    }

    res.status(201).json({ success: true, transaction: newTransaction });
  } catch (error) {
    console.log('error', error);
    res.status(400).json({ success: false, message: error.message || error });
  }
};


const generateReceiptNumber = async (type, req) => {
  if (!['income', 'expense', 'asset'].includes(type)) {
    throw new Error('Invalid transaction type.');
  }

  const prefix = type === 'income' ? 'IN-00' : (type === 'expense' ? 'EX-0' : 'AS-0');
  const prefixForException = type === 'income' ? 'IN-' : (type === 'expense' ? 'EX-' : 'AS-');
  const startNumber = 1;

  // const lastTransaction = await req.db.transactionModel
  //   .findOne({ type })
  //   .sort({ receiptNumber: -1 })
  //   .lean();

  const lastTransaction = await req.db.transactionModel
    .aggregate([
      { $match: { type } },
      {
        $addFields: {
          numericReceipt: {
            $toInt: {
              $replaceAll: { input: "$receiptNumber", find: prefixForException, replacement: "" }
            }
          }
        }
      },
      { $sort: { numericReceipt: -1 } },
      { $limit: 1 }
    ])
    .then(res => res[0] || null);


  //console.log('lastTransaction.receiptNumber' , lastTransaction.receiptNumber)
  let nextNumber;
  if (!lastTransaction || !lastTransaction.receiptNumber) {
    nextNumber = startNumber;
  } else {
    let lastNum = parseInt(lastTransaction.receiptNumber.replace(prefix, ''), 10);
    if (!lastNum) {
      lastNum = parseInt(lastTransaction.receiptNumber.replace(prefixForException, ''), 10);
    }
    nextNumber = lastNum + 1;
  }
  //console.log('prefix + nextNumber' , prefix + nextNumber)
  return prefix + nextNumber;
};



// ✅ Get all transactions (with optional filters)
const getAllTransactions = async (req, res) => {
  try {
    const { type, category, user, startDate, endDate, search, entity } = req.query;

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
      filter.$or = [
        { phoneNumber: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { reference: { $regex: search, $options: 'i' } },
        { receiptNumber: { $regex: search, $options: 'i' } },
      ];
    }

    let query = req.db.transactionModel.find(filter)
       .populate('category')
      .populate('user')
      .populate('duePayment')
      .lean();  // <--- returns plain JS objects

    let transactions = await query;
    transactions = transactions.filter(t => t.category?.status !== 3);

    const prefixForException = type === 'income' ? 'IN-' : (type === 'expense' ? 'EX-' : 'AS-');
    console.log('transactionsBeforeSort', transactions);
    transactions = transactions
      .map(t => ({
        ...t,
        numericReceiptNumber: parseInt(t.receiptNumber?.replace(prefixForException, "") || "0", 10)
      }))
      .sort((a, b) => b.numericReceiptNumber - a.numericReceiptNumber);

    // Optional: remove numericReceiptNumber if you don’t need it
    transactions.forEach(t => delete t.numericReceiptNumber);
    console.log('transactionsAfterSort', transactions);

    // ✅ Apply entity filter after populating category
    if (entity) {
      transactions = transactions.filter(txn => {
        const catEntity = txn.category?.entity;

        if (Number(entity) === 1) {
          // allow match OR null
          return catEntity === 1 || catEntity == null;
        }

        // otherwise, must be exact match only
        return catEntity === Number(entity);
      });
    }


    res.status(200).json({ success: true, transactions });
  } catch (error) {
    console.error(error)
    res.status(500).json({ success: false, message: error.message || error });
  }
};

// Get single transaction (for Receipt page)
const getTransactionById = async (req, res) => {
  try {
    const { id } = req.params;

    const transaction = await req.db.transactionModel
      .findById(id)
      .populate("category")
      .populate("user")
      .lean();

    if (!transaction) {
      return res.status(404).json({ success: false, message: "Transaction not found" });
    }

    res.status(200).json({ success: true, transaction });
  } catch (error) {
    console.error("Error fetching transaction:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};


const getDashboardSummary = async (req, res) => {
  try {
    const { month, year, entity } = req.query;
    const selectedMonth = parseInt(month);
    const selectedYear = parseInt(year);

    let startDate, endDate;

    if (selectedMonth === 0) {
      // Full year
      startDate = new Date(Date.UTC(selectedYear, 0, 1, 0, 0, 0));
      endDate   = new Date(Date.UTC(selectedYear, 11, 31, 23, 59, 59));
    } else {
      // Specific month
      startDate = new Date(Date.UTC(selectedYear, selectedMonth - 1, 1, 0, 0, 0));
      endDate   = new Date(Date.UTC(selectedYear, selectedMonth, 0, 23, 59, 59));
    }

    // ✅ fetch transactions
    let allTransactions = await req.db.transactionModel.find({
      date: { $gte: startDate, $lte: endDate }
    })
    .populate('category')
    .populate('donor');

    allTransactions = allTransactions.filter(t => t.category?.status !== 3);

    // ✅ entity filtering
    if (entity) {
      allTransactions = allTransactions.filter(t => {
        const catEntity = t.category?.entity;

        if (Number(entity) === 1) {
          // allow match OR null
          return catEntity === 1 || catEntity == null;
        }

        // otherwise, must be exact match only
        return catEntity === Number(entity);
      });
    }

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

    // ✅ top income & expense entries
    const topIncome = [...income].sort((a, b) => b.amount - a.amount).slice(0, 10);
    const topExpense = [...expense].sort((a, b) => b.amount - a.amount).slice(0, 10);

    // =========================
    // 🔔 Notifications Section
    // =========================

    // 1️⃣ Due Payments
    let query = req.db.DuePayment.find({
      status: "unpaid",
    })
      .populate("category")
      .sort({ dueDate: 1 });

    let duePayments = await query;

    // ✅ entity filter through category
    if (entity) {
      duePayments = duePayments.filter((dp) => {
        const catEntity = dp.category?.entity;

        if (Number(entity) === 1) {
          // allow match OR null
          return catEntity === 1 || catEntity == null;
        }

        // otherwise, must be exact match only
        return catEntity === Number(entity);
      });
    }

    // 2️⃣ Unpaid Fees (for active students in this month)
    const studentFilter = {};
    studentFilter.status = "active";
    if (entity) {
      if (Number(entity) === 1) {
        studentFilter.$or = [{ entity: 1 }, { entity: null }];
      } else {
        studentFilter.entity = Number(entity);
      }
    } 
    const allStudents = await req.db.Student.find(studentFilter).lean();

    const monthSelected = dayjs(`${selectedYear}-${selectedMonth}-01`).startOf("month").toDate();

    let paidFees = await req.db.StudentFee
      .find({ month: monthSelected })
      .populate("student")
      //.populate("transaction")
      .sort({ "student.name": 1 });

    // Filter paid by entity (through student)
    if (entity) {
      paidFees = paidFees.filter(f => {
        const stuEntity = f.student?.entity;

        if (Number(entity) === 1) {
          // allow match OR null
          return stuEntity === 1 || stuEntity == null;
        }

        return stuEntity === Number(entity);
      });
    }

    // 3) Compute unpaid: students who DO NOT have a fee record for this month
    const paidStudentIds = new Set(paidFees.map(f => String(f.student?._id)));
    const unpaidStudents = allStudents
      .filter(s => !paidStudentIds.has(String(s._id)))
      .filter(s => ["active"].includes(s.status));


    // 3️⃣ Donors not paid in this month
    const filter = {};
    filter.status = "active";
    if (entity) {
      filter.$or = [{ entity: Number(entity) }];

      if (Number(entity) === 1) {
        filter.$or.push({ entity: null });
      }
    }
    const donors = await req.db.Donor.find(filter).sort({ date: 1 });
    const donorPayments = income.filter(t => t.donor);
    const unpaidDonors = donors.filter(d =>
      !donorPayments.some(dp => dp.donor?._id.toString() === d._id.toString())
    );

    // 4️⃣ Unpaid Salaries (for active staff in this month)
const staffFilter = {};
staffFilter.status = "active";
if (entity) {
  if (Number(entity) === 1) {
    staffFilter.$or = [{ entity: 1 }, { entity: null }];
  } else {
    staffFilter.entity = Number(entity);
  }
}
const allStaff = await req.db.Staff.find(staffFilter).lean();

let paidSalaries = await req.db.StaffSalary
  .find({ month: monthSelected })
  .populate("staff")
  .sort({ "staff.name": 1 });

console.log('paidSalaries' , paidSalaries)


// // Filter paid by entity (through staff)
// if (entity) {
//   paidSalaries = paidSalaries.filter(sal => {
//     const staffEntity = sal.staff?.entity;

//     if (Number(entity) === 1) {
//       // allow match OR null
//       return staffEntity === 1 || staffEntity == null;
//     }

//     return staffEntity === Number(entity);
//   });
// }

// Compute unpaid: staff who DO NOT have a salary record for this month
const paidStaffIds = new Set(paidSalaries.map(sal => String(sal.staff?._id)));
const unpaidStaff = allStaff
  .filter(st => !paidStaffIds.has(String(st._id)))
  .filter(st => ["active"].includes(st.status));


    // ✅ send response
    res.json({
      success: true,
      data: {
        summary: { incomeTotal, expenseTotal, balance },
        incomeByCategory,
        expenseByCategory,
        topIncome,
        topExpense,
        notifications: {
          duePayments,
          unpaidStudents,
          unpaidDonors,
          unpaidStaff
        }
      }
    });

  } catch (err) {
    console.error(err)
    res.status(500).json({ success: false, message: err.message });
  }
};



const updateTransaction = async (req, res) => {
  try {
    if (req.body.user === 'superadmin-id') {
      req.body.user = null;
    }
    // 1) Load existing transaction
    const existing = await req.db.transactionModel.findById(req.params.id);
    if (!existing) {
      return res.status(404).json({ success: false, message: "Transaction not found" });
    }

    if (req.body.type === "expense") {
      const oldDuePaymentId = existing.duePayment ? String(existing.duePayment) : null;

      const newDuePaymentId = Object.prototype.hasOwnProperty.call(req.body, "duePayment")
        ? (req.body.duePayment ? String(req.body.duePayment) : null)
        : null; // <-- omission => unlink

      // If duePayment changed, rollback old and link new
      if (oldDuePaymentId !== newDuePaymentId) {
        // rollback old (if any)
        if (oldDuePaymentId) {
          await req.db.DuePayment.findByIdAndUpdate(
            oldDuePaymentId,
            { $set: { status: "unpaid", receiptNumber: null } },
            { new: true }
          );
        }

        // link new (if any)
        if (newDuePaymentId) {
          await req.db.DuePayment.findByIdAndUpdate(
            newDuePaymentId,
            { $set: { status: "paid", receiptNumber: req.body.receiptNumber } },
            { new: true }
          );
        }
      }
    }

    if (req.body.type === "income" && req.body.receiptNumber) {
      await req.db.StudentFee.findOneAndUpdate(
        { receiptNumber: req.body.receiptNumber },
        { $set: { amount: req.body.amount } }
      );
      await req.db.GraveReservation.findOneAndUpdate(
        { receiptNumber: req.body.receiptNumber },
        { $set: { amount: req.body.amount } }
      );
    }

    if (req.body.type === "expense" && req.body.receiptNumber) {
      await req.db.StaffSalary.findOneAndUpdate(
        { receiptNumber: req.body.receiptNumber },
        { $set: { amount: req.body.amount } }
      );
    }

    // 3) Update the transaction document
    const updated = await req.db.transactionModel.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );

    return res.status(200).json({ success: true, transaction: updated });
  } catch (error) {
    console.error("Update Transaction Error:", error);
    return res.status(400).json({ success: false, message: error.message || error });
  }
};


const deleteTransaction = async (req, res) => {
  try {
    // Find the transaction first (to get imagePublicIds)
    const transaction = await req.db.transactionModel.findById(req.params.id);
    if (!transaction) {
      return res.status(404).json({ success: false, message: 'Transaction not found' });
    }

    // ======================
    // 🔄 Rollback related docs
    // ======================
    console.log('transaction', transaction)
    if (transaction.type === "expense" && transaction.duePayment) {
      await req.db.DuePayment.findByIdAndUpdate(
        transaction.duePayment._id,
        { $set: { status: "unpaid", receiptNumber: null } }
      );
    }

    if (transaction.type === "income" && transaction.receiptNumber) {
      await req.db.StudentFee.findOneAndDelete({
        receiptNumber: transaction.receiptNumber,
      });
      await req.db.GraveReservation.findOneAndUpdate(
        { receiptNumber: transaction.receiptNumber },
        { $set: { status: "unpaid", receiptNumber: null } }
      );
    }
    if (transaction.type === "expense" && transaction.receiptNumber) {
      await req.db.StaffSalary.findOneAndDelete({
        receiptNumber: transaction.receiptNumber,
      });
    }


    // ======================
    // 🖼️ Delete Cloudinary images if present
    // ======================
    if (transaction.imagePublicIds && transaction.imagePublicIds.trim() !== '') {
      const publicIds = transaction.imagePublicIds.split(',').map(id => id.trim());


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
  getTransactionById,
  deleteTransactionImage
};
