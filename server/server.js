const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const basicAuth = require('express-basic-auth');

const app = express();

app.use(express.json());
app.use(basicAuth({ users: { 'admin': 'yourpassword' }, challenge: true })); // Replace 'yourpassword'
app.use(express.static(path.join(__dirname, '../client/build')));

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
      dspNumber TEXT,
      toAccount TEXT
    )
  `);
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

    const fixedProofGallons = Number(proofGallons).toFixed(2);
    const numExistingProofGallons = Number(row.proofGallons);
    const numFixedProofGallons = Number(fixedProofGallons);
    const remainingProofGallons = Number((numExistingProofGallons - numFixedProofGallons).toFixed(2));
    if (remainingProofGallons < 0) return res.status(400).json({ error: 'Insufficient proof gallons' });

    const remainingQuantity = row.type === 'Spirits' ? Number(((remainingProofGallons * 100) / row.proof).toFixed(2)) : Number((row.quantity - numFixedProofGallons).toFixed(2));
    const movedQuantity = row.type === 'Spirits' ? Number(((numFixedProofGallons * 100) / row.proof).toFixed(2)) : Number(numFixedProofGallons);

    db.serialize(() => {
      db.run(
        `UPDATE inventory SET quantity = ?, proofGallons = ? WHERE barrelId = ?`,
        [remainingQuantity, remainingProofGallons, barrelId],
        (err) => {
          if (err) {
            console.error('Update Remaining Error:', err);
            return res.status(500).json({ error: err.message });
          }
          db.run(
            `INSERT INTO transactions (barrelId, type, quantity, proof, proofGallons, date, action, dspNumber, toAccount)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [toAccount === 'Processing' ? null : barrelId, row.type, movedQuantity, row.proof, fixedProofGallons, moveDate, 'Moved', OUR_DSP, toAccount],
            (err) => {
              if (err) {
                console.error('Transaction Insert Error:', err);
                return res.status(500).json({ error: err.message });
              }

              if (toAccount === 'Production' || toAccount === 'Processing') {
                const reportId = `${OUR_DSP}-${moveDate.slice(2, 7).replace('-', '')}`;
                db.get('SELECT * FROM inventory WHERE barrelId = ?', [reportId], (err, existing) => {
                  if (err) {
                    console.error('Report ID Fetch Error:', err);
                    return res.status(500).json({ error: err.message });
                  }
                  if (existing) {
                    const updatedProofGallons = Number((Number(existing.proofGallons) + numFixedProofGallons).toFixed(2));
                    db.run(
                      `UPDATE inventory SET proofGallons = ? WHERE barrelId = ?`,
                      [updatedProofGallons, reportId],
                      (err) => {
                        if (err) {
                          console.error('Update Report ID Error:', err);
                          return res.status(500).json({ error: err.message });
                        }
                        const tankSummary = {
                          barrelId,
                          type: row.type,
                          proofGallons: fixedProofGallons,
                          date: moveDate,
                          fromAccount: row.account,
                          toAccount
                        };
                        console.log('Sending response with tankSummary:', tankSummary);
                        res.json({ message: 'Item moved', barrelId, tankSummary });
                      }
                    );
                  } else {
                    db.run(
                      `INSERT INTO inventory (barrelId, account, type, quantity, proof, proofGallons, receivedDate, source, dspNumber)
                       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                      [reportId, toAccount, row.type, movedQuantity, row.proof, fixedProofGallons, moveDate, OUR_DSP, OUR_DSP],
                      (err) => {
                        if (err) {
                          console.error('Insert Report ID Error:', err);
                          return res.status(500).json({ error: err.message });
                        }
                        const tankSummary = {
                          barrelId,
                          type: row.type,
                          proofGallons: fixedProofGallons,
                          date: moveDate,
                          fromAccount: row.account,
                          toAccount
                        };
                        console.log('Sending response with tankSummary:', tankSummary);
                        res.json({ message: 'Item moved', barrelId, tankSummary });
                      }
                    );
                  }
                });
              } else {
                db.run(
                  `INSERT INTO inventory (barrelId, account, type, quantity, proof, proofGallons, receivedDate, source, dspNumber)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                  [barrelId + '-moved', toAccount, row.type, movedQuantity, row.proof, fixedProofGallons, row.receivedDate, row.source, OUR_DSP],
                  (err) => {
                    if (err) {
                      console.error('Insert Moved Error:', err);
                      return res.status(500).json({ error: err.message });
                    }
                    const tankSummary = {
                      barrelId,
                      type: row.type,
                      proofGallons: fixedProofGallons,
                      date: moveDate,
                      fromAccount: row.account,
                      toAccount
                    };
                    console.log('Sending response with tankSummary:', tankSummary);
                    res.json({ message: 'Item moved', barrelId, tankSummary });
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

app.get('/api/inventory', (req, res) => {
  console.log('Received GET to /api/inventory');
  db.all('SELECT * FROM inventory', [], (err, rows) => {
    if (err) {
      console.error('DB Select Error:', err);
      return res.status(500).json({ error: err.message });
    }
    const formattedRows = rows.map(row => ({
      ...row,
      quantity: Number(row.quantity).toFixed(2),
      proof: Number(row.proof).toFixed(2),
      proofGallons: Number(row.proofGallons).toFixed(2)
    }));
    res.json(formattedRows);
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

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'client', 'build', 'index.html'));
});

app.listen(process.env.PORT || 3000, '0.0.0.0', () => console.log('Server started'));