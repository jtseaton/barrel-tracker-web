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

router.post('/receive', (req, res) => {
  console.log('POST /api/receive: Received payload', req.body);
  const items = Array.isArray(req.body) ? req.body : [req.body];
  
  if (!items.length) {
    console.error('POST /api/receive: No items provided');
    return res.status(400).json({ error: 'No items provided' });
  }

  const insertQuery = `
    INSERT INTO inventory (
      identifier, item, lotNumber, account, type, quantity, unit, proof, proofGallons,
      receivedDate, source, siteId, locationId, status, description, cost, totalCost, poNumber
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;
  
  db.serialize(() => {
    const stmt = db.prepare(insertQuery);
    let errors = [];

    items.forEach((item) => {
      const {
        identifier, item: itemName, lotNumber, account, type, quantity, unit, proof, proofGallons,
        receivedDate, source, siteId, locationId, status, description, cost, totalCost, poNumber
      } = item;

      if (!identifier || !itemName || !type || !quantity || !unit || !siteId || !locationId || !status) {
        errors.push(`Invalid item: ${JSON.stringify(item)}`);
        return;
      }

      stmt.run(
        [
          identifier,
          itemName,
          lotNumber || '',
          account || 'Storage',
          type,
          parseFloat(quantity) || 0,
          unit,
          proof || null,
          proofGallons || null,
          receivedDate || new Date().toISOString().split('T')[0],
          source || 'Unknown',
          siteId,
          parseInt(locationId, 10) || null,
          status,
          description || null,
          cost ? parseFloat(cost) : null,
          totalCost ? parseFloat(totalCost) : null,
          poNumber || null,
        ],
        (err) => {
          if (err) {
            errors.push(`Insert error for item ${identifier}: ${err.message}`);
          }
        }
      );
    });

    stmt.finalize((err) => {
      if (err) {
        console.error('POST /api/receive: Database finalize error:', err);
        return res.status(500).json({ error: 'Failed to receive items: ' + err.message });
      }
      if (errors.length) {
        console.error('POST /api/receive: Errors during insert:', errors);
        return res.status(400).json({ error: 'Failed to receive some items', details: errors });
      }
      console.log('POST /api/inventory/receive: Success', { count: items.length });
      res.status(200).json({ message: 'Items received successfully', count: items.length });
    });
  });
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