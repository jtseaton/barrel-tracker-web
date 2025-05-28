// client/src/components/Production.tsx
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Batch, Product, Recipe, Site, Ingredient, Equipment, InventoryItem } from '../types/interfaces';
import '../App.css';
import 'bootstrap/dist/css/bootstrap.min.css';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:3000';

interface ProductionProps {
  inventory: InventoryItem[];
  refreshInventory: () => Promise<void>;
}

const Production: React.FC<ProductionProps> = ({ inventory, refreshInventory }) => {
  const [batches, setBatches] = useState<Batch[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [items, setItems] = useState<{ name: string; type: string; enabled: number }[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddBatchModal, setShowAddBatchModal] = useState(false);
  const [showAddRecipeModal, setShowAddRecipeModal] = useState(false);
  const [newBatch, setNewBatch] = useState<Partial<Batch>>({
    batchId: '',
    productId: 0,
    recipeId: 0,
    siteId: '',
    fermenterId: null,
  });
  const [newRecipe, setNewRecipe] = useState<{
    name: string;
    productId: number;
    ingredients: Ingredient[];
    quantity: number;
    unit: string;
  }>({
    name: '',
    productId: 0,
    ingredients: [{ itemName: '', quantity: 0, unit: 'lbs' }],
    quantity: 0,
    unit: 'barrels',
  });
  const [error, setError] = useState<string | null>(null);
  const [showErrorPopup, setShowErrorPopup] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [selectedBatchIds, setSelectedBatchIds] = useState<string[]>([]);
  const [showBatchActionsModal, setShowBatchActionsModal] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const fetchBatches = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/batches?page=${page}&limit=10`, {
        headers: { Accept: 'application/json' },
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Failed to fetch batches: HTTP ${res.status}, Response: ${text.slice(0, 50)}`);
      }
      const data = await res.json();
      if (!Array.isArray(data.batches)) {
        console.error('Invalid batches data: expected array, got', data);
        throw new Error('Invalid batches response');
      }
      setBatches(data.batches);
      setTotalPages(data.totalPages || 1);
    } catch (err: any) {
      console.error('Fetch batches error:', err);
      setError('Failed to load batches: ' + err.message);
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        const endpoints = [
          { url: `${API_BASE_URL}/api/products`, setter: setProducts, name: 'products' },
          { url: `${API_BASE_URL}/api/sites`, setter: setSites, name: 'sites' },
          { url: `${API_BASE_URL}/api/items`, setter: setItems, name: 'items' },
        ];
        const responses = await Promise.all(
          endpoints.map(({ url }) => fetch(url, { headers: { Accept: 'application/json' } }))
        );
        for (let i = 0; i < responses.length; i++) {
          const res = responses[i];
          const { name, setter } = endpoints[i];
          if (!res.ok) {
            const text = await res.text();
            throw new Error(`Failed to fetch ${name}: HTTP ${res.status}, Response: ${text.slice(0, 50)}`);
          }
          const data = await res.json();
          if (!Array.isArray(data)) {
            console.error(`Invalid ${name} data: expected array, got`, data);
            throw new Error(`Invalid ${name} response`);
          }
          setter(data);
        }
        await fetchBatches();
      } catch (err: any) {
        console.error('Initial fetch error:', err);
        setError('Failed to load production data: ' + err.message);
      }
    };
    fetchData();
  }, [page]);

  const refreshProducts = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/products`, {
        headers: { Accept: 'application/json' },
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Failed to fetch products: HTTP ${res.status}, Response: ${text.slice(0, 50)}`);
      }
      const data = await res.json();
      if (!Array.isArray(data)) {
        console.error('Invalid products data: expected array, got', data);
        throw new Error('Invalid products response');
      }
      setProducts(data);
    } catch (err: any) {
      console.error('Refresh products error:', err);
      setError('Failed to refresh products: ' + err.message);
    }
  };

  useEffect(() => {
    if (newBatch.siteId) {
      const fetchFermenters = async () => {
        try {
          const res = await fetch(`${API_BASE_URL}/api/equipment?siteId=${newBatch.siteId}&type=Fermenter`, {
            headers: { Accept: 'application/json' },
          });
          if (!res.ok) {
            const text = await res.text();
            throw new Error(`Failed to fetch fermenters: HTTP ${res.status}, Response: ${text.slice(0, 50)}`);
          }
          const data = await res.json();
          if (!Array.isArray(data)) {
            console.error('Invalid fermenters data: expected array, got', data);
            setError('Invalid fermenters response');
            setEquipment([]);
            return;
          }
          setEquipment(data.filter(item => item && typeof item === 'object' && 'equipmentId' in item && 'name' in item));
        } catch (err: any) {
          console.error('Fetch fermenters error:', err);
          setError('Failed to load fermenters: ' + err.message);
          setEquipment([]);
        }
      };
      fetchFermenters();
    } else {
      setEquipment([]);
    }
  }, [newBatch.siteId]);

  const fetchRecipes = async (productId: number) => {
    if (!productId) {
      setRecipes([]);
      return;
    }
    try {
      const res = await fetch(`${API_BASE_URL}/api/recipes?productId=${productId}`, {
        headers: { Accept: 'application/json' },
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Failed to fetch recipes: HTTP ${res.status}, Response: ${text.slice(0, 50)}`);
      }
      const data = await res.json();
      if (!Array.isArray(data)) {
        console.error('Invalid recipes data: expected array, got', data);
        throw new Error('Invalid recipes response');
      }
      setRecipes(data);
    } catch (err: any) {
      console.error('Fetch recipes error:', err);
      setError('Failed to fetch recipes: ' + err.message);
      setRecipes([]);
    }
  };

  const handleAddBatch = async () => {
  if (!newBatch.batchId || !newBatch.productId || !newBatch.recipeId || !newBatch.siteId) {
    setError('All fields are required');
    return;
  }
  const product = products.find(p => p.id === newBatch.productId);
  if (!product) {
    setError('Invalid product selected');
    return;
  }
  const recipe = recipes.find(r => r.id === newBatch.recipeId);
  if (!recipe) {
    setError('Invalid recipe selected');
    return;
  }
  const batchData = {
    batchId: newBatch.batchId,
    productId: newBatch.productId,
    recipeId: newBatch.recipeId,
    siteId: newBatch.siteId,
    fermenterId: newBatch.fermenterId || null,
    status: 'In Progress',
    date: new Date().toISOString().split('T')[0],
  };
  try {
    const res = await fetch(`${API_BASE_URL}/api/batches`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(batchData),
    });
    if (!res.ok) {
      const text = await res.text();
      let errorMessage = `Failed to add batch: HTTP ${res.status}, ${text.slice(0, 50)}`;
      try {
        const errorData = JSON.parse(text);
        errorMessage = errorData.error || errorMessage;
      } catch {
        console.error('[Production] Failed to parse error response:', text);
      }
      setErrorMessage(errorMessage);
      setShowErrorPopup(true);
      setShowAddBatchModal(false); // Close modal on error
      throw new Error(errorMessage);
    }
    await res.json();
    console.log('[Production] Added batch:', batchData);
    setShowAddBatchModal(false);
    setNewBatch({ batchId: '', productId: 0, recipeId: 0, siteId: '', fermenterId: null });
    setRecipes([]);
    setEquipment([]);
    await refreshInventory();
    await fetchBatches();
    setError(null);
    setErrorMessage(null);
    setShowErrorPopup(false);
  } catch (err: any) {
    console.error('[Production] Add batch error:', err);
    if (!showErrorPopup) {
      setError('Failed to add batch: ' + err.message);
    }
  }
};

  const handleAddRecipe = async () => {
  if (
    !newRecipe.name ||
    !newRecipe.productId ||
    newRecipe.quantity <= 0 ||
    !newRecipe.unit ||
    newRecipe.ingredients.some(ing => !ing.itemName || ing.quantity <= 0 || !ing.unit)
  ) {
    setError('Recipe name, product, valid quantity, unit, and ingredients are required');
    return;
  }
  const product = products.find(p => p.id === newRecipe.productId);
  if (!product) {
    setError('Selected product is invalid or not found.');
    return;
  }
  const invalidIngredients = newRecipe.ingredients.filter(ing => {
    const inventoryItem = inventory.find(i => i.identifier === ing.itemName);
    if (!inventoryItem) return true;
    if (['pounds', 'lbs'].includes(inventoryItem.unit.toLowerCase())) {
      ing.unit = 'lbs';
    }
    return false;
  });
  if (invalidIngredients.length > 0) {
    setError(`Invalid ingredients: ${invalidIngredients.map(i => i.itemName).join(', ')} not found in inventory`);
    return;
  }
  try {
    const res = await fetch(`${API_BASE_URL}/api/recipes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        ...newRecipe,
        ingredients: newRecipe.ingredients.map(ing => ({
          itemName: ing.itemName,
          quantity: ing.quantity,
          unit: ing.unit,
        })),
      }),
    });
    if (!res.ok) {
      const text = await res.text();
      let errorMessage = `Failed to add recipe: HTTP ${res.status}, ${text.slice(0, 50)}`;
      try {
        const errorData = JSON.parse(text);
        errorMessage = errorData.error || errorMessage;
      } catch {
        console.error('[Production] Failed to parse error response:', text);
      }
      throw new Error(errorMessage);
    }
    const addedRecipe = await res.json();
    console.log('[Production] Added recipe:', addedRecipe);
    setRecipes([...recipes, addedRecipe]);
    await fetchRecipes(newRecipe.productId);
    setShowAddRecipeModal(false);
    setNewRecipe({
      name: '',
      productId: 0,
      ingredients: [{ itemName: '', quantity: 0, unit: 'lbs' }],
      quantity: 0,
      unit: 'barrels',
    });
    setError(null);
  } catch (err: any) {
    console.error('[Production] Add recipe error:', err);
    setError('Failed to save recipe: ' + err.message);
  }
};

  const addIngredient = () => {
    setNewRecipe({
      ...newRecipe,
      ingredients: [...newRecipe.ingredients, { itemName: '', quantity: 0, unit: 'lbs' }],
    });
  };

  const removeIngredient = (index: number) => {
    setNewRecipe({
      ...newRecipe,
      ingredients: newRecipe.ingredients.filter((_, i) => i !== index),
    });
  };

  const updateIngredient = (index: number, field: keyof Ingredient, value: string | number) => {
    const updatedIngredients = [...newRecipe.ingredients];
    updatedIngredients[index] = { ...updatedIngredients[index], [field]: value };
    setNewRecipe({ ...newRecipe, ingredients: updatedIngredients });
  };

  const handleBatchSelection = (batchId: string) => {
    setSelectedBatchIds(prev =>
      prev.includes(batchId) ? prev.filter(id => id !== batchId) : [...prev, batchId]
    );
  };

  const handleOpenBatchActions = () => {
    if (selectedBatchIds.length > 0) {
      setShowBatchActionsModal(true);
    }
  };

  const handleCompleteBatches = async () => {
    try {
      const promises = selectedBatchIds.map(batchId =>
        fetch(`${API_BASE_URL}/api/batches/${batchId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({ status: 'Completed' }),
        }).then(res => {
          if (!res.ok) {
            throw new Error(`Failed to complete batch ${batchId}: HTTP ${res.status}`);
          }
          return res.json();
        })
      );
      await Promise.all(promises);
      await fetchBatches();
      setSelectedBatchIds([]);
      setShowBatchActionsModal(false);
      setError(null);
    } catch (err: any) {
      console.error('Complete batches error:', err);
      setError('Failed to complete batches: ' + err.message);
    }
  };

  const handleDeleteBatches = async () => {
    try {
      const promises = selectedBatchIds.map(batchId =>
        fetch(`${API_BASE_URL}/api/batches/${batchId}`, {
          method: 'DELETE',
          headers: { Accept: 'application/json' },
        }).then(res => {
          if (!res.ok) {
            throw new Error(`Failed to delete batch ${batchId}: HTTP ${res.status}`);
          }
        })
      );
      await Promise.all(promises);
      await fetchBatches();
      setSelectedBatchIds([]);
      setShowBatchActionsModal(false);
      setError(null);
    } catch (err: any) {
      console.error('Delete batches error:', err);
      setError('Failed to delete batches: ' + err.message);
    }
  };

  const filteredBatches = batches.filter(batch =>
    batch.batchId.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (batch.productName && batch.productName.toLowerCase().includes(searchQuery.toLowerCase()))
  );

return (
  <div className="page-container container">
    <h2 className="app-header mb-4">Production</h2>
    {error && <div className="alert alert-danger">{error}</div>}
    <div className="inventory-actions mb-4">
      <button className="btn btn-primary" onClick={() => setShowAddBatchModal(true)}>
        Add New Batch
      </button>
      <button
        className="btn btn-primary"
        onClick={() => refreshProducts().then(() => setShowAddRecipeModal(true))}
      >
        Add Recipe
      </button>
      <button
        className="btn btn-primary"
        onClick={handleOpenBatchActions}
        disabled={selectedBatchIds.length === 0}
      >
        Batch Actions
      </button>
    </div>
    <div className="mb-4">
      <input
        type="text"
        value={searchQuery}
        onChange={e => setSearchQuery(e.target.value)}
        placeholder="Search by Batch ID or Product Name"
        className="form-control"
      />
    </div>
    <div className="inventory-table-container">
      {filteredBatches.length > 0 ? (
        <>
          <table className="inventory-table table table-striped">
            <thead>
              <tr>
                <th>
                  <input
                    type="checkbox"
                    checked={selectedBatchIds.length === filteredBatches.length && filteredBatches.length > 0}
                    onChange={() =>
                      setSelectedBatchIds(
                        selectedBatchIds.length === filteredBatches.length
                          ? []
                          : filteredBatches.map(batch => batch.batchId)
                      )
                    }
                  />
                </th>
                <th>Batch ID</th>
                <th>Product</th>
                <th>Site</th>
                <th>Status</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {filteredBatches.map(batch => (
                <tr key={batch.batchId}>
                  <td>
                    <input
                      type="checkbox"
                      checked={selectedBatchIds.includes(batch.batchId)}
                      onChange={() => handleBatchSelection(batch.batchId)}
                    />
                  </td>
                  <td>
                    <Link to={`/production/${batch.batchId}`} className="text-primary text-decoration-underline">
                      {batch.batchId}
                    </Link>
                  </td>
                  <td>{batch.productName || 'Unknown'}</td>
                  <td>{batch.siteName || batch.siteId}</td>
                  <td>{batch.status}</td>
                  <td>{batch.date}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="batch-list">
            {filteredBatches.map(batch => (
              <div key={batch.batchId} className="batch-card card mb-2">
                <div className="card-body">
                  <input
                    type="checkbox"
                    checked={selectedBatchIds.includes(batch.batchId)}
                    onChange={() => handleBatchSelection(batch.batchId)}
                    className="me-2"
                  />
                  <h5 className="card-title">
                    <Link to={`/production/${batch.batchId}`} className="text-primary text-decoration-underline">
                      {batch.batchId}
                    </Link>
                  </h5>
                  <p className="card-text"><strong>Product:</strong> {batch.productName || 'Unknown'}</p>
                  <p className="card-text"><strong>Site:</strong> {batch.siteName || batch.siteId}</p>
                  <p className="card-text"><strong>Status:</strong> {batch.status}</p>
                  <p className="card-text"><strong>Date:</strong> {batch.date}</p>
                </div>
              </div>
            ))}
          </div>
        </>
      ) : (
        <div className="alert alert-info text-center">No batches found.</div>
      )}
    </div>
    <div className="d-flex justify-content-between mt-3">
      <button
        className="btn btn-secondary"
        onClick={() => setPage(p => Math.max(1, p - 1))}
        disabled={page === 1}
      >
        Previous
      </button>
      <span>Page {page} of {totalPages}</span>
      <button
        className="btn btn-secondary"
        onClick={() => setPage(p => p + 1)}
        disabled={page === totalPages}
      >
        Next
      </button>
    </div>
    {showAddBatchModal && (
      <div className="modal fade show d-block">
        <div className="modal-dialog modal-content">
          <div className="modal-header">
            <h5 className="modal-title">Add New Batch</h5>
          </div>
          <div className="modal-body">
            <div className="recipe-form">
              <label className="form-label">
                Batch ID (required):
                <input
                  type="text"
                  value={newBatch.batchId || ''}
                  onChange={e => setNewBatch({ ...newBatch, batchId: e.target.value })}
                  placeholder="Enter Batch ID"
                  className="form-control"
                />
              </label>
              <label className="form-label">
                Product (required):
                <select
                  value={newBatch.productId || ''}
                  onChange={e => {
                    const productId = parseInt(e.target.value, 10);
                    setNewBatch({ ...newBatch, productId, recipeId: 0 });
                    fetchRecipes(productId);
                  }}
                  className="form-control"
                >
                  <option value="">Select Product</option>
                  {products.map(product => (
                    <option key={product.id} value={product.id}>
                      {product.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="form-label">
                Recipe (required):
                <select
                  value={newBatch.recipeId || ''}
                  onChange={e => setNewBatch({ ...newBatch, recipeId: parseInt(e.target.value, 10) })}
                  disabled={!newBatch.productId}
                  className="form-control"
                >
                  <option value="">Select Recipe</option>
                  {recipes.map(recipe => (
                    <option key={recipe.id} value={recipe.id}>
                      {recipe.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="form-label">
                Site (required):
                <select
                  value={newBatch.siteId || ''}
                  onChange={e => setNewBatch({ ...newBatch, siteId: e.target.value })}
                  className="form-control"
                >
                  <option value="">Select Site</option>
                  {sites.map(site => (
                    <option key={site.siteId} value={site.siteId}>
                      {site.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="form-label">
                Fermenter (optional):
                <select
                  value={newBatch.fermenterId ?? ''}
                  onChange={e => {
                    const value = e.target.value;
                    setNewBatch({ ...newBatch, fermenterId: value ? parseInt(value, 10) : null });
                  }}
                  disabled={!newBatch.siteId || equipment.length === 0}
                  className="form-control"
                >
                  <option value="">Select Fermenter (optional)</option>
                  {equipment.map(item => (
                    <option key={item.equipmentId} value={item.equipmentId}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>
          <div className="modal-footer">
            <button onClick={handleAddBatch} className="btn btn-primary">
              Create
            </button>
            <button
              onClick={() => {
                setShowAddBatchModal(false);
                setNewBatch({ batchId: '', productId: 0, recipeId: 0, siteId: '', fermenterId: null });
                setError(null);
              }}
              className="btn btn-danger"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    )}
    {showErrorPopup && (
      <div className="modal fade show d-block error-modal">
        <div className="modal-dialog modal-content">
          <div className="modal-header">
            <h5 className="modal-title text-danger">Error</h5>
          </div>
          <div className="modal-body">
            <p>{errorMessage || error}</p>
          </div>
          <div className="modal-footer">
            <button
              onClick={() => {
                setShowErrorPopup(false);
                setErrorMessage(null);
                setError(null);
                setShowAddBatchModal(false);
              }}
              className="btn btn-primary"
            >
              OK
            </button>
          </div>
        </div>
      </div>
    )}
    {showAddRecipeModal && (
      <div className="modal fade show d-block">
        <div className="modal-dialog modal-content">
          <div className="modal-header">
            <h5 className="modal-title">Create New Recipe</h5>
          </div>
          <div className="modal-body">
            <div className="recipe-form">
              <label className="form-label">
                Recipe Name (required):
                <input
                  type="text"
                  value={newRecipe.name}
                  onChange={e => setNewRecipe({ ...newRecipe, name: e.target.value })}
                  placeholder="Enter recipe name"
                  className="form-control"
                />
              </label>
              <label className="form-label">
                Product (required):
                <select
                  value={newRecipe.productId || ''}
                  onChange={e => setNewRecipe({ ...newRecipe, productId: parseInt(e.target.value, 10) })}
                  className="form-control"
                >
                  <option value="">Select Product</option>
                  {products.map(product => (
                    <option key={product.id} value={product.id}>
                      {product.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="form-label">
                Recipe Quantity (required):
                <input
                  type="number"
                  value={newRecipe.quantity || ''}
                  onChange={e => setNewRecipe({ ...newRecipe, quantity: parseFloat(e.target.value) || 0 })}
                  placeholder="Enter quantity (e.g., 10)"
                  step="0.01"
                  min="0"
                  className="form-control"
                />
              </label>
              <label className="form-label">
                Unit (required):
                <select
                  value={newRecipe.unit}
                  onChange={e => setNewRecipe({ ...newRecipe, unit: e.target.value })}
                  className="form-control"
                >
                  <option value="barrels">Barrels</option>
                  <option value="gallons">Gallons</option>
                  <option value="liters">Liters</option>
                </select>
              </label>
              <label className="form-label">
                Ingredients (required):
                {newRecipe.ingredients.map((ingredient, index) => (
                  <div key={index} className="d-flex gap-2 mb-2 align-items-center">
                    <select
                      value={ingredient.itemName}
                      onChange={e => updateIngredient(index, 'itemName', e.target.value)}
                      className="form-control"
                    >
                      <option value="">Select Item</option>
                      {inventory.map(item => (
                        <option key={item.identifier} value={item.identifier}>
                          {item.identifier}
                        </option>
                      ))}
                    </select>
                    <input
                      type="number"
                      value={ingredient.quantity || ''}
                      onChange={e => updateIngredient(index, 'quantity', parseFloat(e.target.value) || 0)}
                      placeholder="Quantity"
                      step="0.01"
                      min="0"
                      className="form-control"
                      style={{ width: '100px' }}
                    />
                    <select
                      value={ingredient.unit}
                      onChange={e => updateIngredient(index, 'unit', e.target.value)}
                      className="form-control"
                      style={{ width: '100px' }}
                    >
                      <option value="lbs">lbs</option>
                      <option value="kg">kg</option>
                      <option value="oz">oz</option>
                      <option value="gal">gal</option>
                      <option value="l">l</option>
                    </select>
                    <button
                      onClick={() => removeIngredient(index)}
                      className="btn btn-danger"
                      style={{ padding: '8px 12px' }}
                    >
                      Remove
                    </button>
                  </div>
                ))}
                <button onClick={addIngredient} className="btn btn-primary mt-2">
                  Add Ingredient
                </button>
              </label>
            </div>
          </div>
          <div className="modal-footer">
            <button onClick={handleAddRecipe} className="btn btn-primary">
              Create
            </button>
            <button
              onClick={() => {
                setShowAddRecipeModal(false);
                setNewRecipe({
                  name: '',
                  productId: 0,
                  ingredients: [{ itemName: '', quantity: 0, unit: 'lbs' }],
                  quantity: 0,
                  unit: 'barrels',
                });
                setError(null);
              }}
              className="btn btn-danger"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    )}
    {showBatchActionsModal && (
      <div className="modal fade show d-block">
        <div className="modal-dialog modal-content">
          <div className="modal-header">
            <h5 className="modal-title">Batch Actions</h5>
          </div>
          <div className="modal-body">
            <div className="d-flex flex-column gap-2">
              <button onClick={handleCompleteBatches} className="btn btn-primary">
                Complete Selected
              </button>
              <button onClick={handleDeleteBatches} className="btn btn-danger">
                Delete Selected
              </button>
              <button
                onClick={() => {
                  setShowBatchActionsModal(false);
                  setError(null);
                }}
                className="btn btn-secondary"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      </div>
    )}
  </div>
);
};

export default Production;