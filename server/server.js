const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const app = express();

const OUR_DSP = 'DSP-AL-20010';

app.use(express.json());
app.use(express.static(path.join(__dirname, '../client/build')));

app.use((req, res, next) => {
  console.log(`Incoming request: ${req.method} ${req.url}`);
  next();
});

const db = new sqlite3.Database(':memory:', (err) => {
  if (err) {
    console.error('Database connection error:', err);
  } else {
    console.log('Connected to SQLite database');
  }
});

db.serialize(() => {
  db.run(`
    CREATE TABLE inventory (
      identifier TEXT,          -- Lot number, barrel ID, or SKU
      account TEXT,             -- Storage, Production, etc.
      type TEXT,                -- Grain, Yeast, Spirits, Bottles, etc.
      quantity TEXT,            -- Numeric value (lbs, gallons, count)
      unit TEXT,                -- lbs, gallons, count
      proof TEXT,               -- Only for Spirits
      proofGallons TEXT,        -- Only for Spirits
      receivedDate TEXT,
      source TEXT,
      dspNumber TEXT,
      status TEXT
    )
  `);
  db.run(`
    CREATE TABLE transactions (
      barrelId TEXT,
      type TEXT,
      quantity REAL,
      proofGallons REAL,
      date TEXT,
      action TEXT,
      dspNumber TEXT,
      toAccount TEXT
    )
  `);
  db.run('INSERT INTO inventory (identifier, account, type, quantity, unit, proof, proofGallons, receivedDate, source, dspNumber, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [
    '47388958', 'Storage', 'Spirits', '55', 'gallons', '190', '104.50', '2025-03-08', 'DSP-KY-417', OUR_DSP, 'Received'
  ]);
});

app.get('/api/inventory', (req, res) => {
  db.all('SELECT * FROM inventory', (err, rows) => {
    if (err) {
      console.error('DB Select Error:', err);
      return res.status(500).json({ error: err.message });
    }
    res.json(rows);
  });
});

app.post('/api/receive', (req, res) => {
  console.log('Received POST to /api/receive:', req.body);
  const {
    identifier, // Optional: lot number, barrel ID, or SKU
    account,
    type,
    quantity,
    unit,       // Added: lbs, gallons, count
    proof,      // Optional: only for Spirits
    proofGallons, // Optional: calculated or provided for Spirits
    receivedDate,
    source,
    dspNumber,
    status,
  } = req.body;

  // Validation: Core required fields (27 CFR 19.321)
  if (!account || !type || !quantity || !unit || !receivedDate || !dspNumber || !status) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const parsedQuantity = parseFloat(quantity);
  const parsedProof = proof ? parseFloat(proof) : null;
  if (isNaN(parsedQuantity) || parsedQuantity <= 0) {
    return res.status(400).json({ error: 'Invalid quantity' });
  }
  if (type === 'Spirits') {
    if (!parsedProof || parsedProof > 200 || parsedProof < 0) {
      return res.status(400).json({ error: 'Spirits require valid proof (0-200)' });
    }
    if (!identifier) {
      return res.status(400).json({ error: 'Spirits require an identifier (e.g., barrel ID)' });
    }
  }

  // Calculate proof gallons for Spirits
  let finalProofGallons = '0.00';
  if (type === 'Spirits') {
    const calculatedProofGallons = (parsedQuantity * (parsedProof / 100)).toFixed(2);
    finalProofGallons = proofGallons || calculatedProofGallons;
    if (proofGallons && parseFloat(proofGallons) !== parseFloat(calculatedProofGallons)) {
      return res.status(400).json({ error: 'Provided proofGallons does not match calculated value' });
    }
  }

  const inventoryItem = [
    identifier || null,
    account,
    type,
    parsedQuantity.toString(),
    unit,
    type === 'Spirits' ? parsedProof.toString() : null,
    type === 'Spirits' ? finalProofGallons : null,
    receivedDate,
    source || 'Unknown',
    dspNumber,
    status,
  ];

  db.run(
    `INSERT INTO inventory (identifier, account, type, quantity, unit, proof, proofGallons, receivedDate, source, dspNumber, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    inventoryItem,
    function (err) {
      if (err) {
        console.error('Insert Receive Error:', err);
        return res.status(500).json({ error: err.message });
      }

      // Log transaction (27 CFR 19.571)
      const transaction = [
        identifier || `LOT-${Date.now()}`,
        type,
        parsedQuantity,
        type === 'Spirits' ? parseFloat(finalProofGallons) : 0,
        receivedDate,
        'Received',
        dspNumber,
        account,
      ];
      db.run(
        `INSERT INTO transactions (barrelId, type, quantity, proofGallons, date, action, dspNumber, toAccount)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        transaction,
        (err) => {
          if (err) {
            console.error('Transaction Insert Error:', err);
            return res.status(500).json({ error: 'Inventory saved, but transaction logging failed: ' + err.message });
          }

          // Tank summary only for Spirits
          let tankSummary = null;
          if (type === 'Spirits') {
            tankSummary = {
              barrelId: identifier,
              type,
              proofGallons: finalProofGallons,
              proof: parsedProof.toString(),
              totalProofGallonsLeft: finalProofGallons,
              date: receivedDate,
              fromAccount: 'External',
              toAccount: account,
              serialNumber: `${receivedDate.replace(/-/g, '')}-${Math.floor(Math.random() * 1000)}`,
              producingDSP: dspNumber,
            };
          }

          res.status(201).json({
            message: 'Receive successful',
            item: {
              identifier,
              account,
              type,
              quantity: parsedQuantity.toString(),
              unit,
              proof: type === 'Spirits' ? parsedProof.toString() : null,
              proofGallons: type === 'Spirits' ? finalProofGallons : null,
              receivedDate,
              source: source || 'Unknown',
              dspNumber,
              status,
            },
            ...(tankSummary ? { tankSummary } : {}),
          });
        }
      );
    }
  );
});

app.post('/api/produce', (req, res) => {
  console.log('Received POST to /api/produce:', req.body);
  const { identifier, type, proofGallons, date } = req.body;

  if (!identifier || !type || !proofGallons || !date) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const parsedProofGallons = parseFloat(proofGallons);
  if (isNaN(parsedProofGallons) || parsedProofGallons <= 0) {
    return res.status(400).json({ error: 'Invalid proof gallons' });
  }

  db.run(
    `INSERT INTO inventory (identifier, account, type, proof, proofGallons, receivedDate, source, dspNumber, status)
     VALUES (?, 'Production', ?, '100', ?, ?, 'N/A', ?, ?)`,
    [identifier, type, proofGallons, date, OUR_DSP, 'Distilled'],
    (err) => {
      if (err) {
        console.error('Insert Production Error:', err);
        return res.status(500).json({ error: err.message });
      }
      db.run(
        `INSERT INTO transactions (barrelId, type, proofGallons, date, action, dspNumber)
         VALUES (?, ?, ?, ?, 'Produced', ?)`,
        [identifier, type, proofGallons, date, OUR_DSP],
        (err) => {
          if (err) {
            console.error('Transaction Insert Error:', err);
            return res.status(500).json({ error: err.message });
          }
          res.json({ message: 'Production gauged successfully', identifier });
        }
      );
    }
  );
});

app.post('/api/move', (req, res) => {
  console.log('Received POST to /api/move:', req.body);
  const { identifier, toAccount, proofGallons } = req.body;
  const movedProofGallons = parseFloat(proofGallons);

  if (!identifier || !toAccount || isNaN(movedProofGallons) || movedProofGallons <= 0) {
    return res.status(400).json({ error: 'Invalid move request: missing or invalid identifier, toAccount, or proofGallons' });
  }

  db.get('SELECT * FROM inventory WHERE identifier = ?', [identifier], (err, row) => {
    if (err) {
      console.error('DB Select Error:', err);
      return res.status(500).json({ error: err.message });
    }
    if (!row) {
      return res.status(404).json({ error: 'Item not found' });
    }

    const originalProofGallons = parseFloat(row.proofGallons);
    if (movedProofGallons > originalProofGallons) {
      return res.status(400).json({ error: 'Cannot move more proof gallons than available' });
    }

    db.serialize(() => {
      db.run('BEGIN TRANSACTION');

      if (movedProofGallons === originalProofGallons) {
        db.run(
          `UPDATE inventory SET account = ?, proofGallons = ? WHERE identifier = ?`,
          [toAccount, movedProofGallons.toFixed(2), identifier],
          (err) => {
            if (err) {
              console.error('Update Moved Error:', err);
              db.run('ROLLBACK');
              return res.status(500).json({ error: err.message });
            }
            db.run(
              `INSERT INTO transactions (barrelId, type, quantity, proofGallons, date, action, dspNumber, toAccount)
               VALUES (?, ?, ?, ?, ?, 'Moved', ?, ?)`,
              [identifier, row.type, parseFloat(row.quantity), movedProofGallons, new Date().toISOString().split('T')[0], row.dspNumber, toAccount],
              (err) => {
                if (err) {
                  console.error('Transaction Insert Error:', err);
                  db.run('ROLLBACK');
                  return res.status(500).json({ error: err.message });
                }
                db.run('COMMIT');
                const tankSummary = {
                  barrelId: identifier,
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
        const remainingProofGallons = (originalProofGallons - movedProofGallons).toFixed(2);
        const newBarrelId = toAccount === 'Processing'
          ? `${identifier}-BATCH-${new Date().toISOString().replace(/-/g, '').slice(2, 8)}`
          : `${identifier}-MOVED-${Date.now()}`;
        db.run(
          `UPDATE inventory SET proofGallons = ? WHERE identifier = ?`,
          [remainingProofGallons, identifier],
          (err) => {
            if (err) {
              console.error('Update Remaining Error:', err);
              db.run('ROLLBACK');
              return res.status(500).json({ error: err.message });
            }
            db.run(
              `INSERT INTO inventory (identifier, account, type, quantity, proof, proofGallons, receivedDate, source, dspNumber, status)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              [
                newBarrelId,
                toAccount,
                row.type,
                (parseFloat(row.quantity) * (movedProofGallons / originalProofGallons)).toFixed(2),
                row.proof,
                movedProofGallons.toFixed(2),
                new Date().toISOString().split('T')[0],
                row.source,
                row.dspNumber,
                toAccount === 'Processing' ? 'Processing' : 'Stored'
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
  console.log('Received POST to /api/package:', req.body);
  const { batchId, product, proofGallons, targetProof, waterVolume, bottleCount, netContents, alcoholContent, healthWarning, toAccount, date } = req.body;

  if (!batchId || !product || !proofGallons || !targetProof || !waterVolume || !bottleCount || !netContents || !alcoholContent || !healthWarning || !toAccount || !date) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  db.get('SELECT * FROM inventory WHERE identifier = ?', [batchId], (err, row) => {
    if (err) {
      console.error('DB Select Error:', err);
      return res.status(500).json({ error: err.message });
    }
    if (!row) {
      return res.status(404).json({ error: 'Batch not found' });
    }

    const newBatchId = `${product.replace(/\s+/g, '')}-${date.replace(/-/g, '')}`;
    db.run(
      `INSERT INTO inventory (identifier, account, type, quantity, proof, proofGallons, receivedDate, source, dspNumber, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'Packaged')`,
      [newBatchId, toAccount, product, bottleCount, targetProof, proofGallons, date, row.source, row.dspNumber],
      (err) => {
        if (err) {
          console.error('Insert Package Error:', err);
          return res.status(500).json({ error: err.message });
        }
        db.run(
          `INSERT INTO transactions (barrelId, type, quantity, proofGallons, date, action, dspNumber)
           VALUES (?, ?, ?, ?, ?, 'Packaged', ?)`,
          [newBatchId, product, bottleCount, proofGallons, date, row.dspNumber],
          (err) => {
            if (err) {
              console.error('Transaction Insert Error:', err);
              return res.status(500).json({ error: err.message });
            }
            res.json({ message: 'Package successful' });
          }
        );
      }
    );
  });
});

app.post('/api/record-loss', (req, res) => {
  console.log('Received POST to /api/record-loss:', req.body);
  const { identifier, quantityLost, proofGallonsLost, reason, date } = req.body;

  if (!identifier || !quantityLost || !proofGallonsLost || !reason || !date) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  db.run(
    `INSERT INTO transactions (barrelId, type, quantity, proofGallons, date, action, dspNumber)
     VALUES (?, 'Loss', ?, ?, ?, 'Loss', ?)`,
    [identifier, quantityLost, proofGallonsLost, date, OUR_DSP],
    (err) => {
      if (err) {
        console.error('Transaction Insert Error:', err);
        return res.status(500).json({ error: err.message });
      }
      res.json({ message: 'Loss recorded' });
    }
  );
});

app.post('/api/update-batch-id', (req, res) => {
  console.log('Received POST to /api/update-batch-id:', req.body);
  const { oldBatchId, newBatchId } = req.body;

  if (!oldBatchId || !newBatchId) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  db.run(
    `UPDATE inventory SET identifier = ? WHERE identifier = ?`,
    [newBatchId, oldBatchId],
    (err) => {
      if (err) {
        console.error('Update Batch ID Error:', err);
        return res.status(500).json({ error: err.message });
      }
      res.json({ message: 'Batch ID updated' });
    }
  );
});

app.post('/api/physical-inventory', (req, res) => {
  const timestamp = new Date().toISOString();
  res.json({ message: 'Physical inventory recorded', timestamp });
});

app.get('/api/daily-summary', (req, res) => {
  db.all('SELECT account, SUM(proofGallons) as totalProofGallons FROM inventory GROUP BY account', (err, rows) => {
    if (err) {
      console.error('DB Select Error:', err);
      return res.status(500).json({ error: err.message });
    }
    res.json(rows);
  });
});

app.get('/api/report/monthly', (req, res) => {
  const { month } = req.query;
  if (!month) {
    return res.status(400).json({ error: 'Month parameter is required' });
  }

  const startDate = `${month}-01`;
  const endDate = `${month}-31`;

  db.all(
    `SELECT * FROM transactions WHERE date BETWEEN ? AND ?`,
    [startDate, endDate],
    (err, transactions) => {
      if (err) {
        console.error('DB Select Error:', err);
        return res.status(500).json({ error: err.message });
      }

      let totalReceived = 0;
      let totalProcessed = 0;
      let totalMoved = 0;
      let totalRemoved = 0;
      const byType = {};

      transactions.forEach((tx) => {
        const proofGallons = parseFloat(tx.proofGallons);
        if (tx.action === 'Received') totalReceived += proofGallons;
        if (tx.action === 'Packaged') totalProcessed += proofGallons;
        if (tx.action === 'Moved') totalMoved += proofGallons;
        if (tx.action === 'Loss') totalRemoved += proofGallons;
        if (tx.action === 'Packaged') {
          byType[tx.type] = (byType[tx.type] || 0) + proofGallons;
        }
      });

      res.json({
        month,
        totalReceived,
        totalProcessed,
        totalMoved,
        totalRemoved,
        byType,
        transactions
      });
    }
  );
});

app.get('/api/report/daily', (req, res) => {
  const { date } = req.query;
  if (!date) {
    return res.status(400).json({ error: 'Date parameter is required' });
  }

  db.all(
    `SELECT * FROM transactions WHERE date = ?`,
    [date],
    (err, transactions) => {
      if (err) {
        console.error('DB Select Error:', err);
        return res.status(500).json({ error: err.message });
      }

      let totalReceived = 0;
      let totalProcessed = 0;
      const byType = {};

      transactions.forEach((tx) => {
        const proofGallons = parseFloat(tx.proofGallons);
        if (tx.action === 'Received') totalReceived += proofGallons;
        if (tx.action === 'Packaged') totalProcessed += proofGallons;
        if (tx.action === 'Packaged') {
          byType[tx.type] = (byType[tx.type] || 0) + proofGallons;
        }
      });

      res.json({
        date,
        totalReceived,
        totalProcessed,
        byType,
        transactions
      });
    }
  );
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/build', 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});