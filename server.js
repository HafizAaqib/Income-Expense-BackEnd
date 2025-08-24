const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const colors = require('colors');
const mongoose = require('mongoose')


// connect db
// const connectDb = async () => {
//     try{
//         //await mongoose.connect("mongodb+srv://IncomeExpenseDB:EvWo53TuraTR5OJx@incomeexpensedb.tdhappz.mongodb.net/?retryWrites=true&w=majority&appName=IncomeExpenseDB")
//         await mongoose.connect("mongodb://127.0.0.1:27017/IncomeExpenseDB")

//         console.log(`MongoDB connected : Server Running on ${mongoose.connection.host}`.bgCyan.white);

//     } catch (error){
//         console.log('MongoDB connection error:', error);
//         console.log(`${error}`.bgRed); // from colors
//     }
// }
// connectDb();

// rest object
const app = express();

// middlewares
app.use(morgan('dev'));
app.use(express.json());
// app.use(cors());
app.use(cors({
  origin: "*", // or your frontend domain
  methods: ["GET", "POST", "PUT", "DELETE"],
  allowedHeaders: ["Content-Type", "Authorization", "x-client"],
}));

// --- Dynamic DB Connection Middleware ---
const connections = {}; // cache to reuse DB connections

// Load models per connection (once)
function getModels(conn) {
  return {
    userModel: conn.model(
      "users",
      new mongoose.Schema({
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
              canViewOtherUsersData: {
                  type: Boolean,
                  default: false
              },
              canAddData: {
                  type: Boolean,
                  default: false
              },
              canUpdateData: {
                  type: Boolean,
                  default: false
              },
              password: {
                  type: String,
                  required: [true, 'password is required.']
              },
          },
          { timestamps: true }
      ),
      ),
      Category: conn.model(
      "Category",
      new mongoose.Schema(
        {
          name: {
            type: String,
            required: [true, 'Category name is required'],
            trim: true,
          },
          type: {
            type: String,
            enum: ['income', 'expense' , 'asset'],
            required: [true, 'Category type is required'],
          },
        },
        { timestamps: true }
      )
    ),
    
    transactionModel: conn.model(
      "transactions",
      new mongoose.Schema({
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
      }, { timestamps: true })
    ),
    
    // Later: add Category, Transaction, etc. here
  };
}

// Map client → DB URI
const clientDbMap = {
  faizanehajveri: "mongodb+srv://IncomeExpenseDB:EvWo53TuraTR5OJx@incomeexpensedb.tdhappz.mongodb.net/?retryWrites=true&w=majority&appName=IncomeExpenseDB",
  localhost: "mongodb://127.0.0.1:27017/IncomeExpenseDB",
  jamiarabbani: "mongodb+srv://hafizaqib0207:rG16WD22xCNCjDPn@incomeexpenseappdb.jpg1omj.mongodb.net/?retryWrites=true&w=majority&appName=IncomeExpenseAppDB",
};
const cloudinaryConfigMap = 
{
    faizanehajveri: { cloud_name: "drinjgbm5", api_key: "448227896933795", api_secret: "0r7c7F6w9l1ZTMN76zKmO57xc24"},
    localhost: { cloud_name: "drinjgbm5", api_key: "448227896933795", api_secret: "0r7c7F6w9l1ZTMN76zKmO57xc24"},
    jamiarabbani: { cloud_name: "drinjgbm5", api_key: "448227896933795", api_secret: "0r7c7F6w9l1ZTMN76zKmO57xc24"},
}


// Middleware to attach correct db + models
app.use(async (req, res, next) => {
  try {
    const hostname = req.headers['x-client'];
    //const hostname = req.hostname.split(".")[0]; // e.g. faizanehajveri from faizanehajveri.web.app
    console.log('hostname' , hostname);
    const dbUri = clientDbMap[hostname] || clientDbMap["localhost"]; // fallback

    if (!connections[dbUri]) {
      console.log(`🔗 New DB connection for ${hostname} (${dbUri})`);
      const conn = await mongoose.createConnection(dbUri).asPromise();
      connections[dbUri] = { conn, models: getModels(conn) };
    }

    req.db = connections[dbUri].models; // attach models to request
    //req.hostname = hostname; // i think not needed in controllers
    req.cloudinaryConfig = cloudinaryConfigMap[hostname] || cloudinaryConfigMap["localhost"]; // fallback
    next();
  } catch (err) {
    console.error("DB connection error:", err);
    res.status(500).send("Database connection error");
  }
});



// routes
app.get("/", (req, res) => {
  res.send("API is working!");
});

app.use('/api/v1/users' , require('./routes/userRoute'))
app.use('/api/v1/transactions' , require('./routes/transactionRoutes'))
app.use('/api/v1/categories', require('./routes/categoryRoutes'));


// port
const PORT = 3000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));