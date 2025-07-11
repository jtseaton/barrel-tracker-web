const express = require('express');
const { db } = require('../../services/database');

const router = express.Router();

router.get('/', (req, res) => {
  const { status, locationId, customerId } = req.query;
  let query = `
    SELECT k.*, p.name AS productName, c.name AS customerName, l.name AS locationName
    FROM kegs k
    LEFT JOIN products p ON k.productId = p.id
    LEFT JOIN customers c ON k.customerId = c.customerId
    LEFT JOIN locations l ON k.locationId = l.locationId
    WHERE 1=1
  `;
  const params = [];
  if (status) {
    query += ' AND k.status = ?';
    params.push(status);
  }
  if (locationId) {
    query += ' AND k.locationId = ?';
    params.push(locationId);
  }
  if (customerId) {
    query += ' AND k.customerId = ?';
    params.push(customerId);
  }
  db.all(query, params, (err, rows) => {
    if (err) {
      console.error('GET /api/kegs: Fetch error:', err);
      return res.status(500).json({ error: err.message });
    }
    console.log('GET /api/kegs: Success', { count: rows.length });
    res.json(rows);
  });
});

router.post('/', (req, res) => {
  const { code, status, productId, locationId, customerId, packagingType } = req.body;
  if (!code || !status) {
    console.error('POST /api/kegs: Missing required fields', { code, status });
    return res.status(400).json({ error: 'code and status are required' });
  }
  db.get('SELECT code FROM kegs WHERE code = ?', [code], (err, existing) => {
    if (err) {
      console.error('POST /api/kegs: Check existing keg error:', err);
      return res.status(500).json({ error: err.message });
    }
    if (existing) {
      console.error('POST /api/kegs: Keg code already exists', { code });
      return res.status(400).json({ error: 'Keg code already exists' });
    }
    db.serialize(() => {
      db.run('BEGIN TRANSACTION', (err) => {
        if (err) {
          console.error('POST /api/kegs: Begin transaction error:', err);
          return res.status(500).json({ error: err.message });
        }
        db.run(
          'INSERT INTO kegs (code, status, productId, lastScanned, locationId, customerId, packagingType) VALUES (?, ?, ?, ?, ?, ?, ?)',
          [
            code,
            status,
            productId || null,
            new Date().toISOString().split('T')[0],
            locationId || null,
            customerId || null,
            packagingType || null,
          ],
          function(err) {
            if (err) {
              db.run('ROLLBACK');
              console.error('POST /api/kegs: Insert keg error:', err);
              return res.status(500).json({ error: err.message });
            }
            const kegId = this.lastID;
            db.run(
              'INSERT INTO keg_transactions (kegId, action, productId, customerId, date, location) VALUES (?, ?, ?, ?, ?, ?)',
              [
                kegId,
                'Created',
                productId || null,
                customerId || null,
                new Date().toISOString().split('T')[0],
                locationId ? `Location: ${locationId}` : 'N/A',
              ],
              (err) => {
                if (err) {
                  db.run('ROLLBACK');
                  console.error('POST /api/kegs: Insert transaction error:', err);
                  return res.status(500).json({ error: err.message });
                }
                db.run('COMMIT', (err) => {
                  if (err) {
                    db.run('ROLLBACK');
                    console.error('POST /api/kegs: Commit error:', err);
                    return res.status(500).json({ error: err.message });
                  }
                  console.log('POST /api/kegs: Success', { code, status });
                  res.json({ id: kegId, code, status, productId, locationId, customerId, packagingType });
                });
              }
            );
          }
        );
      });
    });
  });
});

router.patch('/:kegId', (req, res) => {
  const { kegId } = req.params;
  const { status, productId, locationId, customerId, packagingType } = req.body;
  if (!status) {
    console.error('PATCH /api/kegs/:kegId: Missing status', { kegId });
    return res.status(400).json({ error: 'status is required' });
  }
  db.get('SELECT id, code FROM kegs WHERE id = ?', [kegId], (err, keg) => {
    if (err) {
      console.error('PATCH /api/kegs/:kegId: Fetch keg error:', err);
      return res.status(500).json({ error: err.message });
    }
    if (!keg) {
      console.error('PATCH /api/kegs/:kegId: Not found', { kegId });
      return res.status(404).json({ error: 'Keg not found' });
    }
    db.serialize(() => {
      db.run('BEGIN TRANSACTION', (err) => {
        if (err) {
          console.error('PATCH /api/kegs/:kegId: Begin transaction error:', err);
          return res.status(500).json({ error: err.message });
        }
        db.run(
          'UPDATE kegs SET status = ?, productId = ?, lastScanned = ?, locationId = ?, customerId = ?, packagingType = ? WHERE id = ?',
          [
            status,
            productId || null,
            new Date().toISOString().split('T')[0],
            locationId || null,
            customerId || null,
            packagingType || null,
            kegId,
          ],
          (err) => {
            if (err) {
              db.run('ROLLBACK');
              console.error('PATCH /api/kegs/:kegId: Update keg error:', err);
              return res.status(500).json({ error: err.message });
            }
            db.run(
              'INSERT INTO keg_transactions (kegId, action, productId, customerId, date, location) VALUES (?, ?, ?, ?, ?, ?)',
              [
                kegId,
                status,
                productId || null,
                customerId || null,
                new Date().toISOString().split('T')[0],
                locationId ? `Location: ${locationId}` : customerId ? `Customer: ${customerId}` : 'N/A',
              ],
              (err) => {
                if (err) {
                  db.run('ROLLBACK');
                  console.error('PATCH /api/kegs/:kegId: Insert transaction error:', err);
                  return res.status(500).json({ error: err.message });
                }
                db.run('COMMIT', (err) => {
                  if (err) {
                    db.run('ROLLBACK');
                    console.error('PATCH /api/kegs/:kegId: Commit error:', err);
                    return res.status(500).json({ error: err.message });
                  }
                  console.log('PATCH /api/kegs/:kegId: Success', { kegId, status });
                  res.json({ id: kegId, code: keg.code, status, productId, locationId, customerId, packagingType });
                });
              }
            );
          }
        );
      });
    });
  });
});

router.get('/:kegId/transactions', (req, res) => {
  const { kegId } = req.params;
  db.get('SELECT id FROM kegs WHERE id = ?', [kegId], (err, keg) => {
    if (err) {
      console.error('GET /api/kegs/:kegId/transactions: Fetch keg error:', err);
      return res.status(500).json({ error: err.message });
    }
    if (!keg) {
      console.error('GET /api/kegs/:kegId/transactions: Not found', { kegId });
      return res.status(404).json({ error: 'Keg not found' });
    }
    db.all('SELECT * FROM keg_transactions WHERE kegId = ?', [kegId], (err, transactions) => {
      if (err) {
        console.error('GET /api/kegs/:kegId/transactions: Fetch transactions error:', err);
        return res.status(500).json({ error: err.message });
      }
      console.log('GET /api/kegs/:kegId/transactions: Success', { kegId, count: transactions.length });
      res.json(transactions);
    });
  });
});

module.exports = router;