const express = require('express');
const { db } = require('../services/database');
const { transporter } = require('../services/email');

const router = express.Router();

router.get('/', (req, res) => {
  const { page = 1, limit = 10 } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);
  db.get('SELECT COUNT(*) as total FROM invoices WHERE status != ?', ['Cancelled'], (err, countResult) => {
    if (err) {
      console.error('GET /api/invoices: Count error:', err);
      return res.status(500).json({ error: err.message });
    }
    const totalInvoices = countResult.total;
    const totalPages = Math.ceil(totalInvoices / parseInt(limit));
    db.all(
      `SELECT i.*, c.name AS customerName
       FROM invoices i
       JOIN customers c ON i.customerId = c.customerId
       WHERE i.status != ?
       LIMIT ? OFFSET ?`,
      ['Cancelled', parseInt(limit), offset],
      (err, rows) => {
        if (err) {
          console.error('GET /api/invoices: Fetch error:', err);
          return res.status(500).json({ error: err.message });
        }
        console.log('GET /api/invoices: Success', { count: rows.length, page, limit, totalPages });
        res.json({ invoices: rows, totalPages });
      }
    );
  });
});

router.get('/:invoiceId', (req, res) => {
  const { invoiceId } = req.params;
  console.log('GET /api/invoices/:invoiceId: Received request', { invoiceId });
  db.get(
    `SELECT i.*, c.name AS customerName, c.email AS customerEmail
     FROM invoices i
     JOIN customers c ON i.customerId = c.customerId
     WHERE i.invoiceId = ?`,
    [invoiceId],
    (err, invoice) => {
      if (err) {
        console.error('GET /api/invoices/:invoiceId: Fetch invoice error:', err);
        return res.status(500).json({ error: err.message });
      }
      if (!invoice) {
        console.error('GET /api/invoices/:invoiceId: Invoice not found', { invoiceId });
        return res.status(404).json({ error: 'Invoice not found' });
      }
      db.all(
        'SELECT id, itemName, quantity, unit, price, hasKegDeposit, kegCodes FROM invoice_items WHERE invoiceId = ? AND itemName != ?',
        [invoiceId, 'Keg Deposit'],
        (err, items) => {
          if (err) {
            console.error('GET /api/invoices/:invoiceId: Fetch items error:', err);
            return res.status(500).json({ error: err.message });
          }
          db.get('SELECT value FROM system_settings WHERE key = ?', ['keg_deposit_price'], (err, setting) => {
            if (err) {
              console.error('GET /api/invoices/:invoiceId: Fetch keg_deposit_price error:', err);
              return res.status(500).json({ error: err.message });
            }
            if (!setting) {
              console.error('GET /api/invoices/:invoiceId: Keg deposit price not set in system_settings');
              return res.status(500).json({ error: 'Keg deposit price not configured' });
            }
            const kegDepositPrice = parseFloat(setting.value);
            let subtotal = 0;
            let kegDepositTotal = 0;
            const enhancedItems = items.map(item => {
              const itemPrice = parseFloat(item.price || 0);
              subtotal += itemPrice * item.quantity;
              const kegDeposit = item.hasKegDeposit
                ? {
                    itemName: 'Keg Deposit',
                    quantity: item.quantity,
                    unit: 'Units',
                    price: kegDepositPrice.toFixed(2),
                    hasKegDeposit: 0,
                    isSubCharge: true
                  }
                : null;
              if (kegDeposit) {
                kegDepositTotal += kegDeposit.quantity * kegDepositPrice;
              }
              return { ...item, kegDeposit, kegCodes: item.kegCodes ? JSON.parse(item.kegCodes) : null };
            });
            invoice.items = enhancedItems;
            invoice.subtotal = subtotal.toFixed(2);
            invoice.keg_deposit_total = kegDepositTotal.toFixed(2);
            invoice.total = (subtotal + kegDepositTotal).toFixed(2);
            invoice.keg_deposit_price = kegDepositPrice.toFixed(2);
            console.log('GET /api/invoices/:invoiceId: Success', {
              invoiceId,
              total: invoice.total,
              subtotal: invoice.subtotal,
              keg_deposit_total: invoice.keg_deposit_total,
              itemCount: invoice.items.length,
            });
            res.json(invoice);
          });
        }
      );
    }
  );
});

router.patch('/:invoiceId', (req, res) => {
  const { invoiceId } = req.params;
  const { items } = req.body;
  console.log('PATCH /api/invoices/:invoiceId: Received request', { invoiceId, items });

  if (!items || !Array.isArray(items) || items.length === 0) {
    console.error('PATCH /api/invoices/:invoiceId: Missing or invalid items', { items });
    return res.status(400).json({ error: 'Items are required and must be a non-empty array' });
  }

  db.get('SELECT * FROM invoices WHERE invoiceId = ? AND status = ?', [invoiceId, 'Draft'], (err, invoice) => {
    if (err) {
      console.error('PATCH /api/invoices/:invoiceId: Fetch invoice error:', err);
      return res.status(500).json({ error: err.message });
    }
    if (!invoice) {
      console.error('PATCH /api/invoices/:invoiceId: Invoice not found or not in Draft', { invoiceId });
      return res.status(404).json({ error: 'Invoice not found or not in Draft status' });
    }

    db.get('SELECT value FROM system_settings WHERE key = ?', ['keg_deposit_price'], (err, setting) => {
      if (err) {
        console.error('PATCH /api/invoices/:invoiceId: Fetch keg_deposit_price error:', err);
        return res.status(500).json({ error: err.message });
      }
      if (!setting) {
        console.error('PATCH /api/invoices/:invoiceId: Keg deposit price not set in system_settings');
        return res.status(500).json({ error: 'Keg deposit price not configured' });
      }
      const kegDepositPrice = parseFloat(setting.value);

      const errors = [];
      items.forEach((item, index) => {
        const { itemName, quantity, kegCodes, hasKegDeposit } = item;
        if (hasKegDeposit && (!kegCodes || !Array.isArray(kegCodes) || kegCodes.length !== quantity)) {
          errors.push(`Item ${itemName} at index ${index} requires exactly ${quantity} keg codes`);
        }
        if (kegCodes && kegCodes.some(code => !/^[A-Z0-9-]+$/.test(code))) {
          errors.push(`Invalid kegCodes for item ${itemName} at index ${index}: must be valid codes`);
        }
      });
      if (errors.length > 0) {
        console.error('PATCH /api/invoices/:invoiceId: Validation errors', errors);
        return res.status(400).json({ error: errors.join('; ') });
      }

      db.serialize(() => {
        db.run('BEGIN TRANSACTION', (err) => {
          if (err) {
            console.error('PATCH /api/invoices/:invoiceId: Begin transaction error:', err);
            return res.status(500).json({ error: err.message });
          }

          db.run('DELETE FROM invoice_items WHERE invoiceId = ?', [invoiceId], (err) => {
            if (err) {
              db.run('ROLLBACK');
              console.error('PATCH /api/invoices/:invoiceId: Delete items error:', err);
              return res.status(500).json({ error: err.message });
            }

            let remaining = items.length;
            let subtotal = 0;
            let kegDepositTotal = 0;

            items.forEach((item, index) => {
              const { itemName, quantity, unit, price, hasKegDeposit, kegCodes } = item;
              if (!itemName || quantity < 0 || !unit || !price || isNaN(parseFloat(price))) {
                errors.push(`Invalid item at index ${index}: itemName, quantity, unit, and valid price are required`);
                remaining--;
                if (remaining === 0) finish();
                return;
              }

              db.run(
                'INSERT INTO invoice_items (invoiceId, itemName, quantity, unit, price, hasKegDeposit, kegCodes) VALUES (?, ?, ?, ?, ?, ?, ?)',
                [invoiceId, itemName, quantity, unit, price, hasKegDeposit ? 1 : 0, kegCodes ? JSON.stringify(kegCodes) : null],
                (err) => {
                  if (err) {
                    console.error('PATCH /api/invoices/:invoiceId: Insert item error:', err);
                    errors.push(`Failed to insert item ${itemName}: ${err.message}`);
                  } else {
                    subtotal += parseFloat(price) * quantity;
                    if (hasKegDeposit) {
                      kegDepositTotal += quantity * kegDepositPrice;
                    }
                  }
                  remaining--;
                  if (remaining === 0) finish();
                }
              );
            });

            function finish() {
              if (errors.length > 0) {
                db.run('ROLLBACK');
                console.error('PATCH /api/invoices/:invoiceId: Errors occurred', errors);
                return res.status(400).json({ error: errors.join('; ') });
              }

              const total = subtotal + kegDepositTotal;
              db.run(
                'UPDATE invoices SET subtotal = ?, keg_deposit_total = ?, total = ? WHERE invoiceId = ?',
                [subtotal.toFixed(2), kegDepositTotal.toFixed(2), total.toFixed(2), invoiceId],
                (err) => {
                  if (err) {
                    db.run('ROLLBACK');
                    console.error('PATCH /api/invoices/:invoiceId: Update invoice error:', err);
                    return res.status(500).json({ error: err.message });
                  }

                  db.run('COMMIT', (err) => {
                    if (err) {
                      console.error('PATCH /api/invoices/:invoiceId: Commit transaction error:', err);
                      return res.status(500).json({ error: 'Failed to commit transaction' });
                    }

                    db.all(
                      'SELECT id, itemName, quantity, unit, price, hasKegDeposit, kegCodes FROM invoice_items WHERE invoiceId = ? AND itemName != ?',
                      [invoiceId, 'Keg Deposit'],
                      (err, dbItems) => {
                        if (err) {
                          console.error('PATCH /api/invoices/:invoiceId: Fetch items error:', err);
                          return res.status(500).json({ error: err.message });
                        }

                        const enhancedItems = dbItems.map(item => ({
                          ...item,
                          hasKegDeposit: !!item.hasKegDeposit,
                          kegCodes: item.kegCodes ? JSON.parse(item.kegCodes) : null,
                          kegDeposit: item.hasKegDeposit ? {
                            itemName: 'Keg Deposit',
                            quantity: item.quantity,
                            unit: 'Units',
                            price: kegDepositPrice.toFixed(2),
                            hasKegDeposit: false,
                            isSubCharge: true,
                          } : null,
                        }));

                        db.get(
                          `SELECT i.*, c.name AS customerName, c.email AS customerEmail
                           FROM invoices i
                           JOIN customers c ON i.customerId = c.customerId
                           WHERE i.invoiceId = ?`,
                          [invoiceId],
                          (err, updatedInvoice) => {
                            if (err) {
                              console.error('PATCH /api/invoices/:invoiceId: Fetch invoice error:', err);
                              return res.status(500).json({ error: err.message });
                            }
                            updatedInvoice.items = enhancedItems;
                            updatedInvoice.keg_deposit_price = kegDepositPrice.toFixed(2);
                            console.log('PATCH /api/invoices/:invoiceId: Success', {
                              invoiceId,
                              total: updatedInvoice.total,
                              subtotal: updatedInvoice.subtotal,
                              keg_deposit_total: updatedInvoice.keg_deposit_total,
                              itemCount: updatedInvoice.items.length,
                            });
                            res.json(updatedInvoice);
                          }
                        );
                      }
                    );
                  });
                }
              );
            }
          });
        });
      });
    });
  });
});

router.post('/:invoiceId/post', (req, res) => {
  const { invoiceId } = req.params;
  console.log('POST /api/invoices/:invoiceId/post: Received request', { invoiceId });
  db.get('SELECT * FROM invoices WHERE invoiceId = ? AND status = ?', [invoiceId, 'Draft'], (err, invoice) => {
    if (err) {
      console.error('POST /api/invoices/:invoiceId/post: Fetch invoice error:', err);
      return res.status(500).json({ error: err.message });
    }
    if (!invoice) {
      console.error('POST /api/invoices/:invoiceId/post: Invoice not found or not in Draft', { invoiceId });
      return res.status(404).json({ error: 'Invoice not found or not in Draft status' });
    }
    db.all(
      'SELECT itemName, quantity, unit, price, hasKegDeposit, kegCodes FROM invoice_items WHERE invoiceId = ? AND itemName != ?',
      [invoiceId, 'Keg Deposit'],
      (err, orderItems) => {
        if (err) {
          console.error('POST /api/invoices/:invoiceId/post: Fetch invoice items error:', err);
          return res.status(500).json({ error: err.message });
        }
        console.log('POST /api/invoices/:invoiceId/post: Invoice items', orderItems);
        if (!orderItems || orderItems.length === 0) {
          console.error('POST /api/invoices/:invoiceId/post: No invoice items found', { invoiceId });
          return res.status(400).json({ error: 'No items found for the invoice' });
        }
        db.get('SELECT value FROM system_settings WHERE key = ?', ['keg_deposit_price'], (err, setting) => {
          if (err) {
            console.error('POST /api/invoices/:invoiceId/post: Fetch keg_deposit_price error:', err);
            return res.status(500).json({ error: err.message });
          }
          if (!setting) {
            console.error('POST /api/invoices/:invoiceId/post: Keg deposit price not set in system_settings');
            return res.status(500).json({ error: 'Keg deposit price not configured' });
          }
          const kegDepositPrice = parseFloat(setting.value);
          console.log('POST /api/invoices/:invoiceId/post: Keg deposit price', { kegDepositPrice });

          const errors = [];
          orderItems.forEach(item => {
            if (item.hasKegDeposit) {
              const kegCodes = item.kegCodes ? JSON.parse(item.kegCodes) : [];
              if (!kegCodes || kegCodes.length !== item.quantity) {
                errors.push(`Item ${item.itemName} requires exactly ${item.quantity} keg codes`);
              }
            }
          });
          if (errors.length > 0) {
            console.error('POST /api/invoices/:invoiceId/post: Validation errors', errors);
            return res.status(400).json({ error: errors.join('; ') });
          }

          db.serialize(() => {
            db.run('BEGIN TRANSACTION', (err) => {
              if (err) {
                console.error('POST /api/invoices/:invoiceId/post: Begin transaction error:', err);
                return res.status(500).json({ error: 'Failed to start transaction' });
              }
              db.run('DELETE FROM invoice_items WHERE invoiceId = ?', [invoiceId], (err) => {
                if (err) {
                  db.run('ROLLBACK');
                  console.error('POST /api/invoices/:invoiceId/post: Delete invoice items error:', err);
                  return res.status(500).json({ error: err.message });
                }
                let remaining = orderItems.length;
                let subtotal = 0;
                let kegDepositTotal = 0;
                orderItems.forEach((item) => {
                  console.log('POST /api/invoices/:invoiceId/post: Processing item', item);
                  if (!item.price || isNaN(parseFloat(item.price))) {
                    console.error('POST /api/invoices/:invoiceId/post: Invalid price for item', {
                      itemName: item.itemName,
                      price: item.price,
                    });
                    db.run('ROLLBACK');
                    return res.status(400).json({ error: `Invalid price for item ${item.itemName || 'Unknown'}` });
                  }
                  db.get(
                    'SELECT quantity FROM inventory WHERE identifier = ? AND type IN (?, ?)',
                    [item.itemName, 'Finished Goods', 'Marketing'],
                    (err, row) => {
                      if (err) {
                        db.run('ROLLBACK');
                        console.error('POST /api/invoices/:invoiceId/post: Fetch inventory error:', err);
                        return res.status(500).json({ error: err.message });
                      }
                      if (!row || parseFloat(row.quantity) < item.quantity) {
                        db.run('ROLLBACK');
                        console.error('POST /api/invoices/:invoiceId/post: Insufficient inventory', {
                          itemName: item.itemName,
                          available: row?.quantity,
                          needed: item.quantity,
                        });
                        return res.status(400).json({ error: `Insufficient inventory for ${item.itemName}` });
                      }
                      db.run(
                        'UPDATE inventory SET quantity = quantity - ? WHERE identifier = ? AND type IN (?, ?)',
                        [item.quantity, item.itemName, 'Finished Goods', 'Marketing'],
                        (err) => {
                          if (err) {
                            db.run('ROLLBACK');
                            console.error('POST /api/invoices/:invoiceId/post: Update inventory error:', err);
                            return res.status(500).json({ error: err.message });
                          }
                          const kegCodes = item.kegCodes ? JSON.parse(item.kegCodes) : [];
                          const updateKegs = (callback) => {
                            if (!item.hasKegDeposit || !kegCodes.length) {
                              return callback();
                            }
                            db.get('SELECT name FROM customers WHERE customerId = ?', [invoice.customerId], (err, customer) => {
                              if (err) {
                                db.run('ROLLBACK');
                                console.error('POST /api/invoices/:invoiceId/post: Fetch customer error:', err);
                                return res.status(500).json({ error: err.message });
                              }
                              let remainingKegs = kegCodes.length;
                              kegCodes.forEach(code => {
                                db.run(
                                  `UPDATE kegs SET status = ?, locationId = NULL, customerId = ?, lastScanned = ? 
                                   WHERE code = ?`,
                                  ['Filled', invoice.customerId, new Date().toISOString().split('T')[0], code],
                                  (err) => {
                                    if (err) {
                                      db.run('ROLLBACK');
                                      console.error('POST /api/invoices/:invoiceId/post: Update keg error:', err);
                                      return res.status(500).json({ error: `Failed to update keg ${code}: ${err.message}` });
                                    }
                                    db.run(
                                      `INSERT INTO keg_transactions (kegId, action, invoiceId, customerId, date, location)
                                       VALUES ((SELECT id FROM kegs WHERE code = ?), ?, ?, ?, ?, ?)`,
                                      [code, 'Shipped', invoiceId, invoice.customerId, new Date().toISOString().split('T')[0], `Customer: ${customer.name}`],
                                      (err) => {
                                        if (err) {
                                          db.run('ROLLBACK');
                                          console.error('POST /api/invoices/:invoiceId/post: Insert keg transaction error:', err);
                                          return res.status(500).json({ error: `Failed to record keg transaction for ${code}: ${err.message}` });
                                        }
                                        if (--remainingKegs === 0) callback();
                                      }
                                    );
                                  }
                                );
                              });
                            });
                          };

                          updateKegs(() => {
                            db.run(
                              'INSERT INTO invoice_items (invoiceId, itemName, quantity, unit, price, hasKegDeposit, kegCodes) VALUES (?, ?, ?, ?, ?, ?, ?)',
                              [invoiceId, item.itemName, item.quantity, item.unit, item.price, item.hasKegDeposit ? 1 : 0, item.kegCodes],
                              (err) => {
                                if (err) {
                                  db.run('ROLLBACK');
                                  console.error('POST /api/invoices/:invoiceId/post: Insert invoice item error:', err);
                                  return res.status(500).json({ error: err.message });
                                }
                                subtotal += parseFloat(item.price) * item.quantity;
                                if (item.hasKegDeposit) {
                                  kegDepositTotal += item.quantity * kegDepositPrice;
                                }
                                if (--remaining === 0) {
                                  commitTransaction();
                                }
                              }
                            );
                          });
                        }
                      );
                    }
                  );
                });
                function commitTransaction() {
                  const total = subtotal + kegDepositTotal;
                  db.run(
                    'UPDATE invoices SET status = ?, postedDate = ?, total = ?, subtotal = ?, keg_deposit_total = ? WHERE invoiceId = ?',
                    ['Posted', new Date().toISOString().split('T')[0], total.toFixed(2), subtotal.toFixed(2), kegDepositTotal.toFixed(2), invoiceId],
                    (err) => {
                      if (err) {
                        db.run('ROLLBACK');
                        console.error('POST /api/invoices/:invoiceId/post: Update invoice error:', err);
                        return res.status(500).json({ error: err.message });
                      }
                      db.run('COMMIT', (err) => {
                        if (err) {
                          console.error('POST /api/invoices/:invoiceId/post: Commit transaction error:', err);
                          return res.status(500).json({ error: 'Failed to commit transaction' });
                        }
                        db.all(
                          'SELECT id, itemName, quantity, unit, price, hasKegDeposit, kegCodes FROM invoice_items WHERE invoiceId = ?',
                          [invoiceId],
                          (err, items) => {
                            if (err) {
                              console.error('POST /api/invoices/:invoiceId/post: Fetch items error:', err);
                              return res.status(500).json({ error: err.message });
                            }
                            console.log('POST /api/invoices/:invoiceId/post: Success', {
                              invoiceId,
                              subtotal,
                              kegDepositTotal,
                              total,
                            });
                            res.json({
                              message: 'Invoice posted, inventory updated',
                              subtotal: subtotal.toFixed(2),
                              keg_deposit_total: kegDepositTotal.toFixed(2),
                              total: total.toFixed(2),
                              items: items.map(item => ({
                                ...item,
                                kegCodes: item.kegCodes ? JSON.parse(item.kegCodes) : null,
                              })),
                            });
                          }
                        );
                      });
                    }
                  );
                }
              });
            });
          });
        });
      });
    });
  });

router.post('/:invoiceId/email', (req, res) => {
  const { invoiceId } = req.params;
  console.log('POST /api/invoices/:invoiceId/email: Received request', { invoiceId });

  db.get(
    `SELECT i.*, c.name AS customerName, c.email AS customerEmail
     FROM invoices i
     JOIN customers c ON i.customerId = c.customerId
     WHERE i.invoiceId = ?`,
    [invoiceId],
    (err, invoice) => {
      if (err) {
        console.error('POST /api/invoices/:invoiceId/email: Fetch invoice error:', err);
        return res.status(500).json({ error: err.message });
      }
      if (!invoice) {
        console.error('POST /api/invoices/:invoiceId/email: Invoice not found', { invoiceId });
        return res.status(404).json({ error: 'Invoice not found' });
      }

      db.all(
        'SELECT id, itemName, quantity, unit, price, hasKegDeposit FROM invoice_items WHERE invoiceId = ?',
        [invoiceId],
        (err, items) => {
          if (err) {
            console.error('POST /api/invoices/:invoiceId/email: Fetch items error:', err);
            return res.status(500).json({ error: err.message });
          }
          if (!items || items.length === 0) {
            console.error('POST /api/invoices/:invoiceId/email: No items found', { invoiceId });
            return res.status(400).json({ error: 'No items found for the invoice' });
          }

          console.log('POST /api/invoices/:invoiceId/email: Invoice data before email', {
            invoiceId,
            total: invoice.total,
            subtotal: invoice.subtotal,
            keg_deposit_total: invoice.keg_deposit_total,
            items,
          });

          db.get('SELECT value FROM system_settings WHERE key = ?', ['invoice_email_body'], (err, setting) => {
            if (err) {
              console.error('POST /api/invoices/:invoiceId/email: Fetch email body error:', err);
              return res.status(500).json({ error: err.message });
            }
            const emailBody = setting ? setting.value : 'Please find your new invoice from Dothan Brewpub.';
            const mailOptions = {
              from: process.env.EMAIL_USER,
              to: invoice.customerEmail,
              subject: `Invoice ${invoiceId} from Dothan Brewpub`,
              text: `${emailBody}\n\nInvoice ID: ${invoiceId}\nCustomer: ${invoice.customerName}\nTotal: $${parseFloat(invoice.total).toFixed(2)}\nItems:\n${items.map(item => `- ${item.quantity} ${item.unit} ${item.itemName} ($${parseFloat(item.price || 0).toFixed(2)}) ${item.hasKegDeposit ? '(Keg Deposit)' : ''}`).join('\n')}`,
            };

            transporter.sendMail(mailOptions, (err, info) => {
              if (err) {
                console.error('POST /api/invoices/:invoiceId/email: Email send error:', err);
                return res.status(500).json({ error: 'Failed to send email: ' + err.message });
              }

              db.get(
                `SELECT total, subtotal, keg_deposit_total FROM invoices WHERE invoiceId = ?`,
                [invoiceId],
                (err, postEmailInvoice) => {
                  if (err) {
                    console.error('POST /api/invoices/:invoiceId/email: Post-email fetch error:', err);
                    return res.status(500).json({ error: err.message });
                  }
                  console.log('POST /api/invoices/:invoiceId/email: Invoice data after email', {
                    invoiceId,
                    total: postEmailInvoice.total,
                    subtotal: postEmailInvoice.subtotal,
                    keg_deposit_total: postEmailInvoice.keg_deposit_total,
                  });

                  console.log('POST /api/invoices/:invoiceId/email: Email sent successfully', { invoiceId, info });
                  res.json({ message: 'Email sent successfully' });
                }
              );
            });
          });
        }
      );
    }
  );
});

module.exports = router;