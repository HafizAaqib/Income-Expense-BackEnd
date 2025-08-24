
//const Category = require('../models/categoryModel');
//const Transaction = require('../models/transactionModel');

// Create
const createCategory = async (req, res) => {
  try {
    const { name, type } = req.body;
    if (!name || !type) {
      return res.status(400).json({ success: false, message: 'Name and type are required' });
    }

    const newCategory = new req.db.Category({ name, type });
    await newCategory.save();
    res.status(201).json({ success: true, category: newCategory });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Read
const getAllCategories = async (req, res) => {
  try {
    const { type } = req.query;
    const filter = type ? { type } : {};
    const categories = await req.db.Category.find(filter).sort({ createdAt: -1 });
    res.status(200).json({ success: true, categories });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Update
const updateCategory = async (req, res) => {
  try {
    const { name } = req.body;
    const { id } = req.params;

    if (!name) {
      return res.status(400).json({ success: false, message: 'Name is required' });
    }

    const updated = await req.db.Category.findByIdAndUpdate(id, { name }, { new: true });
    if (!updated) {
      return res.status(404).json({ success: false, message: 'Category not found' });
    }

    res.status(200).json({ success: true, category: updated });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Delete
const deleteCategory = async (req, res) => {
  try {
    const { id } = req.params;

    // 🔒 Check if the category is used in any transaction
    const isUsed = await req.db.trandactionModel.exists({ category: id });
    if (isUsed) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete. This category is already used in transactions.',
      });
    }

    const deleted = await req.db.Category.findByIdAndDelete(id);
    if (!deleted) {
      return res.status(404).json({ success: false, message: 'Category not found' });
    }

    res.status(200).json({ success: true, message: 'Category deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};



module.exports = {
  createCategory,
  getAllCategories,
  updateCategory,
  deleteCategory,
};
