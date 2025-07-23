const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');

const OUR_DSP = 'DSP-AL-20010';

const db = new sqlite3.Database(':memory:', (err) => {
  if (err) console.error('Database connection error:', err);
  else console.log('Connected to SQLite database');
});

const initializeDatabase = () => {
  db.serialize(() => {
    console.log('Initializing database schema...');

    // Create tables
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
      CREATE TABLE IF NOT EXISTS equipment (
        equipmentId INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT,
        siteId TEXT,
        abbreviation TEXT,
        enabled INTEGER,
        type TEXT,
        FOREIGN KEY (siteId) REFERENCES sites(siteId)
      )
    `, (err) => { if (err) console.error('Error creating equipment table:', err); else console.log('Equipment table created'); });
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
    `, (err) => { if (err) console.error('Error creating customers table:', err); else console.log('Customers table created'); });
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
    `, (err) => { if (err) console.error('Error creating products table:', err); else console.log('Products table created'); });
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
    `, (err) => { if (err) console.error('Error creating product_package_types table:', err); else console.log('Product_package_types table created'); });
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
    `, (err) => { if (err) console.error('Error creating recipes table:', err); else console.log('Recipes table created'); });
    db.run(`
      CREATE TABLE IF NOT EXISTS recipe_ingredients (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        recipeId INTEGER NOT NULL,
        itemName TEXT NOT NULL,
        quantity REAL NOT NULL,
        unit TEXT NOT NULL,
        FOREIGN KEY (recipeId) REFERENCES recipes(id)
      )
    `, (err) => { if (err) console.error('Error creating recipe_ingredients table:', err); else console.log('Recipe_ingredients table created'); });
    db.run(`
      CREATE TABLE IF NOT EXISTS sales_orders (
        orderId INTEGER PRIMARY KEY AUTOINCREMENT,
        customerId INTEGER NOT NULL,
        poNumber TEXT,
        status TEXT NOT NULL DEFAULT 'Draft',
        createdDate TEXT NOT NULL,
        FOREIGN KEY (customerId) REFERENCES customers(customerId)
      )
    `, (err) => { if (err) console.error('Error creating sales_orders table:', err); else console.log('Sales_orders table created'); });
    db.run(`
      CREATE TABLE IF NOT EXISTS sales_order_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        orderId INTEGER NOT NULL,
        itemName TEXT NOT NULL,
        quantity INTEGER NOT NULL,
        unit TEXT NOT NULL,
        price TEXT,
        hasKegDeposit INTEGER DEFAULT 0,
        kegCodes TEXT,
        FOREIGN KEY (orderId) REFERENCES sales_orders(orderId)
      )
    `, (err) => { if (err) console.error('Error creating sales_order_items table:', err); else console.log('Sales_order_items table created'); });
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
    `, (err) => { if (err) console.error('Error creating invoices table:', err); else console.log('Invoices table created'); });
    db.run(`
      CREATE TABLE IF NOT EXISTS invoice_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        invoiceId INTEGER NOT NULL,
        itemName TEXT NOT NULL,
        quantity INTEGER NOT NULL,
        unit TEXT NOT NULL,
        price TEXT,
        hasKegDeposit INTEGER DEFAULT 0,
        kegDeposit TEXT,
        keg_codes TEXT,
        FOREIGN KEY (invoiceId) REFERENCES invoices(invoiceId)
      )
    `, (err) => { if (err) console.error('Error creating invoice_items table:', err); else console.log('Invoice_items table created'); });
    db.run(`
      CREATE TABLE IF NOT EXISTS system_settings (
        settingId INTEGER PRIMARY KEY AUTOINCREMENT,
        key TEXT NOT NULL UNIQUE,
        value TEXT NOT NULL
      )
    `, (err) => { if (err) console.error('Error creating system_settings table:', err); else console.log('System_settings table created'); });
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
        UNIQUE(identifier, type, account, siteId, locationId),
        FOREIGN KEY (siteId) REFERENCES sites(siteId),
        FOREIGN KEY (locationId) REFERENCES locations(locationId)
      )
    `, (err) => { if (err) console.error('Error creating inventory table:', err); else console.log('Inventory table created'); });
    db.run(`
      CREATE TABLE IF NOT EXISTS items (
        name TEXT PRIMARY KEY,
        type TEXT,
        enabled INTEGER DEFAULT 1
      )
    `, (err) => { if (err) console.error('Error creating items table:', err); else console.log('Items table created'); });
    db.run(`
      CREATE TABLE IF NOT EXISTS transactions (
        barrelId TEXT,
        type TEXT,
        quantity REAL,
        proofGallons REAL,
        date TEXT,
        action TEXT,
        dspNumber TEXT,
        toAccount TEXT,
        userId TEXT
      )
    `, (err) => { if (err) console.error('Error creating transactions table:', err); else console.log('Transactions table created'); });
    db.run(`
      CREATE TABLE IF NOT EXISTS vendors (
        name TEXT PRIMARY KEY,
        type TEXT,
        enabled INTEGER DEFAULT 1,
        address TEXT,
        email TEXT,
        phone TEXT
      )
    `, (err) => { if (err) console.error('Error creating vendors table:', err); else console.log('Vendors table created'); });
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
    `, (err) => { if (err) console.error('Error creating purchase_orders table:', err); else console.log('Purchase_orders table created'); });
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
    `, (err) => { if (err) console.error('Error creating facility_designs table:', err); else console.log('Facility_designs table created'); });
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
    `, (err) => { if (err) console.error('Error creating batches table:', err); else console.log('Batches table created'); });
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
        userId TEXT,
        FOREIGN KEY (siteId) REFERENCES sites(siteId),
        FOREIGN KEY (locationId) REFERENCES locations(locationId)
      )
    `, (err) => { if (err) console.error('Error creating inventory_losses table:', err); else console.log('Inventory_losses table created'); });
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
        keg_codes TEXT,
        FOREIGN KEY (batchId) REFERENCES batches(batchId),
        FOREIGN KEY (locationId) REFERENCES locations(locationId),
        FOREIGN KEY (siteId) REFERENCES sites(siteId)
      )
    `, (err) => { if (err) console.error('Error creating batch_packaging table:', err); else console.log('Batch_packaging table created'); });
    db.run(`
      CREATE TABLE IF NOT EXISTS users (
        email TEXT PRIMARY KEY,
        passwordHash TEXT,
        role TEXT NOT NULL,
        enabled INTEGER NOT NULL DEFAULT 1,
        passkey TEXT
      )
    `, (err) => { if (err) console.error('Error creating users table:', err); else console.log('Users table created'); });
    db.run(`
      CREATE TABLE IF NOT EXISTS batch_actions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        batchId TEXT,
        action TEXT,
        timestamp TEXT,
        FOREIGN KEY (batchId) REFERENCES batches(batchId)
      )
    `, (err) => { if (err) console.error('Error creating batch_actions table:', err); else console.log('Batch_actions table created'); });
    db.run(`
      CREATE TABLE IF NOT EXISTS kegs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        code TEXT NOT NULL UNIQUE,
        status TEXT NOT NULL,
        productId INTEGER,
        lastScanned TEXT,
        locationId INTEGER,
        customerId INTEGER,
        packagingType TEXT,
        FOREIGN KEY (productId) REFERENCES products(id),
        FOREIGN KEY (customerId) REFERENCES customers(customerId),
        FOREIGN KEY (locationId) REFERENCES locations(locationId)
      )
    `, (err) => { if (err) console.error('Error creating kegs table:', err); else console.log('Kegs table created'); });
    db.run(`
      CREATE TABLE IF NOT EXISTS keg_transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        kegId INTEGER NOT NULL,
        action TEXT NOT NULL,
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
    `, (err) => { if (err) console.error('Error creating keg_transactions table:', err); else console.log('Keg_transactions table created'); });

    console.log('Database schema initialized');
  });
};

const insertTestData = async () => {
  db.serialize(async () => {
    console.log('Inserting test data...');

    // Users
    const password = 'P@$$w0rd1234';
    const hash = await bcrypt.hash(password, 10);
    db.run('INSERT OR IGNORE INTO users (email, passwordHash, role, enabled) VALUES (?, ?, ?, ?)',
      ['jtseaton@gmail.com', hash, 'SuperAdmin', 1],
      (err) => { if (err) console.error('Error inserting default user:', err); else console.log('Inserted default Super Admin user'); });

    // Sites
    db.run(`INSERT OR IGNORE INTO sites (siteId, name, type, address) VALUES (?, ?, ?, ?)`,
      ['DSP-AL-20051', 'Athens AL DSP', 'DSP', '311 Marion St, Athens, AL 35611'],
      (err) => { if (err) console.error('Error inserting site DSP-AL-20051:', err); });
    db.run(`INSERT OR IGNORE INTO sites (siteId, name, type, address) VALUES (?, ?, ?, ?)`,
      ['BR-AL-20088', 'Athens Brewery', 'Brewery', '311 Marion St, Athens, AL 35611'],
      (err) => { if (err) console.error('Error inserting site BR-AL-20088:', err); });
    db.run(`INSERT OR IGNORE INTO sites (siteId, name, type, address) VALUES (?, ?, ?, ?)`,
      ['BR-AL-20019', 'Madison Brewery', 'Brewery', '212 Main St Madison, AL 35758'],
      (err) => { if (err) console.error('Error inserting site BR-AL-20019:', err); });
    db.run(`INSERT OR IGNORE INTO sites (siteId, name, type, address) VALUES (?, ?, ?, ?)`,
      ['DSP-AL-20010', 'Madison Distillery', 'DSP', '212 Main St Madison, AL 35758'],
      (err) => { if (err) console.error('Error inserting site DSP-AL-20010:', err); });

    // Locations
    db.run(`INSERT OR IGNORE INTO locations (siteId, name, abbreviation) VALUES (?, ?, ?)`,
      ['DSP-AL-20010', 'Spirits Storage', 'Spirits'],
      (err) => { if (err) console.error('Error inserting location Spirits Storage:', err); });
    db.run(`INSERT OR IGNORE INTO locations (siteId, name, abbreviation) VALUES (?, ?, ?)`,
      ['DSP-AL-20010', 'Grain Storage', null],
      (err) => { if (err) console.error('Error inserting location Grain Storage:', err); });
    db.run(`INSERT OR IGNORE INTO locations (siteId, name, abbreviation) VALUES (?, ?, ?)`,
      ['DSP-AL-20010', 'Fermentation Tanks', null],
      (err) => { if (err) console.error('Error inserting location Fermentation Tanks:', err); });
    db.run(`INSERT OR IGNORE INTO locations (siteId, name, abbreviation) VALUES (?, ?, ?)`,
      ['BR-AL-20019', 'Madison Fermenter 1', null],
      (err) => { if (err) console.error('Error inserting location Madison Fermenter 1:', err); });
    db.run(`INSERT OR IGNORE INTO locations (siteId, name, abbreviation) VALUES (?, ?, ?)`,
      ['BR-AL-20019', 'Madison Outdoor Racks', null],
      (err) => { if (err) console.error('Error inserting location Madison Outdoor Racks:', err); });
    db.run(`INSERT OR IGNORE INTO locations (siteId, name, abbreviation) VALUES (?, ?, ?)`,
      ['BR-AL-20019', 'Madison Fermenter 2', null],
      (err) => { if (err) console.error('Error inserting location Madison Fermenter 2:', err); });
    db.run(`INSERT OR IGNORE INTO locations (siteId, name, abbreviation) VALUES (?, ?, ?)`,
      ['BR-AL-20019', 'Madison Fermenter 3', null],
      (err) => { if (err) console.error('Error inserting location Madison Fermenter 3:', err); });
    db.run(`INSERT OR IGNORE INTO locations (siteId, name, abbreviation) VALUES (?, ?, ?)`,
      ['BR-AL-20019', 'Madison Fermenter 4', null],
      (err) => { if (err) console.error('Error inserting location Madison Fermenter 4:', err); });
    db.run(`INSERT OR IGNORE INTO locations (siteId, name, abbreviation) VALUES (?, ?, ?)`,
      ['BR-AL-20019', 'Madison Cold Storage', 'Beer Cooler'],
      (err) => { if (err) console.error('Error inserting location Madison Cold Storage:', err); });
    db.run(`INSERT OR IGNORE INTO locations (siteId, name, abbreviation) VALUES (?, ?, ?)`,
      ['BR-AL-20019', 'Madison Mash Tun', 'Mash Tun'],
      (err) => { if (err) console.error('Error inserting location Madison Mash Tun:', err); });
    db.run(`INSERT OR IGNORE INTO locations (siteId, name, abbreviation) VALUES (?, ?, ?)`,
      ['BR-AL-20019', 'Madison Boil Kettle', null],
      (err) => { if (err) console.error('Error inserting location Madison Boil Kettle:', err); });
    db.run(`INSERT OR IGNORE INTO locations (siteId, name, abbreviation) VALUES (?, ?, ?)`,
      ['BR-AL-20088', 'Athens Cold Storage', 'Athens Cooler'],
      (err) => { if (err) console.error('Error inserting location Athens Cold Storage:', err); });

    // Equipment
    db.run('INSERT OR IGNORE INTO equipment (name, abbreviation, siteId, enabled, type) VALUES (?, ?, ?, ?, ?)',
      ['Mash Tun', 'MT', 'BR-AL-20019', 1, 'Mash Tun'],
      (err) => { if (err) console.error('Error inserting equipment Mash Tun:', err); });
    db.run('INSERT OR IGNORE INTO equipment (name, abbreviation, siteId, enabled, type) VALUES (?, ?, ?, ?, ?)',
      ['Boil Kettle', 'BK', 'BR-AL-20019', 1, 'Kettle'],
      (err) => { if (err) console.error('Error inserting equipment Boil Kettle:', err); });
    db.run('INSERT OR IGNORE INTO equipment (name, abbreviation, siteId, enabled, type) VALUES (?, ?, ?, ?, ?)',
      ['Fermentation FV1', 'FV1', 'BR-AL-20019', 1, 'Fermenter'],
      (err) => { if (err) console.error('Error inserting equipment Fermentation FV1:', err); });
    db.run('INSERT OR IGNORE INTO equipment (name, abbreviation, siteId, enabled, type) VALUES (?, ?, ?, ?, ?)',
      ['Fermentation FV2', 'FV2', 'BR-AL-20019', 1, 'Fermenter'],
      (err) => { if (err) console.error('Error inserting equipment Fermentation FV2:', err); });
    db.run('INSERT OR IGNORE INTO equipment (name, abbreviation, siteId, enabled, type) VALUES (?, ?, ?, ?, ?)',
      ['Brite Tank', 'BT', 'BR-AL-20019', 1, 'Brite Tank'],
      (err) => { if (err) console.error('Error inserting equipment Brite Tank:', err); });

    // Products
    db.run('INSERT OR IGNORE INTO products (id, name, abbreviation, enabled, priority, class, type, style, abv, ibu) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [1, 'Whiskey', 'WH', 1, 1, 'Distilled', 'Spirits', 'Bourbon', 40, 0],
      (err) => { if (err) console.error('Error inserting product Whiskey:', err); });
    db.run('INSERT OR IGNORE INTO products (id, name, abbreviation, enabled, priority, class, type, style, abv, ibu) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [2, 'Hazy Train IPA', 'IPA', 1, 2, 'Beer', 'Malt', 'American IPA', 6.5, 60],
      (err) => { if (err) console.error('Error inserting product Hazy Train IPA:', err); });
    db.run('INSERT OR IGNORE INTO products (id, name, abbreviation, enabled, priority, class, type, style, abv, ibu) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [3, 'Cave City Lager', 'CCL', 1, 3, 'Beer', 'Malt', 'American Amber Ale', 5.2, 21],
      (err) => { if (err) console.error('Error inserting product Cave City Lager:', err); });

    // Items
    db.run('INSERT OR IGNORE INTO items (name, type, enabled) VALUES (?, ?, ?)',
      ['Finished Goods', 'Finished Goods', 1],
      (err) => { if (err) console.error('Error inserting item Finished Goods:', err); });
    db.run('INSERT OR IGNORE INTO items (name, type, enabled) VALUES (?, ?, ?)',
      ['Corn', 'Grain', 1],
      (err) => { if (err) console.error('Error inserting item Corn:', err); });
    db.run('INSERT OR IGNORE INTO items (name, type, enabled) VALUES (?, ?, ?)',
      ['Hops', 'Hops', 1],
      (err) => { if (err) console.error('Error inserting item Hops:', err); });

    // Inventory
    db.run('INSERT OR IGNORE INTO inventory (identifier, account, type, quantity, unit, receivedDate, source, siteId, locationId, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      ['Flaked Corn', 'Storage', 'Grain', '1000', 'lbs', '2025-04-20', 'Acme Supplies', 'BR-AL-20019', 1, 'Stored'],
      (err) => { if (err) console.error('Error inserting inventory Flaked Corn:', err); });
    db.run('INSERT OR REPLACE INTO inventory (identifier, type, quantity, unit, siteId, type, receivedDate, status, source) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      ['Hops', 'Hops', '550', 'lbs', 'BR-AL-20019', 'Hops', '2025-04-20', 'Stored', 'Acme Supplies'],
      (err) => { if (err) console.error('Error inserting inventory Hops:', err); });
    db.run('INSERT OR IGNORE INTO inventory (identifier, type, quantity, unit, receivedDate, source, siteId, locationId, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      ['Hops Cascade', 'Hops', '50', 'lbs', '2025-04-20', 'Acme Supplies', 'BR-AL-20088', 11, 'Stored'],
      (err) => { if (err) console.error('Error inserting inventory Hops Cascade:', err); });
    db.run('INSERT OR IGNORE INTO inventory (identifier, account, type, quantity, unit, receivedDate, source, siteId, locationId, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      ['Hops Country Malt', 'Storage', 'Hops', '100', 'Pounds', '2025-04-21', 'Country Malt', 'BR-AL-20019', 9, 'Stored'],
      (err) => { if (err) console.error('Error inserting inventory Hops Country Malt:', err); });

    // Recipes
    db.run('INSERT OR IGNORE INTO recipes (id, name, productId, ingredients, quantity, unit) VALUES (?, ?, ?, ?, ?, ?)',
      [1, 'Whiskey Recipe', 1, JSON.stringify([{ itemName: 'Corn', quantity: 100, unit: 'lbs' }]), '100', 'gallons'],
      (err) => { if (err) console.error('Error inserting recipe Whiskey Recipe:', err); });
    db.run('INSERT OR IGNORE INTO recipes (id, name, productId, ingredients, quantity, unit) VALUES (?, ?, ?, ?, ?, ?)',
      [2, 'Hazy Train 20 BBL', 2, JSON.stringify([{ itemName: 'Hops', quantity: 50, unit: 'lbs' }]), '20', 'barrels'],
      (err) => { if (err) console.error('Error inserting recipe Hazy Train 20 BBL:', err); });

    // Batches
    db.run('INSERT OR IGNORE INTO batches (batchId, productId, recipeId, siteId, status, date) VALUES (?, ?, ?, ?, ?, ?)',
      ['BATCH-001', 1, 1, 'BR-AL-20019', 'In Progress', '2025-04-20'],
      (err) => { if (err) console.error('Error inserting batch BATCH-001:', err); });

    // Customers
    db.run('INSERT OR IGNORE INTO customers (name, email) VALUES (?, ?)',
      ['Gulf Distributing', 'jtseaton@gmail.com'],
      (err) => { if (err) console.error('Error inserting customer Gulf Distributing:', err); });

    // Vendors
    db.run('INSERT OR IGNORE INTO vendors (name, type, enabled, address, email, phone) VALUES (?, ?, ?, ?, ?, ?)',
      ['Acme Supplies', 'Supplier', 1, '123 Main St', 'acme@example.com', '555-1234'],
      (err) => { if (err) console.error('Error inserting vendor Acme Supplies:', err); });
    db.run('INSERT OR IGNORE INTO vendors (name, type, enabled, address, email, phone) VALUES (?, ?, ?, ?, ?, ?)',
      ['Country Malt', 'Supplier', 1, '123 Main St', 'acme@example.com', '555-1234'],
      (err) => { if (err) console.error('Error inserting vendor Country Malt:', err); });
    db.run('INSERT OR IGNORE INTO vendors (name, type, enabled, address, email, phone) VALUES (?, ?, ?, ?, ?, ?)',
      ['Yakima Chief', 'Supplier', 1, '123 Main St', 'acme@example.com', '555-1234'],
      (err) => { if (err) console.error('Error inserting vendor Yakima Chief:', err); });
    db.run('INSERT OR IGNORE INTO vendors (name, type, enabled, address, email, phone) VALUES (?, ?, ?, ?, ?, ?)',
      ['Pharmco Aaper', 'Supplier', 1, '123 Main St', 'acme@example.com', '555-1234'],
      (err) => { if (err) console.error('Error inserting vendor Pharmco Aaper:', err); });

    // Packaging Types for Hazy Train
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

    // Batch HT321654
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

    // Kegs EK10000 to EK10050
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
          `INSERT OR IGNORE INTO kegs (code, status, lastScanned, locationId) VALUES (?, ?, ?, ?)`,
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

module.exports = { db, initializeDatabase, insertTestData, OUR_DSP };