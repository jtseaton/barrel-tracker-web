import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Batch, Product, Recipe, Site, Ingredient, Equipment, InventoryItem } from '../types/interfaces';

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

  useEffect(() => {
    const fetchData = async () => {
      try {
        const endpoints = [
          { url: `${API_BASE_URL}/api/batches`, setter: setBatches, name: 'batches' },
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
            throw new Error(`Invalid ${name} response: expected array`);
          }
          setter(data);
        }
      } catch (err: any) {
        console.error('Initial fetch error:', err);
        setError('Failed to load production data: ' + err.message);
      }
    };
    fetchData();
  }, []);

  useEffect(() => {
    if (newBatch.siteId) {
      const fetchFermenters = async () => {
        try {
          console.log(`Fetching fermenters for siteId: ${newBatch.siteId}`);
          const res = await fetch(`${API_BASE_URL}/api/equipment?siteId=${newBatch.siteId}&type=Fermenter`, {
            headers: { Accept: 'application/json' },
          });
          if (!res.ok) {
            const text = await res.text();
            throw new Error(`Failed to fetch fermenters: HTTP ${res.status}, Response: ${text.slice(0, 50)}`);
          }
          const data = await res.json();
          console.log('Fetched fermenters:', data);
          if (!Array.isArray(data)) {
            console.error('Invalid fermenters data: expected array, got', data);
            setError('Invalid fermenters response from server');
            setEquipment([]);
            return;
          }
          const validEquipment = data.filter((item: any) => item && typeof item === 'object' && 'equipmentId' in item && 'name' in item);
          console.log('Valid fermenters:', validEquipment);
          setEquipment(validEquipment);
        } catch (err: any) {
          console.error('Fetch fermenters error:', err);
          setError('Failed to load fermenters: ' + err.message);
          setEquipment([]);
        }
      };
      fetchFermenters();
    } else {
      console.log('Clearing equipment: no siteId selected');
      setEquipment([]);
    }
  }, [newBatch.siteId]);

  const fetchRecipes = async (productId: number) => {
    if (!productId) {
      console.log('Clearing recipes: no productId selected');
      setRecipes([]);
      return;
    }
    try {
      console.log(`Fetching recipes for productId: ${productId}`);
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
        throw new Error('Invalid recipes response: expected array');
      }
      console.log('Fetched recipes:', data);
      setRecipes(data);
    } catch (err: any) {
      console.error('Fetch recipes error:', err);
      setError('Failed to fetch recipes: ' + err.message);
      setRecipes([]);
    }
  };

  const handleAddBatch = async () => {
    if (!newBatch.batchId || !newBatch.productId || !newBatch.recipeId || !newBatch.siteId || !newBatch.fermenterId) {
      console.error('Missing required batch fields:', {
        batchId: newBatch.batchId,
        productId: newBatch.productId,
        recipeId: newBatch.recipeId,
        siteId: newBatch.siteId,
        fermenterId: newBatch.fermenterId,
      });
      setError('All fields, including Fermenter, are required');
      return;
    }
    const product = products.find(p => p.id === newBatch.productId);
    if (!product) {
      console.error('Invalid product selected:', newBatch.productId);
      setError('Invalid product selected');
      return;
    }
    const recipe = recipes.find(r => r.id === newBatch.recipeId);
    if (!recipe) {
      console.error('Invalid recipe selected:', newBatch.recipeId);
      setError('Invalid recipe selected');
      return;
    }
    const batchData = {
      batchId: newBatch.batchId,
      productId: newBatch.productId,
      recipeId: newBatch.recipeId,
      siteId: newBatch.siteId,
      status: 'In Progress',
      date: new Date().toISOString().split('T')[0],
      fermenterId: newBatch.fermenterId,
    };
    try {
      console.log('Submitting batch:', batchData);
      const res = await fetch(`${API_BASE_URL}/api/batches`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(batchData),
      });
      if (!res.ok) {
        const text = await res.text();
        let errorMessage = `Add batch error: HTTP ${res.status}, Response: ${text.slice(0, 50)}`;
        try {
          const errorData = JSON.parse(text);
          errorMessage = errorData.error || errorMessage;
          console.error('Batch creation error:', errorMessage);
          if (errorMessage.includes('Insufficient inventory')) {
            setErrorMessage(errorMessage);
            setShowErrorPopup(true);
          } else {
            setError(errorMessage);
          }
        } catch {
          console.error('Failed to parse error response:', text);
          setError(errorMessage);
        }
        throw new Error(errorMessage);
      }
      const addedBatch = await res.json();
      console.log('Batch created successfully:', addedBatch);
      setBatches([...batches, { ...addedBatch, productName: product.name, siteName: sites.find(s => s.siteId === batchData.siteId)?.name }]);
      setShowAddBatchModal(false);
      setNewBatch({ batchId: '', productId: 0, recipeId: 0, siteId: '', fermenterId: null });
      setRecipes([]);
      setEquipment([]);
      console.log('handleAddBatch: Refreshing inventory after batch creation', { batchId: batchData.batchId });
      await refreshInventory();
      const inventoryRes = await fetch(`${API_BASE_URL}/api/inventory?siteId=${batchData.siteId}`);
      const inventoryData = await inventoryRes.json();
      console.log('handleAddBatch: Inventory after batch creation', inventoryData);
      setError(null);
      setErrorMessage(null);
      setShowErrorPopup(false);
    } catch (err: any) {
      console.error('Add batch error:', err);
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
      console.error('Missing required recipe fields:', newRecipe);
      setError('Recipe name, product, valid quantity, unit, and ingredients with units are required');
      return;
    }
    try {
      console.log('Submitting recipe:', newRecipe);
      const res = await fetch(`${API_BASE_URL}/api/recipes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          ...newRecipe,
          ingredients: newRecipe.ingredients.map(ing => ({ itemName: ing.itemName, quantity: ing.quantity, unit: ing.unit })),
        }),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Add recipe error: HTTP ${res.status}, Response: ${text.slice(0, 50)}`);
      }
      const contentType = res.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        const text = await res.text();
        throw new Error(`Invalid response for recipe: Expected JSON, got ${contentType}, Response: ${text.slice(0, 50)}`);
      }
      const addedRecipe = await res.json();
      console.log('Recipe created successfully:', addedRecipe);
      setRecipes([...recipes, addedRecipe]);
      setShowAddRecipeModal(false);
      setNewRecipe({ name: '', productId: 0, ingredients: [{ itemName: '', quantity: 0, unit: 'lbs' }], quantity: 0, unit: 'barrels' });
      setError(null);
    } catch (err: any) {
      console.error('Add recipe error:', err);
      setError('Failed to add recipe: ' + err.message);
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
    setSelectedBatchIds((prev) =>
      prev.includes(batchId)
        ? prev.filter((id) => id !== batchId)
        : [...prev, batchId]
    );
  };

  const handleOpenBatchActions = () => {
    if (selectedBatchIds.length > 0) {
      setShowBatchActionsModal(true);
    }
  };

  const handleCompleteBatches = async () => {
    try {
      const promises = selectedBatchIds.map((batchId) =>
        fetch(`${API_BASE_URL}/api/batches/${batchId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({ status: 'Completed' }),
        }).then((res) => {
          if (!res.ok) {
            throw new Error(`Failed to complete batch ${batchId}: HTTP ${res.status}`);
          }
          return res.json();
        })
      );
      await Promise.all(promises);
      setBatches((prev) =>
        prev.map((batch) =>
          selectedBatchIds.includes(batch.batchId)
            ? { ...batch, status: 'Completed' }
            : batch
        )
      );
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
      const promises = selectedBatchIds.map((batchId) =>
        fetch(`${API_BASE_URL}/api/batches/${batchId}`, {
          method: 'DELETE',
          headers: { Accept: 'application/json' },
        }).then((res) => {
          if (!res.ok) {
            throw new Error(`Failed to delete batch ${batchId}: HTTP ${res.status}`);
          }
        })
      );
      await Promise.all(promises);
      setBatches((prev) =>
        prev.filter((batch) => !selectedBatchIds.includes(batch.batchId))
      );
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
    <div className="page-container">
      <h2>Production</h2>
      {error && <div className="error">{error}</div>}
      <div className="inventory-actions">
        <button onClick={() => setShowAddBatchModal(true)}>Add New Batch</button>
        <button onClick={() => setShowAddRecipeModal(true)}>Add Recipe</button>
        <button
          onClick={handleOpenBatchActions}
          disabled={selectedBatchIds.length === 0}
          style={{
            backgroundColor: selectedBatchIds.length > 0 ? '#2196F3' : '#ccc',
            color: '#fff',
            padding: '10px 20px',
            border: 'none',
            borderRadius: '4px',
            cursor: selectedBatchIds.length > 0 ? 'pointer' : 'not-allowed',
          }}
        >
          Batch Actions
        </button>
      </div>
      <div style={{ marginBottom: '20px' }}>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search by Batch ID or Product Name"
          style={{
            width: '100%',
            maxWidth: '300px',
            padding: '10px',
            border: '1px solid #CCCCCC',
            borderRadius: '4px',
            fontSize: '16px',
            boxSizing: 'border-box',
            color: '#000000',
            backgroundColor: '#FFFFFF',
          }}
        />
      </div>
      <div className="inventory-table-container">
        <table className="inventory-table">
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
                        : filteredBatches.map((batch) => batch.batchId)
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
            {filteredBatches.map((batch) => (
              <tr key={batch.batchId}>
                <td>
                  <input
                    type="checkbox"
                    checked={selectedBatchIds.includes(batch.batchId)}
                    onChange={() => handleBatchSelection(batch.batchId)}
                  />
                </td>
                <td>
                  <Link to={`/production/${batch.batchId}`} style={{ color: '#2196F3', textDecoration: 'underline' }}>
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
      </div>
      {showAddBatchModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 2000,
          }}
        >
          <div
            style={{
              backgroundColor: '#fff',
              padding: '20px',
              borderRadius: '8px',
              width: '400px',
              boxShadow: '0 4px 8px rgba(0,0,0,0.2)',
            }}
          >
            <h3 style={{ color: '#555', marginBottom: '20px', textAlign: 'center' }}>
              Add New Batch
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '15px' }}>
              <div>
                <label style={{ fontWeight: 'bold', color: '#555', display: 'block', marginBottom: '5px' }}>
                  Batch ID (required):
                </label>
                <input
                  type="text"
                  value={newBatch.batchId || ''}
                  onChange={(e) => setNewBatch({ ...newBatch, batchId: e.target.value })}
                  placeholder="Enter Batch ID"
                  style={{
                    width: '100%',
                    padding: '10px',
                    border: '1px solid #CCCCCC',
                    borderRadius: '4px',
                    fontSize: '16px',
                    boxSizing: 'border-box',
                    color: '#000000',
                    backgroundColor: '#FFFFFF',
                  }}
                />
              </div>
              <div>
                <label style={{ fontWeight: 'bold', color: '#555', display: 'block', marginBottom: '5px' }}>
                  Product (required):
                </label>
                <select
                  value={newBatch.productId || ''}
                  onChange={(e) => {
                    const productId = parseInt(e.target.value, 10);
                    setNewBatch({ ...newBatch, productId, recipeId: 0 });
                    fetchRecipes(productId);
                  }}
                  style={{
                    width: '100%',
                    padding: '10px',
                    border: '1px solid #CCCCCC',
                    borderRadius: '4px',
                    fontSize: '16px',
                    boxSizing: 'border-box',
                    color: '#000000',
                    backgroundColor: '#FFFFFF',
                  }}
                >
                  <option value="">Select Product</option>
                  {products.map((product) => (
                    <option key={product.id} value={product.id}>{product.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={{ fontWeight: 'bold', color: '#555', display: 'block', marginBottom: '5px' }}>
                  Recipe (required):
                </label>
                <select
                  value={newBatch.recipeId || ''}
                  onChange={(e) => setNewBatch({ ...newBatch, recipeId: parseInt(e.target.value, 10) })}
                  disabled={!newBatch.productId}
                  style={{
                    width: '100%',
                    padding: '10px',
                    border: '1px solid #CCCCCC',
                    borderRadius: '4px',
                    fontSize: '16px',
                    boxSizing: 'border-box',
                    color: '#000000',
                    backgroundColor: '#FFFFFF',
                  }}
                >
                  <option value="">Select Recipe</option>
                  {recipes.map((recipe) => (
                    <option key={recipe.id} value={recipe.id}>{recipe.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={{ fontWeight: 'bold', color: '#555', display: 'block', marginBottom: '5px' }}>
                  Site (required):
                </label>
                <select
                  value={newBatch.siteId || ''}
                  onChange={(e) => setNewBatch({ ...newBatch, siteId: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '10px',
                    border: '1px solid #CCCCCC',
                    borderRadius: '4px',
                    fontSize: '16px',
                    boxSizing: 'border-box',
                    color: '#000000',
                    backgroundColor: '#FFFFFF',
                  }}
                >
                  <option value="">Select Site</option>
                  {sites.map((site) => (
                    <option key={site.siteId} value={site.siteId}>{site.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={{ fontWeight: 'bold', color: '#555', display: 'block', marginBottom: '5px' }}>
                  Fermenter (required):
                </label>
                <select
                  value={newBatch.fermenterId || ''}
                  onChange={(e) => setNewBatch({ ...newBatch, fermenterId: parseInt(e.target.value, 10) || null })}
                  disabled={!newBatch.siteId || equipment.length === 0}
                  style={{
                    width: '100%',
                    padding: '10px',
                    border: '1px solid #CCCCCC',
                    borderRadius: '4px',
                    fontSize: '16px',
                    boxSizing: 'border-box',
                    color: '#000000',
                    backgroundColor: '#FFFFFF',
                  }}
                  required
                >
                  <option value="">Select Fermenter</option>
                  {equipment.map((equip) => (
                    <option key={equip.equipmentId} value={equip.equipmentId}>{equip.name}</option>
                  ))}
                </select>
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '20px' }}>
              <button
                onClick={handleAddBatch}
                style={{
                  backgroundColor: '#2196F3',
                  color: '#fff',
                  padding: '10px 20px',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '16px',
                  transition: 'background-color 0.3s',
                }}
                onMouseOver={(e) => (e.currentTarget.style.backgroundColor = '#1976D2')}
                onMouseOut={(e) => (e.currentTarget.style.backgroundColor = '#2196F3')}
              >
                Create
              </button>
              <button
                onClick={() => {
                  setShowAddBatchModal(false);
                  setNewBatch({ batchId: '', productId: 0, recipeId: 0, siteId: '', fermenterId: null });
                  setError(null);
                }}
                style={{
                  backgroundColor: '#F86752',
                  color: '#fff',
                  padding: '10px 20px',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '16px',
                  transition: 'background-color 0.3s',
                }}
                onMouseOver={(e) => (e.currentTarget.style.backgroundColor = '#D32F2F')}
                onMouseOut={(e) => (e.currentTarget.style.backgroundColor = '#F86752')}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
      {showErrorPopup && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 2100,
          }}
        >
          <div
            style={{
              backgroundColor: '#fff',
              padding: '20px',
              borderRadius: '8px',
              width: '300px',
              boxShadow: '0 4px 8px rgba(0,0,0,0.2)',
              textAlign: 'center',
            }}
          >
            <h3 style={{ color: '#F86752', marginBottom: '10px' }}>Inventory Error</h3>
            <p style={{ color: '#555', marginBottom: '20px' }}>{errorMessage}</p>
            <button
              onClick={() => {
                setShowErrorPopup(false);
                setErrorMessage(null);
              }}
              style={{
                backgroundColor: '#2196F3',
                color: '#fff',
                padding: '10px 20px',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '16px',
                transition: 'background-color 0.3s',
              }}
              onMouseOver={(e) => (e.currentTarget.style.backgroundColor = '#1976D2')}
              onMouseOut={(e) => (e.currentTarget.style.backgroundColor = '#2196F3')}
            >
              OK
            </button>
          </div>
        </div>
      )}
      {showAddRecipeModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 2000,
          }}
        >
          <div
            style={{
              backgroundColor: '#fff',
              padding: '20px',
              borderRadius: '8px',
              width: '500px',
              boxShadow: '0 4px 8px rgba(0,0,0,0.2)',
              maxHeight: '90vh',
              overflowY: 'auto',
            }}
          >
            <h3 style={{ color: '#555', marginBottom: '20px', textAlign: 'center' }}>
              Create New Recipe
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '15px' }}>
              <div>
                <label style={{ fontWeight: 'bold', color: '#555', display: 'block', marginBottom: '5px' }}>
                  Recipe Name (required):
                </label>
                <input
                  type="text"
                  value={newRecipe.name}
                  onChange={(e) => setNewRecipe({ ...newRecipe, name: e.target.value })}
                  placeholder="Enter recipe name"
                  style={{
                    width: '100%',
                    maxWidth: '450px',
                    padding: '10px',
                    border: '1px solid #CCCCCC',
                    borderRadius: '4px',
                    fontSize: '16px',
                    boxSizing: 'border-box',
                    color: '#000000',
                    backgroundColor: '#FFFFFF',
                  }}
                />
              </div>
              <div>
                <label style={{ fontWeight: 'bold', color: '#555', display: 'block', marginBottom: '5px' }}>
                  Product (required):
                </label>
                <select
                  value={newRecipe.productId || ''}
                  onChange={(e) => setNewRecipe({ ...newRecipe, productId: parseInt(e.target.value, 10) })}
                  style={{
                    width: '100%',
                    maxWidth: '450px',
                    padding: '10px',
                    border: '1px solid #CCCCCC',
                    borderRadius: '4px',
                    fontSize: '16px',
                    boxSizing: 'border-box',
                    color: '#000000',
                    backgroundColor: '#FFFFFF',
                  }}
                >
                  <option value="">Select Product</option>
                  {products.map((product) => (
                    <option key={product.id} value={product.id}>{product.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={{ fontWeight: 'bold', color: '#555', display: 'block', marginBottom: '5px' }}>
                  Recipe Quantity (required):
                </label>
                <input
                  type="number"
                  value={newRecipe.quantity || ''}
                  onChange={(e) => setNewRecipe({ ...newRecipe, quantity: parseFloat(e.target.value) || 0 })}
                  placeholder="Enter quantity (e.g., 10)"
                  step="0.01"
                  min="0"
                  style={{
                    width: '100%',
                    maxWidth: '450px',
                    padding: '10px',
                    border: '1px solid #CCCCCC',
                    borderRadius: '4px',
                    fontSize: '16px',
                    boxSizing: 'border-box',
                    color: '#000000',
                    backgroundColor: '#FFFFFF',
                  }}
                />
              </div>
              <div>
                <label style={{ fontWeight: 'bold', color: '#555', display: 'block', marginBottom: '5px' }}>
                  Unit (required):
                </label>
                <select
                  value={newRecipe.unit}
                  onChange={(e) => setNewRecipe({ ...newRecipe, unit: e.target.value })}
                  style={{
                    width: '100%',
                    maxWidth: '450px',
                    padding: '10px',
                    border: '1px solid #CCCCCC',
                    borderRadius: '4px',
                    fontSize: '16px',
                    boxSizing: 'border-box',
                    color: '#000000',
                    backgroundColor: '#FFFFFF',
                  }}
                >
                  <option value="barrels">Barrels</option>
                  <option value="gallons">Gallons</option>
                  <option value="liters">Liters</option>
                </select>
              </div>
              <div>
                <label style={{ fontWeight: 'bold', color: '#555', display: 'block', marginBottom: '5px' }}>
                  Ingredients (required):
                </label>
                {newRecipe.ingredients.map((ingredient, index) => (
                  <div key={index} style={{ display: 'flex', gap: '10px', marginBottom: '10px', alignItems: 'center' }}>
                    <select
                      value={ingredient.itemName}
                      onChange={(e) => updateIngredient(index, 'itemName', e.target.value)}
                      style={{
                        width: '200px',
                        padding: '10px',
                        border: '1px solid #CCCCCC',
                        borderRadius: '4px',
                        fontSize: '16px',
                        boxSizing: 'border-box',
                        color: '#000000',
                        backgroundColor: '#FFFFFF',
                      }}
                    >
                      <option value="">Select Item</option>
                      {items.filter(item => item.enabled).map((item) => (
                        <option key={item.name} value={item.name}>{item.name}</option>
                      ))}
                    </select>
                    <input
                      type="number"
                      value={ingredient.quantity || ''}
                      onChange={(e) => updateIngredient(index, 'quantity', parseFloat(e.target.value) || 0)}
                      placeholder="Quantity"
                      step="0.01"
                      min="0"
                      style={{
                        width: '100px',
                        padding: '10px',
                        border: '1px solid #CCCCCC',
                        borderRadius: '4px',
                        fontSize: '16px',
                        boxSizing: 'border-box',
                        color: '#000000',
                        backgroundColor: '#FFFFFF',
                      }}
                    />
                    <select
                      value={ingredient.unit}
                      onChange={(e) => updateIngredient(index, 'unit', e.target.value)}
                      style={{
                        width: '100px',
                        padding: '10px',
                        border: '1px solid #CCCCCC',
                        borderRadius: '4px',
                        fontSize: '16px',
                        boxSizing: 'border-box',
                        color: '#000000',
                        backgroundColor: '#FFFFFF',
                      }}
                    >
                      <option value="lbs">lbs</option>
                      <option value="kg">kg</option>
                      <option value="oz">oz</option>
                      <option value="gal">gal</option>
                      <option value="l">l</option>
                    </select>
                    <button
                      onClick={() => removeIngredient(index)}
                      style={{
                        backgroundColor: '#F86752',
                        color: '#fff',
                        padding: '8px 12px',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '14px',
                      }}
                    >
                      Remove
                    </button>
                  </div>
                ))}
                <button
                  onClick={addIngredient}
                  style={{
                    backgroundColor: '#2196F3',
                    color: '#fff',
                    padding: '8px 12px',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '14px',
                    marginTop: '10px',
                  }}
                >
                  Add Ingredient
                </button>
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '20px' }}>
              <button
                onClick={handleAddRecipe}
                style={{
                  backgroundColor: '#2196F3',
                  color: '#fff',
                  padding: '10px 20px',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '16px',
                  transition: 'background-color 0.3s',
                }}
                onMouseOver={(e) => (e.currentTarget.style.backgroundColor = '#1976D2')}
                onMouseOut={(e) => (e.currentTarget.style.backgroundColor = '#2196F3')}
              >
                Create
              </button>
              <button
                onClick={() => {
                  setShowAddRecipeModal(false);
                  setNewRecipe({ name: '', productId: 0, ingredients: [{ itemName: '', quantity: 0, unit: 'lbs' }], quantity: 0, unit: 'barrels' });
                  setError(null);
                }}
                style={{
                  backgroundColor: '#F86752',
                  color: '#fff',
                  padding: '10px 20px',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '16px',
                  transition: 'background-color 0.3s',
                }}
                onMouseOver={(e) => (e.currentTarget.style.backgroundColor = '#D32F2F')}
                onMouseOut={(e) => (e.currentTarget.style.backgroundColor = '#F86752')}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
      {showBatchActionsModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 2000,
          }}
        >
          <div
            style={{
              backgroundColor: '#fff',
              padding: '20px',
              borderRadius: '8px',
              width: '300px',
              boxShadow: '0 4px 8px rgba(0,0,0,0.2)',
              textAlign: 'center',
            }}
          >
            <h3 style={{ color: '#555', marginBottom: '20px' }}>Batch Actions</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <button
                onClick={handleCompleteBatches}
                style={{
                  backgroundColor: '#2196F3',
                  color: '#fff',
                  padding: '10px 20px',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '16px',
                  transition: 'background-color 0.3s',
                }}
                onMouseOver={(e) => (e.currentTarget.style.backgroundColor = '#1976D2')}
                onMouseOut={(e) => (e.currentTarget.style.backgroundColor = '#2196F3')}
              >
                Complete Selected
              </button>
              <button
                onClick={handleDeleteBatches}
                style={{
                  backgroundColor: '#F86752',
                  color: '#fff',
                  padding: '10px 20px',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '16px',
                  transition: 'background-color 0.3s',
                }}
                onMouseOver={(e) => (e.currentTarget.style.backgroundColor = '#D32F2F')}
                onMouseOut={(e) => (e.currentTarget.style.backgroundColor = '#F86752')}
              >
                Delete Selected
              </button>
              <button
                onClick={() => {
                  setShowBatchActionsModal(false);
                  setError(null);
                }}
                style={{
                  backgroundColor: '#ccc',
                  color: '#555',
                  padding: '10px 20px',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '16px',
                  transition: 'background-color 0.3s',
                }}
                onMouseOver={(e) => (e.currentTarget.style.backgroundColor = '#bbb')}
                onMouseOut={(e) => (e.currentTarget.style.backgroundColor = '#ccc')}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Production;