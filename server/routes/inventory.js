const express = require('express');
const { db, OUR_DSP } = require('../services/database');

const router = express.Router();

router.get('/', (req, res) => {
  const { siteId, type, locationId } = req.query;
  let query = 'SELECT * FROM inventory WHERE enabled = 1';
  const params = [];
  if (siteId) {
    query += ' AND siteId = ?';
    params.push(siteId);
  }
  if (type) {
    query += ' AND type = ?';
    params.push(type);
  }
  if (locationId) {
    query += ' AND locationId = ?';
    params.push(locationId);
  }
  db.all(query, params, (err, rows) => {
    if (err) {
      console.error('GET /api/inventory: Fetch error:', err);
      return res.status(500).json({ error: err.message });
    }
    console.log('GET /api/inventory: Success', { count: rows.length });
    res.json(rows);
  });
});

router.post('/receive', async (req, res) => {
  console.log('POST /api/inventory/receive: Received payload', JSON.stringify(req.body, null, 2));
  const items = Array.isArray(req.body) ? req.body : [req.body];
  const validAccounts = ['Storage', 'Processing', 'Production'];
  const validateItem = (item) => {
    const { identifier, item: itemName, type, quantity, unit, proof, receivedDate, status, description, cost, siteId, locationId } = item;
    if (!identifier || !itemName || !type || !quantity || !unit || !receivedDate || !status || !siteId || !locationId) {
      return 'Missing required fields (identifier, item, type, quantity, unit, receivedDate, status, siteId, locationId)';
    }
    if (type === 'Spirits' && (!account || !validAccounts.includes(account) || !proof)) {
      return 'Spirits require account (Storage, Processing, or Production) and proof';
    }
    if (type === 'Other' && !description) return 'Description required for Other type';
    const parsedQuantity = parseFloat(quantity);
    const parsedProof = proof ? parseFloat(proof) : null;
    const parsedCost = cost ? parseFloat(cost) : null;
    if (isNaN(parsedQuantity) || parsedQuantity <= 0 || 
        (parsedProof && (parsedProof > 200 || parsedProof < 0)) || 
        (parsedCost && parsedCost < 0)) return 'Invalid quantity, proof, or cost';
    return null;
  };
  const errors = items.map(item => {
    const error = validateItem(item);
    if (error) console.log('POST /api/inventory/receive: Validation error', { item, error });
    return error;
  }).filter(e => e);
  if (errors.length) return res.status(400).json({ error: errors[0] });
  try {
    await new Promise((resolve, reject) => {
      db.run('BEGIN TRANSACTION', (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
    for (const item of items) {
      const { identifier, item: itemName, type, quantity, unit, proof, proofGallons, receivedDate, source, siteId, locationId, status, description, cost, totalCost, poNumber, lotNumber, account } = item;
      const finalProofGallons = type === 'Spirits' ? (proofGallons || (parseFloat(quantity) * (parseFloat(proof) / 200)).toFixed(2)) : null;
      const finalTotalCost = totalCost || '0.00';
      const finalUnitCost = cost || '0.00';
      const finalAccount = type === 'Spirits' ? account : null;
      const finalStatus = ['Grain', 'Hops'].includes(type) ? 'Stored' : status;
      const location = await new Promise((resolve, reject) => {
        db.get('SELECT locationId FROM locations WHERE locationId = ? AND siteId = ?', [locationId, siteId], (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });
      if (!location) {
        throw new Error(`Invalid locationId: ${locationId} for siteId: ${siteId}`);
      }
      await new Promise((resolve, reject) => {
        db.run('INSERT OR IGNORE INTO items (name, type, enabled) VALUES (?, ?, ?)', [itemName, type, 1], (err) => {
          if (err) reject(err);
          else resolve();
        });
      });
      const row = await new Promise((resolve, reject) => {
        db.get(
          'SELECT quantity, totalCost, unit, source FROM inventory WHERE identifier = ?',
          [identifier],
          (err, row) => {
            if (err) reject(err);
            else resolve(row);
          }
        );
      });
      console.log('POST /api/inventory/receive: Processing item', { identifier, item: itemName, account: finalAccount, status: finalStatus, siteId, locationId, quantity, unit });
      if (row) {
        const existingQuantity = parseFloat(row.quantity || '0');
        const existingTotalCost = parseFloat(row.totalCost || '0');
        const newQuantity = (existingQuantity + parseFloat(quantity)).toFixed(2);
        const newTotalCost = (existingTotalCost + parseFloat(finalTotalCost)).toFixed(2);
        const avgUnitCost = (newTotalCost / newQuantity).toFixed(2);
        await new Promise((resolve, reject) => {
          db.run(
            `UPDATE inventory SET quantity = ?, totalCost = ?, cost = ?, proofGallons = ?, receivedDate = ?, source = ?, unit = ?, status = ?, account = ?, poNumber = ?, lotNumber = ? WHERE identifier = ?`,
            [newQuantity, newTotalCost, avgUnitCost, finalProofGallons, receivedDate, source || 'Unknown', unit, finalStatus, finalAccount, poNumber || null, lotNumber || null, identifier],
            (err) => {
              if (err) reject(err);
              else resolve();
            }
          );
        });
      } else {
        await new Promise((resolve, reject) => {
          db.run(
            `INSERT INTO inventory (identifier, item, type, quantity, unit, proof, proofGallons, receivedDate, source, siteId, locationId, status, description, cost, totalCost, poNumber, lotNumber, account)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [identifier, itemName, type, quantity, unit, proof || null, finalProofGallons, receivedDate, source || 'Unknown', siteId, locationId, finalStatus, description || null, finalUnitCost, finalTotalCost, poNumber || null, lotNumber || null, finalAccount],
            (err) => {
              if (err) reject(err);
              else resolve();
            }
          );
        });
      }
    }
    await new Promise((resolve, reject) => {
      db.run('COMMIT', (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
    console.log('POST /api/inventory/receive: Success', { items });
    res.json({ message: 'Receive successful' });
  } catch (err) {
    console.error('POST /api/inventory/receive: Error:', err);
    await new Promise((resolve) => db.run('ROLLBACK', resolve));
    res.status(500).json({ error: err.message || 'Internal Server Error' });
  }
});

router.post('/loss', (req, res) => {
  const { identifier, quantityLost, reason, date, siteId, locationId } = req.body;
  if (!identifier || !quantityLost || !reason || !siteId) {
    console.error('POST /api/inventory/loss: Missing required fields', { identifier, quantityLost, reason, siteId });
    return res.status(400).json({ error: 'identifier, quantityLost, reason, and siteId are required' });
  }
  if (quantityLost <= 0) {
    console.error('POST /api/inventory/loss: Invalid quantityLost', { quantityLost });
    return res.status(400).json({ error: 'quantityLost must be positive' });
  }
  db.get('SELECT siteId FROM sites WHERE siteId = ?', [siteId], (err, site) => {
    if (err) {
      console.error('POST /api/inventory/loss: Fetch site error:', err);
      return res.status(500).json({ error: err.message });
    }
    if (!site) {
      console.error('POST /api/inventory/loss: Invalid siteId', { siteId });
      return res.status(400).json({ error: 'Invalid siteId' });
    }
    db.get(
      'SELECT quantity FROM inventory WHERE identifier = ?',
      [identifier],
      (err, inventory) => {
        if (err) {
          console.error('POST /api/inventory/loss: Fetch inventory error:', err);
          return res.status(500).json({ error: err.message });
        }
        if (!inventory) {
          console.error('POST /api/inventory/loss: Inventory not found', { identifier, siteId, locationId });
          return res.status(404).json({ error: 'Inventory item not found' });
        }
        if (parseFloat(inventory.quantity) < quantityLost) {
          console.error('POST /api/inventory/loss: Insufficient quantity', { identifier, available: inventory.quantity, requested: quantityLost });
          return res.status(400).json({ error: 'Insufficient inventory quantity' });
        }
        db.serialize(() => {
          db.run('BEGIN TRANSACTION', (err) => {
            if (err) {
              console.error('POST /api/inventory/loss: Begin transaction error:', err);
              return res.status(500).json({ error: err.message });
            }
            db.run(
              'UPDATE inventory SET quantity = quantity - ? WHERE identifier = ?',
              [quantityLost, identifier],
              (err) => {
                if (err) {
                  db.run('ROLLBACK');
                  console.error('POST /api/inventory/loss: Update inventory error:', err);
                  return res.status(500).json({ error: err.message });
                }
                db.run(
                  'INSERT INTO inventory_losses (identifier, quantityLost, reason, date, siteId, locationId, userId) VALUES (?, ?, ?, ?, ?, ?, ?)',
                  [
                    identifier,
                    quantityLost,
                    reason,
                    date || new Date().toISOString().split('T')[0],
                    siteId,
                    locationId || null,
                    req.user?.email || 'unknown',
                  ],
                  (err) => {
                    if (err) {
                      db.run('ROLLBACK');
                      console.error('POST /api/inventory/loss: Insert loss error:', err);
                      return res.status(500).json({ error: err.message });
                    }
                    db.run('COMMIT', (err) => {
                      if (err) {
                        db.run('ROLLBACK');
                        console.error('POST /api/inventory/loss: Commit error:', err);
                        return res.status(500).json({ error: err.message });
                      }
                      console.log('POST /api/inventory/loss: Success', { identifier, quantityLost, reason });
                      res.json({ message: 'Inventory loss recorded successfully' });
                    });
                  }
                );
              }
            );
          });
        });
      }
    );
  });
});

module.exports = router;