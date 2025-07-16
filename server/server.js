const express = require('express');
const cors = require('cors');
const path = require('path');
const jwt = require('jsonwebtoken');
const { initializeDatabase, insertTestData } = require('./services/database');
const { loadPackageTypesFromXML, loadItemsFromXML } = require('./services/xml-parser');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../client/build')));

// JWT Authentication Middleware
const authenticate = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    console.error('Authentication failed: No token provided', { path: req.path });
    return res.status(401).json({ error: 'Unauthorized: No token provided' });
  }
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    req.user = decoded;
    next();
  } catch (err) {
    console.error('Authentication failed: Invalid token', { path: req.path, error: err.message });
    return res.status(401).json({ error: 'Unauthorized: Invalid token' });
  }
};

// Mount routes (login and static routes are unprotected)
app.use('/api/users', require('./routes/users')); // /api/login is handled in users.js without auth
app.use('/api/customers', authenticate, require('./routes/customers'));
app.use('/api/sales-orders', authenticate, require('./routes/sales-orders'));
app.use('/api/invoices', authenticate, require('./routes/invoices'));
app.use('/api/products', authenticate, require('./routes/products'));
app.use('/api/batches', authenticate, require('./routes/batches'));
app.use('/api/recipes', authenticate, require('./routes/recipes'));
app.use('/api/items', authenticate, require('./routes/items'));
app.use('/api/vendors', authenticate, require('./routes/vendors'));
app.use('/api/purchase-orders', authenticate, require('./routes/purchase-orders'));
app.use('/api/inventory', authenticate, require('./routes/inventory'));
app.use('/api/equipment', authenticate, require('./routes/equipment'));
app.use('/api/sites', authenticate, require('./routes/sites'));
app.use('/api/locations', authenticate, require('./routes/locations'));
app.use('/api/facility-design', authenticate, require('./routes/facility-design'));
app.use('/api/reports', authenticate, require('./routes/reports'));
app.use('/api/kegs', authenticate, require('./routes/kegs'));
app.use('/api/production', authenticate, require('./routes/production'));

// Static file route
app.get('/styles.xml', (req, res) => {
  const filePath = path.join(__dirname, '../config/styles.xml');
  console.log('Serving styles.xml from:', filePath);
  res.sendFile(filePath, (err) => {
    if (err) {
      console.error('Error serving styles.xml:', err);
      res.status(404).json({ error: 'styles.xml not found' });
    }
  });
});

// Catch-all route for frontend
app.get('*', (req, res) => res.sendFile(path.join(__dirname, '../client/build/index.html')));

// Initialize database and load data
loadPackageTypesFromXML().then(() => {
  loadItemsFromXML();
  initializeDatabase();
  insertTestData();
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});