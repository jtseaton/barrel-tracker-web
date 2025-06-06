import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Batch, Product, Recipe, Site, Ingredient, Equipment, InventoryItem } from '../types/interfaces';
import { Status, Unit, MaterialType, Account } from '../types/enums'; // Add at top of file
import RecipeModal from './RecipeModal';
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
      setShowErrorPopup(true);
      setShowAddBatchModal(false);
      return;
    }
    const product = products.find(p => p.id === newBatch.productId);
    if (!product) {
      setError('Invalid product selected');
      setShowErrorPopup(true);
      setShowAddBatchModal(false);
      return;
    }
    const recipe = recipes.find(r => r.id === newBatch.recipeId);
    if (!recipe) {
      setError('Invalid recipe selected');
      setShowErrorPopup(true);
      setShowAddBatchModal(false);
      return;
    }
try {
  console.log('[Production] Refreshing inventory before batch creation', { siteId: newBatch.siteId });
  await refreshInventory();
  console.log('[Production] Inventory state:', inventory.map(i => ({
    identifier: i.identifier,
    type: i.type,
    status: i.status,
    siteId: i.siteId,
    account: i.account,
    quantity: i.quantity,
    unit: i.unit
  })));
  // Validate recipe ingredients availability
  const invalidIngredients = recipe.ingredients.filter(ing => {
    const inventoryItem = inventory.find(i => 
      i.identifier === ing.itemName && 
      (i.status as string) === 'Stored' && // Match db status
      i.siteId === newBatch.siteId &&
      (i.type === MaterialType.Spirits ? i.account === Account.Storage : true) &&
      parseFloat(i.quantity) >= ing.quantity
    );
    console.log('[Production] Checking batch ingredient:', {
      itemName: ing.itemName,
      siteId: newBatch.siteId,
      requiredQuantity: ing.quantity,
      unit: ing.unit,
      inventoryItem: inventoryItem ? { 
        identifier: inventoryItem.identifier, 
        type: inventoryItem.type,
        account: inventoryItem.account,
        status: inventoryItem.status,
        siteId: inventoryItem.siteId,
        quantity: inventoryItem.quantity,
        unit: inventoryItem.unit 
      } : null
    });
    return !inventoryItem;
  });
  if (invalidIngredients.length > 0) {
    const errorMessage = `Insufficient ingredients: ${invalidIngredients.map(i => `${i.itemName} (${i.quantity} ${i.unit})`).join(', ')} not available at site ${newBatch.siteId}`;
    console.log('[Production] Batch validation error:', errorMessage);
    setError(errorMessage);
    setShowErrorPopup(true);
    setShowAddBatchModal(false);
    return;
  }
  console.log('[Production] Recipe data:', {
    recipeId: newBatch.recipeId,
    recipeUnit: recipe.unit,
    recipeQuantity: recipe.quantity,
    recipeIngredients: recipe.ingredients,
    fullRecipe: recipe
  });
  const batchData = {
    batchId: newBatch.batchId,
    productId: newBatch.productId,
    recipeId: newBatch.recipeId,
    siteId: newBatch.siteId,
    fermenterId: newBatch.fermenterId || null,
    status: 'In Progress',
    date: new Date().toISOString().split('T')[0],
    ingredients: recipe.ingredients.map(ing => ({
      itemName: ing.itemName,
      quantity: ing.quantity,
      unit: ing.unit,
      isRecipe: true
    })),
    volume: recipe.unit.toLowerCase() === 'barrels' ? recipe.quantity : 20
};
  console.log('[Production] Sending batch data:', {
    batchId: batchData.batchId,
    volume: batchData.volume,
    ingredients: batchData.ingredients,
    recipeId: batchData.recipeId
  });
  const resBatch = await fetch(`${API_BASE_URL}/api/batches`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(batchData),
  });
  if (!resBatch.ok) {
    const text = await resBatch.text();
    let errorMessage = `Failed to add batch: HTTP ${resBatch.status}, ${text.slice(0, 50)}`;
    try {
      const errorData = JSON.parse(text);
      errorMessage = errorData.error || errorMessage;
    } catch {
      console.error('[Production] Failed to parse batch error:', text);
    }
    console.log('[Production] Batch creation error:', errorMessage);
    setErrorMessage(errorMessage);
    setShowErrorPopup(true);
    setShowAddBatchModal(false);
    throw new Error(errorMessage);
  }
  await resBatch.json();
  console.log('[Production] Added batch:', batchData);
  for (const ing of recipe.ingredients) {
    const ingredientData = {
      itemName: ing.itemName,
      quantity: ing.quantity,
      unit: ing.unit,
      isRecipe: true
    };
    console.log('[Production] Adding ingredient to batch:', {
      batchId: newBatch.batchId,
      ingredientData
    });
    const resIngredient = await fetch(`${API_BASE_URL}/api/batches/${newBatch.batchId}/ingredients`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(ingredientData),
    });
    if (!resIngredient.ok) {
      const text = await resIngredient.text();
      let errorMessage = `Failed to add ingredient ${ing.itemName}: HTTP ${resIngredient.status}, ${text.slice(0, 50)}`;
      try {
        const errorData = JSON.parse(text);
        errorMessage = errorData.error || errorMessage;
      } catch {
        console.error('[Production] Failed to parse ingredient error:', text);
      }
      console.log('[Production] Ingredient addition error:', errorMessage);
      setErrorMessage(errorMessage);
      setShowErrorPopup(true);
      setShowAddBatchModal(false);
      throw new Error(errorMessage);
    }
  }
  setShowAddBatchModal(false);
  setNewBatch({ batchId: '', productId: 0, recipeId: 0, siteId: '', fermenterId: null });
  setRecipes([]);
  setEquipment([]);
  await refreshInventory();
  await fetchBatches();
  setError(null);
  setErrorMessage(null);
  setShowErrorPopup(false);
} catch (err: unknown) {
      console.error('[Production] Add batch error:', err);
      const errorMessage = err instanceof Error ? err.message : String(err);
      setError('Failed to add batch: ' + errorMessage);
      setShowErrorPopup(true);
      setShowAddBatchModal(false);
    }
  };

  const handleAddRecipe = async (recipe: { name: string; productId: number; ingredients: Ingredient[]; quantity: number; unit: string }) => {
    try {
      console.log('[Production] Creating recipe:', recipe);
      const res = await fetch(`${API_BASE_URL}/api/recipes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          name: recipe.name,
          productId: recipe.productId,
          quantity: recipe.quantity,
          unit: recipe.unit,
          ingredients: recipe.ingredients.map(ing => ({
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
          console.error('[Production] Recipe error:', text);
        }
        throw new Error(errorMessage);
      }
      const addedRecipe = await res.json();
      console.log('[Production] Added recipe:', addedRecipe);
      setRecipes([...recipes, addedRecipe]);
      await fetchRecipes(recipe.productId);
      setShowAddRecipeModal(false);
      setError(null);
      setShowErrorPopup(false);
    } catch (err: unknown) {
      console.error('[Production] Add recipe error:', err);
      const errorMessage = err instanceof Error ? err.message : String(err);
      setError('Failed to save recipe: ' + errorMessage);
      setShowErrorPopup(true);
    }
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
        <button
          className="btn btn-primary"
          onClick={() => {
            console.log('[Production] Add New Batch button clicked');
            setShowAddBatchModal(true);
          }}
        >
          Add New Batch
        </button>
        <button
          className="btn btn-primary"
          onClick={() => {
            console.log('[Production] Add Recipe button clicked');
            refreshProducts().then(() => setShowAddRecipeModal(true));
          }}
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
                            : filteredBatches.map(b => b.batchId)
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
                      <Link to={`/production/${batch.batchId}`} className="text-primary">
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
                <div key={batch.batchId} className="batch-card-body card mb-3">
                  <div className="card-body">
                    <input
                      type="checkbox"
                      checked={selectedBatchIds.includes(batch.batchId)}
                      onChange={() => handleBatchSelection(batch.batchId)}
                      className="me-2"
                    />
                    <h5 className="card-title">
                      <Link to={`/production/${batch.batchId}`} className="text-primary">
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
      <RecipeModal
        show={showAddRecipeModal}
        onClose={() => {
          setShowAddRecipeModal(false);
          setError(null);
        }}
        onSave={handleAddRecipe}
        products={products}
        items={items}
      />
      {showAddBatchModal && (
        <div
          className="modal"
          style={{
            display: 'block',
            backgroundColor: 'rgba(0,0,0,0.5)',
            zIndex: 2100,
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
          }}
        >
          <div
            className="modal-content"
            style={{
              maxWidth: '500px',
              margin: '100px auto',
              backgroundColor: '#fff',
              borderRadius: '8px',
              padding: '20px',
            }}
          >
            <div className="modal-header" style={{ borderBottom: '1px solid #ddd', marginBottom: '15px' }}>
              <h5 style={{ color: '#555', margin: 0 }}>Add New Batch</h5>
            </div>
            <div className="modal-body">
              <div className="recipe-form">
                <label className="form-label" style={{ fontWeight: 'bold', color: '#555' }}>
                  Batch ID (required):
                  <input
                    type="text"
                    value={newBatch.batchId || ''}
                    onChange={e => setNewBatch({ ...newBatch, batchId: e.target.value })}
                    placeholder="Enter batch ID"
                    className="form-control"
                  />
                </label>
                <label className="form-label" style={{ fontWeight: 'bold', color: '#555' }}>
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
                <label className="form-label" style={{ fontWeight: 'bold', color: '#555' }}>
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
                <label className="form-label" style={{ fontWeight: 'bold', color: '#555' }}>
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
                <label className="form-label" style={{ fontWeight: 'bold', color: '#555' }}>
                  Fermenter (optional):
                  <select
                    value={newBatch.fermenterId || ''}
                    onChange={e => {
                      const value = e.target.value;
                      setNewBatch({ ...newBatch, fermenterId: value ? parseInt(e.target.value, 10) : null });
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
            <div className="modal-footer" style={{ borderTop: '1px solid #ddd', marginTop: '15px' }}>
              <button onClick={handleAddBatch} className="btn btn-primary">
                Create
              </button>
              <button
                onClick={() => {
                  console.log('[Production] Batch modal Cancel clicked');
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
        <div className="modal" style={{ display: 'block', backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 2100 }}>
          <div className="modal-content" style={{ maxWidth: '500px', margin: '100px auto', backgroundColor: '#fff', borderRadius: '8px', padding: '20px' }}>
            <div className="modal-header" style={{ borderBottom: '1px solid #ddd', marginBottom: '15px' }}>
              <h5 className="modal-title text-danger">Error</h5>
            </div>
            <div className="modal-body">
              <p>{errorMessage || error}</p>
            </div>
            <div className="modal-footer" style={{ borderTop: '1px solid #ddd', marginTop: '15px' }}>
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
    </div>
  );
};

export default Production;