const express = require('express');
const { db, OUR_DSP } = require('../services/database');

const router = express.Router();

router.get('/', (req, res) => {
  const { siteId, type, locationId } = req.query;
  let query = 'SELECT * FROM inventory WHERE 1=1';
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

router.post('/', (req, res) => {
  const { identifier, account, type, quantity, unit, price, isKegDepositItem, receivedDate, source, siteId, locationId, status, description, cost, totalCost } = req.body;
  if (!identifier || !type || !quantity || !unit || !siteId || !status) {
    console.error('POST /api/inventory: Missing required fields', { identifier, type, quantity, unit, siteId, status });
    return res.status(400).json({ error: 'identifier, type, quantity, unit, siteId, and status are required' });
  }
  db.get('SELECT siteId FROM sites WHERE siteId = ?', [siteId], (err, site) => {
    if (err) {
      console.error('POST /api/inventory: Fetch site error:', err);
      return res.status(500).json({ error: err.message });
    }
    if (!site) {
      console.error('POST /api/inventory: Invalid siteId', { siteId });
      return res.status(400).json({ error: 'Invalid siteId' });
    }
    if (locationId) {
      db.get('SELECT locationId FROM locations WHERE locationId = ? AND siteId = ?', [locationId, siteId], (err, location) => {
        if (err) {
          console.error('POST /api/inventory: Fetch location error:', err);
          return res.status(500).json({ error: err.message });
        }
        if (!location) {
          console.error('POST /api/inventory: Invalid locationId', { locationId, siteId });
          return res.status(400).json({ error: 'Invalid locationId for given siteId' });
        }
        insertInventory();
      });
    } else {
      insertInventory();
    }
    function insertInventory() {
      db.run(
        `INSERT INTO inventory (identifier, account, type, quantity, unit, price, isKegDepositItem, receivedDate, source, siteId, locationId, status, description, cost, totalCost)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          identifier,
          account || 'Storage',
          type,
          quantity,
          unit,
          price || null,
          isKegDepositItem ? 1 : 0,
          receivedDate || new Date().toISOString().split('T')[0],
          source || null,
          siteId,
          locationId || null,
          status,
          description || null,
          cost || null,
          totalCost || 0,
        ],
        function(err) {
          if (err) {
            console.error('POST /api/inventory: Insert error:', err);
            return res.status(500).json({ error: err.message });
          }
          console.log('POST /api/inventory: Success', { identifier, type, quantity });
          res.json({ id: this.lastID, identifier, type, quantity, unit, siteId });
        }
      );
    }
  });
});

router.patch('/', (req, res) => {
  const { identifier, siteId, locationId, updates } = req.body;
  if (!identifier || !siteId || !updates || typeof updates !== 'object') {
    console.error('PATCH /api/inventory: Missing required fields', { identifier, siteId, updates });
    return res.status(400).json({ error: 'identifier, siteId, and updates object are required' });
  }
  db.get('SELECT siteId FROM sites WHERE siteId = ?', [siteId], (err, site) => {
    if (err) {
      console.error('PATCH /api/inventory: Fetch site error:', err);
      return res.status(500).json({ error: err.message });
    }
    if (!site) {
      console.error('PATCH /api/inventory: Invalid siteId', { siteId });
      return res.status(400).json({ error: 'Invalid siteId' });
    }
    if (locationId) {
      db.get('SELECT locationId FROM locations WHERE locationId = ? AND siteId = ?', [locationId, siteId], (err, location) => {
        if (err) {
          console.error('PATCH /api/inventory: Fetch location error:', err);
          return res.status(500).json({ error: err.message });
        }
        if (!location) {
          console.error('PATCH /api/inventory: Invalid locationId', { locationId, siteId });
          return res.status(400).json({ error: 'Invalid locationId for given siteId' });
        }
        updateInventory();
      });
    } else {
      updateInventory();
    }
    function updateInventory() {
      const allowedFields = ['quantity', 'unit', 'price', 'isKegDepositItem', 'status', 'description', 'cost', 'totalCost'];
      const updatesArray = [];
      const params = [];
      for (const [key, value] of Object.entries(updates)) {
        if (allowedFields.includes(key)) {
          updatesArray.push(`${key} = ?`);
          params.push(value);
        }
      }
      if (updatesArray.length === 0) {
        console.error('PATCH /api/inventory: No valid fields to update', { updates });
        return res.status(400).json({ error: 'No valid fields to update' });
      }
      params.push(identifier, siteId, locationId || null);
      db.run(
        `UPDATE inventory SET ${updatesArray.join(', ')} WHERE identifier = ? AND siteId = ? AND locationId = ?`,
        params,
        function(err) {
          if (err) {
            console.error('PATCH /api/inventory: Update error:', err);
            return res.status(500).json({ error: err.message });
          }
          if (this.changes === 0) {
            console.error('PATCH /api/inventory: No records updated', { identifier, siteId, locationId });
            return res.status(404).json({ error: 'Inventory item not found' });
          }
          console.log('PATCH /api/inventory: Success', { identifier, siteId, updates });
          res.json({ message: 'Inventory updated successfully' });
        }
      );
    }
  });
});

router.post('/receive', async (req, res) => {
  console.log('POST /api/inventory/receive: Received payload', JSON.stringify(req.body, null, 2));
  const items = Array.isArray(req.body) ? req.body : [req.body];
  const validAccounts = ['Storage', 'Processing', 'Production'];
  const validateItem = (item) => {
    const { identifier, account, type, quantity, unit, proof, receivedDate, status, description, cost, siteId, locationId } = item;
    if (!identifier || !type || !quantity || !unit || !receivedDate || !status || !siteId || !locationId) {
      return 'Missing required fields (identifier, type, quantity, unit, receivedDate, status, siteId, locationId)';
    }
    if (type === 'Spirits' && (!account || !validAccounts.includes(account) || !proof)) {
      return 'Spirits require account (Storage, Processing, or Production) and proof';
    }
    if (type !== 'Spirits' && account && !validAccounts.includes(account)) {
      return 'Invalid account for non-Spirits type';
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
      const { identifier, account, type, quantity, unit, proof, proofGallons, receivedDate, source, siteId, locationId, status, description, cost, totalCost, poNumber, lotNumber } = item;
      const finalProofGallons = type === 'Spirits' ? (proofGallons || (parseFloat(quantity) * (parseFloat(proof) / 100)).toFixed(2)) : '0.00';
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
        db.run('INSERT OR IGNORE INTO items (name, type, enabled) VALUES (?, ?, ?)', [identifier, type, 1], (err) => {
          if (err) reject(err);
          else resolve();
        });
      });
      const row = await new Promise((resolve, reject) => {
        db.get(
          'SELECT quantity, totalCost, unit, source FROM inventory WHERE identifier = ? AND type = ? AND (account = ? OR account IS NULL) AND siteId = ? AND locationId = ?',
          [identifier, type, finalAccount, siteId, locationId],
          (err, row) => {
            if (err) reject(err);
            else resolve(row);
          }
        );
      });
      console.log('POST /api/inventory/receive: Processing item', { identifier, account: finalAccount, status: finalStatus, siteId, locationId, quantity, unit });
      if (row) {
        const existingQuantity = parseFloat(row.quantity);
        const existingTotalCost = parseFloat(row.totalCost || '0');
        const newQuantity = (existingQuantity + parseFloat(quantity)).toFixed(2);
        const newTotalCost = (existingTotalCost + parseFloat(finalTotalCost)).toFixed(2);
        const avgUnitCost = (newTotalCost / newQuantity).toFixed(2);
        await new Promise((resolve, reject) => {
          db.run(
            `UPDATE inventory SET quantity = ?, totalCost = ?, cost = ?, proofGallons = ?, receivedDate = ?, source = ?, unit = ?, status = ?, account = ?, poNumber = ?, lotNumber = ? WHERE identifier = ? AND type = ? AND (account = ? OR account IS NULL) AND siteId = ? AND locationId = ?`,
            [newQuantity, newTotalCost, avgUnitCost, finalProofGallons, receivedDate, source || 'Unknown', unit, finalStatus, finalAccount, poNumber || null, lotNumber || null, identifier, type, finalAccount, siteId, locationId],
            (err) => {
              if (err) reject(err);
              else resolve();
            }
          );
        });
      } else {
        await new Promise((resolve, reject) => {
          db.run(
            `INSERT INTO inventory (identifier, account, type, quantity, unit, proof, proofGallons, totalCost, cost, receivedDate, source, siteId, locationId, status, description, poNumber, lotNumber)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [identifier, finalAccount, type, quantity, unit, proof || null, finalProofGallons, finalTotalCost, finalUnitCost, receivedDate, source || 'Unknown', siteId, locationId, finalStatus, description || null, poNumber || null, lotNumber || null],
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
      'SELECT quantity FROM inventory WHERE identifier = ? AND siteId = ? AND locationId = ?',
      [identifier, siteId, locationId || null],
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
              'UPDATE inventory SET quantity = quantity - ? WHERE identifier = ? AND siteId = ? AND locationId = ?',
              [quantityLost, identifier, siteId, locationId || null],
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