const express = require("express");
const {
  getMonthlySalaries,
  payStaffSalary,
} = require("../controllers/staffSalaryController");

const router = express.Router();

// Salaries listing
// GET /staff-salaries?month=YYYY-MM&entity=123&status=paid|unpaid|all
router.get("/", getMonthlySalaries);

// Pay salary
// POST /staff-salaries/pay
router.post("/pay", payStaffSalary);

module.exports = router;
