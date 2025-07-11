const express = require('express');
const { db } = require('../../services/database');

const router = express.Router();

router.get('/', (req, res) => {
  const { page = 1, limit = 10 } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);
  db.get('SELECT COUNT(*) as total FROM sales_orders WHERE status != ?', ['Cancelled'], (err, countResult) => {
    if (err) {
      console.error('GET /api/sales-orders: Count error:', err);
      return res.status(500).json({ error: err.message });
    }
    const totalOrders = countResult.total;
    const totalPages = Math.ceil(totalOrders / parseInt(limit));
    db.all(
      `SELECT so.*, c.name AS customerName
       FROM sales_orders so
       JOIN customers c ON so.customerId = c.customerId
       WHERE so.status != ?
       LIMIT ? OFFSET ?`,
      ['Cancelled', parseInt(limit), offset],
      (err, rows) => {
        if (err) {
          console.error('GET /api/sales-orders: Fetch error:', err);
          return res.status(500).json({ error: err.message });
        }
        console.log('GET /api/sales-orders: Success', { count: rows.length, page, limit, totalPages });
        res.json({ orders: rows, totalPages });
      }
    );
  });
});

router.get('/:orderId', (req, res) => {
  const { orderId } = req.params;
  console.log('GET /api/sales-orders/:orderId: Received request', { orderId });
  db.get(
    `SELECT so.*, c.name AS customerName
     FROM sales_orders so
     JOIN customers c ON so.customerId = c.customerId
     WHERE so.orderId = ?`,
    [orderId],
    (err, order) => {
      if (err) {
        console.error('GET /api/sales-orders/:orderId: Database error:', err);
        return res.status(500).json({ error: err.message });
      }
      if (!order) {
        console.error('GET /api/sales-orders/:orderId: Order not found', { orderId });
        return res.status(404).json({ error: 'Sales order not found' });
      }
      db.all('SELECT id, itemName, quantity, unit, price, hasKegDeposit, kegCodes FROM sales_order_items WHERE orderId = ?', [orderId], (err, items) => {
        if (err) {
          console.error('GET /api/sales-orders/:orderId: Fetch items error:', err);
          return res.status(500).json({ error: err.message });
        }
        db.get('SELECT value FROM system_settings WHERE key = ?', ['keg_deposit_price'], (err, setting) => {
          if (err) {
            console.error('GET /api/sales-orders/:orderId: Fetch keg_deposit_price error:', err);
            return res.status(500).json({ error: err.message });
          }
          order.items = items.map(item => ({
            ...item,
            kegCodes: item.kegCodes ? JSON.parse(item.kegCodes) : null,
          }));
          order.keg_deposit_price = setting ? setting.value : '0.00';
          console.log('GET /api/sales-orders/:orderId: Success', order);
          res.json(order);
        });
      });
    }
  );
});

router.post('/', (req, res) => {
  const { customerId, poNumber, items } = req.body;
  console.log('POST /api/sales-orders: Received request', { customerId, poNumber, items });
  if (!customerId || !items || !Array.isArray(items) || items.length === 0) {
    console.error('POST /api/sales-orders: Missing required fields', { customerId, items });
    return res.status(400).json({ error: 'customerId and items are required' });
  }

  db.get('SELECT customerId FROM customers WHERE customerId = ? AND enabled = 1', [customerId], (err, customer) => {
    if (err) {
      console.error('POST /api/sales-orders: Fetch customer error:', err);
      return res.status(500).json({ error: err.message });
    }
    if (!customer) {
      console.error('POST /api/sales-orders: Invalid customerId', { customerId });
      return res.status(400).json({ error: `Invalid customerId: ${customerId}` });
    }

    const createdDate = new Date().toISOString().split('T')[0];
    db.run(
      'INSERT INTO sales_orders (customerId, poNumber, status, createdDate) VALUES (?, ?, ?, ?)',
      [customerId, poNumber || null, 'Draft', createdDate],
      function (err) {
        if (err) {
          console.error('POST /api/sales-orders: Insert sales order error:', err);
          return res.status(500).json({ error: err.message });
        }
        const orderId = this.lastID;

        let remaining = items.length;
        const errors = [];
        items.forEach((item, index) => {
          const { itemName, quantity, unit, hasKegDeposit, kegCodes } = item;
          if (!itemName || quantity <= 0 || !unit) {
            errors.push(`Invalid item at index ${index}: itemName, quantity, and unit are required`);
            remaining--;
            if (remaining === 0) finish();
            return;
          }
          if (hasKegDeposit && kegCodes && (!Array.isArray(kegCodes) || kegCodes.some(code => !/^[A-Z0-9-]+$/.test(code)))) {
            errors.push(`Invalid kegCodes for item ${itemName} at index ${index}: must be an array of valid codes`);
            remaining--;
            if (remaining === 0) finish();
            return;
          }

          const parts = itemName.trim().split(' ');
          let packageType, productName;
          const lastPart = parts[parts.length - 1].toLowerCase();
          if (['keg', 'bottle', 'can'].includes(lastPart)) {
            packageType = parts.slice(-3).join(' ').replace(/\s*\/\s*/, '/');
            productName = parts.slice(0, -3).join(' ');
          } else {
            packageType = parts.slice(-2).join(' ').replace(/\s*\/\s*/, '/');
            productName = parts.slice(0, -2).join(' ');
          }
          console.log('POST /api/sales-orders: Processing item', { itemName, productName, packageType });

          db.get(
            `SELECT ppt.price, ppt.isKegDepositItem 
             FROM product_package_types ppt 
             JOIN products p ON ppt.productId = p.id 
             WHERE p.name = ? AND ppt.type = ?`,
            [productName, packageType],
            (err, priceRow) => {
              if (err) {
                console.error('POST /api/sales-orders: Fetch price error:', err);
                errors.push(`Failed to fetch price for ${itemName}: ${err.message}`);
                remaining--;
                if (remaining === 0) finish();
                return;
              }
              if (priceRow) {
                insertItem(priceRow.price, hasKegDeposit ?? priceRow.isKegDepositItem);
              } else {
                console.log('POST /api/sales-orders: Falling back to inventory for price', { itemName });
                db.get(
                  `SELECT price, isKegDepositItem 
                   FROM inventory 
                   WHERE identifier = ? AND type = 'Finished Goods'`,
                  [itemName],
                  (err, invRow) => {
                    if (err) {
                      console.error('POST /api/sales-orders: Fetch inventory price error:', err);
                      errors.push(`Failed to fetch inventory price for ${itemName}: ${err.message}`);
                      remaining--;
                      if (remaining === 0) finish();
                      return;
                    }
                    if (invRow) {
                      insertItem(invRow.price, hasKegDeposit ?? invRow.isKegDepositItem);
                    } else {
                      console.error('POST /api/sales-orders: Price not found', { itemName, productName, packageType });
                      errors.push(`Price not found for ${itemName}. Ensure it is defined in product package types or inventory.`);
                      remaining--;
                      if (remaining === 0) finish();
                    }
                  }
                );
              }
            }
          );

          function insertItem(itemPrice, itemHasKegDeposit) {
            db.run(
              'INSERT INTO sales_order_items (orderId, itemName, quantity, unit, price, hasKegDeposit, kegCodes) VALUES (?, ?, ?, ?, ?, ?, ?)',
              [orderId, itemName, quantity, unit, itemPrice, itemHasKegDeposit ? 1 : 0, kegCodes ? JSON.stringify(kegCodes) : null],
              (err) => {
                if (err) {
                  console.error('POST /api/sales-orders: Insert item error:', err);
                  errors.push(`Failed to insert item ${itemName}: ${err.message}`);
                }
                remaining--;
                if (remaining === 0) finish();
              }
            );
          }
        });

        function finish() {
          if (errors.length > 0) {
            db.run('DELETE FROM sales_orders WHERE orderId = ?', [orderId]);
            console.error('POST /api/sales-orders: Errors occurred', errors);
            return res.status(400).json({ error: errors.join('; ') });
          }

          db.get(
            `SELECT so.*, c.name AS customerName
             FROM sales_orders so
             JOIN customers c ON so.customerId = c.customerId
             WHERE so.orderId = ?`,
            [orderId],
            (err, order) => {
              if (err) {
                console.error('POST /api/sales-orders: Fetch order error:', err);
                return res.status(500).json({ error: err.message });
              }
              db.all('SELECT id, itemName, quantity, unit, price, hasKegDeposit, kegCodes FROM sales_order_items WHERE orderId = ?', [orderId], (err, items) => {
                if (err) {
                  console.error('POST /api/sales-orders: Fetch items error:', err);
                  return res.status(500).json({ error: err.message });
                }
                db.get('SELECT value FROM system_settings WHERE key = ?', ['keg_deposit_price'], (err, setting) => {
                  if (err) {
                    console.error('POST /api/sales-orders: Fetch keg_deposit_price error:', err);
                    return res.status(500).json({ error: err.message });
                  }
                  order.items = items.map(item => ({
                    ...item,
                    kegCodes: item.kegCodes ? JSON.parse(item.kegCodes) : null,
                  }));
                  order.keg_deposit_price = setting ? setting.value : '0.00';
                  console.log('POST /api/sales-orders: Success', order);
                  res.json(order);
                });
              });
            }
          );
        }
      }
    );
  });
});

router.patch('/:orderId', (req, res) => {
  const { orderId } = req.params;
  const { customerId, poNumber, items, status } = req.body;
  console.log('PATCH /api/sales-orders/:orderId: Received request', { orderId, customerId, poNumber, items, status });
  if (!customerId || !items || !Array.isArray(items) || items.length === 0) {
    console.error('PATCH /api/sales-orders/:orderId: Missing required fields', { customerId, items });
    return res.status(400).json({ error: 'customerId and items are required' });
  }

  db.get('SELECT customerId FROM customers WHERE customerId = ? AND enabled = 1', [customerId], (err, customer) => {
    if (err) {
      console.error('PATCH /api/sales-orders/:orderId: Fetch customer error:', err);
      return res.status(500).json({ error: err.message });
    }
    if (!customer) {
      console.error('PATCH /api/sales-orders/:orderId: Invalid customerId', { customerId });
      return res.status(400).json({ error: `Invalid customerId: ${customerId}` });
    }

    db.get('SELECT * FROM sales_orders WHERE orderId = ? AND status = ?', [orderId, 'Draft'], (err, order) => {
      if (err) {
        console.error('PATCH /api/sales-orders/:orderId: Fetch order error:', err);
        return res.status(500).json({ error: err.message });
      }
      if (!order && status !== 'Approved') {
        console.error('PATCH /api/sales-orders/:orderId: Order not found or not in Draft', { orderId });
        return res.status(404).json({ error: 'Order not found or not in Draft status' });
      }

      if (status === 'Approved') {
        let remainingChecks = items.length;
        const errors = [];
        items.forEach((item, index) => {
          const { itemName, quantity, kegCodes } = item;
          if (!itemName || quantity <= 0) {
            errors.push(`Invalid item at index ${index}: itemName and positive quantity required`);
            remainingChecks--;
            if (remainingChecks === 0) finishValidation();
            return;
          }
          if (item.hasKegDeposit && (!kegCodes || !Array.isArray(kegCodes) || kegCodes.length !== quantity)) {
            errors.push(`Item ${itemName} at index ${index} requires exactly ${quantity} keg codes`);
            remainingChecks--;
            if (remainingChecks === 0) finishValidation();
            return;
          }
          if (kegCodes) {
            kegCodes.forEach((code, codeIndex) => {
              db.get('SELECT id, status, productId FROM kegs WHERE code = ?', [code], (err, keg) => {
                if (err) {
                  errors.push(`Failed to fetch keg ${code} for ${itemName}: ${err.message}`);
                } else if (!keg) {
                  errors.push(`Keg ${code} not found for ${itemName}`);
                } else if (keg.status !== 'Filled') {
                  errors.push(`Keg ${code} is not filled for ${itemName} (status: ${keg.status})`);
                } else {
                  const parts = itemName.trim().split(' ');
                  const productName = parts.slice(0, -3).join(' ');
                  db.get('SELECT id FROM products WHERE name = ?', [productName], (err, product) => {
                    if (err || !product || product.id !== keg.productId) {
                      errors.push(`Keg ${code} does not contain ${productName} for ${itemName}`);
                    }
                    if (--remainingChecks === 0) finishValidation();
                  });
                  return;
                }
                if (--remainingChecks === 0) finishValidation();
              });
            });
          } else {
            db.get(
              'SELECT quantity FROM inventory WHERE identifier = ? AND type IN (?, ?)',
              [itemName, 'Finished Goods', 'Marketing'],
              (err, row) => {
                if (err) {
                  console.error('PATCH /api/sales-orders/:orderId: Fetch inventory error:', err);
                  errors.push(`Failed to check inventory for ${itemName}: ${err.message}`);
                } else if (!row || parseFloat(row.quantity) < quantity) {
                  console.error('PATCH /api/sales-orders/:orderId: Insufficient inventory', {
                    itemName,
                    available: row?.quantity || 0,
                    needed: quantity,
                  });
                  errors.push(`Insufficient inventory for ${itemName}: ${row?.quantity || 0} available, ${quantity} needed`);
                }
                remainingChecks--;
                if (remainingChecks === 0) finishValidation();
              }
            );
          }
        });
        function finishValidation() {
          if (errors.length > 0) {
            console.error('PATCH /api/sales-orders/:orderId: Validation failed', errors);
            return res.status(400).json({ error: errors.join('; ') });
          }
          proceedWithUpdate();
        }
      } else {
        proceedWithUpdate();
      }

      function proceedWithUpdate() {
        db.serialize(() => {
          db.run('BEGIN TRANSACTION', (err) => {
            if (err) {
              console.error('PATCH /api/sales-orders/:orderId: Begin transaction error:', err);
              return res.status(500).json({ error: err.message });
            }
            db.run(
              'UPDATE sales_orders SET customerId = ?, poNumber = ?, status = ? WHERE orderId = ?',
              [customerId, poNumber || null, status || 'Draft', orderId],
              (err) => {
                if (err) {
                  db.run('ROLLBACK');
                  console.error('PATCH /api/sales-orders/:orderId: Update order error:', err);
                  return res.status(500).json({ error: err.message });
                }
                db.run('DELETE FROM sales_order_items WHERE orderId = ?', [orderId], (err) => {
                  if (err) {
                    db.run('ROLLBACK');
                    console.error('PATCH /api/sales-orders/:orderId: Delete items error:', err);
                    return res.status(500).json({ error: err.message });
                  }
                  let remaining = items.length;
                  const errors = [];
                  items.forEach((item, index) => {
                    const { itemName, quantity, unit, price, hasKegDeposit, kegCodes } = item;
                    if (!itemName || quantity <= 0 || !unit || !price || isNaN(parseFloat(price)) || parseFloat(price) < 0) {
                      errors.push(`Invalid item at index ${index}: itemName, quantity, unit, and valid price are required`);
                      remaining--;
                      if (remaining === 0) finish();
                      return;
                    }
                    db.run(
                      'INSERT INTO sales_order_items (orderId, itemName, quantity, unit, price, hasKegDeposit, kegCodes) VALUES (?, ?, ?, ?, ?, ?, ?)',
                      [orderId, itemName, quantity, unit, price, hasKegDeposit ? 1 : 0, kegCodes ? JSON.stringify(kegCodes) : null],
                      (err) => {
                        if (err) {
                          console.error('PATCH /api/sales-orders/:orderId: Insert item error:', err);
                          errors.push(`Failed to insert item ${itemName}: ${err.message}`);
                        }
                        remaining--;
                        if (remaining === 0) finish();
                      }
                    );
                  });
                  function finish() {
                    if (errors.length > 0) {
                      db.run('ROLLBACK');
                      console.error('PATCH /api/sales-orders/:orderId: Errors occurred', errors);
                      return res.status(400).json({ error: errors.join('; ') });
                    }
                    if (status === 'Approved') {
                      db.get('SELECT value FROM system_settings WHERE key = ?', ['keg_deposit_price'], (err, setting) => {
                        if (err) {
                          db.run('ROLLBACK');
                          console.error('PATCH /api/sales-orders/:orderId: Fetch keg_deposit_price error:', err);
                          return res.status(500).json({ error: err.message });
                        }
                        if (!setting) {
                          db.run('ROLLBACK');
                          console.error('PATCH /api/sales-orders/:orderId: Keg deposit price not set in system_settings');
                          return res.status(500).json({ error: 'Keg deposit price not configured' });
                        }
                        const kegDepositPrice = parseFloat(setting.value);
                        console.log('PATCH /api/sales-orders/:orderId: Keg deposit price', { kegDepositPrice });
                        let subtotal = 0;
                        let kegDepositTotal = 0;
                        let kegDepositCount = 0;
                        items.forEach(item => {
                          subtotal += parseFloat(item.price) * item.quantity;
                          if (item.hasKegDeposit) {
                            kegDepositCount += item.quantity;
                            kegDepositTotal += item.quantity * kegDepositPrice;
                          }
                        });
                        const total = subtotal + kegDepositTotal;
                        console.log('PATCH /api/sales-orders/:orderId: Calculated totals', { subtotal, kegDepositTotal, total });
                        db.run(
                          'INSERT INTO invoices (orderId, customerId, status, createdDate, total, subtotal, keg_deposit_total, keg_deposit_price) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
                          [orderId, customerId, 'Draft', new Date().toISOString().split('T')[0], total.toFixed(2), subtotal.toFixed(2), kegDepositTotal.toFixed(2), kegDepositPrice.toFixed(2)],
                          function (err) {
                            if (err) {
                              db.run('ROLLBACK');
                              console.error('PATCH /api/sales-orders/:orderId: Insert invoice error:', err);
                              return res.status(500).json({ error: err.message });
                            }
                            const invoiceId = this.lastID;
                            console.log('PATCH /api/sales-orders/:orderId: Created invoice', { invoiceId });
                            let invoiceItemsRemaining = items.length + (kegDepositCount > 0 ? 1 : 0);
                            items.forEach(item => {
                              db.run(
                                'INSERT INTO invoice_items (invoiceId, itemName, quantity, unit, price, hasKegDeposit, kegCodes) VALUES (?, ?, ?, ?, ?, ?, ?)',
                                [invoiceId, item.itemName, item.quantity, item.unit, item.price, item.hasKegDeposit ? 1 : 0, item.kegCodes ? JSON.stringify(item.kegCodes) : null],
                                (err) => {
                                  if (err) {
                                    db.run('ROLLBACK');
                                    console.error('PATCH /api/sales-orders/:orderId: Insert invoice item error:', err);
                                    return res.status(500).json({ error: err.message });
                                  }
                                  console.log('PATCH /api/sales-orders/:orderId: Inserted invoice item', { itemName: item.itemName });
                                  if (--invoiceItemsRemaining === 0) commit();
                                }
                              );
                            });
                            if (kegDepositCount > 0) {
                              db.run(
                                'INSERT INTO invoice_items (invoiceId, itemName, quantity, unit, price, hasKegDeposit) VALUES (?, ?, ?, ?, ?, ?)',
                                [invoiceId, 'Keg Deposit', kegDepositCount, 'Units', kegDepositPrice.toFixed(2), 0],
                                (err) => {
                                  if (err) {
                                    db.run('ROLLBACK');
                                    console.error('PATCH /api/sales-orders/:orderId: Insert keg deposit item error:', err);
                                    return res.status(500).json({ error: err.message });
                                  }
                                  console.log('PATCH /api/sales-orders/:orderId: Inserted keg deposit item', { kegDepositCount, kegDepositPrice });
                                  if (--invoiceItemsRemaining === 0) commit();
                                }
                              );
                            } else {
                              if (--invoiceItemsRemaining === 0) commit();
                            }
                            function commit() {
                              db.run('COMMIT', (err) => {
                                if (err) {
                                  db.run('ROLLBACK');
                                  console.error('PATCH /api/sales-orders/:orderId: Commit transaction error:', err);
                                  return res.status(500).json({ error: 'Failed to commit transaction' });
                                }
                                db.get(
                                  `SELECT so.*, c.name AS customerName
                                   FROM sales_orders so
                                   JOIN customers c ON so.customerId = c.customerId
                                   WHERE so.orderId = ?`,
                                  [orderId],
                                  (err, order) => {
                                    if (err) {
                                      console.error('PATCH /api/sales-orders/:orderId: Fetch order error:', err);
                                      return res.status(500).json({ error: err.message });
                                    }
                                    db.all('SELECT id, itemName, quantity, unit, price, hasKegDeposit, kegCodes FROM sales_order_items WHERE orderId = ?', [orderId], (err, items) => {
                                      if (err) {
                                        console.error('PATCH /api/sales-orders/:orderId: Fetch items error:', err);
                                        return res.status(500).json({ error: err.message });
                                      }
                                      db.get('SELECT value FROM system_settings WHERE key = ?', ['keg_deposit_price'], (err, setting) => {
                                        if (err) {
                                          console.error('PATCH /api/sales-orders/:orderId: Fetch keg_deposit_price error:', err);
                                          return res.status(500).json({ error: err.message });
                                        }
                                        order.items = items.map(item => ({
                                          ...item,
                                          kegCodes: item.kegCodes ? JSON.parse(item.kegCodes) : null,
                                        }));
                                        order.keg_deposit_price = setting ? setting.value : '0.00';
                                        order.invoiceId = invoiceId;
                                        console.log('PATCH /api/sales-orders/:orderId: Success', order);
                                        res.json(order);
                                      });
                                    });
                                  }
                                );
                              });
                            }
                          }
                        );
                      });
                    } else {
                      db.run('COMMIT', (err) => {
                        if (err) {
                          console.error('PATCH /api/sales-orders/:orderId: Commit transaction error:', err);
                          return res.status(500).json({ error: 'Failed to commit transaction' });
                        }
                        db.get(
                          `SELECT so.*, c.name AS customerName
                           FROM sales_orders so
                           JOIN customers c ON so.customerId = c.customerId
                           WHERE so.orderId = ?`,
                          [orderId],
                          (err, order) => {
                            if (err) {
                              console.error('PATCH /api/sales-orders/:orderId: Fetch order error:', err);
                              return res.status(500).json({ error: err.message });
                            }
                            db.all('SELECT id, itemName, quantity, unit, price, hasKegDeposit, kegCodes FROM sales_order_items WHERE orderId = ?', [orderId], (err, items) => {
                              if (err) {
                                console.error('PATCH /api/sales-orders/:orderId: Fetch items error:', err);
                                return res.status(500).json({ error: err.message });
                              }
                              db.get('SELECT value FROM system_settings WHERE key = ?', ['keg_deposit_price'], (err, setting) => {
                                if (err) {
                                  console.error('PATCH /api/sales-orders/:orderId: Fetch keg_deposit_price error:', err);
                                  return res.status(500).json({ error: err.message });
                                }
                                order.items = items.map(item => ({
                                  ...item,
                                  kegCodes: item.kegCodes ? JSON.parse(item.kegCodes) : null,
                                }));
                                order.keg_deposit_price = setting ? setting.value : '0.00';
                                console.log('PATCH /api/sales-orders/:orderId: Success', order);
                                res.json(order);
                              });
                            });
                          }
                        );
                      });
                    }
                  }
                });
              }
            );
          });
        });
      }
    });
  });
});

module.exports = router;