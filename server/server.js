const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const xml2js = require('xml2js');
const nodemailer = require('nodemailer');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../client/build')));

const db = new sqlite3.Database(':memory:', (err) => {
  if (err) console.error('Database connection error:', err);
  else console.log('Connected to SQLite database');
});

const OUR_DSP = 'DSP-AL-20010';

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS inventory (
      identifier TEXT,
      account TEXT,
      type TEXT,
      quantity TEXT,
      unit TEXT,
      proof TEXT,
      proofGallons TEXT,
      receivedDate TEXT,
      source TEXT,
      dspNumber TEXT,           -- Legacy, can phase out if siteId replaces it
      siteId TEXT,
      locationId INTEGER,
      status TEXT,
      description TEXT,
      cost TEXT,
      totalCost REAL DEFAULT 0,
      UNIQUE(identifier, type, account, siteId),
      FOREIGN KEY (siteId) REFERENCES sites(siteId),
      FOREIGN KEY (locationId) REFERENCES locations(locationId)
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS items (
      name TEXT PRIMARY KEY,
      type TEXT,
      enabled INTEGER DEFAULT 1
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS transactions (
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
  db.run(`
    CREATE TABLE IF NOT EXISTS vendors (
      name TEXT PRIMARY KEY,
      type TEXT,
      enabled INTEGER DEFAULT 1,
      address TEXT,
      email TEXT,
      phone TEXT
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS purchase_orders (
      poNumber TEXT PRIMARY KEY,
      site TEXT,
      poDate TEXT,
      supplier TEXT,
      supplierAddress TEXT,
      supplierCity TEXT,
      supplierState TEXT,
      supplierZip TEXT,
      comments TEXT,
      shipToName TEXT,
      shipToAddress TEXT,
      shipToCity TEXT,
      shipToState TEXT,
      shipToZip TEXT,
      status TEXT DEFAULT 'Open',
      items TEXT  -- JSON string of items
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS sites (
      siteId TEXT PRIMARY KEY,  -- e.g., DSP-AL-20010, BREW-BHM-001
      name TEXT NOT NULL,       -- e.g., Athens AL DSP
      type TEXT,                -- e.g., DSP, Brewery
      address TEXT,
      enabled INTEGER DEFAULT 1
    )
  `);
  
  db.run(`
    CREATE TABLE IF NOT EXISTS locations (
      locationId INTEGER PRIMARY KEY AUTOINCREMENT,
      siteId TEXT,
      name TEXT NOT NULL,
      abbreviation TEXT, -- Added
      enabled INTEGER DEFAULT 1,
      FOREIGN KEY (siteId) REFERENCES sites(siteId)
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS equipment (
      equipmentId INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT,
      siteId TEXT,
      abbreviation TEXT, -- Added
      enabled INTEGER,
      FOREIGN KEY (siteId) REFERENCES sites(siteId)
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS facility_designs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      siteId TEXT NOT NULL,
      objects TEXT NOT NULL, -- JSON string of objects
      createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
      updatedAt TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (siteId) REFERENCES sites(siteId)
    )
  `);
  db.run(`ALTER TABLE locations ADD COLUMN abbreviation TEXT`, (err) => {
    if (err && !err.message.includes('duplicate column')) {
      console.error('Error adding abbreviation column:', err);
    } else {
      console.log('Added abbreviation column to locations');
    }
  });
  db.run(`INSERT OR IGNORE INTO sites (siteId, name, type, address) VALUES (?, ?, ?, ?)`, 
  ['DSP-AL-20051', 'Athens AL DSP', 'DSP', '311 Marion St, Athens, AL 35611']);
  db.run(`INSERT OR IGNORE INTO sites (siteId, name, type, address) VALUES (?, ?, ?, ?)`, 
  ['BR-AL-20088', 'Athens Brewery', 'Brewery', '311 Marion St, Athens, AL 35611']);
  db.run(`INSERT OR IGNORE INTO sites (siteId, name, type, address) VALUES (?, ?, ?, ?)`, 
  ['BR-AL-20019', 'Madison Brewery', 'Brewery', '212 Main St Madison, AL 35758']);
  db.run(`INSERT OR IGNORE INTO sites (siteId, name, type, address) VALUES (?, ?, ?, ?)`, 
  ['DSP-AL-20010', 'Madison Distillery', 'DSP', '212 Main St Madison, AL 35758']);
  db.run(`INSERT OR IGNORE INTO locations (siteId, name) VALUES (?, ?)`, 
  ['DSP-AL-20010', 'Spirits Storage']);
  db.run(`INSERT OR IGNORE INTO locations (siteId, name) VALUES (?, ?)`, 
  ['DSP-AL-20010', 'Grain Storage']);
  db.run(`INSERT OR IGNORE INTO locations (siteId, name) VALUES (?, ?)`, 
  ['DSP-AL-20010', 'Fermentation Tanks']);
  db.run('INSERT OR IGNORE INTO locations (siteId, name) VALUES (?, ?)',
  ['BR-AL-20019', 'Madison Fermenter 1']);
  db.run('INSERT OR IGNORE INTO locations (siteId, name) VALUES (?, ?)',
  ['BR-AL-20019', 'Madison Fermenter 2']);
  db.run('INSERT OR IGNORE INTO locations (siteId, name) VALUES (?, ?)',
  ['BR-AL-20019', 'Madison Fermenter 3']);
  db.run('INSERT OR IGNORE INTO locations (siteId, name) VALUES (?, ?)',
  ['BR-AL-20019', 'Madison Fermenter 4']);
  db.run('INSERT OR IGNORE INTO locations (siteId, name) VALUES (?, ?)',
  ['BR-AL-20019', 'Madison Cold Storage']);
  db.run('INSERT OR IGNORE INTO locations (siteId, name) VALUES (?, ?)',
  ['BR-AL-20019', 'Madison Mash Tun']);
  db.run('INSERT OR IGNORE INTO locations (siteId, name) VALUES (?, ?)',
  ['BR-AL-20019', 'Madison Boil Kettle']); 
  db.run(`INSERT OR IGNORE INTO locations (siteId, name, abbreviation) VALUES (?, ?, ?)`, 
  ['BR-AL-20088', 'Athens Cold Storage', 'Athens Cooler'], (err) => {
    if (err) console.error('Insert error:', err);
    else console.log('Inserted: Athens Cold Storage, abbreviation=Athens Cooler, BR-AL-20088');
}); 
  db.run(`UPDATE locations SET abbreviation = ? WHERE name = ? AND siteId = ?`, 
    ['Beer Cooler', 'Madison Cold Storage', 'BR-AL-20019'], (err) => {
      if (err) console.error('Update error:', err);
      else console.log('Updated: Madison Cold Storage, abbreviation=Beer Cooler');
  });
  db.run(`UPDATE locations SET abbreviation = ? WHERE name = ? AND siteId = ?`, 
    ['Mash Tun', 'Madison Mash Tun', 'BR-AL-20019'], (err) => {
      if (err) console.error('Update error:', err);
      else console.log('Updated: Madison Mash Tun, abbreviation=Mash Tun');
  });
  db.run(`UPDATE locations SET abbreviation = ? WHERE name = ? AND siteId = ?`, 
    ['Spirits', 'Spirits Storage', 'DSP-AL-20010'], (err) => {
      if (err) console.error('Update error:', err);
      else console.log('Updated: Spirits Storage, abbreviation=Spirits');
  });
  db.run(`UPDATE locations SET abbreviation = ? WHERE name = ? AND siteId = ?`, 
    ['Athens Cooler', 'Athens Cold Storage', 'BR-AL-20088'], (err) => {
      if (err) console.error('Update error:', err);
      else console.log('Updated: Athens Cold Storage, abbreviation=Athens Cooler');
  });
  db.run(`ALTER TABLE inventory ADD COLUMN totalCost REAL DEFAULT 0`, (err) => {
    if (err && !err.message.includes('duplicate column')) console.error('Error adding totalCost:', err);
  });

  // Migrate existing data (run once, then comment out or remove)
  db.run(`ALTER TABLE purchase_orders ADD COLUMN status TEXT DEFAULT 'Open'`, (err) => {
   if (err && !err.message.includes('duplicate column')) {
      console.error('Error adding status column:', err);
   } 
  });

  db.run('INSERT OR IGNORE INTO vendors (name, type, enabled, address, email, phone) VALUES (?, ?, ?, ?, ?, ?)', 
    ['Acme Supplies', 'Supplier', 1, '123 Main St', 'acme@example.com', '555-1234']);
  });

const loadItemsFromXML = () => {
  fs.readFile(path.join(__dirname, '../config/items.xml'), 'utf8', (err, data) => {
    if (err) {
      console.error('Error reading items.xml:', err);
      return;
    }
    xml2js.parseString(data, (err, result) => {
      if (err) {
        console.error('Error parsing items.xml:', err);
        return;
      }
      const items = result.items.item || [];
      items.forEach((item) => {
        const attributes = item.$ || {};
        const name = String(attributes.name || '').replace(/[^a-zA-Z0-9\s]/g, '');
        const type = String(attributes.type || 'Other').replace(/[^a-zA-Z0-9\s]/g, '');
        const enabled = parseInt(attributes.enabled || '1', 10) || 1;
        db.run(
          'INSERT OR IGNORE INTO items (name, type, enabled) VALUES (?, ?, ?)',
          [name, type, enabled],
          (err) => {
            if (err) console.error(`Error inserting item ${name}:`, err);
          }
        );
      });
    });
  });
};

loadItemsFromXML();

// Items endpoints
app.get('/api/items', (req, res) => {
  db.all('SELECT name, type, enabled FROM items', (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.get('/api/items/:name', (req, res) => {
  const { name } = req.params;
  db.get('SELECT name, enabled FROM items WHERE name = ?', [name], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!row) return res.status(404).json({ error: 'Item not found' });
    res.json(row);
  });
});

app.post('/api/items', (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'Item name is required' });
  db.run('INSERT OR IGNORE INTO items (name, enabled) VALUES (?, 1)', [name], (err) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: 'Item created successfully', name });
  });
});

app.put('/api/items', (req, res) => {
  const { oldName, newName } = req.body;
  if (!oldName || !newName) return res.status(400).json({ error: 'Old and new item names are required' });
  db.run('UPDATE items SET name = ? WHERE name = ?', [newName, oldName], (err) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: 'Item updated successfully', oldName, newName });
  });
});

app.delete('/api/items', (req, res) => {
  const { names } = req.body;
  if (!names || !Array.isArray(names) || names.length === 0) return res.status(400).json({ error: 'Array of item names is required' });
  const placeholders = names.map(() => '?').join(',');
  db.run(`DELETE FROM items WHERE name IN (${placeholders})`, names, (err) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: 'Items deleted successfully', deleted: names });
  });
});

app.patch('/api/items', (req, res) => {
  const { names, enabled } = req.body;
  if (!names || !Array.isArray(names) || names.length === 0 || typeof enabled !== 'boolean') return res.status(400).json({ error: 'Array of item names and enabled boolean are required' });
  const placeholders = names.map(() => '?').join(',');
  db.run(`UPDATE items SET enabled = ? WHERE name IN (${placeholders})`, [enabled ? 1 : 0, ...names], (err) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: `Items ${enabled ? 'enabled' : 'disabled'} successfully`, updated: names });
  });
});

// Vendors endpoints
app.get('/api/vendors', (req, res) => {
  db.all('SELECT name, enabled FROM vendors', (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.get('/api/vendors/:name', (req, res) => {
  const { name } = req.params;
  db.get('SELECT * FROM vendors WHERE name = ?', [name], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!row) return res.status(404).json({ error: 'Vendor not found' });
    res.json(row);
  });
});

app.post('/api/vendors', (req, res) => {
  const { name, type, enabled, address, email, phone } = req.body;
  if (!name) return res.status(400).json({ error: 'Vendor name is required' });
  db.run(
    'INSERT OR IGNORE INTO vendors (name, type, enabled, address, email, phone) VALUES (?, ?, ?, ?, ?, ?)',
    [name, type || 'Supplier', enabled !== undefined ? enabled : 1, address || '', email || '', phone || ''],
    (err) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ message: 'Vendor created successfully', name });
    }
  );
});

app.put('/api/vendors', (req, res) => {
  const { oldName, newVendor } = req.body;
  if (!oldName || !newVendor || !newVendor.name) return res.status(400).json({ error: 'Old name and new vendor details are required' });
  db.run(
    'UPDATE vendors SET name = ?, type = ?, enabled = ?, address = ?, email = ?, phone = ? WHERE name = ?',
    [newVendor.name, newVendor.type, newVendor.enabled, newVendor.address, newVendor.email, newVendor.phone, oldName],
    (err) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ message: 'Vendor updated successfully', oldName, newName: newVendor.name });
    }
  );
});

app.delete('/api/vendors', (req, res) => {
  const { names } = req.body;
  if (!names || !Array.isArray(names) || names.length === 0) return res.status(400).json({ error: 'Array of vendor names is required' });
  const placeholders = names.map(() => '?').join(',');
  db.run(`DELETE FROM vendors WHERE name IN (${placeholders})`, names, (err) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: 'Vendors deleted successfully', deleted: names });
  });
});

app.patch('/api/vendors', (req, res) => {
  const { names, enabled } = req.body;
  if (!names || !Array.isArray(names) || names.length === 0 || typeof enabled !== 'boolean') return res.status(400).json({ error: 'Array of vendor names and enabled boolean are required' });
  const placeholders = names.map(() => '?').join(',');
  db.run(`UPDATE vendors SET enabled = ? WHERE name IN (${placeholders})`, [enabled ? 1 : 0, ...names], (err) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: `Vendors ${enabled ? 'enabled' : 'disabled'} successfully`, updated: names });
  });
});

app.get('/api/purchase-orders', (req, res) => {
  const { source } = req.query;
  let query = 'SELECT * FROM purchase_orders WHERE status = "Open"';
  let params = [];
  if (source) {
    query += ' AND supplier = ?'; // Changed from 'source' to 'supplier'
    params.push(source);
  }
  db.all(query, params, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows.map(row => ({
      ...row,
      items: JSON.parse(row.items || '[]'), // Ensure items is always parsed
    })));
  });
});

app.get('/api/purchase-orders/:poNumber', (req, res) => {
  const { poNumber } = req.params;
  db.get('SELECT * FROM purchase_orders WHERE poNumber = ?', [poNumber], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!row) return res.status(404).json({ error: 'Purchase order not found' });
    res.json({ ...row, items: JSON.parse(row.items || '[]') });
  });
});

app.post('/api/purchase-orders', (req, res) => {
  const { poNumber, site, poDate, supplier, supplierAddress, supplierCity, supplierState, supplierZip, comments, shipToName, shipToAddress, shipToCity, shipToState, shipToZip, items } = req.body;
  if (!poNumber || !supplier || !items.length) {
    return res.status(400).json({ error: 'PO Number, Supplier, and at least one item are required' });
  }
  console.log('Received PO:', req.body); // Add logging
  db.run(
    `INSERT INTO purchase_orders (
      poNumber, site, poDate, supplier, supplierAddress, supplierCity, supplierState, supplierZip, 
      comments, shipToName, shipToAddress, shipToCity, shipToState, shipToZip, status, items
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      poNumber, site, poDate, supplier, supplierAddress, supplierCity, supplierState, supplierZip,
      comments, shipToName, shipToAddress, shipToCity, shipToState, shipToZip, 'Open', JSON.stringify(items)
    ],
    (err) => {
      if (err) {
        console.error('Insert PO error:', err.message); // Log the error
        return res.status(500).json({ error: err.message });
      }
      res.json({ message: 'PO created' });
    }
  );
});

app.post('/api/purchase-orders/email', (req, res) => {
  const { poNumber, supplier } = req.body;
  if (!poNumber || !supplier) return res.status(400).json({ error: 'PO Number and supplier are required' });

  db.get('SELECT * FROM purchase_orders WHERE poNumber = ?', [poNumber], (err, po) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!po) return res.status(404).json({ error: 'Purchase order not found' });

    const items = JSON.parse(po.items || '[]');
    db.get('SELECT email FROM vendors WHERE name = ?', [supplier], (err, vendor) => {
      if (err) return res.status(500).json({ error: err.message });
      if (!vendor || !vendor.email) return res.status(404).json({ error: 'Vendor email not found' });

      const itemsText = items.length ? items.map(item => `${item.name}: ${item.quantity}`).join('\n') : 'No items';
      const mailOptions = {
        from: process.env.EMAIL_USER,
        to: vendor.email,
        subject: `Purchase Order ${poNumber}`,
        text: `
          Purchase Order Details:
          PO Number: ${po.poNumber}
          Date: ${po.poDate}
          Supplier: ${po.supplier}
          Address: ${po.supplierAddress}, ${po.supplierCity}, ${po.supplierState} ${po.supplierZip}
          Comments: ${po.comments || 'None'}
          Items:
          ${itemsText}
          Ship To: ${po.shipToName}, ${po.shipToAddress}, ${po.shipToCity}, ${po.shipToState} ${po.shipToZip}
        `,
      };

      transporter.sendMail(mailOptions, (error) => {
        if (error) {
          console.error('Email error:', error);
          return res.status(500).json({ error: 'Failed to send email: ' + error.message });
        }
        res.json({ message: 'Email sent successfully' });
      });
    });
  });
});

app.get('/api/inventory', (req, res) => {
  const { source, identifier, locationId, siteId } = req.query;
  let query = 'SELECT * FROM inventory';
  let params = [];
  let conditions = [];
  if (source) {
    conditions.push('source = ?');
    params.push(source);
  }
  if (identifier) {
    conditions.push('identifier = ?');
    params.push(identifier);
  }
  if (locationId) {
    conditions.push('locationId = ?');
    params.push(parseInt(locationId));
  }
  if (siteId) {
    conditions.push('siteId = ?');
    params.push(siteId);
  }
  if (conditions.length > 0) {
    query += ' WHERE ' + conditions.join(' AND ');
  }
  db.all(query, params, (err, rows) => {
    if (err) {
      console.error('Fetch inventory error:', err);
      return res.status(500).json({ error: err.message });
    }
    console.log('Inventory data:', rows);
    res.json(rows);
  });
});

app.get('/api/debug/inventory', (req, res) => {
  db.all('SELECT * FROM inventory', (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.get('/api/debug/locations', (req, res) => {
  db.all('SELECT * FROM locations', (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.put('/api/inventory/:identifier', (req, res) => {
  const { identifier } = req.params;
  const { quantity, proof, totalCost, description, status, account } = req.body; // Editable fields
  if (!quantity || isNaN(parseFloat(quantity)) || parseFloat(quantity) < 0) {
    return res.status(400).json({ error: 'Valid quantity is required' });
  }
  db.run(
    `UPDATE inventory SET quantity = ?, proof = ?, totalCost = ?, description = ?, status = ?, account = ? 
     WHERE identifier = ?`,
    [quantity, proof || null, totalCost || null, description || null, status || 'Stored', account || 'Storage', identifier],
    (err) => {
      if (err) {
        console.error('Update inventory error:', err);
        return res.status(500).json({ error: err.message });
      }
      res.json({ message: 'Inventory item updated', identifier });
    }
  );
});

app.post('/api/inventory/adjust', (req, res) => {
  const { identifier, newQuantity, reason, date } = req.body;
  if (!identifier || !newQuantity || isNaN(parseFloat(newQuantity)) || parseFloat(newQuantity) < 0 || !reason) {
    return res.status(400).json({ error: 'Identifier, valid new quantity, and reason are required' });
  }

  db.serialize(() => {
    db.run('BEGIN TRANSACTION');

    db.get('SELECT quantity, totalCost, type, unit, cost FROM inventory WHERE identifier = ?', [identifier], (err, row) => {
      if (err) {
        db.run('ROLLBACK');
        return res.status(500).json({ error: err.message });
      }
      if (!row) {
        db.run('ROLLBACK');
        return res.status(404).json({ error: 'Item not found' });
      }

      const oldQuantity = parseFloat(row.quantity);
      const newQuantityNum = parseFloat(newQuantity);
      const unitCost = row.cost ? parseFloat(row.cost) : (parseFloat(row.totalCost) / oldQuantity) || 0; // Fallback to derived unit cost
      const newTotalCost = (unitCost * newQuantityNum).toFixed(2);
      const quantityDiff = (oldQuantity - newQuantityNum).toFixed(2);

      // Update inventory
      db.run(
        'UPDATE inventory SET quantity = ?, totalCost = ? WHERE identifier = ?',
        [newQuantity, newTotalCost, identifier],
        (err) => {
          if (err) {
            db.run('ROLLBACK');
            return res.status(500).json({ error: err.message });
          }

          // Log adjustment in transactions
          db.run(
            `INSERT INTO transactions (barrelId, type, quantity, proofGallons, date, action, dspNumber, toAccount)
             VALUES (?, ?, ?, ?, ?, ?, ?, 'Adjusted')`,
            [identifier, row.type, quantityDiff, row.type === 'Spirits' ? quantityDiff * (parseFloat(row.proof || '0') / 100) : 0, date || new Date().toISOString().split('T')[0], reason, OUR_DSP],
            (err) => {
              if (err) {
                db.run('ROLLBACK');
                return res.status(500).json({ error: err.message });
              }
              db.run('COMMIT');
              res.json({ message: 'Inventory adjusted', identifier, newQuantity, newTotalCost });
            }
          );
        }
      );
    });
  });
});

app.get('/api/products', (req, res) => {
  const mockProducts = [
    { id: 1, name: 'Whiskey', abbreviation: 'WH', enabled: true, priority: 1, class: 'Distilled', productColor: 'Amber', type: 'Spirits', style: 'Bourbon', abv: 40, ibu: 0 },
    { id: 2, name: 'IPA', abbreviation: 'IP', enabled: true, priority: 2, class: 'Beer', productColor: 'Golden', type: 'Ale', style: 'India Pale Ale', abv: 6.5, ibu: 60 },
  ];
  res.json(mockProducts);
});

app.get('/api/products/:id', (req, res) => {
  const id = parseInt(req.params.id);
  const mockProduct = {
    id,
    name: id === 1 ? 'Whiskey' : 'IPA',
    abbreviation: id === 1 ? 'WH' : 'IP',
    enabled: true,
    priority: id,
    class: id === 1 ? 'Distilled' : 'Beer',
    productColor: id === 1 ? 'Amber' : 'Golden',
    type: id === 1 ? 'Spirits' : 'Ale',
    style: id === 1 ? 'Bourbon' : 'India Pale Ale',
    abv: id === 1 ? 40 : 6.5,
    ibu: id === 1 ? 0 : 60,
  };
  res.json(mockProduct);
});

app.get('/api/products/:id/recipes', (req, res) => {
  const id = parseInt(req.params.id);
  const mockRecipes = id === 1
    ? [{ id: 1, productId: 1, name: 'Whiskey Recipe', ingredients: 'Corn, Barley, Water', instructions: 'Distill and age' }]
    : [{ id: 2, productId: 2, name: 'IPA Recipe', ingredients: 'Hops, Malt, Yeast', instructions: 'Ferment and hop' }];
  res.json(mockRecipes);
});

app.post('/api/products', (req, res) => {
  console.log('Received POST to /api/products:', req.body);
  const { name, abbreviation, enabled = true, priority = 1, class: prodClass, productColor, type, style, abv = 0, ibu = 0 } = req.body;
  if (!name || !abbreviation) {
    return res.status(400).json({ error: 'Name and abbreviation are required' });
  }
  const newProduct = {
    id: Date.now(),
    name,
    abbreviation,
    enabled,
    priority,
    class: prodClass,
    productColor,
    type,
    style,
    abv,
    ibu,
  };
  res.json(newProduct);
});

app.delete('/api/products', (req, res) => {
  console.log('Received DELETE to /api/products:', req.body);
  const { ids } = req.body;
  if (!ids || !Array.isArray(ids)) {
    return res.status(400).json({ error: 'IDs array is required' });
  }
  res.json({ message: `Deleted products with IDs: ${ids.join(', ')}` });
});

app.post('/api/receive', async (req, res) => {
  const items = Array.isArray(req.body) ? req.body : [req.body];
  const validAccounts = ['Storage', 'Processing', 'Production'];
  const validateItem = (item) => {
    const { identifier, account, type, quantity, unit, proof, receivedDate, status, description, cost, siteId, locationId } = item;
    if (!account || !validAccounts.includes(account) || !type || !quantity || !unit || !receivedDate || !status || !siteId || !locationId) {
      return 'Missing or invalid required fields (account must be Storage, Processing, or Production)';
    }
    if (type === 'Spirits' && (!identifier || !proof)) return 'Spirits require identifier and proof';
    if (type === 'Other' && !description) return 'Description required for Other type';
    const parsedQuantity = parseFloat(quantity);
    const parsedProof = proof ? parseFloat(proof) : null;
    const parsedCost = cost ? parseFloat(cost) : null;
    if (isNaN(parsedQuantity) || parsedQuantity <= 0 || 
        (parsedProof && (parsedProof > 200 || parsedProof < 0)) || 
        (parsedCost && parsedCost < 0)) return 'Invalid quantity, proof, or cost';
    return null;
  };

  const errors = items.map(validateItem).filter(e => e);
  if (errors.length) return res.status(400).json({ error: errors[0] });

  try {
    await new Promise((resolve, reject) => {
      db.run('BEGIN TRANSACTION', (err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    for (const item of items) {
      const { identifier, account, type, quantity, unit, proof, proofGallons, receivedDate, source, siteId, locationId, status, description, cost, totalCost } = item;
      const finalProofGallons = type === 'Spirits' ? (proofGallons || (parseFloat(quantity) * (parseFloat(proof) / 100)).toFixed(2)) : '0.00';
      const finalTotalCost = totalCost || '0.00';
      const finalUnitCost = cost || '0.00';

      const row = await new Promise((resolve, reject) => {
        db.get(
          'SELECT quantity, totalCost, unit, source FROM inventory WHERE identifier = ? AND type = ? AND account = ? AND siteId = ?',
          [identifier, type, account, siteId],
          (err, row) => {
            if (err) reject(err);
            else resolve(row);
          }
        );
      });

      if (row) {
        const existingQuantity = parseFloat(row.quantity);
        const existingTotalCost = parseFloat(row.totalCost || '0');
        const newQuantity = (existingQuantity + parseFloat(quantity)).toFixed(2);
        const newTotalCost = (existingTotalCost + parseFloat(finalTotalCost)).toFixed(2);
        const avgUnitCost = (newTotalCost / newQuantity).toFixed(2);
        await new Promise((resolve, reject) => {
          db.run(
            `UPDATE inventory SET quantity = ?, totalCost = ?, cost = ?, proofGallons = ?, receivedDate = ?, source = ?, unit = ?, locationId = ?
             WHERE identifier = ? AND type = ? AND account = ? AND siteId = ?`,
            [newQuantity, newTotalCost, avgUnitCost, finalProofGallons, receivedDate, source || 'Unknown', unit, locationId, identifier, type, account, siteId],
            (err) => {
              if (err) reject(err);
              else resolve();
            }
          );
        });
      } else {
        await new Promise((resolve, reject) => {
          db.run(
            `INSERT INTO inventory (identifier, account, type, quantity, unit, proof, proofGallons, totalCost, cost, receivedDate, source, siteId, locationId, status, description)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [identifier || null, account, type, quantity, unit, proof || null, finalProofGallons, finalTotalCost, finalUnitCost, receivedDate, source || 'Unknown', siteId, locationId, status, description || null],
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

    res.json({ message: 'Receive successful' });
  } catch (err) {
    console.error('Error in /api/receive:', err);
    await new Promise((resolve) => db.run('ROLLBACK', resolve));
    res.status(500).json({ error: err.message || 'Internal Server Error' });
  }
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
          `UPDATE inventory SET account = ?, proofGallons = ?, status = ? WHERE identifier = ?`,
          [toAccount, movedProofGallons.toFixed(2), toAccount === 'Processing' ? 'Processing' : 'Stored', identifier],
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
                  status: toAccount === 'Processing' ? 'Processing' : 'Stored',
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
                      status: toAccount === 'Processing' ? 'Processing' : 'Stored',
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

  const newBatchId = `${product.replace(/\s+/g, '')}-${date.replace(/-/g, '')}-${Math.floor(Math.random() * 1000)}`;

  db.get('SELECT * FROM inventory WHERE identifier = ?', [batchId], (err, row) => {
    if (err) {
      console.error('DB Select Error:', err);
      return res.status(500).json({ error: err.message });
    }
    if (!row) {
      console.error('Batch not found:', batchId);
      return res.status(404).json({ error: 'Source batch not found' });
    }

    const sourceProofGallons = parseFloat(row.proofGallons);
    const requestedProofGallons = parseFloat(proofGallons);
    if (sourceProofGallons < requestedProofGallons) {
      return res.status(400).json({ error: 'Not enough proof gallons available' });
    }

    db.serialize(() => {
      db.run('BEGIN TRANSACTION');

      db.run(
        `INSERT INTO inventory (identifier, account, type, quantity, proof, proofGallons, receivedDate, source, dspNumber, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'Packaged')`,
        [newBatchId, toAccount, product, bottleCount, targetProof, proofGallons, date, row.source, row.dspNumber],
        (err) => {
          if (err) {
            console.error('Insert Package Error:', err);
            db.run('ROLLBACK');
            return res.status(500).json({ error: err.message });
          }

          const remainingProofGallons = (sourceProofGallons - requestedProofGallons).toFixed(2);
          const originalQuantity = parseFloat(row.quantity);
          const usedQuantity = (originalQuantity * (requestedProofGallons / sourceProofGallons)).toFixed(2);
          const remainingQuantity = (originalQuantity - parseFloat(usedQuantity)).toFixed(2);

          db.run(
            `UPDATE inventory SET proofGallons = ?, quantity = ? WHERE identifier = ?`,
            [remainingProofGallons, remainingQuantity, batchId],
            (err) => {
              if (err) {
                console.error('Update Source Error:', err);
                db.run('ROLLBACK');
                return res.status(500).json({ error: err.message });
              }

              db.run(
                `INSERT INTO transactions (barrelId, type, quantity, proofGallons, date, action, dspNumber)
                 VALUES (?, ?, ?, ?, ?, 'Packaged', ?)`,
                [newBatchId, product, bottleCount, proofGallons, date, row.dspNumber],
                (err) => {
                  if (err) {
                    console.error('Transaction Insert Error:', err);
                    db.run('ROLLBACK');
                    return res.status(500).json({ error: err.message });
                  }
                  db.run('COMMIT');
                  console.log('Package successful, newBatchId:', newBatchId);
                  res.json({ message: 'Package successful', newBatchId });
                }
              );
            }
          );
        }
      );
    });
  });
});

app.post('/api/record-loss', (req, res) => {
  console.log('Received POST to /api/record-loss:', req.body);
  const { identifier, quantityLost, proofGallonsLost, reason, date, dspNumber } = req.body;

  if (!identifier || !quantityLost || !proofGallonsLost || !reason || !date) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const dspToUse = dspNumber || OUR_DSP;

  db.run(
    `INSERT INTO transactions (barrelId, type, quantity, proofGallons, date, action, dspNumber)
     VALUES (?, 'Loss', ?, ?, ?, 'Loss', ?)`,
    [identifier, quantityLost, proofGallonsLost, date, dspToUse],
    (err) => {
      if (err) {
        console.error('Transaction Insert Error:', err);
        return res.status(500).json({ error: err.message });
      }
      db.run(
        `UPDATE inventory SET quantity = quantity - ?, proofGallons = proofGallons - ? WHERE identifier = ?`,
        [parseFloat(quantityLost), parseFloat(proofGallonsLost), identifier],
        (err) => {
          if (err) {
            console.error('Update Inventory Error:', err);
            return res.status(500).json({ error: err.message });
          }
          res.json({ message: 'Loss recorded' });
        }
      );
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

app.get('/api/sites', (req, res) => {
  db.all('SELECT * FROM sites WHERE enabled = 1', (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.post('/api/sites', (req, res) => {
  const { siteId, name, type, address, enabled = 1 } = req.body;
  if (!siteId || !name) {
    return res.status(400).json({ error: 'Site ID and name are required' });
  }
  db.run(
    'INSERT INTO sites (siteId, name, type, address, enabled) VALUES (?, ?, ?, ?, ?)',
    [siteId, name, type || 'DSP', address || '', enabled],
    function (err) {
      if (err) {
        console.error('Insert site error:', err);
        return res.status(500).json({ error: err.message });
      }
      res.json({ siteId, name, type, address, enabled });
    }
  );
});

app.post('/api/locations', (req, res) => {
  const { name, siteId, enabled = 1 } = req.body;
  if (!name || !siteId) {
    return res.status(400).json({ error: 'Name, siteId are required' });
  }
  db.get('SELECT siteId FROM sites WHERE siteId = ?', [siteId], (err, row) => {
    if (err) {
      console.error('Check site error:', err);
      return res.status(500).json({ error: err.message });
    }
    if (!row) {
      return res.status(400).json({ error: 'Invalid siteId' });
    }
    db.run(
      'INSERT INTO locations (name, siteId, enabled) VALUES (?, ?, ?)',
      [name, siteId, enabled],
      function(err) {
        if (err) {
          console.error('Insert location error:', err);
          return res.status(500).json({ error: err.message });
        }
        res.json({ locationId: this.lastID, name, siteId, enabled });
      }
    );
  });
});

app.get('/api/locations', (req, res) => {
  const { siteId } = req.query;
  let query = 'SELECT * FROM locations';
  let params = [];
  if (siteId) {
    query += ' WHERE siteId = ?';
    params.push(siteId);
  }
  db.all(query, params, (err, rows) => {
    if (err) {
      console.error('Fetch locations error:', err);
      return res.status(500).json({ error: err.message });
    }
    console.log('Locations data:', rows);
    res.json(rows);
  });
});

app.put('/api/locations/:locationId', (req, res) => {
  const { locationId } = req.params;
  const { siteId, name, abbreviation, enabled } = req.body;
  if (!siteId || !name) {
    return res.status(400).json({ error: 'Site and Name are required' });
  }
  db.run(
    `UPDATE locations SET siteId = ?, name = ?, abbreviation = ?, enabled = ? WHERE locationId = ?`,
    [siteId, name, abbreviation || null, enabled !== undefined ? enabled : 1, parseInt(locationId)],
    function (err) {
      if (err) {
        console.error('Update location error:', err);
        return res.status(500).json({ error: err.message });
      }
      if (this.changes === 0) {
        return res.status(404).json({ error: 'Location not found' });
      }
      console.log(`Updated location: locationId=${locationId}, siteId=${siteId}, name=${name}, abbreviation=${abbreviation || 'null'}`);
      res.json({ message: 'Location updated successfully' });
    }
  );
});

app.get('/api/equipment', (req, res) => {
  const { siteId } = req.query;
  if (!siteId) return res.status(400).json({ error: 'siteId is required' });
  db.all('SELECT * FROM equipment WHERE siteId = ?', [siteId], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.post('/api/equipment', (req, res) => {
  const { name, abbreviation, siteId, enabled = 1 } = req.body;
  if (!name || !abbreviation || !siteId) return res.status(400).json({ error: 'name, abbreviation, and siteId are required' });
  db.get('SELECT siteId FROM sites WHERE siteId = ?', [siteId], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!row) return res.status(400).json({ error: 'Invalid siteId' });
    db.run(
      'INSERT INTO equipment (name, abbreviation, siteId, enabled) VALUES (?, ?, ?, ?)',
      [name, abbreviation, siteId, enabled],
      function (err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ equipmentId: this.lastID, message: 'Equipment created' });
      }
    );
  });
});

app.put('/api/equipment/:equipmentId', (req, res) => {
  const { equipmentId } = req.params;
  const { name, abbreviation, siteId, enabled = 1 } = req.body;
  if (!name || !abbreviation || !siteId) {
    return res.status(400).json({ error: 'name, abbreviation, and siteId are required' });
  }
  db.get('SELECT siteId FROM sites WHERE siteId = ?', [siteId], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!row) return res.status(400).json({ error: 'Invalid siteId' });
    db.serialize(() => {
      db.run('BEGIN TRANSACTION');
      db.run(
        'UPDATE equipment SET name = ?, abbreviation = ?, siteId = ?, enabled = ? WHERE equipmentId = ?',
        [name, abbreviation, siteId, enabled, equipmentId],
        (err) => {
          if (err) {
            db.run('ROLLBACK');
            return res.status(500).json({ error: err.message });
          }
          // Update facility designs to reflect new siteId
          db.all('SELECT id, siteId, objects FROM facility_designs', [], (err, rows) => {
            if (err) {
              db.run('ROLLBACK');
              return res.status(500).json({ error: err.message });
            }
            rows.forEach((row) => {
              let objects = JSON.parse(row.objects);
              let updated = false;
              objects = objects.map((obj) => {
                if (obj.equipmentId === parseInt(equipmentId)) {
                  updated = true;
                  return { ...obj, siteId };
                }
                return obj;
              });
              if (updated) {
                db.run(
                  'UPDATE facility_designs SET objects = ?, updatedAt = ? WHERE id = ?',
                  [JSON.stringify(objects), new Date().toISOString(), row.id],
                  (err) => {
                    if (err) {
                      db.run('ROLLBACK');
                      return res.status(500).json({ error: err.message });
                    }
                  }
                );
              }
            });
            db.run('COMMIT');
            res.json({ message: 'Equipment updated', equipmentId });
          });
        }
      );
    });
  });
});

app.get('/api/facility-design', (req, res) => {
  const { siteId } = req.query;
  if (!siteId) return res.status(400).json({ error: 'siteId is required' });
  db.get('SELECT * FROM facility_designs WHERE siteId = ?', [siteId], (err, row) => {
    if (err) {
      console.error('Fetch facility design error:', err);
      return res.status(500).json({ error: err.message });
    }
    res.json(row ? { ...row, objects: JSON.parse(row.objects) } : null);
  });
});

app.post('/api/facility-design', (req, res) => {
  const { siteId, objects } = req.body;
  if (!siteId || !Array.isArray(objects)) {
    return res.status(400).json({ error: 'siteId and objects array are required' });
  }
  const timestamp = new Date().toISOString();
  db.get('SELECT id FROM facility_designs WHERE siteId = ?', [siteId], (err, row) => {
    if (err) {
      console.error('Check facility design error:', err);
      return res.status(500).json({ error: err.message });
    }
    if (row) {
      // Update existing design
      db.run(
        'UPDATE facility_designs SET objects = ?, updatedAt = ? WHERE siteId = ?',
        [JSON.stringify(objects), timestamp, siteId],
        (err) => {
          if (err) {
            console.error('Update facility design error:', err);
            return res.status(500).json({ error: err.message });
          }
          res.json({ message: 'Design updated', siteId });
        }
      );
    } else {
      // Create new design
      db.run(
        'INSERT INTO facility_designs (siteId, objects, createdAt, updatedAt) VALUES (?, ?, ?, ?)',
        [siteId, JSON.stringify(objects), timestamp, timestamp],
        (err) => {
          if (err) {
            console.error('Insert facility design error:', err);
            return res.status(500).json({ error: err.message });
          }
          res.json({ message: 'Design created', siteId });
        }
      );
    }
  });
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

app.get('*', (req, res) => res.sendFile(path.join(__dirname, '../client/build/index.html')));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});