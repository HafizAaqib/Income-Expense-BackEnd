const express = require('express');
const { addTransaction, getAllTransaction , editTransaction, deleteTransaction } = require('../controllers/transactionController');


const router =  express.Router();

router.post('/add-Transaction' , addTransaction )

router.post('/edit-Transaction' , editTransaction )

router.post('/delete-Transaction' , deleteTransaction )

router.post('/get-Transactions' , getAllTransaction )


module.exports = router;