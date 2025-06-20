const express = require('express');
const router = express.Router();

/**
 * GET /api/walkrequests/open
 * Fetches all open walk requests with associated dog and owner information
*/
router.get('/open', async (req, res) => {
  try {
    const [results] = await req.db.execute(`
      SELECT 
        wr.request_id,
        d.name AS dog_name,
        wr.requested_time,
        wr.duration_minutes,
        wr.location,
        u.username AS owner_username
      FROM WalkRequests wr
      JOIN Dogs d ON wr.dog_id = d.dog_id
      JOIN Users u ON d.owner_id = u.user_id
      WHERE wr.status = 'open'
    `);

    // Send the JSON response
    res.json(results);
  } catch (err) {
    // Catch error
    console.error('Error fetching open walk requests:', err);
    res.status(500).json({ error: 'Failed to fetch open walk requests' });
  }
});

module.exports = router;