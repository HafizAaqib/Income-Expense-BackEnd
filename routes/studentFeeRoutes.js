// routes/studentFeeRoutes.js
const express = require("express");
const {
  getMonthlyFees,
  payMonthlyFee,
} = require("../controllers/studentFeeController");

const router = express.Router();

router.get("/", getMonthlyFees);  // /fees?month=YYYY-MM&entity=123
router.post("/pay", payMonthlyFee);

module.exports = router;
