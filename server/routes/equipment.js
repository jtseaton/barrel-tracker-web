const express = require('express');
const { db } = require('../services/database');

const router = express.Router();

router.get('/', (req, res) => {
  const { siteId } = req.query;
  let query = 'SELECT * FROM equipment WHERE enabled = 1';
  const params = [];
  if (siteId) {
    query += ' AND siteId = ?';
    params.push(siteId);
  }
  db.all(query, params, (err, rows) => {
    if (err) {
      console.error('GET /api/equipment: Fetch error:', err);
      return res.status(500).json({ error: err.message });
    }
    console.log('GET /api/equipment: Success', { count: rows.length });
    res.json(rows);
  });
});

router.post('/', (req, res) => {
  const { name, abbreviation, siteId, enabled = true, type } = req.body;
  if (!name || !siteId || !type) {
    console.error('POST /api/equipment: Missing required fields', { name, siteId, type });
    return res.status(400).json({ error: 'name, siteId, and type are required' });
  }
  db.get('SELECT siteId FROM sites WHERE siteId = ?', [siteId], (err, site) => {
    if (err) {
      console.error('POST /api/equipment: Fetch site error:', err);
      return res.status(500).json({ error: err.message });
    }
    if (!site) {
      console.error('POST /api/equipment: Invalid siteId', { siteId });
      return res.status(400).json({ error: 'Invalid siteId' });
    }
    db.run(
      'INSERT INTO equipment (name, abbreviation, siteId, enabled, type) VALUES (?, ?, ?, ?, ?)',
      [name, abbreviation || null, siteId, enabled ? 1 : 0, type],
      function(err) {
        if (err) {
          console.error('POST /api/equipment: Insert error:', err);
          return res.status(500).json({ error: err.message });
        }
        console.log('POST /api/equipment: Success', { name, siteId, type });
        res.json({ equipmentId: this.lastID, name, abbreviation, siteId, enabled, type });
      }
    );
  });
});

router.patch('/:equipmentId', (req, res) => {
  const { equipmentId } = req.params;
  const { name, abbreviation, siteId, enabled, type } = req.body;
  if (!name || !siteId || !type) {
    console.error('PATCH /api/equipment/:equipmentId: Missing required fields', { name, siteId, type });
    return res.status(400).json({ error: 'name, siteId, and type are required' });
  }
  db.get('SELECT siteId FROM sites WHERE siteId = ?', [siteId], (err, site) => {
    if (err) {
      console.error('PATCH /api/equipment/:equipmentId: Fetch site error:', err);
      return res.status(500).json({ error: err.message });
    }
    if (!site) {
      console.error('PATCH /api/equipment/:equipmentId: Invalid siteId', { siteId });
      return res.status(400).json({ error: 'Invalid siteId' });
    }
    db.run(
      'UPDATE equipment SET name = ?, abbreviation = ?, siteId = ?, enabled = ?, type = ? WHERE equipmentId = ?',
      [name, abbreviation || null, siteId, enabled !== undefined ? enabled : 1, type, equipmentId],
      function(err) {
        if (err) {
          console.error('PATCH /api/equipment/:equipmentId: Update error:', err);
          return res.status(500).json({ error: err.message });
        }
        if (this.changes === 0) {
          console.error('PATCH /api/equipment/:equipmentId: Not found', { equipmentId });
          return res.status(404).json({ error: 'Equipment not found' });
        }
        console.log('PATCH /api/equipment/:equipmentId: Success', { equipmentId, name, siteId });
        res.json({ equipmentId, name, abbreviation, siteId, enabled, type });
      }
    );
  });
});

router.delete('/:equipmentId', (req, res) => {
  const { equipmentId } = req.params;
  db.run('DELETE FROM equipment WHERE equipmentId = ?', [equipmentId], function(err) {
    if (err) {
      console.error('DELETE /api/equipment/:equipmentId: Delete error:', err);
      return res.status(500).json({ error: err.message });
    }
    if (this.changes === 0) {
      console.error('DELETE /api/equipment/:equipmentId: Not found', { equipmentId });
      return res.status(404).json({ error: 'Equipment not found' });
    }
    console.log('DELETE /api/equipment/:equipmentId: Success', { equipmentId });
    res.json({ message: 'Equipment deleted successfully' });
  });
});

module.exports = router;