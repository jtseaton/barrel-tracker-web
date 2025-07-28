const express = require('express');
const bcrypt = require('bcrypt');
const { db } = require('../services/database');

const router = express.Router();

// Debug all requests to usersRouter
router.use((req, res, next) => {
  console.log(`usersRouter handling: ${req.method} ${req.url} (original: ${req.originalUrl})`, { body: req.body });
  next();
});

router.get('/', (req, res) => {
  console.log('Handling GET /api/users', { user: req.user });
  if (!req.user || !['SuperAdmin', 'Admin'].includes(req.user.role)) {
    console.error('GET /api/users: Unauthorized', { user: req.user });
    return res.status(403).json({ error: 'Unauthorized' });
  }
  db.all('SELECT email, role, enabled FROM users', (err, rows) => {
    if (err) {
      console.error('GET /api/users: Database error:', err);
      return res.status(500).json({ error: err.message });
    }
    console.log('GET /api/users: Success', { count: rows.length, data: rows });
    res.json(rows);
  });
});

router.post('/', async (req, res) => {
  const { email, password, role } = req.body;
  if (!email || !password || !role) {
    console.error('POST /api/users: Missing required fields', { email, role });
    return res.status(400).json({ error: 'Email, password, and role are required' });
  }
  if (!['SuperAdmin', 'Admin', 'User'].includes(role)) {
    console.error('POST /api/users: Invalid role', { role });
    return res.status(400).json({ error: 'Invalid role' });
  }
  try {
    const passwordHash = await bcrypt.hash(password, 10);
    db.run(
      'INSERT INTO users (email, passwordHash, role, enabled) VALUES (?, ?, ?, ?)',
      [email, passwordHash, role, 1],
      function (err) {
        if (err) {
          console.error('POST /api/users: Insert error:', err);
          return res.status(500).json({ error: err.message });
        }
        console.log('POST /api/users: Success', { email, role });
        res.json({ id: this.lastID, email, role });
      }
    );
  } catch (err) {
    console.error('POST /api/users: Hash error:', err);
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