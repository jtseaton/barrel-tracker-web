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
    const { identifier, item: itemName, account, type, quantity, unit, proof, receivedDate, status, description, cost, siteId, locationId } = item;
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

    const results = [];
    for (const item of items) {
      const { identifier, item: itemName, account, type, quantity, unit, proof, proofGallons, receivedDate, source, siteId, locationId, status, description, cost, totalCost, poNumber, lotNumber } = item;
      const finalProofGallons = type === 'Spirits' ? (proofGallons || (parseFloat(quantity) * (parseFloat(proof) / 100)).toFixed(2)) : null;
      const finalTotalCost = totalCost || '0.00';
      const finalUnitCost = cost || '0.00';
      const finalAccount = type === 'Spirits' ? account : null;
      const finalStatus = ['Grain', 'Hops'].includes(type) ? 'Stored' : status;

      // Validate siteId
      const site = await new Promise((resolve, reject) => {
        db.get('SELECT siteId, name FROM sites WHERE siteId = ?', [siteId], (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });
      if (!site) {
        throw new Error(`Invalid siteId: ${siteId}`);
      }

      // Validate locationId
      const location = await new Promise((resolve, reject) => {
        db.get('SELECT locationId FROM locations WHERE locationId = ? AND siteId = ?', [locationId, siteId], (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });
      if (!location) {
        throw new Error(`Invalid locationId: ${locationId} for siteId: ${siteId}`);
      }

      // Validate item
      await new Promise((resolve, reject) => {
        db.run('INSERT OR IGNORE INTO items (name, type, enabled) VALUES (?, ?, ?)', [itemName, type, 1], (err) => {
          if (err) reject(err);
          else resolve();
        });
      });

      // Check existing inventory with siteId
      const row = await new Promise((resolve, reject) => {
        db.get(
          'SELECT quantity, totalCost, unit, source FROM inventory WHERE identifier = ? AND siteId = ? AND locationId = ?',
          [identifier, siteId, locationId],
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
            `UPDATE inventory SET quantity = ?, totalCost = ?, cost = ?, proofGallons = ?, receivedDate = ?, source = ?, unit = ?, status = ?, account = ?, poNumber = ?, lotNumber = ?
             WHERE identifier = ? AND siteId = ? AND locationId = ?`,
            [newQuantity, newTotalCost, avgUnitCost, finalProofGallons, receivedDate, source || 'Unknown', unit, finalStatus, finalAccount, poNumber || null, lotNumber || null, identifier, siteId, locationId],
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

      results.push({
        identifier, item: itemName, type, quantity, unit, receivedDate, source,
        siteId, locationId, status: finalStatus, description, cost: finalUnitCost, totalCost: finalTotalCost, poNumber, lotNumber, account: finalAccount
      });
    }

    await new Promise((resolve, reject) => {
      db.run('COMMIT', (err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    console.log('POST /api/inventory/receive: Success', { items: results });
    res.json({ items: results });
  } catch (err) {
    console.error('POST /api/inventory/receive: Error:', err);
    await new Promise((resolve) => db.run('ROLLBACK', resolve));
    res.status(500).json({ error: err.message || 'Internal Server Error' });
  }
});

router.post('/move', async (req, res) => {
  const { identifier, toAccount, proofGallons } = req.body;
  console.log('POST /api/inventory/move: Received payload', { identifier, toAccount, proofGallons });

  if (!identifier || !toAccount || !proofGallons) {
    console.error('POST /api/inventory/move: Missing required fields', { identifier, toAccount, proofGallons });
    return res.status(400).json({ error: 'identifier, toAccount, and proofGallons are required' });
  }

  const validAccounts = ['Storage', 'Processing', 'Production'];
  if (!validAccounts.includes(toAccount)) {
    console.error('POST /api/inventory/move: Invalid toAccount', { toAccount });
    return res.status(400).json({ error: `Invalid toAccount, must be one of ${validAccounts.join(', ')}` });
  }

  const parsedProofGallons = parseFloat(proofGallons);
  if (isNaN(parsedProofGallons) || parsedProofGallons <= 0) {
    console.error('POST /api/inventory/move: Invalid proofGallons', { proofGallons });
    return res.status(400).json({ error: 'proofGallons must be a positive number' });
  }

  try {
    await new Promise((resolve, reject) => {
      db.run('BEGIN TRANSACTION', (err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    const item = await new Promise((resolve, reject) => {
      db.get('SELECT * FROM inventory WHERE identifier = ? AND type = ?', [identifier, 'Spirits'], (err, row) => {
        if (err) reject(err);
        resolve(row);
      });
    });

    if (!item) {
      await new Promise((resolve) => db.run('ROLLBACK', resolve));
      console.error('POST /api/inventory/move: Inventory not found or not Spirits', { identifier });
      return res.status(404).json({ error: `Inventory item ${identifier} not found or not of type Spirits` });
    }

    const proof = parseFloat(item.proof || '0');
    if (proof <= 0) {
      await new Promise((resolve) => db.run('ROLLBACK', resolve));
      console.error('POST /api/inventory/move: Invalid proof', { identifier, proof });
      return res.status(400).json({ error: 'Item proof must be a positive number' });
    }

    const moveQuantity = (parsedProofGallons * 100 / proof).toFixed(2); // Convert proof gallons to wine gallons
    const currentQuantity = parseFloat(item.quantity || '0');
    if (moveQuantity > currentQuantity) {
      await new Promise((resolve) => db.run('ROLLBACK', resolve));
      console.error('POST /api/inventory/move: Insufficient quantity', { identifier, currentQuantity, moveQuantity });
      return res.status(400).json({ error: `Insufficient quantity: requested ${moveQuantity} gallons, available ${currentQuantity} gallons` });
    }

    const newQuantity = (currentQuantity - moveQuantity).toFixed(2);
    await new Promise((resolve, reject) => {
      db.run(
        'UPDATE inventory SET quantity = ?, proofGallons = ? WHERE identifier = ?',
        [newQuantity, (newQuantity * proof / 100).toFixed(2), identifier],
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });

    let newIdentifier = `${identifier}-${toAccount}`;
    let suffix = 1;
    while (true) {
      const existing = await new Promise((resolve, reject) => {
        db.get('SELECT 1 FROM inventory WHERE identifier = ?', [newIdentifier], (err, row) => {
          if (err) reject(err);
          resolve(row);
        });
      });
      if (!existing) break;
      newIdentifier = `${identifier}-${toAccount}-${suffix}`;
      suffix++;
    }

    await new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO inventory (identifier, item, type, quantity, unit, proof, proofGallons, receivedDate, source, siteId, locationId, status, description, cost, totalCost, poNumber, lotNumber, account)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          newIdentifier,
          item.item,
          item.type,
          moveQuantity,
          item.unit,
          item.proof,
          parsedProofGallons,
          item.receivedDate,
          item.source,
          item.siteId,
          item.locationId,
          item.status,
          item.description,
          item.cost,
          (parseFloat(item.cost || '0') * moveQuantity).toFixed(2),
          item.poNumber,
          item.lotNumber,
          toAccount,
        ],
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });

    await new Promise((resolve, reject) => {
      db.run('COMMIT', (err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    console.log('POST /api/inventory/move: Success', { identifier, toAccount, proofGallons, moveQuantity, newIdentifier });
    res.json({ message: 'Inventory moved successfully', newIdentifier });
  } catch (err) {
    console.error('POST /api/inventory/move: Error:', err);
    await new Promise((resolve) => db.run('ROLLBACK', resolve));
    res.status(500).json({ error: err.message || 'Internal Server Error' });
  }
});

router.post('/loss', async (req, res) => {
  const { identifier, quantityLost, reason, date, siteId, locationId } = req.body;
  console.log('POST /api/inventory/loss: Received payload', { identifier, quantityLost, reason, date, siteId, locationId });

  if (!identifier || !quantityLost || !reason || !siteId) {
    console.error('POST /api/inventory/loss: Missing required fields', { identifier, quantityLost, reason, siteId });
    return res.status(400).json({ error: 'identifier, quantityLost, reason, and siteId are required' });
  }

  const parsedQuantityLost = parseFloat(quantityLost);
  if (isNaN(parsedQuantityLost) || parsedQuantityLost <= 0) {
    console.error('POST /api/inventory/loss: Invalid quantityLost', { quantityLost });
    return res.status(400).json({ error: 'quantityLost must be a positive number' });
  }

  try {
    await new Promise((resolve, reject) => {
      db.run('BEGIN TRANSACTION', (err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    const site = await new Promise((resolve, reject) => {
      db.get('SELECT siteId FROM sites WHERE siteId = ?', [siteId], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    if (!site) {
      await new Promise((resolve) => db.run('ROLLBACK', resolve));
      console.error('POST /api/inventory/loss: Invalid siteId', { siteId });
      return res.status(400).json({ error: 'Invalid siteId' });
    }

    const inventory = await new Promise((resolve, reject) => {
      db.get('SELECT quantity FROM inventory WHERE identifier = ?', [identifier], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    if (!inventory) {
      await new Promise((resolve) => db.run('ROLLBACK', resolve));
      console.error('POST /api/inventory/loss: Inventory not found', { identifier, siteId, locationId });
      return res.status(404).json({ error: 'Inventory item not found' });
    }

    const currentQuantity = parseFloat(inventory.quantity || '0');
    if (currentQuantity < parsedQuantityLost) {
      await new Promise((resolve) => db.run('ROLLBACK', resolve));
      console.error('POST /api/inventory/loss: Insufficient quantity', { identifier, available: currentQuantity, requested: parsedQuantityLost });
      return res.status(400).json({ error: 'Insufficient inventory quantity' });
    }

    await new Promise((resolve, reject) => {
      db.run(
        'UPDATE inventory SET quantity = quantity - ? WHERE identifier = ?',
        [parsedQuantityLost, identifier],
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });

    await new Promise((resolve, reject) => {
      db.run(
        'INSERT INTO inventory_losses (identifier, quantityLost, reason, date, siteId, locationId, userId) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [
          identifier,
          parsedQuantityLost,
          reason,
          date || new Date().toISOString().split('T')[0],
          siteId,
          locationId || null,
          req.user?.email || 'unknown',
        ],
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });

    await new Promise((resolve, reject) => {
      db.run('COMMIT', (err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    console.log('POST /api/inventory/loss: Success', { identifier, quantityLost, reason });
    res.json({ message: 'Inventory loss recorded successfully' });
  } catch (err) {
    console.error('POST /api/inventory/loss: Error:', err);
    await new Promise((resolve) => db.run('ROLLBACK', resolve));
    res.status(500).json({ error: err.message || 'Internal Server Error' });
  }
});

module.exports = router;