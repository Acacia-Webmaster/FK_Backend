// clientsRoutes.js
const express = require('express');
const router = express.Router();
const pool = require('./db');

// GET /clients  → list basic clients
router.get('/', async (req, res) => {
  console.log('➡️ HIT GET /clients');

  try {
    const [rows] = await pool.query(
      `SELECT 
         id,
         full_name,
         phone,
         payment_due_date,
         activity_level,
         preferred_training_time
       FROM clients
       ORDER BY created_at DESC`
    );

    res.json({
      success: true,
      count: rows.length,
      clients: rows
    });
  } catch (err) {
    console.error('GET /clients error:', err);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching clients.'
    });
  }
});

// GET /clients/:id → full client profile
router.get('/:id', async (req, res) => {
  console.log('➡️ HIT GET /clients/:id', req.params.id);

  const { id } = req.params;

  try {
    const [rows] = await pool.query('SELECT * FROM clients WHERE id = ?', [id]);

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Client not found.'
      });
    }

    res.json({
      success: true,
      client: rows[0]
    });
  } catch (err) {
    console.error('GET /clients/:id error:', err);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching client.'
    });
  }
});

module.exports = router;
