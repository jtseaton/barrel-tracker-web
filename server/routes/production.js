const express = require('express');
const { db, OUR_DSP } = require('../services/database');
const { packageVolumes } = require('../services/xml-parser');

const router = express.Router();

router.post('/', (req, res) => {
  const { batchId, siteId, locationId, quantity, proof, userId } = req.body;
  console.log('POST /api/production: Received request', { batchId, siteId, locationId, quantity, proof, userId });

  if (!batchId || !siteId || !locationId || !quantity || !proof) {
    console.error('POST /api/production: Missing required fields', { batchId, siteId, locationId, quantity, proof });
    return res.status(400).json({ error: 'batchId, siteId, locationId, quantity, and proof are required' });
  }
  if (quantity <= 0 || proof < 0) {
    console.error('POST /api/production: Invalid quantity or proof', { quantity, proof });
    return res.status(400).json({ error: 'Quantity must be positive and proof must be non-negative' });
  }

  db.get('SELECT siteId FROM sites WHERE siteId = ?', [siteId], (err, site) => {
    if (err) {
      console.error('POST /api/production: Fetch site error:', err);
      return res.status(500).json({ error: err.message });
    }
    if (!site) {
      console.error('POST /api/production: Invalid siteId', { siteId });
      return res.status(400).json({ error: 'Invalid siteId' });
    }
    db.get('SELECT locationId FROM locations WHERE locationId = ? AND siteId = ?', [locationId, siteId], (err, location) => {
      if (err) {
        console.error('POST /api/production: Fetch location error:', err);
        return res.status(500).json({ error: err.message });
      }
      if (!location) {
        console.error('POST /api/production: Invalid locationId', { locationId, siteId });
        return res.status(400).json({ error: 'Invalid locationId for given siteId' });
      }
      db.get('SELECT batchId, productId, status FROM batches WHERE batchId = ?', [batchId], (err, batch) => {
        if (err) {
          console.error('POST /api/production: Fetch batch error:', err);
          return res.status(500).json({ error: err.message });
        }
        if (!batch) {
          console.error('POST /api/production: Batch not found', { batchId });
          return res.status(404).json({ error: 'Batch not found' });
        }
        if (batch.status === 'Completed') {
          console.error('POST /api/production: Cannot modify completed batch', { batchId });
          return res.status(400).json({ error: 'Cannot modify a completed batch' });
        }
        db.get('SELECT id, name, abv FROM products WHERE id = ?', [batch.productId], (err, product) => {
          if (err) {
            console.error('POST /api/production: Fetch product error:', err);
            return res.status(500).json({ error: err.message });
          }
          if (!product) {
            console.error('POST /api/production: Product not found', { productId: batch.productId });
            return res.status(400).json({ error: 'Invalid productId in batch' });
          }

          // Calculate proof gallons
          const gallons = quantity * 31; // Assuming 1 barrel = 31 gallons
          const proofGallons = (gallons * proof) / 200; // Proof gallons formula: (volume in gallons * proof) / 200
          console.log('POST /api/production: Calculated proof gallons', { gallons, proof, proofGallons });

          db.serialize(() => {
            db.run('BEGIN TRANSACTION', (err) => {
              if (err) {
                console.error('POST /api/production: Begin transaction error:', err);
                return res.status(500).json({ error: err.message });
              }

              // Update batch volume
              db.run(
                'UPDATE batches SET volume = COALESCE(volume, 0) + ?, status = ? WHERE batchId = ?',
                [quantity, 'In Progress', batchId],
                (err) => {
                  if (err) {
                    db.run('ROLLBACK');
                    console.error('POST /api/production: Update batch error:', err);
                    return res.status(500).json({ error: err.message });
                  }

                  // Insert into inventory
                  const identifier = `${product.name} Barrel`;
                  db.get(
                    'SELECT quantity FROM inventory WHERE identifier = ? AND type = ? AND siteId = ? AND locationId = ?',
                    [identifier, 'Barrel', siteId, locationId],
                    (err, row) => {
                      if (err) {
                        db.run('ROLLBACK');
                        console.error('POST /api/production: Fetch inventory error:', err);
                        return res.status(500).json({ error: err.message });
                      }

                      if (row) {
                        const newQuantity = parseFloat(row.quantity) + quantity;
                        db.run(
                          'UPDATE inventory SET quantity = ?, proof = ?, proofGallons = ? WHERE identifier = ? AND type = ? AND siteId = ? AND locationId = ?',
                          [newQuantity, proof, proofGallons, identifier, 'Barrel', siteId, locationId],
                          (err) => {
                            if (err) {
                              db.run('ROLLBACK');
                              console.error('POST /api/production: Update inventory error:', err);
                              return res.status(500).json({ error: err.message });
                            }
                            recordTransaction();
                          }
                        );
                      } else {
                        db.run(
                          `INSERT INTO inventory (identifier, account, type, quantity, unit, proof, proofGallons, receivedDate, source, siteId, locationId, status)
                           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                          [
                            identifier,
                            'Storage',
                            'Barrel',
                            quantity,
                            'Barrels',
                            proof,
                            proofGallons,
                            new Date().toISOString().split('T')[0],
                            'Production',
                            siteId,
                            locationId,
                            'Stored',
                          ],
                          (err) => {
                            if (err) {
                              db.run('ROLLBACK');
                              console.error('POST /api/production: Insert inventory error:', err);
                              return res.status(500).json({ error: err.message });
                            }
                            recordTransaction();
                          }
                        );
                      }

                      function recordTransaction() {
                        db.run(
                          `INSERT INTO transactions (barrelId, type, quantity, proofGallons, date, action, dspNumber, toAccount, userId)
                           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                          [
                            batchId,
                            'Barrel',
                            quantity,
                            proofGallons,
                            new Date().toISOString().split('T')[0],
                            'Produced',
                            OUR_DSP,
                            'Storage',
                            userId || req.user?.email || 'unknown',
                          ],
                          (err) => {
                            if (err) {
                              db.run('ROLLBACK');
                              console.error('POST /api/production: Insert transaction error:', err);
                              return res.status(500).json({ error: err.message });
                            }
                            db.run('COMMIT', (err) => {
                              if (err) {
                                db.run('ROLLBACK');
                                console.error('POST /api/production: Commit error:', err);
                                return res.status(500).json({ error: err.message });
                              }
                              console.log('POST /api/production: Success', { batchId, identifier, quantity, proofGallons, userId });
                              res.json({
                                message: 'Production recorded successfully',
                                batchId,
                                identifier,
                                quantity,
                                proofGallons: proofGallons.toFixed(2),
                              });
                            });
                          }
                        );
                      }
                    }
                  );
                }
              );
            });
          });
        });
      });
    });
  });
});

module.exports = router;