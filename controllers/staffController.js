const cloudinary = require('cloudinary').v2;

// controllers/staffController.js
const createStaff = async (req, res) => {
  try {
    const { name, fatherName, contact, designation, salary, status, joiningDate, dateOfLeave, entity, imagePublicIds } = req.body;

    if (!name) {
      return res.status(400).json({ success: false, message: "Name is required" });
    }

    const newStaff = new req.db.Staff({
      name,
      fatherName,
      contact,
      designation,
      salary,
      status,
      joiningDate,
      dateOfLeave,
      entity,
      imagePublicIds
    });

    await newStaff.save();
    res.status(201).json({ success: true, staff: newStaff });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get All (with filters)
const getAllStaff = async (req, res) => {
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

    const staff = await req.db.Staff.find(filter).sort({ name: 1 });
    res.status(200).json({ success: true, staff });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Update Staff
const updateStaff = async (req, res) => {
  try {
    const { id } = req.params;
    const updated = await req.db.Staff.findByIdAndUpdate(id, req.body, { new: true });
    if (!updated) {
      return res.status(404).json({ success: false, message: "Staff not found" });
    }
    res.status(200).json({ success: true, staff: updated });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Delete Staff
const deleteStaff = async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await req.db.Staff.findByIdAndDelete(id);
    if (!deleted) {
      return res.status(404).json({ success: false, message: "Staff not found" });
    }
    res.status(200).json({ success: true, message: "Staff deleted" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Delete individual image from Cloudinary and Staff record
const deleteStaffImage = async (req, res) => {
  try {
    const { staffId, publicId } = req.params;

    const staffMember = await req.db.Staff.findById(staffId);
    if (!staffMember) {
      return res.status(404).json({ success: false, message: "Staff member not found" });
    }

    // Configure Cloudinary
    cloudinary.config(req.cloudinaryConfig);
    await cloudinary.uploader.destroy(publicId);

    // Update the comma-separated string in DB
    const updatedImagePublicIds = (staffMember.imagePublicIds || "")
      .split(',')
      .filter(id => id.trim() !== publicId)
      .join(',');

    staffMember.imagePublicIds = updatedImagePublicIds;
    await staffMember.save();

    res.json({ success: true, message: "Document deleted successfully", updatedImagePublicIds });
  } catch (error) {
    console.error("Error deleting staff document:", error);
    res.status(500).json({ success: false, message: "Failed to delete document" });
  }
};

module.exports = {
  createStaff,
  getAllStaff,
  updateStaff,
  deleteStaff,
  deleteStaffImage,
};
