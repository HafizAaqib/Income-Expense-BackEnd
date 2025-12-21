// controllers/graveReservationController.js
const dayjs = require('dayjs');

/**
 * Create / Reserve a grave (unpaid)
 * POST /grave-reservations
 */
const createReservation = async (req, res) => {
  try {
    const { name, fatherName, date, contact, address, amount, otherDetails, entity } = req.body;

    if (!name || !date || !amount) {
      return res.status(400).json({ success: false, message: "Name, date and amount are required" });
    }

    const newRes = new req.db.GraveReservation({
      name,
      fatherName,
      date,
      contact,
      address,
      amount,
      otherDetails,
      entity,
      status: 'unpaid',
    });

    await newRes.save();
    res.status(201).json({ success: true, reservation: newRes });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Get All / list
 * GET /grave-reservations?status=unpaid|paid&name=...&entity=...
 */
const getAllReservations = async (req, res) => {
  try {
    const { status, name, entity } = req.query;
    const filter = {};

    if (status) filter.status = status;
    if (name) filter.name = { $regex: name, $options: "i" };
    if (entity) filter.entity = Number(entity);

    const reservations = await req.db.GraveReservation.find(filter).sort({ date: -1 });
    res.status(200).json({ success: true, reservations });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Update
 * PUT /grave-reservations/:id
 */
const updateReservation = async (req, res) => {
  try {
    const updated = await req.db.GraveReservation.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!updated) return res.status(404).json({ success: false, message: "Reservation not found" });
    res.status(200).json({ success: true, reservation: updated });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Delete
 * DELETE /grave-reservations/:id
 */
const deleteReservation = async (req, res) => {
  try {
    const deleted = await req.db.GraveReservation.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ success: false, message: "Reservation not found" });
    res.status(200).json({ success: true, message: "Deleted" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Pay a reservation (create income transaction and mark paid)
 * POST /grave-reservations/:id/pay
 * Body: { category, paidBy, phoneNumber, date, description, user }
 */
const payReservation = async (req, res) => {
  try {
    const { id } = req.params;
    const { category, paidBy, phoneNumber, date, description, user } = req.body;

    if (!category) {
      return res.status(400).json({ success: false, message: "Category is required" });
    }

    const reservation = await req.db.GraveReservation.findById(id);
    if (!reservation) return res.status(404).json({ success: false, message: "Reservation not found" });
    if (reservation.status === 'paid') return res.status(400).json({ success: false, message: "Already paid" });

    // --- Generate income receipt number (IN-00 + next)
    const prefix = "IN-00";
    const prefixForException = "IN-";

    const lastTxn = await req.db.transactionModel
      .aggregate([
        { $match: { type: "income" } },
        {
          $addFields: {
            numericReceipt: {
              $toInt: { $replaceAll: { input: "$receiptNumber", find: prefixForException, replacement: "" } }
            }
          }
        },
        { $sort: { numericReceipt: -1 } },
        { $limit: 1 }
      ])
      .then(r => r[0] || null);

    let nextNumber = 1;
    if (lastTxn && typeof lastTxn.numericReceipt === 'number' && !Number.isNaN(lastTxn.numericReceipt)) {
      nextNumber = lastTxn.numericReceipt + 1;
    } else if (lastTxn && lastTxn.receiptNumber) {
      const digits = String(lastTxn.receiptNumber).replace(/\D/g, "");
      const parsed = parseInt(digits, 10);
      if (!Number.isNaN(parsed)) nextNumber = parsed + 1;
    }
    const receiptNumber = prefix + nextNumber;

    // Mark reservation paid
    reservation.status = 'paid';
    reservation.receiptNumber = receiptNumber;
    await reservation.save();

    // Create income transaction (✅ category now included)
    const txn = new req.db.transactionModel({
      type: "income",
      category, // <--- Added
      amount: reservation.amount,
      date: date || new Date(),
      reference: paidBy,
      phoneNumber,
      description: description || `Grave reservation payment for ${reservation.name}`,
      receiptNumber,
      user
    });
    await txn.save();

    res.status(200).json({ success: true, reservation, transaction: txn });
  } catch (error) {
    console.error("payReservation error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  createReservation,
  getAllReservations,
  updateReservation,
  deleteReservation,
  payReservation
};
