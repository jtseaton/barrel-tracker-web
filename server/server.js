const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const basicAuth = require('express-basic-auth');

const app = express();

app.use(express.json());
app.use(basicAuth({ users: { 'admin': 'yourpassword' }, challenge: true })); // Replace 'yourpassword'


const OUR_DSP = 'DSP-AL-20010';

const db = new sqlite3.Database('barrels.db', (err) => {
  if (err) console.error('DB Error:', err);
  else console.log('Connected to SQLite DB');
});

db.serialize(() => {
  // Create inventory table (unchanged)
  db.run(`
    CREATE TABLE IF NOT EXISTS inventory (
      barrelId TEXT PRIMARY KEY,
      account TEXT CHECK(account IN ('Production', 'Storage', 'Processing')),
      type TEXT CHECK(type IN ('Cane Sugar', 'Corn Sugar', 'Agave Syrup', 'Flaked Corn', 'Rye Barley', 'Malted Barley', 'Spirits')),
      quantity REAL,
      proof REAL,
      proofGallons REAL,
      receivedDate TEXT,
      source TEXT,
      dspNumber TEXT
    )
  `);

  // Check if transactions table exists before migration
  db.get("SELECT name FROM sqlite_master WHERE type='table' AND name='transactions'", (err, row) => {
    if (err) {
      console.error('Error checking for transactions table:', err);
      return;
    }

    if (row) {
      // Old transactions table exists, perform migration
      db.run(`
        CREATE TABLE transactions_new (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          barrelId TEXT,
          type TEXT,
          quantity REAL,
          proof REAL,
          proofGallons REAL,
          date TEXT,
          action TEXT CHECK(action IN ('Received', 'Moved', 'Processed', 'Removed', 'Packaged')),
          dspNumber TEXT,
          toAccount TEXT
        )
      `);
      db.run(`
        INSERT INTO transactions_new (id, barrelId, type, quantity, proof, proofGallons, date, action, dspNumber, toAccount)
        SELECT id, barrelId, type, quantity, proof, proofGallons, date, action, dspNumber, toAccount FROM transactions
      `, (err) => {
        if (err) console.error('Migration error:', err);
      });
      db.run(`DROP TABLE transactions`);
      db.run(`ALTER TABLE transactions_new RENAME TO transactions`);
    } else {
      // No old transactions table, create it fresh
      db.run(`
        CREATE TABLE IF NOT EXISTS transactions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          barrelId TEXT,
          type TEXT,
          quantity REAL,
          proof REAL,
          proofGallons REAL,
          date TEXT,
          action TEXT CHECK(action IN ('Received', 'Moved', 'Processed', 'Removed', 'Packaged')),
          dspNumber TEXT,
          toAccount TEXT
        )
      `);
    }
  });
});

app.post('/api/receive', (req, res) => {
  console.log('Received POST to /api/receive:', req.body);
  const { barrelId, account, type, quantity, proof, source, dspNumber, receivedDate } = req.body;
  const fixedQuantity = Number(quantity).toFixed(2);
  const fixedProof = proof ? Number(proof).toFixed(2) : 0;
  const proofGallons = type === 'Spirits' ? ((fixedQuantity * fixedProof) / 100).toFixed(2) : 0;
  db.run(
    `INSERT INTO inventory (barrelId, account, type, quantity, proof, proofGallons, receivedDate, source, dspNumber)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [barrelId, account, type, fixedQuantity, fixedProof, proofGallons, receivedDate, source, dspNumber || OUR_DSP],
    function (err) {
      if (err) {
        console.error('DB Insert Error:', err);
        return res.status(500).json({ error: err.message });
      }
      console.log('Inserted into inventory, barrelId:', barrelId);
      db.run(
        `INSERT INTO transactions (barrelId, type, quantity, proof, proofGallons, date, action, dspNumber, toAccount)
         VALUES (?, ?, ?, ?, ?, ?, 'Received', ?, ?)`,
        [barrelId, type, fixedQuantity, fixedProof, proofGallons, receivedDate, dspNumber || OUR_DSP, account],
        (err) => {
          if (err) {
            console.error('Transaction Insert Error:', err);
            return res.status(500).json({ error: err.message });
          }
          const dateStr = receivedDate.replace(/-/g, '').slice(2);
          db.get(
            `SELECT COUNT(*) as count FROM transactions WHERE date = ? AND action = 'Received'`,
            [receivedDate],
            (err, row) => {
              if (err) {
                console.error('Serial Number Count Error:', err);
                return res.status(500).json({ error: err.message });
              }
              const serialSuffix = row.count > 0 ? `-${row.count}` : '';
              const serialNumber = `${dateStr}${serialSuffix}`;
              const tankSummary = {
                barrelId,
                type,
                proofGallons,
                proof: fixedProof,
                totalProofGallonsLeft: proofGallons,
                date: receivedDate,
                toAccount: account,
                serialNumber
              };
              console.log('Sending response with tankSummary:', tankSummary);
              res.json({ barrelId, message: 'Item received', tankSummary });
            }
          );
        }
      );
    }
  );
});

// Rest of the endpoints remain unchanged
app.post('/api/update-batch-id', (req, res) => {
  const { oldBatchId, newBatchId } = req.body;
  console.log('Received batch ID update request:', { oldBatchId, newBatchId });

  db.serialize(() => {
    db.run(
      `UPDATE inventory SET barrelId = ? WHERE barrelId = ?`,
      [newBatchId, oldBatchId],
      (err) => {
        if (err) {
          console.error('Inventory Batch ID Update Error:', err);
          return res.status(500).json({ error: err.message });
        }
        db.run(
          `UPDATE transactions SET barrelId = ? WHERE barrelId = ?`,
          [newBatchId, oldBatchId],
          (err) => {
            if (err) {
              console.error('Transaction Batch ID Update Error:', err);
              return res.status(500).json({ error: err.message });
            }
            console.log('Batch ID updated from', oldBatchId, 'to', newBatchId);
            res.json({ message: 'Batch ID updated', batchId: newBatchId });
          }
        );
      }
    );
  });
});

app.post('/api/move', (req, res) => {
  console.log('Received POST to /api/move:', req.body);
  const { barrelId, toAccount, proofGallons } = req.body;
  const movedProofGallons = parseFloat(proofGallons);

  if (!barrelId || !toAccount || isNaN(movedProofGallons) || movedProofGallons <= 0) {
    return res.status(400).json({ error: 'Invalid move request: missing or invalid barrelId, toAccount, or proofGallons' });
  }

  db.get('SELECT * FROM inventory WHERE barrelId = ?', [barrelId], (err, row) => {
    if (err) {
      console.error('DB Select Error:', err);
      return res.status(500).json({ error: err.message });
    }
    if (!row) {
      return res.status(404).json({ error: 'Barrel not found' });
    }

    const originalProofGallons = parseFloat(row.proofGallons);
    if (movedProofGallons > originalProofGallons) {
      return res.status(400).json({ error: 'Cannot move more proof gallons than available' });
    }

    db.serialize(() => {
      db.run('BEGIN TRANSACTION');

      if (movedProofGallons === originalProofGallons) {
        // Full move: Update the existing record
        db.run(
          `UPDATE inventory SET account = ?, proofGallons = ? WHERE barrelId = ?`,
          [toAccount, movedProofGallons.toFixed(2), barrelId],
          (err) => {
            if (err) {
              console.error('Update Moved Error:', err);
              db.run('ROLLBACK');
              return res.status(500).json({ error: err.message });
            }
            db.run(
              `INSERT INTO transactions (barrelId, type, quantity, proofGallons, date, action, dspNumber, toAccount)
               VALUES (?, ?, ?, ?, ?, 'Moved', ?, ?)`,
              [barrelId, row.type, parseFloat(row.quantity), movedProofGallons, new Date().toISOString().split('T')[0], row.dspNumber, toAccount],
              (err) => {
                if (err) {
                  console.error('Transaction Insert Error:', err);
                  db.run('ROLLBACK');
                  return res.status(500).json({ error: err.message });
                }
                db.run('COMMIT');
                const tankSummary = {
                  barrelId,
                  type: row.type,
                  proofGallons: movedProofGallons.toFixed(2),
                  proof: row.proof,
                  totalProofGallonsLeft: '0.00',
                  date: new Date().toISOString().split('T')[0],
                  fromAccount: row.account,
                  toAccount,
                  serialNumber: `${new Date().toISOString().replace(/-/g, '').slice(2)}-${Math.floor(Math.random() * 1000)}`
                };
                console.log('Move successful, tankSummary:', tankSummary);
                res.json({ message: 'Move successful', tankSummary });
              }
            );
          }
        );
      } else {
        // Partial move: Create new records
        const remainingProofGallons = (originalProofGallons - movedProofGallons).toFixed(2);
        const newBarrelId = toAccount === 'Processing'
          ? `${barrelId}-BATCH-${new Date().toISOString().replace(/-/g, '').slice(2, 8)}`
          : `${barrelId}-MOVED-${Date.now()}`;
        db.run(
          `UPDATE inventory SET proofGallons = ? WHERE barrelId = ?`,
          [remainingProofGallons, barrelId],
          (err) => {
            if (err) {
              console.error('Update Remaining Error:', err);
              db.run('ROLLBACK');
              return res.status(500).json({ error: err.message });
            }
            db.run(
              `INSERT INTO inventory (barrelId, account, type, quantity, proof, proofGallons, receivedDate, source, dspNumber)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              [
                newBarrelId,
                toAccount,
                row.type,
                (parseFloat(row.quantity) * (movedProofGallons / originalProofGallons)).toFixed(2),
                row.proof,
                movedProofGallons.toFixed(2),
                new Date().toISOString().split('T')[0],
                row.source,
                row.dspNumber
              ],
              (err) => {
                if (err) {
                  console.error('Insert Moved Error:', err);
                  db.run('ROLLBACK');
                  return res.status(500).json({ error: err.message });
                }
                db.run(
                  `INSERT INTO transactions (barrelId, type, quantity, proofGallons, date, action, dspNumber, toAccount)
                   VALUES (?, ?, ?, ?, ?, 'Moved', ?, ?)`,
                  [
                    newBarrelId,
                    row.type,
                    (parseFloat(row.quantity) * (movedProofGallons / originalProofGallons)).toFixed(2),
                    movedProofGallons,
                    new Date().toISOString().split('T')[0],
                    row.dspNumber,
                    toAccount
                  ],
                  (err) => {
                    if (err) {
                      console.error('Transaction Insert Error:', err);
                      db.run('ROLLBACK');
                      return res.status(500).json({ error: err.message });
                    }
                    db.run('COMMIT');
                    const tankSummary = {
                      barrelId: newBarrelId,
                      type: row.type,
                      proofGallons: movedProofGallons.toFixed(2),
                      proof: row.proof,
                      totalProofGallonsLeft: remainingProofGallons,
                      date: new Date().toISOString().split('T')[0],
                      fromAccount: row.account,
                      toAccount,
                      serialNumber: `${new Date().toISOString().replace(/-/g, '').slice(2)}-${Math.floor(Math.random() * 1000)}`
                    };
                    console.log('Partial move successful, tankSummary:', tankSummary);
                    res.json({ message: 'Partial move successful', tankSummary, batchId: newBarrelId });
                  }
                );
              }
            );
          }
        );
      }
    });
  });
});

app.post('/api/package', (req, res) => {
  const { batchId, product, proofGallons, targetProof, waterVolume, bottleCount, toAccount, date } = req.body;
  console.log('Received package request:', req.body);

  db.get('SELECT * FROM inventory WHERE barrelId = ? AND account = "Processing"', [batchId], (err, row) => {
    if (err) {
      console.error('Inventory Fetch Error:', err);
      return res.status(500).json({ error: err.message });
    }
    if (!row) return res.status(404).json({ error: 'Batch not found in Processing' });
    console.log('Found batch in Processing:', row);

    const fixedProofGallons = Number(proofGallons).toFixed(2);
    const numExistingProofGallons = Number(row.proofGallons);
    const numFixedProofGallons = Number(fixedProofGallons);
    const remainingProofGallons = Number((numExistingProofGallons - numFixedProofGallons).toFixed(2));
    if (remainingProofGallons < 0) return res.status(400).json({ error: 'Insufficient proof gallons' });
    console.log('Calculated values:', { fixedProofGallons, numExistingProofGallons, remainingProofGallons });

    const remainingQuantity = Number(((remainingProofGallons * 100) / row.proof).toFixed(2));
    const packagedQuantity = Number((fixedProofGallons * 100) / targetProof).toFixed(2);
    console.log('Quantities:', { remainingQuantity, packagedQuantity });

    db.serialize(() => {
      db.run(
        `UPDATE inventory SET quantity = ?, proofGallons = ? WHERE barrelId = ? AND account = "Processing"`,
        [remainingQuantity, remainingProofGallons, batchId],
        (err) => {
          if (err) {
            console.error('Update Remaining Error:', err);
            return res.status(500).json({ error: err.message });
          }
          console.log('Updated remaining inventory for batchId:', batchId);
          const newBatchId = `${product.replace(/\s+/g, '')}-${date.replace(/-/g, '')}`;
          db.run(
            `INSERT INTO inventory (barrelId, account, type, quantity, proof, proofGallons, receivedDate, source, dspNumber)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [newBatchId, 'Processing', 'Spirits', packagedQuantity, targetProof, fixedProofGallons, date, row.source || 'Unknown', row.dspNumber || OUR_DSP],
            (err) => {
              if (err) {
                console.error('Insert Finished Goods Error:', err);
                return res.status(500).json({ error: err.message });
              }
              console.log('Inserted new batch in Processing:', newBatchId);
              db.run(
                `INSERT INTO transactions (barrelId, type, quantity, proof, proofGallons, date, action, dspNumber, toAccount)
                 VALUES (?, ?, ?, ?, ?, ?, 'Packaged', ?, ?)`,
                [newBatchId, product, packagedQuantity, targetProof, fixedProofGallons, date, row.dspNumber || OUR_DSP, 'Processing'],
                (err) => {
                  if (err) {
                    console.error('Transaction Insert Error:', err);
                    return res.status(500).json({ error: err.message });
                  }
                  console.log('Recorded packaging transaction for batchId:', newBatchId);
                  res.json({ message: 'Item packaged', batchId: newBatchId });
                }
              );
            }
          );
        }
      );
    });
  });
});

app.get('/api/inventory', (req, res) => {
  console.log('Received GET to /api/inventory');
  db.all('SELECT * FROM inventory', [], (err, rows) => {
    if (err) {
      console.error('DB Select Error:', err);
      return res.status(500).json({ error: err.message });
    }
    console.log('DB rows fetched:', rows);
    const formattedRows = rows.map(row => ({
      ...row,
      quantity: Number(row.quantity).toFixed(2),
      proof: Number(row.proof).toFixed(2),
      proofGallons: Number(row.proofGallons).toFixed(2)
    }));
    console.log('Returning inventory:', formattedRows);
    res.json(formattedRows);
  });
});

app.get('/api/debug-inventory', (req, res) => {
  console.log('Received GET to /api/debug-inventory');
  db.all('SELECT * FROM inventory', [], (err, rows) => {
    if (err) {
      console.error('DB Debug Error:', err);
      return res.status(500).json({ error: err.message });
    }
    console.log('Raw DB inventory:', rows);
    res.json(rows);
  });
});

app.get('/api/report/monthly', (req, res) => {
  const { month } = req.query;
  console.log('Fetching monthly report for:', month);
  db.all(
    `SELECT * FROM transactions WHERE date LIKE ?`,
    [`${month}%`],
    (err, rows) => {
      if (err) {
        console.error('Monthly Report Error:', err);
        return res.status(500).json({ error: err.message });
      }
      const totalReceived = Number(rows.reduce((sum, r) => sum + (r.action === 'Received' ? r.proofGallons : 0), 0).toFixed(2));
      const totalProcessed = Number(rows.reduce((sum, r) => sum + (r.action === 'Moved' && r.toAccount === 'Processing' ? r.proofGallons : 0), 0).toFixed(2));
      const totalMoved = Number(rows.reduce((sum, r) => sum + (r.action === 'Moved' && r.toAccount !== 'Processing' ? r.proofGallons : 0), 0).toFixed(2));
      const totalRemoved = Number(rows.reduce((sum, r) => sum + (r.action === 'Removed' ? r.proofGallons : 0), 0).toFixed(2));
      const byType = rows
        .filter(r => r.action === 'Moved' && r.toAccount === 'Processing')
        .reduce((acc, r) => {
          acc[r.type] = (acc[r.type] || 0) + Number(r.proofGallons);
          return acc;
        }, {});
      res.json({ month, totalReceived, totalProcessed, totalMoved, totalRemoved, byType, transactions: rows });
    }
  );
});

app.get('/api/report/daily', (req, res) => {
  const { date } = req.query;
  console.log('Fetching daily report for:', date);
  db.all(
    `SELECT * FROM transactions WHERE date = ?`,
    [date],
    (err, rows) => {
      if (err) {
        console.error('Daily Report Error:', err);
        return res.status(500).json({ error: err.message });
      }
      const totalReceived = Number(rows.reduce((sum, r) => sum + (r.action === 'Received' ? r.proofGallons : 0), 0).toFixed(2));
      const totalProcessed = Number(rows.reduce((sum, r) => sum + (r.action === 'Moved' && r.toAccount === 'Processing' ? r.proofGallons : 0), 0).toFixed(2));
      const totalMoved = Number(rows.reduce((sum, r) => sum + (r.action === 'Moved' && r.toAccount !== 'Processing' ? r.proofGallons : 0), 0).toFixed(2));
      const totalRemoved = Number(rows.reduce((sum, r) => sum + (r.action === 'Removed' ? r.proofGallons : 0), 0).toFixed(2));
      res.json({ date, totalReceived, totalProcessed, totalMoved, totalRemoved, transactions: rows });
    }
  );
});

app.get('/api/report/tank-summary', (req, res) => {
  const { barrelId } = req.query;
  console.log('Fetching tank summary for:', barrelId);
  db.all(
    `SELECT * FROM transactions WHERE barrelId = ? ORDER BY date`,
    [barrelId],
    (err, rows) => {
      if (err) {
        console.error('Tank Summary Error:', err);
        return res.status(500).json({ error: err.message });
      }
      const currentQuantity = Number(rows.reduce((sum, r) => r.action === 'Received' ? sum + r.quantity : sum - r.quantity, 0).toFixed(2));
      const currentProofGallons = Number(rows.reduce((sum, r) => r.action === 'Received' ? sum + r.proofGallons : sum - r.proofGallons, 0).toFixed(2));
      res.json({ barrelId, transactions: rows, currentQuantity, currentProofGallons });
    }
  );
});

app.get('/api/daily-summary', (req, res) => {
  const today = new Date().toISOString().split('T')[0];
  db.all(
    `SELECT account, SUM(proofGallons) as totalProofGallons
     FROM inventory
     WHERE receivedDate <= ?
     GROUP BY account`,
    [today],
    (err, rows) => {
      if (err) {
        console.error('Daily Summary Error:', err);
        return res.status(500).json({ error: err.message });
      }
      console.log('Daily summary:', rows);
      res.json(rows);
    }
  );
});

app.post('/api/physical-inventory', (req, res) => {
  db.all('SELECT * FROM inventory', [], (err, rows) => {
    if (err) {
      console.error('Physical Inventory Error:', err);
      return res.status(500).json({ error: err.message });
    }
    const timestamp = new Date().toISOString();
    console.log(`Physical inventory at ${timestamp}:`, rows);
    res.json({ message: 'Physical inventory recorded', timestamp, inventory: rows });
  });
});

app.post('/api/record-loss', (req, res) => {
  const { barrelId, quantityLost, proofGallonsLost, reason, date } = req.body;
  db.run(
    `INSERT INTO transactions (barrelId, type, quantity, proofGallons, date, action, toAccount)
     VALUES (?, ?, ?, ?, ?, 'Loss', 'Loss')`,
    [barrelId, 'Spirits', quantityLost, proofGallonsLost, date, reason],
    (err) => {
      if (err) {
        console.error('Loss Insert Error:', err);
        return res.status(500).json({ error: err.message });
      }
      db.run(
        `UPDATE inventory SET quantity = quantity - ?, proofGallons = proofGallons - ? WHERE barrelId = ?`,
        [quantityLost, proofGallonsLost, barrelId],
        (err) => {
          if (err) {
            console.error('Inventory Update Error:', err);
            return res.status(500).json({ error: err.message });
          }
          res.json({ message: 'Loss recorded' });
        }
      );
    }
  );
});

app.use(express.static(path.join(__dirname, '..', 'client', 'build')));
app.get('*', (req, res) => {
  const filePath = path.join(__dirname, '..', 'client', 'build', 'index.html');
  res.sendFile(filePath, (err) => {
    if (err) {
      console.error('Error serving index.html:', err);
      res.status(500).send('Server error: Unable to load the application');
    }
  });
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'client', 'build', 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server started on port ${PORT}`);
});