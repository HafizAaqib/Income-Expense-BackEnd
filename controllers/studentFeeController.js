// controllers/studentFeeController.js
const dayjs = require("dayjs");

const normalizeMonth = (monthStrOrDate) => {
  // monthStrOrDate can be "2025-09" or an ISO date; we store the month at startOf('month') in UTC
  const d = dayjs(monthStrOrDate).startOf("month").toDate();
  return d;
};

// GET /fees?month=YYYY-MM&entity=123&status=paid|unpaid|all
// Returns { paid: [...fee docs with student+transaction], unpaid: [...student docs] }
const getMonthlyFees = async (req, res) => {
  try {
    const { month, entity, status = "all" } = req.query;
    if (!month) {
      return res.status(400).json({ success: false, message: "month (YYYY-MM) is required" });
    }

    const monthStart = normalizeMonth(month);

    // 1) Load students (filter by entity if provided; default only 'active' for due list)
    const studentFilter = {};
    if (entity) studentFilter.entity = Number(entity);

    // We’ll fetch all students for paid list pairing, but for the unpaid we typically care about current students.
    const allStudents = await req.db.Student.find(studentFilter).lean();

    // 2) Fetch paid fees for this month
    let paidFees = await req.db.StudentFee
      .find({ month: monthStart })
      .populate("student")
      //.populate("transaction")
      .sort({ "student.name": 1 });

    // Filter paid by entity (through student)
    if (entity) {
      paidFees = paidFees.filter(f => f.student?.entity === Number(entity));
    }

    // 3) Compute unpaid: students who DO NOT have a fee record for this month
    const paidStudentIds = new Set(paidFees.map(f => String(f.student?._id)));
    const unpaidStudents = allStudents
      .filter(s => !paidStudentIds.has(String(s._id)))
      .filter(s => ["active"].includes(s.status));

    // Optional filter by status param
    let response = { paid: paidFees, unpaid: unpaidStudents };
    if (status === "paid") response = { paid: paidFees, unpaid: [] };
    if (status === "unpaid") response = { paid: [], unpaid: unpaidStudents };

    res.status(200).json({ success: true, ...response });
  } catch (error) {
    console.error("getMonthlyFees error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// POST /fees/pay
// Body: { studentId, month, category, amount?, paymentDate, paidBy, phoneNumber, description }
const payMonthlyFee = async (req, res) => {
  try {
    const {
      studentId,
      month,
      category,
      amount,
      paymentDate,
      paidBy,
      phoneNumber,
      description,
      user
    } = req.body;

    if (!studentId || !month || !category || !paymentDate || !paidBy) {
      return res.status(400).json({
        success: false,
        message: "studentId, month, category, paymentDate and paidBy are required",
      });
    }

    const student = await req.db.Student.findById(studentId);
    if (!student) return res.status(404).json({ success: false, message: "Student not found" });

    const monthStart = normalizeMonth(month);

    // Prevent duplicate payment for that month
    const existing = await req.db.StudentFee.findOne({ student: studentId, month: monthStart });
    if (existing) {
      return res.status(400).json({ success: false, message: "Fee already paid for this month" });
    }

    const feeAmount = typeof amount === "number" ? amount : (student.monthlyFee || 0);

    // Generate income receipt number similar to  transactionController pattern
    const prefix = "IN-00";
    const prefixForException = "IN-";

    // const lastTxn = await req.db.transactionModel
    //   .findOne({ type: "income" })
    //   .sort({ receiptNumber: -1 })
    //   .lean();

    const lastTxn = await req.db.transactionModel
      .aggregate([
        { $match: { type: "income" } },
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

    let nextNumber = 1;
    if (lastTxn?.receiptNumber) {
      const lastNum = parseInt(lastTxn.receiptNumber.replace(prefix, ""), 10);
      if (!lastNum) {
        lastNum = parseInt(lastTransaction.receiptNumber.replace(prefixForException, ''), 10);
      }
      if (!Number.isNaN(lastNum)) nextNumber = lastNum + 1;
    }
    const receiptNumber = prefix + nextNumber;

    // Create the income transaction
    const txn = new req.db.transactionModel({
      type: "income",
      category,                  // income category chosen (e.g. "Student Fee")
      amount: feeAmount,
      date: paymentDate,
      reference: paidBy,         // guardian / paid by
      phoneNumber: phoneNumber || undefined,
      description: description , // || `Monthly fee for ${student.name} (${dayjs(monthStart).format("MMM YYYY")})`,
      receiptNumber,
      user
    });
    await txn.save();

    // Create monthly fee record
    const feeRecord = new req.db.StudentFee({
      student: studentId,
      month: monthStart,
      amount: feeAmount,
      datePaid: paymentDate,
      receiptNumber,
      //transaction: txn._id,
      description: description,
    });
    await feeRecord.save();

    res.status(201).json({ success: true, fee: feeRecord, transaction: txn });
  } catch (error) {
    console.error("payMonthlyFee error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  getMonthlyFees,
  payMonthlyFee,
};
