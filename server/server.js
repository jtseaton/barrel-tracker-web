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
      dspNumber TEXT,
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
      items TEXT
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS sites (
      siteId TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT,
      address TEXT,
      enabled INTEGER DEFAULT 1
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS locations (
      locationId INTEGER PRIMARY KEY AUTOINCREMENT,
      siteId TEXT,
      name TEXT NOT NULL,
      abbreviation TEXT,
      enabled INTEGER DEFAULT 1,
      FOREIGN KEY (siteId) REFERENCES sites(siteId)
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS equipment (
      equipmentId INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT,
      siteId TEXT,
      abbreviation TEXT,
      enabled INTEGER,
      FOREIGN KEY (siteId) REFERENCES sites(siteId)
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS facility_designs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      siteId TEXT NOT NULL,
      objects TEXT NOT NULL,
      createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
      updatedAt TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (siteId) REFERENCES sites(siteId),
      UNIQUE(siteId)
    )
  `, (err) => {
    if (err) console.error('Error creating facility_designs table:', err);
    else console.log('Created facility_designs table');
  });
  db.run(`CREATE UNIQUE INDEX IF NOT EXISTS idx_siteId ON facility_designs(siteId)`, (err) => {
    if (err) console.error('Error adding UNIQUE index:', err);
    else console.log('Added UNIQUE index on siteId');
  });
  db.run(`
    DELETE FROM facility_designs
    WHERE id NOT IN (
      SELECT id FROM (
        SELECT id, ROW_NUMBER() OVER (PARTITION BY siteId ORDER BY updatedAt DESC) AS rn
        FROM facility_designs
      ) WHERE rn = 1
    )
  `, (err) => {
    if (err) console.error('Error cleaning up duplicate designs:', err);
    else console.log('Cleaned up duplicate facility designs');
  });
  db.run(`
    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      abbreviation TEXT,
      enabled INTEGER DEFAULT 1,
      priority INTEGER DEFAULT 1,
      class TEXT,
      type TEXT,
      style TEXT,
      abv REAL,
      ibu INTEGER
    )
  `, (err) => {
    if (err) console.error('Error creating products table:', err);
    else console.log('Created products table');
  });
  db.run(`
    CREATE TABLE IF NOT EXISTS batches (
      batchId TEXT PRIMARY KEY,
      productId INTEGER,
      recipeId INTEGER,
      siteId TEXT,
      status TEXT,
      date TEXT,
      FOREIGN KEY (productId) REFERENCES products(id),
      FOREIGN KEY (siteId) REFERENCES sites(siteId)
    )
  `, (err) => {
    if (err) console.error('Error creating batches table:', err);
    else console.log('Created batches table');
  });
  db.run(`
    ALTER TABLE batches ADD COLUMN stage TEXT
  `, (err) => {
    if (err && !err.message.includes('duplicate column')) {
      console.error('Error adding stage column to batches:', err);
    } else {
      console.log('Added stage column to batches table');
    }
  });
  db.run(`
    CREATE TABLE IF NOT EXISTS recipes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT,
      productId INTEGER,
      ingredients TEXT,
      quantity REAL,
      unit TEXT,
      FOREIGN KEY (productId) REFERENCES products(id)
    )
  `, (err) => {
    if (err) console.error('Error creating recipes table:', err);
    else console.log('Created recipes table');
  });
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      email TEXT PRIMARY KEY,
      passwordHash TEXT,
      role TEXT NOT NULL,
      enabled INTEGER NOT NULL DEFAULT 1,
      passkey TEXT
    )
  `, (err) => {
    if (err) console.error('Error creating users table:', err);
    else console.log('Created users table');
  });

  db.run(`
    CREATE TABLE IF NOT EXISTS batch_actions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      batchId TEXT,
      action TEXT,
      timestamp TEXT,
      FOREIGN KEY (batchId) REFERENCES batches(batchId)
    )
  `);

  db.run(`
    ALTER TABLE batches ADD COLUMN brewLog TEXT
  `, (err) => {
    if (err && !err.message.includes('duplicate column')) {
      console.error('Error adding brewLog column:', err);
    }
  });

  // In db.serialize() (~line 70), after existing table definitions
  db.run(`
    ALTER TABLE batches ADD COLUMN equipmentId INTEGER REFERENCES equipment(equipmentId)
  `, (err) => {
    if (err && !err.message.includes('duplicate column')) {
      console.error('Error adding equipmentId column:', err);
    }
  });
  
  // Insert default Super Admin (for testing)
  db.run('INSERT OR IGNORE INTO users (email, passwordHash, role, enabled) VALUES (?, ?, ?, ?)',
    ['superadmin@example.com', null, 'SuperAdmin', 1]);
  db.run(`ALTER TABLE locations ADD COLUMN abbreviation TEXT`, (err) => {
    if (err && !err.message.includes('duplicate column')) {
      console.error('Error adding abbreviation column:', err);
    } else {
      console.log('Added abbreviation column to locations');
    }
  });
  db.run('INSERT OR IGNORE INTO equipment (name, abbreviation, siteId, enabled) VALUES (?, ?, ?, ?)', 
  ['Mash Tun', 'MT', 'BR-AL-20019', 1]);
  db.run('INSERT OR IGNORE INTO equipment (name, abbreviation, siteId, enabled) VALUES (?, ?, ?, ?)', 
    ['Boil Kettle', 'BK', 'BR-AL-20019', 1]);
  db.run('INSERT OR IGNORE INTO equipment (name, abbreviation, siteId, enabled) VALUES (?, ?, ?, ?)', 
    ['Fermentation FV1', 'FV1', 'BR-AL-20019', 1]);
  db.run('INSERT OR IGNORE INTO equipment (name, abbreviation, siteId, enabled) VALUES (?, ?, ?, ?)', 
    ['Fermentation FV2', 'FV2', 'BR-AL-20019', 1]);
  db.run('INSERT OR IGNORE INTO equipment (name, abbreviation, siteId, enabled) VALUES (?, ?, ?, ?)', 
    ['Brite Tank', 'BT', 'BR-AL-20019', 1]);
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
  db.run('INSERT OR IGNORE INTO products (id, name, abbreviation, enabled, priority, class, type, style, abv, ibu) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [1, 'Whiskey', 'WH', 1, 1, 'Distilled', 'Spirits', 'Bourbon', 40, 0]);
  db.run('INSERT OR IGNORE INTO products (id, name, abbreviation, enabled, priority, class, type, style, abv, ibu) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [2, 'IPA', 'IP', 1, 2, 'Beer', 'Malt', 'American IPA', 6.5, 60]);
  db.run('INSERT OR IGNORE INTO items (name, type, enabled) VALUES (?, ?, ?)',
    ['Finished Goods', 'Finished Goods', 1]);
  // Insert mock items (for ingredients)
  db.run('INSERT OR IGNORE INTO items (name, type, enabled) VALUES (?, ?, ?)',
    ['Corn', 'Grain', 1]);
  db.run('INSERT OR IGNORE INTO items (name, type, enabled) VALUES (?, ?, ?)',
    ['Hops', 'Hops', 1]);
  // Insert mock inventory with identifier as itemName for non-Spirits
  db.run('INSERT OR IGNORE INTO inventory (identifier, account, type, quantity, unit, receivedDate, source, siteId, locationId, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    ['Flaked Corn', 'Storage', 'Grain', '1000', 'Pounds', '2025-04-20', 'Acme Supplies', 'BR-AL-20019', 1, 'Stored']);
  db.run('INSERT OR IGNORE INTO inventory (identifier, account, type, quantity, unit, receivedDate, source, siteId, locationId, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    ['Hops Cascade', 'Storage', 'Hops', '225', 'Pounds', '2025-04-20', 'Acme Supplies', 'BR-AL-20019', 8, 'Stored']);
  db.run('INSERT OR IGNORE INTO inventory (identifier, account, type, quantity, unit, receivedDate, source, siteId, locationId, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    ['Hops Cascade', 'Storage', 'Hops', '50', 'Pounds', '2025-04-20', 'Acme Supplies', 'BR-AL-20088', 11, 'Stored']);
  db.run('INSERT OR IGNORE INTO inventory (identifier, account, type, quantity, unit, receivedDate, source, siteId, locationId, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    ['Hops', 'Storage', 'Hops', '550', 'Pounds', '2025-04-20', 'Acme Supplies', 'BR-AL-20019', 8, 'Stored']);
  // Insert mock recipes
  db.run('INSERT OR IGNORE INTO recipes (id, name, productId, ingredients, quantity, unit) VALUES (?, ?, ?, ?, ?, ?)',
    [1, 'Whiskey Recipe', 1, JSON.stringify([{ itemName: 'Corn', quantity: 100, unit: 'lbs' }]), '100', 'gallons']);
  db.run('INSERT OR IGNORE INTO recipes (id, name, productId, ingredients, quantity, unit) VALUES (?, ?, ?, ?, ?, ?)',
    [2, 'IPA Recipe', 2, JSON.stringify([{ itemName: 'Hops', quantity: 50, unit: 'lbs' }]), '10', 'barrels']);
  // Insert mock batches
  db.run('INSERT OR IGNORE INTO batches (batchId, productId, recipeId, siteId, status, date) VALUES (?, ?, ?, ?, ?, ?)',
    ['BATCH-001', 1, 1, 'BR-AL-20019', 'In Progress', '2025-04-20']);
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
  // In db.serialize, replace the default Super Admin insert
  db.run('INSERT OR IGNORE INTO users (email, passwordHash, role, enabled) VALUES (?, ?, ?, ?)',
  ['jtseaton@gmail.com', 'P@$$w0rd1234', 'SuperAdmin', 1], // Temporary password: temp123
  (err) => {
    if (err) console.error('Error inserting default user:', err);
    else console.log('Inserted default Super Admin user');
  });
  db.run(`UPDATE locations SET abbreviation = ? WHERE name = ? AND siteId = ?`, 
    ['Athens Cooler', 'Athens Cold Storage', 'BR-AL-20088'], (err) => {
      if (err) console.error('Update error:', err);
      else console.log('Updated: Athens Cold Storage, abbreviation=Athens Cooler');
  });
  db.run(`ALTER TABLE inventory ADD COLUMN totalCost REAL DEFAULT 0`, (err) => {
    if (err && !err.message.includes('duplicate column')) console.error('Error adding totalCost:', err);
  });
  db.run(`ALTER TABLE purchase_orders ADD COLUMN status TEXT DEFAULT 'Open'`, (err) => {
    if (err && !err.message.includes('duplicate column')) {
      console.error('Error adding status column:', err);
    } 
  });
  db.run('INSERT OR IGNORE INTO vendors (name, type, enabled, address, email, phone) VALUES (?, ?, ?, ?, ?, ?)', 
    ['Acme Supplies', 'Supplier', 1, '123 Main St', 'acme@example.com', '555-1234']);
  db.run('INSERT OR IGNORE INTO vendors (name, type, enabled, address, email, phone) VALUES (?, ?, ?, ?, ?, ?)', 
    ['Country Malt', 'Supplier', 1, '123 Main St', 'acme@example.com', '555-1234']);
  db.run('INSERT OR IGNORE INTO vendors (name, type, enabled, address, email, phone) VALUES (?, ?, ?, ?, ?, ?)', 
    ['Yakima Chief', 'Supplier', 1, '123 Main St', 'acme@example.com', '555-1234']);
  db.run('INSERT OR IGNORE INTO vendors (name, type, enabled, address, email, phone) VALUES (?, ?, ?, ?, ?, ?)', 
    ['Pharmco Aaper', 'Supplier', 1, '123 Main St', 'acme@example.com', '555-1234']);
        
    db.run(`ALTER TABLE batches ADD COLUMN additionalIngredients TEXT`
    , (err) => {
      if (err && !err.message.includes('duplicate column')) {
        console.error('Error adding additionalIngredients column:', err);
      }
    });
    db.run(`
      ALTER TABLE batches ADD COLUMN volume REAL
    `, (err) => {
      if (err && !err.message.includes('duplicate column')) {
        console.error('Error adding volume column to batches:', err);
      } else {
        console.log('Added volume column to batches table');
      }
    });
});

// GET /api/users
app.get('/api/users', (req, res) => {
  db.all('SELECT email, role, enabled, passkey FROM users', (err, rows) => {
    if (err) {
      console.error('Fetch users error:', err);
      return res.status(500).json({ error: err.message });
    }
    console.log('GET /api/users, returning:', rows);
    res.json(rows);
  });
});

// POST /api/users
app.post('/api/users', (req, res) => {
  const { email, role } = req.body;
  if (!email || !role || !['SuperAdmin', 'Admin', 'Sales', 'Production'].includes(role)) {
    console.log('POST /api/users: Invalid fields', req.body);
    return res.status(400).json({ error: 'Email and valid role are required' });
  }
  db.get('SELECT email FROM users WHERE email = ?', [email], (err, existing) => {
    if (err) return res.status(500).json({ error: err.message });
    if (existing) return res.status(400).json({ error: 'Email already exists' });
    db.run(
      'INSERT INTO users (email, role, enabled) VALUES (?, ?, ?)',
      [email, role, 1],
      function(err) {
        if (err) {
          console.error('Insert user error:', err);
          return res.status(500).json({ error: err.message });
        }
        console.log('POST /api/users, added:', { email, role });
        res.json({ email, role, enabled: 1, passkey: null });
      }
    );
  });
});

// DELETE /api/users
app.delete('/api/users', (req, res) => {
  const { emails } = req.body;
  if (!Array.isArray(emails) || emails.length === 0) {
    return res.status(400).json({ error: 'Array of emails required' });
  }
  const placeholders = emails.map(() => '?').join(',');
  db.run(`DELETE FROM users WHERE email IN (${placeholders})`, emails, (err) => {
    if (err) {
      console.error('Delete users error:', err);
      return res.status(500).json({ error: err.message });
    }
    console.log('DELETE /api/users, deleted:', emails);
    res.json({ message: 'Users deleted' });
  });
});

// PATCH /api/users
app.patch('/api/users', (req, res) => {
  const { emails, enabled } = req.body;
  if (!Array.isArray(emails) || emails.length === 0 || typeof enabled !== 'boolean') {
    return res.status(400).json({ error: 'Array of emails and enabled boolean required' });
  }
  const placeholders = emails.map(() => '?').join(',');
  db.run(`UPDATE users SET enabled = ? WHERE email IN (${placeholders})`, [enabled ? 1 : 0, ...emails], (err) => {
    if (err) {
      console.error('Update users error:', err);
      return res.status(500).json({ error: err.message });
    }
    console.log('PATCH /api/users, updated:', emails, 'enabled:', enabled);
    res.json({ message: 'Users updated' });
  });
});

app.post('/api/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password required' });
  }
  db.get('SELECT email, passwordHash, role, enabled FROM users WHERE email = ? AND enabled = 1', [email], (err, user) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!user) return res.status(401).json({ error: 'Invalid email or disabled user' });
    // Temporary: Accept plain-text password (replace with bcrypt in production)
    if (user.passwordHash !== password) {
      return res.status(401).json({ error: 'Invalid password' });
    }
    console.log('POST /api/login, authenticated:', user);
    res.json({ email: user.email, role: user.role });
  });
});

app.get('/api/products', (req, res) => {
  db.all('SELECT * FROM products WHERE enabled = 1', (err, rows) => {
    if (err) {
      console.error('Fetch products error:', err);
      return res.status(500).json({ error: err.message });
    }
    console.log('GET /api/products, returning:', rows);
    res.json(rows);
  });
});

app.get('/api/products/:id', (req, res) => {
  const id = parseInt(req.params.id);
  db.get('SELECT * FROM products WHERE id = ?', [id], (err, row) => {
    if (err) {
      console.error('Fetch product error:', err);
      return res.status(500).json({ error: err.message });
    }
    if (!row) {
      console.log(`GET /api/products/${id}: Product not found`);
      return res.status(404).json({ error: 'Product not found' });
    }
    console.log(`GET /api/products/${id}, returning:`, row);
    res.json(row);
  });
});

app.post('/api/products', (req, res) => {
  console.log('POST /api/products, payload:', req.body);
  const { name, abbreviation, enabled = true, priority = 1, class: prodClass, type, style, abv = 0, ibu = 0 } = req.body;
  if (!name || !abbreviation || !type || !style) {
    console.log('POST /api/products: Missing required fields');
    return res.status(400).json({ error: 'Name, abbreviation, type, and style are required' });
  }
  const validProductTypes = ['Malt', 'Spirits', 'Wine', 'Merchandise', 'Cider', 'Seltzer'];
  if (!validProductTypes.includes(type)) {
    console.log(`POST /api/products: Invalid type: ${type}`);
    return res.status(400).json({ error: `Invalid product type. Must be one of: ${validProductTypes.join(', ')}` });
  }
  if ((type === 'Seltzer' || type === 'Merchandise') && style !== 'Other') {
    console.log(`POST /api/products: Invalid style for ${type}: ${style}`);
    return res.status(400).json({ error: 'Style must be "Other" for Seltzer or Merchandise' });
  }
  db.run(
    `INSERT INTO products (id, name, abbreviation, enabled, priority, class, type, style, abv, ibu)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [Date.now(), name, abbreviation, enabled ? 1 : 0, priority, prodClass, type, style, abv, ibu],
    function(err) {
      if (err) {
        console.error('Insert product error:', err);
        return res.status(500).json({ error: err.message });
      }
      const newProduct = { id: this.lastID, name, abbreviation, enabled, priority, class: prodClass, type, style, abv, ibu };
      console.log('POST /api/products, added:', newProduct);
      res.json(newProduct);
    }
  );
});

app.delete('/api/products', (req, res) => {
  console.log('DELETE /api/products, payload:', req.body);
  const { ids } = req.body;
  if (!ids || !Array.isArray(ids)) {
    console.log('DELETE /api/products: Invalid IDs');
    return res.status(400).json({ error: 'IDs array is required' });
  }
  const placeholders = ids.map(() => '?').join(',');
  db.run(`DELETE FROM products WHERE id IN (${placeholders})`, ids, (err) => {
    if (err) {
      console.error('Delete products error:', err);
      return res.status(500).json({ error: err.message });
    }
    console.log('DELETE /api/products, deleted IDs:', ids);
    res.json({ message: `Deleted products with IDs: ${ids.join(', ')}` });
  });
});

app.get('/api/batches', (req, res) => {
  db.all(`
    SELECT b.batchId, b.productId, p.name AS productName, b.recipeId, r.name AS recipeName, 
           b.siteId, s.name AS siteName, b.status, b.date
    FROM batches b
    JOIN products p ON b.productId = p.id
    JOIN recipes r ON b.recipeId = r.id
    JOIN sites s ON b.siteId = s.siteId
  `, (err, rows) => {
    if (err) {
      console.error('Fetch batches error:', err);
      return res.status(500).json({ error: err.message });
    }
    console.log('GET /api/batches, returning:', rows);
    res.json(rows);
  });
});

app.post('/api/batches', (req, res) => {
  const { batchId, productId, recipeId, siteId, status, date, equipmentId } = req.body;
  console.log('Received /api/batches request:', req.body);
  try {
    if (!batchId || !productId || !recipeId || !siteId || !status || !date) {
      const missing = [];
      if (!batchId) missing.push('batchId');
      if (!productId) missing.push('productId');
      if (!recipeId) missing.push('recipeId');
      if (!siteId) missing.push('siteId');
      if (!status) missing.push('status');
      if (!date) missing.push('date');
      console.log('Missing required fields:', missing);
      return res.status(400).json({ error: `Missing required fields: ${missing.join(', ')}` });
    }
    db.get('SELECT id FROM products WHERE id = ?', [productId], (err, product) => {
      if (err) {
        console.error('Error validating productId:', err);
        return res.status(500).json({ error: 'Database error validating product' });
      }
      if (!product) {
        console.log('Product not found:', productId);
        return res.status(400).json({ error: `Invalid productId: ${productId}` });
      }
      db.get('SELECT ingredients, quantity, unit FROM recipes WHERE id = ?', [recipeId], (err, recipe) => {
        if (err) {
          console.error('Error fetching recipe:', err);
          return res.status(500).json({ error: 'Database error fetching recipe' });
        }
        if (!recipe) {
          console.log('Recipe not found:', recipeId);
          return res.status(400).json({ error: `Invalid recipeId: ${recipeId}` });
        }
        let ingredients = [];
        try {
          ingredients = JSON.parse(recipe.ingredients || '[]');
        } catch (e) {
          console.error('Error parsing recipe ingredients:', e);
          return res.status(500).json({ error: 'Invalid recipe ingredients format' });
        }
        // Calculate volume with null checks
        let volume = null;
        if (recipe.quantity && recipe.unit) {
          const quantity = parseFloat(recipe.quantity);
          if (isNaN(quantity)) {
            console.warn('Invalid recipe quantity:', recipe.quantity);
          } else {
            volume = quantity;
            const unit = recipe.unit.toLowerCase();
            if (unit === 'gallons') {
              volume /= 31; // 1 barrel = 31 gallons
            } else if (unit === 'liters') {
              volume /= 117.348; // 1 barrel = 117.348 liters
            } // Else assume barrels
          }
        } else {
          console.warn('Recipe missing quantity or unit:', { recipeId, quantity: recipe.quantity, unit: recipe.unit });
        }
        console.log('Recipe details:', { recipeId, ingredients, volume });
        const validateEquipment = (callback) => {
          if (!equipmentId) return callback();
          db.get('SELECT equipmentId FROM equipment WHERE equipmentId = ? AND siteId = ?', [equipmentId, siteId], (err, equipment) => {
            if (err) {
              console.error('Error validating equipmentId:', err);
              return res.status(500).json({ error: 'Database error validating equipment' });
            }
            if (!equipment) {
              console.log('Equipment not found for site:', equipmentId, siteId);
              return res.status(400).json({ error: `Invalid equipmentId: ${equipmentId} for site ${siteId}` });
            }
            callback();
          });
        };
        validateEquipment(() => {
          const errors = [];
          if (ingredients.length === 0) {
            console.log('No ingredients to validate for recipeId', recipeId);
            createBatch([]);
          } else {
            let remaining = ingredients.length;
            const inventoryUpdates = [];
            ingredients.forEach((ing, index) => {
              if (!ing.itemName || !ing.quantity) {
                errors.push(`Invalid ingredient at index ${index}: missing itemName or quantity`);
                remaining--;
                if (remaining === 0) finishValidation(inventoryUpdates);
                return;
              }
              const unit = (ing.unit || 'lbs').toLowerCase();
              const normalizedUnit = unit === 'pounds' ? 'lbs' : unit;
              console.log(`Validating ingredient: identifier=${ing.itemName}, quantity=${ing.quantity}, unit=${normalizedUnit}, siteId=${siteId}`);
              db.get('SELECT name FROM items WHERE name = ?', [ing.itemName], (err, item) => {
                if (err) {
                  console.error(`Error fetching item ${ing.itemName}:`, err);
                  errors.push(`Database error for ${ing.itemName}: ${err.message}`);
                  remaining--;
                  if (remaining === 0) finishValidation(inventoryUpdates);
                  return;
                }
                if (!item) {
                  console.error(`Item not found: ${ing.itemName}`);
                  errors.push(`Item not found: ${ing.itemName}`);
                  remaining--;
                  if (remaining === 0) finishValidation(inventoryUpdates);
                  return;
                }
                // Debug inventory rows
                db.all(
                  'SELECT identifier, quantity, unit FROM inventory WHERE identifier = ? AND LOWER(unit) IN (?, ?) AND siteId = ?',
                  [ing.itemName, normalizedUnit, 'pounds', siteId],
                  (err, rows) => {
                    if (err) {
                      console.error(`Database error querying inventory for ${ing.itemName} at site ${siteId}:`, err.message);
                      errors.push(`Database error for ${ing.itemName}: ${err.message}`);
                    } else {
                      console.log(`Inventory rows for ${ing.itemName} (${normalizedUnit}) at site ${siteId}:`, rows);
                      const available = rows.reduce((sum, row) => {
                        const qty = parseFloat(row.quantity);
                        return sum + (isNaN(qty) ? 0 : qty);
                      }, 0);
                      console.log(`Inventory check for ${ing.itemName} (${normalizedUnit}) at site ${siteId}: Available ${available}, Needed ${ing.quantity}`);
                      if (available < ing.quantity) {
                        errors.push(`Insufficient inventory for ${ing.itemName}: ${available}${normalizedUnit} available, ${ing.quantity}${normalizedUnit} needed`);
                      } else {
                        inventoryUpdates.push({ itemName: ing.itemName, quantity: ing.quantity, unit: normalizedUnit });
                      }
                    }
                    remaining--;
                    if (remaining === 0) finishValidation(inventoryUpdates);
                  }
                );
              });
            });
          }

          function finishValidation(inventoryUpdates) {
            if (errors.length > 0) {
              console.log('Inventory validation errors:', errors);
              return res.status(400).json({ error: errors.join('; ') });
            }
            createBatch(inventoryUpdates);
          }

          function createBatch(inventoryUpdates) {
            db.run(
              'INSERT INTO batches (batchId, productId, recipeId, siteId, status, date, additionalIngredients, equipmentId, volume) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
              [batchId, productId, recipeId, siteId, status, date, JSON.stringify([]), equipmentId || null, volume],
              function(err) {
                if (err) {
                  console.error('Error inserting batch:', err);
                  return res.status(500).json({ error: `Database error inserting batch: ${err.message}` });
                }
                console.log('Batch created:', { id: this.lastID, batchId, productId, recipeId, siteId, status, date, equipmentId, volume });
                let remainingUpdates = inventoryUpdates.length;
                if (remainingUpdates === 0) {
                  return res.json({ id: this.lastID, batchId, productId, recipeId, siteId, status, date, additionalIngredients: [], equipmentId, volume });
                }
                inventoryUpdates.forEach(({ itemName, quantity, unit }, index) => {
                  db.run(
                    'UPDATE inventory SET quantity = CAST(quantity AS REAL) - ? WHERE identifier = ? AND LOWER(unit) IN (?, ?) AND siteId = ?',
                    [quantity, itemName, unit, 'pounds', siteId],
                    (err) => {
                      if (err) {
                        console.error(`Error updating inventory for ${itemName} at index ${index}:`, err);
                        db.run('DELETE FROM batches WHERE batchId = ?', [batchId], () => {
                          res.status(500).json({ error: `Failed to update inventory for ${itemName}: ${err.message}` });
                        });
                        return;
                      }
                      console.log(`Inventory deducted: ${quantity}${unit} for ${itemName} at site ${siteId}`);
                      remainingUpdates--;
                      if (remainingUpdates === 0) {
                        res.json({ id: this.lastID, batchId, productId, recipeId, siteId, status, date, additionalIngredients: [], equipmentId, volume });
                      }
                    }
                  );
                });
              }
            );
          }
        });
      });
    });
  } catch (err) {
    console.error('Unexpected error in /api/batches:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/batches/:batchId/equipment', (req, res) => {
  const { batchId } = req.params;
  const { equipmentId, ingredients, stage } = req.body;
  if (!stage) {
    console.error('POST /api/batches/:batchId/equipment: Missing stage', { batchId, equipmentId, stage });
    return res.status(400).json({ error: 'stage is required' });
  }
  if (stage !== 'Completed' && !equipmentId) {
    console.error('POST /api/batches/:batchId/equipment: Missing equipmentId for non-Completed stage', { batchId, equipmentId, stage });
    return res.status(400).json({ error: 'equipmentId is required for non-Completed stage' });
  }
  const validStages = ['Mashing', 'Boiling', 'Fermenting', 'Bright Tank', 'Packaging', 'Completed'];
  if (!validStages.includes(stage)) {
    console.error('POST /api/batches/:batchId/equipment: Invalid stage', { batchId, stage });
    return res.status(400).json({ error: `Invalid stage. Must be one of: ${validStages.join(', ')}` });
  }
  db.get('SELECT siteId FROM batches WHERE batchId = ?', [batchId], (err, batch) => {
    if (err) {
      console.error('POST /api/batches/:batchId/equipment: Fetch batch error:', err);
      return res.status(500).json({ error: err.message });
    }
    if (!batch) {
      console.error('POST /api/batches/:batchId/equipment: Batch not found', { batchId });
      return res.status(404).json({ error: 'Batch not found' });
    }
    const validateEquipment = (callback) => {
      if (!equipmentId || stage === 'Completed') return callback();
      db.get('SELECT equipmentId FROM equipment WHERE equipmentId = ? AND siteId = ?', [equipmentId, batch.siteId], (err, equipment) => {
        if (err) {
          console.error('POST /api/batches/:batchId/equipment: Fetch equipment error:', err);
          return res.status(500).json({ error: err.message });
        }
        if (!equipment) {
          console.error('POST /api/batches/:batchId/equipment: Invalid equipmentId', { equipmentId, siteId: batch.siteId });
          return res.status(400).json({ error: `Invalid equipmentId: ${equipmentId} for site ${batch.siteId}` });
        }
        callback();
      });
    };
    validateEquipment(() => {
      db.run(
        `UPDATE batches SET equipmentId = ?, stage = ? WHERE batchId = ?`,
        [equipmentId || null, stage, batchId],
        (err) => {
          if (err) {
            console.error('POST /api/batches/:batchId/equipment: Update error:', err);
            return res.status(500).json({ error: err.message });
          }
          if (ingredients && Array.isArray(ingredients)) {
            const validIngredients = ingredients.filter(ing => ing.itemName && ing.quantity > 0 && ing.unit);
            db.run(
              `UPDATE batches SET additionalIngredients = ? WHERE batchId = ?`,
              [JSON.stringify(validIngredients), batchId],
              (err) => {
                if (err) {
                  console.error('POST /api/batches/:batchId/equipment: Ingredients update error:', err);
                  return res.status(500).json({ error: err.message });
                }
                console.log(`POST /api/batches/:batchId/equipment: Updated batch ${batchId} to equipmentId=${equipmentId}, stage=${stage}, ingredients=`, validIngredients);
                res.json({ message: 'Batch equipment updated successfully' });
              }
            );
          } else {
            console.log(`POST /api/batches/:batchId/equipment: Updated batch ${batchId} to equipmentId=${equipmentId}, stage=${stage}`);
            res.json({ message: 'Batch equipment updated successfully' });
          }
        }
      );
    });
  });
});

app.post('/api/batches/:batchId/package', (req, res) => {
  const { batchId } = req.params;
  const { packageType, quantity, locationId } = req.body;
  if (!packageType || !quantity || quantity <= 0 || !locationId) {
    console.error('POST /api/batches/:batchId/package: Missing required fields', { batchId, packageType, quantity, locationId });
    return res.status(400).json({ error: 'packageType, quantity (> 0), and locationId are required' });
  }
  const packageVolumes = {
    '1/2 BBL Keg': 0.5, // 15.5 gallons
    '1/6 BBL Keg': 0.167, // 5.16 gallons
    '750ml Bottle': 0.006 // ~0.198 gallons
  };
  if (!packageVolumes[packageType]) {
    console.error('POST /api/batches/:batchId/package: Invalid packageType', { packageType });
    return res.status(400).json({ error: `Invalid packageType. Must be one of: ${Object.keys(packageVolumes).join(', ')}` });
  }
  db.get(`
    SELECT b.volume, b.siteId, p.name AS productName
    FROM batches b
    JOIN products p ON b.productId = p.id
    WHERE b.batchId = ?
  `, [batchId], (err, batch) => {
    if (err) {
      console.error('POST /api/batches/:batchId/package: Fetch batch error:', err);
      return res.status(500).json({ error: `Failed to fetch batch: ${err.message}` });
    }
    if (!batch) {
      console.error('POST /api/batches/:batchId/package: Batch not found', { batchId });
      return res.status(404).json({ error: 'Batch not found' });
    }
    console.log('POST /api/batches/:batchId/package: Fetched batch', { batchId, batch });
    if (batch.volume === null || batch.volume === undefined) {
      console.error('POST /api/batches/:batchId/package: Batch volume not set', { batchId });
      return res.status(400).json({ error: 'Batch volume not set' });
    }
    if (!batch.productName) {
      console.error('POST /api/batches/:batchId/package: Product name missing', { batchId });
      return res.status(400).json({ error: 'Product name missing for batch' });
    }
    const volumeUsed = packageVolumes[packageType] * quantity;
    const availableVolume = parseFloat(batch.volume);
    const tolerance = 0.01; // Allow 0.01 barrel overrun
    if (volumeUsed > availableVolume + tolerance) {
      const shortfall = volumeUsed - availableVolume;
      console.log('POST /api/batches/:batchId/package: Volume adjustment needed', { batchId, volumeUsed, availableVolume, shortfall });
      return res.status(200).json({
        prompt: 'volumeAdjustment',
        message: `${volumeUsed.toFixed(3)} barrels needed, ${availableVolume.toFixed(3)} barrels available. Increase batch volume by ${shortfall.toFixed(3)} barrels?`,
        shortfall,
      });
    }
    db.get('SELECT locationId FROM locations WHERE locationId = ? AND siteId = ?', [locationId, batch.siteId], (err, location) => {
      if (err) {
        console.error('POST /api/batches/:batchId/package: Fetch location error:', err);
        return res.status(500).json({ error: `Failed to fetch location: ${err.message}` });
      }
      if (!location) {
        console.error('POST /api/batches/:batchId/package: Invalid locationId', { locationId, siteId: batch.siteId });
        return res.status(400).json({ error: `Invalid locationId: ${locationId} for site ${batch.siteId}` });
      }
      db.serialize(() => {
        db.run('BEGIN TRANSACTION', (err) => {
          if (err) {
            console.error('POST /api/batches/:batchId/package: Begin transaction error:', err);
            return res.status(500).json({ error: 'Failed to start transaction' });
          }
          const newIdentifier = `${batch.productName} ${packageType}`;
          console.log('POST /api/batches/:batchId/package: Checking items table', { newIdentifier });
          // Check if item exists in items table
          db.get('SELECT name FROM items WHERE name = ?', [newIdentifier], (err, item) => {
            if (err) {
              db.run('ROLLBACK');
              console.error('POST /api/batches/:batchId/package: Fetch item error:', err);
              return res.status(500).json({ error: `Failed to check items: ${err.message}` });
            }
            if (!item) {
              console.log('POST /api/batches/:batchId/package: Inserting new item', { newIdentifier });
              // Insert new item into items table
              db.run(
                'INSERT INTO items (name, type, enabled) VALUES (?, ?, ?)',
                [newIdentifier, 'Finished Goods', 1],
                (err) => {
                  if (err) {
                    db.run('ROLLBACK');
                    console.error('POST /api/batches/:batchId/package: Insert item error:', err);
                    return res.status(500).json({ error: `Failed to insert item: ${err.message}` });
                  }
                  console.log('POST /api/batches/:batchId/package: Item inserted', { newIdentifier });
                  proceedWithInventory();
                }
              );
            } else {
              console.log('POST /api/batches/:batchId/package: Item exists', { newIdentifier });
              proceedWithInventory();
            }
          });
          // Function to handle inventory insert/update
          const proceedWithInventory = () => {
            console.log('POST /api/batches/:batchId/package: Checking inventory', {
              identifier: newIdentifier,
              type: 'Finished Goods',
              account: 'Storage',
              siteId: batch.siteId,
              locationId,
            });
            db.get(
              'SELECT quantity FROM inventory WHERE identifier = ? AND type = ? AND account = ? AND siteId = ? AND locationId = ?',
              [newIdentifier, 'Finished Goods', 'Storage', batch.siteId, locationId],
              (err, row) => {
                if (err) {
                  db.run('ROLLBACK');
                  console.error('POST /api/batches/:batchId/package: Fetch inventory error:', err);
                  return res.status(500).json({ error: `Failed to check inventory: ${err.message}` });
                }
                const completePackaging = () => {
                  const newVolume = availableVolume - volumeUsed;
                  console.log('POST /api/batches/:batchId/package: Updating batch volume', { batchId, newVolume, volumeUsed });
                  db.run(
                    'UPDATE batches SET volume = ? WHERE batchId = ?',
                    [newVolume, batchId],
                    (err) => {
                      if (err) {
                        db.run('ROLLBACK');
                        console.error('POST /api/batches/:batchId/package: Update batch volume error:', err);
                        return res.status(500).json({ error: `Failed to update batch volume: ${err.message}` });
                      }
                      db.run('COMMIT', (err) => {
                        if (err) {
                          console.error('POST /api/batches/:batchId/package: Commit transaction error:', err);
                          return res.status(500).json({ error: `Failed to commit transaction: ${err.message}` });
                        }
                        console.log('POST /api/batches/:batchId/package: Success', {
                          batchId,
                          newIdentifier,
                          quantity,
                          newVolume,
                        });
                        res.json({ message: 'Packaging successful', newIdentifier, quantity, newVolume });
                      });
                    }
                  );
                };
                if (row) {
                  const newQuantity = parseFloat(row.quantity) + quantity;
                  console.log('POST /api/batches/:batchId/package: Updating existing inventory', { newIdentifier, newQuantity });
                  db.run(
                    'UPDATE inventory SET quantity = ? WHERE identifier = ? AND type = ? AND account = ? AND siteId = ? AND locationId = ?',
                    [newQuantity, newIdentifier, 'Finished Goods', 'Storage', batch.siteId, locationId],
                    (err) => {
                      if (err) {
                        db.run('ROLLBACK');
                        console.error('POST /api/batches/:batchId/package: Update inventory error:', err);
                        return res.status(500).json({ error: `Failed to update inventory: ${err.message}` });
                      }
                      console.log('POST /api/batches/:batchId/package: Inventory updated', { newIdentifier, newQuantity });
                      completePackaging();
                    }
                  );
                } else {
                  console.log('POST /api/batches/:batchId/package: Inserting new inventory', {
                    newIdentifier,
                    quantity,
                    unit: 'Units',
                    siteId: batch.siteId,
                    locationId,
                  });
                  db.run(
                    `INSERT INTO inventory (identifier, account, type, quantity, unit, receivedDate, source, siteId, locationId, status)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [
                      newIdentifier,
                      'Storage',
                      'Finished Goods',
                      quantity,
                      'Units',
                      new Date().toISOString().split('T')[0],
                      'Packaged',
                      batch.siteId,
                      locationId,
                      'Stored',
                    ],
                    (err) => {
                      if (err) {
                        db.run('ROLLBACK');
                        console.error('POST /api/batches/:batchId/package: Insert inventory error:', err);
                        return res.status(500).json({ error: `Failed to insert inventory: ${err.message}` });
                      }
                      console.log('POST /api/batches/:batchId/package: Inventory inserted', { newIdentifier, quantity });
                      completePackaging();
                    }
                  );
                }
              }
            );
          };
        });
      });
    });
  });
});

// New endpoint: /api/batches/:batchId/adjust-volume (~line 1050, after /api/batches/:batchId/package)
app.post('/api/batches/:batchId/adjust-volume', (req, res) => {
  const { batchId } = req.params;
  const { shortfall } = req.body;
  if (!shortfall || shortfall <= 0) {
    console.error('POST /api/batches/:batchId/adjust-volume: Invalid shortfall', { batchId, shortfall });
    return res.status(400).json({ error: 'Valid shortfall (> 0) required' });
  }
  db.get('SELECT volume FROM batches WHERE batchId = ?', [batchId], (err, batch) => {
    if (err) {
      console.error('POST /api/batches/:batchId/adjust-volume: Fetch batch error:', err);
      return res.status(500).json({ error: err.message });
    }
    if (!batch) {
      console.error('POST /api/batches/:batchId/adjust-volume: Batch not found', { batchId });
      return res.status(404).json({ error: 'Batch not found' });
    }
    const newVolume = batch.volume + shortfall;
    db.run(
      'UPDATE batches SET volume = ? WHERE batchId = ?',
      [newVolume, batchId],
      (err) => {
        if (err) {
          console.error('POST /api/batches/:batchId/adjust-volume: Update volume error:', err);
          return res.status(500).json({ error: err.message });
        }
        // Log adjustment in transactions
        db.run(
          `INSERT INTO transactions (barrelId, type, quantity, proofGallons, date, action, dspNumber)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [batchId, 'Finished Goods', shortfall, 0, new Date().toISOString().split('T')[0], 'VolumeAdjusted', 'DSP-AL-20010'],
          (err) => {
            if (err) {
              console.error('POST /api/batches/:batchId/adjust-volume: Transaction error:', err);
              return res.status(500).json({ error: err.message });
            }
            console.log(`POST /api/batches/:batchId/adjust-volume: Adjusted volume by ${shortfall} to ${newVolume}`);
            res.json({ message: 'Volume adjusted successfully', newVolume });
          }
        );
      }
    );
  });
});

// Add PATCH /api/batches/:batchId/equipment (~line 1100)
app.patch('/api/batches/:batchId/equipment', (req, res) => {
  const { batchId } = req.params;
  const { equipmentId } = req.body;
  if (!equipmentId) {
    return res.status(400).json({ error: 'equipmentId required' });
  }
  db.get('SELECT siteId FROM batches WHERE batchId = ?', [batchId], (err, batch) => {
    if (err) {
      console.error('Fetch batch error:', err);
      return res.status(500).json({ error: err.message });
    }
    if (!batch) {
      return res.status(404).json({ error: 'Batch not found' });
    }
    db.get('SELECT equipmentId FROM equipment WHERE equipmentId = ? AND siteId = ?', [equipmentId, batch.siteId], (err, equipment) => {
      if (err) {
        console.error('Fetch equipment error:', err);
        return res.status(500).json({ error: err.message });
      }
      if (!equipment) {
        return res.status(400).json({ error: `Invalid equipmentId: ${equipmentId} for site ${batch.siteId}` });
      }
      db.run(
        'UPDATE batches SET equipmentId = ? WHERE batchId = ?',
        [equipmentId, batchId],
        (err) => {
          if (err) {
            console.error('Update batch equipment error:', err);
            return res.status(500).json({ error: err.message });
          }
          console.log(`PATCH /api/batches/${batchId}/equipment, updated equipmentId:`, equipmentId);
          db.get(`
            SELECT b.batchId, b.productId, p.name AS productName, b.recipeId, r.name AS recipeName, 
                   b.siteId, s.name AS siteName, b.status, b.date, r.ingredients, b.additionalIngredients, b.equipmentId
            FROM batches b
            JOIN products p ON b.productId = p.id
            JOIN recipes r ON b.recipeId = r.id
            JOIN sites s ON b.siteId = s.siteId
            WHERE b.batchId = ?
          `, [batchId], (err, updatedBatch) => {
            if (err) {
              console.error('Fetch updated batch error:', err);
              return res.status(500).json({ error: err.message });
            }
            const recipeIngredients = JSON.parse(updatedBatch.ingredients || '[]');
            const additionalIngredients = JSON.parse(updatedBatch.additionalIngredients || '[]');
            updatedBatch.ingredients = [
              ...recipeIngredients.map(ing => ({ ...ing, isRecipe: true })),
              ...additionalIngredients.filter(ing => !ing.excluded && (!ing.quantity || ing.quantity > 0)).map(ing => ({ ...ing, isRecipe: false }))
            ];
            updatedBatch.additionalIngredients = additionalIngredients;
            res.json(updatedBatch);
          });
        }
      );
    });
  });
});


app.get('/api/batches/:batchId', (req, res) => {
  const { batchId } = req.params;
  db.get(`
    SELECT b.batchId, b.productId, p.name AS productName, b.recipeId, r.name AS recipeName, 
           b.siteId, s.name AS siteName, b.status, b.date, r.ingredients, b.additionalIngredients, b.equipmentId, b.volume
    FROM batches b
    JOIN products p ON b.productId = p.id
    JOIN recipes r ON b.recipeId = r.id
    JOIN sites s ON b.siteId = s.siteId
    WHERE b.batchId = ?
  `, [batchId], (err, row) => {
    if (err) {
      console.error('Fetch batch error:', err);
      return res.status(500).json({ error: err.message });
    }
    if (!row) {
      console.log(`GET /api/batches/${batchId}: Batch not found`);
      return res.status(404).json({ error: 'Batch not found' });
    }
    const recipeIngredients = JSON.parse(row.ingredients || '[]');
    const additionalIngredients = JSON.parse(row.additionalIngredients || '[]');
    // Filter out excluded recipe ingredients
    const activeRecipeIngredients = recipeIngredients.filter(
      (ing) => !additionalIngredients.some(
        (override) => override.itemName === ing.itemName && 
                      (override.unit || 'lbs').toLowerCase() === (ing.unit || 'lbs').toLowerCase() && 
                      override.excluded === true &&
                      (override.quantity === ing.quantity || override.quantity === undefined)
      )
    );
    // Filter valid additional ingredients
    const filteredAdditionalIngredients = additionalIngredients.filter(
      ing => !ing.excluded && (!ing.quantity || ing.quantity > 0)
    );
    // Combine active ingredients
    const combinedIngredients = [
      ...activeRecipeIngredients.map(ing => ({ ...ing, isRecipe: true })),
      ...filteredAdditionalIngredients.map(ing => ({ ...ing, isRecipe: false }))
    ];
    const batch = {
      ...row,
      ingredients: combinedIngredients,
      additionalIngredients
    };
    console.log(`GET /api/batches/${batchId}, recipeIngredients:`, recipeIngredients);
    console.log(`GET /api/batches/${batchId}, additionalIngredients:`, additionalIngredients);
    console.log(`GET /api/batches/${batchId}, activeRecipeIngredients:`, activeRecipeIngredients);
    console.log(`GET /api/batches/${batchId}, filteredAdditionalIngredients:`, filteredAdditionalIngredients);
    console.log(`GET /api/batches/${batchId}, combinedIngredients:`, combinedIngredients);
    console.log(`GET /api/batches/${batchId}, returning:`, batch);
    res.json(batch);
  });
});

// DELETE /api/batches/:batchId/ingredients
app.delete('/api/batches/:batchId/ingredients', (req, res) => {
  const { batchId } = req.params;
  const { itemName, quantity, unit } = req.body;
  if (!itemName || !quantity || quantity <= 0 || !unit) {
    return res.status(400).json({ error: 'Valid itemName, quantity, and unit required' });
  }
  db.get(`
    SELECT b.siteId, b.additionalIngredients, r.ingredients AS recipeIngredients
    FROM batches b
    JOIN recipes r ON b.recipeId = r.id
    WHERE b.batchId = ?
  `, [batchId], (err, batch) => {
    if (err) {
      console.error('Fetch batch error:', err);
      return res.status(500).json({ error: err.message });
    }
    if (!batch) {
      return res.status(404).json({ error: 'Batch not found' });
    }
    const siteId = batch.siteId;
    let additionalIngredients = batch.additionalIngredients ? JSON.parse(batch.additionalIngredients) : [];
    let recipeIngredients = batch.recipeIngredients ? JSON.parse(batch.recipeIngredients) : [];
    const normalizedUnit = unit.toLowerCase() === 'pounds' ? 'lbs' : unit.toLowerCase();
    console.log(`Attempting to delete ingredient from batch ${batchId}:`, { itemName, quantity, unit: normalizedUnit });

    // Check if ingredient is already excluded
    const isExcluded = additionalIngredients.some(
      ing => ing.itemName === itemName && 
             (ing.unit || 'lbs').toLowerCase() === normalizedUnit && 
             ing.excluded === true &&
             ing.quantity === quantity
    );
    if (isExcluded) {
      console.error(`Ingredient already excluded from batch ${batchId}:`, { itemName, quantity, unit: normalizedUnit });
      return res.status(400).json({ error: 'Ingredient already removed from batch' });
    }

    // Combine ingredients for matching
    const allIngredients = [
      ...recipeIngredients.map(ing => ({ ...ing, isRecipe: true })),
      ...additionalIngredients.filter(ing => !ing.excluded).map(ing => ({ ...ing, isRecipe: false }))
    ];
    console.log(`All ingredients in batch ${batchId}:`, allIngredients);
    const ingredientIndex = allIngredients.findIndex(
      ing => ing.itemName === itemName && ing.quantity === quantity && (ing.unit || 'lbs').toLowerCase() === normalizedUnit
    );
    if (ingredientIndex === -1) {
      console.error(`Ingredient not found in batch ${batchId}:`, { itemName, quantity, unit: normalizedUnit });
      return res.status(400).json({ error: 'Ingredient not found in batch' });
    }

    // Update additionalIngredients
    let newAdditionalIngredients = additionalIngredients;
    if (allIngredients[ingredientIndex].isRecipe) {
      // Mark recipe ingredient as excluded
      newAdditionalIngredients = [
        ...additionalIngredients,
        { itemName, quantity, unit: normalizedUnit, excluded: true }
      ];
    } else {
      // Remove non-recipe ingredient
      newAdditionalIngredients = additionalIngredients.filter(
        ing => !(ing.itemName === itemName && ing.quantity === quantity && (ing.unit || 'lbs').toLowerCase() === normalizedUnit)
      );
    }
    console.log(`Updating batch ${batchId} with new additionalIngredients:`, newAdditionalIngredients);

    db.run(
      'UPDATE batches SET additionalIngredients = ? WHERE batchId = ?',
      [JSON.stringify(newAdditionalIngredients), batchId],
      (err) => {
        if (err) {
          console.error('Update batch ingredients error:', err);
          return res.status(500).json({ error: err.message });
        }
        db.run(
          'UPDATE inventory SET quantity = quantity + ? WHERE identifier = ? AND LOWER(unit) IN (?, ?) AND siteId = ?',
          [quantity, itemName, normalizedUnit, 'pounds', siteId],
          (err) => {
            if (err) {
              console.error('Update inventory error:', err);
              return res.status(500).json({ error: err.message });
            }
            console.log(`Inventory restored: ${quantity}${normalizedUnit} for ${itemName} at site ${siteId}`);
            db.get(`
              SELECT b.batchId, b.productId, p.name AS productName, b.recipeId, r.name AS recipeName, 
                     b.siteId, s.name AS siteName, b.status, b.date, r.ingredients, b.additionalIngredients
              FROM batches b
              JOIN products p ON b.productId = p.id
              JOIN recipes r ON b.recipeId = r.id
              JOIN sites s ON b.siteId = s.siteId
              WHERE b.batchId = ?
            `, [batchId], (err, updatedBatch) => {
              if (err) {
                console.error('Fetch updated batch error:', err);
                return res.status(500).json({ error: err.message });
              }
              const recipeIngredients = JSON.parse(updatedBatch.ingredients || '[]');
              const additionalIngredients = JSON.parse(updatedBatch.additionalIngredients || '[]');
              // Filter out excluded recipe ingredients
              const activeRecipeIngredients = recipeIngredients.filter(
                (ing) => !additionalIngredients.some(
                  (override) => override.itemName === ing.itemName && 
                                (override.unit || 'lbs').toLowerCase() === (ing.unit || 'lbs').toLowerCase() && 
                                override.excluded === true &&
                                override.quantity === ing.quantity
                )
              );
              updatedBatch.ingredients = [
                ...activeRecipeIngredients.map(ing => ({ ...ing, isRecipe: true })),
                ...additionalIngredients.filter(ing => !ing.excluded && (!ing.quantity || ing.quantity > 0)).map(ing => ({ ...ing, isRecipe: false }))
              ];
              updatedBatch.additionalIngredients = additionalIngredients;
              console.log(`DELETE /api/batches/${batchId}/ingredients, removed:`, { itemName, quantity, unit: normalizedUnit });
              console.log(`Returning updated batch:`, updatedBatch);
              res.json(updatedBatch);
            });
          }
        );
      }
    );
  });
});

// POST /api/batches/:batchId/ingredients
app.post('/api/batches/:batchId/ingredients', (req, res) => {
  const { batchId } = req.params;
  const { itemName, quantity, unit } = req.body;
  if (!itemName || !quantity || quantity <= 0 || !unit) {
    return res.status(400).json({ error: 'Valid itemName, quantity, and unit required' });
  }
  db.get('SELECT siteId FROM batches WHERE batchId = ?', [batchId], (err, batch) => {
    if (err) {
      console.error('Fetch batch error:', err);
      return res.status(500).json({ error: err.message });
    }
    if (!batch) {
      return res.status(404).json({ error: 'Batch not found' });
    }
    const siteId = batch.siteId;
    db.get('SELECT name FROM items WHERE name = ?', [itemName], (err, item) => {
      if (err) {
        console.error('Fetch item error:', err);
        return res.status(500).json({ error: err.message });
      }
      if (!item) {
        return res.status(400).json({ error: `Item not found: ${itemName}` });
      }
      const normalizedUnit = unit.toLowerCase() === 'pounds' ? 'lbs' : unit.toLowerCase();
      console.log(`Checking inventory: itemName=${itemName}, unit=${normalizedUnit}, siteId=${siteId}`);
      db.get(
        'SELECT SUM(CAST(quantity AS REAL)) as total FROM inventory WHERE identifier = ? AND LOWER(unit) IN (?, ?) AND siteId = ?',
        [itemName, normalizedUnit, 'pounds', siteId],
        (err, row) => {
          if (err) {
            console.error('Inventory check error:', err);
            return res.status(500).json({ error: err.message });
          }
          const available = row && row.total ? parseFloat(row.total) : 0;
          console.log(`Inventory result: ${available}${normalizedUnit} available for ${itemName} at site ${siteId}`);
          if (available < quantity) {
            return res.status(400).json({ error: `Insufficient inventory for ${itemName}: ${available}${normalizedUnit} available, ${quantity}${normalizedUnit} needed` });
          }
          db.get('SELECT additionalIngredients FROM batches WHERE batchId = ?', [batchId], (err, batchRow) => {
            if (err) {
              console.error('Fetch batch error:', err);
              return res.status(500).json({ error: err.message });
            }
            let additionalIngredients = batchRow.additionalIngredients ? JSON.parse(batchRow.additionalIngredients) : [];
            console.log(`Current additionalIngredients before adding:`, additionalIngredients);
            // Clean up stale overrides (e.g., zero-quantity or invalid entries)
            additionalIngredients = additionalIngredients.filter(
              ing => !ing.excluded || (ing.excluded && ing.itemName !== itemName) || (ing.quantity && ing.quantity > 0)
            );
            additionalIngredients.push({ itemName, quantity, unit: normalizedUnit });
            console.log(`New additionalIngredients after adding:`, additionalIngredients);
            db.run(
              'UPDATE batches SET additionalIngredients = ? WHERE batchId = ?',
              [JSON.stringify(additionalIngredients), batchId],
              (err) => {
                if (err) {
                  console.error('Update batch ingredients error:', err);
                  return res.status(500).json({ error: err.message });
                }
                db.run(
                  'UPDATE inventory SET quantity = quantity - ? WHERE identifier = ? AND LOWER(unit) IN (?, ?) AND siteId = ?',
                  [quantity, itemName, normalizedUnit, 'pounds', siteId],
                  (err) => {
                    if (err) {
                      console.error('Update inventory error:', err);
                      return res.status(500).json({ error: err.message });
                    }
                    console.log(`Inventory updated: deducted ${quantity}${normalizedUnit} for ${itemName} at site ${siteId}`);
                    db.get(`
                      SELECT b.batchId, b.productId, p.name AS productName, b.recipeId, r.name AS recipeName, 
                             b.siteId, s.name AS siteName, b.status, b.date, r.ingredients, b.additionalIngredients
                      FROM batches b
                      JOIN products p ON b.productId = p.id
                      JOIN recipes r ON b.recipeId = r.id
                      JOIN sites s ON b.siteId = s.siteId
                      WHERE b.batchId = ?
                    `, [batchId], (err, updatedBatch) => {
                      if (err) {
                        console.error('Fetch updated batch error:', err);
                        return res.status(500).json({ error: err.message });
                      }
                      const recipeIngredients = JSON.parse(updatedBatch.ingredients || '[]');
                      const additionalIngredients = JSON.parse(updatedBatch.additionalIngredients || '[]');
                      const activeRecipeIngredients = recipeIngredients.filter(
                        (ing) => !additionalIngredients.some(
                          (override) => override.itemName === ing.itemName && 
                                        (override.unit || 'lbs').toLowerCase() === (ing.unit || 'lbs').toLowerCase() && 
                                        override.excluded === true &&
                                        (override.quantity === ing.quantity || override.quantity === undefined)
                        )
                      );
                      updatedBatch.ingredients = [
                        ...activeRecipeIngredients.map(ing => ({ ...ing, isRecipe: true })),
                        ...additionalIngredients.filter(ing => !ing.excluded && (!ing.quantity || ing.quantity > 0)).map(ing => ({ ...ing, isRecipe: false }))
                      ];
                      updatedBatch.additionalIngredients = additionalIngredients;
                      console.log(`POST /api/batches/${batchId}/ingredients, added:`, { itemName, quantity, unit: normalizedUnit });
                      console.log(`Returning updated batch:`, updatedBatch);
                      res.json(updatedBatch);
                    });
                  }
                );
              }
            );
          });
        }
      );
    });
  });
});

// DELETE /api/batches/:batchId/ingredients
app.delete('/api/batches/:batchId/ingredients', (req, res) => {
  const { batchId } = req.params;
  const { itemName, quantity, unit } = req.body;
  if (!itemName || !quantity || quantity <= 0 || !unit) {
    return res.status(400).json({ error: 'Valid itemName, quantity, and unit required' });
  }
  db.get(`
    SELECT b.siteId, b.additionalIngredients, r.ingredients AS recipeIngredients
    FROM batches b
    JOIN recipes r ON b.recipeId = r.id
    WHERE b.batchId = ?
  `, [batchId], (err, batch) => {
    if (err) {
      console.error('Fetch batch error:', err);
      return res.status(500).json({ error: err.message });
    }
    if (!batch) {
      return res.status(404).json({ error: 'Batch not found' });
    }
    const siteId = batch.siteId;
    let additionalIngredients = batch.additionalIngredients ? JSON.parse(batch.additionalIngredients) : [];
    let recipeIngredients = batch.recipeIngredients ? JSON.parse(batch.recipeIngredients) : [];
    const normalizedUnit = unit.toLowerCase() === 'pounds' ? 'lbs' : unit.toLowerCase();
    console.log(`Attempting to delete ingredient from batch ${batchId}:`, { itemName, quantity, unit: normalizedUnit });

    // Check if ingredient is already excluded
    const isExcluded = additionalIngredients.some(
      ing => ing.itemName === itemName && 
             (ing.unit || 'lbs').toLowerCase() === normalizedUnit && 
             ing.excluded === true
    );
    if (isExcluded) {
      console.error(`Ingredient already excluded from batch ${batchId}:`, { itemName, unit: normalizedUnit });
      return res.status(400).json({ error: 'Ingredient already removed from batch' });
    }

    // Combine ingredients for matching
    const allIngredients = [
      ...recipeIngredients.map(ing => ({ ...ing, isRecipe: true })),
      ...additionalIngredients.filter(ing => !ing.excluded).map(ing => ({ ...ing, isRecipe: false }))
    ];
    console.log(`All ingredients in batch ${batchId}:`, allIngredients);
    const ingredientIndex = allIngredients.findIndex(
      ing => ing.itemName === itemName && ing.quantity === quantity && (ing.unit || 'lbs').toLowerCase() === normalizedUnit
    );
    if (ingredientIndex === -1) {
      console.error(`Ingredient not found in batch ${batchId}:`, { itemName, quantity, unit: normalizedUnit });
      return res.status(400).json({ error: 'Ingredient not found in batch' });
    }

    // Update additionalIngredients
    let newAdditionalIngredients = additionalIngredients;
    if (allIngredients[ingredientIndex].isRecipe) {
      // Mark recipe ingredient as excluded
      newAdditionalIngredients = [
        ...additionalIngredients,
        { itemName, unit: normalizedUnit, excluded: true }
      ];
    } else {
      // Remove non-recipe ingredient
      newAdditionalIngredients = additionalIngredients.filter(
        ing => !(ing.itemName === itemName && ing.quantity === quantity && (ing.unit || 'lbs').toLowerCase() === normalizedUnit)
      );
    }
    console.log(`Updating batch ${batchId} with new additionalIngredients:`, newAdditionalIngredients);

    db.run(
      'UPDATE batches SET additionalIngredients = ? WHERE batchId = ?',
      [JSON.stringify(newAdditionalIngredients), batchId],
      (err) => {
        if (err) {
          console.error('Update batch ingredients error:', err);
          return res.status(500).json({ error: err.message });
        }
        db.run(
          'UPDATE inventory SET quantity = quantity + ? WHERE identifier = ? AND LOWER(unit) IN (?, ?) AND siteId = ?',
          [quantity, itemName, normalizedUnit, 'pounds', siteId],
          (err) => {
            if (err) {
              console.error('Update inventory error:', err);
              return res.status(500).json({ error: err.message });
            }
            console.log(`Inventory restored: ${quantity}${normalizedUnit} for ${itemName} at site ${siteId}`);
            db.get(`
              SELECT b.batchId, b.productId, p.name AS productName, b.recipeId, r.name AS recipeName, 
                     b.siteId, s.name AS siteName, b.status, b.date, r.ingredients, b.additionalIngredients
              FROM batches b
              JOIN products p ON b.productId = p.id
              JOIN recipes r ON b.recipeId = r.id
              JOIN sites s ON b.siteId = s.siteId
              WHERE b.batchId = ?
            `, [batchId], (err, updatedBatch) => {
              if (err) {
                console.error('Fetch updated batch error:', err);
                return res.status(500).json({ error: err.message });
              }
              const recipeIngredients = JSON.parse(updatedBatch.ingredients || '[]');
              const additionalIngredients = JSON.parse(updatedBatch.additionalIngredients || '[]');
              // Filter out excluded recipe ingredients
              const activeRecipeIngredients = recipeIngredients.filter(
                (ing) => !additionalIngredients.some(
                  (override) => override.itemName === ing.itemName && 
                                (override.unit || 'lbs').toLowerCase() === (ing.unit || 'lbs').toLowerCase() && 
                                override.excluded === true
                )
              );
              updatedBatch.ingredients = [
                ...activeRecipeIngredients.map(ing => ({ ...ing, isRecipe: true })),
                ...additionalIngredients.filter(ing => !ing.excluded && ing.quantity > 0).map(ing => ({ ...ing, isRecipe: false }))
              ];
              updatedBatch.additionalIngredients = additionalIngredients;
              console.log(`DELETE /api/batches/${batchId}/ingredients, removed:`, { itemName, quantity, unit: normalizedUnit });
              console.log(`Returning updated batch:`, updatedBatch);
              res.json(updatedBatch);
            });
          }
        );
      }
    );
  });
});

// PATCH /api/batches/:batchId
app.patch('/api/batches/:batchId', (req, res) => {
  const { batchId } = req.params;
  const { status, batchId: newBatchId } = req.body;
  if (!status && !newBatchId) {
    return res.status(400).json({ error: 'Status or new batchId required' });
  }
  db.get('SELECT status FROM batches WHERE batchId = ?', [batchId], (err, batch) => {
    if (err) {
      console.error('Fetch batch error:', err);
      return res.status(500).json({ error: err.message });
    }
    if (!batch) {
      return res.status(404).json({ error: 'Batch not found' });
    }
    const updates = [];
    const values = [];
    if (status && ['In Progress', 'Completed'].includes(status)) {
      updates.push('status = ?');
      values.push(status);
    }
    if (newBatchId) {
      updates.push('batchId = ?');
      values.push(newBatchId);
    }
    if (updates.length === 0) {
      return res.status(400).json({ error: 'No valid updates provided' });
    }
    values.push(batchId);
    db.run(
      `UPDATE batches SET ${updates.join(', ')} WHERE batchId = ?`,
      values,
      (err) => {
        if (err) {
          console.error('Update batch error:', err);
          return res.status(500).json({ error: err.message });
        }
        db.get(`
          SELECT b.batchId, b.productId, p.name AS productName, b.recipeId, r.name AS recipeName, 
                 b.siteId, s.name AS siteName, b.status, b.date, r.ingredients, b.additionalIngredients
          FROM batches b
          JOIN products p ON b.productId = p.id
          JOIN recipes r ON b.recipeId = r.id
          JOIN sites s ON b.siteId = s.siteId
          WHERE b.batchId = ?
        `, [newBatchId || batchId], (err, updatedBatch) => {
          if (err) {
            console.error('Fetch updated batch error:', err);
            return res.status(500).json({ error: err.message });
          }
          const recipeIngredients = JSON.parse(updatedBatch.ingredients || '[]');
          const additionalIngredients = JSON.parse(updatedBatch.additionalIngredients || '[]');
          updatedBatch.ingredients = [
            ...recipeIngredients.map(ing => ({ ...ing, isRecipe: true })),
            ...additionalIngredients.filter(ing => !ing.excluded && (!ing.quantity || ing.quantity > 0)).map(ing => ({ ...ing, isRecipe: false }))
          ];
          updatedBatch.additionalIngredients = additionalIngredients;
          console.log(`PATCH /api/batches/${batchId}, updated:`, updatedBatch);
          res.json(updatedBatch);
        });
      }
    );
  });
});

// Replace DELETE /api/batches/:batchId (~line 600)
app.delete('/api/batches/:batchId', (req, res) => {
  const { batchId } = req.params;
  db.get('SELECT status FROM batches WHERE batchId = ?', [batchId], (err, batch) => {
    if (err) {
      console.error('Fetch batch error:', err);
      return res.status(500).json({ error: err.message });
    }
    if (!batch) {
      return res.status(404).json({ error: 'Batch not found' });
    }
    if (batch.status === 'Completed') {
      console.log(`DELETE /api/batches/${batchId}: Cannot delete completed batch`);
      return res.status(403).json({ error: 'Cannot delete a completed batch' });
    }
    db.run('DELETE FROM batches WHERE batchId = ?', [batchId], (err) => {
      if (err) {
        console.error('Delete batch error:', err);
        return res.status(500).json({ error: err.message });
      }
      console.log(`DELETE /api/batches/${batchId}: Batch deleted`);
      res.json({ message: 'Batch deleted' });
    });
  });
});

// POST /api/batches/:batchId/actions
app.post('/api/batches/:batchId/actions', (req, res) => {
  const { batchId } = req.params;
  const { action } = req.body;
  if (!action) {
    return res.status(400).json({ error: 'Action description required' });
  }
  db.run(
    'INSERT INTO batch_actions (batchId, action, timestamp) VALUES (?, ?, ?)',
    [batchId, action, new Date().toISOString()],
    function(err) {
      if (err) {
        console.error('Insert batch action error:', err);
        return res.status(500).json({ error: err.message });
      }
      console.log(`POST /api/batches/${batchId}/actions, added:`, { id: this.lastID, action });
      res.json({ id: this.lastID, batchId, action, timestamp: new Date().toISOString() });
    }
  );
});

// GET /api/batches/:batchId/actions
app.get('/api/batches/:batchId/actions', (req, res) => {
  const { batchId } = req.params;
  db.all('SELECT id, action, timestamp FROM batch_actions WHERE batchId = ?', [batchId], (err, rows) => {
    if (err) {
      console.error('Fetch batch actions error:', err);
      return res.status(500).json({ error: err.message });
    }
    console.log(`GET /api/batches/${batchId}/actions, returning:`, rows);
    res.json(rows);
  });
});

// Add POST /api/batches/:batchId/brewlog (~line 650)
app.post('/api/batches/:batchId/brewlog', (req, res) => {
  const { batchId } = req.params;
  const { date, notes, temperature, gravity } = req.body;
  if (!date || !notes) {
    return res.status(400).json({ error: 'Date and notes are required' });
  }
  db.get('SELECT brewLog FROM batches WHERE batchId = ?', [batchId], (err, batch) => {
    if (err) {
      console.error('Fetch batch error:', err);
      return res.status(500).json({ error: err.message });
    }
    if (!batch) {
      return res.status(404).json({ error: 'Batch not found' });
    }
    const brewLog = { date, notes, temperature, gravity };
    db.run(
      'UPDATE batches SET brewLog = ? WHERE batchId = ?',
      [JSON.stringify(brewLog), batchId],
      (err) => {
        if (err) {
          console.error('Update brew log error:', err);
          return res.status(500).json({ error: err.message });
        }
        console.log(`POST /api/batches/${batchId}/brewlog, saved:`, brewLog);
        res.json(brewLog);
      }
    );
  });
});

// Add GET /api/batches/:batchId/brewlog (~line 650)
app.get('/api/batches/:batchId/brewlog', (req, res) => {
  const { batchId } = req.params;
  db.get('SELECT brewLog FROM batches WHERE batchId = ?', [batchId], (err, batch) => {
    if (err) {
      console.error('Fetch brew log error:', err);
      return res.status(500).json({ error: err.message });
    }
    if (!batch) {
      return res.status(404).json({ error: 'Batch not found' });
    }
    const brewLog = batch.brewLog ? JSON.parse(batch.brewLog) : null;
    console.log(`GET /api/batches/${batchId}/brewlog, returning:`, brewLog);
    res.json(brewLog || {});
  });
});

// Update /api/recipes to handle ingredients (replace existing /api/recipes, ~line 600)
app.get('/api/recipes', (req, res) => {
  const productId = req.query.productId;
  if (!productId) {
    return res.status(400).json({ error: 'productId query parameter is required' });
  }
  db.all('SELECT id, name, productId, ingredients, quantity, unit FROM recipes WHERE productId = ?', [productId], (err, rows) => {
    if (err) {
      console.error('Fetch recipes error:', err);
      return res.status(500).json({ error: err.message });
    }
    const recipes = rows.map(row => ({
      ...row,
      ingredients: JSON.parse(row.ingredients || '[]'),
    }));
    console.log('GET /api/recipes, returning:', recipes);
    res.json(recipes);
  });
});

app.post('/api/recipes', (req, res) => {
  const { name, productId, ingredients, quantity, unit } = req.body;
  if (!name || !productId || !Array.isArray(ingredients) || ingredients.length === 0 || !quantity || !unit) {
    console.log('POST /api/recipes: Missing required fields', req.body);
    return res.status(400).json({ error: 'Name, productId, ingredients, quantity, and unit are required' });
  }
  if (isNaN(quantity) || quantity <= 0) {
    return res.status(400).json({ error: 'Quantity must be a positive number' });
  }
  if (!['gallons', 'liters', 'barrels'].includes(unit.toLowerCase())) {
    return res.status(400).json({ error: 'Unit must be gallons, liters, or barrels' });
  }
  db.get('SELECT id FROM products WHERE id = ?', [productId], (err, product) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!product) return res.status(400).json({ error: 'Invalid productId' });
    const invalidIngredients = ingredients.filter(ing => !ing.itemName || isNaN(ing.quantity) || ing.quantity <= 0);
    if (invalidIngredients.length > 0) {
      return res.status(400).json({ error: 'All ingredients must have a valid itemName and positive quantity' });
    }
    const checks = ingredients.map(ing => new Promise((resolve, reject) => {
      db.get('SELECT name FROM items WHERE name = ? AND enabled = 1', [ing.itemName], (err, item) => {
        if (err) return reject(err);
        if (!item) return reject(new Error(`Item not found: ${ing.itemName}`));
        resolve();
      });
    }));
    Promise.all(checks).then(() => {
      db.run(
        'INSERT INTO recipes (name, productId, ingredients, quantity, unit) VALUES (?, ?, ?, ?, ?)',
        [name, productId, JSON.stringify(ingredients), quantity, unit.toLowerCase()],
        function(err) {
          if (err) {
            console.error('Insert recipe error:', err);
            return res.status(500).json({ error: err.message });
          }
          const newRecipe = { id: this.lastID, name, productId, ingredients, quantity, unit: unit.toLowerCase() };
          console.log('POST /api/recipes, added:', newRecipe);
          res.json(newRecipe);
        }
      );
    }).catch(err => {
      console.error('Ingredient validation error:', err);
      res.status(400).json({ error: err.message });
    });
  });
});

// Existing routes (unchanged)
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
    query += ' AND supplier = ?';
    params.push(source);
  }
  db.all(query, params, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows.map(row => ({
      ...row,
      items: JSON.parse(row.items || '[]'),
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
  console.log('Received PO:', req.body);
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
        console.error('Insert PO error:', err.message);
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

app.get('/api/debug/inventory-rows', (req, res) => {
  const { identifier, siteId, unit } = req.query;
  let query = 'SELECT * FROM inventory';
  let params = [];
  let conditions = [];
  if (identifier) {
    conditions.push('identifier = ?');
    params.push(identifier);
  }
  if (siteId) {
    conditions.push('siteId = ?');
    params.push(siteId);
  }
  if (unit) {
    conditions.push('LOWER(unit) IN (?, ?)');
    params.push(unit.toLowerCase(), 'pounds');
  }
  if (conditions.length > 0) {
    query += ' WHERE ' + conditions.join(' AND ');
  }
  db.all(query, params, (err, rows) => {
    if (err) {
      console.error('Debug inventory rows error:', err);
      return res.status(500).json({ error: err.message });
    }
    console.log('Debug inventory rows:', rows);
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
  const { quantity, proof, totalCost, description, status, account } = req.body;
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
      const unitCost = row.cost ? parseFloat(row.cost) : (parseFloat(row.totalCost) / oldQuantity) || 0;
      const newTotalCost = (unitCost * newQuantityNum).toFixed(2);
      const quantityDiff = (oldQuantity - newQuantityNum).toFixed(2);

      db.run(
        'UPDATE inventory SET quantity = ?, totalCost = ? WHERE identifier = ?',
        [newQuantity, newTotalCost, identifier],
        (err) => {
          if (err) {
            db.run('ROLLBACK');
            return res.status(500).json({ error: err.message });
          }

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

app.get('/api/products/:id/recipes', (req, res) => {
  const id = parseInt(req.params.id);
  const mockRecipes = id === 1
    ? [{ id: 1, productId: 1, name: 'Whiskey Recipe', ingredients: 'Corn, Barley, Water', instructions: 'Distill and age' }]
    : [{ id: 2, productId: 2, name: 'IPA Recipe', ingredients: 'Hops, Malt, Yeast', instructions: 'Ferment and hop' }];
  res.json(mockRecipes);
});

// Mock product storage
let mockProducts = [
  { id: 1, name: 'Whiskey', abbreviation: 'WH', enabled: true, priority: 1, class: 'Distilled', productColor: 'Amber', type: 'Spirits', style: 'Bourbon', abv: 40, ibu: 0 },
  { id: 2, name: 'IPA', abbreviation: 'IP', enabled: true, priority: 2, class: 'Beer', productColor: 'Golden', type: 'Malt', style: 'American IPA', abv: 6.5, ibu: 60 },
];

// Products endpoints
app.get('/api/products', (req, res) => {
  console.log('GET /api/products, returning:', mockProducts);
  res.json(mockProducts);
});

app.get('/api/products/:id', (req, res) => {
  const id = parseInt(req.params.id);
  const product = mockProducts.find(p => p.id === id);
  if (!product) {
    console.log(`GET /api/products/${id}: Product not found`);
    return res.status(404).json({ error: 'Product not found' });
  }
  console.log(`GET /api/products/${id}, returning:`, product);
  res.json(product);
});

app.post('/api/products', (req, res) => {
  console.log('POST /api/products, payload:', req.body);
  const { name, abbreviation, enabled = true, priority = 1, class: prodClass, productColor, type, style, abv = 0, ibu = 0 } = req.body;
  if (!name || !abbreviation || !type || !style) {
    console.log('POST /api/products: Missing required fields');
    return res.status(400).json({ error: 'Name, abbreviation, type, and style are required' });
  }
  const validProductTypes = ['Malt', 'Spirits', 'Wine', 'Merchandise', 'Cider', 'Seltzer'];
  if (!validProductTypes.includes(type)) {
    console.log(`POST /api/products: Invalid type: ${type}`);
    return res.status(400).json({ error: `Invalid product type. Must be one of: ${validProductTypes.join(', ')}` });
  }
  if ((type === 'Seltzer' || type === 'Merchandise') && style !== 'Other') {
    console.log(`POST /api/products: Invalid style for ${type}: ${style}`);
    return res.status(400).json({ error: 'Style must be "Other" for Seltzer or Merchandise' });
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
  mockProducts.push(newProduct);
  console.log('POST /api/products, added:', newProduct);
  res.json(newProduct);
});

app.delete('/api/products', (req, res) => {
  console.log('DELETE /api/products, payload:', req.body);
  const { ids } = req.body;
  if (!ids || !Array.isArray(ids)) {
    console.log('DELETE /api/products: Invalid IDs');
    return res.status(400).json({ error: 'IDs array is required' });
  }
  mockProducts = mockProducts.filter(p => !ids.includes(p.id));
  console.log('DELETE /api/products, deleted IDs:', ids);
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
  const { identifier, quantityLost, proofGallonsLost, reason, date, dspNumber } = req.body;
  const requiredFields = { identifier, quantityLost, reason, date };
  const missingFields = Object.entries(requiredFields)
    .filter(([_, value]) => value === undefined || value === null || value === '')
    .map(([key]) => key);
  if (missingFields.length > 0) {
    console.error('POST /api/record-loss: Missing required fields', { missingFields, reqBody: req.body });
    return res.status(400).json({ error: `Missing required fields: ${missingFields.join(', ')}` });
  }
  if (isNaN(parseFloat(quantityLost)) || parseFloat(quantityLost) < 0) {
    console.error('POST /api/record-loss: Invalid quantityLost', { quantityLost });
    return res.status(400).json({ error: 'quantityLost must be a non-negative number' });
  }
  const parsedProofGallonsLost = proofGallonsLost !== undefined ? parseFloat(proofGallonsLost) : 0;
  if (isNaN(parsedProofGallonsLost) || parsedProofGallonsLost < 0) {
    console.error('POST /api/record-loss: Invalid proofGallonsLost', { proofGallonsLost });
    return res.status(400).json({ error: 'proofGallonsLost must be a non-negative number or 0' });
  }
  const effectiveDspNumber = dspNumber || 'DSP-AL-20010';
  console.log('POST /api/record-loss: Processing loss', {
    identifier,
    quantityLost,
    proofGallonsLost: parsedProofGallonsLost,
    reason,
    date,
    dspNumber: effectiveDspNumber,
  });

  // Try to find an inventory item first
  db.get(
    'SELECT siteId, locationId, quantity FROM inventory WHERE identifier = ? AND status IN (?, ?)',
    [identifier, 'Received', 'Stored'],
    (err, inventoryRow) => {
      if (err) {
        console.error('POST /api/record-loss: Fetch inventory error:', err);
        return res.status(500).json({ error: `Failed to fetch inventory: ${err.message}` });
      }
      if (inventoryRow) {
        // Inventory item found, update quantity
        const { siteId, locationId, quantity } = inventoryRow;
        const newQuantity = parseFloat(quantity) - parseFloat(quantityLost);
        if (newQuantity < 0) {
          console.error('POST /api/record-loss: Insufficient quantity', { identifier, currentQuantity: quantity, quantityLost });
          return res.status(400).json({ error: `Insufficient quantity: ${quantityLost} requested, ${quantity} available` });
        }
        db.run(
          `INSERT INTO inventory_losses (identifier, quantityLost, proofGallonsLost, reason, date, dspNumber, siteId, locationId)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            identifier,
            parseFloat(quantityLost),
            parsedProofGallonsLost,
            reason,
            date,
            effectiveDspNumber,
            siteId,
            locationId,
          ],
          (err) => {
            if (err) {
              console.error('POST /api/record-loss: Insert loss error:', err);
              return res.status(500).json({ error: `Failed to record loss: ${err.message}` });
            }
            db.run(
              'UPDATE inventory SET quantity = ? WHERE identifier = ? AND siteId = ? AND locationId = ? AND status IN (?, ?)',
              [newQuantity, identifier, siteId, locationId, 'Received', 'Stored'],
              (err) => {
                if (err) {
                  console.error('POST /api/record-loss: Update inventory error:', err);
                  return res.status(500).json({ error: `Failed to update inventory: ${err.message}` });
                }
                console.log('POST /api/record-loss: Success (inventory loss)', { identifier, quantityLost, newQuantity });
                res.json({ message: 'Loss recorded successfully' });
              }
            );
          }
        );
      } else {
        // No inventory item, check if identifier is a batch
        console.log('POST /api/record-loss: No inventory item, checking batch', { identifier });
        db.get(
          'SELECT siteId FROM batches WHERE batchId = ?',
          [identifier],
          (err, batchRow) => {
            if (err) {
              console.error('POST /api/record-loss: Fetch batch error:', err);
              return res.status(500).json({ error: `Failed to fetch batch: ${err.message}` });
            }
            if (!batchRow) {
              console.error('POST /api/record-loss: Neither inventory nor batch found', { identifier });
              return res.status(404).json({ error: `Neither inventory item nor batch found: ${identifier}` });
            }
            const { siteId } = batchRow;
            // Use null for locationId since this is a batch-level loss
            console.log('POST /api/record-loss: Recording batch-level loss', { identifier, siteId, locationId: null });
            db.run(
              `INSERT INTO inventory_losses (identifier, quantityLost, proofGallonsLost, reason, date, dspNumber, siteId, locationId)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
              [
                identifier,
                parseFloat(quantityLost),
                parsedProofGallonsLost,
                reason,
                date,
                effectiveDspNumber,
                siteId,
                null, // Batch-level loss, no specific location
              ],
              (err) => {
                if (err) {
                  console.error('POST /api/record-loss: Insert batch loss error:', err);
                  return res.status(500).json({ error: `Failed to record batch loss: ${err.message}` });
                }
                console.log('POST /api/record-loss: Success (batch loss)', { identifier, quantityLost });
                res.json({ message: 'Batch loss recorded successfully' });
              }
            );
          }
        );
      }
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
  if (!siteId) {
    console.error('GET /api/facility-design: Missing siteId');
    return res.status(400).json({ error: 'siteId parameter is required' });
  }
  db.get(
    `SELECT objects FROM facility_designs WHERE siteId = ?`,
    [siteId],
    (err, row) => {
      if (err) {
        console.error('GET /api/facility-design fetch error:', err);
        return res.status(500).json({ error: err.message });
      }
      if (!row) {
        console.log(`GET /api/facility-design: No design found for siteId=${siteId}`);
        return res.json({ objects: [] });
      }
      let objects;
      try {
        objects = JSON.parse(row.objects || '[]');
        console.log('Parsed objects from facility_designs:', objects);
      } catch (e) {
        console.error('GET /api/facility-design: Error parsing objects JSON', e);
        return res.status(500).json({ error: 'Invalid design data format' });
      }
      db.all(`
        SELECT DISTINCT l.locationId, l.name AS locationName, l.abbreviation AS locationAbbreviation,
               e.equipmentId, e.name AS equipmentName, e.abbreviation AS equipmentAbbreviation,
               b.batchId, b.status, b.date
        FROM equipment e
        LEFT JOIN locations l ON l.siteId = e.siteId
        LEFT JOIN batches b ON e.equipmentId = b.equipmentId
        WHERE e.siteId = ? OR l.siteId = ?
      `, [siteId, siteId], (err, rows) => {
        if (err) {
          console.error('GET /api/facility-design enrichment error:', err);
          return res.status(500).json({ error: err.message });
        }
        console.log('Enrichment query rows:', rows);
        const enrichedObjects = objects.map((obj) => {
          const location = rows.find(row => row.locationId === obj.locationId);
          const equipment = rows.find(row => row.equipmentId === obj.equipmentId);
          const batches = rows
            .filter(row => row.equipmentId === obj.equipmentId && row.batchId)
            .map(row => ({ batchId: row.batchId, status: row.status, date: row.date }));
          // Deduplicate batches by batchId
          const uniqueBatches = Array.from(new Map(batches.map(b => [b.batchId, b])).values());
          return {
            ...obj,
            locationName: location?.locationName || obj.locationName,
            equipmentName: equipment?.equipmentName || obj.equipmentName,
            abbreviation: location?.locationAbbreviation || equipment?.equipmentAbbreviation || obj.abbreviation,
            batches: uniqueBatches.length > 0 ? uniqueBatches : obj.batches || [],
          };
        });
        console.log(`GET /api/facility-design: Returning for siteId=${siteId}`, { objects: enrichedObjects });
        res.json({ objects: enrichedObjects });
      });
    }
  );
});

app.put('/api/facility-design', (req, res) => {
  const { siteId, objects } = req.body;
  if (!siteId || !Array.isArray(objects)) {
    console.error('PUT /api/facility-design: Missing or invalid siteId/objects', { siteId, objects });
    return res.status(400).json({ error: 'siteId and objects array are required' });
  }
  const objectsJson = JSON.stringify(objects);
  const timestamp = new Date().toISOString();
  db.run(
    `INSERT INTO facility_designs (siteId, objects, createdAt, updatedAt)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(siteId) DO UPDATE SET objects = ?, updatedAt = ?`,
    [siteId, objectsJson, timestamp, timestamp, objectsJson, timestamp],
    (err) => {
      if (err) {
        console.error('PUT /api/facility-design error:', err);
        return res.status(500).json({ error: err.message });
      }
      console.log(`PUT /api/facility-design: Saved design for siteId=${siteId}, objects=`, objects);
      res.json({ message: 'Design saved successfully' });
    }
  );
});

app.get('/api/debug/facility-design', (req, res) => {
  const { siteId } = req.query;
  const query = siteId
    ? `SELECT * FROM facility_designs WHERE siteId = ? ORDER BY updatedAt DESC`
    : `SELECT * FROM facility_designs ORDER BY updatedAt DESC`;
  const params = siteId ? [siteId] : [];
  db.all(query, params, (err, rows) => {
    if (err) {
      console.error('Debug facility design error:', err);
      return res.status(500).json({ error: err.message });
    }
    res.json(rows.map((row) => ({
      ...row,
      objects: JSON.parse(row.objects || '[]'),
    })));
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
  const { month, siteId } = req.query;
  if (!month || !siteId) {
    console.error('GET /api/report/monthly: Missing month or siteId', { month, siteId });
    return res.status(400).json({ error: 'month and siteId are required' });
  }
  const startDate = `${month}-01`;
  const endDate = new Date(new Date(startDate).setMonth(new Date(startDate).getMonth() + 1)).toISOString().split('T')[0];

  // Total barrels on hand (packaged + unpackaged)
  db.all(
    `
    SELECT 
      COALESCE(SUM(CASE 
        WHEN identifier LIKE '%1/2 BBL Keg%' THEN quantity * 0.5
        WHEN identifier LIKE '%1/6 BBL Keg%' THEN quantity * 0.167
        WHEN identifier LIKE '%750ml Bottle%' THEN quantity * 0.006
        ELSE 0 
      END), 0) AS packagedBarrels
    FROM inventory 
    WHERE type = 'Finished Goods' AND status IN ('Received', 'Stored') AND siteId = ?
    `,
    [siteId],
    (err, packagedRows) => {
      if (err) {
        console.error('GET /api/report/monthly: Fetch packaged barrels error:', err);
        return res.status(500).json({ error: `Failed to fetch packaged barrels: ${err.message}` });
      }
      db.all(
        `
        SELECT 
          COALESCE(SUM(volume), 0) AS unpackagedBarrels
        FROM batches 
        WHERE status = 'In Progress' AND siteId = ?
        `,
        [siteId],
        (err, unpackagedRows) => {
          if (err) {
            console.error('GET /api/report/monthly: Fetch unpackaged barrels error:', err);
            return res.status(500).json({ error: `Failed to fetch unpackaged barrels: ${err.message}` });
          }
          // Barrels produced by fermentation
          db.all(
            `
            SELECT 
              COALESCE(SUM(volume), 0) AS producedBarrels
            FROM batches 
            WHERE date >= ? AND date < ? AND siteId = ?
            `,
            [startDate, endDate, siteId],
            (err, producedRows) => {
              if (err) {
                console.error('GET /api/report/monthly: Fetch produced barrels error:', err);
                return res.status(500).json({ error: `Failed to fetch produced barrels: ${err.message}` });
              }
              // Barrels packaged (kegs and bottles/cans)
              db.all(
                `
                SELECT 
                  identifier,
                  COALESCE(SUM(CASE 
                    WHEN identifier LIKE '%1/2 BBL Keg%' THEN quantity * 0.5
                    WHEN identifier LIKE '%1/6 BBL Keg%' THEN quantity * 0.167
                    WHEN identifier LIKE '%750ml Bottle%' THEN quantity * 0.006
                    ELSE 0 
                  END), 0) AS packagedBarrels
                FROM inventory 
                WHERE type = 'Finished Goods' 
                  AND status IN ('Received', 'Stored') 
                  AND receivedDate >= ? AND receivedDate < ? 
                  AND siteId = ?
                GROUP BY identifier
                `,
                [startDate, endDate, siteId],
                (err, packagedRows) => {
                  if (err) {
                    console.error('GET /api/report/monthly: Fetch packaged barrels error:', err);
                    return res.status(500).json({ error: `Failed to fetch packaged barrels: ${err.message}` });
                  }
                  // Barrels lost
                  db.all(
                    `
                    SELECT 
                      COALESCE(SUM(quantityLost), 0) AS lostBarrels
                    FROM inventory_losses 
                    WHERE date >= ? AND date < ? AND siteId = ?
                    `,
                    [startDate, endDate, siteId],
                    (err, lossRows) => {
                      if (err) {
                        console.error('GET /api/report/monthly: Fetch lost barrels error:', err);
                        return res.status(500).json({ error: `Failed to fetch lost barrels: ${err.message}` });
                      }
                      const report = {
                        siteId,
                        month,
                        totalBarrelsOnHand: (packagedRows[0]?.packagedBarrels || 0) + (unpackagedRows[0]?.unpackagedBarrels || 0),
                        barrelsProduced: producedRows[0]?.producedBarrels || 0,
                        barrelsPackagedInKegs: packagedRows
                          .filter(row => row.identifier.includes('Keg'))
                          .reduce((sum, row) => sum + row.packagedBarrels, 0),
                        barrelsPackagedInBottles: packagedRows
                          .filter(row => row.identifier.includes('Bottle'))
                          .reduce((sum, row) => sum + row.packagedBarrels, 0),
                        barrelsLost: lossRows[0]?.lostBarrels || 0,
                      };
                      console.log('GET /api/report/monthly: Report generated', report);
                      res.json(report);
                    }
                  );
                }
              );
            }
          );
        }
      );
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

app.get('/styles.xml', (req, res) => {
  const filePath = path.join(__dirname, 'config/styles.xml');
  console.log('Serving styles.xml from:', filePath);
  res.sendFile(filePath, (err) => {
    if (err) {
      console.error('Error serving styles.xml:', err);
      res.status(404).json({ error: 'styles.xml not found' });
    }
  });
});

app.get('*', (req, res) => res.sendFile(path.join(__dirname, '../client/build/index.html')));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});