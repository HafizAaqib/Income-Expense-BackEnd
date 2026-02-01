
// Create
const createTask = async (req, res) => {
  try {
    const { name, type, entity, status, categories } = req.body;
    if (!name || !type) return res.status(400).json({ success: false, message: 'Name and type are required' });

    const newTask = new req.db.Task({ 
      name, 
      type, 
      status: status || 1,
      categories: categories || [] // Added categories
    });

    if (entity) newTask.entity = entity;

    await newTask.save();
    res.status(201).json({ success: true, task: newTask });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};


// Read
const getAllTasks = async (req, res) => {
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

    const tasks = await req.db.Task.find(filter).populate('categories').sort({ name: 1 });
    res.status(200).json({ success: true, tasks });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Update
const updateTask = async (req, res) => {
  try {
    const { name, status, categories } = req.body;
    const { id } = req.params;

    if (!name && !status) return res.status(400).json({ success: false, message: 'Name or status is required' });

    const updateObj = {};
    if (name) updateObj.name = name;
    if (status !== undefined) updateObj.status = status;
    if (categories) updateObj.categories = categories; // Added categories

    const updated = await req.db.Task.findByIdAndUpdate(id, updateObj, { new: true });
    if (!updated) return res.status(404).json({ success: false, message: 'Task not found' });

    res.status(200).json({ success: true, task: updated });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Delete
const deleteTask = async (req, res) => {
  try {
    const { id } = req.params;

    // 🔒 Check if the task is used in any transaction
    const isUsed = await req.db.transactionModel.exists({ task: id });
    if (isUsed) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete. This task is already used in transactions.',
      });
    }

    const deleted = await req.db.Task.findByIdAndDelete(id);
    if (!deleted) {
      return res.status(404).json({ success: false, message: 'Task not found' });
    }

    res.status(200).json({ success: true, message: 'Task deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};



module.exports = {
  createTask,
  getAllTasks,
  updateTask,
  deleteTask,
};
