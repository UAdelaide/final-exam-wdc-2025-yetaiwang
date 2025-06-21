const express = require('express');
const router = express.Router();
const db = require('../models/db');

/**
 * GET /api/dogs
 * Fetches all dogs with their owner information
*/
router.get('/', async (req, res) => {
  try {
    const [results] = await db.query(`
      SELECT 
        d.dog_id,
        d.name AS dog_name,
        d.size,
        d.owner_id,
        u.username AS owner_username,
        u.email AS owner_email
      FROM Dogs d
      JOIN Users u ON d.owner_id = u.user_id
    `);

    // Send the JSON response
    res.json(results);
  } catch (err) {
    // Catch error
    console.error('Error fetching dogs:', err);
    res.status(500).json({ error: 'Failed to fetch dogs' });
  }
});


module.exports = router;