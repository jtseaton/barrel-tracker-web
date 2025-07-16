const express = require('express');
const { db } = require('../services/database');

const router = express.Router();

router.get('/', (req, res) => {
  db.all('SELECT * FROM sites WHERE enabled = 1', (err, rows) => {
    if (err) {
      console.error('GET /api/sites: Fetch error:', err);
      return res.status(500).json({ error: err.message });
    }
    console.log('GET /api/sites: Success', { count: rows.length });
    res.json(rows);
  });
});

router.post('/', (req, res) => {
  const { siteId, name, type, address, enabled = true } = req.body;
  if (!siteId || !name || !type) {
    console.error('POST /api/sites: Missing required fields', { siteId, name, type });
    return res.status(400).json({ error: 'siteId, name, and type are required' });
  }
  db.run(
    'INSERT INTO sites (siteId, name, type, address, enabled) VALUES (?, ?, ?, ?, ?)',
    [siteId, name, type, address || null, enabled ? 1 : 0],
    function(err) {
      if (err) {
        console.error('POST /api/sites: Insert error:', err);
        return res.status(500).json({ error: err.message });
      }
      console.log('POST /api/sites: Success', { siteId, name });
      res.json({ siteId, name, type, address, enabled });
    }
  );
});

router.patch('/:siteId', (req, res) => {
  const { siteId } = req.params;
  const { name, type, address, enabled } = req.body;
  if (!name || !type) {
    console.error('PATCH /api/sites/:siteId: Missing required fields', { name, type });
    return res.status(400).json({ error: 'name and type are required' });
  }
  db.run(
    'UPDATE sites SET name = ?, type = ?, address = ?, enabled = ? WHERE siteId = ?',
    [name, type, address || null, enabled !== undefined ? enabled : 1, siteId],
    function(err) {
      if (err) {
        console.error('PATCH /api/sites/:siteId: Update error:', err);
        return res.status(500).json({ error: err.message });
      }
      if (this.changes === 0) {
        console.error('PATCH /api/sites/:siteId: Not found', { siteId });
        return res.status(404).json({ error: 'Site not found' });
      }
      console.log('PATCH /api/sites/:siteId: Success', { siteId, name });
      res.json({ siteId, name, type, address, enabled });
    }
  );
});

router.delete('/:siteId', (req, res) => {
  const { siteId } = req.params;
  db.run('DELETE FROM sites WHERE siteId = ?', [siteId], function(err) {
    if (err) {
      console.error('DELETE /api/sites/:siteId: Delete error:', err);
      return res.status(500).json({ error: err.message });
    }
    if (this.changes === 0) {
      console.error('DELETE /api/sites/:siteId: Not found', { siteId });
      return res.status(404).json({ error: 'Site not found' });
    }
    console.log('DELETE /api/sites/:siteId: Success', { siteId });
    res.json({ message: 'Site deleted successfully' });
  });
});

module.exports = router;