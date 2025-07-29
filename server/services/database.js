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
      // Create tables
      db.run(`
        CREATE TABLE IF NOT EXISTS users (
          email TEXT PRIMARY KEY,
          passwordHash TEXT,
          role TEXT NOT NULL,
          enabled INTEGER NOT NULL DEFAULT 1,
          passkey TEXT
        )
      `, (err) => {
        if (err) {
          console.error('Error creating users table:', err);
          reject(err);
        } else {
          console.log('Users table created');
        }
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
        if (err) {
          console.error('Error creating sites table:', err);
          reject(err);
        } else {
          console.log('Sites table created');
        }
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
        if (err) {
          console.error('Error creating locations table:', err);
          reject(err);
        } else {
          console.log('Locations table created');
        }
      });
      db.run(`
        CREATE TABLE IF NOT EXISTS items (
          name TEXT PRIMARY KEY,
          type TEXT,
          enabled INTEGER DEFAULT 1
        )
      `, (err) => {
        if (err) {
          console.error('Error creating items table:', err);
          reject(err);
        } else {
          console.log('Items table created');
        }
      });
      // ... other table creations (unchanged) ...
      
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

  // Hash password for user
  let hash;
  try {
    hash = await bcrypt.hash('P@$$w0rd1234', 10);
    console.log('Password hashed successfully');
  } catch (err) {
    console.error('Error hashing password:', err);
    return;
  }

  // Insert data
  try {
    await new Promise((resolve, reject) => {
      db.serialize(() => {
        // Users
        db.run(
          'INSERT OR IGNORE INTO users (email, passwordHash, role, enabled) VALUES (?, ?, ?, ?)',
          ['jtseaton@gmail.com', hash, 'SuperAdmin', 1],
          (err) => {
            if (err) {
              console.error('Error inserting default user:', err);
              reject(err);
            } else {
              console.log('Inserted default Super Admin user');
            }
          }
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
        })();

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

        // ... other test data inserts (unchanged) ...

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