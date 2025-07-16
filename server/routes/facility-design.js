const express = require('express');
const { db } = require('../services/database');

const router = express.Router();

router.get('/', (req, res) => {
  db.all('SELECT * FROM facility_designs', (err, rows) => {
    if (err) {
      console.error('GET /api/facility-design: Fetch error:', err);
      return res.status(500).json({ error: err.message });
    }
    console.log('GET /api/facility-design: Success', { count: rows.length });
    res.json(rows.map(row => ({ ...row, objects: JSON.parse(row.objects || '[]') })));
  });
});

router.get('/:siteId', (req, res) => {
  const { siteId } = req.params;
  db.get('SELECT * FROM facility_designs WHERE siteId = ?', [siteId], (err, row) => {
    if (err) {
      console.error('GET /api/facility-design/:siteId: Fetch error:', err);
      return res.status(500).json({ error: err.message });
    }
    if (!row) {
      console.error('GET /api/facility-design/:siteId: Not found', { siteId });
      return res.status(404).json({ error: 'Facility design not found' });
    }
    console.log('GET /api/facility-design/:siteId: Success', { siteId });
    res.json({ ...row, objects: JSON.parse(row.objects || '[]') });
  });
});

router.post('/', (req, res) => {
  const { siteId, objects } = req.body;
  if (!siteId || !Array.isArray(objects)) {
    console.error('POST /api/facility-design: Missing required fields', { siteId, objects });
    return res.status(400).json({ error: 'siteId and objects array are required' });
  }
  db.get('SELECT siteId FROM sites WHERE siteId = ?', [siteId], (err, site) => {
    if (err) {
      console.error('POST /api/facility-design: Fetch site error:', err);
      return res.status(500).json({ error: err.message });
    }
    if (!site) {
      console.error('POST /api/facility-design: Invalid siteId', { siteId });
      return res.status(400).json({ error: 'Invalid siteId' });
    }
    const createdAt = new Date().toISOString();
    db.run(
      'INSERT OR REPLACE INTO facility_designs (siteId, objects, createdAt, updatedAt) VALUES (?, ?, ?, ?)',
      [siteId, JSON.stringify(objects), createdAt, createdAt],
      function(err) {
        if (err) {
          console.error('POST /api/facility-design: Insert error:', err);
          return res.status(500).json({ error: err.message });
        }
        console.log('POST /api/facility-design: Success', { siteId });
        res.json({ id: this.lastID, siteId, objects });
      }
    );
  });
});

router.patch('/:siteId', (req, res) => {
  const { siteId } = req.params;
  const { objects } = req.body;
  if (!Array.isArray(objects)) {
    console.error('PATCH /api/facility-design/:siteId: Missing objects', { objects });
    return res.status(400).json({ error: 'objects array is required' });
  }
  db.get('SELECT siteId FROM sites WHERE siteId = ?', [siteId], (err, site) => {
    if (err) {
      console.error('PATCH /api/facility-design/:siteId: Fetch site error:', err);
      return res.status(500).json({ error: err.message });
    }
    if (!site) {
      console.error('PATCH /api/facility-design/:siteId: Invalid siteId', { siteId });
      return res.status(400).json({ error: 'Invalid siteId' });
    }
    db.run(
      'UPDATE facility_designs SET objects = ?, updatedAt = ? WHERE siteId = ?',
      [JSON.stringify(objects), new Date().toISOString(), siteId],
      function(err) {
        if (err) {
          console.error('PATCH /api/facility-design/:siteId: Update error:', err);
          return res.status(500).json({ error: err.message });
        }
        if (this.changes === 0) {
          console.error('PATCH /api/facility-design/:siteId: Not found', { siteId });
          return res.status(404).json({ error: 'Facility design not found' });
        }
        console.log('PATCH /api/facility-design/:siteId: Success', { siteId });
        res.json({ siteId, objects });
      }
    );
  });
});

router.delete('/:siteId', (req, res) => {
  const { siteId } = req.params;
  db.run('DELETE FROM facility_designs WHERE siteId = ?', [siteId], function(err) {
    if (err) {
      console.error('DELETE /api/facility-design/:siteId: Delete error:', err);
      return res.status(500).json({ error: err.message });
    }
    if (this.changes === 0) {
      console.error('DELETE /api/facility-design/:siteId: Not found', { siteId });
      return res.status(404).json({ error: 'Facility design not found' });
    }
    console.log('DELETE /api/facility-design/:siteId: Success', { siteId });
    res.json({ message: 'Facility design deleted successfully' });
  });
});

module.exports = router;