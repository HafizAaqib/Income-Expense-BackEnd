const express = require('express');
const {
    loginController,
    createUser,
    getAllUsers,
    updateUser,
    deleteUser
} = require('../controllers/userController');

const router = express.Router();

router.post('/login', loginController);
router.post('/createUser', createUser);           // Create
router.get('/getAllUsers', getAllUsers);           // Read
router.put('/:id', updateUser);        // Update
router.delete('/:id', deleteUser);     // Delete

module.exports = router;
