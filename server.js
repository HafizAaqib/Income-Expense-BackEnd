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
  origin: "*",
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "x-client"],
  exposedHeaders: ["x-client"], // not strictly needed but safe
}));
//app.options("*", cors());

// --- Dynamic DB Connection Middleware ---
const connections = {}; // cache to reuse DB connections

// Load models per connection (once)
function getModels(conn) {

    const AttendanceDetailsSchema = new mongoose.Schema(
          {
            status: Number,      // 0 = not marked, 1 = present, etc.
            // hours: Number,       // total hours of attendance
            // startTime: String,   // like "10:30 AM"
            // endTime: String,     // like "05:00 PM"
            remarks: String,
            tasks: [
              {
                taskId:  {
                  type: mongoose.Schema.Types.ObjectId,
                  ref: "Task",
                  required: true,
                }, 
                status: {
                  type: Number,
                  enum: [0,1],
                  required: true,
                }
              }
            ],
            tasksRemarks: String
          },
          { _id: false }
          
  );

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
        //{ timestamps: true }
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
            enum: ['income', 'expense', 'asset'],
            required: [true, 'Category type is required'],
          },
          entity: {
            type: Number,
          },
          status: {
            type: Number,
            enum: [1, 2, 3],
            default: 1, // Active by default
          },
        },
        //{ timestamps: true }
      )
    ),
    Student: conn.model(
      "Student",
      new mongoose.Schema(
        {
          name: {
            type: String,
            required: [true, "Student name is required"],
            trim: true,
          },
          fatherName: {
            type: String,
            trim: true,
          },
          contact: {
            type: String,
            trim: true,
          },
          status: {
            type: String,
            enum: [
              "active",       // currently studying
              "passed_out",   // completed madrassa course
              "left",         // left in between
              "expelled",     // expelled due to issue
              "on_hold",      // temporarily not attending
            ],
            default: "active",
          },
          monthlyFee: {
            type: Number,
            default: 0,
            min: [0, "Monthly fee cannot be negative"],
          },
          admissionDate: {
            type: Date,
          },
          dateOfLeave: {
            type: Date,
          },
          entity: {
            type: Number,
          },
        imagePublicIds: {
          type: String, // comma-separated, e.g. "abc123.jpg,def456.png"
          trim: true,
        }
        },
        //{ timestamps: true }
      )
    ),
    StudentFee: conn.model(
      "StudentFee",
      new mongoose.Schema(
        {
          student: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Student",
            required: true,
          },
          // store the month normalized to the 1st of the month at 00:00:00Z
          month: {
            type: Date,
            required: true,
          },
          amount: {
            type: Number,
            required: true,
            min: [0, "Amount cannot be negative"],
          },
          datePaid: {
            type: Date,
          },
          receiptNumber: {
            type: String,
          },
          description: {
            type: String,
            trim: true,
          },
        },
        //{ timestamps: true }
      ),
    ),
    Task: conn.model(
      "Task",
      new mongoose.Schema(
        {
          name: {
            type: String,
            required: [true, 'Daily Task name is required'],
            trim: true,
          },
          type: {
            type: String,
            enum: ['student', 'staff'],
            required: [true, 'Daily Task type is required'],
          },
          entity: {
            type: Number,
          },
          status: {
            type: Number,
            enum: [1, 2, 3],
            default: 1, // Active by default
          },
        },
      )
    ),
    
    Attendance: conn.model(
      "Attendance",
      new mongoose.Schema(
      {
            person: {
              type: mongoose.Schema.Types.ObjectId,
              refPath: "entityType",  // dynamic ref student/staff
              required: true,
            },
            entityType: {
              type: String,
              required: true,
              enum: ["Student", "Staff"],
            },
            month: {
              type: Number,
              required: true,
              min: 1,
              max: 12,
            },
            year: {
              type: Number,
              required: true,
            },
            // Day-wise attendance
            d1: AttendanceDetailsSchema,
            d2: AttendanceDetailsSchema,
            d3: AttendanceDetailsSchema,
            d4: AttendanceDetailsSchema,
            d5: AttendanceDetailsSchema,
            d6: AttendanceDetailsSchema,
            d7: AttendanceDetailsSchema,
            d8: AttendanceDetailsSchema,
            d9: AttendanceDetailsSchema,
            d10: AttendanceDetailsSchema,
            d11: AttendanceDetailsSchema,
            d12: AttendanceDetailsSchema,
            d13: AttendanceDetailsSchema,
            d14: AttendanceDetailsSchema,
            d15: AttendanceDetailsSchema,
            d16: AttendanceDetailsSchema,
            d17: AttendanceDetailsSchema,
            d18: AttendanceDetailsSchema,
            d19: AttendanceDetailsSchema,
            d20: AttendanceDetailsSchema,
            d21: AttendanceDetailsSchema,
            d22: AttendanceDetailsSchema,
            d23: AttendanceDetailsSchema,
            d24: AttendanceDetailsSchema,
            d25: AttendanceDetailsSchema,
            d26: AttendanceDetailsSchema,
            d27: AttendanceDetailsSchema,
            d28: AttendanceDetailsSchema,
            d29: AttendanceDetailsSchema,
            d30: AttendanceDetailsSchema,
            d31: AttendanceDetailsSchema
          }
          ),
    ),
    Staff: conn.model(
      "Staff",
      new mongoose.Schema({
        name: { type: String, required: true, trim: true },
        fatherName: { type: String },
        contact: { type: String },
        designation: { type: String }, // e.g. Teacher, Clerk, Imam, etc.
        salary: { type: Number, required: true },
        status: {
          type: String,
          enum: ["active", "resigned", "terminated", "on_leave"],
          default: "active",
        },
        joiningDate: { type: Date },
        dateOfLeave: { type: Date },
        entity: { type: Number },
        imagePublicIds: {
          type: String, // comma-separated, e.g. "abc123.jpg,def456.png"
          trim: true,
        }
      })
    ),
    StaffSalary: conn.model(
      "StaffSalary",
      new mongoose.Schema({
        staff: { type: mongoose.Schema.Types.ObjectId, ref: "Staff", required: true },
        // month: { type: Number, required: true },
        // year: { type: Number, required: true },
        month: {
          type: Date,
          required: true,
        },
        amount: { type: Number, required: true },
        paidDate: { type: Date, default: Date.now },
        remarks: { type: String },
        receiptNumber: { type: String },
      })
    ),
    DuePayment: conn.model(
      "DuePayment",
      new mongoose.Schema(
        {
          category: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Category",
            required: [true, "Category is required"],
          },
          amount: {
            type: Number,
            required: [true, "Amount is required"],
          },
          dueDate: {
            type: Date,
            required: [true, "Due date is required"],
          },
          status: {
            type: String,
            enum: ["unpaid", "paid"],
            default: "unpaid",
          },
          receiptNumber: {
            type: String,
          },
          description: {
            type: String,
            trim: true,
          },
        },
        //{ timestamps: true }
      )
    ),
    Donor: conn.model(
      "Donor",
      new mongoose.Schema(
        {
          name:
          {
            type: String,
            required: true,
            trim: true
          },
          contact: { type: String, trim: true },
          monthlyCommitment: { type: Number, default: 0 },
          date: {
            type: Number,
          },
          status: {
            type: String,
            enum: ["active", "inactive"],
            default: "active",
          },
          address: String,
          entity: {
            type: Number,
          },
        }
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
          enum: ['income', 'expense', 'asset'],
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
        donor: { type: mongoose.Schema.Types.ObjectId, ref: "Donor" },
        duePayment: { type: mongoose.Schema.Types.ObjectId, ref: "DuePayment" },
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
        }
      },
        //{ timestamps: true }
      )
    ),
    GraveReservation: conn.model(
      "GraveReservation",
      new mongoose.Schema(
        {
          name: { type: String, required: [true, "Name is required"], trim: true },            // name of deceased / reserved for
          fatherName: { type: String, trim: true },
          date: { type: Date, required: [true, "Date is required"] },                        
          contact: { type: String, trim: true },
          address: { type: String, trim: true },
          amount: { type: Number },
          otherDetails: { type: String, trim: true },
          status: { type: String, enum: ['unpaid', 'paid'], default: 'unpaid' },       
          receiptNumber: { type: String },                                             
          entity: { type: Number },                           
        }
      )
    )


    // Later: add Category, Transaction, etc. here
  };
}

// Map client → DB URI
const clientDbMap = {
  faizanehajveri: "mongodb+srv://IncomeExpenseDB:EvWo53TuraTR5OJx@incomeexpensedb.tdhappz.mongodb.net/?retryWrites=true&w=majority&appName=IncomeExpenseDB",    // account attached with mraza0207@gmail.com
  jamiarabbani: "mongodb+srv://hafizaqib0207:rG16WD22xCNCjDPn@incomeexpenseappdb.jpg1omj.mongodb.net/?retryWrites=true&w=majority&appName=IncomeExpenseAppDB",  // account attached with hafizaqib0207@gmail.com
  localhost: "mongodb://127.0.0.1:27017/IncomeExpenseDB",
  //localhost: "mongodb+srv://IncomeExpenseDB:EvWo53TuraTR5OJx@incomeexpensedb.tdhappz.mongodb.net/?retryWrites=true&w=majority&appName=IncomeExpenseDB",    // account attached with mraza0207@gmail.com

};
const cloudinaryConfigMap =
{
  faizanehajveri: { cloud_name: "djd7htwfk", api_key: "872922767166923", api_secret: "Nboda4dlLwyunmw8DFC8uyACcB0" }, // account attached with hafizaqib0207@gmail.com
  jamiarabbani: { cloud_name: "drinjgbm5", api_key: "448227896933795", api_secret: "0r7c7F6w9l1ZTMN76zKmO57xc24" },  // account attached with mraza0207@gmail.com
  localhost: { cloud_name: "drinjgbm5", api_key: "448227896933795", api_secret: "0r7c7F6w9l1ZTMN76zKmO57xc24" },
}


// Middleware to attach correct db + models
app.use(async (req, res, next) => {
  try {
    const hostname = req.headers['x-client'] || req.headers['X-Client'];
    //const hostname = req.hostname.split(".")[0]; // e.g. faizanehajveri from faizanehajveri.web.app
    console.log('hostname', hostname);
    const dbUri = clientDbMap[hostname]; // || clientDbMap["localhost"]; // fallback

    if (!connections[dbUri]) {
      console.log(`🔗 New DB connection for ${hostname} (${dbUri})`);
      const conn = await mongoose.createConnection(dbUri).asPromise();
      connections[dbUri] = { conn, models: getModels(conn) };
    }

    req.db = connections[dbUri].models; // attach models to request
    //req.hostname = hostname; // i think not needed in controllers
    req.cloudinaryConfig = cloudinaryConfigMap[hostname]; // || cloudinaryConfigMap["localhost"]; // fallback
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

app.use('/api/v1/users', require('./routes/userRoute'))
app.use('/api/v1/transactions', require('./routes/transactionRoutes'))
app.use('/api/v1/categories', require('./routes/categoryRoutes'));
app.use('/api/v1/tasks', require('./routes/taskRoutes'));
app.use('/api/v1/students', require('./routes/studentRoutes'));
app.use('/api/v1/due-payments', require('./routes/duePaymentRoutes'));
app.use('/api/v1/fees', require('./routes/studentFeeRoutes'));
app.use('/api/v1/donors', require('./routes/donorRoutes'));
app.use("/api/v1/staff", require('./routes/staffRoutes'));
app.use("/api/v1/staff-salaries", require('./routes/staffSalaryRoutes'));
app.use('/api/v1/grave-reservations', require('./routes/graveReservationRoutes'));
app.use("/api/v1/attendance", require('./routes/attendanceRoutes'));

// port
const PORT = 3000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));