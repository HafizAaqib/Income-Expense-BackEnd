const mongoose = require('mongoose')
const colors = require('colors')

const connectDb = async () => {
    try{
        await mongoose.connect(process.env.MONGO_URL)

        console.log(`MongoDB connected : Server Running on ${mongoose.connection.host}`.bgCyan.white);

    } catch (error){
        console.log('MongoDB connection error:', error);
        console.log(`${error}`.bgRed); // from colors
    }
}


module.exports = connectDb