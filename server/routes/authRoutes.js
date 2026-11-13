const express = require('express');
const router = express.Router();
const crypto = require('node:crypto');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const PosSession = require('../models/PosSession');
const { DEFAULT_ROLE_PERMISSIONS } = require('../utils/permissions');
const { createLoginRateLimiter } = require('../security/loginRateLimit');
const { protect, protectLockedSession } = require('../middleware/authMiddleware');
const {
  PIN_LOCKOUT_MS,
  PIN_MAX_ATTEMPTS,
  getPinLockoutUntil,
  hashPin,
  isValidPin,
  verifyPin
} = require('../security/employeePin');
const DUMMY_PASSWORD_HASH = bcrypt.hashSync('not-a-real-pos-account-password', 10);

function createAuthRouter({
  UserModel = User,
  SessionModel = PosSession,
  jwtLibrary = jwt,
  bcryptLibrary = bcrypt,
  getSecret = () => process.env.JWT_SECRET,
  getPinPepper = () => process.env.PIN_PEPPER || process.env.JWT_SECRET,
  protectMiddleware = protect,
  allowLockedSessionMiddleware = protectLockedSession,
  now = Date.now,
  loginRateLimiter = createLoginRateLimiter()
} = {}) {
  const authRouter = express.Router();

  // @desc Auth user & get token
  // @route POST /api/auth/login
  authRouter.post('/login', loginRateLimiter, async (req, res) => {
    const email = typeof req.body?.email === 'string' ? req.body.email.trim() : '';
    const password = typeof req.body?.password === 'string' ? req.body.password : '';
    const validEmail = email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    if (!validEmail || password.length < 1 || password.length > 1024) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    try {
      const user = await UserModel.findOne({ email }).populate('roleRef');
      const passwordMatches = await bcryptLibrary.compare(password, user?.password || DUMMY_PASSWORD_HASH);
      
      if (!user || !passwordMatches) {
        return res.status(401).json({ message: 'Invalid email or password' });
      }

      let permissions = [];
      let roleName = user.role;

      if (user.roleRef) {
        permissions = user.roleRef.permissions || [];
        roleName = user.roleRef.name;
      } else if (DEFAULT_ROLE_PERMISSIONS[user.role]) {
        permissions = DEFAULT_ROLE_PERMISSIONS[user.role];
      } else {
        // Fallback for users with no valid role
        return res.status(401).json({ message: 'Account role invalid' });
      }

      const sessionId = crypto.randomUUID();
      const token = jwtLibrary.sign(
        { id: user._id, role: roleName, permissions, jti: sessionId },
        getSecret(),
        { expiresIn: process.env.JWT_EXPIRES_IN || '30d', algorithm: 'HS256' }
      );
      const decodedToken = jwtLibrary.decode(token);
      await SessionModel.create({
        sessionId,
        user: user._id,
        locked: false,
        expiresAt: new Date(decodedToken.exp * 1000)
      });

      return res.json({
        _id: user._id,
        name: user.name,
        email: user.email,
        role: roleName,
        permissions: permissions,
        token
      });
    } catch (error) {
      return res.status(500).json({ message: 'Unable to sign in at this time' });
    }
  });

  async function loadPinUser(userId) {
    return UserModel.findById(userId).select('+password +pinHash +pinFailedAttempts +pinLockedUntil');
  }

  function rejectIfLocked(user, res) {
    const lockoutUntil = getPinLockoutUntil(user);
    if (!lockoutUntil || lockoutUntil.getTime() <= now()) return false;
    const retryAfter = Math.max(1, Math.ceil((lockoutUntil.getTime() - now()) / 1000));
    res.set('Retry-After', String(retryAfter));
    res.status(429).json({ message: 'Too many incorrect attempts. Try again later.' });
    return true;
  }

  async function recordInvalidCredential(user, res) {
    await UserModel.updateOne({ _id: user._id }, { $inc: { pinFailedAttempts: 1 } });
    const attempts = await UserModel.findById(user._id).select('+pinFailedAttempts');
    if (Number(attempts?.pinFailedAttempts || 0) >= PIN_MAX_ATTEMPTS) {
      const lockoutUntil = new Date(now() + PIN_LOCKOUT_MS);
      await UserModel.updateOne({ _id: user._id }, {
        $set: { pinFailedAttempts: 0, pinLockedUntil: lockoutUntil }
      });
      res.set('Retry-After', String(Math.ceil(PIN_LOCKOUT_MS / 1000)));
      return res.status(429).json({ message: 'Too many incorrect attempts. Try again later.' });
    }
    return res.status(401).json({ message: 'Invalid PIN or password' });
  }

  async function clearInvalidCredentials(userId) {
    await UserModel.updateOne({ _id: userId }, {
      $set: { pinFailedAttempts: 0, pinLockedUntil: null }
    });
  }

  authRouter.get('/lock/status', allowLockedSessionMiddleware, async (req, res) => {
    try {
      const user = await UserModel.findById(req.user.id).select('+pinHash');
      if (!user) return res.status(401).json({ message: 'Account unavailable' });
      return res.json({ locked: Boolean(req.authSession?.locked), hasPin: Boolean(user.pinHash) });
    } catch (error) {
      return res.status(503).json({ message: 'Unable to load session lock status' });
    }
  });

  authRouter.post('/lock', protectMiddleware, async (req, res) => {
    try {
      const result = await SessionModel.updateOne(
        { sessionId: req.user.sessionId, user: req.user.id },
        { $set: { locked: true, lockedAt: new Date(now()) } }
      );
      if (!result.matchedCount) return res.status(401).json({ message: 'Session unavailable' });
      return res.json({ locked: true });
    } catch (error) {
      return res.status(503).json({ message: 'Unable to lock POS session' });
    }
  });

  authRouter.get('/pin/status', protectMiddleware, async (req, res) => {
    try {
      const user = await UserModel.findById(req.user.id).select('+pinHash');
      if (!user) return res.status(401).json({ message: 'Account unavailable' });
      return res.json({ hasPin: Boolean(user.pinHash) });
    } catch (error) {
      return res.status(503).json({ message: 'Unable to load PIN settings' });
    }
  });

  authRouter.post('/pin', protectMiddleware, async (req, res) => {
    const { pin, confirmPin, currentPin } = req.body || {};
    if (!isValidPin(pin)) {
      return res.status(400).json({ message: 'PIN must contain exactly four digits' });
    }
    if (confirmPin !== pin) {
      return res.status(400).json({ message: 'PIN confirmation does not match' });
    }

    try {
      const user = await loadPinUser(req.user.id);
      if (!user) return res.status(401).json({ message: 'Account unavailable' });
      if (rejectIfLocked(user, res)) return;

      const hadPin = Boolean(user.pinHash);
      if (hadPin) {
        if (!isValidPin(currentPin)) {
          return res.status(400).json({ message: 'Enter your current four-digit PIN to update it' });
        }
        if (!await verifyPin(currentPin, user.pinHash, { bcryptLibrary, pepper: getPinPepper() })) {
          return recordInvalidCredential(user, res);
        }
      }

      const pinHash = await hashPin(pin, { bcryptLibrary, pepper: getPinPepper() });
      await UserModel.updateOne({ _id: user._id }, {
        $set: { pinHash, pinFailedAttempts: 0, pinLockedUntil: null }
      });
      return res.json({ hasPin: true, message: hadPin ? 'PIN updated successfully' : 'PIN set successfully' });
    } catch (error) {
      return res.status(503).json({ message: 'Unable to save PIN settings' });
    }
  });

  authRouter.delete('/pin', protectMiddleware, async (req, res) => {
    const { currentPin } = req.body || {};
    if (!isValidPin(currentPin)) {
      return res.status(400).json({ message: 'Enter your current four-digit PIN' });
    }

    try {
      const user = await loadPinUser(req.user.id);
      if (!user) return res.status(401).json({ message: 'Account unavailable' });
      if (rejectIfLocked(user, res)) return;
      if (!user.pinHash) return res.status(409).json({ message: 'No PIN is configured' });
      if (!await verifyPin(currentPin, user.pinHash, { bcryptLibrary, pepper: getPinPepper() })) {
        return recordInvalidCredential(user, res);
      }

      await UserModel.updateOne({ _id: user._id }, {
        $unset: { pinHash: 1 },
        $set: { pinFailedAttempts: 0, pinLockedUntil: null }
      });
      return res.json({ hasPin: false, message: 'PIN removed successfully' });
    } catch (error) {
      return res.status(503).json({ message: 'Unable to remove PIN' });
    }
  });

  authRouter.post('/unlock', allowLockedSessionMiddleware, async (req, res) => {
    const { pin, password } = req.body || {};
    try {
      const user = await loadPinUser(req.user.id);
      if (!user) return res.status(401).json({ message: 'Account unavailable' });
      if (rejectIfLocked(user, res)) return;

      let credentialMatches = false;
      if (user.pinHash) {
        credentialMatches = await verifyPin(pin, user.pinHash, { bcryptLibrary, pepper: getPinPepper() });
      } else if (typeof password === 'string' && password.length > 0 && password.length <= 1024) {
        credentialMatches = await bcryptLibrary.compare(password, user.password);
      }

      if (!credentialMatches) return recordInvalidCredential(user, res);
      await clearInvalidCredentials(user._id);
      const sessionUpdate = await SessionModel.updateOne(
        { sessionId: req.user.sessionId, user: req.user.id },
        { $set: { locked: false, lockedAt: null } }
      );
      if (!sessionUpdate.matchedCount) return res.status(401).json({ message: 'Session unavailable' });
      return res.json({ unlocked: true });
    } catch (error) {
      return res.status(503).json({ message: 'Unable to verify unlock credentials' });
    }
  });

  return authRouter;
}

module.exports = createAuthRouter();
module.exports.createAuthRouter = createAuthRouter;