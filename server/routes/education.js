import express from 'express';
import { getDatabase } from '../config/database.js';
import { LIMITS, isPlainQueryValue, isPositiveIntId } from '../config/security.js';

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const { category, search } = req.query;

    // Query params must be plain, bounded strings — never arrays or objects.
    if (category !== undefined && !isPlainQueryValue(category, LIMITS.hazardType)) {
      return res.status(400).json({ error: 'Invalid category filter' });
    }
    if (search !== undefined && !isPlainQueryValue(search, LIMITS.search)) {
      return res.status(400).json({ error: 'Invalid search term' });
    }

    const db = await getDatabase();

    let query = 'SELECT * FROM educational_resources WHERE 1=1';
    const params = [];

    if (category) {
      query += ' AND category = ?';
      params.push(String(category));
    }

    if (search) {
      query += ' AND (title LIKE ? OR content LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }

    query += ' ORDER BY created_at DESC';
    const resources = await db.all(query, params);
    res.json(resources);
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Failed to fetch resources' });
  }
});

// Metadata route declared before /:id so "categories" is not captured as an id.
router.get('/meta/categories', async (req, res) => {
  try {
    const db = await getDatabase();
    const categories = await db.all('SELECT DISTINCT category FROM educational_resources ORDER BY category');
    res.json(categories.map(c => c.category));
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    if (!isPositiveIntId(req.params.id)) {
      return res.status(400).json({ error: 'Invalid resource id' });
    }

    const db = await getDatabase();
    const resource = await db.get('SELECT * FROM educational_resources WHERE id = ?', [Number(req.params.id)]);

    if (!resource) {
      return res.status(404).json({ error: 'Resource not found' });
    }

    res.json(resource);
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Failed to fetch resource' });
  }
});

export default router;
