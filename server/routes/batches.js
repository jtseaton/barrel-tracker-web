const express = require('express');
const { db, OUR_DSP } = require('../services/database');
const { packageVolumes } = require('../services/xml-parser');

const router = express.Router();

router.get('/', (req, res) => {
  const { status, page = 1, limit = 10, legacy = false } = req.query;
  let query = `
    SELECT b.batchId, b.productId, p.name AS productName, b.recipeId, r.name AS recipeName, 
           b.siteId, s.name AS siteName, b.status, b.date
    FROM batches b
    JOIN products p ON b.productId = p.id
    JOIN recipes r ON b.recipeId = r.id
    JOIN sites s ON b.siteId = s.siteId
  `;
  let countQuery = `SELECT COUNT(*) as total FROM batches WHERE 1=1`;
  let params = [];
  let countParams = [];
  if (status) {
    query += ' WHERE b.status = ?';
    countQuery += ' AND status = ?';
    params.push(status);
    countParams.push(status);
  }
  if (legacy === 'true') {
    db.all(query, params, (err, rows) => {
      if (err) {
        console.error('GET /api/batches: Fetch error:', err);
        return res.status(500).json({ error: err.message });
      }
      console.log('GET /api/batches (legacy): Success', { count: rows.length });
      res.json(rows);
    });
  } else {
    const offset = (parseInt(page) - 1) * parseInt(limit);
    query += ' LIMIT ? OFFSET ?';
    params.push(parseInt(limit), offset);
    db.get(countQuery, countParams, (err, countResult) => {
      if (err) {
        console.error('GET /api/batches: Count error:', err);
        return res.status(500).json({ error: err.message });
      }
      const totalBatches = countResult.total;
      const totalPages = Math.ceil(totalBatches / parseInt(limit));
      db.all(query, params, (err, rows) => {
        if (err) {
          console.error('GET /api/batches: Fetch error:', err);
          return res.status(500).json({ error: err.message });
        }
        console.log('GET /api/batches: Success', { count: rows.length, page, limit, totalPages });
        res.json({ batches: rows, totalPages });
      });
    });
  }
});

router.post('/', (req, res) => {
  const { batchId, productId, recipeId, siteId, fermenterId, status, date, volume, batchType } = req.body;
  console.log('POST /api/batches:', { batchId, productId, recipeId, siteId, fermenterId, status, date, volume, batchType });
  if (!batchId || !productId || !recipeId || !siteId) {
    console.error('POST /api/batches: Missing required fields', { batchId, productId, recipeId, siteId });
    return res.status(400).json({ error: 'batchId, productId, recipeId, and siteId are required' });
  }
  if (volume !== undefined && (isNaN(parseFloat(volume)) || parseFloat(volume) <= 0)) {
    console.error('POST /api/batches: Invalid volume', { volume });
    return res.status(400).json({ error: 'Volume must be a positive number if provided' });
  }
  db.all('SELECT itemName, quantity, unit FROM recipe_ingredients WHERE recipeId = ?', [parseInt(recipeId)], (err, ingredients) => {
    if (err) {
      console.error('POST /api/batches: Fetch ingredients error:', err);
      return res.status(500).json({ error: err.message });
    }
    console.log('POST /api/batches: Ingredients', ingredients);
    const errors = [];
    let pending = ingredients.length;
    if (!pending) {
      insertBatch();
      return;
    }
    for (const ing of ingredients) {
      const inventoryItemName = ing.itemName;
      const recipeUnit = ing.unit.toLowerCase() === 'pounds' ? 'lbs' : ing.unit.toLowerCase();
      db.all(
        'SELECT identifier, quantity, unit, receivedDate, account, status, siteId, locationId FROM inventory WHERE identifier = ? AND siteId = ? AND status = ?',
        [inventoryItemName, siteId, 'Stored'],
        (err, rows) => {
          if (err) {
            console.error('POST /api/batches: Inventory check error:', err);
            return res.status(500).json({ error: err.message });
          }
          console.log('POST /api/batches: Inventory query', {
            item: inventoryItemName,
            siteId,
            status: 'Stored',
            rows: rows.map(r => ({ identifier: r.identifier, account: r.account, status: r.status, siteId: r.siteId, locationId: r.locationId, quantity: r.quantity, unit: r.unit })),
          });
          const totalAvailable = rows.reduce((sum, row) => {
            const inventoryUnit = row.unit.toLowerCase() === 'pounds' ? 'lbs' : row.unit.toLowerCase();
            return inventoryUnit === recipeUnit ? sum + parseFloat(row.quantity) : sum;
          }, 0);
          console.log('POST /api/batches: Inventory check', {
            item: inventoryItemName,
            unit: recipeUnit,
            available: totalAvailable,
            needed: ing.quantity,
            rows,
          });
          if (totalAvailable < ing.quantity) {
            errors.push(
              `Insufficient inventory for ${ing.itemName}: ${totalAvailable}${recipeUnit} available, ${ing.quantity}${recipeUnit} needed`
            );
          }
          pending--;
          if (pending === 0) {
            if (errors.length > 0) {
              console.log('POST /api/batches: Validation errors', errors);
              return res.status(400).json({ error: errors.join('; ') });
            }
            insertBatch();
          }
        }
      );
    }
    function insertBatch() {
      db.run(
        'INSERT INTO batches (batchId, productId, recipeId, siteId, fermenterId, status, date, volume, batchType) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [batchId, productId, parseInt(recipeId), siteId, fermenterId || null, status || 'In Progress', date || new Date().toISOString().split('T')[0], volume || null, batchType || null],
        (err) => {
          if (err) {
            console.error('POST /api/batches: Insert error:', err);
            return res.status(500).json({ error: err.message });
          }
          console.log('POST /api/batches: Success', { batchId, volume });
          res.json({ batchId });
        }
      );
    }
  });
});

router.post('/:batchId/ingredients', (req, res) => {
  const { batchId } = req.params;
  const { itemName, quantity, unit, isRecipe, proof, proofGallons } = req.body;
  console.log('POST /api/batches/:batchId/ingredients: Received', { batchId, itemName, quantity, unit, isRecipe, proof, proofGallons });
  if (!itemName || !quantity || quantity <= 0 || !unit) {
    console.error('POST /api/batches/:batchId/ingredients: Invalid input', { itemName, quantity, unit });
    return res.status(400).json({ error: 'Valid itemName, quantity, and unit required' });
  }
  db.get('SELECT siteId, status FROM batches WHERE batchId = ?', [batchId], (err, batch) => {
    if (err) {
      console.error('POST /api/batches/:batchId/ingredients: Fetch batch error:', err);
      return res.status(500).json({ error: err.message });
    }
    if (!batch) {
      console.error('POST /api/batches/:batchId/ingredients: Batch not found', { batchId });
      return res.status(404).json({ error: 'Batch not found' });
    }
    if (batch.status === 'Completed') {
      console.error('POST /api/batches/:batchId/ingredients: Cannot modify completed batch', { batchId });
      return res.status(400).json({ error: 'Cannot modify a completed batch' });
    }
    const siteId = batch.siteId;
    db.get('SELECT name FROM items WHERE name = ?', [itemName], (err, item) => {
      if (err) {
        console.error('POST /api/batches/:batchId/ingredients: Fetch item error:', err);
        return res.status(500).json({ error: err.message });
      }
      if (!item) {
        console.error('POST /api/batches/:batchId/ingredients: Item not found', { itemName });
        return res.status(400).json({ error: `Item not found: ${itemName}` });
      }
      const normalizedUnit = unit.toLowerCase() === 'pounds' ? 'lbs' : unit.toLowerCase();
      console.log(`POST /api/batches/:batchId/ingredients: Checking inventory`, { itemName, unit: normalizedUnit, siteId });
      db.get(
        'SELECT SUM(CAST(quantity AS REAL)) as total FROM inventory WHERE identifier = ? AND LOWER(unit) IN (?, ?) AND siteId = ?',
        [itemName, normalizedUnit, 'pounds', siteId],
        (err, row) => {
          if (err) {
            console.error('POST /api/batches/:batchId/ingredients: Inventory check error:', err);
            return res.status(500).json({ error: err.message });
          }
          const available = row && row.total ? parseFloat(row.total) : 0;
          console.log(`POST /api/batches/:batchId/ingredients: Inventory result`, { itemName, available, needed: quantity });
          if (available < quantity) {
            return res.status(400).json({ error: `Insufficient inventory for ${itemName}: ${available}${normalizedUnit} available, ${quantity}${normalizedUnit} needed` });
          }
          db.get('SELECT additionalIngredients FROM batches WHERE batchId = ?', [batchId], (err, batchRow) => {
            if (err) {
              console.error('POST /api/batches/:batchId/ingredients: Fetch batch error:', err);
              return res.status(500).json({ error: err.message });
            }
            let additionalIngredients = batchRow.additionalIngredients ? JSON.parse(batchRow.additionalIngredients) : [];
            console.log(`POST /api/batches/:batchId/ingredients: Current additionalIngredients`, additionalIngredients);
            additionalIngredients = additionalIngredients.filter(
              ing => !ing.excluded || (ing.excluded && ing.itemName !== itemName) || (ing.quantity && ing.quantity > 0)
            );
            additionalIngredients.push({ itemName, quantity, unit: normalizedUnit, isRecipe: !!isRecipe, proof: proof || null, proofGallons: proofGallons || null });
            console.log(`POST /api/batches/:batchId/ingredients: New additionalIngredients`, additionalIngredients);
            db.run(
              'UPDATE batches SET additionalIngredients = ? WHERE batchId = ?',
              [JSON.stringify(additionalIngredients), batchId],
              (err) => {
                if (err) {
                  console.error('POST /api/batches/:batchId/ingredients: Update batch error:', err);
                  return res.status(500).json({ error: err.message });
                }
                db.run(
                  'UPDATE inventory SET quantity = quantity - ? WHERE identifier = ? AND LOWER(unit) IN (?, ?) AND siteId = ?',
                  [quantity, itemName, normalizedUnit, 'pounds', siteId],
                  (err) => {
                    if (err) {
                      console.error('POST /api/batches/:batchId/ingredients: Update inventory error:', err);
                      return res.status(500).json({ error: err.message });
                    }
                    console.log(`POST /api/batches/:batchId/ingredients: Inventory updated`, { itemName, quantity, unit: normalizedUnit, siteId });
                    db.get(`
                      SELECT b.batchId, b.productId, p.name AS productName, b.recipeId, r.name AS recipeName,
                             b.siteId, s.name AS siteName, b.status, b.date, r.ingredients, b.additionalIngredients, b.equipmentId, b.fermenterId, b.volume
                      FROM batches b
                      JOIN products p ON b.productId = p.id
                      JOIN recipes r ON b.recipeId = r.id
                      JOIN sites s ON b.siteId = s.siteId
                      WHERE b.batchId = ?
                    `, [batchId], (err, updatedBatch) => {
                      if (err) {
                        console.error('POST /api/batches/:batchId/ingredients: Fetch updated batch error:', err);
                        return res.status(500).json({ error: err.message });
                      }
                      const recipeIngredients = JSON.parse(updatedBatch.ingredients || '[]');
                      const additionalIngredients = JSON.parse(updatedBatch.additionalIngredients || '[]');
                      updatedBatch.ingredients = [
                        ...recipeIngredients.map(ing => ({ ...ing, isRecipe: true })),
                        ...additionalIngredients.filter(ing => !ing.excluded && (!ing.quantity || ing.quantity > 0)).map(ing => ({ ...ing, isRecipe: ing.isRecipe || false })),
                      ];
                      updatedBatch.additionalIngredients = additionalIngredients;
                      console.log(`POST /api/batches/:batchId/ingredients: Success`, { itemName, quantity, unit: normalizedUnit, isRecipe });
                      res.json(updatedBatch);
                    });
                  }
                );
              }
            );
          });
        }
      );
    });
  });
});

router.post('/:batchId/equipment', (req, res) => {
  const { batchId } = req.params;
  const { equipmentId, stage } = req.body;
  console.log('POST /api/batches/:batchId/equipment: Received request', { batchId, equipmentId, stage });
  if (!stage) {
    console.error('POST /api/batches/:batchId/equipment: Missing stage', { batchId, equipmentId, stage });
    return res.status(400).json({ error: 'stage is required' });
  }
  if (stage !== 'Completed' && stage !== 'Packaging' && !equipmentId) {
    console.error('POST /api/batches/:batchId/equipment: Missing equipmentId for non-Completed/Packaging stage', { batchId, equipmentId, stage });
    return res.status(400).json({ error: 'equipmentId is required for Brewing, Fermentation, and Filtering/Carbonating stages' });
  }
  const validStages = ['Brewing', 'Fermentation', 'Filtering/Carbonating', 'Packaging', 'Completed'];
  if (!validStages.includes(stage)) {
    console.error('POST /api/batches/:batchId/equipment: Invalid stage', { batchId, stage });
    return res.status(400).json({ error: `Invalid stage. Must be one of: ${validStages.join(', ')}` });
  }
  db.get('SELECT siteId, stage, equipmentId, status FROM batches WHERE batchId = ?', [batchId], (err, batch) => {
    if (err) {
      console.error('POST /api/batches/:batchId/equipment: Fetch batch error:', err);
      return res.status(500).json({ error: err.message });
    }
    if (!batch) {
      console.error('POST /api/batches/:batchId/equipment: Batch not found', { batchId });
      return res.status(404).json({ error: 'Batch not found' });
    }
    if (batch.status === 'Completed') {
      console.error('POST /api/batches/:batchId/equipment: Cannot modify completed batch', { batchId });
      return res.status(400).json({ error: 'Cannot modify a completed batch' });
    }
    const currentStage = batch.stage || null;
    const currentStageIndex = currentStage ? validStages.indexOf(currentStage) : -1;
    const newStageIndex = validStages.indexOf(stage);
    if (currentStage && newStageIndex <= currentStageIndex) {
      console.error('POST /api/batches/:batchId/equipment: Cannot regress stage', { batchId, currentStage, newStage: stage });
      return res.status(400).json({ error: `Cannot regress from ${currentStage} to ${stage}` });
    }
    const validateEquipment = (callback) => {
      if (!equipmentId || stage === 'Completed' || stage === 'Packaging') return callback();
      db.get('SELECT equipmentId, type FROM equipment WHERE equipmentId = ? AND siteId = ?', [equipmentId, batch.siteId], (err, equipment) => {
        if (err) {
          console.error('POST /api/batches/:batchId/equipment: Fetch equipment error:', err);
          return res.status(500).json({ error: err.message });
        }
        if (!equipment) {
          console.error('POST /api/batches/:batchId/equipment: Invalid equipmentId', { equipmentId, siteId: batch.siteId });
          return res.status(400).json({ error: `Invalid equipmentId: ${equipmentId} for site ${batch.siteId}` });
        }
        callback();
      });
    };
    validateEquipment(() => {
      db.run(
        `UPDATE batches SET equipmentId = ?, stage = ? WHERE batchId = ?`,
        [equipmentId || null, stage, batchId],
        (err) => {
          if (err) {
            console.error('POST /api/batches/:batchId/equipment: Update error:', err);
            return res.status(500).json({ error: err.message });
          }
          console.log(`POST /api/batches/:batchId/equipment: Updated batch ${batchId} to equipmentId=${equipmentId || null}, stage=${stage}`);
          res.json({ message: 'Batch equipment and stage updated successfully', equipmentId: equipmentId || null, stage });
        }
      );
    });
  });
});

router.patch('/:batchId/equipment', (req, res) => {
  const { batchId } = req.params;
  const { equipmentId } = req.body;
  if (!equipmentId) {
    return res.status(400).json({ error: 'equipmentId required' });
  }
  db.get('SELECT siteId FROM batches WHERE batchId = ?', [batchId], (err, batch) => {
    if (err) {
      console.error('PATCH /api/batches/:batchId/equipment: Fetch batch error:', err);
      return res.status(500).json({ error: err.message });
    }
    if (!batch) {
      return res.status(404).json({ error: 'Batch not found' });
    }
    db.get('SELECT equipmentId FROM equipment WHERE equipmentId = ? AND siteId = ?', [equipmentId, batch.siteId], (err, equipment) => {
      if (err) {
        console.error('PATCH /api/batches/:batchId/equipment: Fetch equipment error:', err);
        return res.status(500).json({ error: err.message });
      }
      if (!equipment) {
        return res.status(400).json({ error: `Invalid equipmentId: ${equipmentId} for site ${batch.siteId}` });
      }
      db.run(
        'UPDATE batches SET equipmentId = ? WHERE batchId = ?',
        [equipmentId, batchId],
        (err) => {
          if (err) {
            console.error('PATCH /api/batches/:batchId/equipment: Update batch equipment error:', err);
            return res.status(500).json({ error: err.message });
          }
          console.log(`PATCH /api/batches/${batchId}/equipment: Updated equipmentId:`, equipmentId);
          db.get(`
            SELECT b.batchId, b.productId, p.name AS productName, b.recipeId, r.name AS recipeName, 
                   b.siteId, s.name AS siteName, b.status, b.date, r.ingredients, b.additionalIngredients, b.equipmentId
            FROM batches b
            JOIN products p ON b.productId = p.id
            JOIN recipes r ON b.recipeId = r.id
            JOIN sites s ON b.siteId = s.siteId
            WHERE b.batchId = ?
          `, [batchId], (err, updatedBatch) => {
            if (err) {
              console.error('PATCH /api/batches/:batchId/equipment: Fetch updated batch error:', err);
              return res.status(500).json({ error: err.message });
            }
            const recipeIngredients = JSON.parse(updatedBatch.ingredients || '[]');
            const additionalIngredients = JSON.parse(updatedBatch.additionalIngredients || '[]');
            updatedBatch.ingredients = [
              ...recipeIngredients.map(ing => ({ ...ing, isRecipe: true })),
              ...additionalIngredients.filter(ing => !ing.excluded && (!ing.quantity || ing.quantity > 0)).map(ing => ({ ...ing, isRecipe: false }))
            ];
            updatedBatch.additionalIngredients = additionalIngredients;
            res.json(updatedBatch);
          });
        }
      );
    });
  });
});

router.get('/:batchId', (req, res) => {
  const { batchId } = req.params;
  db.get(`
    SELECT b.batchId, b.productId, p.name AS productName, b.recipeId, r.name AS recipeName, 
           b.siteId, s.name AS siteName, b.status, b.date, r.ingredients, b.additionalIngredients, b.equipmentId, b.volume, b.stage
    FROM batches b
    JOIN products p ON b.productId = p.id
    JOIN recipes r ON b.recipeId = r.id
    JOIN sites s ON b.siteId = s.siteId
    WHERE b.batchId = ?
  `, [batchId], (err, row) => {
    if (err) {
      console.error('GET /api/batches/:batchId: Fetch batch error:', err);
      return res.status(500).json({ error: err.message });
    }
    if (!row) {
      console.log(`GET /api/batches/${batchId}: Batch not found`);
      return res.status(404).json({ error: 'Batch not found' });
    }
    const recipeIngredients = JSON.parse(row.ingredients || '[]');
    const additionalIngredients = JSON.parse(row.additionalIngredients || '[]');
    const activeRecipeIngredients = recipeIngredients.filter(
      (ing) => !additionalIngredients.some(
        (override) => override.itemName === ing.itemName && 
                      (override.unit || 'lbs').toLowerCase() === (ing.unit || 'lbs').toLowerCase() && 
                      override.excluded === true &&
                      (override.quantity === ing.quantity || override.quantity === undefined)
      )
    );
    const filteredAdditionalIngredients = additionalIngredients.filter(
      ing => !ing.excluded && (!ing.quantity || ing.quantity > 0)
    );
    const combinedIngredients = [
      ...activeRecipeIngredients.map(ing => ({ ...ing, isRecipe: true })),
      ...filteredAdditionalIngredients.map(ing => ({ ...ing, isRecipe: false }))
    ];
    const batch = {
      ...row,
      ingredients: combinedIngredients,
      additionalIngredients,
      stage: row.stage || null
    };
    console.log(`GET /api/batches/${batchId}: RecipeIngredients`, recipeIngredients);
    console.log(`GET /api/batches/${batchId}: AdditionalIngredients`, additionalIngredients);
    console.log(`GET /api/batches/${batchId}: ActiveRecipeIngredients`, activeRecipeIngredients);
    console.log(`GET /api/batches/${batchId}: FilteredAdditionalIngredients`, filteredAdditionalIngredients);
    console.log(`GET /api/batches/${batchId}: CombinedIngredients`, combinedIngredients);
    console.log(`GET /api/batches/${batchId}: Returning`, batch);
    res.json(batch);
  });
});

router.get('/:batchId/package', (req, res) => {
  const { batchId } = req.params;
  console.log('GET /api/batches/:batchId/package: Fetching packaging actions', { batchId });
  db.all(
    `SELECT id, batchId, packageType, quantity, volume, locationId, date, siteId, kegCodes
     FROM batch_packaging
     WHERE batchId = ?`,
    [batchId],
    (err, rows) => {
      if (err) {
        console.error('GET /api/batches/:batchId/package: Fetch packaging error:', err);
        return res.status(500).json({ error: `Failed to fetch packaging: ${err.message}` });
      }
      console.log('GET /api/batches/:batchId/package: Success', { batchId, count: rows.length });
      res.json(rows.map(row => ({
        ...row,
        kegCodes: row.kegCodes ? JSON.parse(row.kegCodes) : null
      })));
    }
  );
});

router.post('/:batchId/package', (req, res) => {
  const { batchId } = req.params;
  const { packageType, quantity, locationId, kegCodes } = req.body;
  console.log('POST /api/batches/:batchId/package: Received request', { batchId, packageType, quantity, locationId, kegCodes });

  if (!packageType || !quantity || quantity <= 0 || !locationId) {
    console.error('POST /api/batches/:batchId/package: Missing required fields', { batchId, packageType, quantity, locationId });
    return res.status(400).json({ error: 'packageType, quantity (> 0), and locationId are required' });
  }
  if (!packageVolumes[packageType]) {
    console.error('POST /api/batches/:batchId/package: Invalid packageType', { packageType });
    return res.status(400).json({ error: `Invalid packageType. Must be one of: ${Object.keys(packageVolumes).join(', ')}` });
  }
  if (packageType.includes('Keg') && kegCodes && (!Array.isArray(kegCodes) || kegCodes.some(code => !/^[A-Z0-9-]+$/.test(code)))) {
    console.error('POST /api/batches/:batchId/package: Invalid kegCodes', { kegCodes });
    return res.status(400).json({ error: 'kegCodes must be an array of valid codes (e.g., KEG-001)' });
  }

  db.get(
    `SELECT b.volume, b.siteId, p.name AS productName, p.id AS productId, b.status
     FROM batches b
     JOIN products p ON b.productId = p.id
     WHERE b.batchId = ?`,
    [batchId],
    (err, batch) => {
      if (err) {
        console.error('POST /api/batches/:batchId/package: Fetch batch error:', err);
        return res.status(500).json({ error: `Failed to fetch batch: ${err.message}` });
      }
      if (!batch) {
        console.error('POST /api/batches/:batchId/package: Batch not found', { batchId });
        return res.status(404).json({ error: 'Batch not found' });
      }
      if (batch.status === 'Completed') {
        console.error('POST /api/batches/:batchId/package: Cannot modify completed batch', { batchId });
        return res.status(400).json({ error: 'Cannot modify a completed batch' });
      }
      if (batch.volume === null || batch.volume === undefined) {
        console.error('POST /api/batches/:batchId/package: Batch volume not set', { batchId });
        return res.status(400).json({ error: 'Batch volume not set' });
      }

      const volumeUsed = packageVolumes[packageType] * quantity;
      const availableVolume = parseFloat(batch.volume);
      const tolerance = 0.01;
      if (volumeUsed > availableVolume + tolerance) {
        const shortfall = volumeUsed - availableVolume;
        console.log('POST /api/batches/:batchId/package: Volume adjustment needed', { batchId, volumeUsed, availableVolume, shortfall });
        return res.status(200).json({
          prompt: 'volumeAdjustment',
          message: `${volumeUsed.toFixed(3)} barrels needed, ${availableVolume.toFixed(3)} barrels available. Increase batch volume by ${shortfall.toFixed(3)} barrels?`,
          shortfall,
        });
      }

      db.get(
        `SELECT locationId FROM locations WHERE locationId = ? AND siteId = ?`,
        [locationId, batch.siteId],
        (err, location) => {
          if (err) {
            console.error('POST /api/batches/:batchId/package: Fetch location error:', err);
            return res.status(500).json({ error: `Failed to fetch location: ${err.message}` });
          }
          if (!location) {
            console.error('POST /api/batches/:batchId/package: Invalid locationId', { locationId, siteId: batch.siteId });
            return res.status(400).json({ error: `Invalid locationId: ${locationId} for site ${batch.siteId}` });
          }

          const newIdentifier = `${batch.productName} ${packageType}`;
          db.get(
            `SELECT name FROM items WHERE name = ? AND type = ? AND enabled = 1`,
            [newIdentifier, 'Finished Goods'],
            (err, item) => {
              if (err) {
                console.error('POST /api/batches/:batchId/package: Fetch item error:', err);
                return res.status(500).json({ error: `Failed to check items: ${err.message}` });
              }
              if (!item) {
                console.error('POST /api/batches/:batchId/package: Item not found', { newIdentifier });
                return res.status(400).json({ error: `Item ${newIdentifier} not found. Ensure it is defined in product package types.` });
              }

              db.get(
                `SELECT ppt.price, ppt.isKegDepositItem 
                 FROM product_package_types ppt 
                 JOIN products p ON ppt.productId = p.id 
                 WHERE p.name = ? AND ppt.type = ?`,
                [batch.productName, packageType],
                (err, priceRow) => {
                  if (err) {
                    console.error('POST /api/batches/:batchId/package: Fetch price error:', err);
                    return res.status(500).json({ error: `Failed to fetch price for ${newIdentifier}: ${err.message}` });
                  }
                  if (!priceRow) {
                    console.error('POST /api/batches/:batchId/package: Price not found', { productName: batch.productName, packageType });
                    return res.status(400).json({ error: `Price not found for ${newIdentifier}. Ensure it is defined in product package types.` });
                  }

                  db.serialize(() => {
                    db.run('BEGIN TRANSACTION', (err) => {
                      if (err) {
                        console.error('POST /api/batches/:batchId/package: Begin transaction error:', err);
                        return res.status(500).json({ error: `Failed to start transaction: ${err.message}` });
                      }

                      const validateAndUpdateKegs = (callback) => {
                        if (!kegCodes || kegCodes.length === 0 || !packageType.includes('Keg')) {
                          return callback();
                        }
                        if (kegCodes.length !== quantity) {
                          db.run('ROLLBACK');
                          console.error('POST /api/batches/:batchId/package: Keg codes mismatch', { kegCodesLength: kegCodes.length, quantity });
                          return res.status(400).json({ error: `Number of keg codes (${kegCodes.length}) must match quantity (${quantity})` });
                        }
                        let remainingKegs = kegCodes.length;
                        kegCodes.forEach((code, index) => {
                          db.get('SELECT id, status, productId FROM kegs WHERE code = ?', [code], (err, keg) => {
                            if (err) {
                              db.run('ROLLBACK');
                              console.error('POST /api/batches/:batchId/package: Fetch keg error:', err);
                              return res.status(500).json({ error: `Failed to fetch keg ${code}: ${err.message}` });
                            }
                            if (!keg) {
                              db.run('ROLLBACK');
                              console.error('POST /api/batches/:batchId/package: Keg not found', { code });
                              return res.status(400).json({ error: `Keg not found: ${code}` });
                            }
                            if (keg.status !== 'Empty') {
                              db.run('ROLLBACK');
                              console.error('POST /api/batches/:batchId/package: Keg not empty', { code, status: keg.status });
                              return res.status(400).json({ error: `Keg ${code} is not empty (status: ${keg.status})` });
                            }
                            db.run(
                              `UPDATE kegs SET status = ?, productId = ?, lastScanned = ?, locationId = ?, customerId = NULL 
                               WHERE code = ?`,
                              ['Filled', batch.productId, new Date().toISOString().split('T')[0], locationId, code],
                              (err) => {
                                if (err) {
                                  db.run('ROLLBACK');
                                  console.error('POST /api/batches/:batchId/package: Update keg error:', err);
                                  return res.status(500).json({ error: `Failed to update keg ${code}: ${err.message}` });
                                }
                                db.run(
                                  `INSERT INTO keg_transactions (kegId, action, productId, batchId, date, location)
                                   VALUES ((SELECT id FROM kegs WHERE code = ?), ?, ?, ?, ?, ?)`,
                                  [code, 'Filled', batch.productId, batchId, new Date().toISOString().split('T')[0], `Location: ${locationId}`],
                                  (err) => {
                                    if (err) {
                                      db.run('ROLLBACK');
                                      console.error('POST /api/batches/:batchId/package: Insert keg transaction error:', err);
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

                      validateAndUpdateKegs(() => {
                        db.run(
                          `INSERT INTO batch_packaging (batchId, packageType, quantity, volume, locationId, date, siteId, kegCodes)
                           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                          [
                            batchId,
                            packageType,
                            quantity,
                            volumeUsed,
                            locationId,
                            new Date().toISOString().split('T')[0],
                            batch.siteId,
                            kegCodes ? JSON.stringify(kegCodes) : null,
                          ],
                          (err) => {
                            if (err) {
                              db.run('ROLLBACK');
                              console.error('POST /api/batches/:batchId/package: Insert packaging error:', err);
                              return res.status(500).json({ error: `Failed to record packaging: ${err.message}` });
                            }

                            const newVolume = availableVolume - volumeUsed;
                            db.run(
                              `UPDATE batches SET volume = ?, stage = ? WHERE batchId = ?`,
                              [newVolume, 'Packaging', batchId],
                              (err) => {
                                if (err) {
                                  db.run('ROLLBACK');
                                  console.error('POST /api/batches/:batchId/package: Update batch volume error:', err);
                                  return res.status(500).json({ error: `Failed to update batch volume: ${err.message}` });
                                }

                                db.get(
                                  `SELECT quantity FROM inventory WHERE identifier = ? AND type = ? AND account = ? AND siteId = ? AND locationId = ?`,
                                  [newIdentifier, 'Finished Goods', 'Storage', batch.siteId, locationId],
                                  (err, row) => {
                                    if (err) {
                                      db.run('ROLLBACK');
                                      console.error('POST /api/batches/:batchId/package: Fetch inventory error:', err);
                                      return res.status(500).json({ error: `Failed to check inventory: ${err.message}` });
                                    }

                                    if (row) {
                                      const newQuantity = parseFloat(row.quantity) + quantity;
                                      db.run(
                                        `UPDATE inventory SET quantity = ?, price = ?, isKegDepositItem = ? 
                                         WHERE identifier = ? AND type = ? AND account = ? AND siteId = ? AND locationId = ?`,
                                        [newQuantity, priceRow.price, priceRow.isKegDepositItem, newIdentifier, 'Finished Goods', 'Storage', batch.siteId, locationId],
                                        (err) => {
                                          if (err) {
                                            db.run('ROLLBACK');
                                            console.error('POST /api/batches/:batchId/package: Update inventory error:', err);
                                            return res.status(500).json({ error: `Failed to update inventory: ${err.message}` });
                                          }
                                          commitTransaction();
                                        }
                                      );
                                    } else {
                                      db.run(
                                        `INSERT INTO inventory (
                                          identifier, account, type, quantity, unit, price, isKegDepositItem, 
                                          receivedDate, source, siteId, locationId, status
                                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                                        [
                                          newIdentifier,
                                          'Storage',
                                          'Finished Goods',
                                          quantity,
                                          'Units',
                                          priceRow.price,
                                          priceRow.isKegDepositItem,
                                          new Date().toISOString().split('T')[0],
                                          'Packaged',
                                          batch.siteId,
                                          locationId,
                                          'Stored',
                                        ],
                                        (err) => {
                                          if (err) {
                                            db.run('ROLLBACK');
                                            console.error('POST /api/batches/:batchId/package: Insert inventory error:', err);
                                            return res.status(500).json({ error: `Failed to insert inventory: ${err.message}` });
                                          }
                                          commitTransaction();
                                        }
                                      );
                                    }

                                    function commitTransaction() {
                                      db.run('COMMIT', (err) => {
                                        if (err) {
                                          db.run('ROLLBACK');
                                          console.error('POST /api/batches/:batchId/package: Commit transaction error:', err);
                                          return res.status(500).json({ error: `Failed to commit transaction: ${err.message}` });
                                        }
                                        console.log('POST /api/batches/:batchId/package: Success', {
                                          batchId,
                                          newIdentifier,
                                          quantity,
                                          newVolume,
                                          kegCodes,
                                        });
                                        res.json({ message: 'Packaging successful', newIdentifier, quantity, newVolume });
                                      });
                                    }
                                  }
                                );
                              }
                            );
                          }
                        );
                      });
                    });
                  });
                }
              );
            }
          );
        }
      );
    }
  );
});

router.patch('/:batchId/package/:packageId', (req, res) => {
  const { batchId, packageId } = req.params;
  const { quantity } = req.body;
  console.log('PATCH /api/batches/:batchId/package/:packageId: Received request', { batchId, packageId, quantity });
  if (quantity === undefined || quantity < 0) {
    console.error('PATCH /api/batches/:batchId/package/:packageId: Invalid quantity', { quantity });
    return res.status(400).json({ error: 'Quantity must be a non-negative number' });
  }
  db.get(
    `SELECT bp.packageType, bp.quantity AS currentQuantity, bp.volume AS currentVolume, bp.locationId, bp.siteId,
            b.volume AS batchVolume, p.name AS productName, b.status
     FROM batch_packaging bp
     JOIN batches b ON bp.batchId = b.batchId
     JOIN products p ON b.productId = p.id
     WHERE bp.id = ? AND bp.batchId = ?`,
    [packageId, batchId],
    (err, row) => {
      if (err) {
        console.error('PATCH /api/batches/:batchId/package/:packageId: Fetch packaging error:', err);
        return res.status(500).json({ error: `Failed to fetch packaging: ${err.message}` });
      }
      if (!row) {
        console.error('PATCH /api/batches/:batchId/package/:packageId: Packaging record not found', { packageId, batchId });
        return res.status(404).json({ error: 'Packaging record not found' });
      }
      if (row.status === 'Completed') {
        console.error('PATCH /api/batches/:batchId/package/:packageId: Cannot modify completed batch', { batchId });
        return res.status(400).json({ error: 'Cannot modify a completed batch' });
      }
      const { packageType, currentQuantity, currentVolume, locationId, siteId, batchVolume, productName } = row;
      console.log('PATCH /api/batches/:batchId/package/:packageId: Current record', {
        packageType,
        currentQuantity,
        currentVolume,
        batchVolume,
        locationId,
        siteId,
        productName,
      });

      if (!packageVolumes[packageType]) {
        console.error('PATCH /api/batches/:batchId/package/:packageId: Invalid packageType', { packageType });
        return res.status(400).json({ error: `Invalid packageType: ${packageType}` });
      }

      const volumePerUnit = packageVolumes[packageType];
      const newVolume = quantity * volumePerUnit;
      const volumeDifference = currentVolume - newVolume;
      const newBatchVolume = parseFloat(batchVolume) + volumeDifference;

      console.log('PATCH /api/batches/:batchId/package/:packageId: Volume calculation', {
        currentQuantity,
        newQuantity: quantity,
        currentVolume,
        newVolume,
        volumeDifference,
        currentBatchVolume: batchVolume,
        newBatchVolume,
      });

      if (newBatchVolume < 0) {
        console.error('PATCH /api/batches/:batchId/package/:packageId: Insufficient batch volume', {
          requiredVolume: newVolume,
          availableVolume: batchVolume,
          shortfall: -newBatchVolume,
        });
        return res.status(400).json({
          error: `Insufficient batch volume: ${newVolume.toFixed(3)} barrels required, ${batchVolume.toFixed(3)} available`,
        });
      }

      db.serialize(() => {
        db.run('BEGIN TRANSACTION', (err) => {
          if (err) {
            console.error('PATCH /api/batches/:batchId/package/:packageId: Begin transaction error:', err);
            return res.status(500).json({ error: `Failed to start transaction: ${err.message}` });
          }

          db.run(
            `UPDATE batch_packaging SET quantity = ?, volume = ? WHERE id = ? AND batchId = ?`,
            [quantity, newVolume, packageId, batchId],
            (err) => {
              if (err) {
                db.run('ROLLBACK');
                console.error('PATCH /api/batches/:batchId/package/:packageId: Update packaging error:', err);
                return res.status(500).json({ error: `Failed to update packaging: ${err.message}` });
              }
              console.log('PATCH /api/batches/:batchId/package/:packageId: Updated batch_packaging', {
                packageId,
                quantity,
                newVolume,
              });

              db.run(
                `UPDATE batches SET volume = ? WHERE batchId = ?`,
                [newBatchVolume, batchId],
                (err) => {
                  if (err) {
                    db.run('ROLLBACK');
                    console.error('PATCH /api/batches/:batchId/package/:packageId: Update batch volume error:', err);
                    return res.status(500).json({ error: `Failed to update batch volume: ${err.message}` });
                  }
                  console.log('PATCH /api/batches/:batchId/package/:packageId: Updated batch volume', {
                    batchId,
                    newBatchVolume,
                  });

                  const identifier = `${productName} ${packageType}`;
                  db.get(
                    `SELECT quantity FROM inventory WHERE identifier = ? AND type = ? AND account = ? AND siteId = ? AND locationId = ?`,
                    [identifier, 'Finished Goods', 'Storage', siteId, locationId],
                    (err, row) => {
                      if (err) {
                        db.run('ROLLBACK');
                        console.error('PATCH /api/batches/:batchId/package/:packageId: Fetch inventory error:', err);
                        return res.status(500).json({ error: `Failed to check inventory: ${err.message}` });
                      }
                      if (!row) {
                        db.run('ROLLBACK');
                        console.error('PATCH /api/batches/:batchId/package/:packageId: Inventory not found', {
                          identifier,
                          siteId,
                          locationId,
                        });
                        return res.status(404).json({ error: `Inventory item not found: ${identifier}` });
                      }

                      const newInventoryQuantity = parseFloat(row.quantity) + (quantity - currentQuantity);
                      console.log('PATCH /api/batches/:batchId/package/:packageId: Updating inventory', {
                        identifier,
                        currentInventoryQuantity: row.quantity,
                        quantityChange: quantity - currentQuantity,
                        newInventoryQuantity,
                      });

                      if (newInventoryQuantity < 0) {
                        db.run('ROLLBACK');
                        console.error('PATCH /api/batches/:batchId/package/:packageId: Negative inventory quantity', {
                          identifier,
                          newInventoryQuantity,
                        });
                        return res.status(400).json({ error: `Cannot reduce inventory below zero: ${identifier}` });
                      }

                      db.run(
                        `UPDATE inventory SET quantity = ? WHERE identifier = ? AND type = ? AND account = ? AND siteId = ? AND locationId = ?`,
                        [newInventoryQuantity, identifier, 'Finished Goods', 'Storage', siteId, locationId],
                        (err) => {
                          if (err) {
                            db.run('ROLLBACK');
                            console.error('PATCH /api/batches/:batchId/package/:packageId: Update inventory error:', err);
                            return res.status(500).json({ error: `Failed to update inventory: ${err.message}` });
                          }
                          console.log('PATCH /api/batches/:batchId/package/:packageId: Updated inventory', {
                            identifier,
                            newInventoryQuantity,
                          });

                          db.run('COMMIT', (err) => {
                            if (err) {
                              db.run('ROLLBACK');
                              console.error('PATCH /api/batches/:batchId/package/:packageId: Commit transaction error:', err);
                              return res.status(500).json({ error: `Failed to commit transaction: ${err.message}` });
                            }
                            console.log('PATCH /api/batches/:batchId/package/:packageId: Success', {
                              batchId,
                              packageId,
                              newQuantity: quantity,
                              newVolume,
                              newBatchVolume,
                              newInventoryQuantity,
                            });
                            res.json({ message: 'Packaging updated successfully', newBatchVolume });
                          });
                        }
                      );
                    }
                  );
                }
              );
            }
          );
        });
      });
    }
  );
});

router.delete('/:batchId/package/:packageId', (req, res) => {
  const { batchId, packageId } = req.params;
  console.log('DELETE /api/batches/:batchId/package/:packageId: Received request', { batchId, packageId });
  db.get(
    `SELECT bp.packageType, bp.quantity AS currentQuantity, bp.volume AS currentVolume, bp.locationId, bp.siteId,
            b.volume AS batchVolume, p.name AS productName, b.status
     FROM batch_packaging bp
     JOIN batches b ON bp.batchId = b.batchId
     JOIN products p ON b.productId = p.id
     WHERE bp.id = ? AND bp.batchId = ?`,
    [packageId, batchId],
    (err, row) => {
      if (err) {
        console.error('DELETE /api/batches/:batchId/package/:packageId: Fetch packaging error:', err);
        return res.status(500).json({ error: `Failed to fetch packaging: ${err.message}` });
      }
      if (!row) {
        console.error('DELETE /api/batches/:batchId/package/:packageId: Packaging record not found', { packageId, batchId });
        return res.status(404).json({ error: 'Packaging record not found' });
      }
      if (row.status === 'Completed') {
        console.error('DELETE /api/batches/:batchId/package/:packageId: Cannot modify completed batch', { batchId });
        return res.status(400).json({ error: 'Cannot modify a completed batch' });
      }
      const { packageType, currentQuantity, currentVolume, locationId, siteId, batchVolume, productName } = row;
      console.log('DELETE /api/batches/:batchId/package/:packageId: Current record', {
        packageType,
        currentQuantity,
        currentVolume,
        batchVolume,
        locationId,
        siteId,
        productName,
      });

      const newBatchVolume = parseFloat(batchVolume) + currentVolume;
      console.log('DELETE /api/batches/:batchId/package/:packageId: Volume calculation', {
        currentVolume,
        currentBatchVolume: batchVolume,
        newBatchVolume,
      });

      db.serialize(() => {
        db.run('BEGIN TRANSACTION', (err) => {
          if (err) {
            console.error('DELETE /api/batches/:batchId/package/:packageId: Begin transaction error:', err);
            return res.status(500).json({ error: `Failed to start transaction: ${err.message}` });
          }

          db.run(
            `DELETE FROM batch_packaging WHERE id = ? AND batchId = ?`,
            [packageId, batchId],
            (err) => {
              if (err) {
                db.run('ROLLBACK');
                console.error('DELETE /api/batches/:batchId/package/:packageId: Delete packaging error:', err);
                return res.status(500).json({ error: `Failed to delete packaging: ${err.message}` });
              }
              console.log('DELETE /api/batches/:batchId/package/:packageId: Deleted batch_packaging', { packageId });

              db.run(
                `UPDATE batches SET volume = ? WHERE batchId = ?`,
                [newBatchVolume, batchId],
                (err) => {
                  if (err) {
                    db.run('ROLLBACK');
                    console.error('DELETE /api/batches/:batchId/package/:packageId: Update batch volume error:', err);
                    return res.status(500).json({ error: `Failed to update batch volume: ${err.message}` });
                  }
                  console.log('DELETE /api/batches/:batchId/package/:packageId: Updated batch volume', {
                    batchId,
                    newBatchVolume,
                  });

                  const identifier = `${productName} ${packageType}`;
                  db.get(
                    `SELECT quantity FROM inventory WHERE identifier = ? AND type = ? AND account = ? AND siteId = ? AND locationId = ?`,
                    [identifier, 'Finished Goods', 'Storage', siteId, locationId],
                    (err, row) => {
                      if (err) {
                        db.run('ROLLBACK');
                        console.error('DELETE /api/batches/:batchId/package/:packageId: Fetch inventory error:', err);
                        return res.status(500).json({ error: `Failed to check inventory: ${err.message}` });
                      }
                      if (!row) {
                        db.run('ROLLBACK');
                        console.error('DELETE /api/batches/:batchId/package/:packageId: Inventory not found', {
                          identifier,
                          siteId,
                          locationId,
                        });
                        return res.status(404).json({ error: `Inventory item not found: ${identifier}` });
                      }

                      const newInventoryQuantity = parseFloat(row.quantity) - currentQuantity;
                      console.log('DELETE /api/batches/:batchId/package/:packageId: Updating inventory', {
                        identifier,
                        currentInventoryQuantity: row.quantity,
                        quantityChange: -currentQuantity,
                        newInventoryQuantity,
                      });

                      if (newInventoryQuantity < 0) {
                        db.run('ROLLBACK');
                        console.error('DELETE /api/batches/:batchId/package/:packageId: Negative inventory quantity', {
                          identifier,
                          newInventoryQuantity,
                        });
                        return res.status(400).json({ error: `Cannot reduce inventory below zero: ${identifier}` });
                      }

                      if (newInventoryQuantity === 0) {
                        db.run(
                          `DELETE FROM inventory WHERE identifier = ? AND type = ? AND account = ? AND siteId = ? AND locationId = ?`,
                          [identifier, 'Finished Goods', 'Storage', siteId, locationId],
                          (err) => {
                            if (err) {
                              db.run('ROLLBACK');
                              console.error('DELETE /api/batches/:batchId/package/:packageId: Delete inventory error:', err);
                              return res.status(500).json({ error: `Failed to delete inventory: ${err.message}` });
                            }
                            console.log('DELETE /api/batches/:batchId/package/:packageId: Deleted inventory', { identifier });

                            db.run('COMMIT', (err) => {
                              if (err) {
                                db.run('ROLLBACK');
                                console.error('DELETE /api/batches/:batchId/package/:packageId: Commit transaction error:', err);
                                return res.status(500).json({ error: `Failed to commit transaction: ${err.message}` });
                              }
                              console.log('DELETE /api/batches/:batchId/package/:packageId: Success', {
                                batchId,
                                packageId,
                                newBatchVolume,
                              });
                              res.json({ message: 'Packaging action deleted successfully', newBatchVolume });
                            });
                          }
                        );
                      } else {
                        db.run(
                          `UPDATE inventory SET quantity = ? WHERE identifier = ? AND type = ? AND account = ? AND siteId = ? AND locationId = ?`,
                          [newInventoryQuantity, identifier, 'Finished Goods', 'Storage', siteId, locationId],
                          (err) => {
                            if (err) {
                              db.run('ROLLBACK');
                              console.error('DELETE /api/batches/:batchId/package/:packageId: Update inventory error:', err);
                              return res.status(500).json({ error: `Failed to update inventory: ${err.message}` });
                            }
                            console.log('DELETE /api/batches/:batchId/package/:packageId: Updated inventory', {
                              identifier,
                              newInventoryQuantity,
                            });

                            db.run('COMMIT', (err) => {
                              if (err) {
                                db.run('ROLLBACK');
                                console.error('DELETE /api/batches/:batchId/package/:packageId: Commit transaction error:', err);
                                return res.status(500).json({ error: `Failed to commit transaction: ${err.message}` });
                              }
                              console.log('DELETE /api/batches/:batchId/package/:packageId: Success', {
                                batchId,
                                packageId,
                                newBatchVolume,
                              });
                              res.json({ message: 'Packaging action deleted successfully', newBatchVolume });
                            });
                          }
                        );
                      }
                    }
                  );
                }
              );
            }
          );
        });
      });
    }
  );
});

router.post('/:batchId/adjust-volume', (req, res) => {
  const { batchId } = req.params;
  const { volume, reason } = req.body;
  console.log('POST /api/batches/:batchId/adjust-volume: Received request', { batchId, volume, reason });

  if (volume === undefined || isNaN(parseFloat(volume)) || parseFloat(volume) < 0) {
    console.error('POST /api/batches/:batchId/adjust-volume: Invalid volume', { volume });
    return res.status(400).json({ error: 'Volume must be a non-negative number' });
  }
  if (!reason) {
    console.error('POST /api/batches/:batchId/adjust-volume: Missing reason', { batchId });
    return res.status(400).json({ error: 'Reason is required' });
  }

  db.get(
    `SELECT volume, siteId, status FROM batches WHERE batchId = ?`,
    [batchId],
    (err, batch) => {
      if (err) {
        console.error('POST /api/batches/:batchId/adjust-volume: Fetch batch error:', err);
        return res.status(500).json({ error: `Failed to fetch batch: ${err.message}` });
      }
      if (!batch) {
        console.error('POST /api/batches/:batchId/adjust-volume: Batch not found', { batchId });
        return res.status(404).json({ error: 'Batch not found' });
      }
      if (batch.status === 'Completed') {
        console.error('POST /api/batches/:batchId/adjust-volume: Cannot modify completed batch', { batchId });
        return res.status(400).json({ error: 'Cannot modify a completed batch' });
      }

      const currentVolume = parseFloat(batch.volume || 0);
      const newVolume = parseFloat(volume);
      const volumeDifference = currentVolume - newVolume;

      console.log('POST /api/batches/:batchId/adjust-volume: Volume calculation', {
        currentVolume,
        newVolume,
        volumeDifference,
      });

      db.serialize(() => {
        db.run('BEGIN TRANSACTION', (err) => {
          if (err) {
            console.error('POST /api/batches/:batchId/adjust-volume: Begin transaction error:', err);
            return res.status(500).json({ error: `Failed to start transaction: ${err.message}` });
          }

          db.run(
            `UPDATE batches SET volume = ? WHERE batchId = ?`,
            [newVolume, batchId],
            (err) => {
              if (err) {
                db.run('ROLLBACK');
                console.error('POST /api/batches/:batchId/adjust-volume: Update batch volume error:', err);
                return res.status(500).json({ error: `Failed to update batch volume: ${err.message}` });
              }

              if (volumeDifference > 0) {
                db.run(
                  `INSERT INTO inventory_losses (identifier, quantityLost, reason, date, siteId, userId)
                   VALUES (?, ?, ?, ?, ?, ?)`,
                  [
                    batchId,
                    volumeDifference,
                    reason,
                    new Date().toISOString().split('T')[0],
                    batch.siteId,
                    req.user?.email || 'unknown',
                  ],
                  (err) => {
                    if (err) {
                      db.run('ROLLBACK');
                      console.error('POST /api/batches/:batchId/adjust-volume: Insert inventory loss error:', err);
                      return res.status(500).json({ error: `Failed to record inventory loss: ${err.message}` });
                    }

                    db.run('COMMIT', (err) => {
                      if (err) {
                        db.run('ROLLBACK');
                        console.error('POST /api/batches/:batchId/adjust-volume: Commit transaction error:', err);
                        return res.status(500).json({ error: `Failed to commit transaction: ${err.message}` });
                      }
                      console.log('POST /api/batches/:batchId/adjust-volume: Success', {
                        batchId,
                        newVolume,
                        volumeDifference,
                        reason,
                      });
                      res.json({ message: 'Batch volume adjusted successfully', newVolume });
                    });
                  }
                );
              } else {
                db.run('COMMIT', (err) => {
                  if (err) {
                    db.run('ROLLBACK');
                    console.error('POST /api/batches/:batchId/adjust-volume: Commit transaction error:', err);
                    return res.status(500).json({ error: `Failed to commit transaction: ${err.message}` });
                  }
                  console.log('POST /api/batches/:batchId/adjust-volume: Success', {
                    batchId,
                    newVolume,
                    volumeDifference,
                    reason,
                  });
                  res.json({ message: 'Batch volume adjusted successfully', newVolume });
                });
              }
            }
          );
        });
      });
    }
  );
});

router.post('/:batchId/ingredients', (req, res) => {
  const { batchId } = req.params;
  const { ingredients } = req.body;
  console.log('POST /api/batches/:batchId/ingredients: Received request', { batchId, ingredients });

  if (!Array.isArray(ingredients) || ingredients.length === 0) {
    console.error('POST /api/batches/:batchId/ingredients: Invalid ingredients', { ingredients });
    return res.status(400).json({ error: 'Ingredients must be a non-empty array' });
  }

  const errors = [];
  ingredients.forEach((ing, index) => {
    if (!ing.itemName || !ing.quantity || !ing.unit) {
      errors.push(`Invalid ingredient at index ${index}: itemName, quantity, and unit are required`);
    }
    if (ing.quantity < 0) {
      errors.push(`Invalid quantity at index ${index}: must be non-negative`);
    }
  });
  if (errors.length > 0) {
    console.error('POST /api/batches/:batchId/ingredients: Validation errors', errors);
    return res.status(400).json({ error: errors.join('; ') });
  }

  db.get('SELECT status, siteId FROM batches WHERE batchId = ?', [batchId], (err, batch) => {
    if (err) {
      console.error('POST /api/batches/:batchId/ingredients: Fetch batch error:', err);
      return res.status(500).json({ error: err.message });
    }
    if (!batch) {
      console.error('POST /api/batches/:batchId/ingredients: Batch not found', { batchId });
      return res.status(404).json({ error: 'Batch not found' });
    }
    if (batch.status === 'Completed') {
      console.error('POST /api/batches/:batchId/ingredients: Cannot modify completed batch', { batchId });
      return res.status(400).json({ error: 'Cannot modify a completed batch' });
    }

    let remaining = ingredients.length;
    ingredients.forEach((ing, index) => {
      const recipeUnit = ing.unit.toLowerCase() === 'pounds' ? 'lbs' : ing.unit.toLowerCase();
      db.all(
        'SELECT identifier, quantity, unit, status, siteId, locationId FROM inventory WHERE identifier = ? AND siteId = ? AND status = ?',
        [ing.itemName, batch.siteId, 'Stored'],
        (err, rows) => {
          if (err) {
            console.error('POST /api/batches/:batchId/ingredients: Fetch inventory error:', err);
            errors.push(`Failed to check inventory for ${ing.itemName}: ${err.message}`);
            if (--remaining === 0) finish();
            return;
          }
          const totalAvailable = rows.reduce((sum, row) => {
            const inventoryUnit = row.unit.toLowerCase() === 'pounds' ? 'lbs' : row.unit.toLowerCase();
            return inventoryUnit === recipeUnit ? sum + parseFloat(row.quantity) : sum;
          }, 0);
          if (totalAvailable < ing.quantity) {
            errors.push(
              `Insufficient inventory for ${ing.itemName}: ${totalAvailable}${recipeUnit} available, ${ing.quantity}${recipeUnit} needed`
            );
          }
          if (--remaining === 0) finish();
        }
      );
    });

    function finish() {
      if (errors.length > 0) {
        console.error('POST /api/batches/:batchId/ingredients: Validation errors', errors);
        return res.status(400).json({ error: errors.join('; ') });
      }

      db.get('SELECT additionalIngredients FROM batches WHERE batchId = ?', [batchId], (err, row) => {
        if (err) {
          console.error('POST /api/batches/:batchId/ingredients: Fetch current ingredients error:', err);
          return res.status(500).json({ error: err.message });
        }
        const currentIngredients = row.additionalIngredients ? JSON.parse(row.additionalIngredients) : [];
        const newIngredients = [...currentIngredients, ...ingredients];
        db.run(
          'UPDATE batches SET additionalIngredients = ? WHERE batchId = ?',
          [JSON.stringify(newIngredients), batchId],
          (err) => {
            if (err) {
              console.error('POST /api/batches/:batchId/ingredients: Update ingredients error:', err);
              return res.status(500).json({ error: err.message });
            }
            console.log('POST /api/batches/:batchId/ingredients: Success', { batchId, newIngredients });
            res.json({ message: 'Ingredients added successfully', ingredients: newIngredients });
          }
        );
      });
    }
  });
});

router.patch('/:batchId/ingredients', (req, res) => {
  const { batchId } = req.params;
  const { ingredients } = req.body;
  console.log('PATCH /api/batches/:batchId/ingredients: Received request', { batchId, ingredients });

  if (!Array.isArray(ingredients)) {
    console.error('PATCH /api/batches/:batchId/ingredients: Invalid ingredients', { ingredients });
    return res.status(400).json({ error: 'Ingredients must be an array' });
  }

  const errors = [];
  ingredients.forEach((ing, index) => {
    if (!ing.itemName || !ing.unit || (ing.quantity !== undefined && ing.quantity < 0)) {
      errors.push(`Invalid ingredient at index ${index}: itemName and unit are required, quantity must be non-negative if provided`);
    }
  });
  if (errors.length > 0) {
    console.error('PATCH /api/batches/:batchId/ingredients: Validation errors', errors);
    return res.status(400).json({ error: errors.join('; ') });
  }

  db.get('SELECT status, siteId FROM batches WHERE batchId = ?', [batchId], (err, batch) => {
    if (err) {
      console.error('PATCH /api/batches/:batchId/ingredients: Fetch batch error:', err);
      return res.status(500).json({ error: err.message });
    }
    if (!batch) {
      console.error('PATCH /api/batches/:batchId/ingredients: Batch not found', { batchId });
      return res.status(404).json({ error: 'Batch not found' });
    }
    if (batch.status === 'Completed') {
      console.error('PATCH /api/batches/:batchId/ingredients: Cannot modify completed batch', { batchId });
      return res.status(400).json({ error: 'Cannot modify a completed batch' });
    }

    let remaining = ingredients.length;
    if (remaining === 0) {
      updateIngredients([]);
      return;
    }
    ingredients.forEach((ing, index) => {
      if (ing.quantity === undefined || ing.excluded) {
        if (--remaining === 0) updateIngredients(ingredients);
        return;
      }
      const recipeUnit = ing.unit.toLowerCase() === 'pounds' ? 'lbs' : ing.unit.toLowerCase();
      db.all(
        'SELECT identifier, quantity, unit, status, siteId, locationId FROM inventory WHERE identifier = ? AND siteId = ? AND status = ?',
        [ing.itemName, batch.siteId, 'Stored'],
        (err, rows) => {
          if (err) {
            console.error('PATCH /api/batches/:batchId/ingredients: Fetch inventory error:', err);
            errors.push(`Failed to check inventory for ${ing.itemName}: ${err.message}`);
            if (--remaining === 0) updateIngredients(ingredients);
            return;
          }
          const totalAvailable = rows.reduce((sum, row) => {
            const inventoryUnit = row.unit.toLowerCase() === 'pounds' ? 'lbs' : row.unit.toLowerCase();
            return inventoryUnit === recipeUnit ? sum + parseFloat(row.quantity) : sum;
          }, 0);
          if (totalAvailable < ing.quantity) {
            errors.push(
              `Insufficient inventory for ${ing.itemName}: ${totalAvailable}${recipeUnit} available, ${ing.quantity}${recipeUnit} needed`
            );
          }
          if (--remaining === 0) updateIngredients(ingredients);
        }
      );
    });

    function updateIngredients(newIngredients) {
      if (errors.length > 0) {
        console.error('PATCH /api/batches/:batchId/ingredients: Validation errors', errors);
        return res.status(400).json({ error: errors.join('; ') });
      }
      db.run(
        'UPDATE batches SET additionalIngredients = ? WHERE batchId = ?',
        [JSON.stringify(newIngredients), batchId],
        (err) => {
          if (err) {
            console.error('PATCH /api/batches/:batchId/ingredients: Update ingredients error:', err);
            return res.status(500).json({ error: err.message });
          }
          console.log('PATCH /api/batches/:batchId/ingredients: Success', { batchId, newIngredients });
          res.json({ message: 'Ingredients updated successfully', ingredients: newIngredients });
        }
      );
    }
  });
});

router.delete('/:batchId/ingredients', (req, res) => {
  const { batchId } = req.params;
  console.log('DELETE /api/batches/:batchId/ingredients: Received request', { batchId });

  db.get('SELECT status FROM batches WHERE batchId = ?', [batchId], (err, batch) => {
    if (err) {
      console.error('DELETE /api/batches/:batchId/ingredients: Fetch batch error:', err);
      return res.status(500).json({ error: err.message });
    }
    if (!batch) {
      console.error('DELETE /api/batches/:batchId/ingredients: Batch not found', { batchId });
      return res.status(404).json({ error: 'Batch not found' });
    }
    if (batch.status === 'Completed') {
      console.error('DELETE /api/batches/:batchId/ingredients: Cannot modify completed batch', { batchId });
      return res.status(400).json({ error: 'Cannot modify a completed batch' });
    }

    db.run(
      'UPDATE batches SET additionalIngredients = ? WHERE batchId = ?',
      ['[]', batchId],
      (err) => {
        if (err) {
          console.error('DELETE /api/batches/:batchId/ingredients: Delete ingredients error:', err);
          return res.status(500).json({ error: err.message });
        }
        console.log('DELETE /api/batches/:batchId/ingredients: Success', { batchId });
        res.json({ message: 'Additional ingredients deleted successfully' });
      }
    );
  });
});

router.patch('/:batchId', (req, res) => {
  const { batchId } = req.params;
  const { status, volume } = req.body;
  console.log('PATCH /api/batches/:batchId: Received request', { batchId, status, volume });

  if (!status && volume === undefined) {
    console.error('PATCH /api/batches/:batchId: No fields provided', { batchId });
    return res.status(400).json({ error: 'At least one field (status or volume) must be provided' });
  }
  if (volume !== undefined && (isNaN(parseFloat(volume)) || parseFloat(volume) < 0)) {
    console.error('PATCH /api/batches/:batchId: Invalid volume', { volume });
    return res.status(400).json({ error: 'Volume must be a non-negative number if provided' });
  }

  db.get('SELECT status FROM batches WHERE batchId = ?', [batchId], (err, batch) => {
    if (err) {
      console.error('PATCH /api/batches/:batchId: Fetch batch error:', err);
      return res.status(500).json({ error: err.message });
    }
    if (!batch) {
      console.error('PATCH /api/batches/:batchId: Batch not found', { batchId });
      return res.status(404).json({ error: 'Batch not found' });
    }
    if (batch.status === 'Completed' && status !== 'Completed') {
      console.error('PATCH /api/batches/:batchId: Cannot modify completed batch', { batchId });
      return res.status(400).json({ error: 'Cannot modify a completed batch' });
    }

    const updates = [];
    const params = [];
    if (status) {
      updates.push('status = ?');
      params.push(status);
    }
    if (volume !== undefined) {
      updates.push('volume = ?');
      params.push(volume);
    }
    params.push(batchId);

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    db.run(
      `UPDATE batches SET ${updates.join(', ')} WHERE batchId = ?`,
      params,
      (err) => {
        if (err) {
          console.error('PATCH /api/batches/:batchId: Update batch error:', err);
          return res.status(500).json({ error: err.message });
        }
        console.log('PATCH /api/batches/:batchId: Success', { batchId, status, volume });
        res.json({ message: 'Batch updated successfully' });
      }
    );
  });
});

router.delete('/:batchId', (req, res) => {
  const { batchId } = req.params;
  console.log('DELETE /api/batches/:batchId: Received request', { batchId });

  db.get('SELECT status FROM batches WHERE batchId = ?', [batchId], (err, batch) => {
    if (err) {
      console.error('DELETE /api/batches/:batchId: Fetch batch error:', err);
      return res.status(500).json({ error: err.message });
    }
    if (!batch) {
      console.error('DELETE /api/batches/:batchId: Batch not found', { batchId });
      return res.status(404).json({ error: 'Batch not found' });
    }
    if (batch.status === 'Completed') {
      console.error('DELETE /api/batches/:batchId: Cannot delete completed batch', { batchId });
      return res.status(400).json({ error: 'Cannot delete a completed batch' });
    }

    db.run('DELETE FROM batches WHERE batchId = ?', [batchId], (err) => {
      if (err) {
        console.error('DELETE /api/batches/:batchId: Delete batch error:', err);
        return res.status(500).json({ error: err.message });
      }
      console.log('DELETE /api/batches/:batchId: Success', { batchId });
      res.json({ message: 'Batch deleted successfully' });
    });
  });
});

router.post('/:batchId/actions', (req, res) => {
  const { batchId } = req.params;
  const { action } = req.body;
  console.log('POST /api/batches/:batchId/actions: Received request', { batchId, action });

  if (!action) {
    console.error('POST /api/batches/:batchId/actions: Missing action', { batchId });
    return res.status(400).json({ error: 'Action is required' });
  }

  db.get('SELECT status FROM batches WHERE batchId = ?', [batchId], (err, batch) => {
    if (err) {
      console.error('POST /api/batches/:batchId/actions: Fetch batch error:', err);
      return res.status(500).json({ error: err.message });
    }
    if (!batch) {
      console.error('POST /api/batches/:batchId/actions: Batch not found', { batchId });
      return res.status(404).json({ error: 'Batch not found' });
    }
    if (batch.status === 'Completed') {
      console.error('POST /api/batches/:batchId/actions: Cannot modify completed batch', { batchId });
      return res.status(400).json({ error: 'Cannot modify a completed batch' });
    }

    db.run(
      'INSERT INTO batch_actions (batchId, action, timestamp) VALUES (?, ?, ?)',
      [batchId, action, new Date().toISOString()],
      (err) => {
        if (err) {
          console.error('POST /api/batches/:batchId/actions: Insert action error:', err);
          return res.status(500).json({ error: err.message });
        }
        console.log('POST /api/batches/:batchId/actions: Success', { batchId, action });
        res.json({ message: 'Action recorded successfully' });
      }
    );
  });
});

router.get('/:batchId/actions', (req, res) => {
  const { batchId } = req.params;
  console.log('GET /api/batches/:batchId/actions: Received request', { batchId });

  db.all(
    'SELECT id, action, timestamp FROM batch_actions WHERE batchId = ? ORDER BY timestamp',
    [batchId],
    (err, actions) => {
      if (err) {
        console.error('GET /api/batches/:batchId/actions: Fetch actions error:', err);
        return res.status(500).json({ error: err.message });
      }
      console.log('GET /api/batches/:batchId/actions: Success', { batchId, count: actions.length });
      res.json(actions);
    }
  );
});

router.post('/:batchId/brewlog', (req, res) => {
  const { batchId } = req.params;
  const { log } = req.body;
  console.log('POST /api/batches/:batchId/brewlog: Received request', { batchId, log });

  if (!log) {
    console.error('POST /api/batches/:batchId/brewlog: Missing log', { batchId });
    return res.status(400).json({ error: 'Log is required' });
  }

  db.get('SELECT status, brewLog FROM batches WHERE batchId = ?', [batchId], (err, batch) => {
    if (err) {
      console.error('POST /api/batches/:batchId/brewlog: Fetch batch error:', err);
      return res.status(500).json({ error: err.message });
    }
    if (!batch) {
      console.error('POST /api/batches/:batchId/brewlog: Batch not found', { batchId });
      return res.status(404).json({ error: 'Batch not found' });
    }
    if (batch.status === 'Completed') {
      console.error('POST /api/batches/:batchId/brewlog: Cannot modify completed batch', { batchId });
      return res.status(400).json({ error: 'Cannot modify a completed batch' });
    }

    const currentLog = batch.brewLog ? JSON.parse(batch.brewLog) : [];
    currentLog.push({ timestamp: new Date().toISOString(), entry: log });

    db.run(
      'UPDATE batches SET brewLog = ? WHERE batchId = ?',
      [JSON.stringify(currentLog), batchId],
      (err) => {
        if (err) {
          console.error('POST /api/batches/:batchId/brewlog: Update brew log error:', err);
          return res.status(500).json({ error: err.message });
        }
        console.log('POST /api/batches/:batchId/brewlog: Success', { batchId, log });
        res.json({ message: 'Brew log updated successfully', brewLog: currentLog });
      }
    );
  });
});

router.get('/:batchId/brewlog', (req, res) => {
  const { batchId } = req.params;
  console.log('GET /api/batches/:batchId/brewlog: Received request', { batchId });

  db.get('SELECT brewLog FROM batches WHERE batchId = ?', [batchId], (err, batch) => {
    if (err) {
      console.error('GET /api/batches/:batchId/brewlog: Fetch batch error:', err);
      return res.status(500).json({ error: err.message });
    }
    if (!batch) {
      console.error('GET /api/batches/:batchId/brewlog: Batch not found', { batchId });
      return res.status(404).json({ error: 'Batch not found' });
    }
    const brewLog = batch.brewLog ? JSON.parse(batch.brewLog) : [];
    console.log('GET /api/batches/:batchId/brewlog: Success', { batchId, brewLog });
    res.json(brewLog);
  });
});

module.exports = router;