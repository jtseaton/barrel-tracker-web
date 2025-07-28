// server/routes/reports.js
const express = require('express');
const { db } = require('../services/database');

const router = express.Router();

router.get('/production', (req, res) => {
  const { startDate, endDate, siteId } = req.query;
  let query = `
    SELECT b.batchId, b.productId, p.name AS productName, b.recipeId, r.name AS recipeName, 
           b.siteId, s.name AS siteName, b.status, b.date, b.volume
    FROM batches b
    JOIN products p ON b.productId = p.id
    JOIN recipes r ON b.recipeId = r.id
    JOIN sites s ON b.siteId = s.siteId
    WHERE 1=1
  `;
  const params = [];
  if (startDate) {
    query += ' AND b.date >= ?';
    params.push(startDate);
  }
  if (endDate) {
    query += ' AND b.date <= ?';
    params.push(endDate);
  }
  if (siteId) {
    query += ' AND b.siteId = ?';
    params.push(siteId);
  }
  db.all(query, params, (err, rows) => {
    if (err) {
      console.error('GET /api/reports/production: Fetch error:', err);
      return res.status(500).json({ error: err.message });
    }
    console.log('GET /api/reports/production: Success', { count: rows.length });
    res.json(rows);
  });
});

router.get('/inventory', (req, res) => {
  const { siteId, type, locationId } = req.query;
  let query = 'SELECT * FROM inventory WHERE 1=1';
  const params = [];
  if (siteId) {
    query += ' AND siteId = ?';
    params.push(siteId);
  }
  if (type) {
    query += ' AND type = ?';
    params.push(type);
  }
  if (locationId) {
    query += ' AND locationId = ?';
    params.push(locationId);
  }
  db.all(query, params, (err, rows) => {
    if (err) {
      console.error('GET /api/reports/inventory: Fetch error:', err);
      return res.status(500).json({ error: err.message });
    }
    console.log('GET /api/reports/inventory: Success', { count: rows.length });
    res.json(rows);
  });
});

router.get('/sales', (req, res) => {
  const { startDate, endDate, customerId } = req.query;
  let query = `
    SELECT i.*, c.name AS customerName
    FROM invoices i
    JOIN customers c ON i.customerId = c.customerId
    WHERE i.status = 'Posted'
  `;
  const params = [];
  if (startDate) {
    query += ' AND i.postedDate >= ?';
    params.push(startDate);
  }
  if (endDate) {
    query += ' AND i.postedDate <= ?';
    params.push(endDate);
  }
  if (customerId) {
    query += ' AND i.customerId = ?';
    params.push(customerId);
  }
  db.all(query, params, (err, rows) => {
    if (err) {
      console.error('GET /api/reports/sales: Fetch error:', err);
      return res.status(500).json({ error: err.message });
    }
    console.log('GET /api/reports/sales: Success', { count: rows.length });
    res.json(rows);
  });
});

router.get('/daily-summary', (req, res) => {
  console.log('Handling GET /api/reports/daily-summary', { query: req.query, user: req.user });
  const { siteId, date } = req.query;
  let query = `
    SELECT 
      i.receivedDate AS date,
      i.account,
      i.type,
      SUM(i.quantity) AS totalProofGallons,
      i.locationId
    FROM inventory i
    WHERE i.status IN ('Received', 'Stored')
  `;
  const params = [];
  if (siteId) {
    query += ' AND i.siteId = ?';
    params.push(siteId);
  }
  if (date) {
    query += ' AND i.receivedDate = ?';
    params.push(date);
  }
  query += ' GROUP BY i.receivedDate, i.account, i.type, i.locationId';
  db.all(query, params, (err, rows) => {
    if (err) {
      console.error('GET /api/reports/daily-summary: Fetch error:', err);
      return res.status(500).json({ error: err.message });
    }
    console.log('GET /api/reports/daily-summary: Success', { count: rows.length, data: rows });
    res.json(rows);
  });
});

module.exports = router;