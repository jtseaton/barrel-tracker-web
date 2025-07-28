const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const path = require('path');
const dotenv = require('dotenv');
const bcrypt = require('bcrypt');
const { db, initializeDatabase, insertTestData } = require('./services/database');

dotenv.config({ path: path.join(__dirname, '../.env') });

if (!process.env.JWT_SECRET) {
  console.error('FATAL: JWT_SECRET is not defined in .env');
  process.exit(1);
}

console.log('JWT_SECRET loaded:', process.env.JWT_SECRET);

const app = express();

app.use(cors({
  origin: process.env.NODE_ENV === 'production' ? 'https://tilly.onrender.com' : 'http://localhost:10001',
  credentials: true,
}));
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
    console.log('authenticateJWT: Verifying token', { token: token.substring(0, 10) + '...' });
    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
      if (err) {
        console.error('JWT Verification Error:', { error: err.message, stack: err.stack });
        return res.status(403).json({ error: 'Invalid or expired token' });
      }
      console.log('JWT Verified:', { user });
      req.user = user;
      next();
    });
  } else {
    console.error('Authentication failed: No token provided', { path: req.path });
    res.status(401).json({ error: 'No token provided' });
  }
};

// Direct login route
app.post('/api/login', async (req, res) => {
  console.log('Directly handling POST /api/login in server.js', { body: req.body });
  const { email, password } = req.body;
  if (!email || !password) {
    console.error('POST /api/login: Missing required fields', { email });
    return res.status(400).json({ error: 'Email and password required' });
  }
  try {
    db.get('SELECT email, passwordHash, role, enabled FROM users WHERE email = ? AND enabled = 1', [email], async (err, user) => {
      if (err) {
        console.error('POST /api/login: Database error:', err);
        return res.status(500).json({ error: err.message });
      }
      if (!user) {
        console.error('POST /api/login: Invalid email or disabled user', { email });
        return res.status(401).json({ error: 'Invalid email or disabled user' });
      }
      const match = await bcrypt.compare(password, user.passwordHash);
      if (!match) {
        console.error('POST /api/login: Invalid password', { email });
        return res.status(401).json({ error: 'Invalid password' });
      }
      const token = jwt.sign({ email: user.email, role: user.role }, process.env.JWT_SECRET, { expiresIn: '1h' });
      console.log('POST /api/login: Authenticated', { email, role: user.role });
      res.json({ token, user: { email: user.email, role: user.role } });
    });
  } catch (err) {
    console.error('POST /api/login: Error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

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

app.post('/api/login/test', (req, res) => {
  console.log('Test route hit: POST /api/login/test', { body: req.body });
  res.json({ message: 'Test route for /api/login', body: req.body });
});

app.get('/api/debug/tables', (req, res) => {
  db.all("SELECT name FROM sqlite_master WHERE type='table'", (err, tables) => {
    if (err) {
      console.error('Debug tables error:', err);
      return res.status(500).json({ error: err.message });
    }
    console.log('Database tables:', tables);
    res.json(tables);
  });
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

initializeDatabase();
insertTestData();

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});