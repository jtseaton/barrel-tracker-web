const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '../.env') });

const app = express();

app.use(cors());
app.use(express.json());

// Log all incoming requests
app.use((req, res, next) => {
  console.log(`Incoming request: ${req.method} ${req.url} (original: ${req.originalUrl})`, {
    body: req.body,
    headers: req.headers,
    timestamp: new Date().toISOString(),
  });
  next();
});

const authenticateJWT = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (authHeader) {
    const token = authHeader.split(' ')[1];
    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
      if (err) {
        console.error('JWT Verification Error:', { error: err.message, stack: err.stack });
        return res.status(403).json({ error: 'Invalid or expired token' });
      }
      req.user = user;
      next();
    });
  } else {
    console.error('Authentication failed: No token provided', { path: req.path });
    res.status(401).json({ error: 'No token provided' });
  }
};

const usersRouter = require('./routes/users');
const customersRouter = require('./routes/customers');
const salesOrdersRouter = require('./routes/sales-orders');
const invoicesRouter = require('./routes/invoices');
const productsRouter = require('./routes/products');
const batchesRouter = require('./routes/batches');
const recipesRouter = require('./routes/recipes');
const itemsRouter = require('./routes/items');
const vendorsRouter = require('./routes/vendors');
const purchaseOrdersRouter = require('./routes/purchase-orders');
const inventoryRouter = require('./routes/inventory');
const equipmentRouter = require('./routes/equipment');
const sitesRouter = require('./routes/sites');
const locationsRouter = require('./routes/locations');
const facilityDesignRouter = require('./routes/facility-design');
const reportsRouter = require('./routes/reports');
const kegsRouter = require('./routes/kegs');
const productionRouter = require('./routes/production');

app.use('/api/login', (req, res, next) => {
  console.log(`Routing to /api/login: ${req.method} ${req.url} (original: ${req.originalUrl})`, { body: req.body });
  next();
}, usersRouter);
app.use('/api/users', (req, res, next) => {
  console.log(`Routing to /api/users: ${req.method} ${req.url} (original: ${req.originalUrl})`, { body: req.body });
  authenticateJWT(req, res, next);
}, usersRouter);
app.use('/api/customers', authenticateJWT, customersRouter);
app.use('/api/sales-orders', authenticateJWT, salesOrdersRouter);
app.use('/api/invoices', authenticateJWT, invoicesRouter);
app.use('/api/products', authenticateJWT, productsRouter);
app.use('/api/batches', authenticateJWT, batchesRouter);
app.use('/api/recipes', authenticateJWT, recipesRouter);
app.use('/api/items', authenticateJWT, itemsRouter);
app.use('/api/vendors', authenticateJWT, vendorsRouter);
app.use('/api/purchase-orders', authenticateJWT, purchaseOrdersRouter);
app.use('/api/inventory', authenticateJWT, inventoryRouter);
app.use('/api/equipment', authenticateJWT, equipmentRouter);
app.use('/api/sites', authenticateJWT, sitesRouter);
app.use('/api/locations', authenticateJWT, locationsRouter);
app.use('/api/facility-design', authenticateJWT, facilityDesignRouter);
app.use('/api/reports', authenticateJWT, reportsRouter);
app.use('/api/kegs', authenticateJWT, kegsRouter);
app.use('/api/production', authenticateJWT, productionRouter);

// Test route to verify /api/login
app.post('/api/login/test', (req, res) => {
  console.log('Test route hit: POST /api/login/test', { body: req.body });
  res.json({ message: 'Test route for /api/login', body: req.body });
});

app.use(express.static(path.join(__dirname, '../client/build'), {
  setHeaders: (res, path) => {
    if (process.env.NODE_ENV === 'development') {
      res.set('Cache-Control', 'no-store');
    }
  },
}));
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/build/index.html'), (err) => {
    if (err) {
      console.error('Error serving index.html:', { error: err.message, stack: err.stack });
      res.status(500).json({ error: 'Failed to serve frontend' });
    }
  });
});

app.use((err, req, res, next) => {
  console.error('Server Error:', { error: err.message, stack: err.stack });
  res.status(500).json({ error: 'Internal server error: ' + err.message });
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});