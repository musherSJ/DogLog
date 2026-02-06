import { Router } from 'express';
import db from '../db.js';
import { authMiddleware } from '../auth.js';

const router = Router();
router.use(authMiddleware);

router.get('/', (req, res) => {
  const activities = db.prepare(
    'SELECT * FROM activities WHERE user_id = ? ORDER BY date DESC'
  ).all(req.userId);

  for (const activity of activities) {
    activity.dogs = db.prepare(`
      SELECT d.id, d.name FROM dogs d
      JOIN activity_dogs ad ON d.id = ad.dog_id
      WHERE ad.activity_id = ?
    `).all(activity.id);
  }

  res.json(activities);
});

router.get('/stats', (req, res) => {
  const stats = db.prepare(`
    SELECT
      COUNT(*) as total_activities,
      COALESCE(SUM(distance_km), 0) as total_distance_km,
      COALESCE(SUM(duration_seconds), 0) as total_duration_seconds,
      COALESCE(AVG(distance_km), 0) as avg_distance_km,
      COALESCE(AVG(duration_seconds), 0) as avg_duration_seconds
    FROM activities WHERE user_id = ?
  `).get(req.userId);

  const byType = db.prepare(`
    SELECT type,
      COUNT(*) as count,
      COALESCE(SUM(distance_km), 0) as total_distance_km,
      COALESCE(SUM(duration_seconds), 0) as total_duration_seconds
    FROM activities WHERE user_id = ?
    GROUP BY type
  `).all(req.userId);

  const recentWeek = db.prepare(`
    SELECT
      COUNT(*) as activities,
      COALESCE(SUM(distance_km), 0) as distance_km,
      COALESCE(SUM(duration_seconds), 0) as duration_seconds
    FROM activities
    WHERE user_id = ? AND date >= date('now', '-7 days')
  `).get(req.userId);

  res.json({ overall: stats, byType, recentWeek });
});

router.get('/:id', (req, res) => {
  const activity = db.prepare(
    'SELECT * FROM activities WHERE id = ? AND user_id = ?'
  ).get(req.params.id, req.userId);

  if (!activity) return res.status(404).json({ error: 'Activity not found' });

  activity.dogs = db.prepare(`
    SELECT d.id, d.name FROM dogs d
    JOIN activity_dogs ad ON d.id = ad.dog_id
    WHERE ad.activity_id = ?
  `).all(activity.id);

  res.json(activity);
});

router.post('/', (req, res) => {
  const { title, type, distanceKm, durationSeconds, date, notes, dogIds, gpsTrack } = req.body;

  if (!title) return res.status(400).json({ error: 'Title is required' });
  if (!date) return res.status(400).json({ error: 'Date is required' });

  const insertActivity = db.prepare(`
    INSERT INTO activities (user_id, title, type, distance_km, duration_seconds, date, notes, gps_track)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertDog = db.prepare('INSERT INTO activity_dogs (activity_id, dog_id) VALUES (?, ?)');

  const txn = db.transaction(() => {
    const result = insertActivity.run(
      req.userId, title, type || 'run',
      distanceKm || 0, durationSeconds || 0,
      date, notes || null, gpsTrack ? JSON.stringify(gpsTrack) : null
    );

    const activityId = result.lastInsertRowid;

    if (dogIds && dogIds.length > 0) {
      // Verify dogs belong to user
      for (const dogId of dogIds) {
        const dog = db.prepare('SELECT id FROM dogs WHERE id = ? AND user_id = ?').get(dogId, req.userId);
        if (dog) {
          insertDog.run(activityId, dogId);
        }
      }
    }

    return activityId;
  });

  const activityId = txn();

  const activity = db.prepare('SELECT * FROM activities WHERE id = ?').get(activityId);
  activity.dogs = db.prepare(`
    SELECT d.id, d.name FROM dogs d
    JOIN activity_dogs ad ON d.id = ad.dog_id
    WHERE ad.activity_id = ?
  `).all(activityId);

  res.status(201).json(activity);
});

router.put('/:id', (req, res) => {
  const activity = db.prepare(
    'SELECT * FROM activities WHERE id = ? AND user_id = ?'
  ).get(req.params.id, req.userId);

  if (!activity) return res.status(404).json({ error: 'Activity not found' });

  const { title, type, distanceKm, durationSeconds, date, notes, dogIds, gpsTrack } = req.body;
  if (!title) return res.status(400).json({ error: 'Title is required' });
  if (!date) return res.status(400).json({ error: 'Date is required' });

  const insertDog = db.prepare('INSERT INTO activity_dogs (activity_id, dog_id) VALUES (?, ?)');

  const txn = db.transaction(() => {
    db.prepare(`
      UPDATE activities SET title = ?, type = ?, distance_km = ?, duration_seconds = ?,
        date = ?, notes = ?, gps_track = ? WHERE id = ?
    `).run(
      title, type || 'run', distanceKm || 0, durationSeconds || 0,
      date, notes || null,
      gpsTrack ? JSON.stringify(gpsTrack) : (activity.gps_track || null),
      activity.id
    );

    // Replace dog assignments
    db.prepare('DELETE FROM activity_dogs WHERE activity_id = ?').run(activity.id);
    if (dogIds && dogIds.length > 0) {
      for (const dogId of dogIds) {
        const dog = db.prepare('SELECT id FROM dogs WHERE id = ? AND user_id = ?').get(dogId, req.userId);
        if (dog) {
          insertDog.run(activity.id, dogId);
        }
      }
    }
  });

  txn();

  const updated = db.prepare('SELECT * FROM activities WHERE id = ?').get(activity.id);
  updated.dogs = db.prepare(`
    SELECT d.id, d.name FROM dogs d
    JOIN activity_dogs ad ON d.id = ad.dog_id
    WHERE ad.activity_id = ?
  `).all(activity.id);

  res.json(updated);
});

router.delete('/:id', (req, res) => {
  const activity = db.prepare(
    'SELECT * FROM activities WHERE id = ? AND user_id = ?'
  ).get(req.params.id, req.userId);

  if (!activity) return res.status(404).json({ error: 'Activity not found' });

  db.prepare('DELETE FROM activities WHERE id = ?').run(activity.id);
  res.json({ success: true });
});

export default router;
