const mongoose = require('mongoose')

// schema design
const userSchema = new mongoose.Schema({
        name: {
            type: String,
            required: [true, 'User Name is required.']
        },
        userName: {
            type: String,
            required: [true, 'Login ID is required.'],
            unique: true
        },
        isAdmin: {
            type: Boolean,
            required: [true, 'Is Admin ?.']
        },
        password: {
            type: String,
            required: [true, 'password is required.']
        },
    },
    { timestamps: true }
)

//const userModel = mongoose.models.users || mongoose.model('users', userSchema);

const userModel = mongoose.model('users', userSchema)
module.exports = userModel