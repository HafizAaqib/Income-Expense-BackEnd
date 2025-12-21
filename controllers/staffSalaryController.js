// controllers/staffSalaryController.js
const dayjs = require("dayjs");

// Utility: normalize YYYY-MM into start-of-month Date
const normalizeMonth = (monthStrOrDate) => {
  return dayjs(monthStrOrDate).startOf("month").toDate();
};

// GET /staff-salaries?month=YYYY-MM&entity=123&status=paid|unpaid|all
// Returns { paid: [...salary docs with staff], unpaid: [...staff docs] }
const getMonthlySalaries = async (req, res) => {
  try {
    const { month, entity, status = "all" } = req.query;
    if (!month) {
      return res
        .status(400)
        .json({ success: false, message: "month (YYYY-MM) is required" });
    }

    const monthStart = normalizeMonth(month);

    // 1) Load staff (filter by entity if provided)
    const staffFilter = {};
    if (entity) staffFilter.entity = Number(entity);

    const allStaff = await req.db.Staff.find(staffFilter).lean();

    // 2) Fetch paid salaries for this month
    let paidSalaries = await req.db.StaffSalary.find({ month: monthStart })
      .populate("staff")
      .sort({ "staff.name": 1 })
      .lean();

    if (entity) {
      paidSalaries = paidSalaries.filter(
        (s) => s.staff && Number(s.staff.entity) === Number(entity)
      );
    }

    // 3) Compute unpaid staff = active staff without salary record for this month
    const paidStaffIds = new Set(paidSalaries.map((s) => String(s.staff?._id)));
    const unpaidStaff = allStaff
      .filter((s) => !paidStaffIds.has(String(s._id)))
      .filter((s) => s.status === "active");

    // Optional status filter
    let response = { paid: paidSalaries, unpaid: unpaidStaff };
    if (status === "paid") response = { paid: paidSalaries, unpaid: [] };
    if (status === "unpaid") response = { paid: [], unpaid: unpaidStaff };

    res.status(200).json({ success: true, ...response });
  } catch (error) {
    console.error("getMonthlySalaries error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// POST /staff-salaries/pay
// Body: { staffId, month, category, amount?, paymentDate, remarks?, user }
const payStaffSalary = async (req, res) => {
  try {
    const {
      staffId,
      month,
      category,
      amount,
      paymentDate,
      remarks,
      user,
    } = req.body;

    if (!staffId || !month || !category || !paymentDate) {
      return res.status(400).json({
        success: false,
        message: "staffId, month, category, and paymentDate are required",
      });
    }

    const staff = await req.db.Staff.findById(staffId);
    if (!staff)
      return res
        .status(404)
        .json({ success: false, message: "Staff not found" });

    const monthStart = normalizeMonth(month);

    // Prevent duplicate salary for same staff & month
    const existing = await req.db.StaffSalary.findOne({
      staff: staffId,
      month: monthStart,
    });
    if (existing) {
      return res.status(400).json({
        success: false,
        message: "Salary already paid for this month",
      });
    }

    const salaryAmount =
      typeof amount === "number" ? amount : staff.salary || 0;

    // Generate expense receipt number (EX-0 + nextNumber)
    const prefix = "EX-0";
    const prefixForException = "EX-";

    const lastTxn = await req.db.transactionModel
      .aggregate([
        { $match: { type: "expense" } },
        {
          $addFields: {
            numericReceipt: {
              $toInt: {
                $replaceAll: {
                  input: "$receiptNumber",
                  find: prefixForException,
                  replacement: "",
                },
              },
            },
          },
        },
        { $sort: { numericReceipt: -1 } },
        { $limit: 1 },
      ])
      .then((r) => r[0] || null);

    let nextNumber = 1;
    if (
      lastTxn &&
      typeof lastTxn.numericReceipt === "number" &&
      !Number.isNaN(lastTxn.numericReceipt)
    ) {
      nextNumber = lastTxn.numericReceipt + 1;
    } else if (lastTxn && lastTxn.receiptNumber) {
      const digits = String(lastTxn.receiptNumber).replace(/\D/g, "");
      const parsed = parseInt(digits, 10);
      if (!Number.isNaN(parsed)) nextNumber = parsed + 1;
    }
    const receiptNumber = prefix + nextNumber;

    // Create expense transaction
    const txn = new req.db.transactionModel({
      type: "expense",
      category,
      amount: salaryAmount,
      date: paymentDate,
      reference: staff.name,
      phoneNumber: staff.contact || undefined,
      remarks:
        remarks ,
        // || `Salary payment for ${staff.name} (${dayjs(monthStart).format(
        //   "MMM YYYY"
        // )})`,
      receiptNumber,
      user,
    });
    await txn.save();

    // Create salary record
    const salaryRecord = new req.db.StaffSalary({
      staff: staffId,
      month: monthStart,
      amount: salaryAmount,
      paidDate: paymentDate,
      receiptNumber,
      remarks: remarks,
    });
    await salaryRecord.save();

    res
      .status(201)
      .json({ success: true, salary: salaryRecord, transaction: txn });
  } catch (error) {
    console.error("payStaffSalary error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  getMonthlySalaries,
  payStaffSalary,
};
