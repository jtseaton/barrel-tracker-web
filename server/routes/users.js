const express = require('express');
const bcrypt = require('bcrypt');
const { db } = require('../services/database');

const router = express.Router();

// Debug all requests to usersRouter
router.use((req, res, next) => {
  console.log(`usersRouter handling: ${req.method} ${req.url} (original: ${req.originalUrl})`, { body: req.body });
  next();
});

// Protected routes
router.get('/', (req, res) => {
  console.log('Handling GET /api/users in users.js');
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
  console.log('Handling POST /api/users/ in users.js', { body: req.body });
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
  console.log('Handling DELETE /api/users in users.js', { body: req.body });
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
  console.log('Handling PATCH /api/users in users.js', { body: req.body });
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