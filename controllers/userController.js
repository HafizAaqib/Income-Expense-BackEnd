//const userModel = require('../models/userModel');

// Login
const loginController = async (req, res) => {
  try {
    const { userName, password } = req.body;
console.log(req.body)
    // ✅ SuperAdmin bypass login
    if (userName === 'superAdmin' && password === 'A8#SD$G%^8H2') {
      return res.status(200).json({
        success: true,
        user: {
          name: 'Super Admin',
          userName: 'superAdmin',
          isAdmin: true,
          canViewOtherUsersData: true,
          canAddData: true,
          canUpdateData: true,
          _id: 'superadmin-id', // Fake ID to mimic MongoDB format
        },
      });
    }

    // ✅ Normal login from DB
    const user = await req.db.userModel.findOne({ userName, password });

    if (!user) {
      return res.status(400).send('Login ID or Password is not correct');
    }

    res.status(200).json({
      success: true,
      user,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error,
    });
  }
};


// Create new user
const createUser = async (req, res) => {
    try {
        const { userName } = req.body;

        const existingUser = await req.db.userModel.findOne({ userName });
        if (existingUser) {
            return res.status(400).json({ success: false, message: 'Login ID already exists' });
        }

        const newUser = new req.db.userModel(req.body);
        await newUser.save();
        console.log("Saved user:", newUser);

        res.status(201).json({
            success: true,
            user: newUser
        });
    } catch (error) {
        if (error.code === 11000) {
            return res.status(400).json({
                success: false,
                message: 'Login ID already exists',
            });
        }
        res.status(400).json({
            success: false,
            message: error.message || error,
        });
    }
};

// Get all users
const getAllUsers = async (req, res) => {
    try {
        const users = await req.db.userModel.find().sort({ name: 1 });
        res.status(200).json({
            success: true,
            users
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message || error
        });
    }
};

// Update user
const updateUser = async (req, res) => {
    try {
        const userId = req.params.id;
        const updates = req.body;

        const user = await req.db.userModel.findById(userId);
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        const adminCount = await req.db.userModel.countDocuments({ isAdmin: true });

        // Check if the last admin is being demoted
        if (user.isAdmin && updates.isAdmin === false && adminCount === 1) {
            return res.status(400).json({
                success: false,
                message: 'At least one admin user is required. You cannot demote the last admin.'
            });
        }

        const updatedUser = await req.db.userModel.findByIdAndUpdate(userId, updates, { new: true });
        res.status(200).json({
            success: true,
            user: updatedUser
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            message: error.message || error
        });
    }
};

// Delete user
const deleteUser = async (req, res) => {
    try {
        const userId = req.params.id;
        const user = await req.db.userModel.findById(userId);

        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        if (user.isAdmin) {
            const adminCount = await req.db.userModel.countDocuments({ isAdmin: true });
            if (adminCount === 1) {
                return res.status(400).json({
                    success: false,
                    message: 'Cannot delete the last admin user. At least one admin is required.'
                });
            }
        }

        await req.db.userModel.findByIdAndDelete(userId);
        res.status(200).json({
            success: true,
            message: 'User deleted successfully'
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            message: error.message || error
        });
    }
};

module.exports = {
    loginController,
    createUser,
    getAllUsers,
    updateUser,
    deleteUser
};
