const express = require("express");
const {
  createDuePayment,
  getAllDuePayments,
  updateDuePayment,
  deleteDuePayment,
  payDuePayment,
  hasDuePayments,
} = require("../controllers/duePaymentController");

const router = express.Router();

router.post("/", createDuePayment);
router.get("/", getAllDuePayments);
router.put("/:id", updateDuePayment);
router.delete("/:id", deleteDuePayment);
router.post("/:id/pay", payDuePayment);
router.get("/has-due", hasDuePayments);

module.exports = router;
