const express = require('express');
const { db } = require('../services/database');
const { packageVolumes } = require('../services/xml-parser');

const router = express.Router();

router.get('/', (req, res) => {
  const { name } = req.query;
  let query = 'SELECT * FROM products WHERE enabled = 1';
  let params = [];
  if (name) {
    query += ' AND name = ?';
    params.push(name);
  }
  db.all(query, params, (err, rows) => {
    if (err) {
      console.error('GET /api/products: Fetch products error:', err);
      return res.status(500).json({ error: err.message });
    }
    const productsWithPackageTypes = [];
    let remaining = rows.length;
    if (remaining === 0) {
      console.log('GET /api/products: Returning', rows);
      res.json(rows);
      return;
    }
    rows.forEach((product) => {
      db.all(
        'SELECT type, price, isKegDepositItem FROM product_package_types WHERE productId = ?',
        [product.id],
        (err, packageTypes) => {
          if (err) {
            console.error('GET /api/products: Fetch package types error:', err);
            packageTypes = [];
          }
          productsWithPackageTypes.push({ ...product, packageTypes });
          if (--remaining === 0) {
            console.log('GET /api/products: Returning', productsWithPackageTypes);
            res.json(productsWithPackageTypes);
          }
        }
      );
    });
  });
});

router.get('/:id', (req, res) => {
  const id = parseInt(req.params.id);
  console.log('GET /api/products/:id: Received request', { id });
  db.get('SELECT * FROM products WHERE id = ?', [id], (err, row) => {
    if (err) {
      console.error('GET /api/products/:id: Fetch product error:', err);
      return res.status(500).json({ error: err.message });
    }
    if (!row) {
      console.error('GET /api/products/:id: Product not found', { id });
      return res.status(404).json({ error: 'Product not found' });
    }
    db.all('SELECT type, price, isKegDepositItem FROM product_package_types WHERE productId = ?', [id], (err, packageTypes) => {
      if (err) {
        console.error('GET /api/products/:id: Fetch package types error:', err);
        return res.status(500).json({ error: err.message });
      }
      const product = { ...row, packageTypes: packageTypes || [] };
      console.log('GET /api/products/:id: Success', product);
      res.json(product);
    });
  });
});

router.patch('/:id', (req, res) => {
  const { id } = req.params;
  const { name, abbreviation, enabled = true, priority = 1, class: prodClass, type, style, abv = 0, ibu = 0, packageTypes = [] } = req.body;
  console.log('PATCH /api/products/:id: Received request', { id, name, abbreviation, type, style, packageTypes });

  if (!name || !abbreviation || !type || !style) {
    console.error('PATCH /api/products/:id: Missing required fields', { name, abbreviation, type, style });
    return res.status(400).json({ error: 'Name, abbreviation, type, and style are required' });
  }

  const validProductTypes = ['Malt', 'Spirits', 'Wine', 'Merchandise', 'Cider', 'Seltzer'];
  if (!validProductTypes.includes(type)) {
    console.error('PATCH /api/products/:id: Invalid type', { type });
    return res.status(400).json({ error: `Invalid product type. Must be one of: ${validProductTypes.join(', ')}` });
  }
  if ((type === 'Seltzer' || type === 'Merchandise') && style !== 'Other') {
    console.error('PATCH /api/products/:id: Invalid style for type', { type, style });
    return res.status(400).json({ error: 'Style must be "Other" for Seltzer or Merchandise' });
  }

  if (!Array.isArray(packageTypes)) {
    console.error('PATCH /api/products/:id: Invalid packageTypes', { packageTypes });
    return res.status(400).json({ error: 'packageTypes must be an array' });
  }

  const validPackageTypes = packageTypes.filter(pkg => {
    if (!pkg.type || !pkg.price || pkg.isKegDepositItem === undefined) {
      console.warn('PATCH /api/products/:id: Skipping invalid package type', { pkg });
      return false;
    }
    if (!packageVolumes[pkg.type]) {
      console.warn('PATCH /api/products/:id: Skipping invalid package type', { type: pkg.type });
      return false;
    }
    if (isNaN(parseFloat(pkg.price)) || parseFloat(pkg.price) < 0) {
      console.warn('PATCH /api/products/:id: Skipping invalid price', { price: pkg.price });
      return false;
    }
    return true;
  });

  db.serialize(() => {
    db.run('BEGIN TRANSACTION', (err) => {
      if (err) {
        console.error('PATCH /api/products/:id: Begin transaction error:', err);
        return res.status(500).json({ error: `Failed to start transaction: ${err.message}` });
      }

      db.run(
        `UPDATE products SET name = ?, abbreviation = ?, enabled = ?, priority = ?, class = ?, type = ?, style = ?, abv = ?, ibu = ? WHERE id = ?`,
        [name, abbreviation, enabled ? 1 : 0, priority, prodClass || null, type, style, abv, ibu, id],
        function (err) {
          if (err) {
            db.run('ROLLBACK');
            console.error('PATCH /api/products/:id: Update product error:', err);
            return res.status(500).json({ error: `Failed to update product: ${err.message}` });
          }
          if (this.changes === 0) {
            db.run('ROLLBACK');
            console.error('PATCH /api/products/:id: Product not found', { id });
            return res.status(404).json({ error: 'Product not found' });
          }

          db.run('DELETE FROM product_package_types WHERE productId = ?', [id], (err) => {
            if (err) {
              db.run('ROLLBACK');
              console.error('PATCH /api/products/:id: Delete package types error:', err);
              return res.status(500).json({ error: `Failed to delete package types: ${err.message}` });
            }
            console.log('PATCH /api/products/:id: Deleted existing package types', { productId: id });

            let remaining = validPackageTypes.length;
            if (remaining === 0) {
              updateItemsAndCommit();
              return;
            }

            validPackageTypes.forEach((pkg, index) => {
              db.run(
                `INSERT INTO product_package_types (productId, type, price, isKegDepositItem) VALUES (?, ?, ?, ?)`,
                [id, pkg.type, pkg.price, pkg.isKegDepositItem ? 1 : 0],
                (err) => {
                  if (err) {
                    db.run('ROLLBACK');
                    console.error('PATCH /api/products/:id: Insert package type error:', { index, pkg, error: err.message });
                    return res.status(500).json({ error: `Failed to insert package type ${pkg.type}: ${err.message}` });
                  }
                  console.log('PATCH /api/products/:id: Inserted package type', { productId: id, type: pkg.type, price: pkg.price });
                  if (--remaining === 0) {
                    updateItemsAndCommit();
                  }
                }
              );
            });

            function updateItemsAndCommit() {
              const itemInserts = validPackageTypes.map((pkg) => ({
                name: `${name} ${pkg.type}`,
                type: 'Finished Goods',
                enabled: 1,
              }));

              let itemRemaining = itemInserts.length;
              if (itemRemaining === 0) {
                commitTransaction();
                return;
              }

              itemInserts.forEach((item) => {
                db.run(
                  `INSERT OR IGNORE INTO items (name, type, enabled) VALUES (?, ?, ?)`,
                  [item.name, item.type, item.enabled],
                  (err) => {
                    if (err) {
                      db.run('ROLLBACK');
                      console.error('PATCH /api/products/:id: Insert item error:', { item, error: err.message });
                      return res.status(500).json({ error: `Failed to insert item ${item.name}: ${err.message}` });
                    }
                    console.log('PATCH /api/products/:id: Inserted item', { itemName: item.name });
                    if (--itemRemaining === 0) {
                      commitTransaction();
                    }
                  }
                );
              });

              function commitTransaction() {
                db.run('COMMIT', (err) => {
                  if (err) {
                    db.run('ROLLBACK');
                    console.error('PATCH /api/products/:id: Commit transaction error:', err);
                    return res.status(500).json({ error: `Failed to commit transaction: ${err.message}` });
                  }

                  db.get('SELECT * FROM products WHERE id = ?', [id], (err, product) => {
                    if (err) {
                      console.error('PATCH /api/products/:id: Fetch product error:', err);
                      return res.status(500).json({ error: `Failed to fetch product: ${err.message}` });
                    }

                    db.all('SELECT type, price, isKegDepositItem FROM product_package_types WHERE productId = ?', [id], (err, packageTypes) => {
                      if (err) {
                        console.error('PATCH /api/products/:id: Fetch package types error:', err);
                        return res.status(500).json({ error: `Failed to fetch package types: ${err.message}` });
                      }
                      console.log('PATCH /api/products/:id: Success', { id, product, packageTypes });
                      res.json({ ...product, packageTypes });
                    });
                  });
                });
              }
            }
          });
        }
      );
    });
  });
});

router.post('/', (req, res) => {
  console.log('POST /api/products: Received request', req.body);
  const { name, abbreviation, enabled = true, priority = 1, class: prodClass, type, style, abv = 0, ibu = 0 } = req.body;
  if (!name || !abbreviation || !type || !style) {
    console.log('POST /api/products: Missing required fields');
    return res.status(400).json({ error: 'Name, abbreviation, type, and style are required' });
  }
  const validProductTypes = ['Malt', 'Spirits', 'Wine', 'Merchandise', 'Cider', 'Seltzer'];
  if (!validProductTypes.includes(type)) {
    console.log(`POST /api/products: Invalid type: ${type}`);
    return res.status(400).json({ error: `Invalid product type. Must be one of: ${validProductTypes.join(', ')}` });
  }
  if ((type === 'Seltzer' || type === 'Merchandise') && style !== 'Other') {
    console.log(`POST /api/products: Invalid style for ${type}: ${style}`);
    return res.status(400).json({ error: 'Style must be "Other" for Seltzer or Merchandise' });
  }
  db.run(
    `INSERT INTO products (id, name, abbreviation, enabled, priority, class, type, style, abv, ibu)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [Date.now(), name, abbreviation, enabled ? 1 : 0, priority, prodClass, type, style, abv, ibu],
    function(err) {
      if (err) {
        console.error('POST /api/products: Insert product error:', err);
        return res.status(500).json({ error: err.message });
      }
      const newProduct = { id: this.lastID, name, abbreviation, enabled, priority, class: prodClass, type, style, abv, ibu };
      console.log('POST /api/products: Added', newProduct);
      res.json(newProduct);
    }
  );
});

router.delete('/', (req, res) => {
  console.log('DELETE /api/products: Received request', req.body);
  const { ids } = req.body;
  if (!ids || !Array.isArray(ids)) {
    console.log('DELETE /api/products: Invalid IDs');
    return res.status(400).json({ error: 'IDs array is required' });
  }
  const placeholders = ids.map(() => '?').join(',');
  db.run(`DELETE FROM products WHERE id IN (${placeholders})`, ids, (err) => {
    if (err) {
      console.error('DELETE /api/products: Delete products error:', err);
      return res.status(500).json({ error: err.message });
    }
    console.log('DELETE /api/products: Deleted IDs', ids);
    res.json({ message: `Deleted products with IDs: ${ids.join(', ')}` });
  });
});

router.get('/:id/recipes', (req, res) => {
  const id = parseInt(req.params.id);
  const mockRecipes = id === 1
    ? [{ id: 1, productId: 1, name: 'Whiskey Recipe', ingredients: 'Corn, Barley, Water', instructions: 'Distill and age' }]
    : [{ id: 2, productId: 2, name: 'Hazy Train 10 BBL', ingredients: 'Hops, Malt, Yeast', instructions: 'Ferment and hop' }];
  res.json(mockRecipes);
});

router.get('/product-package-types', (req, res) => {
  const { productId } = req.query;
  let query = 'SELECT id, productId, type, price, isKegDepositItem FROM product_package_types WHERE enabled = 1';
  let params = [];
  if (productId) {
    query += ' AND productId = ?';
    params.push(productId);
  }
  db.all(query, params, (err, rows) => {
    if (err) {
      console.error('GET /api/product-package-types: Fetch packaging types error:', err);
      return res.status(500).json({ error: err.message });
    }
    console.log('GET /api/product-package-types: Success', { count: rows.length });
    res.json(rows);
  });
});

module.exports = router;