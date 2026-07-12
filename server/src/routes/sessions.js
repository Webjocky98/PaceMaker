const express = require('express');
const router = express.Router();
const pool = require('../db/db');

// Temporary fixed user for development
const DEV_USER_ID = 1;

router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT
        id,
        user_id,
        date,
        role,
        completed,
        distance_km,
        duration_sec,
        rpe,
        notes,
        strength_focus_text,
        exercises_json,
        mobility,
        created_at
       FROM sessions
       WHERE user_id = $1
       ORDER BY date DESC, id DESC`,
      [DEV_USER_ID]
    );

    res.json(result.rows);
  } catch (err) {
    console.error('GET /api/sessions failed:', err);
    res.status(500).json({ ok: false, error: 'Failed to fetch sessions' });
  }
});

router.post('/', async (req, res) => {
  try {
    const {
      date,
      role,
      completed,
      distanceKm,
      durationSec,
      rpe,
      notes,
      strengthFocusText,
      exercises,
      mobility
    } = req.body;

    if (!date || !role) {
      return res.status(400).json({
        ok: false,
        error: 'date and role are required'
      });
    }

    const result = await pool.query(
      `INSERT INTO sessions (
        user_id,
        date,
        role,
        completed,
        distance_km,
        duration_sec,
        rpe,
        notes,
        strength_focus_text,
        exercises_json,
        mobility
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
      RETURNING
        id,
        user_id,
        date,
        role,
        completed,
        distance_km,
        duration_sec,
        rpe,
        notes,
        strength_focus_text,
        exercises_json,
        mobility,
        created_at`,
      [
        DEV_USER_ID,
        date,
        role,
        completed === true,
        distanceKm ?? null,
        durationSec ?? null,
        rpe ?? null,
        notes || null,
        strengthFocusText || null,
        exercises ? JSON.stringify(exercises) : null,
        mobility || null
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('POST /api/sessions failed:', err);
    res.status(500).json({ ok: false, error: 'Failed to create session' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const sessionId = Number(req.params.id);

    if (!Number.isFinite(sessionId)) {
      return res.status(400).json({ ok: false, error: 'Invalid session id' });
    }

    const result = await pool.query(
      `DELETE FROM sessions
       WHERE id = $1 AND user_id = $2
       RETURNING id`,
      [sessionId, DEV_USER_ID]
    );

    if (!result.rows.length) {
      return res.status(404).json({ ok: false, error: 'Session not found' });
    }

    res.json({
      ok: true,
      deletedId: result.rows[0].id
    });
  } catch (err) {
    console.error('DELETE /api/sessions/:id failed:', err);
    res.status(500).json({ ok: false, error: 'Failed to delete session' });
  }
});

module.exports = router;
