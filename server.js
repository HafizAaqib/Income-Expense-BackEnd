const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const dotenv = require('dotenv');
const colors = require('colors');
const connectDb = require('./config/connectDB');

// congig .env file
dotenv.config();

// connsct db
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
const PORT = process.env.PORT || 3000;

// listen server
app.listen(PORT , ()=>{
    console.log(`Server running on port ${PORT}`)
})