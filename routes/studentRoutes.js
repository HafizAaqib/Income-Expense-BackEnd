const express = require("express");
const {
  createStudent,
  getAllStudents,
  updateStudent,
  deleteStudent,
  deleteStudentImage,
} = require("../controllers/studentController");

const router = express.Router();

router.post("/", createStudent);
router.get("/", getAllStudents);
router.put("/:id", updateStudent);
router.delete("/:id", deleteStudent);
router.delete('/image/:studentId/:publicId', deleteStudentImage);
module.exports = router;
