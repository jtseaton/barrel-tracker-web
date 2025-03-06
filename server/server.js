const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const app = express();

app.use(express.json());
app.use(express.static(path.join(__dirname, '../client/build')));

app.use(express.static(path.join(__dirname, '..', 'client', 'build')));
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'client', 'build', 'index.html'));
});

const OUR_DSP = 'DSP-AL-20010'; // Our DSP number

const db = new sqlite3.Database('barrels.db', (err) => {
  if (err) console.error('DB Error:', err);
  else console.log('Connected to SQLite DB');
});

db.serialize(() => {
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
  db.run(`
    CREATE TABLE IF NOT EXISTS transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      barrelId TEXT,
      type TEXT,
      quantity REAL,
      proof REAL,
      proofGallons REAL,
      date TEXT,
      action TEXT CHECK(action IN ('Received', 'Moved', 'Processed', 'Removed')),
      dspNumber TEXT
    )
  `);
  // Drop old processing_totals, use inventory for report IDs
});

app.post('/api/receive', (req, res) => {
  console.log('Received POST to /api/receive:', req.body);
  const { barrelId, account, type, quantity, proof, source, dspNumber, receivedDate } = req.body;
  const proofGallons = type === 'Spirits' ? (quantity * proof) / 100 : 0;
  db.run(
    `INSERT INTO inventory (barrelId, account, type, quantity, proof, proofGallons, receivedDate, source, dspNumber)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [barrelId, account, type, quantity, proof || 0, proofGallons, receivedDate, source, dspNumber || OUR_DSP],
    function (err) {
      if (err) {
        console.error('DB Insert Error:', err);
        return res.status(500).json({ error: err.message });
      }
      console.log('Inserted into inventory, barrelId:', barrelId);
      db.run(
        `INSERT INTO transactions (barrelId, type, quantity, proof, proofGallons, date, action, dspNumber)
         VALUES (?, ?, ?, ?, ?, ?, 'Received', ?)`,
        [barrelId, type, quantity, proof || 0, proofGallons, receivedDate, dspNumber || OUR_DSP],
        (err) => {
          if (err) {
            console.error('Transaction Insert Error:', err);
            return res.status(500).json({ error: err.message });
          }
          res.json({ barrelId, message: 'Item received' });
        }
      );
    }
  );
});

app.post('/api/move', (req, res) => {
  const { barrelId, toAccount, proofGallons } = req.body;
  const moveDate = new Date().toISOString().split('T')[0];
  console.log('Received move request:', { barrelId, toAccount, proofGallons });

  db.get('SELECT * FROM inventory WHERE barrelId = ?', [barrelId], (err, row) => {
    if (err) {
      console.error('Inventory Fetch Error:', err);
      return res.status(500).json({ error: err.message });
    }
    if (!row) return res.status(404).json({ error: 'Barrel not found' });

    const remainingProofGallons = row.proofGallons - proofGallons;
    if (remainingProofGallons < 0) return res.status(400).json({ error: 'Insufficient proof gallons' });

    const remainingQuantity = row.type === 'Spirits' ? (remainingProofGallons * 100) / row.proof : row.quantity - proofGallons;
    const movedQuantity = row.type === 'Spirits' ? (proofGallons * 100) / row.proof : proofGallons;

    db.serialize(() => {
      // Update original barrel
      db.run(
        `UPDATE inventory SET quantity = ?, proofGallons = ? WHERE barrelId = ?`,
        [remainingQuantity, remainingProofGallons, barrelId],
        (err) => {
          if (err) {
            console.error('Update Remaining Error:', err);
            return res.status(500).json({ error: err.message });
          }
        }
      );

      // Record transaction
      db.run(
        `INSERT INTO transactions (barrelId, type, quantity, proof, proofGallons, date, action, dspNumber)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [toAccount === 'Processing' ? null : barrelId, row.type, movedQuantity, row.proof, proofGallons, moveDate, 'Moved', OUR_DSP],
        (err) => {
          if (err) {
            console.error('Transaction Insert Error:', err);
            return res.status(500).json({ error: err.message });
          }
        }
      );

      // Handle move to Production or Processing
      if (toAccount === 'Production' || toAccount === 'Processing') {
        const reportId = `${OUR_DSP}-${moveDate.slice(2, 7).replace('-', '')}`; // e.g., DSP-AL-20010-2503
        db.get('SELECT * FROM inventory WHERE barrelId = ?', [reportId], (err, existing) => {
          if (err) {
            console.error('Report ID Fetch Error:', err);
            return res.status(500).json({ error: err.message });
          }
          if (existing) {
            db.run(
              `UPDATE inventory SET proofGallons = ? WHERE barrelId = ?`,
              [existing.proofGallons + proofGallons, reportId],
              (err) => {
                if (err) {
                  console.error('Update Report ID Error:', err);
                  return res.status(500).json({ error: err.message });
                }
                console.log('Updated', reportId, 'with', proofGallons, 'PG');
                res.json({ message: 'Item moved', barrelId });
              }
            );
          } else {
            db.run(
              `INSERT INTO inventory (barrelId, account, type, quantity, proof, proofGallons, receivedDate, source, dspNumber)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              [reportId, toAccount, row.type, movedQuantity, row.proof, proofGallons, moveDate, OUR_DSP, OUR_DSP],
              (err) => {
                if (err) {
                  console.error('Insert Report ID Error:', err);
                  return res.status(500).json({ error: err.message });
                }
                console.log('Moved', proofGallons, 'PG from', barrelId, 'to', reportId);
                res.json({ message: 'Item moved', barrelId });
              }
            );
          }
        });
      } else {
        // Storage moves keep barrelId
        db.run(
          `INSERT INTO inventory (barrelId, account, type, quantity, proof, proofGallons, receivedDate, source, dspNumber)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [barrelId + '-moved', toAccount, row.type, movedQuantity, row.proof, proofGallons, row.receivedDate, row.source, OUR_DSP],
          (err) => {
            if (err) {
              console.error('Insert Moved Error:', err);
              return res.status(500).json({ error: err.message });
            }
            console.log('Moved', proofGallons, 'PG from', barrelId, 'to', toAccount);
            res.json({ message: 'Item moved', barrelId });
          }
        );
      }
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
    console.log('Inventory rows:', rows);
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
      const totalReceived = rows.reduce((sum, r) => sum + (r.action === 'Received' ? r.proofGallons : 0), 0);
      const totalProcessed = rows.reduce((sum, r) => sum + (r.action === 'Moved' && r.barrelId === null ? r.proofGallons : 0), 0);
      const totalMoved = rows.reduce((sum, r) => sum + (r.action === 'Moved' && r.barrelId !== null ? r.proofGallons : 0), 0);
      const totalRemoved = rows.reduce((sum, r) => sum + (r.action === 'Removed' ? r.proofGallons : 0), 0);
      console.log('Monthly report data:', { month, totalReceived, totalProcessed, totalMoved, totalRemoved });
      res.json({ month, totalReceived, totalProcessed, totalMoved, totalRemoved, transactions: rows });
    }
  );
});

// Other endpoints unchanged...
app.listen(3000, () => console.log('Server running on port 3000'));
