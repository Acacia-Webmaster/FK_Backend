// authRoutes.js
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('./db');
const auth = require('./authMiddleware');
const { sendPasswordResetEmail } = require('./email');

const router = express.Router();

// Helper: normal auth token for login
function createToken(admin) {
  return jwt.sign(
    { id: admin.id, email: admin.email },
    process.env.JWT_SECRET,
    { expiresIn: process.env.TOKEN_EXPIRES_IN || '7d' }
  );
}

// Helper: reset token for password reset via email
function createResetToken(admin) {
  return jwt.sign(
    { id: admin.id, email: admin.email, type: 'password_reset' },
    process.env.JWT_SECRET,
    { expiresIn: process.env.RESET_TOKEN_EXPIRES_IN || '15m' }
  );
}

/**
 * POST /auth/register
 * Signup route – create the ONLY admin account.
 * Call this ONCE to create the first admin, then use /auth/login afterwards.
 */
router.post('/register', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res
        .status(400)
        .json({ message: 'Email and password are required' });
    }

    // Allow only one admin in DB
    const [countRows] = await pool.execute(
      'SELECT COUNT(*) AS cnt FROM admins'
    );
    if (countRows[0].cnt > 0) {
      return res
        .status(400)
        .json({ message: 'Admin already exists. Please log in.' });
    }

    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(password, salt);

    const [result] = await pool.execute(
      'INSERT INTO admins (email, password_hash) VALUES (?, ?)',
      [email, hash]
    );

    const token = createToken({ id: result.insertId, email });

    res.status(201).json({
      token,
      email,
      message: 'Admin created successfully',
    });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ message: 'Error registering admin' });
  }
});

/**
 * POST /auth/login
 * Login route – returns a JWT if email/password are correct.
 */
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res
        .status(400)
        .json({ message: 'Email and password are required' });
    }

    const [rows] = await pool.execute(
      'SELECT * FROM admins WHERE email = ?',
      [email]
    );
    if (rows.length === 0) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const admin = rows[0];
    const isMatch = await bcrypt.compare(password, admin.password_hash);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const token = createToken(admin);

    res.json({
      token,
      email: admin.email,
      message: 'Login successful',
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ message: 'Error logging in' });
  }
});

/**
 * POST /auth/change-password
 * Change password for the currently logged-in admin (requires old password).
 * Requires Authorization: Bearer <token>
 * Body: { currentPassword, newPassword }
 */
router.post('/change-password', auth, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res
        .status(400)
        .json({ message: 'Current and new password are required' });
    }

    const adminId = req.admin.id;

    const [rows] = await pool.execute(
      'SELECT * FROM admins WHERE id = ?',
      [adminId]
    );
    if (rows.length === 0) {
      return res.status(404).json({ message: 'Admin not found' });
    }

    const admin = rows[0];

    const isMatch = await bcrypt.compare(currentPassword, admin.password_hash);
    if (!isMatch) {
      return res
        .status(401)
        .json({ message: 'Current password is incorrect' });
    }

    const salt = await bcrypt.genSalt(10);
    const newHash = await bcrypt.hash(newPassword, salt);

    await pool.execute(
      'UPDATE admins SET password_hash = ? WHERE id = ?',
      [newHash, adminId]
    );

    res.json({ message: 'Password updated successfully' });
  } catch (err) {
    console.error('Change password error:', err);
    res.status(500).json({ message: 'Error changing password' });
  }
});

/**
 * POST /auth/request-password-reset
 * Step 1: Admin requests a password reset by email.
 * Body: { email }
 * We generate a reset token and send an email with the reset link.
 */
router.post('/request-password-reset', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: 'Email is required' });
    }

    const [rows] = await pool.execute(
      'SELECT * FROM admins WHERE email = ?',
      [email]
    );

    // For security, never reveal whether the email exists.
    if (rows.length === 0) {
      return res.json({
        message:
          'Reset link sent to the admin email.',
      });
    }

    const admin = rows[0];
    const resetToken = createResetToken(admin);

    const frontendBase = process.env.FRONTEND_URL || 'http://localhost:5173';
    const resetUrl = `${frontendBase}/reset-password?token=${resetToken}`;

    await sendPasswordResetEmail(admin.email, resetUrl);

    res.json({
      message:
        'Reset link sent to the admin email.',
    });
  } catch (err) {
    console.error('Request password reset error:', err);
    res.status(500).json({ message: 'Error generating password reset link' });
  }
});

/**
 * POST /auth/reset-password-token
 * Step 2: Admin opens link from email, frontend sends token + newPassword.
 * Body: { token, newPassword }
 * No Authorization header needed.
 */
router.post('/reset-password-token', async (req, res) => {
  try {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
      return res
        .status(400)
        .json({ message: 'Token and newPassword are required' });
    }

    let payload;
    try {
      payload = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      return res.status(400).json({ message: 'Invalid or expired token' });
    }

    if (payload.type !== 'password_reset') {
      return res.status(400).json({ message: 'Invalid token type' });
    }

    const adminId = payload.id;

    const [rows] = await pool.execute(
      'SELECT * FROM admins WHERE id = ?',
      [adminId]
    );
    if (rows.length === 0) {
      return res.status(404).json({ message: 'Admin not found' });
    }

    const salt = await bcrypt.genSalt(10);
    const newHash = await bcrypt.hash(newPassword, salt);

    await pool.execute(
      'UPDATE admins SET password_hash = ? WHERE id = ?',
      [newHash, adminId]
    );

    res.json({ message: 'Password has been reset successfully' });
  } catch (err) {
    console.error('Reset password via token error:', err);
    res.status(500).json({ message: 'Error resetting password' });
  }
});

module.exports = router;
