const express = require('express');
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const User = require('../models/User');
const Role = require('../models/Role');
const { protect, checkPermission } = require('../middleware/authMiddleware');
const { PERMISSIONS } = require('../utils/permissions');

function isAdministratorAccount(account) {
  const roleName = account?.roleRef?.name || account?.role;
  return String(roleName || '').trim().toLowerCase() === 'admin';
}

function isAdministratorRole(role) {
  return String(role?.name || role?.role || '').trim().toLowerCase() === 'admin';
}

function createEmployeeRouter({
  UserModel = User,
  RoleModel = Role,
  bcryptLibrary = bcrypt,
  mongooseClient = mongoose,
  protectMiddleware = protect,
  checkPermissionMiddleware = checkPermission
} = {}) {
  const employeeRouter = express.Router();
  const employeePermission = checkPermissionMiddleware(PERMISSIONS.EMPLOYEES_MANAGE);

  async function countAdministrators() {
    const adminRoles = await RoleModel.find({ name: /^admin$/i });
    const adminRoleIds = adminRoles.map((role) => role._id);
    return UserModel.countDocuments({
      $or: [
        { role: /^admin$/i },
        { roleRef: { $in: adminRoleIds } }
      ]
    });
  }

  employeeRouter.get('/', protectMiddleware, employeePermission, async (_req, res) => {
    try {
      const employees = await UserModel.find({})
        .populate('roleRef', 'name')
        .select('-password')
        .sort({ name: 1 });
      res.json(employees);
    } catch (error) {
      res.status(500).json({ message: 'Unable to fetch employees' });
    }
  });

  employeeRouter.post('/', protectMiddleware, employeePermission, async (req, res) => {
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
      const existing = await UserModel.findOne({ email: email.toLowerCase().trim() });
      if (existing) {
        return res.status(409).json({ message: 'An account with this email address already exists' });
      }

      let validatedRoleRef = null;
      let legacyRoleString = 'cashier';

      if (roleRef && mongooseClient.isObjectIdOrHexString(roleRef)) {
        const roleDoc = await RoleModel.findById(roleRef);
        if (!roleDoc) {
          return res.status(400).json({ message: 'Selected role does not exist' });
        }
        if (isAdministratorRole(roleDoc) && !isAdministratorAccount(req.user)) {
          return res.status(403).json({ message: 'Only an administrator can assign the administrator role' });
        }
        validatedRoleRef = roleDoc._id;
        legacyRoleString = isAdministratorRole(roleDoc) ? 'admin' : 'cashier';
      }

      const salt = await bcryptLibrary.genSalt(10);
      const hashedPassword = await bcryptLibrary.hash(password, salt);
      const newEmployee = await UserModel.create({
        name: name.trim(),
        email: email.toLowerCase().trim(),
        password: hashedPassword,
        role: legacyRoleString,
        roleRef: validatedRoleRef
      });

      const sanitized = await UserModel.findById(newEmployee._id)
        .populate('roleRef', 'name')
        .select('-password');
      return res.status(201).json(sanitized);
    } catch (error) {
      return res.status(500).json({ message: 'Unable to register employee' });
    }
  });

  employeeRouter.put('/:id', protectMiddleware, employeePermission, async (req, res) => {
    if (!mongooseClient.isObjectIdOrHexString(req.params.id)) {
      return res.status(400).json({ message: 'Invalid employee ID' });
    }

    try {
      const employee = await UserModel.findById(req.params.id).populate('roleRef');
      if (!employee) {
        return res.status(404).json({ message: 'Employee not found' });
      }
      if (isAdministratorAccount(employee) && !isAdministratorAccount(req.user)) {
        return res.status(403).json({ message: 'Only an administrator can manage administrator accounts' });
      }

      if (req.body.name !== undefined) {
        if (typeof req.body.name !== 'string' || req.body.name.trim().length < 2) {
          return res.status(400).json({ message: 'Valid employee name is required (at least 2 characters)' });
        }
        employee.name = req.body.name.trim();
      }
      if (req.body.email !== undefined) {
        if (typeof req.body.email !== 'string' || !req.body.email.includes('@')) {
          return res.status(400).json({ message: 'Valid email address is required' });
        }
        employee.email = req.body.email.toLowerCase().trim();
      }
      if (req.body.password !== undefined) {
        if (typeof req.body.password !== 'string' || req.body.password.length < 6) {
          return res.status(400).json({ message: 'Password must be at least 6 characters long' });
        }
        const salt = await bcryptLibrary.genSalt(10);
        employee.password = await bcryptLibrary.hash(req.body.password, salt);
      }

      if (req.body.roleRef !== undefined) {
        if (!mongooseClient.isObjectIdOrHexString(req.body.roleRef)) {
          return res.status(400).json({ message: 'Selected role does not exist' });
        }
        const roleDoc = await RoleModel.findById(req.body.roleRef);
        if (!roleDoc) {
          return res.status(400).json({ message: 'Selected role does not exist' });
        }
        if (isAdministratorRole(roleDoc) && !isAdministratorAccount(req.user)) {
          return res.status(403).json({ message: 'Only an administrator can assign the administrator role' });
        }
        if (isAdministratorAccount(employee) && !isAdministratorRole(roleDoc) && await countAdministrators() <= 1) {
          return res.status(409).json({ message: 'The last administrator account cannot be demoted' });
        }
        employee.roleRef = roleDoc._id;
        employee.role = isAdministratorRole(roleDoc) ? 'admin' : 'cashier';
      }

      await employee.save();
      const sanitized = await UserModel.findById(employee._id)
        .populate('roleRef', 'name')
        .select('-password');
      return res.json(sanitized);
    } catch (error) {
      return res.status(500).json({ message: 'Unable to update employee' });
    }
  });

  employeeRouter.delete('/:id', protectMiddleware, employeePermission, async (req, res) => {
    if (!mongooseClient.isObjectIdOrHexString(req.params.id)) {
      return res.status(400).json({ message: 'Invalid employee ID' });
    }

    try {
      if (req.params.id === req.user.id) {
        return res.status(403).json({ message: 'You cannot delete your own account' });
      }

      const employee = await UserModel.findById(req.params.id).populate('roleRef');
      if (!employee) {
        return res.status(404).json({ message: 'Employee not found' });
      }
      if (isAdministratorAccount(employee) && !isAdministratorAccount(req.user)) {
        return res.status(403).json({ message: 'Only an administrator can manage administrator accounts' });
      }
      if (isAdministratorAccount(employee) && await countAdministrators() <= 1) {
        return res.status(409).json({ message: 'The last administrator account cannot be deleted' });
      }

      await employee.deleteOne();
      return res.json({ message: 'Employee account removed successfully' });
    } catch (error) {
      return res.status(500).json({ message: 'Unable to delete employee' });
    }
  });

  return employeeRouter;
}

module.exports = createEmployeeRouter();
module.exports.createEmployeeRouter = createEmployeeRouter;
module.exports.isAdministratorAccount = isAdministratorAccount;