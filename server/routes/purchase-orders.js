const express = require('express');
const { db } = require('../../services/database');
const { transporter } = require('../../services/email');

const router = express.Router();

router.get('/', (req, res) => {
  const { page = 1, limit = 10 } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);
  db.get('SELECT COUNT(*) as total FROM purchase_orders WHERE status != ?', ['Cancelled'], (err, countResult) => {
    if (err) {
      console.error('GET /api/purchase-orders: Count error:', err);
      return res.status(500).json({ error: err.message });
    }
    const totalPOs = countResult.total;
    const totalPages = Math.ceil(totalPOs / parseInt(limit));
    db.all(
      `SELECT * FROM purchase_orders WHERE status != ? LIMIT ? OFFSET ?`,
      ['Cancelled', parseInt(limit), offset],
      (err, rows) => {
        if (err) {
          console.error('GET /api/purchase-orders: Fetch error:', err);
          return res.status(500).json({ error: err.message });
        }
        console.log('GET /api/purchase-orders: Success', { count: rows.length, page, limit, totalPages });
        res.json({ purchaseOrders: rows.map(row => ({ ...row, items: JSON.parse(row.items || '[]') })), totalPages });
      }
    );
  });
});

router.get('/:poNumber', (req, res) => {
  const { poNumber } = req.params;
  db.get('SELECT * FROM purchase_orders WHERE poNumber = ?', [poNumber], (err, row) => {
    if (err) {
      console.error('GET /api/purchase-orders/:poNumber: Fetch error:', err);
      return res.status(500).json({ error: err.message });
    }
    if (!row) {
      console.error('GET /api/purchase-orders/:poNumber: Not found', { poNumber });
      return res.status(404).json({ error: 'Purchase order not found' });
    }
    console.log('GET /api/purchase-orders/:poNumber: Success', { poNumber });
    res.json({ ...row, items: JSON.parse(row.items || '[]') });
  });
});

router.post('/', (req, res) => {
  const { poNumber, site, poDate, supplier, supplierAddress, supplierCity, supplierState, supplierZip, comments, shipToName, shipToAddress, shipToCity, shipToState, shipToZip, items } = req.body;
  if (!poNumber || !site || !supplier || !Array.isArray(items) || items.length === 0) {
    console.error('POST /api/purchase-orders: Missing required fields', { poNumber, site, supplier, items });
    return res.status(400).json({ error: 'poNumber, site, supplier, and non-empty items array are required' });
  }
  db.run(
    `INSERT INTO purchase_orders (poNumber, site, poDate, supplier, supplierAddress, supplierCity, supplierState, supplierZip, comments, shipToName, shipToAddress, shipToCity, shipToState, shipToZip, status, items)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      poNumber,
      site,
      poDate || new Date().toISOString().split('T')[0],
      supplier,
      supplierAddress || null,
      supplierCity || null,
      supplierState || null,
      supplierZip || null,
      comments || null,
      shipToName || null,
      shipToAddress || null,
      shipToCity || null,
      shipToState || null,
      shipToZip || null,
      'Open',
      JSON.stringify(items),
    ],
    function(err) {
      if (err) {
        console.error('POST /api/purchase-orders: Insert error:', err);
        return res.status(500).json({ error: err.message });
      }
      console.log('POST /api/purchase-orders: Success', { poNumber });
      res.json({ poNumber, site, poDate, supplier, items });
    }
  );
});

router.patch('/:poNumber', (req, res) => {
  const { poNumber } = req.params;
  const { site, poDate, supplier, supplierAddress, supplierCity, supplierState, supplierZip, comments, shipToName, shipToAddress, shipToCity, shipToState, shipToZip, items, status } = req.body;
  if (!site || !supplier || !Array.isArray(items) || items.length === 0) {
    console.error('PATCH /api/purchase-orders/:poNumber: Missing required fields', { site, supplier, items });
    return res.status(400).json({ error: 'site, supplier, and non-empty items array are required' });
  }
  db.get('SELECT * FROM purchase_orders WHERE poNumber = ?', [poNumber], (err, po) => {
    if (err) {
      console.error('PATCH /api/purchase-orders/:poNumber: Fetch error:', err);
      return res.status(500).json({ error: err.message });
    }
    if (!po) {
      console.error('PATCH /api/purchase-orders/:poNumber: Not found', { poNumber });
      return res.status(404).json({ error: 'Purchase order not found' });
    }
    db.run(
      `UPDATE purchase_orders SET site = ?, poDate = ?, supplier = ?, supplierAddress = ?, supplierCity = ?, supplierState = ?, supplierZip = ?, comments = ?, shipToName = ?, shipToAddress = ?, shipToCity = ?, shipToState = ?, shipToZip = ?, status = ?, items = ? WHERE poNumber = ?`,
      [
        site,
        poDate || po.poDate,
        supplier,
        supplierAddress || null,
        supplierCity || null,
        supplierState || null,
        supplierZip || null,
        comments || null,
        shipToName || null,
        shipToAddress || null,
        shipToCity || null,
        shipToState || null,
        shipToZip || null,
        status || po.status,
        JSON.stringify(items),
        poNumber,
      ],
      (err) => {
        if (err) {
          console.error('PATCH /api/purchase-orders/:poNumber: Update error:', err);
          return res.status(500).json({ error: err.message });
        }
        console.log('PATCH /api/purchase-orders/:poNumber: Success', { poNumber });
        res.json({ poNumber, site, poDate, supplier, items });
      }
    );
  });
});

router.post('/:poNumber/email', (req, res) => {
  const { poNumber } = req.params;
  db.get('SELECT * FROM purchase_orders WHERE poNumber = ?', [poNumber], (err, po) => {
    if (err) {
      console.error('POST /api/purchase-orders/:poNumber/email: Fetch error:', err);
      return res.status(500).json({ error: err.message });
    }
    if (!po) {
      console.error('POST /api/purchase-orders/:poNumber/email: Not found', { poNumber });
      return res.status(404).json({ error: 'Purchase order not found' });
    }
    db.get('SELECT email FROM vendors WHERE name = ?', [po.supplier], (err, vendor) => {
      if (err) {
        console.error('POST /api/purchase-orders/:poNumber/email: Fetch vendor error:', err);
        return res.status(500).json({ error: err.message });
      }
      if (!vendor || !vendor.email) {
        console.error('POST /api/purchase-orders/:poNumber/email: Vendor email not found', { supplier: po.supplier });
        return res.status(400).json({ error: 'Vendor email not found' });
      }
      const items = JSON.parse(po.items || '[]');
      const mailOptions = {
        from: process.env.EMAIL_USER,
        to: vendor.email,
        subject: `Purchase Order ${poNumber} from Dothan Brewpub`,
        text: `Purchase Order: ${poNumber}\nSupplier: ${po.supplier}\nItems:\n${items.map(item => `- ${item.quantity} ${item.unit} ${item.itemName}`).join('\n')}`,
      };
      transporter.sendMail(mailOptions, (err, info) => {
        if (err) {
          console.error('POST /api/purchase-orders/:poNumber/email: Send email error:', err);
          return res.status(500).json({ error: 'Failed to send email: ' + err.message });
        }
        console.log('POST /api/purchase-orders/:poNumber/email: Success', { poNumber, info });
        res.json({ message: 'Email sent successfully' });
      });
    });
  });
});

module.exports = router;