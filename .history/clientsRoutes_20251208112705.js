// clientsRoutes.js
const express = require('express');
const router = express.Router();
const pool = require('./db');           // your DB pool
const auth = require('./authMiddleware'); // JWT middleware

// POST /clients  -> Add client
router.post('/', auth, async (req, res) => {
  console.log('➡️ HIT POST /clients');

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

    // Minimal required validation
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
        message: 'Missing required fields.'
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
      age || null,
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

    const [result] = await pool.execute(sql, params);

    return res.status(201).json({
      success: true,
      message: 'Client added successfully.',
      clientId: result.insertId
    });
  } catch (err) {
    console.error('POST /clients internal error:', err);
    return res.status(500).json({
      success: false,
      message: 'Server error while adding client.'
    });
  }
});

module.exports = router;
