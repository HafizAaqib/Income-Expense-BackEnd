// routes/graveReservationRoutes.js
const express = require('express');
const router = express.Router();
const {
  createReservation,
  getAllReservations,
  updateReservation,
  deleteReservation,
  payReservation
} = require('../controllers/graveReservationController');

router.post('/', createReservation);
router.get('/', getAllReservations);
router.put('/:id', updateReservation);
router.delete('/:id', deleteReservation);

// pay (create receipt & transaction)
router.post('/:id/pay', payReservation);

module.exports = router;
