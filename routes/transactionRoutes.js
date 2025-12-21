const express = require('express');
const {
  createTransaction,
  getAllTransactions,
  updateTransaction,
  deleteTransaction,
  getDashboardSummary,
  deleteTransactionImage,
  getTransactionById
} = require('../controllers/transactionController');

const router = express.Router();

// POST /api/v1/transactions
router.post('/create', createTransaction);

// GET /api/v1/transactions
router.get('/getAll', getAllTransactions);

router.get('/dashboard-summary', getDashboardSummary);

router.get("/:id", getTransactionById);

// PUT /api/v1/transactions/:id
router.put('/:id', updateTransaction);

// DELETE /api/v1/transactions/:id
router.delete('/:id', deleteTransaction);

router.delete("/:transactionId/image/:publicId", deleteTransactionImage);

module.exports = router;
