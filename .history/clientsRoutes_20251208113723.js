// clientsRoutes.js
const express = require('express');
const router = express.Router();
const pool = require('./db');

// GET /clients  → list clients
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


// POST /clients → add new client
router.post('/', async (req, res) => {
  console.log('➡️ HIT POST /clients');
  console.log('Body:', req.body);

  try {
    const {
      payment_due_date,
      full_name,
      gender,
      phone,
      location,
      date_of_birth,
      age,
      email,
      occupation,
      emergency_contact_name,
      emergency_relationship,
      emergency_contact_phone,
      medical_conditions,
      medications,
      injury_history,
      doctor_advice,
      activity_level,
      current_routine,
      training_goals,
      preferred_training_time,
      how_heard,
      assessment_date,
      program_type,
      initial_measurements,
      assigned_coach,
      coach_notes
    } = req.body;

    // 🔴 REQUIRED FIELDS (NOT NULL in DB)
    if (
      !payment_due_date ||
      !full_name ||
      !phone ||
      !activity_level ||
      !training_goals ||
      !preferred_training_time ||
      !how_heard
    ) {
      return res.status(400).json({
        success: false,
        message:
          'Missing required fields: payment_due_date, full_name, phone, activity_level, training_goals, preferred_training_time, how_heard'
      });
    }

    // OPTIONAL: simple enum validation for gender + activity_level
    const allowedGenders = ['Male', 'Female', 'Other', null, undefined, ''];
    if (!allowedGenders.includes(gender)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid gender. Allowed: Male, Female, Other'
      });
    }

    const allowedActivity = ['Sedentary', 'Moderate', 'Active', 'Athlete'];
    if (!allowedActivity.includes(activity_level)) {
      return res.status(400).json({
        success: false,
        message:
          'Invalid activity_level. Allowed: Sedentary, Moderate, Active, Athlete'
      });
    }

    const sql = `
      INSERT INTO clients (
        payment_due_date,
        full_name,
        gender,
        phone,
        location,
        date_of_birth,
        age,
        email,
        occupation,
        emergency_contact_name,
        emergency_relationship,
        emergency_contact_phone,
        medical_conditions,
        medications,
        injury_history,
        doctor_advice,
        activity_level,
        current_routine,
        training_goals,
        preferred_training_time,
        how_heard,
        assessment_date,
        program_type,
        initial_measurements,
        assigned_coach,
        coach_notes
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const params = [
      payment_due_date,
      full_name,
      gender || null,
      phone,
      location || null,
      date_of_birth || null,
      age ?? null,
      email || null,
      occupation || null,
      emergency_contact_name || null,
      emergency_relationship || null,
      emergency_contact_phone || null,
      medical_conditions || null,
      medications || null,
      injury_history || null,
      doctor_advice || null,
      activity_level,
      current_routine || null,
      training_goals,
      preferred_training_time,
      how_heard,
      assessment_date || null,
      program_type || null,
      initial_measurements || null,
      assigned_coach || null,
      coach_notes || null
    ];

    console.log('SQL params:', params);

    const [result] = await pool.query(sql, params);

    return res.status(201).json({
      success: true,
      message: 'Client added successfully.',
      clientId: result.insertId
    });
  } catch (err) {
    console.error('POST /clients error:', err);
    return res.status(500).json({
      success: false,
      message: 'Server error while adding client.'
    });
  }
});

module.exports = router;
