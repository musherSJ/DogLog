import { Router } from 'express';
import db from '../db.js';
import { authMiddleware } from '../auth.js';

const router = Router();
router.use(authMiddleware);

router.get('/', (req, res) => {
  const dogs = db.prepare('SELECT * FROM dogs WHERE user_id = ? ORDER BY name').all(req.userId);
  res.json(dogs);
});

router.get('/:id', (req, res) => {
  const dog = db.prepare('SELECT * FROM dogs WHERE id = ? AND user_id = ?').get(req.params.id, req.userId);
  if (!dog) return res.status(404).json({ error: 'Dog not found' });
  res.json(dog);
});

router.post('/', (req, res) => {
  const { name, breed, birthDate, weightKg, notes } = req.body;
  if (!name) return res.status(400).json({ error: 'Name is required' });

  const result = db.prepare(
    'INSERT INTO dogs (user_id, name, breed, birth_date, weight_kg, notes) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(req.userId, name, breed || null, birthDate || null, weightKg || null, notes || null);

  const dog = db.prepare('SELECT * FROM dogs WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(dog);
});

router.put('/:id', (req, res) => {
  const dog = db.prepare('SELECT * FROM dogs WHERE id = ? AND user_id = ?').get(req.params.id, req.userId);
  if (!dog) return res.status(404).json({ error: 'Dog not found' });

  const { name, breed, birthDate, weightKg, notes } = req.body;
  if (!name) return res.status(400).json({ error: 'Name is required' });

  db.prepare(
    'UPDATE dogs SET name = ?, breed = ?, birth_date = ?, weight_kg = ?, notes = ? WHERE id = ?'
  ).run(name, breed || null, birthDate || null, weightKg || null, notes || null, dog.id);

  const updated = db.prepare('SELECT * FROM dogs WHERE id = ?').get(dog.id);
  res.json(updated);
});

router.delete('/:id', (req, res) => {
  const dog = db.prepare('SELECT * FROM dogs WHERE id = ? AND user_id = ?').get(req.params.id, req.userId);
  if (!dog) return res.status(404).json({ error: 'Dog not found' });

  db.prepare('DELETE FROM dogs WHERE id = ?').run(dog.id);
  res.json({ success: true });
});

router.get('/:id/stats', (req, res) => {
  const dog = db.prepare('SELECT * FROM dogs WHERE id = ? AND user_id = ?').get(req.params.id, req.userId);
  if (!dog) return res.status(404).json({ error: 'Dog not found' });

  const stats = db.prepare(`
    SELECT
      COUNT(a.id) as total_activities,
      COALESCE(SUM(a.distance_km), 0) as total_distance_km,
      COALESCE(SUM(a.duration_seconds), 0) as total_duration_seconds,
      COALESCE(AVG(a.distance_km), 0) as avg_distance_km,
      COALESCE(AVG(a.duration_seconds), 0) as avg_duration_seconds
    FROM activities a
    JOIN activity_dogs ad ON a.id = ad.activity_id
    WHERE ad.dog_id = ? AND a.user_id = ?
  `).get(dog.id, req.userId);

  const activities = db.prepare(`
    SELECT a.* FROM activities a
    JOIN activity_dogs ad ON a.id = ad.activity_id
    WHERE ad.dog_id = ? AND a.user_id = ?
    ORDER BY a.date DESC
  `).all(dog.id, req.userId);

  // Attach dog lists to each activity
  for (const activity of activities) {
    activity.dogs = db.prepare(`
      SELECT d.id, d.name FROM dogs d
      JOIN activity_dogs ad ON d.id = ad.dog_id
      WHERE ad.activity_id = ?
    `).all(activity.id);
  }

  res.json({ dog, stats, activities });
});

export default router;
