const dayjs = require("dayjs");

// Normalize month string (YYYY-MM) to first day of month
const normalizeMonth = (monthStrOrDate) => {
  return dayjs(monthStrOrDate).startOf("month").toDate();
};


// Create
const createDonor = async (req, res) => {
  try {
    const { name, contact, monthlyCommitment, date, status, address, entity } = req.body;

    if (date && (Number(date) < 1 || Number(date) > 31)) {
      return res.status(400).json({ success: false, message: "Date is not correct, it should be between 1 and 31" });
    }
    if (!name) {
      return res.status(400).json({ success: false, message: "Name is required" });
    }

    const donor = new req.db.Donor({
      name,
      contact,
      monthlyCommitment,
      date,
      status,
      address,
      entity
    });

    await donor.save();
    res.status(201).json({ success: true, donor });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get all
const getDonors = async (req, res) => {
  try {
    const { status, search, entity } = req.query;
    const filter = {};
    if (status) filter.status = status;
    if (search) filter.name = { $regex: search, $options: "i" };
    if (entity) {
      filter.$or = [{ entity: Number(entity) }];

      if (Number(entity) === 1) {
        filter.$or.push({ entity: null });
      }
    }
    const donors = await req.db.Donor.find(filter).sort({ name: 1 });
    res.status(200).json({ success: true, donors });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Update
const updateDonor = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, contact, monthlyCommitment, date, status, address } = req.body;

    if (date && (Number(date) < 1 || Number(date) > 31)) {
      return res.status(400).json({ success: false, message: "Date is not correct, it should be between 1 and 31" });
    }
    if (!name) {
      return res.status(400).json({ success: false, message: "Name is required" });
    }

    const updated = await req.db.Donor.findByIdAndUpdate(
      id,
      { name, contact, monthlyCommitment, date, status, address },
      { new: true }
    );

    if (!updated) {
      return res.status(404).json({ success: false, message: "Donor not found" });
    }

    res.status(200).json({ success: true, donor: updated });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Delete
const deleteDonor = async (req, res) => {
  try {
    const { id } = req.params;

    const deleted = await req.db.Donor.findByIdAndDelete(id);
    if (!deleted) {
      return res.status(404).json({ success: false, message: "Donor not found" });
    }

    res.status(200).json({ success: true, message: "Donor deleted" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// GET /donors/tracking?month=YYYY-MM&entity=123&status=all|paid|unpaid
const getDonorTracking = async (req, res) => {
  try {
    const { month, status = "all" } = req.query;
    if (!month) {
      return res.status(400).json({ success: false, message: "month (YYYY-MM) is required" });
    }

    const monthStart = normalizeMonth(month);
    const monthEnd = dayjs(monthStart).endOf("month").toDate();

    // 1) Load all active donors
    const donors = await req.db.Donor.find({ status: "active" }).lean();

    // 2) Load all income transactions for selected month that belong to donors
    const paidTxns = await req.db.transactionModel
      .find({
        type: "income",
        donor: { $ne: null },
        date: { $gte: monthStart, $lte: monthEnd },
      })
      .populate("donor")
      .populate("category")
      .sort({ date: 1 });

    // 3) Map donors who paid
    const paidDonorIds = new Set(paidTxns.map((t) => String(t.donor?._id)));
    const unpaidDonors = donors.filter((d) => !paidDonorIds.has(String(d._id)));

    // 4) Prepare response
    let response = { paid: paidTxns, unpaid: unpaidDonors };
    if (status === "paid") response = { paid: paidTxns, unpaid: [] };
    if (status === "unpaid") response = { paid: [], unpaid: unpaidDonors };

    res.status(200).json({ success: true, ...response });
  } catch (error) {
    console.error("getDonorTracking error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// POST /donors/pay
// Body: { donorId, month, category, amount?, paymentDate, description }
const payDonorContribution = async (req, res) => {
  try {
    const { donorId, month, category, amount, paymentDate, description, user } = req.body;

    if (!donorId || !month || !category || !paymentDate) {
      return res.status(400).json({ success: false, message: "donorId, month, category and paymentDate are required" });
    }

    const donor = await req.db.Donor.findById(donorId);
    if (!donor) return res.status(404).json({ success: false, message: "Donor not found" });

    const monthStart = normalizeMonth(month);
    const monthEnd = dayjs(monthStart).endOf("month").toDate();

    // Prevent duplicate payment
    const existing = await req.db.transactionModel.findOne({
      donor: donorId,
      type: "income",
      date: { $gte: monthStart, $lte: monthEnd },
    });
    if (existing) {
      return res.status(400).json({ success: false, message: "Donation already paid for this month" });
    }

    // Generate next receipt #
    const prefix = "IN-00";
    const prefixForException = "IN-";
    // const lastTxn = await req.db.transactionModel
    //   .findOne({ type: "income" })
    //   .sort({ receiptNumber: 1 })
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

    const finalAmount = typeof amount === "number" ? amount : donor.monthlyCommitment || 0;

    // Create transaction
    const txn = new req.db.transactionModel({
      type: "income",
      category,
      amount: finalAmount,
      date: paymentDate,
      reference: donor.name,
      donor: donor._id,
      phoneNumber: donor.contact || undefined,
      description: description, // || `Donation for ${dayjs(monthStart).format("MMM YYYY")} from ${donor.name}`,
      receiptNumber,
      user
    });

    await txn.save();

    res.status(201).json({ success: true, transaction: txn });
  } catch (error) {
    console.error("payDonorContribution error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};


module.exports = {
  createDonor,
  getDonors,
  updateDonor,
  deleteDonor,
  getDonorTracking,
  payDonorContribution
};
