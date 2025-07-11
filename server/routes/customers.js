const express = require('express');
const { db } = require('../../services/database');

const router = express.Router();

router.post('/', (req, res) => {
  const { name, email, address, phone, contactPerson, licenseNumber, notes, enabled } = req.body;
  if (!name || !email) {
    console.error('POST /api/customers: Missing required fields', { name, email });
    return res.status(400).json({ error: 'Name and email are required' });
  }
  const createdDate = new Date().toISOString().split('T')[0];
  db.run(
    `INSERT INTO customers (name, email, address, phone, contactPerson, licenseNumber, notes, enabled, createdDate, updatedDate)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      name,
      email,
      address || null,
      phone || null,
      contactPerson || null,
      licenseNumber || null,
      notes || null,
      enabled !== undefined ? enabled : 1,
      createdDate,
      createdDate,
    ],
    function (err) {
      if (err) {
        console.error('POST /api/customers: Insert error:', err);
        return res.status(500).json({ error: err.message });
      }
      db.get('SELECT * FROM customers WHERE customerId = ?', [this.lastID], (err, customer) => {
        if (err) {
          console.error('POST /api/customers: Fetch new customer error:', err);
          return res.status(500).json({ error: err.message });
        }
        console.log('POST /api/customers: Created', customer);
        res.json(customer);
      });
    }
  );
});

router.get('/', (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  db.all('SELECT * FROM customers WHERE enabled = 1', (err, rows) => {
    if (err) {
      console.error('GET /api/customers: Database error:', err);
      return res.status(500).json({ error: 'Failed to fetch customers: ' + err.message });
    }
    console.log('GET /api/customers: Returning', rows);
    res.json(rows);
  });
});

router.get('/:id', (req, res) => {
  const { id } = req.params;
  db.get('SELECT * FROM customers WHERE customerId = ?', [id], (err, row) => {
    if (err) {
      console.error('GET /api/customers/:id: Database error:', err);
      return res.status(500).json({ error: err.message });
    }
    if (!row) {
      console.log(`GET /api/customers/${id}: Customer not found`);
      return res.status(404).json({ error: 'Customer not found' });
    }
    console.log('GET /api/customers/:id: Returning', row);
    res.json(row);
  });
});

router.patch('/:id', (req, res) => {
  const { id } = req.params;
  const { name, email, address, phone, contactPerson, licenseNumber, notes, enabled } = req.body;
  if (!name || !email) {
    console.error('PATCH /api/customers/:id: Missing required fields', { name, email });
    return res.status(400).json({ error: 'Name and email are required' });
  }
  const updatedDate = new Date().toISOString().split('T')[0];
  db.run(
    `UPDATE customers SET name = ?, email = ?, address = ?, phone = ?, contactPerson = ?, 
     licenseNumber = ?, notes = ?, enabled = ?, updatedDate = ? WHERE customerId = ?`,
    [
      name,
      email,
      address || null,
      phone || null,
      contactPerson || null,
      licenseNumber || null,
      notes || null,
      enabled !== undefined ? enabled : 1,
      updatedDate,
      id,
    ],
    function (err) {
      if (err) {
        console.error('PATCH /api/customers/:id: Update error:', err);
        return res.status(500).json({ error: err.message });
      }
      if (this.changes === 0) {
        console.log(`PATCH /api/customers/${id}: Customer not found`);
        return res.status(404).json({ error: 'Customer not found' });
      }
      db.get('SELECT * FROM customers WHERE customerId = ?', [id], (err, row) => {
        if (err) {
          console.error('PATCH /api/customers/:id: Fetch updated customer error:', err);
          return res.status(500).json({ error: err.message });
        }
        console.log('PATCH /api/customers/:id: Updated', row);
        res.json(row);
      });
    }
  );
});

router.delete('/:id', (req, res) => {
  const { id } = req.params;
  db.run('DELETE FROM customers WHERE customerId = ?', [id], function (err) {
    if (err) {
      console.error('DELETE /api/customers/:id: Delete error:', err);
      return res.status(500).json({ error: err.message });
    }
    if (this.changes === 0) {
      console.log(`DELETE /api/customers/${id}: Customer not found`);
      return res.status(404).json({ error: 'Customer not found' });
    }
    console.log(`DELETE /api/customers/${id}: Customer deleted`);
    res.status(204).send();
  });
});

module.exports = router;