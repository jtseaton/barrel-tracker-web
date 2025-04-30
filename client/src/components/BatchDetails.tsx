import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Batch, Product, Site } from '../types/interfaces';
import '../App.css';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:3000';

interface Ingredient {
  itemName: string;
  quantity: number;
  unit: string;
  isRecipe?: boolean;
}

interface BatchAction {
  id: number;
  action: string;
  timestamp: string;
}

const BatchDetails: React.FC = () => {
  const { batchId } = useParams<{ batchId: string }>();
  const navigate = useNavigate();
  const [batch, setBatch] = useState<Batch | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [items, setItems] = useState<{ name: string; type: string; enabled: number }[]>([]);
  const [actions, setActions] = useState<BatchAction[]>([]);
  const [newAction, setNewAction] = useState('');
  const [newBatchId, setNewBatchId] = useState('');
  const [newIngredient, setNewIngredient] = useState<Ingredient>({ itemName: '', quantity: 0, unit: 'lbs' });
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const endpoints = [
          { url: `${API_BASE_URL}/api/batches/${batchId}`, setter: setBatch, name: 'batch', single: true },
          { url: `${API_BASE_URL}/api/products`, setter: setProducts, name: 'products' },
          { url: `${API_BASE_URL}/api/sites`, setter: setSites, name: 'sites' },
          { url: `${API_BASE_URL}/api/items`, setter: setItems, name: 'items' },
          { url: `${API_BASE_URL}/api/batches/${batchId}/actions`, setter: setActions, name: 'actions' },
        ];
        const responses = await Promise.all(
          endpoints.map(({ url }) => fetch(url, { headers: { Accept: 'application/json' } }))
        );
        for (let i = 0; i < responses.length; i++) {
          const res = responses[i];
          const { name, setter, single } = endpoints[i];
          if (!res.ok) {
            const text = await res.text();
            throw new Error(`Failed to fetch ${name}: HTTP ${res.status}, Response: ${text.slice(0, 50)}`);
          }
          const data = await res.json();
          setter(single ? data : data);
        }
      } catch (err: any) {
        console.error('Fetch error:', err);
        setError('Failed to load batch details: ' + err.message);
      }
    };
    fetchData();
  }, [batchId]);

  const handleAddAction = async () => {
    if (!newAction) {
      setError('Action description is required');
      return;
    }
    try {
      const res = await fetch(`${API_BASE_URL}/api/batches/${batchId}/actions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ action: newAction }),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Failed to add action: HTTP ${res.status}, Response: ${text.slice(0, 50)}`);
      }
      const addedAction = await res.json();
      setActions([...actions, addedAction]);
      setNewAction('');
      setError(null);
      setSuccessMessage('Action added successfully');
      setTimeout(() => setSuccessMessage(null), 2000);
    } catch (err: any) {
      console.error('Add action error:', err);
      setError('Failed to add action: ' + err.message);
    }
  };

  const handleCompleteBatch = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/batches/${batchId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ status: 'Completed' }),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Failed to complete batch: HTTP ${res.status}, Response: ${text.slice(0, 50)}`);
      }
      setBatch((prev) => prev ? { ...prev, status: 'Completed' } : null);
      setError(null);
      setSuccessMessage('Batch completed successfully');
      setTimeout(() => setSuccessMessage(null), 2000);
    } catch (err: any) {
      console.error('Complete batch error:', err);
      setError('Failed to complete batch: ' + err.message);
    }
  };

  const handleEditBatchName = async () => {
    if (!newBatchId) {
      setError('New batch ID is required');
      return;
    }
    try {
      const res = await fetch(`${API_BASE_URL}/api/batches/${batchId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ batchId: newBatchId }),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Failed to update batch ID: HTTP ${res.status}, Response: ${text.slice(0, 50)}`);
      }
      setBatch((prev) => prev ? { ...prev, batchId: newBatchId } : null);
      setNewBatchId('');
      setError(null);
      setSuccessMessage('Batch ID updated successfully');
      setTimeout(() => {
        setSuccessMessage(null);
        navigate(`/production/${newBatchId}`);
      }, 2000);
    } catch (err: any) {
      console.error('Update batch ID error:', err);
      setError('Failed to update batch ID: ' + err.message);
    }
  };

  const handleDeleteBatch = async () => {
    if (!window.confirm('Are you sure you want to delete this batch?')) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/batches/${batchId}`, {
        method: 'DELETE',
        headers: { Accept: 'application/json' },
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Failed to delete batch: HTTP ${res.status}, Response: ${text.slice(0, 50)}`);
      }
      setError(null);
      setSuccessMessage('Batch deleted successfully');
      setTimeout(() => {
        setSuccessMessage(null);
        navigate('/production');
      }, 2000);
    } catch (err: any) {
      console.error('Delete batch error:', err);
      setError('Failed to delete batch: ' + err.message);
    }
  };

  const handleAddIngredient = async () => {
    if (!newIngredient.itemName || newIngredient.quantity <= 0 || !newIngredient.unit) {
      setError('Valid item, quantity, and unit are required');
      return;
    }
    try {
      const res = await fetch(`${API_BASE_URL}/api/batches/${batchId}/ingredients`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(newIngredient),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Failed to add ingredient: HTTP ${res.status}, Response: ${text.slice(0, 50)}`);
      }
      const updatedBatch = await res.json();
      setBatch(updatedBatch);
      setNewIngredient({ itemName: '', quantity: 0, unit: 'lbs' });
      setError(null);
      setSuccessMessage('Ingredient added successfully');
      setTimeout(() => setSuccessMessage(null), 2000);
    } catch (err: any) {
      console.error('Add ingredient error:', err);
      setError('Failed to add ingredient: ' + err.message);
    }
  };

  const handleRemoveIngredient = async (ingredient: Ingredient) => {
    if (!window.confirm(`Remove ${ingredient.quantity} ${ingredient.unit || 'lbs'} of ${ingredient.itemName}?`)) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/batches/${batchId}/ingredients`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ ...ingredient, unit: ingredient.unit || 'lbs' }), // Ensure unit is included
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Failed to remove ingredient: HTTP ${res.status}, Response: ${text.slice(0, 50)}`);
      }
      const updatedBatch = await res.json();
      setBatch(updatedBatch);
      setError(null);
      setSuccessMessage('Ingredient removed successfully');
      setTimeout(() => setSuccessMessage(null), 2000);
    } catch (err: any) {
      console.error('Remove ingredient error:', err);
      setError('Failed to remove ingredient: ' + err.message);
    }
  };

  if (!batch) return <div>Loading...</div>;

  const product = products.find(p => p.id === batch.productId);
  const site = sites.find(s => s.siteId === batch.siteId);

  return (
    <div className="page-container">
      <h2>Batch Details: {batch.batchId}</h2>
      {error && <div className="error">{error}</div>}
      {successMessage && <div style={{ color: '#28A745', backgroundColor: '#e6ffe6', padding: '10px', borderRadius: '4px', marginBottom: '10px', textAlign: 'center' }}>{successMessage}</div>}
      <div className="batch-details">
        <p><strong>Product:</strong> {product?.name || 'Unknown'}</p>
        <p><strong>Recipe:</strong> {batch.recipeName || 'Unknown'}</p>
        <p><strong>Site:</strong> {site?.name || batch.siteId}</p>
        <p><strong>Status:</strong> {batch.status}</p>
        <p><strong>Date:</strong> {batch.date}</p>
      </div>

      <h3>Ingredients</h3>
      <div className="batch-details">
        {batch && batch.ingredients && batch.ingredients.length > 0 ? (
          <table className="inventory-table">
            <thead>
              <tr>
                <th>Item</th>
                <th>Quantity</th>
                <th>Unit</th>
                <th>Source</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {batch.ingredients.map((ing: Ingredient, index: number) => (
                <tr key={index}>
                  <td>{ing.itemName}</td>
                  <td>{ing.quantity}</td>
                  <td>{ing.unit || 'lbs'}</td>
                  <td>{ing.isRecipe ? 'Recipe' : 'Added'}</td>
                  <td>
                    <button
                      onClick={() => handleRemoveIngredient(ing)}
                      style={{
                        backgroundColor: '#F86752',
                        color: '#fff',
                        padding: '8px 12px',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                      }}
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p>No ingredients</p>
        )}
        <div style={{ marginTop: '20px' }}>
          <h4>Add Ingredient</h4>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <select
              value={newIngredient.itemName}
              onChange={(e) => setNewIngredient({ ...newIngredient, itemName: e.target.value })}
              style={{ padding: '10px', border: '1px solid #CCCCCC', borderRadius: '4px', fontSize: '16px' }}
            >
              <option value="">Select Item</option>
              {items.filter(item => item.enabled).map((item) => (
                <option key={item.name} value={item.name}>{item.name}</option>
              ))}
            </select>
            <input
              type="number"
              value={newIngredient.quantity || ''}
              onChange={(e) => setNewIngredient({ ...newIngredient, quantity: parseFloat(e.target.value) || 0 })}
              placeholder="Quantity"
              step="0.01"
              min="0"
              style={{ padding: '10px', border: '1px solid #CCCCCC', borderRadius: '4px', fontSize: '16px', width: '100px' }}
            />
            <select
              value={newIngredient.unit}
              onChange={(e) => setNewIngredient({ ...newIngredient, unit: e.target.value })}
              style={{ padding: '10px', border: '1px solid #CCCCCC', borderRadius: '4px', fontSize: '16px' }}
            >
              <option value="lbs">lbs</option>
              <option value="kg">kg</option>
              <option value="oz">oz</option>
              <option value="gal">gal</option>
              <option value="l">l</option>
            </select>
            <button
              onClick={handleAddIngredient}
              style={{
                backgroundColor: '#2196F3',
                color: '#fff',
                padding: '10px 20px',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
              }}
            >
              Add
            </button>
          </div>
        </div>
      </div>

      <h3>Actions</h3>
      <div style={{ marginBottom: '20px' }}>
        {actions.length > 0 ? (
          <ul>
            {actions.map((action) => (
              <li key={action.id}>{action.action} - {new Date(action.timestamp).toLocaleString()}</li>
            ))}
          </ul>
        ) : (
          <p>No actions recorded</p>
        )}
        <div style={{ marginTop: '20px' }}>
          <h4>Add New Action</h4>
          <input
            type="text"
            value={newAction}
            onChange={(e) => setNewAction(e.target.value)}
            placeholder="Enter action (e.g., Added hops)"
            style={{ padding: '10px', border: '1px solid #CCCCCC', borderRadius: '4px', fontSize: '16px', width: '300px', marginRight: '10px' }}
          />
          <button
            onClick={handleAddAction}
            style={{
              backgroundColor: '#2196F3',
              color: '#fff',
              padding: '10px 20px',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
            }}
          >
            Add Action
          </button>
        </div>
      </div>

      <h3>Batch Management</h3>
      <div style={{ display: 'flex', gap: '20px', marginBottom: '20px' }}>
        <div>
          <input
            type="text"
            value={newBatchId}
            onChange={(e) => setNewBatchId(e.target.value)}
            placeholder="New Batch ID"
            style={{ padding: '10px', border: '1px solid #CCCCCC', borderRadius: '4px', fontSize: '16px', width: '200px', marginRight: '10px' }}
          />
          <button
            onClick={handleEditBatchName}
            style={{
              backgroundColor: '#2196F3',
              color: '#fff',
              padding: '10px 20px',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
            }}
          >
            Edit Batch Name
          </button>
        </div>
        <button
          onClick={handleCompleteBatch}
          disabled={batch.status === 'Completed'}
          style={{
            backgroundColor: batch.status === 'Completed' ? '#ccc' : '#2196F3',
            color: '#fff',
            padding: '10px 20px',
            border: 'none',
            borderRadius: '4px',
            cursor: batch.status === 'Completed' ? 'not-allowed' : 'pointer',
          }}
        >
          Complete Batch
        </button>
        <button
          onClick={handleDeleteBatch}
          style={{
            backgroundColor: '#F86752',
            color: '#fff',
            padding: '10px 20px',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
          }}
        >
          Delete Batch
        </button>
      </div>
    </div>
  );
};

export default BatchDetails;