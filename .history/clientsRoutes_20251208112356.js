const express = require('express');
const router = express.Router();
const pool = require('./db');           // make sure this is correct
const auth = require('./authMiddleware'); // JWT middleware

// Add new client
router.post('/clients', auth, async (req, res) => {
  console.log('POST /clients body:', req.body);

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

    // Basic validation for required fields
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

    console.log('Executing INSERT with params:', params);

    const [result] = await pool.execute(sql, params);

    console.log('INSERT result:', result);

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
