// authMiddleware.js
const jwt = require('jsonwebtoken');

function auth(req, res, next) {
  const authHeader = req.headers.authorization;

  // 1. No header at all
  if (!authHeader) {
    return res.status(401).json({
      success: false,
      message: 'Authorization header missing'
    });
  }

  // 2. Must be "Bearer token"
  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return res.status(401).json({
      success: false,
      message: 'Invalid authorization format'
    });
  }

  const token = parts[1];

  // 3. Verify token
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Put admin data into request
    req.admin = decoded;

    return next();
  } catch (err) {
    return res.status(401).json({
      success: false,
      message: 'Invalid or expired token'
    });
  }
}

module.exports = auth;
