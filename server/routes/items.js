const express = require('express');
const { db } = require('../../services/database');

const router = express.Router();

router.get('/', (req, res) => {
  db.all('SELECT * FROM items WHERE enabled = 1', (err, rows) => {
    if (err) {
      console.error('GET /api/items: Fetch error:', err);
      return res.status(500).json({ error: err.message });
    }
    console.log('GET /api/items: Success', { count: rows.length });
    res.json(rows);
  });
});

router.post('/', (req, res) => {
  const { name, type, enabled = true } = req.body;
  if (!name || !type) {
    console.error('POST /api/items: Missing required fields', { name, type });
    return res.status(400).json({ error: 'Name and type are required' });
  }
  db.run(
    'INSERT INTO items (name, type, enabled) VALUES (?, ?, ?)',
    [name, type, enabled ? 1 : 0],
    function(err) {
      if (err) {
        console.error('POST /api/items: Insert error:', err);
        return res.status(500).json({ error: err.message });
      }
      console.log('POST /api/items: Success', { name, type });
      res.json({ name, type, enabled });
    }
  );
});

router.delete('/', (req, res) => {
  const { names } = req.body;
  if (!Array.isArray(names) || names.length === 0) {
    console.error('DELETE /api/items: Invalid names array', { names });
    return res.status(400).json({ error: 'Array of names required' });
  }
  const placeholders = names.map(() => '?').join(',');
  db.run(`DELETE FROM items WHERE name IN (${placeholders})`, names, (err) => {
    if (err) {
      console.error('DELETE /api/items: Delete error:', err);
      return res.status(500).json({ error: err.message });
    }
    console.log('DELETE /api/items: Success', { names });
    res.json({ message: 'Items deleted' });
  });
});

module.exports = router;