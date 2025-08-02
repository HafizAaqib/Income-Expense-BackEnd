const express = require('express');
const {
  createTransaction,
  getAllTransactions,
  updateTransaction,
  deleteTransaction,
  getDashboardSummary
} = require('../controllers/transactionController');

const router = express.Router();

// POST /api/v1/transactions
router.post('/create', createTransaction);

// GET /api/v1/transactions
router.get('/getAll', getAllTransactions);

router.get('/dashboard-summary', getDashboardSummary);

// PUT /api/v1/transactions/:id
router.put('/:id', updateTransaction);

// DELETE /api/v1/transactions/:id
router.delete('/:id', deleteTransaction);

module.exports = router;
