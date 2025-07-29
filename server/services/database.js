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
    // ... existing table creation code remains unchanged ...
  });
}

async function insertTestData() {
  db.serialize(async () => {
    console.log('Inserting test data...');

    // Existing test data inserts...
    const password = await bcrypt.hash('P@$$w0rd1234', 10);
    db.run('INSERT OR IGNORE INTO users (email, passwordHash, role, enabled) VALUES (?, ?, ?, ?)',
      ['jtseaton@gmail.com', hash, 'SuperAdmin', 1],
      (err) => { if (err) console.error('Error inserting default user:', err); else console.log('Inserted default Super Admin user'); });

    // Sites
    db.run(`INSERT OR IGNORE INTO sites (siteId, name, type, address) VALUES (?, ?, ?, ?)`,
      ['DSP-AL-20051', 'Athens AL DSP', 'DSP', '311 Marion St, Athens, AL 35611'],
      (err) => { if (err) console.error('Error inserting site DSP-AL-20051:', err); });
    // ... other site inserts ...

    // Locations (including new ones for DSP-AL-20051)
    db.run(`INSERT OR IGNORE INTO locations (siteId, name, abbreviation) VALUES (?, ?, ?)`,
      ['DSP-AL-20051', 'Athens DSP Storage', 'Storage'],
      (err) => { if (err) console.error('Error inserting location Athens DSP Storage:', err); });
    db.run(`INSERT OR IGNORE INTO locations (siteId, name, abbreviation) VALUES (?, ?, ?)`,
      ['DSP-AL-20051', 'Athens DSP Processing', null],
      (err) => { if (err) console.error('Error inserting location Athens DSP Processing:', err); });
    // ... other location inserts ...

    // Load items from items.xml
    try {
      const xmlPath = path.join(__dirname, '../../config/items.xml');
      console.log(`Reading items.xml from: ${xmlPath}`);
      const xmlData = await fs.readFile(xmlPath, 'utf-8');
      const parser = new xml2js.Parser({ explicitArray: false });
      const result = await parser.parseStringPromise(xmlData);

      const items = result.items.item;
      // Normalize to array if single item
      const itemsArray = Array.isArray(items) ? items : [items];

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
    } catch (err) {
      console.error('Error loading items.xml:', err);
    }

    // Existing test data for items (kept for reference, will be skipped if already in items.xml)
    db.run('INSERT OR IGNORE INTO items (name, type, enabled) VALUES (?, ?, ?)',
      ['Finished Goods', 'Finished Goods', 1],
      (err) => { if (err) console.error('Error inserting item Finished Goods:', err); });
    db.run('INSERT OR IGNORE INTO items (name, type, enabled) VALUES (?, ?, ?)',
      ['Corn', 'Grain', 1],
      (err) => { if (err) console.error('Error inserting item Corn:', err); });
    db.run('INSERT OR IGNORE INTO items (name, type, enabled) VALUES (?, ?, ?)',
      ['Hops', 'Hops', 1],
      (err) => { if (err) console.error('Error inserting item Hops:', err); });

    // ... rest of existing test data inserts ...
  });
}

module.exports = { db, initializeDatabase, insertTestData, OUR_DSP };