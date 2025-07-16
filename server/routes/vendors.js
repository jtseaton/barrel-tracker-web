const express = require('express');
const { db } = require('../services/database');

const router = express.Router();

router.get('/', (req, res) => {
  db.all('SELECT * FROM vendors WHERE enabled = 1', (err, rows) => {
    if (err) {
      console.error('GET /api/vendors: Fetch error:', err);
      return res.status(500).json({ error: err.message });
    }
    console.log('GET /api/vendors: Success', { count: rows.length });
    res.json(rows);
  });
});

router.post('/', (req, res) => {
  const { name, type, enabled = true, address, email, phone } = req.body;
  if (!name || !type) {
    console.error('POST /api/vendors: Missing required fields', { name, type });
    return res.status(400).json({ error: 'Name and type are required' });
  }
  db.run(
    'INSERT INTO vendors (name, type, enabled, address, email, phone) VALUES (?, ?, ?, ?, ?, ?)',
    [name, type, enabled ? 1 : 0, address || null, email || null, phone || null],
    function(err) {
      if (err) {
        console.error('POST /api/vendors: Insert error:', err);
        return res.status(500).json({ error: err.message });
      }
      console.log('POST /api/vendors: Success', { name, type });
      res.json({ name, type, enabled, address, email, phone });
    }
  );
});

router.delete('/', (req, res) => {
  const { names } = req.body;
  if (!Array.isArray(names) || names.length === 0) {
    console.error('DELETE /api/vendors: Invalid names array', { names });
    return res.status(400).json({ error: 'Array of names required' });
  }
  const placeholders = names.map(() => '?').join(',');
  db.run(`DELETE FROM vendors WHERE name IN (${placeholders})`, names, (err) => {
    if (err) {
      console.error('DELETE /api/vendors: Delete error:', err);
      return res.status(500).json({ error: err.message });
    }
    console.log('DELETE /api/vendors: Success', { names });
    res.json({ message: 'Vendors deleted' });
  });
});

module.exports = router;