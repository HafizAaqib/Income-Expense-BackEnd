const cloudinary = require('cloudinary').v2;

// controllers/studentController.js
const createStudent = async (req, res) => {
  try {
    const { name, fatherName, contact, status, monthlyFee, admissionDate, dateOfLeave, entity, imagePublicIds } = req.body;

    if (!name) {
      return res.status(400).json({ success: false, message: "Name is required" });
    }

    const newStudent = new req.db.Student({
      name,
      fatherName,
      contact,
      status,
      monthlyFee,
      admissionDate,
      dateOfLeave,
      entity,
      imagePublicIds
    });

    await newStudent.save();
    res.status(201).json({ success: true, student: newStudent });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get All (with filters)
const getAllStudents = async (req, res) => {
  try {
    const { name, status, entity } = req.query;
    let filter = {};

    if (name) filter.name = { $regex: name, $options: "i" }; 
    if (status) filter.status = status;

    if (entity) {
      filter.$or = [{ entity: Number(entity) }];

      if (Number(entity) === 1) {
        filter.$or.push({ entity: null });
      }
    }

    const students = await req.db.Student.find(filter).sort({ name: 1 });
    res.status(200).json({ success: true, students });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Update
const updateStudent = async (req, res) => {
  try {
    const { id } = req.params;
    const updated = await req.db.Student.findByIdAndUpdate(id, req.body, { new: true });
    if (!updated) {
      return res.status(404).json({ success: false, message: "Student not found" });
    }
    res.status(200).json({ success: true, student: updated });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Delete Student
const deleteStudent = async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await req.db.Student.findByIdAndDelete(id);
    if (!deleted) {
      return res.status(404).json({ success: false, message: "Student not found" });
    }
    res.status(200).json({ success: true, message: "Student deleted" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Delete individual image from Cloudinary and Student record
const deleteStudentImage = async (req, res) => {
  try {
    const { studentId, publicId } = req.params;

    const student = await req.db.Student.findById(studentId);
    if (!student) {
      return res.status(404).json({ success: false, message: "Student not found" });
    }

    // Configure Cloudinary using the request config
    cloudinary.config(req.cloudinaryConfig);
    await cloudinary.uploader.destroy(publicId);

    // Update the comma-separated string in DB
    const updatedImagePublicIds = (student.imagePublicIds || "")
      .split(',')
      .filter(id => id.trim() !== publicId)
      .join(',');

    student.imagePublicIds = updatedImagePublicIds;
    await student.save();

    res.json({ success: true, message: "Document deleted successfully", updatedImagePublicIds });
  } catch (error) {
    console.error("Error deleting student document:", error);
    res.status(500).json({ success: false, message: "Failed to delete document" });
  }
};

module.exports = {
  createStudent,
  getAllStudents,
  updateStudent,
  deleteStudent,
  deleteStudentImage,
};
