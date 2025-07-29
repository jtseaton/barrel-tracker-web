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
  if (isInitialized) {
    console.log('Database already initialized, skipping initialization');
    return;
  }
  
  db.serialize(() => {
    console.log('Initializing database schema...');
    // Create tables (unchanged)
    db.run(`
      CREATE TABLE IF NOT EXISTS sites (
        siteId TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        type TEXT,
        address TEXT,
        enabled INTEGER DEFAULT 1
      )
    `, (err) => { if (err) console.error('Error creating sites table:', err); else console.log('Sites table created'); });
    db.run(`
      CREATE TABLE IF NOT EXISTS locations (
        locationId INTEGER PRIMARY KEY AUTOINCREMENT,
        siteId TEXT,
        name TEXT NOT NULL,
        abbreviation TEXT,
        enabled INTEGER DEFAULT 1,
        FOREIGN KEY (siteId) REFERENCES sites(siteId)
      )
    `, (err) => { if (err) console.error('Error creating locations table:', err); else console.log('Locations table created'); });
    db.run(`
      CREATE TABLE IF NOT EXISTS items (
        name TEXT PRIMARY KEY,
        type TEXT,
        enabled INTEGER DEFAULT 1
      )
    `, (err) => { if (err) console.error('Error creating items table:', err); else console.log('Items table created'); });
    // ... other table creations (unchanged) ...
    
    console.log('Database schema initialized');
    isInitialized = true;
  });
}

async function insertTestData() {
  console.log('Inserting test data...');

  // Hash password for user
  const password = 'P@$$w0rd1234';
  let hash;
  try {
    hash = await bcrypt.hash(password, 10);
    console.log('Password hashed successfully');
  } catch (err) {
    console.error('Error hashing password:', err);
    return; // Exit early to avoid further errors
  }

  // Run inserts in a serialized block
  db.serialize(() => {
    // Users
    db.run(
      'INSERT OR IGNORE INTO users (email, passwordHash, role, enabled) VALUES (?, ?, ?, ?)',
      ['jtseaton@gmail.com', hash, 'SuperAdmin', 1],
      (err) => { if (err) console.error('Error inserting default user:', err); else console.log('Inserted default Super Admin user'); }
    );

    // Sites
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

    // Locations
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
    // ... other location inserts (unchanged) ...

    // Load items from items.xml
    try {
      const xmlPath = path.join(__dirname, '../../config/items.xml');
      console.log(`Reading items.xml from: ${xmlPath}`);
      const xmlData = fs.readFileSync(xmlPath, 'utf-8'); // Use sync for simplicity in serialize
      const parser = new xml2js.Parser({ explicitArray: false });
      parser.parseString(xmlData, (err, result) => {
        if (err) {
          console.error('Error parsing items.xml:', err);
          return;
        }
        const items = result.items.item;
        const itemsArray = Array.isArray(items) ? items : [items].filter(Boolean);

        for (const item of itemsArray) {
          const name = item.name || '';
          const type = item.type || 'Other';
          const enabled = parseInt(item.enabled || '1', 10);
          if (!name) {
            console.warn('Skipping item with missing name in items.xml:', item);
            continue;
          }
          db.run(
            'INSERT OR IGNORE INTO items (name, type, enabled) VALUES (?, ?, ?)',
            [name, type, enabled],
            (err) => {
              if (err) {
                console.error(`Error inserting item ${name}:`, err);
              } else {
                console.log(`Inserted item from items.xml: ${name}`);
              }
            }
          );
        }
      });
    } catch (err) {
      console.error('Error loading items.xml:', err);
    }

    // Existing test data for items
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
      'INSERT OR IGNORE INTO items (name, type, enabled) VALUES (?, ?, ?)',
      ['Hops', 'Hops', 1],
      (err) => { if (err) console.error('Error inserting item Hops:', err); }
    );

    // ... rest of existing test data inserts (unchanged) ...
    console.log('Test data insertion complete');
  });
}

module.exports = { db, initializeDatabase, insertTestData, OUR_DSP };