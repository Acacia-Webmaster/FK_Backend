// clientsRoutes.js
const express = require('express');
const router = express.Router();
const pool = require('./db');
const auth = require('./authMiddleware'); // ⬅️ add this
router.use(auth);

// Getting and Managing Clients*******************************

// GET /clients  → list active (non-archived, non-deleted) clients
router.get('/', async (req, res) => {
  console.log('➡️ HIT GET /clients');

  try {
    const [rows] = await pool.query(
      `SELECT 
         id,
         full_name,
         phone,
         age,
email,
         payment_due_date,
         activity_level,
         preferred_training_time
       FROM clients
       WHERE is_deleted = 0
         AND is_archived = 0
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

// GET /clients/archived → list archived clients (not deleted)
router.get('/archived', async (req, res) => {
  console.log('➡️ HIT GET /clients/archived');

  try {
    const [rows] = await pool.query(
      `SELECT 
         id,
         full_name,
         phone,
         age,
email,
         payment_due_date,
         activity_level,
         preferred_training_time
       FROM clients
       WHERE is_deleted = 0
         AND is_archived = 1
       ORDER BY created_at DESC`
    );

    res.json({
      success: true,
      count: rows.length,
      clients: rows
    });
  } catch (err) {
    console.error('GET /clients/archived error:', err);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching archived clients.'
    });
  }
});



// GET /clients/:id → full client profile (active or archived, but not deleted)
router.get('/:id', async (req, res) => {
  console.log('➡️ HIT GET /clients/:id', req.params.id);

  const { id } = req.params;

  try {
    const [rows] = await pool.query(
      'SELECT * FROM clients WHERE id = ? AND is_deleted = 0',
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Client not found'
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
      message: 'Server error while fetching client'
    });
  }
});

// Archiving and Unarchiving Clients****************************************
// PATCH /clients/:id/archive → set is_archived = 1
router.patch('/:id/archive', async (req, res) => {
  console.log('➡️ HIT PATCH /clients/:id/archive', req.params.id);

  const { id } = req.params;

  try {
    const [result] = await pool.query(
      `UPDATE clients
       SET is_archived = 1, updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND is_deleted = 0`,
      [id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: 'Client not found or already deleted.'
      });
    }

    res.json({
      success: true,
      message: 'Client archived successfully.'
    });
  } catch (err) {
    console.error('PATCH /clients/:id/archive error:', err);
    res.status(500).json({
      success: false,
      message: 'Server error while archiving client.'
    });
  }
});


// PATCH /clients/:id/unarchive → set is_archived = 0
router.patch('/:id/unarchive', async (req, res) => {
  console.log('➡️ HIT PATCH /clients/:id/unarchive', req.params.id);

  const { id } = req.params;

  try {
    const [result] = await pool.query(
      `UPDATE clients
       SET is_archived = 0, updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND is_deleted = 0`,
      [id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: 'Client not found or already deleted.'
      });
    }

    res.json({
      success: true,
      message: 'Client unarchived successfully.'
    });
  } catch (err) {
    console.error('PATCH /clients/:id/unarchive error:', err);
    res.status(500).json({
      success: false,
      message: 'Server error while unarchiving client.'
    });
  }
});


// PATCH /clients/:id/delete → soft delete (is_deleted = 1)
router.patch('/:id/delete', async (req, res) => {
  console.log('➡️ HIT PATCH /clients/:id/delete', req.params.id);

  const { id } = req.params;

  try {
    const [result] = await pool.query(
      `UPDATE clients
       SET is_deleted = 1, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: 'Client not found.'
      });
    }

    res.json({
      success: true,
      message: 'Client deleted (soft) successfully.'
    });
  } catch (err) {
    console.error('PATCH /clients/:id/delete error:', err);
    res.status(500).json({
      success: false,
      message: 'Server error while deleting client.'
    });
  }
});


// Updating Clients And Adding ****************************************
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
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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

// PUT /clients/:id → update client (partial update)
router.put('/:id', async (req, res) => {
  console.log('➡️ HIT PUT /clients/:id', req.params.id);
  console.log('Body:', req.body);

  const { id } = req.params;

  // All fields that are allowed to be updated
  const allowedFields = [
    'payment_due_date',
    'full_name',
    'gender',
    'phone',
    'location',
    'date_of_birth',
    'age',
    'email',
    'occupation',
    'emergency_contact_name',
    'emergency_relationship',
    'emergency_contact_phone',
    'medical_conditions',
    'medications',
    'injury_history',
    'doctor_advice',
    'activity_level',
    'current_routine',
    'training_goals',
    'preferred_training_time',
    'how_heard',
    'assessment_date',
    'program_type',
    'initial_measurements',
    'assigned_coach',
    'coach_notes'
  ];

  try {
    // 1) Build dynamic SET clause based on sent fields
    const updates = [];
    const params = [];

    for (const field of allowedFields) {
      if (Object.prototype.hasOwnProperty.call(req.body, field)) {
        updates.push(`${field} = ?`);
        params.push(req.body[field] === '' ? null : req.body[field]);
      }
    }

    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No valid fields provided to update.'
      });
    }

    // Optional: validate enums if they are present
    if (req.body.gender !== undefined) {
      const allowedGenders = ['Male', 'Female', 'Other', null];
      if (!allowedGenders.includes(req.body.gender)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid gender. Allowed: Male, Female, Other.'
        });
      }
    }

    if (req.body.activity_level !== undefined) {
      const allowedActivity = ['Sedentary', 'Moderate', 'Active', 'Athlete'];
      if (!allowedActivity.includes(req.body.activity_level)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid activity_level. Allowed: Sedentary, Moderate, Active, Athlete.'
        });
      }
    }

    // 2) Add updated_at and WHERE
    const sql = `
      UPDATE clients
      SET ${updates.join(', ')},
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `;
    params.push(id);

    console.log('UPDATE SQL:', sql);
    console.log('UPDATE params:', params);

    const [result] = await pool.query(sql, params);

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: 'Client not found.'
      });
    }

    // 3) Return updated record (optional but nice)
    const [rows] = await pool.query('SELECT * FROM clients WHERE id = ?', [id]);

    return res.json({
      success: true,
      message: 'Client updated successfully.',
      client: rows[0]
    });
  } catch (err) {
    console.error('PUT /clients/:id error:', err);
    return res.status(500).json({
      success: false,
      message: 'Server error while updating client.'
    });
  }
});

// PATCH /clients/:id/due-date → update only payment_due_date
router.patch('/:id/due-date', async (req, res) => {
  console.log('➡️ HIT PATCH /clients/:id/due-date', req.params.id);
  console.log('Body:', req.body);

  const { id } = req.params;
  const { payment_due_date } = req.body;

  if (!payment_due_date) {
    return res.status(400).json({
      success: false,
      message: 'payment_due_date is required.'
    });
  }

  try {
    const sql = `
      UPDATE clients
      SET payment_due_date = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `;

    const [result] = await pool.query(sql, [payment_due_date, id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: 'Client not found.'
      });
    }

    // Return updated client
    const [rows] = await pool.query('SELECT * FROM clients WHERE id = ?', [id]);

    return res.json({
      success: true,
      message: 'Payment due date updated successfully.',
      client: rows[0]
    });

  } catch (err) {
    console.error('PATCH /clients/:id/due-date error:', err);
    return res.status(500).json({
      success: false,
      message: 'Server error while updating payment due date.'
    });
  }
});



module.exports = router;
