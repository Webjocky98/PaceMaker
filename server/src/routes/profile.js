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
        start_date,
        prior_marathon_seconds,
        training_days,
        strength_days,
        dietary_pref,
        training_time_of_day,
        load_multiplier,
        last_adapted_week_key,
        strength_focus,
        created_at,
        updated_at
       FROM profiles
       WHERE user_id = $1
       LIMIT 1`,
      [DEV_USER_ID]
    );

    if (!result.rows.length) {
      return res.status(404).json({ ok: false, error: 'Profile not found' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('GET /api/profile failed:', err);
    res.status(500).json({ ok: false, error: 'Failed to fetch profile' });
  }
});

router.put('/', async (req, res) => {
  try {
    const {
      startDate,
      priorMarathonSeconds,
      trainingDays,
      strengthDays,
      dietaryPref,
      trainingTimeOfDay,
      loadMultiplier,
      lastAdaptedWeekKey,
      strengthFocus
    } = req.body;

    const existing = await pool.query(
      `SELECT id FROM profiles WHERE user_id = $1 LIMIT 1`,
      [DEV_USER_ID]
    );

    let result;

    if (existing.rows.length) {
      result = await pool.query(
        `UPDATE profiles
         SET
           start_date = $1,
           prior_marathon_seconds = $2,
           training_days = $3,
           strength_days = $4,
           dietary_pref = $5,
           training_time_of_day = $6,
           load_multiplier = $7,
           last_adapted_week_key = $8,
           strength_focus = $9,
           updated_at = NOW()
         WHERE user_id = $10
         RETURNING
           id,
           user_id,
           start_date,
           prior_marathon_seconds,
           training_days,
           strength_days,
           dietary_pref,
           training_time_of_day,
           load_multiplier,
           last_adapted_week_key,
           strength_focus,
           created_at,
           updated_at`,
        [
          startDate || null,
          priorMarathonSeconds || null,
          JSON.stringify(trainingDays || []),
          JSON.stringify(strengthDays || []),
          dietaryPref || 'none',
          trainingTimeOfDay || 'morning',
          loadMultiplier ?? 1.0,
          lastAdaptedWeekKey || null,
          strengthFocus || 'balanced',
          DEV_USER_ID
        ]
      );
    } else {
      result = await pool.query(
        `INSERT INTO profiles (
          user_id,
          start_date,
          prior_marathon_seconds,
          training_days,
          strength_days,
          dietary_pref,
          training_time_of_day,
          load_multiplier,
          last_adapted_week_key,
          strength_focus
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
        RETURNING
          id,
          user_id,
          start_date,
          prior_marathon_seconds,
          training_days,
          strength_days,
          dietary_pref,
          training_time_of_day,
          load_multiplier,
          last_adapted_week_key,
          strength_focus,
          created_at,
          updated_at`,
        [
          DEV_USER_ID,
          startDate || null,
          priorMarathonSeconds || null,
          JSON.stringify(trainingDays || []),
          JSON.stringify(strengthDays || []),
          dietaryPref || 'none',
          trainingTimeOfDay || 'morning',
          loadMultiplier ?? 1.0,
          lastAdaptedWeekKey || null,
          strengthFocus || 'balanced'
        ]
      );
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('PUT /api/profile failed:', err);
    res.status(500).json({ ok: false, error: 'Failed to save profile' });
  }
});

module.exports = router;
