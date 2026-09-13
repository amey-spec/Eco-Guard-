import express from 'express';
import { getDatabase } from '../config/database.js';
import {
  ALLOWED_SEVERITIES,
  LIMITS,
  isPlainQueryValue,
  isPositiveIntId,
} from '../config/security.js';

const router = express.Router();

// Get all hazards with optional filtering
router.get('/', async (req, res) => {
  try {
    const { category, severity, search } = req.query;

    // Query params must be plain, bounded strings — never arrays or objects
    // (e.g. ?search=a&search=b), and never oversized.
    if (category !== undefined && !isPlainQueryValue(category, LIMITS.hazardType)) {
      return res.status(400).json({ error: 'Invalid category filter' });
    }
    if (severity !== undefined && !isPlainQueryValue(severity, LIMITS.search)) {
      return res.status(400).json({ error: 'Invalid severity filter' });
    }
    if (severity) {
      const value = String(severity).trim();
      if (!ALLOWED_SEVERITIES.includes(value)) {
        return res.status(400).json({ error: 'Unknown severity filter' });
      }
    }
    if (search !== undefined && !isPlainQueryValue(search, LIMITS.search)) {
      return res.status(400).json({ error: 'Invalid search term' });
    }

    const db = await getDatabase();

    let query = 'SELECT * FROM hazards WHERE 1=1';
    const params = [];

    if (category) {
      query += ' AND category = ?';
      params.push(String(category));
    }

    if (severity) {
      query += ' AND severity = ?';
      params.push(String(severity).trim());
    }

    if (search) {
      query += ' AND (name LIKE ? OR description LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }

    query += ' ORDER BY name ASC';

    const hazards = await db.all(query, params);

    // Parse JSON columns. A row whose JSON is corrupt would 500; that is a
    // data problem, not user input, so it is left to the central handler.
    const parsedHazards = hazards.map(h => ({
      ...h,
      causes: JSON.parse(h.causes),
      effects: JSON.parse(h.effects),
      prevention: JSON.parse(h.prevention)
    }));

    res.json(parsedHazards);
  } catch (error) {
    console.error('Error fetching hazards:', error);
    res.status(500).json({ error: 'Failed to fetch hazards' });
  }
});

// Metadata routes must be declared BEFORE the /:id route below, otherwise
// "categories" would be captured as an :id and shadow this endpoint.
router.get('/meta/categories', async (req, res) => {
  try {
    const db = await getDatabase();
    const categories = await db.all('SELECT DISTINCT category FROM hazards ORDER BY category');
    res.json(categories.map(c => c.category));
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
});

// Get single hazard by ID
router.get('/:id', async (req, res) => {
  try {
    // IDs are positive integers; anything else (negative, zero, non-numeric,
    // malformed or overflowing values) is rejected before touching the DB.
    if (!isPositiveIntId(req.params.id)) {
      return res.status(400).json({ error: 'Invalid hazard id' });
    }

    const db = await getDatabase();
    const hazard = await db.get('SELECT * FROM hazards WHERE id = ?', [Number(req.params.id)]);

    if (!hazard) {
      return res.status(404).json({ error: 'Hazard not found' });
    }

    // Parse JSON fields
    const parsedHazard = {
      ...hazard,
      causes: JSON.parse(hazard.causes),
      effects: JSON.parse(hazard.effects),
      prevention: JSON.parse(hazard.prevention)
    };

    res.json(parsedHazard);
  } catch (error) {
    console.error('Error fetching hazard:', error);
    res.status(500).json({ error: 'Failed to fetch hazard' });
  }
});

export default router;
