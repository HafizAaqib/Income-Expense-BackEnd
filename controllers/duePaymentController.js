

// Create
const createDuePayment = async (req, res) => {
  try {
    const { category, amount, dueDate, description } = req.body;

    if (!category || !amount || !dueDate) {
      return res.status(400).json({ success: false, message: "Missing required fields" });
    }

    const newDuePayment = new req.db.DuePayment({
      category,
      amount,
      dueDate,
      description,
      status: "unpaid",
    });

    await newDuePayment.save();
    res.status(201).json({ success: true, duePayment: newDuePayment });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Read
const getAllDuePayments = async (req, res) => {
  try {
    const { status, category, entity } = req.query;
    const filter = {};

    if (status) filter.status = status;
    if (category) filter.category = category;

    let query = req.db.DuePayment.find(filter)
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

        // otherwise exact match only
        return catEntity === Number(entity);
      });
    }


    res.status(200).json({ success: true, duePayments });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// for Bell icon
const hasDuePayments = async (req, res) => {
  try {
    const { entity } = req.query;

    let query = req.db.DuePayment.find({ status: "unpaid" }).populate("category");

    let duePayments = await query;

    // ✅ entity filter through category
    if (entity) {
      duePayments = duePayments.filter((dp) => {
        const catEntity = dp.category?.entity;

        if (Number(entity) === 1) {
          // allow match OR null
          return catEntity === 1 || catEntity == null;
        }

        // otherwise, must match exactly
        return catEntity === Number(entity);
      });
    }


    const hasDue = duePayments.length > 0;

    res.status(200).json({ success: true, hasDue, count: duePayments.length });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};


// Update
const updateDuePayment = async (req, res) => {
  try {
    const updated = await req.db.DuePayment.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );
    if (!updated) {
      return res.status(404).json({ success: false, message: "Not found" });
    }
    res.status(200).json({ success: true, duePayment: updated });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Delete
const deleteDuePayment = async (req, res) => {
  try {
    const deleted = await req.db.DuePayment.findByIdAndDelete(req.params.id);
    if (!deleted) {
      return res.status(404).json({ success: false, message: "Not found" });
    }
    res.status(200).json({ success: true, message: "Deleted" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 💰 Pay Due Payment
const payDuePayment = async (req, res) => {
  try {
    const { id } = req.params;
    const { reference, phoneNumber, date, description, user } = req.body;

    const duePayment = await req.db.DuePayment.findById(id).populate("category");
    if (!duePayment) {
      return res.status(404).json({ success: false, message: "Due Payment not found" });
    }
    if (duePayment.status === "paid") {
      return res.status(400).json({ success: false, message: "Already paid" });
    }

    // --- Generate receipt number (reuse same helper) ---
    const prefix = "EX-0";
    const prefixForException = "EX-";

    // const lastTxn = await req.db.transactionModel
    //   .findOne({ type: "expense" })
    //   .sort({ receiptNumber: -1 })
    //   .lean();

    const lastTxn = await req.db.transactionModel
      .aggregate([
        { $match: { type: "expense" } },
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
      nextNumber = lastNum + 1;
    }
    const receiptNumber = prefix + nextNumber;


    // --- Update DuePayment status ---
    duePayment.status = "paid";
    duePayment.receiptNumber = receiptNumber;
    const savedPayment = await duePayment.save();

    // --- Create expense transaction ---
    const newTransaction = new req.db.transactionModel({
      type: "expense",
      category: duePayment.category._id,
      amount: duePayment.amount,
      date: date || new Date(),
      reference,
      phoneNumber,
      description: description || duePayment.description,
      receiptNumber,
      duePayment: savedPayment._id,
      user
    });

    await newTransaction.save();


    res.status(200).json({
      success: true,
      message: "Payment successful",
      duePayment,
      transaction: newTransaction,
    });
  } catch (error) {
    console.error("Pay Due Payment Error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  createDuePayment,
  getAllDuePayments,
  updateDuePayment,
  deleteDuePayment,
  payDuePayment,
  hasDuePayments,
};
