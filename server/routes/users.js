const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { db } = require('../services/database');

const router = express.Router();

// Login (unprotected)
router.post('/login', async (req, res) => {
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
      const token = jwt.sign({ email: user.email, role: user.role }, process.env.JWT_SECRET || 'your-secret-key', { expiresIn: '1h' });
      console.log('POST /api/login: Authenticated', { email, role: user.role });
      res.json({ email: user.email, role: user.role, token });
    });
  } catch (err) {
    console.error('POST /api/login: Error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Protected routes
router.get('/', (req, res) => {
  db.all('SELECT email, role, enabled, passkey FROM users', (err, rows) => {
    if (err) {
      console.error('GET /api/users: Fetch users error:', err);
      return res.status(500).json({ error: err.message });
    }
    console.log('GET /api/users: Returning', rows);
    res.json(rows);
  });
});

router.post('/', async (req, res) => {
  const { email, password, role } = req.body;
  if (!email || !password || !role || !['SuperAdmin', 'Admin', 'Sales', 'Production'].includes(role)) {
    console.log('POST /api/users: Invalid fields', req.body);
    return res.status(400).json({ error: 'Email, password, and valid role are required' });
  }
  try {
    db.get('SELECT email FROM users WHERE email = ?', [email], async (err, existing) => {
      if (err) {
        console.error('POST /api/users: Check existing user error:', err);
        return res.status(500).json({ error: err.message });
      }
      if (existing) {
        console.log('POST /api/users: Email already exists', { email });
        return res.status(400).json({ error: 'Email already exists' });
      }
      const hash = await bcrypt.hash(password, 10);
      db.run(
        'INSERT INTO users (email, passwordHash, role, enabled) VALUES (?, ?, ?, ?)',
        [email, hash, role, 1],
        function(err) {
          if (err) {
            console.error('POST /api/users: Insert error:', err);
            return res.status(500).json({ error: err.message });
          }
          console.log('POST /api/users: Added', { email, role });
          res.json({ email, role, enabled: 1, passkey: null });
        }
      );
    });
  } catch (err) {
    console.error('POST /api/users: Error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/', (req, res) => {
  const { emails } = req.body;
  if (!Array.isArray(emails) || emails.length === 0) {
    console.error('DELETE /api/users: Invalid emails array', emails);
    return res.status(400).json({ error: 'Array of emails required' });
  }
  const placeholders = emails.map(() => '?').join(',');
  db.run(`DELETE FROM users WHERE email IN (${placeholders})`, emails, (err) => {
    if (err) {
      console.error('DELETE /api/users: Delete error:', err);
      return res.status(500).json({ error: err.message });
    }
    console.log('DELETE /api/users: Deleted', emails);
    res.json({ message: 'Users deleted' });
  });
});

router.patch('/', (req, res) => {
  const { emails, enabled } = req.body;
  if (!Array.isArray(emails) || emails.length === 0 || typeof enabled !== 'boolean') {
    console.error('PATCH /api/users: Invalid input', { emails, enabled });
    return res.status(400).json({ error: 'Array of emails and enabled boolean required' });
  }
  const placeholders = emails.map(() => '?').join(',');
  db.run(`UPDATE users SET enabled = ? WHERE email IN (${placeholders})`, [enabled ? 1 : 0, ...emails], (err) => {
    if (err) {
      console.error('PATCH /api/users: Update error:', err);
      return res.status(500).json({ error: err.message });
    }
    console.log('PATCH /api/users: Updated', { emails, enabled });
    res.json({ message: 'Users updated' });
  });
});

module.exports = router;