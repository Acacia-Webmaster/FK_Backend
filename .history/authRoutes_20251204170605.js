// authRoutes.js
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('./db');
const auth = require('./authMiddleware'); // protects change-password

const router = express.Router();

// Helper: create JWT
function createToken(admin) {
  return jwt.sign(
    { id: admin.id, email: admin.email },
    process.env.JWT_SECRET,
    { expiresIn: process.env.TOKEN_EXPIRES_IN || '7d' }
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

    // Allow only one admin
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
 * Change password for the currently logged-in admin.
 * Requires Authorization: Bearer <token> header.
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

module.exports = router;
