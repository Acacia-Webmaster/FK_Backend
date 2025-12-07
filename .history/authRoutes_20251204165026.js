// authRoutes.js
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('./db');

const router = express.Router();

function createToken(admin) {
  return jwt.sign(
    { id: admin.id, email: admin.email },
    process.env.JWT_SECRET,
    { expiresIn: process.env.TOKEN_EXPIRES_IN || '7d' }
  );
}

// POST /auth/register  --> run ONCE to create the ONLY admin
router.post('/register', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res
        .status(400)
        .json({ message: 'Email and password are required' });
    }

    // Allow only 1 admin in DB
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

module.exports = router;
