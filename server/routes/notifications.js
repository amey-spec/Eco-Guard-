import express from 'express';
import { getDatabase } from '../config/database.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

router.get('/', authenticateToken, async (req, res) => {
  try {
    const db = await getDatabase();
    const notifications = await db.all(
      // id DESC breaks ties: several milestones can share the same created_at second.
      'SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC, id DESC',
      [req.user.id]
    );
    res.json(notifications);
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});

router.put('/:id/read', authenticateToken, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ error: 'Invalid notification id' });
    }

    const db = await getDatabase();
    const result = await db.run(
      'UPDATE notifications SET read_status = 1 WHERE id = ? AND user_id = ?',
      [id, req.user.id]
    );

    if (!result.changes) {
      return res.status(404).json({ error: 'Notification not found' });
    }
    res.json({ success: true });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Failed to update notification' });
  }
});

router.put('/read-all', authenticateToken, async (req, res) => {
  try {
    const db = await getDatabase();
    await db.run('UPDATE notifications SET read_status = 1 WHERE user_id = ?', [req.user.id]);
    res.json({ success: true });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Failed' });
  }
});

export default router;
