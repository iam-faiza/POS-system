const jwt = require('jsonwebtoken');
const crypto = require('node:crypto');
const User = require('../models/User');
const Role = require('../models/Role');
const PosSession = require('../models/PosSession');
const { DEFAULT_ROLE_PERMISSIONS } = require('../utils/permissions');

function createProtect({
  UserModel = User,
  RoleModel = Role,
  SessionModel = PosSession,
  jwtLibrary = jwt,
  getSecret = () => process.env.JWT_SECRET,
  allowLockedSessions = false
} = {}) {
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
      const sessionId = decoded.jti || `legacy:${crypto.createHash('sha256').update(match[1]).digest('hex')}`;
      const user = await UserModel.findById(decoded.id).populate('roleRef').select('_id role roleRef');
      if (!user) {
        return res.status(401).json({ message: 'Not authorized, account unavailable' });
      }

      const expiresAt = new Date((decoded.exp || (Date.now() / 1000 + 30 * 24 * 60 * 60)) * 1000);
      const session = await SessionModel.findOneAndUpdate(
        { sessionId, user: user._id },
        { $setOnInsert: { sessionId, user: user._id, locked: false, lockedAt: null, expiresAt } },
        { returnDocument: 'after', upsert: true }
      );
      if (!session) {
        return res.status(503).json({ message: 'Session state unavailable' });
      }
      if (session.locked && !allowLockedSessions) {
        return res.status(423).json({ message: 'POS session is locked' });
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
        permissions: permissions,
        sessionId
      };
      req.authSession = session;
      return next();
    } catch (error) {
      console.error('Auth error:', error);
      return res.status(503).json({ message: 'Authentication service unavailable' });
    }
  };
}

const protect = createProtect();
const protectLockedSession = createProtect({ allowLockedSessions: true });

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

module.exports = { protect, protectLockedSession, admin, checkPermission, createProtect };
