const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
    amount: {
        type: Number,
        default: 0,
        required: [true, 'Amount is required.']
    },
    category: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Category', // ✅ match model name here
        required: [true, 'Category is required']
    },
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'users', // ✅ match model name here
//        required: [true, 'User is required']
    },
    type: {
        type: String,
        enum: ['income', 'expense' , 'asset'],
        // required: [true, 'Type is required'],
        lowercase: true 
    },
    receiptNumber: {
        type: String,
        trim: true
    },
    reference: {
        type: String,
        trim: true
    },
    phoneNumber: {
        type: String,
        trim: true
    },
    description: {
        type: String,
        trim: true,
        // required: [true, 'Description is required']
    },
    date: {
        type: Date,
        required: [true, 'Date is required']
    },
    imagePublicIds: { 
        type: String, // comma-separated, e.g. "abc123.jpg,def456.png"
        trim: true,
        default: ""
    }
}, { timestamps: true });

//const userModel = mongoose.models.users || mongoose.model('users', userSchema);

const transactionModel = mongoose.models.transactions || mongoose.model('transactions', transactionSchema);
module.exports = transactionModel;
