import React, { useState, useEffect } from 'react';
import { Batch, Product, Recipe, Site } from '../types/interfaces';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:3001';

const Production: React.FC = () => {
  const [batches, setBatches] = useState<Batch[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [newBatch, setNewBatch] = useState<Partial<Batch>>({
    batchId: '',
    productId: 0,
    recipeId: 0,
    siteId: '',
  });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [batchesRes, productsRes, sitesRes] = await Promise.all([
          fetch(`${API_BASE_URL}/api/batches`),
          fetch(`${API_BASE_URL}/api/products`),
          fetch(`${API_BASE_URL}/api/sites`),
        ]);
        if (!batchesRes.ok) throw new Error(`Batches fetch error: ${batchesRes.status}`);
        if (!productsRes.ok) throw new Error(`Products fetch error: ${productsRes.status}`);
        if (!sitesRes.ok) throw new Error(`Sites fetch error: ${sitesRes.status}`);
        const [batchesData, productsData, sitesData] = await Promise.all([
          batchesRes.json(),
          productsRes.json(),
          sitesRes.json(),
        ]);
        setBatches(batchesData);
        setProducts(productsData);
        setSites(sitesData);
      } catch (err: any) {
        setError('Failed to fetch data: ' + err.message);
      }
    };
    fetchData();
  }, []);

  const fetchRecipes = async (productId: number) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/recipes?productId=${productId}`);
      if (!res.ok) throw new Error(`Recipes fetch error: ${res.status}`);
      const data = await res.json();
      setRecipes(data);
    } catch (err: any) {
      setError('Failed to fetch recipes: ' + err.message);
      setRecipes([]);
    }
  };

  const handleAddBatch = async () => {
    if (!newBatch.batchId || !newBatch.productId || !newBatch.recipeId || !newBatch.siteId) {
      setError('All fields are required');
      return;
    }
    try {
      const res = await fetch(`${API_BASE_URL}/api/batches`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          batchId: newBatch.batchId,
          productId: newBatch.productId,
          recipeId: newBatch.recipeId,
          siteId: newBatch.siteId,
          status: 'In Progress',
          date: new Date().toISOString().split('T')[0],
        }),
      });
      if (!res.ok) throw new Error(`Add batch error: ${res.status}`);
      const addedBatch = await res.json();
      setBatches([...batches, addedBatch]);
      setShowAddModal(false);
      setNewBatch({ batchId: '', productId: 0, recipeId: 0, siteId: '' });
      setRecipes([]);
      setError(null);
    } catch (err: any) {
      setError('Failed to add batch: ' + err.message);
    }
  };

  const filteredBatches = batches.filter(batch =>
    batch.batchId.toLowerCase().includes(searchQuery.toLowerCase()) ||
    batch.productName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="page-container">
      <h2>Production</h2>
      {error && <div className="error">{error}</div>}
      <div className="inventory-actions">
        <button onClick={() => setShowAddModal(true)}>Add New Batch</button>
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
            {filteredBatches.map((batch) => (
              <tr key={batch.batchId}>
                <td>{batch.batchId}</td>
                <td>{batch.productName}</td>
                <td>{batch.status}</td>
                <td>{batch.date}</td>
                <td>{batch.siteName}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {showAddModal && (
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
              {/* Batch # */}
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
              {/* Product */}
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
              {/* Recipe */}
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
              {/* Site */}
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
                  setShowAddModal(false);
                  setNewBatch({ batchId: '', productId: 0, recipeId: 0, siteId: '' });
                  setRecipes([]);
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