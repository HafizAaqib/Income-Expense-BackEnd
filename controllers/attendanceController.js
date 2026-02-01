// controllers/attendanceController.js
const dayjs = require("dayjs");

// Helper function to update/create AttendanceDetails
const upsertAttendanceDetails = async (db, detailsId, updateFields) => {
  if (detailsId) {
    // 1. Details document already exists, so update it
    const updatedDetails = await db.AttendanceDetails.findByIdAndUpdate(
      detailsId,
      { $set: updateFields },
      { new: true }
    );
    if (updatedDetails) return updatedDetails._id;
  }
  
  // 2. Details document does not exist, or findByIdAndUpdate failed, so create a new one
  const newDetails = new db.AttendanceDetails(updateFields);
  await newDetails.save();
  return newDetails._id;
};


// ----------------------------------------------------------------------
// Mark Attendance and Tasks (POST /api/v1/attendance)
// ----------------------------------------------------------------------
const markAttendanceAndTasks = async (req, res) => {
  try {
    const { date, entityType, records } = req.body;
    
    if (!date || !entityType || !Array.isArray(records)) {
      return res.status(400).json({ success: false, message: "Missing required fields: date, entityType, or records array." });
    }

    const db = req.db;
    const dayDate = dayjs(date);
    const month = dayDate.month() + 1;
    const year = dayDate.year();
    const day = dayDate.date();
    const dayField = `d${day}`;

    // Array to hold promises for the single save operation per person
    const updatePromises = [];

    for (const record of records) {
      const { personId, status, remarks, tasks } = record;

      if (!personId) continue;

      const attendanceQuery = {
        person: personId,
        entityType: entityType,
        month: month,
        year: year,
      };

      // 1. Find or Create the main Attendance document for the person/month/year
      let mainDoc = await db.Attendance.findOne(attendanceQuery);

      if (!mainDoc) {
        mainDoc = new db.Attendance(attendanceQuery);
      }

      // 2. Prepare the update for the specific embedded sub-document (dX)
      // Check if the sub-document exists or needs initialization
      let details = mainDoc[dayField] || {}; 

      // A. Fields related to Attendance Status (from MarkAttendance page)
      if (status !== undefined) {
          details.status = status;
          details.remarks = remarks || "";
      }

      // B. Fields related to Daily Tasks (from MarkDailyTasks page)
      if (tasks !== undefined) {
          details.tasks = tasks;
          details.tasksRemarks = record.tasksRemarks || "";
      }
      
      // If the details object is updated, assign it back and save the parent doc
      if (Object.keys(details).length > 0) {
          mainDoc[dayField] = details;
          updatePromises.push(mainDoc.save());
      }
    }

    await Promise.all(updatePromises);
    
    res.status(200).json({ success: true, message: `${entityType} attendance/tasks for ${dayDate.format('YYYY-MM-DD')} saved successfully.` });

  } catch (error) {
    console.error("Error in markAttendanceAndTasks:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ----------------------------------------------------------------------
// Get Daily Records (Person List + Attendance Status)
// ----------------------------------------------------------------------
const getDailyRecords = async (req, res) => {
    try {
        const { date, entityType, entity: entityId, category } = req.query;        
        
        if (!date || !entityType) {
            return res.status(400).json({ success: false, message: "Date and entityType are required." });
        }

        const db = req.db;
        const dayDate = dayjs(date);
        const month = dayDate.month() + 1;
        const year = dayDate.year();
        const day = dayDate.date();
        const dayField = `d${day}`;

        let PersonModel;
        let personFilter = { status: "active" };
        
        if (entityType === "Student") {
            PersonModel = db.Student;
            if (category) personFilter.class = category; 
        } else if (entityType === "Staff") {
            PersonModel = db.Staff;
            if (category) personFilter.designation = category; 
        } else {
            return res.status(400).json({ success: false, message: "Invalid entityType." });
        }
        
        // Apply Entity Filtering
        if (entityId) {
            const entityNum = Number(entityId);
            personFilter.$or = [{ entity: entityNum }];
            if (entityNum === 1) { 
                personFilter.$or.push({ entity: null });
            }
        }
        
        const allPersons = await PersonModel.find(personFilter, '_id name').sort({ name: 1 });
        const personIds = allPersons.map(p => p._id);

        // Fetch the monthly Attendance document for these persons, selecting only the relevant day field
        const monthlyAttendance = await db.Attendance.find({
            person: { $in: personIds },
            entityType: entityType,
            month: month,
            year: year,
        })
        .select(`person ${dayField}`); // Select the embedded sub-document directly

        // Map attendance data for quick lookup
        const attendanceMap = new Map();
        monthlyAttendance.forEach(doc => {
            // The details object is the embedded sub-document (or null/undefined)
            const details = doc[dayField]; 
            if (details) {
                attendanceMap.set(doc.person.toString(), {
                    status: details.status,
                    remarks: details.remarks,
                    tasks: details.tasks,
                    tasksRemarks: details.tasksRemarks,
                });
            }
        });

        // Construct the final array for the frontend
        const dailyRecords = allPersons.map(person => {
            const record = attendanceMap.get(person._id.toString()) || {};
            
            return {
                _id: person._id, 
                name: person.name,
                status: record.status === undefined ? 0 : record.status, 
                remarks: record.remarks || "",
                tasks: record.tasks || [],
                tasksRemarks: record.tasksRemarks || "",
            };
        });

        res.status(200).json({ success: true, records: dailyRecords });

    } catch (error) {
        console.error("Error in getDailyRecords:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// ----------------------------------------------------------------------
// Get Active Tasks List
// ----------------------------------------------------------------------
const getAllTasks = async (req, res) => {
    try {
        const { entityType, category } = req.query; 
        if (!entityType) {
            return res.status(400).json({ success: false, message: "entityType is required." });
        }
        
        const db = req.db;
        // Filter tasks for the entityType ('student' or 'staff') and status 1 (Active)

        let filter = { type: entityType.toLowerCase(), status: 1 };
        
        // If a specific category (Class/Designation) is selected, filter tasks
        if (category) {
            filter.categories = { $in: [category] };
        }

        const tasks = await db.Task.find(filter).sort({ name: 1 });
        res.status(200).json({ success: true, tasks: tasks.map(t => ({ taskId: t._id, name: t.name })) });

    } catch (error) {
        console.error("Error in getAllTasks:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// ----------------------------------------------------------------------
// View Reports 
// ----------------------------------------------------------------------

/**
 * Fetches the full monthly attendance report (including tasks) for a specific person.
 * GET /api/v1/attendance/report?personId={id}&month={m}&year={y}&entityType={t}
 */
const getAttendanceReport = async (req, res) => {
    try {
        const { personId, month, year, entityType } = req.query;

        if (!personId || !month || !year || !entityType) {
            return res.status(400).json({ success: false, message: "personId, month, year, and entityType are required." });
        }

        const db = req.db;
        const monthNum = Number(month);
        const yearNum = Number(year);

        // --- 1. Fetch Person to get their Category (Class/Designation) ---
        let personRecord;
        if (entityType === "Student") {
            personRecord = await db.Student.findById(personId).select('class');
        } else {
            personRecord = await db.Staff.findById(personId).select('designation');
        }

        if (!personRecord) {
            return res.status(404).json({ success: false, message: "Person record not found." });
        }
        const categoryId = entityType === "Student" ? personRecord.class : personRecord.designation;

        // --- 2. Fetch only tasks assigned to this person's category ---
        const activeTasks = await db.Task.find({
            type: entityType.toLowerCase(),
            status: 1,
            categories: { $in: [categoryId] } // Only get tasks matching this person's category
        }).select('_id name');

        // 3. Fetch the monthly Attendance document
        const attendanceDoc = await db.Attendance.findOne({
            person: personId,
            entityType: entityType,
            month: monthNum,
            year: yearNum,
        });
        
        // Initialize the report structure
        const report = {
            monthlySummary: { 
                present: 0, absent: 0, leave: 0, halfDay: 0, weekend: 0, holiday: 0, notMarked: 0,
                // Task summaries will be calculated later
},
            dailyRecords: [],
            tasksList: activeTasks.map(t => ({ taskId: t._id.toString(), name: t.name })),
        };

        // If no attendance document exists, return empty structure with the filtered tasks list
        if (!attendanceDoc) {
             return res.status(200).json({ success: true, report });
        }
        
        // Process the attendance document
        const daysInMonth = dayjs(`${yearNum}-${monthNum}-01`).daysInMonth();
            
        // Initialize task tracking for the monthly summary
            const taskSummaryMap = new Map(activeTasks.map(t => [t._id.toString(), { done: 0, notDone: 0 }]));

        for (let day = 1; day <= daysInMonth; day++) {
            const dayField = `d${day}`;
            const dailyData = attendanceDoc[dayField];
            const currentDate = dayjs(`${yearNum}-${monthNum}-${day}`).format('YYYY-MM-DD');
            
            // Initialize default record for the day
            let record = {
                day: day,
                date: currentDate,
                attendance: { status: 0, remarks: "" }, // 0 = Not Marked
                tasks: new Map(activeTasks.map(t => [t._id.toString(), 0])), // 0 = Not Marked/Skipped
                tasksRemarks: "",
            };

            if (dailyData) {
                // Update attendance status and remarks
                record.attendance.status = dailyData.status || 0;
                record.attendance.remarks = dailyData.remarks || "";
                
                // Process tasks and update record & summary map
                if (dailyData.tasks && dailyData.tasks.length > 0) {
                    dailyData.tasks.forEach(task => {
                        const taskId = task.taskId.toString();
                        if (record.tasks.has(taskId)) {
                            // Status 1 in DB means Yes/Done; 0 means No/Not Done
                            record.tasks.set(taskId, task.status === 1 ? 2 : 1); // Frontend uses 2 for Yes, 1 for No
                            
                            // Update task summary
                            const summary = taskSummaryMap.get(taskId);
                            if (task.status === 1) {
                                summary.done++;
                            } else if (task.status === 0) {
                                summary.notDone++;
                            }
                        }
                    });
                }
                record.tasksRemarks = dailyData.tasksRemarks || "";
            }
            
            // Convert tasks Map to a plain object for easier consumption
            record.tasks = Object.fromEntries(record.tasks);
            report.dailyRecords.push(record);
            
            // Update attendance summary based on the fetched status
            switch (record.attendance.status) {
                case 1: report.monthlySummary.present++; break;
                case 2: report.monthlySummary.absent++; break;
                case 3: report.monthlySummary.leave++; break;
                case 4: report.monthlySummary.halfDay++; break;
                case 5: report.monthlySummary.weekend++; break;
                case 6: report.monthlySummary.holiday++; break;
                default: 
                report.monthlySummary.notMarked++;
                break;
            }
        }
        
        // Finalize task summaries in the report structure
        report.monthlySummary.tasks = Object.fromEntries(taskSummaryMap);

        res.status(200).json({ success: true, report });

    } catch (error) {
        console.error("Error in getAttendanceReport:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

module.exports = {
    // ... (other exports)
    getAttendanceReport,
};

const getTasksReport = async (req, res) => {
    res.status(501).json({ success: false, message: "Tasks Report fetching is not yet implemented." });
};


module.exports = {
  markAttendanceAndTasks,
  getDailyRecords,
  getAttendanceReport,
  getTasksReport,
  getAllTasks,
};