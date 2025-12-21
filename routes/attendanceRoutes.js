// routes/attendanceRoutes.js
const express = require("express");
const {
  markAttendanceAndTasks,
  getDailyRecords, // Renamed to clarify it fetches person list + daily status
  getAttendanceReport,
  getTasksReport,
  getAllTasks,
} = require("../controllers/attendanceController");

const router = express.Router();

// POST: Route for saving/updating daily attendance/tasks for ALL persons for a date
router.post("/", markAttendanceAndTasks);

// GET: Route to fetch a list of persons AND their attendance/tasks status for a specific day
// The frontend will pass the 'entity' query parameter here.
router.get("/daily-records", getDailyRecords);

// GET: Route to fetch the list of active Tasks (for MarkDailyTasks page - future)
router.get("/tasks-list", getAllTasks);

// GET: Placeholder Routes for View Reports (to be implemented later)
router.get("/report", getAttendanceReport);
router.get("/tasks-report", getTasksReport);

module.exports = router;