const express = require('express');
const { db } = require('../services/database');

const router = express.Router();

router.get('/', (req, res) => {
  db.all(`
    SELECT r.*, p.name AS productName 
    FROM recipes r 
    JOIN products p ON r.productId = p.id
  `, (err, rows) => {
    if (err) {
      console.error('GET /api/recipes: Fetch error:', err);
      return res.status(500).json({ error: err.message });
    }
    const recipesWithIngredients = [];
    let remaining = rows.length;
    if (remaining === 0) {
      console.log('GET /api/recipes: Success', { count: 0 });
      return res.json([]);
    }
    rows.forEach(row => {
      db.all('SELECT id, itemName, quantity, unit FROM recipe_ingredients WHERE recipeId = ?', [row.id], (err, ingredients) => {
        if (err) {
          console.error('GET /api/recipes: Fetch ingredients error:', err);
          return res.status(500).json({ error: err.message });
        }
        recipesWithIngredients.push({ ...row, ingredients });
        if (--remaining === 0) {
          console.log('GET /api/recipes: Success', { count: recipesWithIngredients.length });
          res.json(recipesWithIngredients);
        }
      });
    });
  });
});

router.post('/', (req, res) => {
  const { name, productId, ingredients, quantity, unit } = req.body;
  if (!name || !productId || !quantity || !unit || !Array.isArray(ingredients)) {
    console.error('POST /api/recipes: Missing required fields', { name, productId, quantity, unit, ingredients });
    return res.status(400).json({ error: 'Name, productId, quantity, unit, and ingredients array are required' });
  }
  if (ingredients.some(ing => !ing.itemName || !ing.quantity || !ing.unit)) {
    console.error('POST /api/recipes: Invalid ingredients', { ingredients });
    return res.status(400).json({ error: 'Each ingredient must have itemName, quantity, and unit' });
  }
  db.get('SELECT id FROM products WHERE id = ?', [productId], (err, product) => {
    if (err) {
      console.error('POST /api/recipes: Fetch product error:', err);
      return res.status(500).json({ error: err.message });
    }
    if (!product) {
      console.error('POST /api/recipes: Product not found', { productId });
      return res.status(400).json({ error: 'Invalid productId' });
    }
    db.serialize(() => {
      db.run('BEGIN TRANSACTION', (err) => {
        if (err) {
          console.error('POST /api/recipes: Begin transaction error:', err);
          return res.status(500).json({ error: err.message });
        }
        db.run(
          'INSERT INTO recipes (name, productId, quantity, unit) VALUES (?, ?, ?, ?)',
          [name, productId, quantity, unit],
          function(err) {
            if (err) {
              db.run('ROLLBACK');
              console.error('POST /api/recipes: Insert recipe error:', err);
              return res.status(500).json({ error: err.message });
            }
            const recipeId = this.lastID;
            let remaining = ingredients.length;
            const errors = [];
            ingredients.forEach(ing => {
              db.run(
                'INSERT INTO recipe_ingredients (recipeId, itemName, quantity, unit) VALUES (?, ?, ?, ?)',
                [recipeId, ing.itemName, ing.quantity, ing.unit],
                (err) => {
                  if (err) {
                    errors.push(`Failed to insert ingredient ${ing.itemName}: ${err.message}`);
                  }
                  if (--remaining === 0) {
                    if (errors.length > 0) {
                      db.run('ROLLBACK');
                      console.error('POST /api/recipes: Ingredient errors', errors);
                      return res.status(500).json({ error: errors.join('; ') });
                    }
                    db.run('COMMIT', (err) => {
                      if (err) {
                        db.run('ROLLBACK');
                        console.error('POST /api/recipes: Commit error:', err);
                        return res.status(500).json({ error: err.message });
                      }
                      db.get('SELECT * FROM recipes WHERE id = ?', [recipeId], (err, recipe) => {
                        if (err) {
                          console.error('POST /api/recipes: Fetch recipe error:', err);
                          return res.status(500).json({ error: err.message });
                        }
                        db.all('SELECT id, itemName, quantity, unit FROM recipe_ingredients WHERE recipeId = ?', [recipeId], (err, recipeIngredients) => {
                          if (err) {
                            console.error('POST /api/recipes: Fetch ingredients error:', err);
                            return res.status(500).json({ error: err.message });
                          }
                          console.log('POST /api/recipes: Success', { recipeId, name, productId });
                          res.json({ ...recipe, ingredients: recipeIngredients });
                        });
                      });
                    });
                  }
                }
              );
            });
          }
        );
      });
    });
  });
});

router.get('/:id', (req, res) => {
  const { id } = req.params;
  db.get(`
    SELECT r.*, p.name AS productName 
    FROM recipes r 
    JOIN products p ON r.productId = p.id 
    WHERE r.id = ?
  `, [id], (err, recipe) => {
    if (err) {
      console.error('GET /api/recipes/:id: Fetch error:', err);
      return res.status(500).json({ error: err.message });
    }
    if (!recipe) {
      console.error('GET /api/recipes/:id: Recipe not found', { id });
      return res.status(404).json({ error: 'Recipe not found' });
    }
    db.all('SELECT id, itemName, quantity, unit FROM recipe_ingredients WHERE recipeId = ?', [id], (err, ingredients) => {
      if (err) {
        console.error('GET /api/recipes/:id: Fetch ingredients error:', err);
        return res.status(500).json({ error: err.message });
      }
      console.log('GET /api/recipes/:id: Success', { id, name: recipe.name });
      res.json({ ...recipe, ingredients });
    });
  });
});

router.patch('/:id', (req, res) => {
  const { id } = req.params;
  const { name, productId, quantity, unit, ingredients } = req.body;
  if (!name || !productId || !quantity || !unit || !Array.isArray(ingredients)) {
    console.error('PATCH /api/recipes/:id: Missing required fields', { name, productId, quantity, unit, ingredients });
    return res.status(400).json({ error: 'Name, productId, quantity, unit, and ingredients array are required' });
  }
  if (ingredients.some(ing => !ing.itemName || !ing.quantity || !ing.unit)) {
    console.error('PATCH /api/recipes/:id: Invalid ingredients', { ingredients });
    return res.status(400).json({ error: 'Each ingredient must have itemName, quantity, and unit' });
  }
  db.get('SELECT id FROM products WHERE id = ?', [productId], (err, product) => {
    if (err) {
      console.error('PATCH /api/recipes/:id: Fetch product error:', err);
      return res.status(500).json({ error: err.message });
    }
    if (!product) {
      console.error('PATCH /api/recipes/:id: Product not found', { productId });
      return res.status(400).json({ error: 'Invalid productId' });
    }
    db.get('SELECT id FROM recipes WHERE id = ?', [id], (err, recipe) => {
      if (err) {
        console.error('PATCH /api/recipes/:id: Fetch recipe error:', err);
        return res.status(500).json({ error: err.message });
      }
      if (!recipe) {
        console.error('PATCH /api/recipes/:id: Recipe not found', { id });
        return res.status(404).json({ error: 'Recipe not found' });
      }
      db.serialize(() => {
        db.run('BEGIN TRANSACTION', (err) => {
          if (err) {
            console.error('PATCH /api/recipes/:id: Begin transaction error:', err);
            return res.status(500).json({ error: err.message });
          }
          db.run(
            'UPDATE recipes SET name = ?, productId = ?, quantity = ?, unit = ? WHERE id = ?',
            [name, productId, quantity, unit, id],
            (err) => {
              if (err) {
                db.run('ROLLBACK');
                console.error('PATCH /api/recipes/:id: Update recipe error:', err);
                return res.status(500).json({ error: err.message });
              }
              db.run('DELETE FROM recipe_ingredients WHERE recipeId = ?', [id], (err) => {
                if (err) {
                  db.run('ROLLBACK');
                  console.error('PATCH /api/recipes/:id: Delete ingredients error:', err);
                  return res.status(500).json({ error: err.message });
                }
                let remaining = ingredients.length;
                const errors = [];
                ingredients.forEach(ing => {
                  db.run(
                    'INSERT INTO recipe_ingredients (recipeId, itemName, quantity, unit) VALUES (?, ?, ?, ?)',
                    [id, ing.itemName, ing.quantity, ing.unit],
                    (err) => {
                      if (err) {
                        errors.push(`Failed to insert ingredient ${ing.itemName}: ${err.message}`);
                      }
                      if (--remaining === 0) {
                        if (errors.length > 0) {
                          db.run('ROLLBACK');
                          console.error('PATCH /api/recipes/:id: Ingredient errors', errors);
                          return res.status(500).json({ error: errors.join('; ') });
                        }
                        db.run('COMMIT', (err) => {
                          if (err) {
                            db.run('ROLLBACK');
                            console.error('PATCH /api/recipes/:id: Commit error:', err);
                            return res.status(500).json({ error: err.message });
                          }
                          db.get('SELECT * FROM recipes WHERE id = ?', [id], (err, updatedRecipe) => {
                            if (err) {
                              console.error('PATCH /api/recipes/:id: Fetch recipe error:', err);
                              return res.status(500).json({ error: err.message });
                            }
                            db.all('SELECT id, itemName, quantity, unit FROM recipe_ingredients WHERE recipeId = ?', [id], (err, recipeIngredients) => {
                              if (err) {
                                console.error('PATCH /api/recipes/:id: Fetch ingredients error:', err);
                                return res.status(500).json({ error: err.message });
                              }
                              console.log('PATCH /api/recipes/:id: Success', { id, name });
                              res.json({ ...updatedRecipe, ingredients: recipeIngredients });
                            });
                          });
                        });
                      }
                    }
                  );
                });
              });
            }
          );
        });
      });
    });
  });
});

router.delete('/:id', (req, res) => {
  const { id } = req.params;
  db.get('SELECT id FROM recipes WHERE id = ?', [id], (err, recipe) => {
    if (err) {
      console.error('DELETE /api/recipes/:id: Fetch recipe error:', err);
      return res.status(500).json({ error: err.message });
    }
    if (!recipe) {
      console.error('DELETE /api/recipes/:id: Recipe not found', { id });
      return res.status(404).json({ error: 'Recipe not found' });
    }
    db.serialize(() => {
      db.run('BEGIN TRANSACTION', (err) => {
        if (err) {
          console.error('DELETE /api/recipes/:id: Begin transaction error:', err);
          return res.status(500).json({ error: err.message });
        }
        db.run('DELETE FROM recipe_ingredients WHERE recipeId = ?', [id], (err) => {
          if (err) {
            db.run('ROLLBACK');
            console.error('DELETE /api/recipes/:id: Delete ingredients error:', err);
            return res.status(500).json({ error: err.message });
          }
          db.run('DELETE FROM recipes WHERE id = ?', [id], (err) => {
            if (err) {
              db.run('ROLLBACK');
              console.error('DELETE /api/recipes/:id: Delete recipe error:', err);
              return res.status(500).json({ error: err.message });
            }
            db.run('COMMIT', (err) => {
              if (err) {
                db.run('ROLLBACK');
                console.error('DELETE /api/recipes/:id: Commit error:', err);
                return res.status(500).json({ error: err.message });
              }
              console.log('DELETE /api/recipes/:id: Success', { id });
              res.json({ message: 'Recipe deleted successfully' });
            });
          });
        });
      });
    });
  });
});

module.exports = router;