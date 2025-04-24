import React, { useState, useEffect } from 'react';
import { Batch, Product, Recipe, Site } from '../types/interfaces';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:3000';

interface Ingredient {
  itemName: string;
  quantity: number;
  unit: string; // Added unit
}

const Production: React.FC = () => {
  const [batches, setBatches] = useState<Batch[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [items, setItems] = useState<{ name: string; type: string; enabled: number }[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddBatchModal, setShowAddBatchModal] = useState(false);
  const [showAddRecipeModal, setShowAddRecipeModal] = useState(false);
  const [newBatch, setNewBatch] = useState<Partial<Batch>>({
    batchId: '',
    productId: 0,
    recipeId: 0,
    siteId: '',
  });
  const [newRecipe, setNewRecipe] = useState<{
    name: string;
    productId: number;
    ingredients: Ingredient[];
  }>({
    name: '',
    productId: 0,
    ingredients: [{ itemName: '', quantity: 0, unit: 'lbs' }], // Added unit
  });
  const [error, setError] = useState<string | null>(null);
  const [showErrorPopup, setShowErrorPopup] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

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
          const contentType = res.headers.get('content-type');
          if (!contentType || !contentType.includes('application/json')) {
            const text = await res.text();
            throw new Error(`Invalid response for ${name}: Expected JSON, got ${contentType}, Response: ${text.slice(0, 50)}`);
          }
          const data = await res.json();
          setter(data);
        }
      } catch (err: any) {
        console.error('Fetch error:', err);
        setError('Failed to load production data: ' + err.message);
      }
    };
    fetchData();
  }, []);

  const fetchRecipes = async (productId: number) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/recipes?productId=${productId}`, {
        headers: { Accept: 'application/json' },
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Failed to fetch recipes: HTTP ${res.status}, Response: ${text.slice(0, 50)}`);
      }
      const contentType = res.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        const text = await res.text();
        throw new Error(`Invalid response for recipes: Expected JSON, got ${contentType}, Response: ${text.slice(0, 50)}`);
      }
      const data = await res.json();
      console.log('Fetched recipes for productId', productId, ':', data); // Debug log
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
    const batchData = {
      batchId: newBatch.batchId,
      productId: newBatch.productId,
      recipeId: newBatch.recipeId,
      siteId: newBatch.siteId,
      status: 'In Progress',
      date: new Date().toISOString().split('T')[0],
    };
    console.log('Sending batch data to /api/batches:', batchData); // Debug log
    try {
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
          console.log('Server error response:', errorMessage); // Debug log
          if (errorMessage.includes('Insufficient inventory')) {
            setErrorMessage(errorMessage);
            setShowErrorPopup(true);
          } else {
            setError(errorMessage);
          }
        } catch {
          setError(errorMessage);
        }
        throw new Error(errorMessage);
      }
      const contentType = res.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        const text = await res.text();
        throw new Error(`Invalid response for batch: Expected JSON, got ${contentType}, Response: ${text.slice(0, 50)}`);
      }
      const addedBatch = await res.json();
      console.log('Batch created:', addedBatch); // Debug log
      setBatches([...batches, addedBatch]);
      setShowAddBatchModal(false);
      setNewBatch({ batchId: '', productId: 0, recipeId: 0, siteId: '' });
      setRecipes([]);
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
    if (!newRecipe.name || !newRecipe.productId || newRecipe.ingredients.some(ing => !ing.itemName || ing.quantity <= 0 || !ing.unit)) {
      setError('Recipe name, product, and valid ingredients with units are required');
      return;
    }
    try {
      const res = await fetch(`${API_BASE_URL}/api/recipes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(newRecipe),
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
      setRecipes([...recipes, addedRecipe]);
      setShowAddRecipeModal(false);
      setNewRecipe({ name: '', productId: 0, ingredients: [{ itemName: '', quantity: 0, unit: 'lbs' }] });
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
              <th>Batch #</th>
              <th>Product</th>
              <th>Status</th>
              <th>Date</th>
              <th>Location</th>
            </tr>
          </thead>
          <tbody>
            {filteredBatches.length > 0 ? (
              filteredBatches.map((batch) => (
                <tr key={batch.batchId}>
                  <td>{batch.batchId}</td>
                  <td>{batch.productName || 'Unknown'}</td>
                  <td>{batch.status}</td>
                  <td>{batch.date}</td>
                  <td>{batch.siteName || batch.siteId}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={5} style={{ textAlign: 'center', padding: '20px' }}>
                  No batches found
                </td>
              </tr>
            )}
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
              maxHeight: '90vh',
              overflowY: 'auto',
            }}
          >
            <h3 style={{ color: '#555', marginBottom: '20px', textAlign: 'center' }}>
              Add New Batch
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '15px' }}>
              <div>
                <label style={{ fontWeight: 'bold', color: '#555', display: 'block', marginBottom: '5px' }}>
                  Batch # (required):
                </label>
                <input
                  type="text"
                  value={newBatch.batchId || ''}
                  onChange={(e) => setNewBatch({ ...newBatch, batchId: e.target.value })}
                  placeholder="Enter batch ID (e.g., BATCH-001)"
                  style={{
                    width: '100%',
                    maxWidth: '350px',
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
                    maxWidth: '350px',
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
                    maxWidth: '350px',
                    padding: '10px',
                    border: '1px solid #CCCCCC',
                    borderRadius: '4px',
                    fontSize: '16px',
                    boxSizing: 'border-box',
                    color: '#000000',
                    backgroundColor: newBatch.productId ? '#FFFFFF' : '#f0f0f0',
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
                    maxWidth: '350px',
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
                Add
              </button>
              <button
                onClick={() => {
                  setShowAddBatchModal(false);
                  setNewBatch({ batchId: '', productId: 0, recipeId: 0, siteId: '' });
                  setRecipes([]);
                  setError(null);
                  setErrorMessage(null);
                  setShowErrorPopup(false);
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
              {/* Recipe Name */}
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
              {/* Product */}
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
              {/* Ingredients */}
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
                  setNewRecipe({ name: '', productId: 0, ingredients: [{ itemName: '', quantity: 0, unit: 'lbs' }] });
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
    </div>
  );
};

export default Production;