const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
//const dotenv = require('dotenv');
const colors = require('colors');
//const connectDb = require('./config/connectDB');
const mongoose = require('mongoose')


// congig .env file
//dotenv.config();

// connsct db
//connectDb();
const connectDb = async () => {
    try{
        // await mongoose.connect(process.env.MONGO_URL)
        await mongoose.connect("mongodb+srv://IncomeExpenseDB:EvWo53TuraTR5OJx@incomeexpensedb.tdhappz.mongodb.net/?retryWrites=true&w=majority&appName=IncomeExpenseDB")
        //await mongoose.connect("mongodb://127.0.0.1:27017/IncomeExpenseDB")

        console.log(`MongoDB connected : Server Running on ${mongoose.connection.host}`.bgCyan.white);

    } catch (error){
        console.log('MongoDB connection error:', error);
        console.log(`${error}`.bgRed); // from colors
    }
}
connectDb();

// rest object
const app = express();

// middlewares
app.use(morgan('dev'));
app.use(express.json());
app.use(cors());


// routes

// app.get('/' , (req,res)=>{
//     res.send('<H1> Express Server is running ... </H1>')
// })

app.get("/", (req, res) => {
  res.send("API is working!");
});

app.use('/api/v1/users' , require('./routes/userRoute'))
app.use('/api/v1/transactions' , require('./routes/transactionRoutes'))

const categoryRoutes = require('./routes/categoryRoutes');
app.use('/api/v1/categories', categoryRoutes);


// port
// const PORT = process.env.PORT || 3000;
const PORT =  3000;

// listen server
app.listen(PORT , ()=>{
    console.log(`Server running on port ${PORT}`)
})