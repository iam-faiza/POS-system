const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const { createLoginRateLimiter } = require('../security/loginRateLimit');
const DUMMY_PASSWORD_HASH = bcrypt.hashSync('not-a-real-pos-account-password', 10);

function createAuthRouter({
  UserModel = User,
  jwtLibrary = jwt,
  bcryptLibrary = bcrypt,
  getSecret = () => process.env.JWT_SECRET,
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
      const user = await UserModel.findOne({ email });
      const passwordMatches = await bcryptLibrary.compare(password, user?.password || DUMMY_PASSWORD_HASH);
      if (!user || !['admin', 'cashier'].includes(user.role) || !passwordMatches) {
        return res.status(401).json({ message: 'Invalid email or password' });
      }

      return res.json({
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        token: jwtLibrary.sign(
          { id: user._id, role: user.role },
          getSecret(),
          { expiresIn: '30d', algorithm: 'HS256' }
        )
      });
    } catch (error) {
      return res.status(500).json({ message: 'Unable to sign in at this time' });
    }
  });

  return authRouter;
}

module.exports = createAuthRouter();
module.exports.createAuthRouter = createAuthRouter;
