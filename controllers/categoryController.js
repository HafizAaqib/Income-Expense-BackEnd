
//const Category = require('../models/categoryModel');
//const Transaction = require('../models/transactionModel');

// Create
// Create
const createCategory = async (req, res) => {
  try {
    const { name, type, entity, status } = req.body;
    if (!name || !type) return res.status(400).json({ success: false, message: 'Name and type are required' });

    const newCategory = new req.db.Category({ name, type, status: status || 1 });

    if (entity) newCategory.entity = entity;

    await newCategory.save();
    res.status(201).json({ success: true, category: newCategory });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};


// Read
const getAllCategories = async (req, res) => {
  try {
    const { type, entity } = req.query;
    let filter = {};

    if (type) filter.type = type;
    if (entity) {
  filter.$or = [{ entity: Number(entity) }];

  if (Number(entity) === 1) {
    filter.$or.push({ entity: null });
  }
}

    const categories = await req.db.Category.find(filter).sort({ name: 1 });
    res.status(200).json({ success: true, categories });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Update
const updateCategory = async (req, res) => {
  try {
    const { name, status } = req.body;
    const { id } = req.params;

    if (!name && !status) return res.status(400).json({ success: false, message: 'Name or status is required' });

    const updateObj = {};
    if (name) updateObj.name = name;
    if (status) updateObj.status = status;

    const updated = await req.db.Category.findByIdAndUpdate(id, updateObj, { new: true });
    if (!updated) return res.status(404).json({ success: false, message: 'Category not found' });

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
    const isUsed = await req.db.transactionModel.exists({ category: id });
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
