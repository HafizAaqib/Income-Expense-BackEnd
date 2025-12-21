const express = require("express");
const {
  createStaff,
  getAllStaff,
  updateStaff,
  deleteStaff,
  deleteStaffImage,
} = require("../controllers/staffController");

const router = express.Router();

// CRUD for staff members
router.post("/", createStaff);
router.get("/", getAllStaff);
router.put("/:id", updateStaff);
router.delete("/:id", deleteStaff);
router.delete('/image/:staffId/:publicId', deleteStaffImage);
module.exports = router;
