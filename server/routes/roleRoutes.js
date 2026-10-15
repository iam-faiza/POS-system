const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Role = require('../models/Role');
const User = require('../models/User');
const { protect, checkPermission } = require('../middleware/authMiddleware');
const { PERMISSIONS , ROLE_TEMPLATES} = require('../utils/permissions');

const ALL_VALID_PERMISSIONS = Object.values(PERMISSIONS);

function validatePermissions(permissions) {
  if (!Array.isArray(permissions)) return false;
  return permissions.every((p) => typeof p === 'string' && ALL_VALID_PERMISSIONS.includes(p));
}

// Helper to escape regex special characters for safe duplicate searching
function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// GET /api/roles - List all roles and their permissions
router.get('/', protect, checkPermission(PERMISSIONS.ROLES_MANAGE), async (req, res) => {
  try {
    const roles = await Role.find({}).sort({ name: 1 });
    res.json(roles);
  } catch (error) {
    res.status(500).json({ message: 'Unable to load roles' });
  }
});

router.get('/presets', protect, checkPermission(PERMISSIONS.ROLES_MANAGE), async (req, res) => {
  try {
    res.json(ROLE_TEMPLATES);
  } catch (error) {
    res.status(500).json({ message: 'Unable to load role presets' });
  }
});

// POST /api/roles - Create a custom role
router.post('/', protect, checkPermission(PERMISSIONS.ROLES_MANAGE), async (req, res) => {
  const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
  const description = typeof req.body?.description === 'string' ? req.body.description.trim() : '';
  const permissions = req.body?.permissions;

  if (!name || name.length < 2 || name.length > 50) {
    return res.status(400).json({ message: 'Role name must be between 2 and 50 characters' });
  }

  if (!validatePermissions(permissions)) {
    return res.status(400).json({ message: 'Invalid or unrecognized permission keys provided' });
  }

  // Privilege delegation policy: Users cannot grant permissions they do not possess themselves
  const userPermissions = req.user.permissions || [];
  const isMasterAdmin = userPermissions.includes(PERMISSIONS.ROLES_MANAGE) && userPermissions.includes(PERMISSIONS.EMPLOYEES_MANAGE);
  if (!isMasterAdmin) {
    const unauthorizedGranted = permissions.some((p) => !userPermissions.includes(p));
    if (unauthorizedGranted) {
      return res.status(403).json({ message: 'Cannot grant permissions that you do not personally possess' });
    }
  }

  try {
    const safeNameRegex = new RegExp(`^${escapeRegExp(name)}$`, 'i');
    const existing = await Role.findOne({ name: safeNameRegex });
    if (existing) {
      return res.status(409).json({ message: 'A role with this name already exists' });
    }

    const newRole = new Role({
      name,
      description,
      permissions,
      isSystemRole: false
    });

    const saved = await newRole.save();
    return res.status(201).json(saved);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ message: 'A role with this name already exists' });
    }
    return res.status(500).json({ message: 'Unable to create role' });
  }
});

// PUT /api/roles/:id - Update a custom role
router.put('/:id', protect, checkPermission(PERMISSIONS.ROLES_MANAGE), async (req, res) => {
  if (!mongoose.isObjectIdOrHexString(req.params.id)) {
    return res.status(400).json({ message: 'Role ID is invalid' });
  }

  const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
  const description = typeof req.body?.description === 'string' ? req.body.description.trim() : '';
  const permissions = req.body?.permissions;

  if (!name || name.length < 2 || name.length > 50) {
    return res.status(400).json({ message: 'Role name must be between 2 and 50 characters' });
  }

  if (!validatePermissions(permissions)) {
    return res.status(400).json({ message: 'Invalid or unrecognized permission keys provided' });
  }

  // Privilege delegation check
  const userPermissions = req.user.permissions || [];
  const isMasterAdmin = userPermissions.includes(PERMISSIONS.ROLES_MANAGE) && userPermissions.includes(PERMISSIONS.EMPLOYEES_MANAGE);
  if (!isMasterAdmin) {
    const unauthorizedGranted = permissions.some((p) => !userPermissions.includes(p));
    if (unauthorizedGranted) {
      return res.status(403).json({ message: 'Cannot assign permissions that you do not personally possess' });
    }
  }

  try {
    const role = await Role.findById(req.params.id);
    if (!role) {
      return res.status(404).json({ message: 'Role not found' });
    }

    // Protect system roles from being renamed or stripped of critical permissions unsafely
    if (role.isSystemRole) {
      if (role.name.toLowerCase() !== name.toLowerCase()) {
        return res.status(403).json({ message: 'System role names cannot be changed' });
      }
      if (role.name.toLowerCase() === 'admin' && !permissions.includes(PERMISSIONS.ROLES_MANAGE)) {
        return res.status(403).json({ message: 'System admin role must retain roles.manage permission' });
      }
    }

    const safeNameRegex = new RegExp(`^${escapeRegExp(name)}$`, 'i');
    const duplicate = await Role.findOne({ name: safeNameRegex, _id: { $ne: role._id } });
    if (duplicate) {
      return res.status(409).json({ message: 'Another role with this name already exists' });
    }

    role.name = name;
    role.description = description;
    role.permissions = permissions;

    const updated = await role.save();
    return res.json(updated);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ message: 'Another role with this name already exists' });
    }
    return res.status(500).json({ message: 'Unable to update role' });
  }
});

// DELETE /api/roles/:id - Safely delete an unused custom role
router.delete('/:id', protect, checkPermission(PERMISSIONS.ROLES_MANAGE), async (req, res) => {
  if (!mongoose.isObjectIdOrHexString(req.params.id)) {
    return res.status(400).json({ message: 'Role ID is invalid' });
  }

  try {
    const role = await Role.findById(req.params.id);
    if (!role) {
      return res.status(404).json({ message: 'Role not found' });
    }

    if (role.isSystemRole) {
      return res.status(403).json({ message: 'System roles cannot be deleted' });
    }

    // Check against both roleRef and legacy string-based role field to prevent orphaning any user
    const assignedUsersCount = await User.countDocuments({
      $or: [
        { roleRef: role._id },
        { role: role.name.toLowerCase() }
      ]
    });

    if (assignedUsersCount > 0) {
      return res.status(409).json({ 
        message: `Cannot delete role because it is currently assigned to ${assignedUsersCount} active or legacy user(s)` 
      });
    }

    await role.deleteOne();
    return res.json({ message: 'Role deleted successfully' });
  } catch (error) {
    return res.status(500).json({ message: 'Unable to delete role' });
  }
});

module.exports = router;