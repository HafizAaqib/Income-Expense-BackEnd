// routes/taskRoutes.js
const express = require('express');
const {
  createTask,
  getAllTasks,
  updateTask,
  deleteTask,
} = require('../controllers/taskController');

const router = express.Router();

router.post('/', createTask);
router.get('/', getAllTasks);
router.put('/:id', updateTask);
router.delete('/:id', deleteTask);

module.exports = router;
