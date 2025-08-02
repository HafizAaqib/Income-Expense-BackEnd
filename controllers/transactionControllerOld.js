const transactionModel = require('../models/transactionModel')
const moment = require('moment')

const getAllTransaction = async (req, res) => {
    try {
        const { frequency, selectedDate, type } = req.body;
        const transactions = await transactionModel.find({

            ...(frequency !== 'custom' ? {
                date: {
                    $gt: moment().subtract(Number(frequency), 'd').toDate()
                }
            } : {
                date: {
                    $gte: selectedDate[0],
                    $lte: selectedDate[1]
                }
            }),
            ...(type !== '0' && {type})


        });
        res.status(200).json(transactions);
    } catch (error) {
        console.log(error);
        res.status(500).json(error);
    }
}

const addTransaction = async (req, res) => {
    try {
        const newTransaction = new transactionModel(req.body);
        await newTransaction.save();
        res.status(201).send('Transaction Saved');
    } catch (error) {
        console.log(error);
        res.status(500).json(error);
    }
}

const editTransaction = async (req , res) =>{
    try {
        await transactionModel.findOneAndUpdate({_id:req.body.payload.transactionId},
            req.body.payload
        )
        res.status(201).send('Transaction Edited');
    } catch (error) {
        console.log(error);
        res.status(500).json(error);
    }
}

const deleteTransaction = async (req , res) =>{
    try {
        await transactionModel.findOneAndDelete({_id:req.body.transactionId})
        res.status(201).send('Transaction Deleted');
    } catch (error) {
        console.log(error);
        res.status(500).json(error);
    }
}

module.exports = { getAllTransaction, addTransaction , editTransaction , deleteTransaction };