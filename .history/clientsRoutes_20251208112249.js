// clientsRoutes.js
const express = require('express');
const pool = require('./db');
const auth = require('./authMiddleware');

const router = express.Router();

/**
 * Helper: compute payment status from payment_due_date
 * - overdue: past due date
 * - urgent: 0–3 days left
 * - soon: 4–7 days left
 * - ok: > 7 days left
 */
function getPaymentStatus(paymentDueDate) {
  if (!paymentDueDate) return null;

  const today = new Date();
  const due = new Date(paymentDueDate);

  // Clear time part to avoid timezone noise
  today.setHours(0, 0, 0, 0);
  due.setHours(0, 0, 0, 0);

  const diffMs = due.getTime() - today.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays < 0) return 'overdue';
  if (diffDays <= 3) return 'urgent';
  if (diffDays <= 7) return 'soon';
  return 'ok';
}

/**
 * GET /clients
 * Optional query: ?search=...
 * - search by full_name or phone
 * - returns clients ordered by payment_due_date
 */
router.get('/', auth, async (req, res) => {
  try {
    const { search } = req.query;

    let sql = 'SELECT * FROM clients';
    const params = [];

    if (search && search.trim() !== '') {
      sql += ' WHERE full_name LIKE ? OR phone LIKE ?';
      const like = `%${search.trim()}%`;
      params.push(like, like);
    }

    sql += ' ORDER BY payment_due_date ASC, full_name ASC';

    const [rows] = await pool.execute(sql, params);

    const clients = rows.map((c) => ({
      ...c,
      paymentStatus: getPaymentStatus(c.payment_due_date),
    }));

    res.json(clients);
  } catch (err) {
    console.error('GET /clients error:', err);
    res.status(500).json({ message: 'Error fetching clients' });
  }
});

/**
 * POST /clients
 * Create a new client.
 * For now, we support the core fields used in the dashboard:
 * - full_name (required)
 * - phone (required)
 * - payment_due_date (required)
 * - notes (optional -> coach_notes)
 * You *can* send more fields if you want later.
 */
router.post('/', auth, async (req, res) => {
  try {
    const {
      full_name,
      phone,
      payment_due_date,
      // optional extras – you can start using them later
      gender = null,
      location = null,
      date_of_birth = null,
      age = null,
      email = null,
      occupation = null,
      emergency_contact_name = null,
      emergency_relationship = null,
      emergency_contact_phone = null,
      medical_conditions = null,
      medications = null,
      injury_history = null,
      doctor_advice = null,
      activity_level = 'Sedentary',
      current_routine = null,
      training_goals,
      preferred_training_time,
      how_heard,
      assessment_date = null,
      program_type = null,
      initial_measurements = null,
      assigned_coach = null,
      coach_notes = null,
    } = req.body;

    if (!full_name || !phone || !payment_due_date) {
      return res.status(400).json({
        message: 'full_name, phone and payment_due_date are required',
      });
    }

    // If you want strict minimal creation, you can also make training_goals etc optional.
    const [result] = await pool.execute(
      `
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
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    `,
      [
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
        training_goals || null,
        preferred_training_time || null,
        how_heard || null,
        assessment_date,
        program_type,
        initial_measurements,
        assigned_coach,
        coach_notes,
      ]
    );

    const newId = result.insertId;

    const [[newClient]] = await pool.execute(
      'SELECT * FROM clients WHERE id = ?',
      [newId]
    );

    res.status(201).json({
      ...newClient,
      paymentStatus: getPaymentStatus(newClient.payment_due_date),
    });
  } catch (err) {
    console.error('POST /clients error:', err);
    res.status(500).json({ message: 'Error creating client' });
  }
});

/**
 * PUT /clients/:id
 * Full update for a client.
 * You can send any of the fields – ones you omit will become null if not handled.
 * For dashboard, you’ll mainly use it to update:
 * - basic info
 * - payment_due_date
 */
router.put('/:id', auth, async (req, res) => {
  try {
    const { id } = req.params;

    // You could validate existence first
    const [[existing]] = await pool.execute(
      'SELECT * FROM clients WHERE id = ?',
      [id]
    );
    if (!existing) {
      return res.status(404).json({ message: 'Client not found' });
    }

    const {
      payment_due_date = existing.payment_due_date,
      full_name = existing.full_name,
      gender = existing.gender,
      phone = existing.phone,
      location = existing.location,
      date_of_birth = existing.date_of_birth,
      age = existing.age,
      email = existing.email,
      occupation = existing.occupation,
      emergency_contact_name = existing.emergency_contact_name,
      emergency_relationship = existing.emergency_relationship,
      emergency_contact_phone = existing.emergency_contact_phone,
      medical_conditions = existing.medical_conditions,
      medications = existing.medications,
      injury_history = existing.injury_history,
      doctor_advice = existing.doctor_advice,
      activity_level = existing.activity_level,
      current_routine = existing.current_routine,
      training_goals = existing.training_goals,
      preferred_training_time = existing.preferred_training_time,
      how_heard = existing.how_heard,
      assessment_date = existing.assessment_date,
      program_type = existing.program_type,
      initial_measurements = existing.initial_measurements,
      assigned_coach = existing.assigned_coach,
      coach_notes = existing.coach_notes,
    } = req.body;

    await pool.execute(
      `
      UPDATE clients
      SET
        payment_due_date = ?,
        full_name = ?,
        gender = ?,
        phone = ?,
        location = ?,
        date_of_birth = ?,
        age = ?,
        email = ?,
        occupation = ?,
        emergency_contact_name = ?,
        emergency_relationship = ?,
        emergency_contact_phone = ?,
        medical_conditions = ?,
        medications = ?,
        injury_history = ?,
        doctor_advice = ?,
        activity_level = ?,
        current_routine = ?,
        training_goals = ?,
        preferred_training_time = ?,
        how_heard = ?,
        assessment_date = ?,
        program_type = ?,
        initial_measurements = ?,
        assigned_coach = ?,
        coach_notes = ?
      WHERE id = ?
    `,
      [
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
        coach_notes,
        id,
      ]
    );

    const [[updated]] = await pool.execute(
      'SELECT * FROM clients WHERE id = ?',
      [id]
    );

    res.json({
      ...updated,
      paymentStatus: getPaymentStatus(updated.payment_due_date),
    });
  } catch (err) {
    console.error('PUT /clients/:id error:', err);
    res.status(500).json({ message: 'Error updating client' });
  }
});

/**
 * DELETE /clients/:id
 * Hard delete. If you want soft delete later, add a "is_deleted" column instead.
 */
router.delete('/:id', auth, async (req, res) => {
  try {
    const { id } = req.params;

    const [result] = await pool.execute(
      'DELETE FROM clients WHERE id = ?',
      [id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Client not found' });
    }

    res.json({ message: 'Client deleted successfully' });
  } catch (err) {
    console.error('DELETE /clients/:id error:', err);
    res.status(500).json({ message: 'Error deleting client' });
  }
});

module.exports = router;
