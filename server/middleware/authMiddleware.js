const jwt = require('jsonwebtoken');
const User = require('../models/User');

function createProtect({ UserModel = User, jwtLibrary = jwt, getSecret = () => process.env.JWT_SECRET } = {}) {
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
      const user = await UserModel.findById(decoded.id).select('_id role');
      if (!user || !['admin', 'cashier'].includes(user.role)) {
        return res.status(401).json({ message: 'Not authorized, account unavailable' });
      }

      req.user = { id: String(user._id), role: user.role };
      return next();
    } catch (error) {
      return res.status(503).json({ message: 'Authentication service unavailable' });
    }
  };
}

const protect = createProtect();

const admin = (req, res, next) => {
  if (req.user && req.user.role === 'admin') {
    return next();
  }
  return res.status(403).json({ message: 'Not authorized as an admin' });
};

module.exports = { protect, admin, createProtect };
