const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');
const fs = require('fs').promises;
const path = require('path');
const xml2js = require('xml2js');

const OUR_DSP = 'DSP-AL-20010';

const db = new sqlite3.Database(':memory:', (err) => {
  if (err) console.error('Database connection error:', err);
  else console.log('Connected to SQLite database');
});

let isInitialized = false;

function initializeDatabase() {
  return new Promise((resolve, reject) => {
    if (isInitialized) {
      console.log('Database already initialized, skipping initialization');
      return resolve();
    }
    
    db.serialize(() => {
      console.log('Initializing database schema...');
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
        else console.log('Users table created');
      });
      db.run(`
        CREATE TABLE IF NOT EXISTS sites (
          siteId TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          type TEXT,
          address TEXT,
          enabled INTEGER DEFAULT 1
        )
      `, (err) => {
        if (err) console.error('Error creating sites table:', err);
        else console.log('Sites table created');
      });
      db.run(`
        CREATE TABLE IF NOT EXISTS locations (
          locationId INTEGER PRIMARY KEY AUTOINCREMENT,
          siteId TEXT,
          name TEXT NOT NULL,
          abbreviation TEXT,
          enabled INTEGER DEFAULT 1,
          FOREIGN KEY (siteId) REFERENCES sites(siteId)
        )
      `, (err) => {
        if (err) console.error('Error creating locations table:', err);
        else console.log('Locations table created');
      });
      db.run(`
        CREATE TABLE IF NOT EXISTS items (
          name TEXT PRIMARY KEY,
          type TEXT,
          enabled INTEGER DEFAULT 1
        )
      `, (err) => {
        if (err) console.error('Error creating items table:', err);
        else console.log('Items table created');
      });
      db.run(`
        CREATE TABLE IF NOT EXISTS inventory (
          identifier TEXT PRIMARY KEY,
          item TEXT NOT NULL,
          type TEXT,
          quantity TEXT,
          unit TEXT,
          proof TEXT,
          proofGallons TEXT,
          receivedDate TEXT,
          source TEXT,
          siteId TEXT,
          locationId INTEGER,
          status TEXT,
          description TEXT,
          cost TEXT,
          totalCost TEXT,
          poNumber TEXT,
          lotNumber TEXT,
          account TEXT,
          enabled INTEGER DEFAULT 1,
          FOREIGN KEY (siteId) REFERENCES sites(siteId),
          FOREIGN KEY (locationId) REFERENCES locations(locationId)
        )
      `, (err) => {
        if (err) console.error('Error creating inventory table:', err);
        else console.log('Inventory table created');
      });
      db.run(`
        CREATE TABLE IF NOT EXISTS vendors (
          name TEXT PRIMARY KEY,
          enabled INTEGER DEFAULT 1
        )
      `, (err) => {
        if (err) console.error('Error creating vendors table:', err);
        else console.log('Vendors table created');
      });
      db.run(`
        CREATE TABLE IF NOT EXISTS equipment (
          equipmentId INTEGER PRIMARY KEY AUTOINCREMENT,
          siteId TEXT,
          name TEXT NOT NULL,
          type TEXT,
          enabled INTEGER DEFAULT 1,
          FOREIGN KEY (siteId) REFERENCES sites(siteId)
        )
      `, (err) => {
        if (err) console.error('Error creating equipment table:', err);
        else console.log('Equipment table created');
      });
      db.run(`
        CREATE TABLE IF NOT EXISTS facility_designs (
          facilityDesignId INTEGER PRIMARY KEY AUTOINCREMENT,
          siteId TEXT,
          name TEXT NOT NULL,
          enabled INTEGER DEFAULT 1,
          FOREIGN KEY (siteId) REFERENCES sites(siteId)
        )
      `, (err) => {
        if (err) console.error('Error creating facility_designs table:', err);
        else console.log('Facility_designs table created');
      });
      db.run(`
        CREATE TABLE IF NOT EXISTS inventory_losses (
          lossId INTEGER PRIMARY KEY AUTOINCREMENT,
          identifier TEXT NOT NULL,
          quantityLost TEXT NOT NULL,
          reason TEXT NOT NULL,
          date TEXT NOT NULL,
          siteId TEXT NOT NULL,
          locationId INTEGER,
          userId TEXT,
          FOREIGN KEY (siteId) REFERENCES sites(siteId),
          FOREIGN KEY (locationId) REFERENCES locations(locationId),
          FOREIGN KEY (userId) REFERENCES users(email)
        )
      `, (err) => {
        if (err) console.error('Error creating inventory_losses table:', err);
        else console.log('Inventory_losses table created');
      });
      db.run(`
        CREATE TABLE IF NOT EXISTS purchase_orders (
          poNumber TEXT PRIMARY KEY,
          site TEXT NOT NULL,
          poDate TEXT NOT NULL,
          supplier TEXT NOT NULL,
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
          status TEXT NOT NULL,
          items TEXT NOT NULL,
          FOREIGN KEY (site) REFERENCES sites(siteId),
          FOREIGN KEY (supplier) REFERENCES vendors(name)
        )
      `, (err) => {
        if (err) console.error('Error creating purchase_orders table:', err);
        else console.log('Purchase_orders table created');
      });
      db.run('SELECT 1', (err) => {
        if (err) {
          console.error('Error finalizing schema:', err);
          reject(err);
        } else {
          console.log('Database schema initialized');
          isInitialized = true;
          resolve();
        }
      });
    });
  });
}

async function insertTestData() {
  console.log('Inserting test data...');

  let hash;
  try {
    hash = await bcrypt.hash('P@$$w0rd1234', 10);
    console.log('Password hashed successfully');
  } catch (err) {
    console.error('Error hashing password:', err);
    return;
  }

  try {
    await new Promise((resolve, reject) => {
      db.serialize(() => {
        db.run(
          'INSERT OR IGNORE INTO users (email, passwordHash, role, enabled) VALUES (?, ?, ?, ?)',
          ['jtseaton@gmail.com', hash, 'SuperAdmin', 1],
          (err) => {
            if (err) console.error('Error inserting default user:', err);
            else console.log('Inserted default Super Admin user');
          }
        );

        db.run(
          `INSERT OR IGNORE INTO sites (siteId, name, type, address) VALUES (?, ?, ?, ?)`,
          ['DSP-AL-20051', 'Athens AL DSP', 'DSP', '311 Marion St, Athens, AL 35611'],
          (err) => { if (err) console.error('Error inserting site DSP-AL-20051:', err); }
        );
        db.run(
          `INSERT OR IGNORE INTO sites (siteId, name, type, address) VALUES (?, ?, ?, ?)`,
          ['BR-AL-20088', 'Athens Brewery', 'Brewery', '311 Marion St, Athens, AL 35611'],
          (err) => { if (err) console.error('Error inserting site BR-AL-20088:', err); }
        );
        db.run(
          `INSERT OR IGNORE INTO sites (siteId, name, type, address) VALUES (?, ?, ?, ?)`,
          ['BR-AL-20019', 'Madison Brewery', 'Brewery', '212 Main St Madison, AL 35758'],
          (err) => { if (err) console.error('Error inserting site BR-AL-20019:', err); }
        );
        db.run(
          `INSERT OR IGNORE INTO sites (siteId, name, type, address) VALUES (?, ?, ?, ?)`,
          ['DSP-AL-20010', 'Madison Distillery', 'DSP', '212 Main St Madison, AL 35758'],
          (err) => { if (err) console.error('Error inserting site DSP-AL-20010:', err); }
        );

        db.run(
          `INSERT OR IGNORE INTO locations (siteId, name, abbreviation) VALUES (?, ?, ?)`,
          ['DSP-AL-20051', 'Athens DSP Storage', 'Storage'],
          (err) => { if (err) console.error('Error inserting location Athens DSP Storage:', err); }
        );
        db.run(
          `INSERT OR IGNORE INTO locations (siteId, name, abbreviation) VALUES (?, ?, ?)`,
          ['DSP-AL-20051', 'Athens DSP Processing', null],
          (err) => { if (err) console.error('Error inserting location Athens DSP Processing:', err); }
        );
        db.run(
          `INSERT OR IGNORE INTO locations (siteId, name, abbreviation) VALUES (?, ?, ?)`,
          ['DSP-AL-20010', 'Spirits Storage', 'Spirits'],
          (err) => { if (err) console.error('Error inserting location Spirits Storage:', err); }
        );
        db.run(
          `INSERT OR IGNORE INTO locations (siteId, name, abbreviation) VALUES (?, ?, ?)`,
          ['DSP-AL-20010', 'Grain Storage', null],
          (err) => { if (err) console.error('Error inserting location Grain Storage:', err); }
        );
        db.run(
          `INSERT OR IGNORE INTO locations (siteId, name, abbreviation) VALUES (?, ?, ?)`,
          ['DSP-AL-20010', 'Fermentation Tanks', null],
          (err) => { if (err) console.error('Error inserting location Fermentation Tanks:', err); }
        );
        db.run(
          `INSERT OR IGNORE INTO locations (siteId, name, abbreviation) VALUES (?, ?, ?)`,
          ['BR-AL-20019', 'Madison Fermenter 1', null],
          (err) => { if (err) console.error('Error inserting location Madison Fermenter 1:', err); }
        );
        db.run(
          `INSERT OR IGNORE INTO locations (siteId, name, abbreviation) VALUES (?, ?, ?)`,
          ['BR-AL-20019', 'Madison Outdoor Racks', null],
          (err) => { if (err) console.error('Error inserting location Madison Outdoor Racks:', err); }
        );
        db.run(
          `INSERT OR IGNORE INTO locations (siteId, name, abbreviation) VALUES (?, ?, ?)`,
          ['BR-AL-20019', 'Madison Fermenter 2', null],
          (err) => { if (err) console.error('Error inserting location Madison Fermenter 2:', err); }
        );
        db.run(
          `INSERT OR IGNORE INTO locations (siteId, name, abbreviation) VALUES (?, ?, ?)`,
          ['BR-AL-20019', 'Madison Fermenter 3', null],
          (err) => { if (err) console.error('Error inserting location Madison Fermenter 3:', err); }
        );
        db.run(
          `INSERT OR IGNORE INTO locations (siteId, name, abbreviation) VALUES (?, ?, ?)`,
          ['BR-AL-20019', 'Madison Fermenter 4', null],
          (err) => { if (err) console.error('Error inserting location Madison Fermenter 4:', err); }
        );
        db.run(
          `INSERT OR IGNORE INTO locations (siteId, name, abbreviation) VALUES (?, ?, ?)`,
          ['BR-AL-20019', 'Madison Cold Storage', 'Beer Cooler'],
          (err) => { if (err) console.error('Error inserting location Madison Cold Storage:', err); }
        );
        db.run(
          `INSERT OR IGNORE INTO locations (siteId, name, abbreviation) VALUES (?, ?, ?)`,
          ['BR-AL-20019', 'Madison Mash Tun', 'Mash Tun'],
          (err) => { if (err) console.error('Error inserting location Madison Mash Tun:', err); }
        );
        db.run(
          `INSERT OR IGNORE INTO locations (siteId, name, abbreviation) VALUES (?, ?, ?)`,
          ['BR-AL-20019', 'Madison Boil Kettle', null],
          (err) => { if (err) console.error('Error inserting location Madison Boil Kettle:', err); }
        );
        db.run(
          `INSERT OR IGNORE INTO locations (siteId, name, abbreviation) VALUES (?, ?, ?)`,
          ['BR-AL-20088', 'Athens Cold Storage', 'Athens Cooler'],
          (err) => { if (err) console.error('Error inserting location Athens Cold Storage:', err); }
        );

        db.run(
          `INSERT OR IGNORE INTO vendors (name, enabled) VALUES (?, ?)`,
          ['ABC Supplier', 1],
          (err) => { if (err) console.error('Error inserting vendor ABC Supplier:', err); }
        );
        db.run(
          `INSERT OR IGNORE INTO vendors (name, enabled) VALUES (?, ?)`,
          ['XYZ Distributors', 1],
          (err) => { if (err) console.error('Error inserting vendor XYZ Distributors:', err); }
        );
        db.run(
          `INSERT OR IGNORE INTO vendors (name, enabled) VALUES (?, ?)`,
          ['Grain Co', 1],
          (err) => { if (err) console.error('Error inserting vendor Grain Co:', err); }
        );
        db.run(
          `INSERT OR IGNORE INTO vendors (name, enabled) VALUES (?, ?)`,
          ['Hops R Us', 1],
          (err) => { if (err) console.error('Error inserting vendor Hops R Us:', err); }
        );

        (async () => {
          try {
            const xmlPath = path.join(__dirname, '../../config/items.xml');
            console.log(`Reading items.xml from: ${xmlPath}`);
            const xmlData = await fs.readFile(xmlPath, 'utf-8');
            const parser = new xml2js.Parser({ explicitArray: false });
            const result = await parser.parseStringPromise(xmlData);
            const items = result.items.item;
            const itemsArray = Array.isArray(items) ? items : [items].filter(Boolean);

            for (const item of itemsArray) {
              const name = item.$.name || '';
              const type = item.$.type || 'Other';
              const enabled = parseInt(item.$.enabled || '1', 10);
              if (!name) {
                console.warn('Skipping item with missing name in items.xml:', item);
                continue;
              }
              db.run(
                'INSERT OR IGNORE INTO items (name, type, enabled) VALUES (?, ?, ?)',
                [name, type, enabled],
                (err) => {
                  if (err) console.error(`Error inserting item ${name}:`, err);
                  else console.log(`Inserted item from items.xml: ${name}`);
                }
              );
            }
          } catch (err) {
            console.error('Error loading items.xml:', err);
          }
        })();

        db.run(
          'INSERT OR IGNORE INTO items (name, type, enabled) VALUES (?, ?, ?)',
          ['Finished Goods', 'Finished Goods', 1],
          (err) => { if (err) console.error('Error inserting item Finished Goods:', err); }
        );
        db.run(
          'INSERT OR IGNORE INTO items (name, type, enabled) VALUES (?, ?, ?)',
          ['Corn', 'Grain', 1],
          (err) => { if (err) console.error('Error inserting item Corn:', err); }
        );

        db.run(
          `INSERT OR IGNORE INTO inventory (identifier, item, type, quantity, unit, receivedDate, source, siteId, locationId, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          ['2-Row Barley-001', '2-Row Barley', 'Grain', '100', 'Pounds', new Date().toISOString().split('T')[0], 'ABC Supplier', 'DSP-AL-20051', 1, 'Stored'],
          (err) => { if (err) console.error('Error inserting test inventory item:', err); else console.log('Inserted test inventory item'); }
        );

        db.run('SELECT 1', (err) => {
          if (err) {
            console.error('Error finalizing test data:', err);
            reject(err);
          } else {
            console.log('Test data insertion complete');
            resolve();
          }
        });
      });
    });
  } catch (err) {
    console.error('Insert test data error:', err);
  }
}

async function init() {
  try {
    await initializeDatabase();
    await insertTestData();
  } catch (err) {
    console.error('Initialization error:', err);
  }
}

init();

module.exports = { db, initializeDatabase, insertTestData, OUR_DSP };