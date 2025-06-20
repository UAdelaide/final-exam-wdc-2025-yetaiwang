const express = require('express');
const router = express.Router();

/**
 * GET /api/walkers/summary
 * Fetches summary statistics for all walkers
 */
router.get('/summary', async (req, res) => {
  try {
    const [results] = await req.db.execute(`
      SELECT 
        u.username AS walker_username,
        COUNT(DISTINCT wr.rating_id) AS total_ratings,
        ROUND(AVG(wr.rating), 1) AS average_rating,
        COUNT(DISTINCT CASE 
          WHEN wa.status = 'accepted' AND wreq.status = 'completed'
          THEN wa.request_id
          ELSE NULL
        END) AS completed_walks
      FROM Users u
      LEFT JOIN WalkApplications wa 
        ON u.user_id = wa.walker_id
      LEFT JOIN WalkRequests wreq 
        ON wa.request_id = wreq.request_id
      LEFT JOIN WalkRatings wr 
        ON wr.request_id = wa.request_id AND wr.walker_id = u.user_id
      WHERE u.role = 'walker'
      GROUP BY u.user_id;
    `);

    // Ensure average_rating is a decimal number
    const mapped = results.map(r => ({
      walker_username: r.walker_username,
      total_ratings: r.total_ratings,
      average_rating: r.average_rating !== null
        ? parseFloat(r.average_rating)
        : null,
      completed_walks: r.completed_walks
    }));

    res.json(mapped);
  } catch (err) {
    console.error('Error fetching walker summaries:', err);
    res.status(500).json({ error: 'Failed to fetch walker summaries' });
  }
});

module.exports = router;
