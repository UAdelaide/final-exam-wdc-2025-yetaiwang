const express = require('express');
const router = express.Router();
const db = require('../models/db');

// GET all walk requests (for walkers to view)
router.get('/', async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT wr.*, d.name AS dog_name, d.size, u.username AS owner_name
      FROM WalkRequests wr
      JOIN Dogs d ON wr.dog_id = d.dog_id
      JOIN Users u ON d.owner_id = u.user_id
      WHERE wr.status = 'open'
    `);
    res.json(rows);
  } catch (error) {
    console.error('SQL Error:', error);
    res.status(500).json({ error: 'Failed to fetch walk requests' });
  }
});

/**
 * GET /api/walks/owner
 * Fetches open walk requests for the currently logged‑in owner.
 * Requires the user to have logged in and have `req.session.user.role === 'owner'`.
 */
router.get('/owner', async (req, res) => {
  // Ensure the user is logged in
  if (!req.session.user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  // Ensure the logged‑in user is an owner
  if (req.session.user.role !== 'owner') {
    return res.status(403).json({ error: 'Forbidden: owners only' });
  }

  const ownerId = req.session.user.user_id;

  try {
    const [rows] = await db.query(`
      SELECT
        wr.request_id,
        wr.dog_id,
        d.name        AS dog_name,
        d.size        AS size,
        wr.requested_time,
        wr.duration_minutes,
        wr.location,
        wr.status,
        wr.created_at
      FROM WalkRequests wr
      JOIN Dogs d ON wr.dog_id = d.dog_id
      WHERE d.owner_id = ?
      ORDER BY wr.requested_time DESC
    `, [ownerId]);

    // Return only this owner's open walk requests
    res.json(rows);

  } catch (error) {
    console.error('SQL Error fetching owner walk requests:', error);
    res.status(500).json({ error: 'Failed to fetch walk requests for owner' });
  }
});


// POST a new walk request (from owner)
router.post('/', async (req, res) => {
  const { dog_id, requested_time, duration_minutes, location } = req.body;

  try {
    const [result] = await db.query(`
      INSERT INTO WalkRequests (dog_id, requested_time, duration_minutes, location)
      VALUES (?, ?, ?, ?)
    `, [dog_id, requested_time, duration_minutes, location]);

    res.status(201).json({ message: 'Walk request created', request_id: result.insertId });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create walk request' });
  }
});

// POST an application to walk a dog (from walker)
router.post('/:id/apply', async (req, res) => {
  const requestId = req.params.id;
  const { walker_id } = req.body;

  try {
    await db.query(`
      INSERT INTO WalkApplications (request_id, walker_id)
      VALUES (?, ?)
    `, [requestId, walker_id]);

    await db.query(`
      UPDATE WalkRequests
      SET status = 'accepted'
      WHERE request_id = ?
    `, [requestId]);

    res.status(201).json({ message: 'Application submitted' });
  } catch (error) {
    console.error('SQL Error:', error);
    res.status(500).json({ error: 'Failed to apply for walk' });
  }
});

module.exports = router;