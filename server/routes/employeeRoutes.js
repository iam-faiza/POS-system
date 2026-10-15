const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const User = require('../models/User');
const Role = require('../models/Role');
const { protect, checkPermission } = require('../middleware/authMiddleware');
const { PERMISSIONS } = require('../utils/permissions');

// GET /api/employees - List all registered staff (excluding passwords)
router.get('/', protect, checkPermission(PERMISSIONS.EMPLOYEES_MANAGE), async (req, res) => {
  try {
    const employees = await User.find({})
      .populate('roleRef', 'name')
      .select('-password')
      .sort({ name: 1 });
    res.json(employees);
  } catch (error) {
    res.status(500).json({ message: 'Unable to fetch employees' });
  }
});

// POST /api/employees - Register a new employee with credentials and assigned role
router.post('/', protect, checkPermission(PERMISSIONS.EMPLOYEES_MANAGE), async (req, res) => {
  const { name, email, password, roleRef } = req.body;

  if (!name || typeof name !== 'string' || name.trim().length < 2) {
    return res.status(400).json({ message: 'Valid employee name is required (at least 2 characters)' });
  }
  if (!email || typeof email !== 'string' || !email.includes('@')) {
    return res.status(400).json({ message: 'Valid email address is required' });
  }
  if (!password || typeof password !== 'string' || password.length < 6) {
    return res.status(400).json({ message: 'Password must be at least 6 characters long' });
  }

  try {
    const existing = await User.findOne({ email: email.toLowerCase().trim() });
    if (existing) {
      return res.status(409).json({ message: 'An account with this email address already exists' });
    }

    let validatedRoleRef = null;
    let legacyRoleString = 'cashier';

    if (roleRef && mongoose.isObjectIdOrHexString(roleRef)) {
      const roleDoc = await Role.findById(roleRef);
      if (!roleDoc) {
        return res.status(400).json({ message: 'Selected role does not exist' });
      }
      validatedRoleRef = roleDoc._id;
      // Maintain legacy fallback string if role is admin
      legacyRoleString = roleDoc.name.toLowerCase() === 'admin' ? 'admin' : 'cashier';
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const newEmployee = await User.create({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      password: hashedPassword,
      role: legacyRoleString,
      roleRef: validatedRoleRef
    });

    const sanitized = await User.findById(newEmployee._id)
      .populate('roleRef', 'name')
      .select('-password');

    return res.status(201).json(sanitized);
  } catch (error) {
    return res.status(500).json({ message: 'Unable to register employee' });
  }
});

// DELETE /api/employees/:id - Safely remove an employee account
router.delete('/:id', protect, checkPermission(PERMISSIONS.EMPLOYEES_MANAGE), async (req, res) => {
  if (!mongoose.isObjectIdOrHexString(req.params.id)) {
    return res.status(400).json({ message: 'Invalid employee ID' });
  }

  try {
    if (req.params.id === req.user.id) {
      return res.status(403).json({ message: 'You cannot delete your own currently active administrator account' });
    }

    const employee = await User.findById(req.params.id);
    if (!employee) {
      return res.status(404).json({ message: 'Employee not found' });
    }

    await employee.deleteOne();
    return res.json({ message: 'Employee account removed successfully' });
  } catch (error) {
    return res.status(500).json({ message: 'Unable to delete employee' });
  }
});

module.exports = router;