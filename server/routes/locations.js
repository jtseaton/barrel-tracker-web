const express = require('express');
const { db } = require('../../services/database');

const router = express.Router();

router.get('/', (req, res) => {
  const { siteId } = req.query;
  let query = 'SELECT * FROM locations WHERE enabled = 1';
  const params = [];
  if (siteId) {
    query += ' AND siteId = ?';
    params.push(siteId);
  }
  db.all(query, params, (err, rows) => {
    if (err) {
      console.error('GET /api/locations: Fetch error:', err);
      return res.status(500).json({ error: err.message });
    }
    console.log('GET /api/locations: Success', { count: rows.length });
    res.json(rows);
  });
});

router.post('/', (req, res) => {
  const { siteId, name, abbreviation, enabled = true } = req.body;
  if (!siteId || !name) {
    console.error('POST /api/locations: Missing required fields', { siteId, name });
    return res.status(400).json({ error: 'siteId and name are required' });
  }
  db.get('SELECT siteId FROM sites WHERE siteId = ?', [siteId], (err, site) => {
    if (err) {
      console.error('POST /api/locations: Fetch site error:', err);
      return res.status(500).json({ error: err.message });
    }
    if (!site) {
      console.error('POST /api/locations: Invalid siteId', { siteId });
      return res.status(400).json({ error: 'Invalid siteId' });
    }
    db.run(
      'INSERT INTO locations (siteId, name, abbreviation, enabled) VALUES (?, ?, ?, ?)',
      [siteId, name, abbreviation || null, enabled ? 1 : 0],
      function(err) {
        if (err) {
          console.error('POST /api/locations: Insert error:', err);
          return res.status(500).json({ error: err.message });
        }
        console.log('POST /api/locations: Success', { siteId, name });
        res.json({ locationId: this.lastID, siteId, name, abbreviation, enabled });
      }
    );
  });
});

router.patch('/:locationId', (req, res) => {
  const { locationId } = req.params;
  const { siteId, name, abbreviation, enabled } = req.body;
  if (!siteId || !name) {
    console.error('PATCH /api/locations/:locationId: Missing required fields', { siteId, name });
    return res.status(400).json({ error: 'siteId and name are required' });
  }
  db.get('SELECT siteId FROM sites WHERE siteId = ?', [siteId], (err, site) => {
    if (err) {
      console.error('PATCH /api/locations/:locationId: Fetch site error:', err);
      return res.status(500).json({ error: err.message });
    }
    if (!site) {
      console.error('PATCH /api/locations/:locationId: Invalid siteId', { siteId });
      return res.status(400).json({ error: 'Invalid siteId' });
    }
    db.run(
      'UPDATE locations SET siteId = ?, name = ?, abbreviation = ?, enabled = ? WHERE locationId = ?',
      [siteId, name, abbreviation || null, enabled !== undefined ? enabled : 1, locationId],
      function(err) {
        if (err) {
          console.error('PATCH /api/locations/:locationId: Update error:', err);
          return res.status(500).json({ error: err.message });
        }
        if (this.changes === 0) {
          console.error('PATCH /api/locations/:locationId: Not found', { locationId });
          return res.status(404).json({ error: 'Location not found' });
        }
        console.log('PATCH /api/locations/:locationId: Success', { locationId, name, siteId });
        res.json({ locationId, siteId, name, abbreviation, enabled });
      }
    );
  });
});

router.delete('/:locationId', (req, res) => {
  const { locationId } = req.params;
  db.run('DELETE FROM locations WHERE locationId = ?', [locationId], function(err) {
    if (err) {
      console.error('DELETE /api/locations/:locationId: Delete error:', err);
      return res.status(500).json({ error: err.message });
    }
    if (this.changes === 0) {
      console.error('DELETE /api/locations/:locationId: Not found', { locationId });
      return res.status(404).json({ error: 'Location not found' });
    }
    console.log('DELETE /api/locations/:locationId: Success', { locationId });
    res.json({ message: 'Location deleted successfully' });
  });
});

module.exports = router;