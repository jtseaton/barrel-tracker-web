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
          identifier TEXT,
          account TEXT,
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
          isKegDepositItem INTEGER,
          enabled INTEGER DEFAULT 1,
          FOREIGN KEY (siteId) REFERENCES sites(siteId),
          FOREIGN KEY (locationId) REFERENCES locations(locationId),
          UNIQUE(identifier, type, account, siteId)
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
        if (err) console.error('Error creating product table:', err);
        else console.log('Products table created');
      });
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
          batchType TEXT,
          FOREIGN KEY (productId) REFERENCES products(id),
          FOREIGN KEY (recipeId) REFERENCES recipes(id),
          FOREIGN KEY (siteId) REFERENCES sites(siteId),
          FOREIGN KEY (equipmentId) REFERENCES equipment(equipmentId),
          FOREIGN KEY (fermenterId) REFERENCES equipment(equipmentId)
        )
      `, (err) => {
        if (err) console.error('Error creating batches table:', err);
        else console.log('Batches table created');
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
        else console.log('Recipes table created');
      });
      db.run(`
        CREATE TABLE IF NOT EXISTS recipe_ingredients (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          recipeId INTEGER NOT NULL,
          itemName TEXT NOT NULL,
          quantity REAL NOT NULL,
          unit TEXT NOT NULL,
          FOREIGN KEY (recipeId) REFERENCES recipes(id)
        )
      `, (err) => {
        if (err) console.error('Error creating recipe_ingredients table:', err);
        else console.log('Recipe Ingredients table created');
      });
      db.run(`
        CREATE TABLE IF NOT EXISTS product_package_types (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          productId INTEGER NOT NULL,
          type TEXT NOT NULL,
          price TEXT NOT NULL,
          isKegDepositItem INTEGER NOT NULL,
          enabled INTEGER DEFAULT 1,
          FOREIGN KEY (productId) REFERENCES products(id),
          UNIQUE(productId, type)
        )
      `, (err) => {
        if (err) console.error('Error creating product_package_types table:', err);
        else console.log('Product Package Types table created');
      });
      db.run(`
        CREATE TABLE IF NOT EXISTS package_types (
          name TEXT PRIMARY KEY,
          volume REAL NOT NULL,
          enabled INTEGER DEFAULT 1
        )
      `, (err) => {
        if (err) console.error('Error creating package_types table:', err);
        else console.log('Package Types table created');
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
      db.run(`
        CREATE TABLE IF NOT EXISTS batch_actions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          batchId TEXT NOT NULL,
          action TEXT NOT NULL,
          timestamp TEXT NOT NULL,
          FOREIGN KEY (batchId) REFERENCES batches(batchId)
        )
      `, (err) => {
        if (err) console.error('Error creating batch_actions table:', err);
        else console.log('Batch Actions table created');
      });
      db.run(`
        CREATE TABLE IF NOT EXISTS batch_packaging (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          batchId TEXT NOT NULL,
          packageType TEXT NOT NULL,
          quantity INTEGER NOT NULL,
          volume REAL NOT NULL,
          locationId INTEGER,
          date TEXT NOT NULL,
          siteId TEXT NOT NULL,
          kegCodes TEXT,
          FOREIGN KEY (batchId) REFERENCES batches(batchId),
          FOREIGN KEY (locationId) REFERENCES locations(locationId),
          FOREIGN KEY (siteId) REFERENCES sites(siteId)
        )
      `, (err) => {
        if (err) console.error('Error creating batch_packaging table:', err);
        else console.log('Batch Packaging table created');
      });
      db.run(`
        CREATE TABLE IF NOT EXISTS kegs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          code TEXT UNIQUE NOT NULL,
          status TEXT NOT NULL,
          productId INTEGER,
          batchId TEXT,
          lastScanned TEXT,
          locationId INTEGER,
          customerId TEXT,
          FOREIGN KEY (productId) REFERENCES products(id),
          FOREIGN KEY (batchId) REFERENCES batches(batchId),
          FOREIGN KEY (locationId) REFERENCES locations(locationId)
        )
      `, (err) => {
        if (err) console.error('Error creating kegs table:', err);
        else console.log('Kegs table created');
      });
      db.run(`
        CREATE TABLE IF NOT EXISTS keg_transactions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          kegId INTEGER NOT NULL,
          action TEXT NOT NULL,
          productId INTEGER,
          batchId TEXT,
          date TEXT NOT NULL,
          location TEXT,
          FOREIGN KEY (kegId) REFERENCES kegs(id),
          FOREIGN KEY (productId) REFERENCES products(id),
          FOREIGN KEY (batchId) REFERENCES batches(batchId)
        )
      `, (err) => {
        if (err) console.error('Error creating keg_transactions table:', err);
        else console.log('Keg Transactions table created');
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

          try {
            const xmlPath = path.join(__dirname, '../../config/package_types.xml');
            console.log(`Reading package-types.xml from: ${xmlPath}`);
            const xmlData = await fs.readFile(xmlPath, 'utf-8');
            const parser = new xml2js.Parser({ explicitArray: false });
            const result = await parser.parseStringPromise(xmlData);
            const packageTypes = result.packageTypes.packageType;
            const packageTypesArray = Array.isArray(packageTypes) ? packageTypes : [packageTypes].filter(Boolean);

            for (const pkg of packageTypesArray) {
              const name = pkg.$.name || '';
              const volume = parseFloat(pkg.$.volume) || 0;
              const enabled = parseInt(pkg.$.enabled || '1', 10);
              if (!name || volume <= 0) {
                console.warn('Skipping package type with invalid name or volume in package-types.xml:', pkg);
                continue;
              }
              db.run(
                'INSERT OR IGNORE INTO package_types (name, volume, enabled) VALUES (?, ?, ?)',
                [name, volume, enabled],
                (err) => {
                  if (err) console.error(`Error inserting package type ${name}:`, err);
                  else console.log(`Inserted package type from package_types.xml: ${name}`);
                }
              );
            }
          } catch (err) {
            console.error('Error loading package-types.xml:', err);
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
          'INSERT OR IGNORE INTO items (name, type, enabled) VALUES (?, ?, ?)',
          ['2-Row Barley', 'Grain', 1],
          (err) => { if (err) console.error('Error inserting item 2-Row Barley:', err); }
        );

        db.run(
          `INSERT OR IGNORE INTO inventory (identifier, account, type, quantity, unit, receivedDate, source, siteId, locationId, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          ['2-Row Barley', 'Storage', 'Grain', '150', 'lbs', '2025-08-05', 'Grain Co', 'BR-AL-20019', 7, 'Stored'],
          (err) => { if (err) console.error('Error inserting test inventory item BR-AL-20019:', err); else console.log('Inserted test inventory item BR-AL-20019'); }
        );
        db.run(
          `INSERT OR IGNORE INTO inventory (identifier, account, type, quantity, unit, receivedDate, source, siteId, locationId, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          ['2-Row Barley', 'Storage', 'Grain', '100', 'lbs', '2025-08-05', 'ABC Supplier', 'DSP-AL-20051', 1, 'Stored'],
          (err) => { if (err) console.error('Error inserting test inventory item DSP-AL-20051:', err); else console.log('Inserted test inventory item DSP-AL-20051'); }
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