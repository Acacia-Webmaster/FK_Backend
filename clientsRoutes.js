// clientsRoutes.js
const express = require('express');
const router = express.Router();
const pool = require('./db');
const auth = require('./authMiddleware'); // ⬅️ add this
router.use(auth);
const upload = require('./uploadClientPdfs');
const fs = require('fs');
const path = require('path');
const uploadToFTP = require('./ftpClient');
const crypto = require('crypto');
const { uploadToHostinger } = require("./ftpUpload");



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
gender,
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
gender,

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


router.post("/", upload.array("pdfs"), async (req, res) => {
  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    const [result] = await conn.query(
      `INSERT INTO clients (
        payment_due_date,
        full_name,
        phone,
        activity_level,
        training_goals,
        preferred_training_time,
        how_heard
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        req.body.payment_due_date,
        req.body.full_name,
        req.body.phone,
        req.body.activity_level,
        req.body.training_goals,
        req.body.preferred_training_time,
        req.body.how_heard,
      ]
    );

    const clientId = result.insertId;

    // FINAL CLIENT DIRECTORY
    const clientDir = path.join(
      process.env.UPLOAD_BASE_PATH,
      "clients",
      String(clientId)
    );

    fs.mkdirSync(clientDir, { recursive: true });

    let seq = 1;

    for (const file of req.files || []) {
      const finalPath = path.join(clientDir, file.originalname);

      // Move from tmp → final
      fs.renameSync(file.path, finalPath);

      await conn.query(
        `INSERT INTO client_pdfs (client_id, pdf_url, seq)
         VALUES (?, ?, ?)`,
        [
          clientId,
          `/fitnesskingdom/assets/clients/${clientId}/${file.originalname}`,
          seq++,
        ]
      );
    }

    await conn.commit();

    res.json({ success: true, clientId });
  } catch (err) {
    await conn.rollback();
    console.error("Create client error:", err);
    res.status(500).json({ success: false });
  } finally {
    conn.release();
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


// Creating the Clinets PDF Profile**************************************
router.post(
  "/clients/:id/pdfs",
  upload.array("pdfs"),
  async (req, res) => {
    const clientId = req.params.id;

    const [[{ nextSeq }]] = await pool.query(
      `SELECT COALESCE(MAX(seq), 0) + 1 AS nextSeq
       FROM client_pdfs
       WHERE client_id = ? AND is_deleted = 0`,
      [clientId]
    );

    const clientDir = path.join(
      process.env.UPLOAD_BASE_PATH,
      "clients",
      String(clientId)
    );

    fs.mkdirSync(clientDir, { recursive: true });

    let seq = nextSeq;
    const uploaded = [];

    for (const file of req.files) {
      const finalPath = path.join(clientDir, file.originalname);

      fs.renameSync(file.path, finalPath);

      const publicUrl =
        `/fitnesskingdom/assets/clients/${clientId}/${file.originalname}`;

      await pool.query(
        `INSERT INTO client_pdfs (client_id, pdf_url, seq)
         VALUES (?, ?, ?)`,
        [clientId, publicUrl, seq++]
      );

      uploaded.push(publicUrl);
    }

    res.json({ success: true, files: uploaded });
  }
);



// list PDFs ordered by seq

router.get('/clients/:id/pdfs', async (req, res) => {
  const { id } = req.params;

  const [rows] = await pool.query(
    `SELECT id, pdf_url, seq, created_at
     FROM client_pdfs
     WHERE client_id = ? AND is_deleted = 0
     ORDER BY seq ASC`,
    [id]
  );

  res.json({ success: true, pdfs: rows });
});


//  SOFT DELETE PDF

router.patch('/clients/pdfs/:pdfId/delete', async (req, res) => {
  const { pdfId } = req.params;

  const [result] = await pool.query(
    `UPDATE client_pdfs
     SET is_deleted = 1,
         deleted_at = CURRENT_TIMESTAMP
     WHERE id = ? AND is_deleted = 0`,
    [pdfId]
  );

  if (!result.affectedRows) {
    return res.status(404).json({ success: false });
  }

  res.json({
    success: true,
    message: 'PDF deleted.'
  });
});

module.exports = router;
