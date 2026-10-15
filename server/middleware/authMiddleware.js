const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Role = require('../models/Role');
const { DEFAULT_ROLE_PERMISSIONS } = require('../utils/permissions');

function createProtect({ UserModel = User, RoleModel = Role, jwtLibrary = jwt, getSecret = () => process.env.JWT_SECRET } = {}) {
  return async (req, res, next) => {
    const authorization = req.headers.authorization || '';
    const match = authorization.match(/^Bearer\s+(\S+)$/i);
    if (!match) {
      return res.status(401).json({ message: 'Not authorized, no token' });
    }

    let decoded;
    try {
      decoded = jwtLibrary.verify(match[1], getSecret(), { algorithms: ['HS256'] });
    } catch (error) {
      return res.status(401).json({ message: 'Not authorized, token failed' });
    }
    if (!decoded.id) {
      return res.status(401).json({ message: 'Not authorized, token failed' });
    }

    try {
      const user = await UserModel.findById(decoded.id).populate('roleRef').select('_id role roleRef');
      if (!user) {
        return res.status(401).json({ message: 'Not authorized, account unavailable' });
      }

      let permissions = [];
      let roleName = user.role;

      if (user.roleRef) {
        permissions = user.roleRef.permissions || [];
        roleName = user.roleRef.name;
      } else if (DEFAULT_ROLE_PERMISSIONS[user.role]) {
        permissions = DEFAULT_ROLE_PERMISSIONS[user.role];
      } else {
        return res.status(401).json({ message: 'Not authorized, account role invalid' });
      }

      req.user = { 
        id: String(user._id), 
        role: roleName,
        permissions: permissions
      };
      return next();
    } catch (error) {
      console.error('Auth error:', error);
      return res.status(503).json({ message: 'Authentication service unavailable' });
    }
  };
}

const protect = createProtect();

const admin = (req, res, next) => {
  if (req.user && (req.user.role === 'admin' || (req.user.permissions && req.user.permissions.includes('roles.manage')))) {
    return next();
  }
  return res.status(403).json({ message: 'Not authorized as an admin' });
};

const checkPermission = (permission) => {
  return (req, res, next) => {
    if (req.user && req.user.permissions && req.user.permissions.includes(permission)) {
      return next();
    }
    return res.status(403).json({ message: `Access denied: missing permission ${permission}` });
  };
};

module.exports = { protect, admin, checkPermission, createProtect };
