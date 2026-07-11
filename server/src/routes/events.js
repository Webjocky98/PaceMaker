const express = require('express');
const router = express.Router();
const pool = require('../db/db');

// Temporary fixed user for early development
const DEV_USER_ID = 1;

router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, user_id, name, date, type, distance_type, distance_km, goal_seconds, priority, notes, status, created_at, updated_at
       FROM events
       WHERE user_id = $1
       ORDER BY date ASC`,
      [DEV_USER_ID]
    );

    res.json(result.rows);
  } catch (err) {
    console.error('GET /api/events failed:', err);
    res.status(500).json({ ok: false, error: 'Failed to fetch events' });
  }
});

router.post('/', async (req, res) => {
  try {
    const {
      name,
      date,
      type,
      distanceType,
      distanceKm,
      goalSeconds,
      priority,
      notes,
      status
    } = req.body;

    const result = await pool.query(
      `INSERT INTO events (
        user_id,
        name,
        date,
        type,
        distance_type,
        distance_km,
        goal_seconds,
        priority,
        notes,
        status
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
      RETURNING id, user_id, name, date, type, distance_type, distance_km, goal_seconds, priority, notes, status, created_at, updated_at`,
      [
        DEV_USER_ID,
        name,
        date,
        type || 'race',
        distanceType,
        distanceKm,
        goalSeconds,
        priority || 'C',
        notes || '',
        status || 'planned'
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('POST /api/events failed:', err);
    res.status(500).json({ ok: false, error: 'Failed to create event' });
  }
});

module.exports = router;
