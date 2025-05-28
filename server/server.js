const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const xml2js = require('xml2js');
const nodemailer = require('nodemailer');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const app = express();
let packageVolumes = {};

// Load package types from XML
const loadPackageTypesFromXML = () => {
  const filePath = path.join(__dirname, '../config/package_types.xml');
  fs.readFile(filePath, 'utf8', (err, data) => {
    if (err) {
      console.error('Error reading package_types.xml:', err);
      return;
    }
    xml2js.parseString(data, (err, result) => {
      if (err) {
        console.error('Error parsing package_types.xml:', err);
        return;
      }
      const packageTypes = result.packageTypes.packageType || [];
      packageVolumes = {};
      packageTypes.forEach((pkg) => {
        const attributes = pkg.$ || {};
        const name = String(attributes.name || '').replace(/[^\w\s\/-]/g, ''); // Preserve slashes
        const volume = parseFloat(attributes.volume || '0');
        const enabled = parseInt(attributes.enabled || '1', 10);
        if (name && volume > 0 && enabled === 1) {
          packageVolumes[name] = volume;
        }
      });
      console.log('Loaded package volumes:', packageVolumes);
    });
  });
};

// Load items from XML
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

// Initialize database schema
const initializeDatabase = () => {
  db.serialize(() => {
    console.log('Initializing database schema...');

    // Create tables (ordered by foreign key dependencies)
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
        type TEXT,
        FOREIGN KEY (siteId) REFERENCES sites(siteId)
      )
    `);
    db.run(`
      CREATE TABLE IF NOT EXISTS customers (
        customerId INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT NOT NULL,
        address TEXT,
        phone TEXT,
        contactPerson TEXT,
        licenseNumber TEXT,
        notes TEXT,
        enabled INTEGER DEFAULT 1,
        createdDate TEXT,
        updatedDate TEXT
      )
    `);
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
    `);
    db.run(`
      CREATE TABLE IF NOT EXISTS product_package_types (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        productId INTEGER NOT NULL,
        type TEXT NOT NULL,
        price TEXT NOT NULL,
        isKegDepositItem INTEGER NOT NULL,
        FOREIGN KEY (productId) REFERENCES products(id),
        UNIQUE(productId, type)
      )
    `);
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
    `);
    db.run(`
      CREATE TABLE IF NOT EXISTS recipe_ingredients (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        recipeId INTEGER NOT NULL,
        itemName TEXT NOT NULL,
        quantity REAL NOT NULL,
        unit TEXT NOT NULL,
        FOREIGN KEY (recipeId) REFERENCES recipes(id)
      )
    `);
    db.run(`
      CREATE TABLE IF NOT EXISTS sales_orders (
        orderId INTEGER PRIMARY KEY AUTOINCREMENT,
        customerId INTEGER NOT NULL,
        poNumber TEXT,
        status TEXT NOT NULL DEFAULT 'Draft',
        createdDate TEXT NOT NULL,
        FOREIGN KEY (customerId) REFERENCES customers(customerId)
      )
    `);
    db.run(`
      CREATE TABLE IF NOT EXISTS sales_order_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        orderId INTEGER NOT NULL,
        itemName TEXT NOT NULL,
        quantity INTEGER NOT NULL,
        unit TEXT NOT NULL,
        price TEXT,
        hasKegDeposit INTEGER DEFAULT 0,
        FOREIGN KEY (orderId) REFERENCES sales_orders(orderId)
      )
    `);
    db.run(`
      CREATE TABLE IF NOT EXISTS invoices (
        invoiceId INTEGER PRIMARY KEY AUTOINCREMENT,
        orderId INTEGER NOT NULL,
        customerId INTEGER NOT NULL,
        status TEXT NOT NULL DEFAULT 'Draft',
        createdDate TEXT NOT NULL,
        postedDate TEXT,
        total TEXT,
        subtotal TEXT,
        keg_deposit_total TEXT,
        keg_deposit_price TEXT,
        FOREIGN KEY (orderId) REFERENCES sales_orders(orderId),
        FOREIGN KEY (customerId) REFERENCES customers(customerId)
      )
    `);
    db.run(`
      CREATE TABLE IF NOT EXISTS invoice_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        invoiceId INTEGER NOT NULL,
        itemName TEXT NOT NULL,
        quantity INTEGER NOT NULL,
        unit TEXT NOT NULL,
        price TEXT,
        hasKegDeposit INTEGER DEFAULT 0,
        kegDeposit TEXT,  -- New column for deposit amount
        FOREIGN KEY (invoiceId) REFERENCES invoices(invoiceId)
      )
    `);
    db.run(`
      CREATE TABLE IF NOT EXISTS system_settings (
        settingId INTEGER PRIMARY KEY AUTOINCREMENT,
        key TEXT NOT NULL UNIQUE,
        value TEXT NOT NULL
      )
    `);
    db.run(`
      CREATE TABLE IF NOT EXISTS inventory (
        identifier TEXT,
        account TEXT,
        type TEXT,
        quantity TEXT,
        unit TEXT,
        price TEXT,
        isKegDepositItem INTEGER,
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
      CREATE TABLE IF NOT EXISTS facility_designs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        siteId TEXT NOT NULL,
        objects TEXT NOT NULL,
        createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
        updatedAt TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (siteId) REFERENCES sites(siteId),
        UNIQUE(siteId)
      )
    `);
    db.run(`
      CREATE TABLE IF NOT EXISTS batches (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        batchId TEXT UNIQUE,
        productId INTEGER,
        recipeId INTEGER,
        siteId TEXT,
        status TEXT,
        date TEXT,
        additionalIngredients TEXT,
        equipmentId INTEGER,
        fermenterId INTEGER,
        volume REAL,
        stage TEXT,
        brewLog TEXT,
        FOREIGN KEY (productId) REFERENCES products(id),
        FOREIGN KEY (recipeId) REFERENCES recipes(id),
        FOREIGN KEY (siteId) REFERENCES sites(siteId),
        FOREIGN KEY (equipmentId) REFERENCES equipment(equipmentId),
        FOREIGN KEY (fermenterId) REFERENCES equipment(equipmentId)
      )
    `);
    db.run(`
      CREATE TABLE IF NOT EXISTS inventory_losses (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        identifier TEXT NOT NULL,
        quantityLost REAL NOT NULL,
        proofGallonsLost REAL DEFAULT 0,
        reason TEXT NOT NULL,
        date TEXT NOT NULL,
        dspNumber TEXT,
        siteId TEXT NOT NULL,
        locationId INTEGER,
        FOREIGN KEY (siteId) REFERENCES sites(siteId),
        FOREIGN KEY (locationId) REFERENCES locations(locationId)
      )
    `);
    db.run(`
      CREATE TABLE IF NOT EXISTS batch_packaging (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        batchId TEXT NOT NULL,
        packageType TEXT NOT NULL,
        quantity INTEGER NOT NULL,
        volume REAL NOT NULL,
        locationId INTEGER NOT NULL,
        date TEXT NOT NULL,
        siteId TEXT NOT NULL,
        FOREIGN KEY (batchId) REFERENCES batches(batchId),
        FOREIGN KEY (locationId) REFERENCES locations(locationId),
        FOREIGN KEY (siteId) REFERENCES sites(siteId)
      )
    `);
    db.run(`
      CREATE TABLE IF NOT EXISTS users (
        email TEXT PRIMARY KEY,
        passwordHash TEXT,
        role TEXT NOT NULL,
        enabled INTEGER NOT NULL DEFAULT 1,
        passkey TEXT
      )
    `);
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
      CREATE TABLE kegs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        code TEXT NOT NULL UNIQUE,
        status TEXT NOT NULL, -- 'Filled', 'Empty', 'Destroyed'
        productId INTEGER,
        lastScanned TEXT,
        location TEXT, -- e.g., 'Madison Brewery Cooler', 'Customer: Gulf Distributing'
        customerId INTEGER,
        packageingType TEXT,
        FOREIGN KEY (productId) REFERENCES products(id),
        FOREIGN KEY (customerId) REFERENCES customers(customerId)
      )
    `);
    db.run(`
      CREATE TABLE keg_transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        kegId INTEGER NOT NULL,
        action TEXT NOT NULL, -- 'Registered', 'Filled', 'Shipped', 'Returned', 'Updated', 'Destroyed'
        productId INTEGER,
        batchId TEXT,
        invoiceId INTEGER,
        customerId INTEGER,
        date TEXT NOT NULL,
        location TEXT,
        FOREIGN KEY (kegId) REFERENCES kegs(id),
        FOREIGN KEY (productId) REFERENCES products(id),
        FOREIGN KEY (batchId) REFERENCES batches(batchId),
        FOREIGN KEY (invoiceId) REFERENCES invoices(invoiceId),
        FOREIGN KEY (customerId) REFERENCES customers(customerId)
      )  
    `);
    db.run(`
      ALTER TABLE batch_packaging ADD COLUMN keg_codes TEXT;
      ALTER TABLE invoice_items ADD COLUMN keg_codes TEXT;
      )
    `);

    // Create indexes
    db.run(`CREATE UNIQUE INDEX IF NOT EXISTS idx_siteId ON facility_designs(siteId)`, (err) => {
      if (err) console.error('Error adding UNIQUE index:', err);
      else console.log('Added UNIQUE index on siteId');
    });

    // Cleanup duplicates
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

    console.log('Database schema initialized');
  });
};

// Insert test data
const insertTestData = () => {
  db.serialize(() => {
    console.log('Inserting test data...');

    // Users
    db.run('INSERT OR IGNORE INTO users (email, passwordHash, role, enabled) VALUES (?, ?, ?, ?)',
      ['jtseaton@gmail.com', 'P@$$w0rd1234', 'SuperAdmin', 1], // TODO: Replace with bcrypt hash
      (err) => {
        if (err) console.error('Error inserting default user:', err);
        else console.log('Inserted default Super Admin user');
      });

    // Sites
    db.run(`INSERT OR IGNORE INTO sites (siteId, name, type, address) VALUES (?, ?, ?, ?)`,
      ['DSP-AL-20051', 'Athens AL DSP', 'DSP', '311 Marion St, Athens, AL 35611']);
    db.run(`INSERT OR IGNORE INTO sites (siteId, name, type, address) VALUES (?, ?, ?, ?)`,
      ['BR-AL-20088', 'Athens Brewery', 'Brewery', '311 Marion St, Athens, AL 35611']);
    db.run(`INSERT OR IGNORE INTO sites (siteId, name, type, address) VALUES (?, ?, ?, ?)`,
      ['BR-AL-20019', 'Madison Brewery', 'Brewery', '212 Main St Madison, AL 35758']);
    db.run(`INSERT OR IGNORE INTO sites (siteId, name, type, address) VALUES (?, ?, ?, ?)`,
      ['DSP-AL-20010', 'Madison Distillery', 'DSP', '212 Main St Madison, AL 35758']);

    // Locations
    db.run(`INSERT OR IGNORE INTO locations (siteId, name, abbreviation) VALUES (?, ?, ?)`,
      ['DSP-AL-20010', 'Spirits Storage', 'Spirits']);
    db.run(`INSERT OR IGNORE INTO locations (siteId, name, abbreviation) VALUES (?, ?, ?)`,
      ['DSP-AL-20010', 'Grain Storage', null]);
    db.run(`INSERT OR IGNORE INTO locations (siteId, name, abbreviation) VALUES (?, ?, ?)`,
      ['DSP-AL-20010', 'Fermentation Tanks', null]);
    db.run(`INSERT OR IGNORE INTO locations (siteId, name, abbreviation) VALUES (?, ?, ?)`,
      ['BR-AL-20019', 'Madison Fermenter 1', null]);
    db.run(`INSERT OR IGNORE INTO locations (siteId, name, abbreviation) VALUES (?, ?, ?)`,
      ['BR-AL-20019', 'Madison Outdoor Racks', null]);
    db.run(`INSERT OR IGNORE INTO locations (siteId, name, abbreviation) VALUES (?, ?, ?)`,
      ['BR-AL-20019', 'Madison Fermenter 2', null]);
    db.run(`INSERT OR IGNORE INTO locations (siteId, name, abbreviation) VALUES (?, ?, ?)`,
      ['BR-AL-20019', 'Madison Fermenter 3', null]);
    db.run(`INSERT OR IGNORE INTO locations (siteId, name, abbreviation) VALUES (?, ?, ?)`,
      ['BR-AL-20019', 'Madison Fermenter 4', null]);
    db.run(`INSERT OR IGNORE INTO locations (siteId, name, abbreviation) VALUES (?, ?, ?)`,
      ['BR-AL-20019', 'Madison Cold Storage', 'Beer Cooler']);
    db.run(`INSERT OR IGNORE INTO locations (siteId, name, abbreviation) VALUES (?, ?, ?)`,
      ['BR-AL-20019', 'Madison Mash Tun', 'Mash Tun']);
    db.run(`INSERT OR IGNORE INTO locations (siteId, name, abbreviation) VALUES (?, ?, ?)`,
      ['BR-AL-20019', 'Madison Boil Kettle', null]);
    db.run(`INSERT OR IGNORE INTO locations (siteId, name, abbreviation) VALUES (?, ?, ?)`,
      ['BR-AL-20088', 'Athens Cold Storage', 'Athens Cooler']);

    // Equipment
    db.run('INSERT OR IGNORE INTO equipment (name, abbreviation, siteId, enabled, type) VALUES (?, ?, ?, ?, ?)',
      ['Mash Tun', 'MT', 'BR-AL-20019', 1, 'Mash Tun']);
    db.run('INSERT OR IGNORE INTO equipment (name, abbreviation, siteId, enabled, type) VALUES (?, ?, ?, ?, ?)',
      ['Boil Kettle', 'BK', 'BR-AL-20019', 1, 'Kettle']);
    db.run('INSERT OR IGNORE INTO equipment (name, abbreviation, siteId, enabled, type) VALUES (?, ?, ?, ?, ?)',
      ['Fermentation FV1', 'FV1', 'BR-AL-20019', 1, 'Fermenter']);
    db.run('INSERT OR IGNORE INTO equipment (name, abbreviation, siteId, enabled, type) VALUES (?, ?, ?, ?, ?)',
      ['Fermentation FV2', 'FV2', 'BR-AL-20019', 1, 'Fermenter']);
    db.run('INSERT OR IGNORE INTO equipment (name, abbreviation, siteId, enabled, type) VALUES (?, ?, ?, ?, ?)',
      ['Brite Tank', 'BT', 'BR-AL-20019', 1, 'Brite Tank']);

    // Products
    db.run('INSERT OR IGNORE INTO products (id, name, abbreviation, enabled, priority, class, type, style, abv, ibu) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [1, 'Whiskey', 'WH', 1, 1, 'Distilled', 'Spirits', 'Bourbon', 40, 0]);
    db.run('INSERT OR IGNORE INTO products (id, name, abbreviation, enabled, priority, class, type, style, abv, ibu) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [2, 'Hazy Train IPA', 'IPA', 1, 2, 'Beer', 'Malt', 'American IPA', 6.5, 60]);
    db.run('INSERT OR IGNORE INTO products (id, name, abbreviation, enabled, priority, class, type, style, abv, ibu) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [3, 'Cave City Lager', 'CCL', 1, 3, 'Beer', 'Malt', 'American Amber Ale', 5.2, 21]);

    // Items
    db.run('INSERT OR IGNORE INTO items (name, type, enabled) VALUES (?, ?, ?)',
      ['Finished Goods', 'Finished Goods', 1]);
    db.run('INSERT OR IGNORE INTO items (name, type, enabled) VALUES (?, ?, ?)',
      ['Corn', 'Grain', 1]);
    db.run('INSERT OR IGNORE INTO items (name, type, enabled) VALUES (?, ?, ?)',
      ['Hops', 'Hops', 1]);

    // Inventory
    db.run('INSERT OR IGNORE INTO inventory (identifier, account, type, quantity, unit, receivedDate, source, siteId, locationId, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    ['Flaked Corn', 'Storage', 'Grain', '1000', 'lbs', '2025-04-20', 'Acme Supplies', 'BR-AL-20019', 1, 'Stored']);  
    db.run('INSERT OR REPLACE INTO inventory (identifier, type, quantity, unit, siteId, type, receivedDate, status, source) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      ['Hops', 'Hops', '550', 'lbs', 'BR-AL-20019', 'Hops', '2025-04-20', 'Stored', 'Acme Supplies']);
    db.run('INSERT OR IGNORE INTO inventory (identifier, type, quantity, unit, receivedDate, source, siteId, locationId, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      ['Hops Cascade', 'Hops', '50', 'lbs', '2025-04-20', 'Acme Supplies', 'BR-AL-20088', 11, 'Stored']);

    db.run('INSERT OR IGNORE INTO inventory (identifier, account, type, quantity, unit, receivedDate, source, siteId, locationId, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      ['Hops Country Malt', 'Storage', 'Hops', '100', 'Pounds', '2025-04-21', 'Country Malt', 'BR-AL-20019', 9, 'Stored']);

    // Recipes
    db.run('INSERT OR IGNORE INTO recipes (id, name, productId, ingredients, quantity, unit) VALUES (?, ?, ?, ?, ?, ?)',
      [1, 'Whiskey Recipe', 1, JSON.stringify([{ itemName: 'Corn', quantity: 100, unit: 'lbs' }]), '100', 'gallons']);
    db.run('INSERT OR IGNORE INTO recipes (id, name, productId, ingredients, quantity, unit) VALUES (?, ?, ?, ?, ?, ?)',
      [2, 'Hazy Train 20 BBL', 2, JSON.stringify([{ itemName: 'Hops', quantity: 50, unit: 'lbs' }]), '20', 'barrels']);

    // Batches
    db.run('INSERT OR IGNORE INTO batches (batchId, productId, recipeId, siteId, status, date) VALUES (?, ?, ?, ?, ?, ?)',
      ['BATCH-001', 1, 1, 'BR-AL-20019', 'In Progress', '2025-04-20']);

    // Customers
    db.run('INSERT OR IGNORE INTO customers (name, email) VALUES (?, ?)',
      ['Gulf Distributing', 'jtseaton@gmail.com']);

    //PackagingTypes
    db.run(`ALTER TABLE kegs ADD COLUMN packagingType TEXT;`);

    // Vendors
    db.run('INSERT OR IGNORE INTO vendors (name, type, enabled, address, email, phone) VALUES (?, ?, ?, ?, ?, ?)',
      ['Acme Supplies', 'Supplier', 1, '123 Main St', 'acme@example.com', '555-1234']);
    db.run('INSERT OR IGNORE INTO vendors (name, type, enabled, address, email, phone) VALUES (?, ?, ?, ?, ?, ?)',
      ['Country Malt', 'Supplier', 1, '123 Main St', 'acme@example.com', '555-1234']);
    db.run('INSERT OR IGNORE INTO vendors (name, type, enabled, address, email, phone) VALUES (?, ?, ?, ?, ?, ?)',
      ['Yakima Chief', 'Supplier', 1, '123 Main St', 'acme@example.com', '555-1234']);
    db.run('INSERT OR IGNORE INTO vendors (name, type, enabled, address, email, phone) VALUES (?, ?, ?, ?, ?, ?)',
      ['Pharmco Aaper', 'Supplier', 1, '123 Main St', 'acme@example.com', '555-1234']);


    // New Test Data: Packaging Types for Hazy Train
    db.get(`SELECT id FROM products WHERE name = ?`, ['Hazy Train IPA'], (err, row) => {
      if (err) {
        console.error('Fetch Hazy Train productId error:', err);
        return;
      }
      if (!row) {
        console.error('Hazy Train IPA product not found');
        return;
      }
      const productId = row.id;

      const packagingTypes = [
        { type: '1/2 BBL Keg', price: '132.00', isKegDepositItem: 1 },
        { type: '1/4 BBL Keg', price: '70.00', isKegDepositItem: 0 },
        { type: '1/6 BBL Keg', price: '64.00', isKegDepositItem: 1 },
      ];

      packagingTypes.forEach((pt) => {
        db.run(
          `INSERT OR IGNORE INTO product_package_types (productId, type, price, isKegDepositItem) VALUES (?, ?, ?, ?)`,
          [productId, pt.type, pt.price, pt.isKegDepositItem],
          (err) => {
            if (err) console.error(`Insert packaging type ${pt.type} error:`, err);
            else console.log(`Inserted packaging type ${pt.type}`);
          }
        );
      });
    });

    // New Test Data: Batch HT321654
    db.get(`SELECT id FROM products WHERE name = ?`, ['Hazy Train IPA'], (err, row) => {
      if (err) {
        console.error('Fetch Hazy Train productId for batch error:', err);
        return;
      }
      if (!row) {
        console.error('Hazy Train IPA product not found for batch');
        return;
      }
      const productId = row.id;

      db.get(`SELECT id FROM recipes WHERE name = ?`, ['Hazy Train 20 BBL'], (err, recipeRow) => {
        if (err) {
          console.error('Fetch Hazy Train recipeId error:', err);
          return;
        }
        if (!recipeRow) {
          console.error('Hazy Train 20 BBL recipe not found');
          return;
        }
        const recipeId = recipeRow.id;

        db.run(
          `INSERT OR IGNORE INTO batches (batchId, productId, recipeId, volume, siteId, status, stage, date) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          ['HT321654', productId, recipeId, 20.000, 'BR-AL-20019', 'In Progress', 'Fermentation', '2025-05-24'],
          (err) => {
            if (err) console.error('Insert batch HT321654 error:', err);
            else console.log('Inserted batch HT321654');
          }
        );
      });
    });

    // New Test Data: Kegs EK10000 to EK10050
    db.get(`SELECT locationId FROM locations WHERE name = ? AND siteId = ?`, ['Madison Cold Storage', 'BR-AL-20019'], (err, row) => {
      if (err) {
        console.error('Fetch Madison Cold Storage locationId error:', err);
        return;
      }
      if (!row) {
        console.error('Madison Cold Storage location not found');
        return;
      }
      const locationId = row.locationId;

      for (let i = 10000; i <= 10050; i++) {
        const code = `EK${i.toString().padStart(5, '0')}`;
        db.run(
          `INSERT OR IGNORE INTO kegs (code, status, lastScanned, location) VALUES (?, ?, ?, ?)`,
          [code, 'Empty', '2025-05-24', locationId],
          (err) => {
            if (err) console.error(`Insert keg ${code} error:`, err);
            else console.log(`Inserted keg ${code}`);
          }
        );
      }
    });

    console.log('Test data insertion complete');
  });
};

// Initialize database and load data
loadPackageTypesFromXML();
loadItemsFromXML();
initializeDatabase();
insertTestData();

app.post('/api/customers', (req, res) => {
  const { name, email, address, phone, contactPerson, licenseNumber, notes, enabled } = req.body;
  if (!name || !email) {
    console.error('POST /api/customers: Missing required fields', { name, email });
    return res.status(400).json({ error: 'Name and email are required' });
  }
  const createdDate = new Date().toISOString().split('T')[0];
  db.run(
    `INSERT INTO customers (name, email, address, phone, contactPerson, licenseNumber, notes, enabled, createdDate, updatedDate)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      name,
      email,
      address || null,
      phone || null,
      contactPerson || null,
      licenseNumber || null,
      notes || null,
      enabled !== undefined ? enabled : 1,
      createdDate,
      createdDate,
    ],
    function (err) {
      if (err) {
        console.error('POST /api/customers: Insert error:', err);
        return res.status(500).json({ error: err.message });
      }
      db.get('SELECT * FROM customers WHERE customerId = ?', [this.lastID], (err, customer) => {
        if (err) {
          console.error('POST /api/customers: Fetch new customer error:', err);
          return res.status(500).json({ error: err.message });
        }
        console.log('POST /api/customers: Created', customer);
        res.json(customer);
      });
    }
  );
});

app.get('/api/customers', (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  db.all('SELECT * FROM customers WHERE enabled = 1', (err, rows) => {
    if (err) {
      console.error('GET /api/customers: Database error:', err);
      return res.status(500).json({ error: 'Failed to fetch customers: ' + err.message });
    }
    console.log('GET /api/customers: Returning', rows);
    res.json(rows);
  });
});

app.get('/api/customers/:id', (req, res) => {
  const { id } = req.params;
  db.get('SELECT * FROM customers WHERE customerId = ?', [id], (err, row) => {
    if (err) {
      console.error('GET /api/customers/:id: Database error:', err);
      return res.status(500).json({ error: err.message });
    }
    if (!row) {
      console.log(`GET /api/customers/${id}: Customer not found`);
      return res.status(404).json({ error: 'Customer not found' });
    }
    console.log('GET /api/customers/:id: Returning', row);
    res.json(row);
  });
});

app.patch('/api/customers/:id', (req, res) => {
  const { id } = req.params;
  const { name, email, address, phone, contactPerson, licenseNumber, notes, enabled } = req.body;
  if (!name || !email) {
    console.error('PATCH /api/customers/:id: Missing required fields', { name, email });
    return res.status(400).json({ error: 'Name and email are required' });
  }
  const updatedDate = new Date().toISOString().split('T')[0];
  db.run(
    `UPDATE customers SET name = ?, email = ?, address = ?, phone = ?, contactPerson = ?, 
     licenseNumber = ?, notes = ?, enabled = ?, updatedDate = ? WHERE customerId = ?`,
    [
      name,
      email,
      address || null,
      phone || null,
      contactPerson || null,
      licenseNumber || null,
      notes || null,
      enabled !== undefined ? enabled : 1,
      updatedDate,
      id,
    ],
    function (err) {
      if (err) {
        console.error('PATCH /api/customers/:id: Update error:', err);
        return res.status(500).json({ error: err.message });
      }
      if (this.changes === 0) {
        console.log(`PATCH /api/customers/${id}: Customer not found`);
        return res.status(404).json({ error: 'Customer not found' });
      }
      db.get('SELECT * FROM customers WHERE customerId = ?', [id], (err, row) => {
        if (err) {
          console.error('PATCH /api/customers/:id: Fetch updated customer error:', err);
          return res.status(500).json({ error: err.message });
        }
        console.log('PATCH /api/customers/:id: Updated', row);
        res.json(row);
      });
    }
  );
});

// DELETE /api/customers/:id
app.delete('/api/customers/:id', (req, res) => {
  const { id } = req.params;
  db.run('DELETE FROM customers WHERE customerId = ?', [id], function (err) {
    if (err) {
      console.error('DELETE /api/customers/:id: Delete error:', err);
      return res.status(500).json({ error: err.message });
    }
    if (this.changes === 0) {
      console.log(`DELETE /api/customers/${id}: Customer not found`);
      return res.status(404).json({ error: 'Customer not found' });
    }
    console.log(`DELETE /api/customers/${id}: Customer deleted`);
    res.status(204).send();
  });
});

// Sales Orders
app.get('/api/sales-orders', (req, res) => {
  const { page = 1, limit = 10 } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);
  db.get('SELECT COUNT(*) as total FROM sales_orders WHERE status != ?', ['Cancelled'], (err, countResult) => {
    if (err) {
      console.error('GET /api/sales-orders: Count error:', err);
      return res.status(500).json({ error: err.message });
    }
    const totalOrders = countResult.total;
    const totalPages = Math.ceil(totalOrders / parseInt(limit));
    db.all(
      `SELECT so.*, c.name AS customerName
       FROM sales_orders so
       JOIN customers c ON so.customerId = c.customerId
       WHERE so.status != ?
       LIMIT ? OFFSET ?`,
      ['Cancelled', parseInt(limit), offset],
      (err, rows) => {
        if (err) {
          console.error('GET /api/sales-orders: Fetch error:', err);
          return res.status(500).json({ error: err.message });
        }
        console.log('GET /api/sales-orders: Success', { count: rows.length, page, limit, totalPages });
        res.json({ orders: rows, totalPages });
      }
    );
  });
});

app.get('/api/sales-orders/:orderId', (req, res) => {
  const { orderId } = req.params;
  console.log('GET /api/sales-orders/:orderId: Received request', { orderId });
  db.get(
    `SELECT so.*, c.name AS customerName
     FROM sales_orders so
     JOIN customers c ON so.customerId = c.customerId
     WHERE so.orderId = ?`,
    [orderId],
    (err, order) => {
      if (err) {
        console.error('GET /api/sales-orders/:orderId: Database error:', err);
        return res.status(500).json({ error: err.message });
      }
      if (!order) {
        console.error('GET /api/sales-orders/:orderId: Order not found', { orderId });
        return res.status(404).json({ error: 'Sales order not found' });
      }
      db.all('SELECT id, itemName, quantity, unit, price, hasKegDeposit FROM sales_order_items WHERE orderId = ?', [orderId], (err, items) => {
        if (err) {
          console.error('GET /api/sales-orders/:orderId: Fetch items error:', err);
          return res.status(500).json({ error: err.message });
        }
        db.get('SELECT value FROM system_settings WHERE key = ?', ['keg_deposit_price'], (err, setting) => {
          if (err) {
            console.error('GET /api/sales-orders/:orderId: Fetch keg_deposit_price error:', err);
            return res.status(500).json({ error: err.message });
          }
          order.items = items;
          order.keg_deposit_price = setting ? setting.value : '0.00';
          console.log('GET /api/sales-orders/:orderId: Success', order);
          res.json(order);
        });
      });
    }
  );
});

app.post('/api/sales-orders', (req, res) => {
  const { customerId, poNumber, items } = req.body;
  console.log('POST /api/sales-orders: Received request', { customerId, poNumber, items });
  if (!customerId || !items || !Array.isArray(items) || items.length === 0) {
    console.error('POST /api/sales-orders: Missing required fields', { customerId, items });
    return res.status(400).json({ error: 'customerId and items are required' });
  }

  db.get('SELECT customerId FROM customers WHERE customerId = ? AND enabled = 1', [customerId], (err, customer) => {
    if (err) {
      console.error('POST /api/sales-orders: Fetch customer error:', err);
      return res.status(500).json({ error: err.message });
    }
    if (!customer) {
      console.error('POST /api/sales-orders: Invalid customerId', { customerId });
      return res.status(400).json({ error: `Invalid customerId: ${customerId}` });
    }

    const createdDate = new Date().toISOString().split('T')[0];
    db.run(
      'INSERT INTO sales_orders (customerId, poNumber, status, createdDate) VALUES (?, ?, ?, ?)',
      [customerId, poNumber || null, 'Draft', createdDate],
      function (err) {
        if (err) {
          console.error('POST /api/sales-orders: Insert sales order error:', err);
          return res.status(500).json({ error: err.message });
        }
        const orderId = this.lastID;

        let remaining = items.length;
        const errors = [];
        items.forEach((item, index) => {
          const { itemName, quantity, unit, hasKegDeposit, kegCodes } = item;
          if (!itemName || quantity <= 0 || !unit) {
            errors.push(`Invalid item at index ${index}: itemName, quantity, and unit are required`);
            remaining--;
            if (remaining === 0) finish();
            return;
          }
          if (hasKegDeposit && kegCodes && (!Array.isArray(kegCodes) || kegCodes.some(code => !/^[A-Z0-9-]+$/.test(code)))) {
            errors.push(`Invalid kegCodes for item ${itemName} at index ${index}: must be an array of valid codes`);
            remaining--;
            if (remaining === 0) finish();
            return;
          }

          // Extract product name and package type
          const parts = itemName.trim().split(' ');
          let packageType, productName;
          const lastPart = parts[parts.length - 1].toLowerCase();
          if (['keg', 'bottle', 'can'].includes(lastPart)) {
            packageType = parts.slice(-3).join(' ').replace(/\s*\/\s*/, '/');
            productName = parts.slice(0, -3).join(' ');
          } else {
            packageType = parts.slice(-2).join(' ').replace(/\s*\/\s*/, '/');
            productName = parts.slice(0, -2).join(' ');
          }
          console.log('POST /api/sales-orders: Processing item', { itemName, productName, packageType });

          // Fetch price and hasKegDeposit from product_package_types
          db.get(
            `SELECT ppt.price, ppt.isKegDepositItem 
             FROM product_package_types ppt 
             JOIN products p ON ppt.productId = p.id 
             WHERE p.name = ? AND ppt.type = ?`,
            [productName, packageType],
            (err, priceRow) => {
              if (err) {
                console.error('POST /api/sales-orders: Fetch price error:', err);
                errors.push(`Failed to fetch price for ${itemName}: ${err.message}`);
                remaining--;
                if (remaining === 0) finish();
                return;
              }
              if (priceRow) {
                insertItem(priceRow.price, hasKegDeposit ?? priceRow.isKegDepositItem);
              } else {
                // Fallback to inventory
                console.log('POST /api/sales-orders: Falling back to inventory for price', { itemName });
                db.get(
                  `SELECT price, isKegDepositItem 
                   FROM inventory 
                   WHERE identifier = ? AND type = 'Finished Goods'`,
                  [itemName],
                  (err, invRow) => {
                    if (err) {
                      console.error('POST /api/sales-orders: Fetch inventory price error:', err);
                      errors.push(`Failed to fetch inventory price for ${itemName}: ${err.message}`);
                      remaining--;
                      if (remaining === 0) finish();
                      return;
                    }
                    if (invRow) {
                      insertItem(invRow.price, hasKegDeposit ?? invRow.isKegDepositItem);
                    } else {
                      console.error('POST /api/sales-orders: Price not found', { itemName, productName, packageType });
                      errors.push(`Price not found for ${itemName}. Ensure it is defined in product package types or inventory.`);
                      remaining--;
                      if (remaining === 0) finish();
                    }
                  }
                );
              }
            }
          );

          function insertItem(itemPrice, itemHasKegDeposit) {
            db.run(
              'INSERT INTO sales_order_items (orderId, itemName, quantity, unit, price, hasKegDeposit, kegCodes) VALUES (?, ?, ?, ?, ?, ?, ?)',
              [orderId, itemName, quantity, unit, itemPrice, itemHasKegDeposit ? 1 : 0, kegCodes ? JSON.stringify(kegCodes) : null],
              (err) => {
                if (err) {
                  console.error('POST /api/sales-orders: Insert item error:', err);
                  errors.push(`Failed to insert item ${itemName}: ${err.message}`);
                }
                remaining--;
                if (remaining === 0) finish();
              }
            );
          }
        });

        function finish() {
          if (errors.length > 0) {
            db.run('DELETE FROM sales_orders WHERE orderId = ?', [orderId]);
            console.error('POST /api/sales-orders: Errors occurred', errors);
            return res.status(400).json({ error: errors.join('; ') });
          }

          db.get(
            `SELECT so.*, c.name AS customerName
             FROM sales_orders so
             JOIN customers c ON so.customerId = c.customerId
             WHERE so.orderId = ?`,
            [orderId],
            (err, order) => {
              if (err) {
                console.error('POST /api/sales-orders: Fetch order error:', err);
                return res.status(500).json({ error: err.message });
              }
              db.all('SELECT id, itemName, quantity, unit, price, hasKegDeposit, kegCodes FROM sales_order_items WHERE orderId = ?', [orderId], (err, items) => {
                if (err) {
                  console.error('POST /api/sales-orders: Fetch items error:', err);
                  return res.status(500).json({ error: err.message });
                }
                db.get('SELECT value FROM system_settings WHERE key = ?', ['keg_deposit_price'], (err, setting) => {
                  if (err) {
                    console.error('POST /api/sales-orders: Fetch keg_deposit_price error:', err);
                    return res.status(500).json({ error: err.message });
                  }
                  order.items = items.map(item => ({
                    ...item,
                    kegCodes: item.kegCodes ? JSON.parse(item.kegCodes) : null,
                  }));
                  order.keg_deposit_price = setting ? setting.value : '0.00';
                  console.log('POST /api/sales-orders: Success', order);
                  res.json(order);
                });
              });
            }
          );
        }
      }
    );
  });
});

// Sales Order Update
app.patch('/api/sales-orders/:orderId', (req, res) => {
  const { orderId } = req.params;
  const { customerId, poNumber, items, status } = req.body;
  console.log('PATCH /api/sales-orders/:orderId: Received request', { orderId, customerId, poNumber, items, status });
  if (!customerId || !items || !Array.isArray(items) || items.length === 0) {
    console.error('PATCH /api/sales-orders/:orderId: Missing required fields', { customerId, items });
    return res.status(400).json({ error: 'customerId and items are required' });
  }

  db.get('SELECT customerId FROM customers WHERE customerId = ? AND enabled = 1', [customerId], (err, customer) => {
    if (err) {
      console.error('PATCH /api/sales-orders/:orderId: Fetch customer error:', err);
      return res.status(500).json({ error: err.message });
    }
    if (!customer) {
      console.error('PATCH /api/sales-orders/:orderId: Invalid customerId', { customerId });
      return res.status(400).json({ error: `Invalid customerId: ${customerId}` });
    }

    db.get('SELECT * FROM sales_orders WHERE orderId = ? AND status = ?', [orderId, 'Draft'], (err, order) => {
      if (err) {
        console.error('PATCH /api/sales-orders/:orderId: Fetch order error:', err);
        return res.status(500).json({ error: err.message });
      }
      if (!order && status !== 'Approved') {
        console.error('PATCH /api/sales-orders/:orderId: Order not found or not in Draft', { orderId });
        return res.status(404).json({ error: 'Order not found or not in Draft status' });
      }

      // Validate inventory and kegCodes if approving
      if (status === 'Approved') {
        let remainingChecks = items.length;
        const errors = [];
        items.forEach((item, index) => {
          const { itemName, quantity, kegCodes } = item;
          if (!itemName || quantity <= 0) {
            errors.push(`Invalid item at index ${index}: itemName and positive quantity required`);
            remainingChecks--;
            if (remainingChecks === 0) finishValidation();
            return;
          }
          if (itemName === 'Keg Deposit') {
            remainingChecks--;
            if (remainingChecks === 0) finishValidation();
            return;
          }
          if (item.hasKegDeposit && (!kegCodes || !Array.isArray(kegCodes) || kegCodes.length !== quantity)) {
            errors.push(`Item ${itemName} at index ${index} requires exactly ${quantity} keg codes`);
            remainingChecks--;
            if (remainingChecks === 0) finishValidation();
            return;
          }
          if (kegCodes) {
            kegCodes.forEach((code, codeIndex) => {
              db.get('SELECT id, status, productId FROM kegs WHERE code = ?', [code], (err, keg) => {
                if (err) {
                  errors.push(`Failed to fetch keg ${code} for ${itemName}: ${err.message}`);
                } else if (!keg) {
                  errors.push(`Keg ${code} not found for ${itemName}`);
                } else if (keg.status !== 'Filled') {
                  errors.push(`Keg ${code} is not filled for ${itemName} (status: ${keg.status})`);
                } else {
                  // Verify product matches
                  const parts = itemName.trim().split(' ');
                  const productName = parts.slice(0, -3).join(' ');
                  db.get('SELECT id FROM products WHERE name = ?', [productName], (err, product) => {
                    if (err || !product || product.id !== keg.productId) {
                      errors.push(`Keg ${code} does not contain ${productName} for ${itemName}`);
                    }
                    if (--remainingChecks === 0) finishValidation();
                  });
                  return;
                }
                if (--remainingChecks === 0) finishValidation();
              });
            });
          } else {
            db.get(
              'SELECT quantity FROM inventory WHERE identifier = ? AND type IN (?, ?)',
              [itemName, 'Finished Goods', 'Marketing'],
              (err, row) => {
                if (err) {
                  console.error('PATCH /api/sales-orders/:orderId: Fetch inventory error:', err);
                  errors.push(`Failed to check inventory for ${itemName}: ${err.message}`);
                } else if (!row || parseFloat(row.quantity) < quantity) {
                  console.error('PATCH /api/sales-orders/:orderId: Insufficient inventory', {
                    itemName,
                    available: row?.quantity || 0,
                    needed: quantity,
                  });
                  errors.push(`Insufficient inventory for ${itemName}: ${row?.quantity || 0} available, ${quantity} needed`);
                }
                remainingChecks--;
                if (remainingChecks === 0) finishValidation();
              }
            );
          }
        });
        function finishValidation() {
          if (errors.length > 0) {
            console.error('PATCH /api/sales-orders/:orderId: Validation failed', errors);
            return res.status(400).json({ error: errors.join('; ') });
          }
          proceedWithUpdate();
        }
      } else {
        proceedWithUpdate();
      }

      function proceedWithUpdate() {
        db.serialize(() => {
          db.run('BEGIN TRANSACTION', (err) => {
            if (err) {
              console.error('PATCH /api/sales-orders/:orderId: Begin transaction error:', err);
              return res.status(500).json({ error: err.message });
            }
            db.run(
              'UPDATE sales_orders SET customerId = ?, poNumber = ?, status = ? WHERE orderId = ?',
              [customerId, poNumber || null, status || 'Draft', orderId],
              (err) => {
                if (err) {
                  db.run('ROLLBACK');
                  console.error('PATCH /api/sales-orders/:orderId: Update order error:', err);
                  return res.status(500).json({ error: err.message });
                }
                db.run('DELETE FROM sales_order_items WHERE orderId = ?', [orderId], (err) => {
                  if (err) {
                    db.run('ROLLBACK');
                    console.error('PATCH /api/sales-orders/:orderId: Delete items error:', err);
                    return res.status(500).json({ error: err.message });
                  }
                  let remaining = items.length;
                  const errors = [];
                  items.forEach((item, index) => {
                    const { itemName, quantity, unit, price, hasKegDeposit, kegCodes } = item;
                    if (!itemName || quantity <= 0 || !unit || !price || isNaN(parseFloat(price)) || parseFloat(price) < 0) {
                      errors.push(`Invalid item at index ${index}: itemName, quantity, unit, and valid price are required`);
                      remaining--;
                      if (remaining === 0) finish();
                      return;
                    }
                    db.run(
                      'INSERT INTO sales_order_items (orderId, itemName, quantity, unit, price, hasKegDeposit, kegCodes) VALUES (?, ?, ?, ?, ?, ?, ?)',
                      [orderId, itemName, quantity, unit, price, hasKegDeposit ? 1 : 0, kegCodes ? JSON.stringify(kegCodes) : null],
                      (err) => {
                        if (err) {
                          console.error('PATCH /api/sales-orders/:orderId: Insert item error:', err);
                          errors.push(`Failed to insert item ${itemName}: ${err.message}`);
                        }
                        remaining--;
                        if (remaining === 0) finish();
                      }
                    );
                  });
                  function finish() {
                    if (errors.length > 0) {
                      db.run('ROLLBACK');
                      console.error('PATCH /api/sales-orders/:orderId: Errors occurred', errors);
                      return res.status(400).json({ error: errors.join('; ') });
                    }
                    if (status === 'Approved') {
                      db.get('SELECT value FROM system_settings WHERE key = ?', ['keg_deposit_price'], (err, setting) => {
                        if (err) {
                          db.run('ROLLBACK');
                          console.error('PATCH /api/sales-orders/:orderId: Fetch keg_deposit_price error:', err);
                          return res.status(500).json({ error: err.message });
                        }
                        if (!setting) {
                          db.run('ROLLBACK');
                          console.error('PATCH /api/sales-orders/:orderId: Keg deposit price not set in system_settings');
                          return res.status(500).json({ error: 'Keg deposit price not configured' });
                        }
                        const kegDepositPrice = parseFloat(setting.value);
                        console.log('PATCH /api/sales-orders/:orderId: Keg deposit price', { kegDepositPrice });
                        let subtotal = 0;
                        let kegDepositTotal = 0;
                        let kegDepositCount = 0;
                        items.forEach(item => {
                          subtotal += parseFloat(item.price) * item.quantity;
                          if (item.hasKegDeposit) {
                            kegDepositCount += item.quantity;
                            kegDepositTotal += item.quantity * kegDepositPrice;
                          }
                        });
                        const total = subtotal + kegDepositTotal;
                        console.log('PATCH /api/sales-orders/:orderId: Calculated totals', { subtotal, kegDepositTotal, total });
                        db.run(
                          'INSERT INTO invoices (orderId, customerId, status, createdDate, total, subtotal, keg_deposit_total, keg_deposit_price) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
                          [orderId, customerId, 'Draft', new Date().toISOString().split('T')[0], total.toFixed(2), subtotal.toFixed(2), kegDepositTotal.toFixed(2), kegDepositPrice.toFixed(2)],
                          function (err) {
                            if (err) {
                              db.run('ROLLBACK');
                              console.error('PATCH /api/sales-orders/:orderId: Insert invoice error:', err);
                              return res.status(500).json({ error: err.message });
                            }
                            const invoiceId = this.lastID;
                            console.log('PATCH /api/sales-orders/:orderId: Created invoice', { invoiceId });
                            let invoiceItemsRemaining = items.length + (kegDepositCount > 0 ? 1 : 0);
                            items.forEach(item => {
                              db.run(
                                'INSERT INTO invoice_items (invoiceId, itemName, quantity, unit, price, hasKegDeposit, kegCodes) VALUES (?, ?, ?, ?, ?, ?, ?)',
                                [invoiceId, item.itemName, item.quantity, item.unit, item.price, item.hasKegDeposit ? 1 : 0, item.kegCodes ? JSON.stringify(item.kegCodes) : null],
                                (err) => {
                                  if (err) {
                                    db.run('ROLLBACK');
                                    console.error('PATCH /api/sales-orders/:orderId: Insert invoice item error:', err);
                                    return res.status(500).json({ error: err.message });
                                  }
                                  console.log('PATCH /api/sales-orders/:orderId: Inserted invoice item', { itemName: item.itemName });
                                  if (--invoiceItemsRemaining === 0) commit();
                                }
                              );
                            });
                            if (kegDepositCount > 0) {
                              db.run(
                                'INSERT INTO invoice_items (invoiceId, itemName, quantity, unit, price, hasKegDeposit) VALUES (?, ?, ?, ?, ?, ?)',
                                [invoiceId, 'Keg Deposit', kegDepositCount, 'Units', kegDepositPrice.toFixed(2), 0],
                                (err) => {
                                  if (err) {
                                    db.run('ROLLBACK');
                                    console.error('PATCH /api/sales-orders/:orderId: Insert keg deposit item error:', err);
                                    return res.status(500).json({ error: err.message });
                                  }
                                  console.log('PATCH /api/sales-orders/:orderId: Inserted keg deposit item', { kegDepositCount, kegDepositPrice });
                                  if (--invoiceItemsRemaining === 0) commit();
                                }
                              );
                            } else {
                              if (--invoiceItemsRemaining === 0) commit();
                            }
                            function commit() {
                              db.run('COMMIT', (err) => {
                                if (err) {
                                  db.run('ROLLBACK');
                                  console.error('PATCH /api/sales-orders/:orderId: Commit transaction error:', err);
                                  return res.status(500).json({ error: 'Failed to commit transaction' });
                                }
                                db.get(
                                  `SELECT so.*, c.name AS customerName
                                   FROM sales_orders so
                                   JOIN customers c ON so.customerId = c.customerId
                                   WHERE so.orderId = ?`,
                                  [orderId],
                                  (err, order) => {
                                    if (err) {
                                      console.error('PATCH /api/sales-orders/:orderId: Fetch order error:', err);
                                      return res.status(500).json({ error: err.message });
                                    }
                                    db.all('SELECT id, itemName, quantity, unit, price, hasKegDeposit, kegCodes FROM sales_order_items WHERE orderId = ?', [orderId], (err, items) => {
                                      if (err) {
                                        console.error('PATCH /api/sales-orders/:orderId: Fetch items error:', err);
                                        return res.status(500).json({ error: err.message });
                                      }
                                      db.get('SELECT value FROM system_settings WHERE key = ?', ['keg_deposit_price'], (err, setting) => {
                                        if (err) {
                                          console.error('PATCH /api/sales-orders/:orderId: Fetch keg_deposit_price error:', err);
                                          return res.status(500).json({ error: err.message });
                                        }
                                        order.items = items.map(item => ({
                                          ...item,
                                          kegCodes: item.kegCodes ? JSON.parse(item.kegCodes) : null,
                                        }));
                                        order.keg_deposit_price = setting ? setting.value : '0.00';
                                        order.invoiceId = invoiceId;
                                        console.log('PATCH /api/sales-orders/:orderId: Success', order);
                                        res.json(order);
                                      });
                                    });
                                  }
                                );
                              });
                            }
                          }
                        );
                      });
                    } else {
                      db.run('COMMIT', (err) => {
                        if (err) {
                          console.error('PATCH /api/sales-orders/:orderId: Commit transaction error:', err);
                          return res.status(500).json({ error: 'Failed to commit transaction' });
                        }
                        db.get(
                          `SELECT so.*, c.name AS customerName
                           FROM sales_orders so
                           JOIN customers c ON so.customerId = c.customerId
                           WHERE so.orderId = ?`,
                          [orderId],
                          (err, order) => {
                            if (err) {
                              console.error('PATCH /api/sales-orders/:orderId: Fetch order error:', err);
                              return res.status(500).json({ error: err.message });
                            }
                            db.all('SELECT id, itemName, quantity, unit, price, hasKegDeposit, kegCodes FROM sales_order_items WHERE orderId = ?', [orderId], (err, items) => {
                              if (err) {
                                console.error('PATCH /api/sales-orders/:orderId: Fetch items error:', err);
                                return res.status(500).json({ error: err.message });
                              }
                              db.get('SELECT value FROM system_settings WHERE key = ?', ['keg_deposit_price'], (err, setting) => {
                                if (err) {
                                  console.error('PATCH /api/sales-orders/:orderId: Fetch keg_deposit_price error:', err);
                                  return res.status(500).json({ error: err.message });
                                }
                                order.items = items.map(item => ({
                                  ...item,
                                  kegCodes: item.kegCodes ? JSON.parse(item.kegCodes) : null,
                                }));
                                order.keg_deposit_price = setting ? setting.value : '0.00';
                                console.log('PATCH /api/sales-orders/:orderId: Success', order);
                                res.json(order);
                              });
                            });
                          }
                        );
                      });
                    }
                  }
                });
              }
            );
          });
        });
      }
    });
  });
});

// Invoices
app.get('/api/invoices', (req, res) => {
  const { page = 1, limit = 10 } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);
  db.get('SELECT COUNT(*) as total FROM invoices WHERE status != ?', ['Cancelled'], (err, countResult) => {
    if (err) {
      console.error('GET /api/invoices: Count error:', err);
      return res.status(500).json({ error: err.message });
    }
    const totalInvoices = countResult.total;
    const totalPages = Math.ceil(totalInvoices / parseInt(limit));
    db.all(
      `SELECT i.*, c.name AS customerName
       FROM invoices i
       JOIN customers c ON i.customerId = c.customerId
       WHERE i.status != ?
       LIMIT ? OFFSET ?`,
      ['Cancelled', parseInt(limit), offset],
      (err, rows) => {
        if (err) {
          console.error('GET /api/invoices: Fetch error:', err);
          return res.status(500).json({ error: err.message });
        }
        console.log('GET /api/invoices: Success', { count: rows.length, page, limit, totalPages });
        res.json({ invoices: rows, totalPages });
      }
    );
  });
});

app.get('/api/invoices/:invoiceId', (req, res) => {
  const { invoiceId } = req.params;
  console.log('GET /api/invoices/:invoiceId: Received request', { invoiceId });
  db.get(
    `SELECT i.*, c.name AS customerName, c.email AS customerEmail
     FROM invoices i
     JOIN customers c ON i.customerId = c.customerId
     WHERE i.invoiceId = ?`,
    [invoiceId],
    (err, invoice) => {
      if (err) {
        console.error('GET /api/invoices/:invoiceId: Fetch invoice error:', err);
        return res.status(500).json({ error: err.message });
      }
      if (!invoice) {
        console.error('GET /api/invoices/:invoiceId: Invoice not found', { invoiceId });
        return res.status(404).json({ error: 'Invoice not found' });
      }
      db.all(
        'SELECT id, itemName, quantity, unit, price, hasKegDeposit FROM invoice_items WHERE invoiceId = ? AND itemName != ?',
        [invoiceId, 'Keg Deposit'],
        (err, items) => {
          if (err) {
            console.error('GET /api/invoices/:invoiceId: Fetch items error:', err);
            return res.status(500).json({ error: err.message });
          }
          db.get('SELECT value FROM system_settings WHERE key = ?', ['keg_deposit_price'], (err, setting) => {
            if (err) {
              console.error('GET /api/invoices/:invoiceId: Fetch keg_deposit_price error:', err);
              return res.status(500).json({ error: err.message });
            }
            if (!setting) {
              console.error('GET /api/invoices/:invoiceId: Keg deposit price not set in system_settings');
              return res.status(500).json({ error: 'Keg deposit price not configured' });
            }
            const kegDepositPrice = parseFloat(setting.value);
            let subtotal = 0;
            let kegDepositTotal = 0;
            const enhancedItems = items.map(item => {
              const itemPrice = parseFloat(item.price || 0);
              subtotal += itemPrice * item.quantity;
              const kegDeposit = item.hasKegDeposit
                ? {
                    itemName: 'Keg Deposit',
                    quantity: item.quantity,
                    unit: 'Units',
                    price: kegDepositPrice.toFixed(2),
                    hasKegDeposit: 0,
                    isSubCharge: true
                  }
                : null;
              if (kegDeposit) {
                kegDepositTotal += kegDeposit.quantity * kegDepositPrice;
              }
              return { ...item, kegDeposit };
            });
            invoice.items = enhancedItems;
            invoice.subtotal = subtotal.toFixed(2);
            invoice.keg_deposit_total = kegDepositTotal.toFixed(2);
            invoice.total = (subtotal + kegDepositTotal).toFixed(2);
            invoice.keg_deposit_price = kegDepositPrice.toFixed(2);
            console.log('GET /api/invoices/:invoiceId: Success', {
              invoiceId,
              total: invoice.total,
              subtotal: invoice.subtotal,
              keg_deposit_total: invoice.keg_deposit_total,
              itemCount: invoice.items.length,
            });
            res.json(invoice);
          });
        }
      );
    }
  );
});

app.patch('/api/invoices/:invoiceId', (req, res) => {
  const { invoiceId } = req.params;
  const { items } = req.body;
  console.log('PATCH /api/invoices/:invoiceId: Received request', { invoiceId, items });

  if (!items || !Array.isArray(items) || items.length === 0) {
    console.error('PATCH /api/invoices/:invoiceId: Missing or invalid items', { items });
    return res.status(400).json({ error: 'Items are required and must be a non-empty array' });
  }

  db.get('SELECT * FROM invoices WHERE invoiceId = ? AND status = ?', [invoiceId, 'Draft'], (err, invoice) => {
    if (err) {
      console.error('PATCH /api/invoices/:invoiceId: Fetch invoice error:', err);
      return res.status(500).json({ error: err.message });
    }
    if (!invoice) {
      console.error('PATCH /api/invoices/:invoiceId: Invoice not found or not in Draft', { invoiceId });
      return res.status(404).json({ error: 'Invoice not found or not in Draft status' });
    }

    db.get('SELECT value FROM system_settings WHERE key = ?', ['keg_deposit_price'], (err, setting) => {
      if (err) {
        console.error('PATCH /api/invoices/:invoiceId: Fetch keg_deposit_price error:', err);
        return res.status(500).json({ error: err.message });
      }
      if (!setting) {
        console.error('PATCH /api/invoices/:invoiceId: Keg deposit price not set in system_settings');
        return res.status(500).json({ error: 'Keg deposit price not configured' });
      }
      const kegDepositPrice = parseFloat(setting.value);

      // Validate kegCodes
      const errors = [];
      items.forEach((item, index) => {
        const { itemName, quantity, kegCodes, hasKegDeposit } = item;
        if (hasKegDeposit && (!kegCodes || !Array.isArray(kegCodes) || kegCodes.length !== quantity)) {
          errors.push(`Item ${itemName} at index ${index} requires exactly ${quantity} keg codes`);
        }
        if (kegCodes && kegCodes.some(code => !/^[A-Z0-9-]+$/.test(code))) {
          errors.push(`Invalid kegCodes for item ${itemName} at index ${index}: must be valid codes`);
        }
      });
      if (errors.length > 0) {
        console.error('PATCH /api/invoices/:invoiceId: Validation errors', errors);
        return res.status(400).json({ error: errors.join('; ') });
      }

      db.serialize(() => {
        db.run('BEGIN TRANSACTION', (err) => {
          if (err) {
            console.error('PATCH /api/invoices/:invoiceId: Begin transaction error:', err);
            return res.status(500).json({ error: err.message });
          }

          db.run('DELETE FROM invoice_items WHERE invoiceId = ?', [invoiceId], (err) => {
            if (err) {
              db.run('ROLLBACK');
              console.error('PATCH /api/invoices/:invoiceId: Delete items error:', err);
              return res.status(500).json({ error: err.message });
            }

            let remaining = items.length;
            let subtotal = 0;
            let kegDepositTotal = 0;

            items.forEach((item, index) => {
              const { itemName, quantity, unit, price, hasKegDeposit, kegCodes } = item;
              if (!itemName || quantity < 0 || !unit || !price || isNaN(parseFloat(price))) {
                errors.push(`Invalid item at index ${index}: itemName, quantity, unit, and valid price are required`);
                remaining--;
                if (remaining === 0) finish();
                return;
              }

              db.run(
                'INSERT INTO invoice_items (invoiceId, itemName, quantity, unit, price, hasKegDeposit, kegCodes) VALUES (?, ?, ?, ?, ?, ?, ?)',
                [invoiceId, itemName, quantity, unit, price, hasKegDeposit ? 1 : 0, kegCodes ? JSON.stringify(kegCodes) : null],
                (err) => {
                  if (err) {
                    console.error('PATCH /api/invoices/:invoiceId: Insert item error:', err);
                    errors.push(`Failed to insert item ${itemName}: ${err.message}`);
                  } else {
                    subtotal += parseFloat(price) * quantity;
                    if (hasKegDeposit) {
                      kegDepositTotal += quantity * kegDepositPrice;
                    }
                  }
                  remaining--;
                  if (remaining === 0) finish();
                }
              );
            });

            function finish() {
              if (errors.length > 0) {
                db.run('ROLLBACK');
                console.error('PATCH /api/invoices/:invoiceId: Errors occurred', errors);
                return res.status(400).json({ error: errors.join('; ') });
              }

              const total = subtotal + kegDepositTotal;
              db.run(
                'UPDATE invoices SET subtotal = ?, keg_deposit_total = ?, total = ? WHERE invoiceId = ?',
                [subtotal.toFixed(2), kegDepositTotal.toFixed(2), total.toFixed(2), invoiceId],
                (err) => {
                  if (err) {
                    db.run('ROLLBACK');
                    console.error('PATCH /api/invoices/:invoiceId: Update invoice error:', err);
                    return res.status(500).json({ error: err.message });
                  }

                  db.run('COMMIT', (err) => {
                    if (err) {
                      console.error('PATCH /api/invoices/:invoiceId: Commit transaction error:', err);
                      return res.status(500).json({ error: 'Failed to commit transaction' });
                    }

                    db.all(
                      'SELECT id, itemName, quantity, unit, price, hasKegDeposit, kegCodes FROM invoice_items WHERE invoiceId = ? AND itemName != ?',
                      [invoiceId, 'Keg Deposit'],
                      (err, dbItems) => {
                        if (err) {
                          console.error('PATCH /api/invoices/:invoiceId: Fetch items error:', err);
                          return res.status(500).json({ error: err.message });
                        }

                        const enhancedItems = dbItems.map(item => ({
                          ...item,
                          hasKegDeposit: !!item.hasKegDeposit,
                          kegCodes: item.kegCodes ? JSON.parse(item.kegCodes) : null,
                          kegDeposit: item.hasKegDeposit ? {
                            itemName: 'Keg Deposit',
                            quantity: item.quantity,
                            unit: 'Units',
                            price: kegDepositPrice.toFixed(2),
                            hasKegDeposit: false,
                            isSubCharge: true,
                          } : null,
                        }));

                        db.get(
                          `SELECT i.*, c.name AS customerName, c.email AS customerEmail
                           FROM invoices i
                           JOIN customers c ON i.customerId = c.customerId
                           WHERE i.invoiceId = ?`,
                          [invoiceId],
                          (err, updatedInvoice) => {
                            if (err) {
                              console.error('PATCH /api/invoices/:invoiceId: Fetch invoice error:', err);
                              return res.status(500).json({ error: err.message });
                            }
                            updatedInvoice.items = enhancedItems;
                            updatedInvoice.keg_deposit_price = kegDepositPrice.toFixed(2);
                            console.log('PATCH /api/invoices/:invoiceId: Success', {
                              invoiceId,
                              total: updatedInvoice.total,
                              subtotal: updatedInvoice.subtotal,
                              keg_deposit_total: updatedInvoice.keg_deposit_total,
                              itemCount: updatedInvoice.items.length,
                            });
                            res.json(updatedInvoice);
                          }
                        );
                      }
                    );
                  });
                }
              );
            }
          });
        });
      });
    });
  });
});

app.post('/api/invoices/:invoiceId/post', (req, res) => {
  const { invoiceId } = req.params;
  console.log('POST /api/invoices/:invoiceId/post: Received request', { invoiceId });
  db.get('SELECT * FROM invoices WHERE invoiceId = ? AND status = ?', [invoiceId, 'Draft'], (err, invoice) => {
    if (err) {
      console.error('POST /api/invoices/:invoiceId/post: Fetch invoice error:', err);
      return res.status(500).json({ error: err.message });
    }
    if (!invoice) {
      console.error('POST /api/invoices/:invoiceId/post: Invoice not found or not in Draft', { invoiceId });
      return res.status(404).json({ error: 'Invoice not found or not in Draft status' });
    }
    db.all(
      'SELECT itemName, quantity, unit, price, hasKegDeposit, kegCodes FROM invoice_items WHERE invoiceId = ? AND itemName != ?',
      [invoiceId, 'Keg Deposit'],
      (err, orderItems) => {
        if (err) {
          console.error('POST /api/invoices/:invoiceId/post: Fetch invoice items error:', err);
          return res.status(500).json({ error: err.message });
        }
        console.log('POST /api/invoices/:invoiceId/post: Invoice items', orderItems);
        if (!orderItems || orderItems.length === 0) {
          console.error('POST /api/invoices/:invoiceId/post: No invoice items found', { invoiceId });
          return res.status(400).json({ error: 'No items found for the invoice' });
        }
        db.get('SELECT value FROM system_settings WHERE key = ?', ['keg_deposit_price'], (err, setting) => {
          if (err) {
            console.error('POST /api/invoices/:invoiceId/post: Fetch keg_deposit_price error:', err);
            return res.status(500).json({ error: err.message });
          }
          if (!setting) {
            console.error('POST /api/invoices/:invoiceId/post: Keg deposit price not set in system_settings');
            return res.status(500).json({ error: 'Keg deposit price not configured' });
          }
          const kegDepositPrice = parseFloat(setting.value);
          console.log('POST /api/invoices/:invoiceId/post: Keg deposit price', { kegDepositPrice });

          // Validate kegCodes
          const errors = [];
          orderItems.forEach(item => {
            if (item.hasKegDeposit) {
              const kegCodes = item.kegCodes ? JSON.parse(item.kegCodes) : [];
              if (!kegCodes || kegCodes.length !== item.quantity) {
                errors.push(`Item ${item.itemName} requires exactly ${item.quantity} keg codes`);
              }
            }
          });
          if (errors.length > 0) {
            console.error('POST /api/invoices/:invoiceId/post: Validation errors', errors);
            return res.status(400).json({ error: errors.join('; ') });
          }

          db.serialize(() => {
            db.run('BEGIN TRANSACTION', (err) => {
              if (err) {
                console.error('POST /api/invoices/:invoiceId/post: Begin transaction error:', err);
                return res.status(500).json({ error: 'Failed to start transaction' });
              }
              db.run('DELETE FROM invoice_items WHERE invoiceId = ?', [invoiceId], (err) => {
                if (err) {
                  db.run('ROLLBACK');
                  console.error('POST /api/invoices/:invoiceId/post: Delete invoice items error:', err);
                  return res.status(500).json({ error: err.message });
                }
                let remaining = orderItems.length;
                let subtotal = 0;
                let kegDepositTotal = 0;
                orderItems.forEach((item) => {
                  console.log('POST /api/invoices/:invoiceId/post: Processing item', item);
                  if (!item.price || isNaN(parseFloat(item.price))) {
                    console.error('POST /api/invoices/:invoiceId/post: Invalid price for item', {
                      itemName: item.itemName,
                      price: item.price,
                    });
                    db.run('ROLLBACK');
                    return res.status(400).json({ error: `Invalid price for item ${item.itemName || 'Unknown'}` });
                  }
                  db.get(
                    'SELECT quantity FROM inventory WHERE identifier = ? AND type IN (?, ?)',
                    [item.itemName, 'Finished Goods', 'Marketing'],
                    (err, row) => {
                      if (err) {
                        db.run('ROLLBACK');
                        console.error('POST /api/invoices/:invoiceId/post: Fetch inventory error:', err);
                        return res.status(500).json({ error: err.message });
                      }
                      if (!row || parseFloat(row.quantity) < item.quantity) {
                        db.run('ROLLBACK');
                        console.error('POST /api/invoices/:invoiceId/post: Insufficient inventory', {
                          itemName: item.itemName,
                          available: row?.quantity,
                          needed: item.quantity,
                        });
                        return res.status(400).json({ error: `Insufficient inventory for ${item.itemName}` });
                      }
                      db.run(
                        'UPDATE inventory SET quantity = quantity - ? WHERE identifier = ? AND type IN (?, ?)',
                        [item.quantity, item.itemName, 'Finished Goods', 'Marketing'],
                        (err) => {
                          if (err) {
                            db.run('ROLLBACK');
                            console.error('POST /api/invoices/:invoiceId/post: Update inventory error:', err);
                            return res.status(500).json({ error: err.message });
                          }
                          const kegCodes = item.kegCodes ? JSON.parse(item.kegCodes) : [];
                          // Update keg locations if hasKegDeposit
                          const updateKegs = (callback) => {
                            if (!item.hasKegDeposit || !kegCodes.length) {
                              return callback();
                            }
                            db.get('SELECT name FROM customers WHERE customerId = ?', [invoice.customerId], (err, customer) => {
                              if (err) {
                                db.run('ROLLBACK');
                                console.error('POST /api/invoices/:invoiceId/post: Fetch customer error:', err);
                                return res.status(500).json({ error: err.message });
                              }
                              let remainingKegs = kegCodes.length;
                              kegCodes.forEach(code => {
                                db.run(
                                  `UPDATE kegs SET status = ?, location = ?, customerId = ?, lastScanned = ? 
                                   WHERE code = ?`,
                                  ['Filled', `Customer: ${customer.name}`, invoice.customerId, new Date().toISOString().split('T')[0], code],
                                  (err) => {
                                    if (err) {
                                      db.run('ROLLBACK');
                                      console.error('POST /api/invoices/:invoiceId/post: Update keg error:', err);
                                      return res.status(500).json({ error: `Failed to update keg ${code}: ${err.message}` });
                                    }
                                    db.run(
                                      `INSERT INTO keg_transactions (kegId, action, invoiceId, customerId, date, location)
                                       VALUES ((SELECT id FROM kegs WHERE code = ?), ?, ?, ?, ?, ?)`,
                                      [code, 'Shipped', invoiceId, invoice.customerId, new Date().toISOString().split('T')[0], `Customer: ${customer.name}`],
                                      (err) => {
                                        if (err) {
                                          db.run('ROLLBACK');
                                          console.error('POST /api/invoices/:invoiceId/post: Insert keg transaction error:', err);
                                          return res.status(500).json({ error: `Failed to record keg transaction for ${code}: ${err.message}` });
                                        }
                                        if (--remainingKegs === 0) callback();
                                      }
                                    );
                                  }
                                );
                              });
                            });
                          };

                          updateKegs(() => {
                            db.run(
                              'INSERT INTO invoice_items (invoiceId, itemName, quantity, unit, price, hasKegDeposit, kegCodes) VALUES (?, ?, ?, ?, ?, ?, ?)',
                              [invoiceId, item.itemName, item.quantity, item.unit, item.price, item.hasKegDeposit ? 1 : 0, item.kegCodes],
                              (err) => {
                                if (err) {
                                  db.run('ROLLBACK');
                                  console.error('POST /api/invoices/:invoiceId/post: Insert invoice item error:', err);
                                  return res.status(500).json({ error: err.message });
                                }
                                subtotal += parseFloat(item.price) * item.quantity;
                                if (item.hasKegDeposit) {
                                  kegDepositTotal += item.quantity * kegDepositPrice;
                                }
                                if (--remaining === 0) {
                                  commitTransaction();
                                }
                              }
                            );
                          });
                        }
                      );
                    }
                  );
                });
                function commitTransaction() {
                  const total = subtotal + kegDepositTotal;
                  db.run(
                    'UPDATE invoices SET status = ?, postedDate = ?, total = ?, subtotal = ?, keg_deposit_total = ? WHERE invoiceId = ?',
                    ['Posted', new Date().toISOString().split('T')[0], total.toFixed(2), subtotal.toFixed(2), kegDepositTotal.toFixed(2), invoiceId],
                    (err) => {
                      if (err) {
                        db.run('ROLLBACK');
                        console.error('POST /api/invoices/:invoiceId/post: Update invoice error:', err);
                        return res.status(500).json({ error: err.message });
                      }
                      db.run('COMMIT', (err) => {
                        if (err) {
                          console.error('POST /api/invoices/:invoiceId/post: Commit transaction error:', err);
                          return res.status(500).json({ error: 'Failed to commit transaction' });
                        }
                        db.all(
                          'SELECT id, itemName, quantity, unit, price, hasKegDeposit, kegCodes FROM invoice_items WHERE invoiceId = ?',
                          [invoiceId],
                          (err, items) => {
                            if (err) {
                              console.error('POST /api/invoices/:invoiceId/post: Fetch items error:', err);
                              return res.status(500).json({ error: err.message });
                            }
                            console.log('POST /api/invoices/:invoiceId/post: Success', {
                              invoiceId,
                              subtotal,
                              kegDepositTotal,
                              total,
                            });
                            res.json({
                              message: 'Invoice posted, inventory updated',
                              subtotal: subtotal.toFixed(2),
                              keg_deposit_total: kegDepositTotal.toFixed(2),
                              total: total.toFixed(2),
                              items: items.map(item => ({
                                ...item,
                                kegCodes: item.kegCodes ? JSON.parse(item.kegCodes) : null,
                              })),
                            });
                          }
                        );
                      });
                    }
                  );
                }
              });
            });
          });
        });
      }
    );
  });
});

app.post('/api/invoices/:invoiceId/email', (req, res) => {
  const { invoiceId } = req.params;
  console.log('POST /api/invoices/:invoiceId/email: Received request', { invoiceId });

  db.get(
    `SELECT i.*, c.name AS customerName, c.email AS customerEmail
     FROM invoices i
     JOIN customers c ON i.customerId = c.customerId
     WHERE i.invoiceId = ?`,
    [invoiceId],
    (err, invoice) => {
      if (err) {
        console.error('POST /api/invoices/:invoiceId/email: Fetch invoice error:', err);
        return res.status(500).json({ error: err.message });
      }
      if (!invoice) {
        console.error('POST /api/invoices/:invoiceId/email: Invoice not found', { invoiceId });
        return res.status(404).json({ error: 'Invoice not found' });
      }

      db.all(
        'SELECT id, itemName, quantity, unit, price, hasKegDeposit FROM invoice_items WHERE invoiceId = ?',
        [invoiceId],
        (err, items) => {
          if (err) {
            console.error('POST /api/invoices/:invoiceId/email: Fetch items error:', err);
            return res.status(500).json({ error: err.message });
          }
          if (!items || items.length === 0) {
            console.error('POST /api/invoices/:invoiceId/email: No items found', { invoiceId });
            return res.status(400).json({ error: 'No items found for the invoice' });
          }

          console.log('POST /api/invoices/:invoiceId/email: Invoice data before email', {
            invoiceId,
            total: invoice.total,
            subtotal: invoice.subtotal,
            keg_deposit_total: invoice.keg_deposit_total,
            items,
          });

          db.get('SELECT value FROM system_settings WHERE key = ?', ['invoice_email_body'], (err, setting) => {
            if (err) {
              console.error('POST /api/invoices/:invoiceId/email: Fetch email body error:', err);
              return res.status(500).json({ error: err.message });
            }
            const emailBody = setting ? setting.value : 'Please find your new invoice from Dothan Brewpub.';
            const mailOptions = {
              from: process.env.EMAIL_USER,
              to: invoice.customerEmail,
              subject: `Invoice ${invoiceId} from Dothan Brewpub`,
              text: `${emailBody}\n\nInvoice ID: ${invoiceId}\nCustomer: ${invoice.customerName}\nTotal: $${parseFloat(invoice.total).toFixed(2)}\nItems:\n${items.map(item => `- ${item.quantity} ${item.unit} ${item.itemName} ($${parseFloat(item.price || 0).toFixed(2)}) ${item.hasKegDeposit ? '(Keg Deposit)' : ''}`).join('\n')}`,
            };

            transporter.sendMail(mailOptions, (err, info) => {
              if (err) {
                console.error('POST /api/invoices/:invoiceId/email: Email send error:', err);
                return res.status(500).json({ error: 'Failed to send email: ' + err.message });
              }

              // Verify invoice data after email
              db.get(
                `SELECT total, subtotal, keg_deposit_total FROM invoices WHERE invoiceId = ?`,
                [invoiceId],
                (err, postEmailInvoice) => {
                  if (err) {
                    console.error('POST /api/invoices/:invoiceId/email: Post-email fetch error:', err);
                    return res.status(500).json({ error: err.message });
                  }
                  console.log('POST /api/invoices/:invoiceId/email: Invoice data after email', {
                    invoiceId,
                    total: postEmailInvoice.total,
                    subtotal: postEmailInvoice.subtotal,
                    keg_deposit_total: postEmailInvoice.keg_deposit_total,
                  });

                  console.log('POST /api/invoices/:invoiceId/email: Email sent successfully', { invoiceId, info });
                  res.json({ message: 'Email sent successfully' });
                }
              );
            });
          });
        }
      );
    }
  );
});

// System Settings
app.get('/api/system-settings', (req, res) => {
  db.all('SELECT key, value FROM system_settings', (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    const settings = rows.reduce((acc, row) => ({ ...acc, [row.key]: row.value }), {});
    res.json(settings);
  });
});

app.get('/api/settings', (req, res) => {
  console.log('GET /api/settings: Received request');
  db.all('SELECT key, value FROM system_settings', (err, rows) => {
    if (err) {
      console.error('GET /api/settings: Fetch settings error:', err);
      return res.status(500).json({ error: err.message });
    }
    const settings = rows.reduce((acc, row) => ({ ...acc, [row.key]: row.value }), {});
    console.log('GET /api/settings: Success', settings);
    res.json(settings);
  });
});

app.put('/api/settings', (req, res) => {
  const settings = req.body;
  console.log('PUT /api/settings: Received request', settings);
  if (!settings || typeof settings !== 'object') {
    console.error('PUT /api/settings: Invalid settings', settings);
    return res.status(400).json({ error: 'Settings object is required' });
  }

  db.serialize(() => {
    db.run('BEGIN TRANSACTION', (err) => {
      if (err) {
        console.error('PUT /api/settings: Begin transaction error:', err);
        return res.status(500).json({ error: `Failed to start transaction: ${err.message}` });
      }

      let remaining = Object.keys(settings).length;
      if (remaining === 0) {
        db.run('COMMIT', () => {
          console.log('PUT /api/settings: Success, no settings to update');
          res.json({ message: 'Settings updated' });
        });
        return;
      }

      for (const [key, value] of Object.entries(settings)) {
        if (key === 'keg_deposit_price' && (isNaN(parseFloat(value)) || parseFloat(value) < 0)) {
          db.run('ROLLBACK');
          console.error('PUT /api/settings: Invalid keg_deposit_price', { value });
          return res.status(400).json({ error: 'keg_deposit_price must be a non-negative number' });
        }
        db.run(
          'INSERT OR REPLACE INTO system_settings (key, value) VALUES (?, ?)',
          [key, value],
          (err) => {
            if (err) {
              db.run('ROLLBACK');
              console.error('PUT /api/settings: Insert setting error:', err);
              return res.status(500).json({ error: `Failed to update setting ${key}: ${err.message}` });
            }
            if (--remaining === 0) {
              db.run('COMMIT', (err) => {
                if (err) {
                  console.error('PUT /api/settings: Commit transaction error:', err);
                  return res.status(500).json({ error: `Failed to commit transaction: ${err.message}` });
                }
                console.log('PUT /api/settings: Success', settings);
                res.json({ message: 'Settings updated' });
              });
            }
          }
        );
      }
    });
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
  const { name } = req.query;
  let query = 'SELECT * FROM products WHERE enabled = 1';
  let params = [];
  if (name) {
    query += ' AND name = ?';
    params.push(name);
  }
  db.all(query, params, (err, rows) => {
    if (err) {
      console.error('Fetch products error:', err);
      return res.status(500).json({ error: err.message });
    }
    const productsWithPackageTypes = [];
    let remaining = rows.length;
    if (remaining === 0) {
      console.log('GET /api/products, returning:', rows);
      res.json(rows);
      return;
    }
    rows.forEach((product) => {
      db.all(
        'SELECT type, price, isKegDepositItem FROM product_package_types WHERE productId = ?',
        [product.id],
        (err, packageTypes) => {
          if (err) {
            console.error('Fetch package types error:', err);
            packageTypes = [];
          }
          productsWithPackageTypes.push({ ...product, packageTypes });
          if (--remaining === 0) {
            console.log('GET /api/products, returning:', productsWithPackageTypes);
            res.json(productsWithPackageTypes);
          }
        }
      );
    });
  });
});

app.get('/api/products/:id', (req, res) => {
  const id = parseInt(req.params.id);
  console.log('GET /api/products/:id: Received request', { id });
  db.get('SELECT * FROM products WHERE id = ?', [id], (err, row) => {
    if (err) {
      console.error('GET /api/products/:id: Fetch product error:', err);
      return res.status(500).json({ error: err.message });
    }
    if (!row) {
      console.error('GET /api/products/:id: Product not found', { id });
      return res.status(404).json({ error: 'Product not found' });
    }
    db.all('SELECT type, price, isKegDepositItem FROM product_package_types WHERE productId = ?', [id], (err, packageTypes) => {
      if (err) {
        console.error('GET /api/products/:id: Fetch package types error:', err);
        return res.status(500).json({ error: err.message });
      }
      const product = { ...row, packageTypes: packageTypes || [] };
      console.log('GET /api/products/:id: Success', product);
      res.json(product);
    });
  });
});

app.patch('/api/products/:id', (req, res) => {
  const { id } = req.params;
  const { name, abbreviation, enabled = true, priority = 1, class: prodClass, type, style, abv = 0, ibu = 0, packageTypes = [] } = req.body;
  console.log('PATCH /api/products/:id: Received request', { id, name, abbreviation, type, style, packageTypes });

  if (!name || !abbreviation || !type || !style) {
    console.error('PATCH /api/products/:id: Missing required fields', { name, abbreviation, type, style });
    return res.status(400).json({ error: 'Name, abbreviation, type, and style are required' });
  }

  const validProductTypes = ['Malt', 'Spirits', 'Wine', 'Merchandise', 'Cider', 'Seltzer'];
  if (!validProductTypes.includes(type)) {
    console.error('PATCH /api/products/:id: Invalid type', { type });
    return res.status(400).json({ error: `Invalid product type. Must be one of: ${validProductTypes.join(', ')}` });
  }
  if ((type === 'Seltzer' || type === 'Merchandise') && style !== 'Other') {
    console.error('PATCH /api/products/:id: Invalid style for type', { type, style });
    return res.status(400).json({ error: 'Style must be "Other" for Seltzer or Merchandise' });
  }

  if (!Array.isArray(packageTypes)) {
    console.error('PATCH /api/products/:id: Invalid packageTypes', { packageTypes });
    return res.status(400).json({ error: 'packageTypes must be an array' });
  }

  const validPackageTypes = packageTypes.filter(pkg => {
    if (!pkg.type || !pkg.price || pkg.isKegDepositItem === undefined) {
      console.warn('PATCH /api/products/:id: Skipping invalid package type', { pkg });
      return false;
    }
    if (!packageVolumes[pkg.type]) {
      console.warn('PATCH /api/products/:id: Skipping invalid package type', { type: pkg.type });
      return false;
    }
    if (isNaN(parseFloat(pkg.price)) || parseFloat(pkg.price) < 0) {
      console.warn('PATCH /api/products/:id: Skipping invalid price', { price: pkg.price });
      return false;
    }
    return true;
  });

  db.serialize(() => {
    db.run('BEGIN TRANSACTION', (err) => {
      if (err) {
        console.error('PATCH /api/products/:id: Begin transaction error:', err);
        return res.status(500).json({ error: `Failed to start transaction: ${err.message}` });
      }

      db.run(
        `UPDATE products SET name = ?, abbreviation = ?, enabled = ?, priority = ?, class = ?, type = ?, style = ?, abv = ?, ibu = ? WHERE id = ?`,
        [name, abbreviation, enabled ? 1 : 0, priority, prodClass || null, type, style, abv, ibu, id],
        function (err) {
          if (err) {
            db.run('ROLLBACK');
            console.error('PATCH /api/products/:id: Update product error:', err);
            return res.status(500).json({ error: `Failed to update product: ${err.message}` });
          }
          if (this.changes === 0) {
            db.run('ROLLBACK');
            console.error('PATCH /api/products/:id: Product not found', { id });
            return res.status(404).json({ error: 'Product not found' });
          }

          db.run('DELETE FROM product_package_types WHERE productId = ?', [id], (err) => {
            if (err) {
              db.run('ROLLBACK');
              console.error('PATCH /api/products/:id: Delete package types error:', err);
              return res.status(500).json({ error: `Failed to delete package types: ${err.message}` });
            }
            console.log('PATCH /api/products/:id: Deleted existing package types', { productId: id });

            let remaining = validPackageTypes.length;
            if (remaining === 0) {
              updateItemsAndCommit();
              return;
            }

            validPackageTypes.forEach((pkg, index) => {
              db.run(
                `INSERT INTO product_package_types (productId, type, price, isKegDepositItem) VALUES (?, ?, ?, ?)`,
                [id, pkg.type, pkg.price, pkg.isKegDepositItem ? 1 : 0],
                (err) => {
                  if (err) {
                    db.run('ROLLBACK');
                    console.error('PATCH /api/products/:id: Insert package type error:', { index, pkg, error: err.message });
                    return res.status(500).json({ error: `Failed to insert package type ${pkg.type}: ${err.message}` });
                  }
                  console.log('PATCH /api/products/:id: Inserted package type', { productId: id, type: pkg.type, price: pkg.price });
                  if (--remaining === 0) {
                    updateItemsAndCommit();
                  }
                }
              );
            });

            function updateItemsAndCommit() {
              const itemInserts = validPackageTypes.map((pkg) => ({
                name: `${name} ${pkg.type}`,
                type: 'Finished Goods',
                enabled: 1,
              }));

              let itemRemaining = itemInserts.length;
              if (itemRemaining === 0) {
                commitTransaction();
                return;
              }

              itemInserts.forEach((item) => {
                db.run(
                  `INSERT OR IGNORE INTO items (name, type, enabled) VALUES (?, ?, ?)`,
                  [item.name, item.type, item.enabled],
                  (err) => {
                    if (err) {
                      db.run('ROLLBACK');
                      console.error('PATCH /api/products/:id: Insert item error:', { item, error: err.message });
                      return res.status(500).json({ error: `Failed to insert item ${item.name}: ${err.message}` });
                    }
                    console.log('PATCH /api/products/:id: Inserted item', { itemName: item.name });
                    if (--itemRemaining === 0) {
                      commitTransaction();
                    }
                  }
                );
              });

              function commitTransaction() {
                db.run('COMMIT', (err) => {
                  if (err) {
                    db.run('ROLLBACK');
                    console.error('PATCH /api/products/:id: Commit transaction error:', err);
                    return res.status(500).json({ error: `Failed to commit transaction: ${err.message}` });
                  }

                  db.get('SELECT * FROM products WHERE id = ?', [id], (err, product) => {
                    if (err) {
                      console.error('PATCH /api/products/:id: Fetch product error:', err);
                      return res.status(500).json({ error: `Failed to fetch product: ${err.message}` });
                    }

                    db.all('SELECT type, price, isKegDepositItem FROM product_package_types WHERE productId = ?', [id], (err, packageTypes) => {
                      if (err) {
                        console.error('PATCH /api/products/:id: Fetch package types error:', err);
                        return res.status(500).json({ error: `Failed to fetch package types: ${err.message}` });
                      }
                      console.log('PATCH /api/products/:id: Success', { id, product, packageTypes });
                      res.json({ ...product, packageTypes });
                    });
                  });
                });
              }
            }
          });
        }
      );
    });
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

// server.js (replace GET /api/batches around line ~1200)
app.get('/api/batches', (req, res) => {
  const { status, page = 1, limit = 10, legacy = false } = req.query;
  let query = `
    SELECT b.batchId, b.productId, p.name AS productName, b.recipeId, r.name AS recipeName, 
           b.siteId, s.name AS siteName, b.status, b.date
    FROM batches b
    JOIN products p ON b.productId = p.id
    JOIN recipes r ON b.recipeId = r.id
    JOIN sites s ON b.siteId = s.siteId
  `;
  let countQuery = `SELECT COUNT(*) as total FROM batches WHERE 1=1`;
  let params = [];
  let countParams = [];
  if (status) {
    query += ' WHERE b.status = ?';
    countQuery += ' AND status = ?';
    params.push(status);
    countParams.push(status);
  }
  if (legacy === 'true') {
    db.all(query, params, (err, rows) => {
      if (err) {
        console.error('GET /api/batches: Fetch error:', err);
        return res.status(500).json({ error: err.message });
      }
      console.log('GET /api/batches (legacy): Success', { count: rows.length });
      res.json(rows);
    });
  } else {
    const offset = (parseInt(page) - 1) * parseInt(limit);
    query += ' LIMIT ? OFFSET ?';
    params.push(parseInt(limit), offset);
    db.get(countQuery, countParams, (err, countResult) => {
      if (err) {
        console.error('GET /api/batches: Count error:', err);
        return res.status(500).json({ error: err.message });
      }
      const totalBatches = countResult.total;
      const totalPages = Math.ceil(totalBatches / parseInt(limit));
      db.all(query, params, (err, rows) => {
        if (err) {
          console.error('GET /api/batches: Fetch error:', err);
          return res.status(500).json({ error: err.message });
        }
        console.log('GET /api/batches: Success', { count: rows.length, page, limit, totalPages });
        res.json({ batches: rows, totalPages });
      });
    });
  }
});

app.post('/api/batches', (req, res) => {
  const { batchId, productId, recipeId, siteId, fermenterId, status, date } = req.body;
  if (!batchId || !productId || !recipeId || !siteId) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  console.log('POST /api/batches:', { batchId, recipeId, siteId });
  db.all('SELECT itemName, quantity, unit FROM recipe_ingredients WHERE recipeId = ?', [parseInt(recipeId)], (err, ingredients) => {
    if (err) {
      console.error('POST /api/batches: Fetch ingredients error:', err);
      return res.status(500).json({ error: err.message });
    }
    console.log('POST /api/batches: Ingredients', ingredients);
    const errors = [];
    let pending = ingredients.length;
    if (!pending) {
      insertBatch();
      return;
    }
    for (const ing of ingredients) {
      const inventoryItemName = ing.itemName;
      const recipeUnit = ing.unit.toLowerCase() === 'pounds' ? 'lbs' : ing.unit.toLowerCase();
      db.all(
        'SELECT identifier, quantity, unit, receivedDate, account, status, siteId, locationId FROM inventory WHERE identifier = ? AND siteId = ? AND status = ?',
        [inventoryItemName, siteId, 'Stored'],
        (err, rows) => {
          if (err) {
            console.error('POST /api/batches: Inventory check error:', err);
            return res.status(500).json({ error: err.message });
          }
          console.log('POST /api/batches: Inventory query', {
            item: inventoryItemName,
            siteId,
            status: 'Stored',
            rows: rows.map(r => ({ identifier: r.identifier, account: r.account, status: r.status, siteId: r.siteId, locationId: r.locationId, quantity: r.quantity, unit: r.unit }))
          });
          const totalAvailable = rows.reduce((sum, row) => {
            const inventoryUnit = row.unit.toLowerCase() === 'pounds' ? 'lbs' : row.unit.toLowerCase();
            return inventoryUnit === recipeUnit ? sum + parseFloat(row.quantity) : sum;
          }, 0);
          console.log('POST /api/batches: Inventory check', {
            item: inventoryItemName,
            unit: recipeUnit,
            available: totalAvailable,
            needed: ing.quantity,
            rows
          });
          if (totalAvailable < ing.quantity) {
            errors.push(
              `Insufficient inventory for ${ing.itemName}: ${totalAvailable}${recipeUnit} available, ${ing.quantity}${recipeUnit} needed`
            );
          }
          pending--;
          if (pending === 0) {
            if (errors.length > 0) {
              console.log('POST /api/batches: Validation errors', errors);
              return res.status(400).json({ error: errors.join('; ') });
            }
            insertBatch();
          }
        }
      );
    }
    function insertBatch() {
      db.run(
        'INSERT INTO batches (batchId, productId, recipeId, siteId, fermenterId, status, date) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [batchId, productId, parseInt(recipeId), siteId, fermenterId, status, date],
        (err) => {
          if (err) {
            console.error('POST /api/batches: Insert error:', err);
            return res.status(500).json({ error: err.message });
          }
          console.log('POST /api/batches: Success', { batchId });
          res.json({ batchId });
        }
      );
    }
  });
});

app.post('/api/batches/:batchId/equipment', (req, res) => {
  const { batchId } = req.params;
  const { equipmentId, stage } = req.body;
  console.log('POST /api/batches/:batchId/equipment: Received request', { batchId, equipmentId, stage });
  if (!stage) {
    console.error('POST /api/batches/:batchId/equipment: Missing stage', { batchId, equipmentId, stage });
    return res.status(400).json({ error: 'stage is required' });
  }
  if (stage !== 'Completed' && stage !== 'Packaging' && !equipmentId) {
    console.error('POST /api/batches/:batchId/equipment: Missing equipmentId for non-Completed/Packaging stage', { batchId, equipmentId, stage });
    return res.status(400).json({ error: 'equipmentId is required for Brewing, Fermentation, and Filtering/Carbonating stages' });
  }
  const validStages = ['Brewing', 'Fermentation', 'Filtering/Carbonating', 'Packaging', 'Completed'];
  if (!validStages.includes(stage)) {
    console.error('POST /api/batches/:batchId/equipment: Invalid stage', { batchId, stage });
    return res.status(400).json({ error: `Invalid stage. Must be one of: ${validStages.join(', ')}` });
  }
  db.get('SELECT siteId, stage, equipmentId, status FROM batches WHERE batchId = ?', [batchId], (err, batch) => {
    if (err) {
      console.error('POST /api/batches/:batchId/equipment: Fetch batch error:', err);
      return res.status(500).json({ error: err.message });
    }
    if (!batch) {
      console.error('POST /api/batches/:batchId/equipment: Batch not found', { batchId });
      return res.status(404).json({ error: 'Batch not found' });
    }
    if (batch.status === 'Completed') {
      console.error('POST /api/batches/:batchId/equipment: Cannot modify completed batch', { batchId });
      return res.status(400).json({ error: 'Cannot modify a completed batch' });
    }
    const currentStage = batch.stage || null;
    const currentStageIndex = currentStage ? validStages.indexOf(currentStage) : -1;
    const newStageIndex = validStages.indexOf(stage);
    if (currentStage && newStageIndex <= currentStageIndex) {
      console.error('POST /api/batches/:batchId/equipment: Cannot regress stage', { batchId, currentStage, newStage: stage });
      return res.status(400).json({ error: `Cannot regress from ${currentStage} to ${stage}` });
    }
    const validateEquipment = (callback) => {
      if (!equipmentId || stage === 'Completed' || stage === 'Packaging') return callback();
      db.get('SELECT equipmentId, type FROM equipment WHERE equipmentId = ? AND siteId = ?', [equipmentId, batch.siteId], (err, equipment) => {
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
          console.log(`POST /api/batches/:batchId/equipment: Updated batch ${batchId} to equipmentId=${equipmentId || null}, stage=${stage}`);
          res.json({ message: 'Batch equipment and stage updated successfully', equipmentId: equipmentId || null, stage });
        }
      );
    });
  });
});

app.post('/api/batches/:batchId/package', (req, res) => {
  const { batchId } = req.params;
  const { packageType, quantity, locationId, kegCodes } = req.body;
  console.log('POST /api/batches/:batchId/package: Received request', { batchId, packageType, quantity, locationId, kegCodes });

  if (!packageType || !quantity || quantity <= 0 || !locationId) {
    console.error('POST /api/batches/:batchId/package: Missing required fields', { batchId, packageType, quantity, locationId });
    return res.status(400).json({ error: 'packageType, quantity (> 0), and locationId are required' });
  }
  if (!packageVolumes[packageType]) {
    console.error('POST /api/batches/:batchId/package: Invalid packageType', { packageType });
    return res.status(400).json({ error: `Invalid packageType. Must be one of: ${Object.keys(packageVolumes).join(', ')}` });
  }
  if (packageType.includes('Keg') && kegCodes && (!Array.isArray(kegCodes) || kegCodes.some(code => !/^[A-Z0-9-]+$/.test(code)))) {
    console.error('POST /api/batches/:batchId/package: Invalid kegCodes', { kegCodes });
    return res.status(400).json({ error: 'kegCodes must be an array of valid codes (e.g., KEG-001)' });
  }

  db.get(
    `SELECT b.volume, b.siteId, p.name AS productName, p.id AS productId, b.status
     FROM batches b
     JOIN products p ON b.productId = p.id
     WHERE b.batchId = ?`,
    [batchId],
    (err, batch) => {
      if (err) {
        console.error('POST /api/batches/:batchId/package: Fetch batch error:', err);
        return res.status(500).json({ error: `Failed to fetch batch: ${err.message}` });
      }
      if (!batch) {
        console.error('POST /api/batches/:batchId/package: Batch not found', { batchId });
        return res.status(404).json({ error: 'Batch not found' });
      }
      if (batch.status === 'Completed') {
        console.error('POST /api/batches/:batchId/package: Cannot modify completed batch', { batchId });
        return res.status(400).json({ error: 'Cannot modify a completed batch' });
      }
      if (batch.volume === null || batch.volume === undefined) {
        console.error('POST /api/batches/:batchId/package: Batch volume not set', { batchId });
        return res.status(400).json({ error: 'Batch volume not set' });
      }

      const volumeUsed = packageVolumes[packageType] * quantity;
      const availableVolume = parseFloat(batch.volume);
      const tolerance = 0.01;
      if (volumeUsed > availableVolume + tolerance) {
        const shortfall = volumeUsed - availableVolume;
        console.log('POST /api/batches/:batchId/package: Volume adjustment needed', { batchId, volumeUsed, availableVolume, shortfall });
        return res.status(200).json({
          prompt: 'volumeAdjustment',
          message: `${volumeUsed.toFixed(3)} barrels needed, ${availableVolume.toFixed(3)} barrels available. Increase batch volume by ${shortfall.toFixed(3)} barrels?`,
          shortfall,
        });
      }

      db.get(
        `SELECT locationId FROM locations WHERE locationId = ? AND siteId = ?`,
        [locationId, batch.siteId],
        (err, location) => {
          if (err) {
            console.error('POST /api/batches/:batchId/package: Fetch location error:', err);
            return res.status(500).json({ error: `Failed to fetch location: ${err.message}` });
          }
          if (!location) {
            console.error('POST /api/batches/:batchId/package: Invalid locationId', { locationId, siteId: batch.siteId });
            return res.status(400).json({ error: `Invalid locationId: ${locationId} for site ${batch.siteId}` });
          }

          const newIdentifier = `${batch.productName} ${packageType}`;
          db.get(
            `SELECT name FROM items WHERE name = ? AND type = ? AND enabled = 1`,
            [newIdentifier, 'Finished Goods'],
            (err, item) => {
              if (err) {
                console.error('POST /api/batches/:batchId/package: Fetch item error:', err);
                return res.status(500).json({ error: `Failed to check items: ${err.message}` });
              }
              if (!item) {
                console.error('POST /api/batches/:batchId/package: Item not found', { newIdentifier });
                return res.status(400).json({ error: `Item ${newIdentifier} not found. Ensure it is defined in product package types.` });
              }

              db.get(
                `SELECT ppt.price, ppt.isKegDepositItem 
                 FROM product_package_types ppt 
                 JOIN products p ON ppt.productId = p.id 
                 WHERE p.name = ? AND ppt.type = ?`,
                [batch.productName, packageType],
                (err, priceRow) => {
                  if (err) {
                    console.error('POST /api/batches/:batchId/package: Fetch price error:', err);
                    return res.status(500).json({ error: `Failed to fetch price for ${newIdentifier}: ${err.message}` });
                  }
                  if (!priceRow) {
                    console.error('POST /api/batches/:batchId/package: Price not found', { productName: batch.productName, packageType });
                    return res.status(400).json({ error: `Price not found for ${newIdentifier}. Ensure it is defined in product package types.` });
                  }

                  db.serialize(() => {
                    db.run('BEGIN TRANSACTION', (err) => {
                      if (err) {
                        console.error('POST /api/batches/:batchId/package: Begin transaction error:', err);
                        return res.status(500).json({ error: `Failed to start transaction: ${err.message}` });
                      }

                      // Validate and update kegs if provided
                      const validateAndUpdateKegs = (callback) => {
  if (!kegCodes || kegCodes.length === 0 || !packageType.includes('Keg')) {
    return callback();
  }
  if (kegCodes.length !== quantity) {
    db.run('ROLLBACK');
    console.error('POST /api/batches/:batchId/package: Keg codes mismatch', { kegCodesLength: kegCodes.length, quantity });
    return res.status(400).json({ error: `Number of keg codes (${kegCodes.length}) must match quantity (${quantity})` });
  }
  let remainingKegs = kegCodes.length;
  kegCodes.forEach((code, index) => {
    db.get('SELECT id, status, productId FROM kegs WHERE code = ?', [code], (err, keg) => {
      if (err) {
        db.run('ROLLBACK');
        console.error('POST /api/batches/:batchId/package: Fetch keg error:', err);
        return res.status(500).json({ error: `Failed to fetch keg ${code}: ${err.message}` });
      }
      if (!keg) {
        db.run('ROLLBACK');
        console.error('POST /api/batches/:batchId/package: Keg not found', { code });
        return res.status(400).json({ error: `Keg not found: ${code}` });
      }
      if (keg.status !== 'Empty') {
        db.run('ROLLBACK');
        console.error('POST /api/batches/:batchId/package: Keg not empty', { code, status: keg.status });
        return res.status(400).json({ error: `Keg ${code} is not empty (status: ${keg.status})` });
      }
      db.run(
        `UPDATE kegs SET status = ?, productId = ?, lastScanned = ?, location = ?, customerId = NULL 
         WHERE code = ?`,
        ['Filled', batch.productId, new Date().toISOString().split('T')[0], locationId, code], // Changed to locationId (numeric)
        (err) => {
          if (err) {
            db.run('ROLLBACK');
            console.error('POST /api/batches/:batchId/package: Update keg error:', err);
            return res.status(500).json({ error: `Failed to update keg ${code}: ${err.message}` });
          }
          db.run(
            `INSERT INTO keg_transactions (kegId, action, productId, batchId, date, location)
             VALUES ((SELECT id FROM kegs WHERE code = ?), ?, ?, ?, ?, ?)`,
            [code, 'Filled', batch.productId, batchId, new Date().toISOString().split('T')[0], `Location: ${locationId}`],
            (err) => {
              if (err) {
                db.run('ROLLBACK');
                console.error('POST /api/batches/:batchId/package: Insert keg transaction error:', err);
                return res.status(500).json({ error: `Failed to record keg transaction for ${code}: ${err.message}` });
              }
              if (--remainingKegs === 0) callback();
            }
          );
        }
      );
    });
  });
};

                      validateAndUpdateKegs(() => {
  db.run(
    `INSERT INTO batch_packaging (batchId, packageType, quantity, volume, locationId, date, siteId, keg_codes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      batchId,
      packageType,
      quantity,
      volumeUsed,
      locationId,
      new Date().toISOString().split('T')[0],
      batch.siteId,
      kegCodes ? JSON.stringify(kegCodes) : null,
    ],
    (err) => {
      if (err) {
        db.run('ROLLBACK');
        console.error('POST /api/batches/:batchId/package: Insert packaging error:', err);
        return res.status(500).json({ error: `Failed to record packaging: ${err.message}` });
      }

      const newVolume = availableVolume - volumeUsed;
      db.run(
        `UPDATE batches SET volume = ?, stage = ? WHERE batchId = ?`,
        [newVolume, 'Packaging', batchId],
        (err) => {
          if (err) {
            db.run('ROLLBACK');
            console.error('POST /api/batches/:batchId/package: Update batch volume error:', err);
            return res.status(500).json({ error: `Failed to update batch volume: ${err.message}` });
          }

          db.get(
            `SELECT quantity FROM inventory WHERE identifier = ? AND type = ? AND account = ? AND siteId = ? AND locationId = ?`,
            [newIdentifier, 'Finished Goods', 'Storage', batch.siteId, locationId],
            (err, row) => {
              if (err) {
                db.run('ROLLBACK');
                console.error('POST /api/batches/:batchId/package: Fetch inventory error:', err);
                return res.status(500).json({ error: `Failed to check inventory: ${err.message}` });
              }

              if (row) {
                const newQuantity = parseFloat(row.quantity) + quantity;
                db.run(
                  `UPDATE inventory SET quantity = ?, price = ?, isKegDepositItem = ? 
                   WHERE identifier = ? AND type = ? AND account = ? AND siteId = ? AND locationId = ?`,
                  [newQuantity, priceRow.price, priceRow.isKegDepositItem, newIdentifier, 'Finished Goods', 'Storage', batch.siteId, locationId],
                  (err) => {
                    if (err) {
                      db.run('ROLLBACK');
                      console.error('POST /api/batches/:batchId/package: Update inventory error:', err);
                      return res.status(500).json({ error: `Failed to update inventory: ${err.message}` });
                    }
                    commitTransaction();
                  }
                );
              } else {
                db.run(
                  `INSERT INTO inventory (
                    identifier, account, type, quantity, unit, price, isKegDepositItem, 
                    receivedDate, source, siteId, locationId, status
                  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                  [
                    newIdentifier,
                    'Storage',
                    'Finished Goods',
                    quantity,
                    'Units',
                    priceRow.price,
                    priceRow.isKegDepositItem,
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
                    commitTransaction();
                  }
                );
              }

              function commitTransaction() {
                db.run('COMMIT', (err) => {
                  if (err) {
                    db.run('ROLLBACK');
                    console.error('POST /api/batches/:batchId/package: Commit transaction error:', err);
                    return res.status(500).json({ error: `Failed to commit transaction: ${err.message}` });
                  }
                  console.log('POST /api/batches/:batchId/package: Success', {
                    batchId,
                    newIdentifier,
                    quantity,
                    newVolume,
                    kegCodes,
                  });
                  res.json({ message: 'Packaging successful', newIdentifier, quantity, newVolume });
                });
              }
            }
          );
        }
      );
    }
  );
});
                    });
                  });
                }
              );
            }
          );
        }
      );
    }
  );
});

app.patch('/api/batches/:batchId/package/:packageId', (req, res) => {
  const { batchId, packageId } = req.params;
  const { quantity } = req.body;
  console.log('PATCH /api/batches/:batchId/package/:packageId: Received request', { batchId, packageId, quantity });
  if (quantity === undefined || quantity < 0) {
    console.error('PATCH /api/batches/:batchId/package/:packageId: Invalid quantity', { quantity });
    return res.status(400).json({ error: 'Quantity must be a non-negative number' });
  }
  db.get(
    `SELECT bp.packageType, bp.quantity AS currentQuantity, bp.volume AS currentVolume, bp.locationId, bp.siteId,
            b.volume AS batchVolume, p.name AS productName, b.status
     FROM batch_packaging bp
     JOIN batches b ON bp.batchId = b.batchId
     JOIN products p ON b.productId = p.id
     WHERE bp.id = ? AND bp.batchId = ?`,
    [packageId, batchId],
    (err, row) => {
      if (err) {
        console.error('PATCH /api/batches/:batchId/package/:packageId: Fetch packaging error:', err);
        return res.status(500).json({ error: `Failed to fetch packaging: ${err.message}` });
      }
      if (!row) {
        console.error('PATCH /api/batches/:batchId/package/:packageId: Packaging record not found', { packageId, batchId });
        return res.status(404).json({ error: 'Packaging record not found' });
      }
      if (row.status === 'Completed') {
        console.error('PATCH /api/batches/:batchId/package/:packageId: Cannot modify completed batch', { batchId });
        return res.status(400).json({ error: 'Cannot modify a completed batch' });
      }
      const { packageType, currentQuantity, currentVolume, locationId, siteId, batchVolume, productName } = row;
      console.log('PATCH /api/batches/:batchId/package/:packageId: Current record', {
        packageType,
        currentQuantity,
        currentVolume,
        batchVolume,
        locationId,
        siteId,
        productName,
      });

      if (!packageVolumes[packageType]) {
        console.error('PATCH /api/batches/:batchId/package/:packageId: Invalid packageType', { packageType });
        return res.status(400).json({ error: `Invalid packageType: ${packageType}` });
      }

      // Calculate volume change
      const volumePerUnit = packageVolumes[packageType];
      const newVolume = quantity * volumePerUnit;
      const volumeDifference = currentVolume - newVolume; // Positive if reducing quantity, negative if increasing
      const newBatchVolume = parseFloat(batchVolume) + volumeDifference;

      console.log('PATCH /api/batches/:batchId/package/:packageId: Volume calculation', {
        currentQuantity,
        newQuantity: quantity,
        currentVolume,
        newVolume,
        volumeDifference,
        currentBatchVolume: batchVolume,
        newBatchVolume,
      });

      if (newBatchVolume < 0) {
        console.error('PATCH /api/batches/:batchId/package/:packageId: Insufficient batch volume', {
          requiredVolume: newVolume,
          availableVolume: batchVolume,
          shortfall: -newBatchVolume,
        });
        return res.status(400).json({
          error: `Insufficient batch volume: ${newVolume.toFixed(3)} barrels required, ${batchVolume.toFixed(3)} available`,
        });
      }

      db.serialize(() => {
        db.run('BEGIN TRANSACTION', (err) => {
          if (err) {
            console.error('PATCH /api/batches/:batchId/package/:packageId: Begin transaction error:', err);
            return res.status(500).json({ error: `Failed to start transaction: ${err.message}` });
          }

          // Update batch_packaging
          db.run(
            `UPDATE batch_packaging SET quantity = ?, volume = ? WHERE id = ? AND batchId = ?`,
            [quantity, newVolume, packageId, batchId],
            (err) => {
              if (err) {
                db.run('ROLLBACK');
                console.error('PATCH /api/batches/:batchId/package/:packageId: Update packaging error:', err);
                return res.status(500).json({ error: `Failed to update packaging: ${err.message}` });
              }
              console.log('PATCH /api/batches/:batchId/package/:packageId: Updated batch_packaging', {
                packageId,
                quantity,
                newVolume,
              });

              // Update batch volume
              db.run(
                `UPDATE batches SET volume = ? WHERE batchId = ?`,
                [newBatchVolume, batchId],
                (err) => {
                  if (err) {
                    db.run('ROLLBACK');
                    console.error('PATCH /api/batches/:batchId/package/:packageId: Update batch volume error:', err);
                    return res.status(500).json({ error: `Failed to update batch volume: ${err.message}` });
                  }
                  console.log('PATCH /api/batches/:batchId/package/:packageId: Updated batch volume', {
                    batchId,
                    newBatchVolume,
                  });

                  // Update inventory
                  const identifier = `${productName} ${packageType}`;
                  db.get(
                    `SELECT quantity FROM inventory WHERE identifier = ? AND type = ? AND account = ? AND siteId = ? AND locationId = ?`,
                    [identifier, 'Finished Goods', 'Storage', siteId, locationId],
                    (err, row) => {
                      if (err) {
                        db.run('ROLLBACK');
                        console.error('PATCH /api/batches/:batchId/package/:packageId: Fetch inventory error:', err);
                        return res.status(500).json({ error: `Failed to check inventory: ${err.message}` });
                      }
                      if (!row) {
                        db.run('ROLLBACK');
                        console.error('PATCH /api/batches/:batchId/package/:packageId: Inventory not found', {
                          identifier,
                          siteId,
                          locationId,
                        });
                        return res.status(404).json({ error: `Inventory item not found: ${identifier}` });
                      }

                      const newInventoryQuantity = parseFloat(row.quantity) + (quantity - currentQuantity);
                      console.log('PATCH /api/batches/:batchId/package/:packageId: Updating inventory', {
                        identifier,
                        currentInventoryQuantity: row.quantity,
                        quantityChange: quantity - currentQuantity,
                        newInventoryQuantity,
                      });

                      if (newInventoryQuantity < 0) {
                        db.run('ROLLBACK');
                        console.error('PATCH /api/batches/:batchId/package/:packageId: Negative inventory quantity', {
                          identifier,
                          newInventoryQuantity,
                        });
                        return res.status(400).json({ error: `Cannot reduce inventory below zero: ${identifier}` });
                      }

                      db.run(
                        `UPDATE inventory SET quantity = ? WHERE identifier = ? AND type = ? AND account = ? AND siteId = ? AND locationId = ?`,
                        [newInventoryQuantity, identifier, 'Finished Goods', 'Storage', siteId, locationId],
                        (err) => {
                          if (err) {
                            db.run('ROLLBACK');
                            console.error('PATCH /api/batches/:batchId/package/:packageId: Update inventory error:', err);
                            return res.status(500).json({ error: `Failed to update inventory: ${err.message}` });
                          }
                          console.log('PATCH /api/batches/:batchId/package/:packageId: Updated inventory', {
                            identifier,
                            newInventoryQuantity,
                          });

                          db.run('COMMIT', (err) => {
                            if (err) {
                              db.run('ROLLBACK');
                              console.error('PATCH /api/batches/:batchId/package/:packageId: Commit transaction error:', err);
                              return res.status(500).json({ error: `Failed to commit transaction: ${err.message}` });
                            }
                            console.log('PATCH /api/batches/:batchId/package/:packageId: Success', {
                              batchId,
                              packageId,
                              newQuantity: quantity,
                              newVolume,
                              newBatchVolume,
                              newInventoryQuantity,
                            });
                            res.json({ message: 'Packaging updated successfully', newBatchVolume });
                          });
                        }
                      );
                    }
                  );
                }
              );
            }
          );
        });
      });
    }
  );
});

app.delete('/api/batches/:batchId/package/:packageId', (req, res) => {
  const { batchId, packageId } = req.params;
  console.log('DELETE /api/batches/:batchId/package/:packageId: Received request', { batchId, packageId });
  db.get(
    `SELECT bp.packageType, bp.quantity AS currentQuantity, bp.volume AS currentVolume, bp.locationId, bp.siteId,
            b.volume AS batchVolume, p.name AS productName, b.status
     FROM batch_packaging bp
     JOIN batches b ON bp.batchId = b.batchId
     JOIN products p ON b.productId = p.id
     WHERE bp.id = ? AND bp.batchId = ?`,
    [packageId, batchId],
    (err, row) => {
      if (err) {
        console.error('DELETE /api/batches/:batchId/package/:packageId: Fetch packaging error:', err);
        return res.status(500).json({ error: `Failed to fetch packaging: ${err.message}` });
      }
      if (!row) {
        console.error('DELETE /api/batches/:batchId/package/:packageId: Packaging record not found', { packageId, batchId });
        return res.status(404).json({ error: 'Packaging record not found' });
      }
      if (row.status === 'Completed') {
        console.error('DELETE /api/batches/:batchId/package/:packageId: Cannot modify completed batch', { batchId });
        return res.status(400).json({ error: 'Cannot modify a completed batch' });
      }
      const { packageType, currentQuantity, currentVolume, locationId, siteId, batchVolume, productName } = row;
      console.log('DELETE /api/batches/:batchId/package/:packageId: Current record', {
        packageType,
        currentQuantity,
        currentVolume,
        batchVolume,
        locationId,
        siteId,
        productName,
      });

      const newBatchVolume = parseFloat(batchVolume) + currentVolume;
      console.log('DELETE /api/batches/:batchId/package/:packageId: Volume calculation', {
        currentVolume,
        currentBatchVolume: batchVolume,
        newBatchVolume,
      });

      db.serialize(() => {
        db.run('BEGIN TRANSACTION', (err) => {
          if (err) {
            console.error('DELETE /api/batches/:batchId/package/:packageId: Begin transaction error:', err);
            return res.status(500).json({ error: `Failed to start transaction: ${err.message}` });
          }

          // Delete from batch_packaging
          db.run(
            `DELETE FROM batch_packaging WHERE id = ? AND batchId = ?`,
            [packageId, batchId],
            (err) => {
              if (err) {
                db.run('ROLLBACK');
                console.error('DELETE /api/batches/:batchId/package/:packageId: Delete packaging error:', err);
                return res.status(500).json({ error: `Failed to delete packaging: ${err.message}` });
              }
              console.log('DELETE /api/batches/:batchId/package/:packageId: Deleted batch_packaging', { packageId });

              // Update batch volume
              db.run(
                `UPDATE batches SET volume = ? WHERE batchId = ?`,
                [newBatchVolume, batchId],
                (err) => {
                  if (err) {
                    db.run('ROLLBACK');
                    console.error('DELETE /api/batches/:batchId/package/:packageId: Update batch volume error:', err);
                    return res.status(500).json({ error: `Failed to update batch volume: ${err.message}` });
                  }
                  console.log('DELETE /api/batches/:batchId/package/:packageId: Updated batch volume', {
                    batchId,
                    newBatchVolume,
                  });

                  // Update inventory
                  const identifier = `${productName} ${packageType}`;
                  db.get(
                    `SELECT quantity FROM inventory WHERE identifier = ? AND type = ? AND account = ? AND siteId = ? AND locationId = ?`,
                    [identifier, 'Finished Goods', 'Storage', siteId, locationId],
                    (err, row) => {
                      if (err) {
                        db.run('ROLLBACK');
                        console.error('DELETE /api/batches/:batchId/package/:packageId: Fetch inventory error:', err);
                        return res.status(500).json({ error: `Failed to check inventory: ${err.message}` });
                      }
                      if (!row) {
                        db.run('ROLLBACK');
                        console.error('DELETE /api/batches/:batchId/package/:packageId: Inventory not found', {
                          identifier,
                          siteId,
                          locationId,
                        });
                        return res.status(404).json({ error: `Inventory item not found: ${identifier}` });
                      }

                      const newInventoryQuantity = parseFloat(row.quantity) - currentQuantity;
                      console.log('DELETE /api/batches/:batchId/package/:packageId: Updating inventory', {
                        identifier,
                        currentInventoryQuantity: row.quantity,
                        quantityChange: -currentQuantity,
                        newInventoryQuantity,
                      });

                      if (newInventoryQuantity < 0) {
                        db.run('ROLLBACK');
                        console.error('DELETE /api/batches/:batchId/package/:packageId: Negative inventory quantity', {
                          identifier,
                          newInventoryQuantity,
                        });
                        return res.status(400).json({ error: `Cannot reduce inventory below zero: ${identifier}` });
                      }

                      if (newInventoryQuantity === 0) {
                        // Delete inventory record if quantity becomes 0
                        db.run(
                          `DELETE FROM inventory WHERE identifier = ? AND type = ? AND account = ? AND siteId = ? AND locationId = ?`,
                          [identifier, 'Finished Goods', 'Storage', siteId, locationId],
                          (err) => {
                            if (err) {
                              db.run('ROLLBACK');
                              console.error('DELETE /api/batches/:batchId/package/:packageId: Delete inventory error:', err);
                              return res.status(500).json({ error: `Failed to delete inventory: ${err.message}` });
                            }
                            console.log('DELETE /api/batches/:batchId/package/:packageId: Deleted inventory', { identifier });

                            db.run('COMMIT', (err) => {
                              if (err) {
                                db.run('ROLLBACK');
                                console.error('DELETE /api/batches/:batchId/package/:packageId: Commit transaction error:', err);
                                return res.status(500).json({ error: `Failed to commit transaction: ${err.message}` });
                              }
                              console.log('DELETE /api/batches/:batchId/package/:packageId: Success', {
                                batchId,
                                packageId,
                                newBatchVolume,
                              });
                              res.json({ message: 'Packaging action deleted successfully', newBatchVolume });
                            });
                          }
                        );
                      } else {
                        // Update inventory quantity
                        db.run(
                          `UPDATE inventory SET quantity = ? WHERE identifier = ? AND type = ? AND account = ? AND siteId = ? AND locationId = ?`,
                          [newInventoryQuantity, identifier, 'Finished Goods', 'Storage', siteId, locationId],
                          (err) => {
                            if (err) {
                              db.run('ROLLBACK');
                              console.error('DELETE /api/batches/:batchId/package/:packageId: Update inventory error:', err);
                              return res.status(500).json({ error: `Failed to update inventory: ${err.message}` });
                            }
                            console.log('DELETE /api/batches/:batchId/package/:packageId: Updated inventory', {
                              identifier,
                              newInventoryQuantity,
                            });

                            db.run('COMMIT', (err) => {
                              if (err) {
                                db.run('ROLLBACK');
                                console.error('DELETE /api/batches/:batchId/package/:packageId: Commit transaction error:', err);
                                return res.status(500).json({ error: `Failed to commit transaction: ${err.message}` });
                              }
                              console.log('DELETE /api/batches/:batchId/package/:packageId: Success', {
                                batchId,
                                packageId,
                                newBatchVolume,
                              });
                              res.json({ message: 'Packaging action deleted successfully', newBatchVolume });
                            });
                          }
                        );
                      }
                    }
                  );
                }
              );
            }
          );
        });
      });
    }
  );
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
           b.siteId, s.name AS siteName, b.status, b.date, r.ingredients, b.additionalIngredients, b.equipmentId, b.volume, b.stage
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
    const activeRecipeIngredients = recipeIngredients.filter(
      (ing) => !additionalIngredients.some(
        (override) => override.itemName === ing.itemName && 
                      (override.unit || 'lbs').toLowerCase() === (ing.unit || 'lbs').toLowerCase() && 
                      override.excluded === true &&
                      (override.quantity === ing.quantity || override.quantity === undefined)
      )
    );
    const filteredAdditionalIngredients = additionalIngredients.filter(
      ing => !ing.excluded && (!ing.quantity || ing.quantity > 0)
    );
    const combinedIngredients = [
      ...activeRecipeIngredients.map(ing => ({ ...ing, isRecipe: true })),
      ...filteredAdditionalIngredients.map(ing => ({ ...ing, isRecipe: false }))
    ];
    const batch = {
      ...row,
      ingredients: combinedIngredients,
      additionalIngredients,
      stage: row.stage || null
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

app.get('/api/batches/:batchId/package', (req, res) => {
  const { batchId } = req.params;
  console.log('GET /api/batches/:batchId/package: Fetching packaging actions', { batchId });
  db.all(
    `SELECT id, batchId, packageType, quantity, volume, locationId, date, siteId
     FROM batch_packaging
     WHERE batchId = ?`,
    [batchId],
    (err, rows) => {
      if (err) {
        console.error('GET /api/batches/:batchId/package: Fetch packaging error:', err);
        return res.status(500).json({ error: `Failed to fetch packaging: ${err.message}` });
      }
      console.log('GET /api/batches/:batchId/package: Success', { batchId, count: rows.length });
      res.json(rows);
    }
  );
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

app.patch('/api/batches/:batchId/ingredients', (req, res) => {
  const { batchId } = req.params;
  const { original, updated } = req.body;
  console.log(`PATCH /api/batches/${batchId}/ingredients: Received`, { original, updated });
  if (!original || !updated || !original.itemName || !original.quantity || !original.unit || 
      !updated.itemName || !updated.quantity || updated.quantity <= 0 || !updated.unit) {
    console.error(`PATCH /api/batches/${batchId}/ingredients: Invalid input`, { original, updated });
    return res.status(400).json({ error: 'Valid original and updated itemName, quantity, and unit required' });
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
      console.error(`PATCH /api/batches/${batchId}/ingredients: Batch not found`, { batchId });
      return res.status(404).json({ error: 'Batch not found' });
    }
    const siteId = batch.siteId;
    let additionalIngredients = batch.additionalIngredients ? JSON.parse(batch.additionalIngredients) : [];
    let recipeIngredients = batch.recipeIngredients ? JSON.parse(batch.recipeIngredients) : [];
    const originalUnit = (original.unit || 'lbs').toLowerCase() === 'pounds' ? 'lbs' : (original.unit || 'lbs').toLowerCase();
    const updatedUnit = (updated.unit || 'lbs').toLowerCase() === 'pounds' ? 'lbs' : (updated.unit || 'lbs').toLowerCase();
    const allIngredients = [
      ...recipeIngredients.map(ing => ({ ...ing, isRecipe: true })),
      ...additionalIngredients.filter(ing => !ing.excluded).map(ing => ({ ...ing, isRecipe: false }))
    ];
    console.log(`All ingredients in batch ${batchId}:`, allIngredients);
    const ingredientIndex = allIngredients.findIndex(
      ing => ing.itemName === original.itemName && ing.quantity === original.quantity && 
             (ing.unit || 'lbs').toLowerCase() === originalUnit
    );
    if (ingredientIndex === -1) {
      console.error(`PATCH /api/batches/${batchId}/ingredients: Original ingredient not found`, { original });
      return res.status(400).json({ error: 'Original ingredient not found in batch' });
    }
    db.get('SELECT name FROM items WHERE name = ?', [updated.itemName], (err, item) => {
      if (err) {
        console.error('Fetch item error:', err);
        return res.status(500).json({ error: err.message });
      }
      if (!item) {
        console.error(`PATCH /api/batches/${batchId}/ingredients: Updated item not found`, { itemName: updated.itemName });
        return res.status(400).json({ error: `Updated item not found: ${updated.itemName}` });
      }
      db.get(
        'SELECT SUM(CAST(quantity AS REAL)) as total FROM inventory WHERE identifier = ? AND LOWER(unit) IN (?, ?) AND siteId = ? AND account = ? AND type = ?',
        [updated.itemName, updatedUnit, 'pounds', siteId, 'Storage', 'Raw Material'],
        (err, row) => {
          if (err) {
            console.error('Inventory check error:', err);
            return res.status(500).json({ error: err.message });
          }
          const available = row && row.total ? parseFloat(row.total) : 0;
          const quantityDifference = updated.quantity - (original.itemName === updated.itemName && originalUnit === updatedUnit ? original.quantity : 0);
          console.log(`Inventory check for ${updated.itemName} (${updatedUnit}) at site ${siteId}: Available ${available}, Needed ${quantityDifference}`);
          if (available < quantityDifference) {
            console.error(`PATCH /api/batches/${batchId}/ingredients: Insufficient inventory`, { available, needed: quantityDifference, unit: updatedUnit });
            return res.status(400).json({ 
              error: `Insufficient inventory for ${updated.itemName}: ${available}${updatedUnit} available, ${quantityDifference}${updatedUnit} needed` 
            });
          }
          db.serialize(() => {
            db.run('BEGIN TRANSACTION', (err) => {
              if (err) {
                console.error('Begin transaction error:', err);
                return res.status(500).json({ error: 'Failed to start transaction' });
              }
              if (original.itemName !== updated.itemName || originalUnit !== updatedUnit) {
                let newAdditionalIngredients = additionalIngredients;
                if (allIngredients[ingredientIndex].isRecipe) {
                  newAdditionalIngredients = [
                    ...additionalIngredients,
                    { itemName: original.itemName, quantity: original.quantity, unit: originalUnit, excluded: true }
                  ];
                } else {
                  newAdditionalIngredients = additionalIngredients.filter(
                    ing => !(ing.itemName === original.itemName && ing.quantity === original.quantity && 
                             (ing.unit || 'lbs').toLowerCase() === originalUnit)
                  );
                }
                newAdditionalIngredients.push({ itemName: updated.itemName, quantity: updated.quantity, unit: updatedUnit });
                console.log(`Updating batch ${batchId} with new additionalIngredients:`, newAdditionalIngredients);
                db.run(
                  'UPDATE batches SET additionalIngredients = ? WHERE batchId = ?',
                  [JSON.stringify(newAdditionalIngredients), batchId],
                  (err) => {
                    if (err) {
                      db.run('ROLLBACK');
                      console.error('Update batch ingredients error:', err);
                      return res.status(500).json({ error: err.message });
                    }
                    db.run(
                      'UPDATE inventory SET quantity = quantity + ? WHERE identifier = ? AND LOWER(unit) IN (?, ?) AND siteId = ? AND account = ? AND type = ?',
                      [original.quantity, original.itemName, originalUnit, 'pounds', siteId, 'Storage', 'Raw Material'],
                      (err) => {
                        if (err) {
                          db.run('ROLLBACK');
                          console.error('Update inventory (restore) error:', err);
                          return res.status(500).json({ error: err.message });
                        }
                        db.run(
                          'UPDATE inventory SET quantity = quantity - ? WHERE identifier = ? AND LOWER(unit) IN (?, ?) AND siteId = ? AND account = ? AND type = ?',
                          [updated.quantity, updated.itemName, updatedUnit, 'pounds', siteId, 'Storage', 'Raw Material'],
                          (err) => {
                            if (err) {
                              db.run('ROLLBACK');
                              console.error('Update inventory (deduct) error:', err);
                              return res.status(500).json({ error: err.message });
                            }
                            completeUpdate(newAdditionalIngredients);
                          }
                        );
                      }
                    );
                  }
                );
              } else {
                const newAdditionalIngredients = additionalIngredients.map(ing => {
                  if (ing.itemName === original.itemName && ing.quantity === original.quantity && 
                      (ing.unit || 'lbs').toLowerCase() === originalUnit && !ing.excluded) {
                    return { ...ing, quantity: updated.quantity };
                  }
                  return ing;
                });
                console.log(`Updating batch ${batchId} with new additionalIngredients:`, newAdditionalIngredients);
                db.run(
                  'UPDATE batches SET additionalIngredients = ? WHERE batchId = ?',
                  [JSON.stringify(newAdditionalIngredients), batchId],
                  (err) => {
                    if (err) {
                      db.run('ROLLBACK');
                      console.error('Update batch ingredients error:', err);
                      return res.status(500).json({ error: err.message });
                    }
                    db.run(
                      'UPDATE inventory SET quantity = quantity - ? WHERE identifier = ? AND LOWER(unit) IN (?, ?) AND siteId = ? AND account = ? AND type = ?',
                      [quantityDifference, updated.itemName, updatedUnit, 'pounds', siteId, 'Storage', 'Raw Material'],
                      (err) => {
                        if (err) {
                          db.run('ROLLBACK');
                          console.error('Update inventory error:', err);
                          return res.status(500).json({ error: err.message });
                        }
                        completeUpdate(newAdditionalIngredients);
                      }
                    );
                  }
                );
              }

              function completeUpdate(newAdditionalIngredients) {
                console.log(`Inventory updated: restored ${original.quantity}${originalUnit} for ${original.itemName}, deducted ${updated.quantity}${updatedUnit} for ${updated.itemName} at site ${siteId}`);
                db.get(`
                  SELECT b.batchId, b.productId, p.name AS productName, b.recipeId, r.name AS recipeName, 
                         b.siteId, s.name AS siteName, b.status, b.date, r.ingredients, b.additionalIngredients, b.equipmentId, b.fermenterId, b.volume
                  FROM batches b
                  JOIN products p ON b.productId = p.id
                  JOIN recipes r ON b.recipeId = r.id
                  JOIN sites s ON b.siteId = s.siteId
                  WHERE b.batchId = ?
                `, [batchId], (err, updatedBatch) => {
                  if (err) {
                    db.run('ROLLBACK');
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
                  db.run('COMMIT', (err) => {
                    if (err) {
                      db.run('ROLLBACK');
                      console.error('Commit transaction error:', err);
                      return res.status(500).json({ error: `Failed to commit transaction: ${err.message}` });
                    }
                    console.log(`PATCH /api/batches/${batchId}/ingredients: Success`, { original, updated });
                    console.log(`Returning updated batch:`, updatedBatch);
                    res.json(updatedBatch);
                  });
                });
              }
            });
          });
        }
      );
    });
  });
});

app.delete('/api/batches/:batchId/ingredients', (req, res) => {
  const { batchId } = req.params;
  const { itemName, quantity, unit } = req.body;
  if (!itemName || !quantity || quantity <= 0 || !unit) {
    return res.status(400).json({ error: 'Valid itemName, quantity, and unit required' });
  }
  db.get('SELECT siteId, status FROM batches WHERE batchId = ?', [batchId], (err, batch) => {
    if (err) {
      console.error('Fetch batch error:', err);
      return res.status(500).json({ error: err.message });
    }
    if (!batch) {
      return res.status(404).json({ error: 'Batch not found' });
    }
    if (batch.status === 'Completed') {
      console.error('DELETE /api/batches/:batchId/ingredients: Cannot modify completed batch', { batchId });
      return res.status(400).json({ error: 'Cannot modify a completed batch' });
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

app.patch('/api/batches/:batchId', (req, res) => {
  const { batchId } = req.params;
  const updates = req.body;
  const allowedFields = ['batchId', 'status', 'volume', 'stage', 'equipmentId'];
  const fields = Object.keys(updates).filter(field => allowedFields.includes(field));
  if (fields.length === 0) {
    return res.status(400).json({ error: 'No valid fields provided for update' });
  }
  // Automatically set stage and equipmentId when status is Completed
  if (updates.status === 'Completed') {
    if (!updates.stage) {
      updates.stage = 'Completed';
      fields.push('stage');
    }
    if (!updates.equipmentId) {
      updates.equipmentId = null;
      fields.push('equipmentId');
    }
  }
  const setClause = fields.map(field => `${field} = ?`).join(', ');
  const values = fields.map(field => updates[field]);
  values.push(batchId);
  db.run(
    `UPDATE batches SET ${setClause} WHERE batchId = ?`,
    values,
    function(err) {
      if (err) {
        console.error('PATCH /api/batches/:batchId: Update error:', err);
        return res.status(500).json({ error: err.message });
      }
      if (this.changes === 0) {
        return res.status(404).json({ error: 'Batch not found' });
      }
      db.get('SELECT * FROM batches WHERE batchId = ?', [batchId], (err, batch) => {
        if (err) {
          return res.status(500).json({ error: err.message });
        }
        res.json(batch);
      });
    }
  );
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

app.get('/api/recipes', (req, res) => {
  const productId = req.query.productId;
  if (!productId) {
    return res.status(400).json({ error: 'productId query parameter is required' });
  }
  db.all('SELECT id, name, productId, quantity, unit FROM recipes WHERE productId = ?', [productId], (err, rows) => {
    if (err) {
      console.error('Fetch recipes error:', err);
      return res.status(500).json({ error: err.message });
    }
    let remaining = rows.length;
    if (remaining === 0) {
      res.json([]);
      return;
    }
    const recipes = [];
    rows.forEach(row => {
      db.all(
        'SELECT itemName, quantity, unit FROM recipe_ingredients WHERE recipeId = ?',
        [row.id],
        (err, ingredients) => {
          if (err) {
            console.error('Fetch recipe ingredients error:', err);
            return res.status(500).json({ error: err.message });
          }
          recipes.push({ ...row, ingredients });
          if (--remaining === 0) {
            console.log('GET /api/recipes, returning:', recipes);
            res.json(recipes);
          }
        }
      );
    });
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
    const invalidIngredients = ingredients.filter(ing => !ing.itemName || isNaN(ing.quantity) || ing.quantity <= 0 || !ing.unit);
    if (invalidIngredients.length > 0) {
      return res.status(400).json({ error: 'All ingredients must have valid itemName, quantity, and unit' });
    }
    db.serialize(() => {
      db.run('BEGIN TRANSACTION');
      db.run(
        'INSERT INTO recipes (name, productId, quantity, unit) VALUES (?, ?, ?, ?)',
        [name, productId, quantity, unit.toLowerCase()],
        function (err) {
          if (err) {
            db.run('ROLLBACK');
            console.error('Insert recipe error:', err);
            return res.status(500).json({ error: err.message });
          }
          const recipeId = this.lastID;
          let remaining = ingredients.length;
          ingredients.forEach(ing => {
            db.run(
              'INSERT INTO recipe_ingredients (recipeId, itemName, quantity, unit) VALUES (?, ?, ?, ?)',
              [recipeId, ing.itemName, ing.quantity, ing.unit.toLowerCase()],
              (err) => {
                if (err) {
                  db.run('ROLLBACK');
                  console.error('Insert recipe ingredient error:', err);
                  return res.status(500).json({ error: err.message });
                }
                if (--remaining === 0) {
                  db.run('COMMIT');
                  const newRecipe = { id: recipeId, name, productId, ingredients, quantity, unit: unit.toLowerCase() };
                  console.log('POST /api/recipes, added:', newRecipe);
                  res.json(newRecipe);
                }
              }
            );
          });
        }
      );
    });
  });
});

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

app.get('/api/package-types', (req, res) => {
  const packageTypes = Object.entries(packageVolumes)
    .map(([name, volume]) => ({
      name,
      volume,
      enabled: 1
    }))
    .sort((a, b) => a.name.localeCompare(b.name)); // Sort alphabetically
  console.log('GET /api/package-types, returning:', packageTypes);
  res.json(packageTypes);
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
  console.log('GET /api/vendors/:name: Fetching', { name });
  db.get('SELECT * FROM vendors WHERE name = ?', [name], (err, row) => {
    if (err) {
      console.error('GET /api/vendors/:name: Database error:', err);
      return res.status(500).json({ error: err.message });
    }
    if (!row) {
      console.log('GET /api/vendors/:name: Vendor not found', { name });
      return res.status(404).json({ error: 'Vendor not found' });
    }
    console.log('GET /api/vendors/:name: Success', row);
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
  if (!oldName || !newVendor || !newVendor.name) {
    console.error('PUT /api/vendors: Invalid request', { oldName, newVendor });
    return res.status(400).json({ error: 'Old name and new vendor details are required' });
  }
  console.log('PUT /api/vendors: Updating vendor', { oldName, newVendor });
  db.run(
    'UPDATE vendors SET name = ?, type = ?, enabled = ?, address = ?, email = ?, phone = ? WHERE name = ?',
    [
      newVendor.name,
      newVendor.type || 'Supplier',
      newVendor.enabled ?? 1,
      newVendor.address || '',
      newVendor.email || '',
      newVendor.phone || '',
      oldName,
    ],
    function (err) {
      if (err) {
        console.error('PUT /api/vendors: Update error:', err);
        return res.status(500).json({ error: err.message });
      }
      if (this.changes === 0) {
        console.log('PUT /api/vendors: Vendor not found', { oldName });
        return res.status(404).json({ error: 'Vendor not found' });
      }
      db.get('SELECT * FROM vendors WHERE name = ?', [newVendor.name], (err, row) => {
        if (err) {
          console.error('PUT /api/vendors: Fetch updated vendor error:', err);
          return res.status(500).json({ error: err.message });
        }
        console.log('PUT /api/vendors: Success', row);
        res.json(row);
      });
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
  const { source, identifier, locationId, siteId, page = 1, limit = 10 } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);
  let countQuery = 'SELECT COUNT(*) as total FROM inventory';
  let query = 'SELECT identifier, account, type, quantity, unit, price, isKegDepositItem, proof, proofGallons, receivedDate, source, dspNumber, siteId, locationId, status, description, cost, totalCost FROM inventory';
  let params = [];
  let countParams = [];
  let conditions = [];
  if (source) {
    conditions.push('source = ?');
    params.push(source);
    countParams.push(source);
  }
  if (identifier) {
    conditions.push('identifier = ?');
    params.push(identifier);
    countParams.push(identifier);
  }
  if (locationId) {
    conditions.push('locationId = ?');
    params.push(parseInt(locationId));
    countParams.push(parseInt(locationId));
  }
  if (siteId) {
    conditions.push('siteId = ?');
    params.push(siteId);
    countParams.push(siteId);
  }
  if (conditions.length > 0) {
    query += ' WHERE ' + conditions.join(' AND ');
    countQuery += ' WHERE ' + conditions.join(' AND ');
  }
  query += ' LIMIT ? OFFSET ?';
  params.push(parseInt(limit), offset);

  console.log('GET /api/inventory: Executing', { countQuery, query, countParams, params });

  db.get(countQuery, countParams, (err, countResult) => {
    if (err) {
      console.error('GET /api/inventory: Count error:', err);
      return res.status(500).json({ error: err.message });
    }
    const totalItems = countResult.total;
    const totalPages = Math.ceil(totalItems / parseInt(limit));
    db.all(query, params, (err, rows) => {
      if (err) {
        console.error('GET /api/inventory: Fetch error:', err);
        return res.status(500).json({ error: err.message });
      }
      console.log('GET /api/inventory: Success', { count: rows.length, page, limit, totalPages });
      res.json({ items: rows, totalPages });
    });
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
    : [{ id: 2, productId: 2, name: 'Hazy Train 10 BBL', ingredients: 'Hops, Malt, Yeast', instructions: 'Ferment and hop' }];
  res.json(mockRecipes);
});

// Mock product storage
let mockProducts = [
  { id: 1, name: 'Whiskey', abbreviation: 'WH', enabled: true, priority: 1, class: 'Distilled', productColor: 'Amber', type: 'Spirits', style: 'Bourbon', abv: 40, ibu: 0 },
  { id: 2, name: 'Hazy Train IPA', abbreviation: 'IP', enabled: true, priority: 2, class: 'Beer', productColor: 'Golden', type: 'Malt', style: 'American IPA', abv: 6.5, ibu: 60 },
];

app.post('/api/receive', async (req, res) => {
  console.log('POST /api/receive: Received request', req.body);
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
    if (error) console.log('POST /api/receive: Validation error', { item, error });
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
      const { identifier, account, type, quantity, unit, proof, proofGallons, receivedDate, source, siteId, locationId, status, description, cost, totalCost } = item;
      const finalProofGallons = type === 'Spirits' ? (proofGallons || (parseFloat(quantity) * (parseFloat(proof) / 100)).toFixed(2)) : '0.00';
      const finalTotalCost = totalCost || '0.00';
      const finalUnitCost = cost || '0.00';
      const finalAccount = type === 'Spirits' ? account : null;
      const finalStatus = ['Grain', 'Hops'].includes(type) ? 'Stored' : status;
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
      // Ensure item exists in items table
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
      console.log('POST /api/receive: Processing item', { identifier, account: finalAccount, status: finalStatus, siteId, locationId, quantity, unit });
      if (row) {
        const existingQuantity = parseFloat(row.quantity);
        const existingTotalCost = parseFloat(row.totalCost || '0');
        const newQuantity = (existingQuantity + parseFloat(quantity)).toFixed(2);
        const newTotalCost = (existingTotalCost + parseFloat(finalTotalCost)).toFixed(2);
        const avgUnitCost = (newTotalCost / newQuantity).toFixed(2);
        await new Promise((resolve, reject) => {
          db.run(
            `UPDATE inventory SET quantity = ?, totalCost = ?, cost = ?, proofGallons = ?, receivedDate = ?, source = ?, unit = ?, status = ?, account = ? WHERE identifier = ? AND type = ? AND (account = ? OR account IS NULL) AND siteId = ? AND locationId = ?`,
            [newQuantity, newTotalCost, avgUnitCost, finalProofGallons, receivedDate, source || 'Unknown', unit, finalStatus, finalAccount, identifier, type, finalAccount, siteId, locationId],
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
            [identifier, finalAccount, type, quantity, unit, proof || null, finalProofGallons, finalTotalCost, finalUnitCost, receivedDate, source || 'Unknown', siteId, locationId, finalStatus, description || null],
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
    console.log('POST /api/receive: Success', { items });
    res.json({ message: 'Receive successful' });
  } catch (err) {
    console.error('POST /api/receive: Error:', err);
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
              console.error('POST /api/record-loss: Insert inventory loss error:', err);
              return res.status(500).json({ error: `Failed to record inventory loss: ${err.message}` });
            }
            db.run(
              `UPDATE inventory SET quantity = ? WHERE identifier = ? AND siteId = ? AND locationId = ? AND status IN (?, ?)`,
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
          `SELECT siteId, status FROM batches WHERE batchId = ?`,
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
            const { siteId, status } = batchRow;
            if (status === 'Completed') {
              console.error('POST /api/record-loss: Batch already completed', { identifier, status });
              return res.status(400).json({ error: `Batch ${identifier} is already completed` });
            }
            // Get a default locationId for the site
            db.get(
              `SELECT locationId FROM locations WHERE siteId = ? LIMIT 1`,
              [siteId],
              (err, locationRow) => {
                if (err) {
                  console.error('POST /api/record-loss: Fetch location error:', err);
                  return res.status(500).json({ error: `Failed to fetch location: ${err.message}` });
                }
                if (!locationRow) {
                  console.error('POST /api/record-loss: No location found for site', { siteId });
                  return res.status(400).json({ error: `No location found for site: ${siteId}` });
                }
                const locationId = locationRow.locationId;
                console.log('POST /api/record-loss: Recording batch-level loss', { identifier, siteId, locationId });
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
                      console.error('POST /api/record-loss: Insert batch loss error:', err);
                      return res.status(500).json({ error: `Failed to record batch loss: ${err.message}` });
                    }
                    console.log('POST /api/record-loss: Success (batch loss)', { identifier, quantityLost, siteId, locationId });
                    res.json({ message: 'Batch loss recorded successfully' });
                  }
                );
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
  const { siteId, type } = req.query;
  let query = 'SELECT * FROM equipment WHERE enabled = 1';
  const params = [];
  if (siteId) {
    query += ' AND siteId = ?';
    params.push(siteId);
  }
  if (type) {
    query += ' AND type = ?';
    params.push(type);
  }
  db.all(query, params, (err, rows) => {
    if (err) {
      console.error('Fetch equipment error:', err);
      return res.status(500).json({ error: err.message });
    }
    console.log('GET /api/equipment, returning:', rows);
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

app.get('/api/kegs', (req, res) => {
  const { status, page = 1, limit = 10 } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);
  let countQuery = `SELECT COUNT(*) as total FROM kegs WHERE 1=1`;
  let query = `
    SELECT k.id, k.code, k.status, k.productId, k.lastScanned, k.location, k.customerId, k.packagingType,
           p.name AS productName, c.name AS customerName, l.name AS locationName
    FROM kegs k
    LEFT JOIN products p ON k.productId = p.id
    LEFT JOIN customers c ON k.customerId = c.customerId
    LEFT JOIN locations l ON k.location = l.locationId
    LEFT JOIN keg_transactions kt ON k.id = kt.kegId AND kt.action = 'Filled'
    LEFT JOIN batch_packaging bp ON kt.batchId = bp.batchId
    WHERE kt.id = (SELECT MAX(id) FROM keg_transactions WHERE kegId = k.id AND action = 'Filled') OR kt.id IS NULL
  `;
  let params = [];
  let countParams = [];
  if (status) {
    query += ' AND k.status = ?';
    countQuery += ' AND status = ?';
    params.push(status);
    countParams.push(status);
  }
  query += ' LIMIT ? OFFSET ?';
  params.push(parseInt(limit), offset);

  db.get(countQuery, countParams, (err, countResult) => {
    if (err) {
      console.error('GET /api/kegs: Count kegs error:', err);
      return res.status(500).json({ error: err.message });
    }
    const totalKegs = countResult.total;
    const totalPages = Math.ceil(totalKegs / parseInt(limit));
    db.all(query, params, (err, rows) => {
      if (err) {
        console.error('GET /api/kegs: Fetch kegs error:', err);
        return res.status(500).json({ error: err.message });
      }
      console.log('GET /api/kegs: Success', { count: rows.length, page, limit, totalPages });
      res.json({ kegs: rows, totalPages });
    });
  });
});

app.post('/api/kegs/register', (req, res) => {
  const { code } = req.body;
  if (!code || !/^[A-Z0-9-]+$/.test(code)) {
    console.error('POST /api/kegs/register: Invalid code', { code });
    return res.status(400).json({ error: 'Valid keg code (e.g., KEG-001) required' });
  }
  db.get('SELECT id FROM kegs WHERE code = ?', [code], (err, existing) => {
    if (err) {
      console.error('POST /api/kegs/register: Check existing keg error:', err);
      return res.status(500).json({ error: err.message });
    }
    if (existing) {
      console.error('POST /api/kegs/register: Keg already exists', { code });
      return res.status(400).json({ error: `Keg code ${code} already registered` });
    }
    const date = new Date().toISOString().split('T')[0];
    db.run(
      'INSERT INTO kegs (code, status, lastScanned, location) VALUES (?, ?, ?, ?)',
      [code, 'Empty', date, 'Brewery'],
      function (err) {
        if (err) {
          console.error('POST /api/kegs/register: Insert keg error:', err);
          return res.status(500).json({ error: err.message });
        }
        const kegId = this.lastID;
        db.run(
          'INSERT INTO keg_transactions (kegId, action, date, location) VALUES (?, ?, ?, ?)',
          [kegId, 'Registered', date, 'Brewery'],
          (err) => {
            if (err) {
              console.error('POST /api/kegs/register: Insert transaction error:', err);
              return res.status(500).json({ error: err.message });
            }
            console.log('POST /api/kegs/register: Success', { code, kegId });
            res.json({ id: kegId, code, status: 'Empty', lastScanned: date, location: 'Brewery' });
          }
        );
      }
    );
  });
});

// server.js (replace around line ~5513)
app.get('/api/kegs/:code', (req, res) => {
  const { code } = req.params;
  db.get(
    'SELECT k.*, p.name AS productName, c.name AS customerName FROM kegs k LEFT JOIN products p ON k.productId = p.id LEFT JOIN customers c ON k.customerId = c.customerId WHERE k.code = ?',
    [code],
    (err, keg) => {
      if (err) {
        console.error('GET /api/kegs/:code: Fetch keg error:', err);
        return res.status(500).json({ error: err.message });
      }
      if (!keg) {
        console.error('GET /api/kegs/:code: Keg not found', { code });
        return res.status(404).json({ error: `Keg not found: ${code}` });
      }
      console.log('GET /api/kegs/:code: Success', keg);
      res.json(keg);
    }
  );
});

app.patch('/api/kegs/:code', (req, res) => {
  const { code } = req.params;
  const { status, productId, location, customerId, lastScanned, packagingType } = req.body;
  if (!status && !productId && !location && customerId === undefined && !lastScanned && !packagingType) {
    console.error('PATCH /api/kegs/:code: No fields provided', { code });
    return res.status(400).json({ error: 'At least one field (status, productId, location, customerId, lastScanned, packagingType) must be provided' });
  }
  if (status && !['Filled', 'Empty', 'Destroyed', 'Broken'].includes(status)) {
    console.error('PATCH /api/kegs/:code: Invalid status', { status });
    return res.status(400).json({ error: 'Invalid status. Must be Filled, Empty, Destroyed, or Broken' });
  }
  db.get('SELECT * FROM kegs WHERE code = ?', [code], (err, keg) => {
    if (err) {
      console.error('PATCH /api/kegs/:code: Fetch keg error:', err);
      return res.status(500).json({ error: err.message });
    }
    if (!keg) {
      console.error('PATCH /api/kegs/:code: Keg not found', { code });
      return res.status(404).json({ error: `Keg not found: ${code}` });
    }
    const updates = {};
    if (status) updates.status = status;
    if (productId) updates.productId = productId;
    if (location) updates.location = location; // Expects locationId
    if (customerId !== undefined) updates.customerId = customerId;
    if (lastScanned) updates.lastScanned = lastScanned;
    if (packagingType) updates.packagingType = packagingType;

    const setClause = Object.keys(updates).map(field => `${field} = ?`).join(', ');
    const values = [...Object.values(updates), code];

    db.run(
      `UPDATE kegs SET ${setClause} WHERE code = ?`,
      values,
      function (err) {
        if (err) {
          console.error('PATCH /api/kegs/:code: Update keg error:', err);
          return res.status(500).json({ error: err.message });
        }
        db.run(
          'INSERT INTO keg_transactions (kegId, action, productId, customerId, date, location, packagingType) VALUES (?, ?, ?, ?, ?, ?, ?)',
          [
            keg.id,
            'Updated',
            productId || keg.productId,
            customerId !== undefined ? customerId : keg.customerId,
            lastScanned || new Date().toISOString().split('T')[0],
            location || keg.location,
            packagingType || keg.packagingType
          ],
          (err) => {
            if (err) {
              console.error('PATCH /api/kegs/:code: Insert transaction error:', err);
              return res.status(500).json({ error: err.message });
            }
            db.get(
              'SELECT k.*, p.name AS productName, c.name AS customerName, l.name AS locationName FROM kegs k LEFT JOIN products p ON k.productId = p.id LEFT JOIN customers c ON k.customerId = c.customerId LEFT JOIN locations l ON k.location = l.locationId WHERE k.code = ?',
              [code],
              (err, updatedKeg) => {
                if (err) {
                  console.error('PATCH /api/kegs/:code: Fetch updated keg error:', err);
                  return res.status(500).json({ error: err.message });
                }
                console.log('PATCH /api/kegs/:code: Success', updatedKeg);
                res.json(updatedKeg);
              }
            );
          }
        );
      }
    );
  });
});

// server.js (replace around line ~5540)
app.get('/api/kegs/:code/transactions', (req, res) => {
  const { code } = req.params;
  db.get('SELECT id FROM kegs WHERE code = ?', [code], (err, keg) => {
    if (err) {
      console.error('GET /api/kegs/:code/transactions: Fetch keg error:', err);
      return res.status(500).json({ error: err.message });
    }
    if (!keg) {
      console.error('GET /api/kegs/:code/transactions: Keg not found', { code });
      return res.status(404).json({ error: `Keg not found: ${code}` });
    }
    db.all(
      'SELECT kt.*, p.name AS productName, c.name AS customerName FROM keg_transactions kt LEFT JOIN products p ON kt.productId = p.id LEFT JOIN customers c ON kt.customerId = c.customerId WHERE kt.kegId = ? ORDER BY kt.date DESC',
      [keg.id],
      (err, transactions) => {
        if (err) {
          console.error('GET /api/kegs/:code/transactions: Fetch transactions error:', err);
          return res.status(500).json({ error: err.message });
        }
        console.log('GET /api/kegs/:code/transactions: Success', { code, count: transactions.length });
        res.json(transactions);
      }
    );
  });
});

app.get('/api/product-package-types', (req, res) => {
  const { productId } = req.query;
  let query = 'SELECT id, productId, type, price, isKegDepositItem FROM product_package_types WHERE enabled = 1';
  let params = [];
  if (productId) {
    query += ' AND productId = ?';
    params.push(productId);
  }
  db.all(query, params, (err, rows) => {
    if (err) {
      console.error('GET /api/product-package-types: Fetch packaging types error:', err);
      return res.status(500).json({ error: err.message });
    }
    console.log('GET /api/product-package-types: Success', { count: rows.length });
    res.json(rows);
  });
});

app.get('*', (req, res) => res.sendFile(path.join(__dirname, '../client/build/index.html')));

app.get('/api/debug/inventory/hops', (req, res) => {
  const { siteId } = req.query;
  db.all('SELECT * FROM inventory WHERE identifier LIKE ? AND siteId = ?', ['%Hops%', siteId || 'BR-AL-20019'], (err, rows) => {
    if (err) {
      console.error('Debug inventory hops error:', err);
      return res.status(500).json({ error: err.message });
    }
    console.log('Debug inventory hops:', rows);
    res.json(rows);
  });
});

app.get('/api/debug/inventory/new', (req, res) => {
  const { date, identifier, siteId } = req.query;
  let query = 'SELECT * FROM inventory';
  let params = [];
  let conditions = [];
  if (date) {
    conditions.push('receivedDate = ?');
    params.push(date);
  }
  if (identifier) {
    conditions.push('identifier = ?');
    params.push(identifier);
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
      console.error('GET /api/debug/inventory/new: Error:', err);
      return res.status(500).json({ error: err.message });
    }
    console.log('GET /api/debug/inventory/new:', rows);
    res.json(rows);
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});