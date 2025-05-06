import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Batch, Ingredient, PackagingAction, BatchDetailsProps } from '../types/interfaces';

const BatchDetails: React.FC<BatchDetailsProps> = ({ inventory, refreshInventory }) => {
  const { batchId } = useParams<{ batchId: string }>();
  const navigate = useNavigate();
  const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:3001';

  // State declarations
  const [batch, setBatch] = useState<Batch>({} as Batch);
  const [products, setProducts] = useState<any[]>([]);
  const [sites, setSites] = useState<any[]>([]);
  const [items, setItems] = useState<any[]>([]);
  const [actions, setActions] = useState<any[]>([]);
  const [equipment, setEquipment] = useState<any[]>([]);
  const [locations, setLocations] = useState<any[]>([]);
  const [newBatchId, setNewBatchId] = useState('');
  const [stage, setStage] = useState<string>('Mashing');
  const [selectedEquipmentId, setSelectedEquipmentId] = useState<number | null>(null);
  const [newIngredients, setNewIngredients] = useState([{ itemName: '', quantity: 0, unit: 'lbs' }]);
  const [newAction, setNewAction] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [packageType, setPackageType] = useState('');
  const [packageQuantity, setPackageQuantity] = useState(0);
  const [packageLocation, setPackageLocation] = useState('');
  const [showVolumePrompt, setShowVolumePrompt] = useState<{ message: string; shortfall: number } | null>(null);
  const [showLossPrompt, setShowLossPrompt] = useState<{ volume: number } | null>(null);
  const [pendingDeletions, setPendingDeletions] = useState(new Set<string>());
  const [newIngredient, setNewIngredient] = useState({ itemName: '', quantity: 0, unit: 'lbs' });
  const [packagingActions, setPackagingActions] = useState<PackagingAction[]>([]);
  const [editPackaging, setEditPackaging] = useState<PackagingAction | null>(null);

  const packageVolumes: { [key: string]: number } = {
    '1/2 BBL Keg': 0.5,
    '1/6 BBL Keg': 0.167,
    '750ml Bottle': 0.006,
  };

  // Existing functions (assumed; replace with your actual implementations)
  const handleEditBatchName = async () => {
    // Your implementation
  };
  const handleCompleteBatch = async () => {
    // Your implementation
  };
  const handleUnCompleteBatch = async () => {
    // Your implementation
  };
  const handleDeleteBatch = async () => {
    // Your implementation
  };
  const handlePrintBatchSheet = () => {
    // Your implementation
  };
  const handleProgressBatch = async () => {
    // Your implementation
  };
  const handleAddIngredient = async () => {
    // Your implementation
  };
  const handleRemoveIngredient = async (ingredient: Ingredient) => {
    // Your implementation
  };
  const handleAddAction = async () => {
    // Your implementation
  };
  const handlePackage = async () => {
    // Your implementation
  };
  const handleVolumeAdjustment = async (confirm: boolean) => {
    // Your implementation
  };
  const handleLossConfirmation = async (confirm: boolean) => {
    // Your implementation
  };

  // Current Equipment
  const product = products.find((p) => p.id === batch.productId);
  const site = sites.find((s) => s.siteId === batch.siteId);
  const currentEquipment = equipment.find((e) => e.equipmentId === batch.equipmentId);

  // Inside BatchDetails.tsx
useEffect(() => {
  const fetchData = async () => {
    try {
      const endpoints = [
        { url: `${API_BASE_URL}/api/batches/${batchId}`, setter: setBatch, name: 'batch', single: true },
        { url: `${API_BASE_URL}/api/products`, setter: setProducts, name: 'products' },
        { url: `${API_BASE_URL}/api/sites`, setter: setSites, name: 'sites' },
        { url: `${API_BASE_URL}/api/items`, setter: setItems, name: 'items' },
        { url: `${API_BASE_URL}/api/batches/${batchId}/actions`, setter: setActions, name: 'actions' },
        { url: `${API_BASE_URL}/api/batches/${batchId}/package`, setter: setPackagingActions, name: 'packaging' },
      ].filter(endpoint => endpoint.url !== null);

      console.log('Fetching endpoints:', endpoints.map(e => e.url));

      const responses = await Promise.all(
        endpoints.map(({ url }) => fetch(url, { headers: { Accept: 'application/json' } }))
      );

      for (let i = 0; i < responses.length; i++) {
        const res = responses[i];
        const { name, setter, single } = endpoints[i];
        console.log(`Response for ${name}:`, { url: endpoints[i].url, status: res.status, ok: res.ok });

        if (!res.ok) {
          const text = await res.text();
          console.error(`Failed to fetch ${name}: HTTP ${res.status}, Response:`, text.slice(0, 100));
          throw new Error(`Failed to fetch ${name}: HTTP ${res.status}, Response: ${text.slice(0, 50)}`);
        }

        const contentType = res.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
          const text = await res.text();
          console.error(`Invalid content-type for ${name}:`, contentType, 'Response:', text.slice(0, 100));
          throw new Error(`Invalid response for ${name}: Expected JSON, got ${contentType}`);
        }

        const data = await res.json();
        setter(single ? data : data);
      }

      if (batch) {
        setSelectedEquipmentId(batch.equipmentId || null);
        setStage(batch.stage || 'Mashing');
        setNewIngredients(batch.additionalIngredients || [{ itemName: '', quantity: 0, unit: 'lbs' }]);
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      console.error('Fetch error:', err);
      setError('Failed to load batch details: ' + errorMessage);
    }
  };
  fetchData();
}, [batchId]);

// Separate useEffect for equipment and locations
useEffect(() => {
  if (!batch?.siteId) return;
  const fetchSiteData = async () => {
    try {
      const endpoints = [
        { url: `${API_BASE_URL}/api/equipment?siteId=${batch.siteId}`, setter: setEquipment, name: 'equipment' },
        { url: `${API_BASE_URL}/api/locations?siteId=${batch.siteId}`, setter: setLocations, name: 'locations' },
      ];

      console.log('Fetching site endpoints:', endpoints.map(e => e.url));

      const responses = await Promise.all(
        endpoints.map(({ url }) => fetch(url, { headers: { Accept: 'application/json' } }))
      );

      for (let i = 0; i < responses.length; i++) {
        const res = responses[i];
        const { name, setter } = endpoints[i];
        console.log(`Response for ${name}:`, { url: endpoints[i].url, status: res.status, ok: res.ok });

        if (!res.ok) {
          const text = await res.text();
          console.error(`Failed to fetch ${name}: HTTP ${res.status}, Response:`, text.slice(0, 100));
          throw new Error(`Failed to fetch ${name}: HTTP ${res.status}, Response: ${text.slice(0, 50)}`);
        }

        const contentType = res.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
          const text = await res.text();
          console.error(`Invalid content-type for ${name}:`, contentType, 'Response:', text.slice(0, 100));
          throw new Error(`Invalid response for ${name}: Expected JSON, got ${contentType}`);
        }

        const data = await res.json();
        setter(data);
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      console.error('Fetch site data error:', err);
      setError('Failed to load site data: ' + errorMessage);
    }
  };
  fetchSiteData();
}, [batch?.siteId]);

  return (
    <div className="page-container">
      <h2>Batch Details: {batch.batchId}</h2>
      {error && <div className="error">{error}</div>}
      {successMessage && (
        <div style={{ color: '#28A745', backgroundColor: '#e6ffe6', padding: '10px', borderRadius: '4px', marginBottom: '10px', textAlign: 'center' }}>
          {successMessage}
        </div>
      )}
      <h3>Batch Management</h3>
      <div style={{ display: 'flex', gap: '20px', marginBottom: '20px', flexWrap: 'wrap' }}>
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
          onClick={handleUnCompleteBatch}
          disabled={batch.status !== 'Completed'}
          style={{
            backgroundColor: batch.status !== 'Completed' ? '#ccc' : '#2196F3',
            color: '#fff',
            padding: '10px 20px',
            border: 'none',
            borderRadius: '4px',
            cursor: batch.status !== 'Completed' ? 'not-allowed' : 'pointer',
          }}
        >
          Un-Complete Batch
        </button>
        <button
          onClick={handleDeleteBatch}
          disabled={batch.status === 'Completed'}
          style={{
            backgroundColor: batch.status === 'Completed' ? '#ccc' : '#F86752',
            color: '#fff',
            padding: '10px 20px',
            border: 'none',
            borderRadius: '4px',
            cursor: batch.status === 'Completed' ? 'not-allowed' : 'pointer',
          }}
        >
          Delete Batch
        </button>
        <button
          onClick={() => navigate(`/production/${batchId}/brewlog`)}
          style={{
            backgroundColor: '#2196F3',
            color: '#fff',
            padding: '10px 20px',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
          }}
        >
          Add Brew Day Log
        </button>
        <button
          onClick={handlePrintBatchSheet}
          style={{
            backgroundColor: '#2196F3',
            color: '#fff',
            padding: '10px 20px',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
          }}
        >
          Print Batch Sheet
        </button>
      </div>
      <div style={{ marginTop: '20px' }}>
        <h3>Progress Batch</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxWidth: '300px' }}>
          <select
            value={stage}
            onChange={(e) => setStage(e.target.value as typeof stage)}
            style={{ padding: '10px', border: '1px solid #CCCCCC', borderRadius: '4px', fontSize: '16px', width: '100%' }}
          >
            <option value="Mashing">Mashing</option>
            <option value="Boiling">Boiling</option>
            <option value="Fermenting">Fermenting</option>
            <option value="Bright Tank">Bright Tank</option>
            <option value="Packaging">Packaging</option>
            <option value="Completed">Completed</option>
          </select>
          <select
            value={selectedEquipmentId || ''}
            onChange={(e) => setSelectedEquipmentId(parseInt(e.target.value) || null)}
            style={{ padding: '10px', border: '1px solid #CCCCCC', borderRadius: '4px', fontSize: '16px', width: '100%' }}
            disabled={stage === 'Completed' || stage === 'Packaging'}
          >
            <option value="">Select Equipment</option>
            {equipment.map((equip) => (
              <option key={equip.equipmentId} value={equip.equipmentId}>{equip.name}</option>
            ))}
          </select>
          {stage === 'Boiling' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <h4 style={{ margin: '0', fontSize: '16px' }}>Add Ingredients (Optional)</h4>
              <select
                value={newIngredients[0]?.itemName || ''}
                onChange={(e) => setNewIngredients([{ ...newIngredients[0], itemName: e.target.value }])}
                style={{ padding: '10px', border: '1px solid #CCCCCC', borderRadius: '4px', fontSize: '16px', width: '100%' }}
              >
                <option value="">Select Item</option>
                {items.filter(item => item.enabled).map((item) => (
                  <option key={item.name} value={item.name}>{item.name}</option>
                ))}
              </select>
              <input
                type="number"
                value={newIngredients[0]?.quantity || ''}
                onChange={(e) => setNewIngredients([{ ...newIngredients[0], quantity: parseFloat(e.target.value) || 0 }])}
                placeholder="Quantity"
                step="0.01"
                min="0"
                style={{ padding: '10px', border: '1px solid #CCCCCC', borderRadius: '4px', fontSize: '16px', width: '100%' }}
              />
              <select
                value={newIngredients[0]?.unit || 'lbs'}
                onChange={(e) => setNewIngredients([{ ...newIngredients[0], unit: e.target.value }])}
                style={{ padding: '10px', border: '1px solid #CCCCCC', borderRadius: '4px', fontSize: '16px', width: '100%' }}
              >
                <option value="lbs">lbs</option>
                <option value="kg">kg</option>
                <option value="oz">oz</option>
                <option value="gal">gal</option>
                <option value="l">l</option>
              </select>
            </div>
          )}
          {stage === 'Packaging' && (
            <>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <h4 style={{ margin: '0', fontSize: '16px' }}>Package Batch</h4>
                <select
                  value={packageType}
                  onChange={(e) => setPackageType(e.target.value)}
                  style={{ padding: '10px', border: '1px solid #CCCCCC', borderRadius: '4px', fontSize: '16px', width: '100%' }}
                >
                  <option value="">Select Package Type</option>
                  <option value="1/2 BBL Keg">1/2 BBL Keg (15.5 gal)</option>
                  <option value="1/6 BBL Keg">1/6 BBL Keg (5.16 gal)</option>
                  <option value="750ml Bottle">750ml Bottle</option>
                </select>
                <input
                  type="number"
                  value={packageQuantity || ''}
                  onChange={(e) => setPackageQuantity(parseInt(e.target.value) || 0)}
                  placeholder="Quantity"
                  min="1"
                  style={{ padding: '10px', border: '1px solid #CCCCCC', borderRadius: '4px', fontSize: '16px', width: '100%' }}
                />
                <select
                  value={packageLocation}
                  onChange={(e) => setPackageLocation(e.target.value)}
                  style={{ padding: '10px', border: '1px solid #CCCCCC', borderRadius: '4px', fontSize: '16px', width: '100%' }}
                >
                  <option value="">Select Location</option>
                  {locations.map((loc) => (
                    <option key={loc.locationId} value={loc.locationId}>{loc.name}</option>
                  ))}
                </select>
                <button
                  onClick={handlePackage}
                  disabled={!packageType || packageQuantity <= 0 || !packageLocation}
                  style={{
                    backgroundColor: !packageType || packageQuantity <= 0 || !packageLocation ? '#ccc' : '#28A745',
                    color: '#fff',
                    padding: '10px 20px',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: !packageType || packageQuantity <= 0 || !packageLocation ? 'not-allowed' : 'pointer',
                    fontSize: '16px',
                    width: '100%',
                  }}
                >
                  Package
                </button>
              </div>
              <div style={{ marginTop: '20px' }}>
                <h4 style={{ margin: '0', fontSize: '16px' }}>Packaging Actions</h4>
                {packagingActions.length === 0 ? (
                  <p>No packaging actions recorded.</p>
                ) : (
                  <table style={{ width: '100%', borderCollapse: 'collapse', backgroundColor: '#fff', borderRadius: '8px', marginTop: '10px' }}>
                    <thead>
                      <tr>
                        <th style={{ padding: '10px', backgroundColor: '#f5f5f5', borderBottom: '1px solid #ddd', color: '#555' }}>Package Type</th>
                        <th style={{ padding: '10px', backgroundColor: '#f5f5f5', borderBottom: '1px solid #ddd', color: '#555' }}>Quantity</th>
                        <th style={{ padding: '10px', backgroundColor: '#f5f5f5', borderBottom: '1px solid #ddd', color: '#555' }}>Volume (Barrels)</th>
                        <th style={{ padding: '10px', backgroundColor: '#f5f5f5', borderBottom: '1px solid #ddd', color: '#555' }}>Date</th>
                        <th style={{ padding: '10px', backgroundColor: '#f5f5f5', borderBottom: '1px solid #ddd', color: '#555' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {packagingActions.map((action) => (
                        <tr key={action.id}>
                          <td style={{ padding: '10px' }}>{action.packageType}</td>
                          <td style={{ padding: '10px' }}>{action.quantity}</td>
                          <td style={{ padding: '10px' }}>{action.volume.toFixed(3)}</td>
                          <td style={{ padding: '10px' }}>{action.date}</td>
                          <td style={{ padding: '10px' }}>
                            <button
                              onClick={() => setEditPackaging(action)}
                              style={{
                                backgroundColor: '#2196F3',
                                color: '#fff',
                                padding: '8px 12px',
                                border: 'none',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                fontSize: '14px',
                              }}
                            >
                              Edit
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </>
          )}
          <button
            onClick={handleProgressBatch}
            style={{
              backgroundColor: '#2196F3',
              color: '#fff',
              padding: '10px 20px',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '16px',
              width: '100%',
            }}
          >
            Progress to {stage}
          </button>
        </div>
      </div>
      <div className="batch-details">
        <p><strong>Product:</strong> {product?.name || 'Unknown'}</p>
        <p><strong>Recipe:</strong> {batch.recipeName || 'Unknown'}</p>
        <p><strong>Site:</strong> {site?.name || batch.siteId}</p>
        <p><strong>Status:</strong> {batch.status}</p>
        <p><strong>Current Equipment:</strong> {currentEquipment?.name || (batch?.equipmentId ? `Equipment ID: ${batch.equipmentId}` : 'None')}</p>
        <p><strong>Stage:</strong> {batch.stage || 'Mashing'}</p>
        <p><strong>Volume:</strong> {batch.volume ? `${batch.volume.toFixed(2)} barrels` : 'N/A'}</p>
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
              {batch.ingredients.map((ing: Ingredient, index: number) => {
                const deletionKey = `${ing.itemName}-${ing.quantity}-${ing.unit || 'lbs'}`;
                return (
                  <tr key={index}>
                    <td>{ing.itemName}</td>
                    <td>{ing.quantity}</td>
                    <td>{ing.unit || 'lbs'}</td>
                    <td>{ing.isRecipe ? 'Recipe' : 'Added'}</td>
                    <td>
                      <button
                        onClick={() => handleRemoveIngredient(ing)}
                        disabled={pendingDeletions.has(deletionKey)}
                        style={{
                          backgroundColor: '#F86752',
                          color: '#fff',
                          padding: '8px 12px',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: pendingDeletions.has(deletionKey) ? 'not-allowed' : 'pointer',
                          opacity: pendingDeletions.has(deletionKey) ? 0.6 : 1,
                        }}
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <p>No ingredients</p>
        )}
        <div style={{ marginTop: '20px' }}>
          <h4>Add Ingredient</h4>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
            <select
              value={newIngredient.itemName}
              onChange={(e) => setNewIngredient({ ...newIngredient, itemName: e.target.value })}
              style={{ padding: '10px', border: '1px solid #CCCCCC', borderRadius: '4px', fontSize: '16px', flex: '1', minWidth: '150px' }}
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
              style={{ padding: '10px', border: '1px solid #CCCCCC', borderRadius: '4px', fontSize: '16px', flex: '1', minWidth: '100px' }}
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
                fontSize: '16px',
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
              fontSize: '16px',
            }}
          >
            Add Action
          </button>
        </div>
      </div>

      {editPackaging && (
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
              width: '400px',
              boxShadow: '0 4px 8px rgba(0,0,0,0.2)',
              textAlign: 'center',
              color: '#555',
            }}
          >
            <h3 style={{ color: '#555', marginBottom: '20px' }}>Edit Packaging Action</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '15px' }}>
              <div>
                <label style={{ fontWeight: 'bold', color: '#555', display: 'block', marginBottom: '5px' }}>
                  Package Type:
                </label>
                <input
                  type="text"
                  value={editPackaging.packageType}
                  disabled
                  style={{
                    width: '100%',
                    padding: '10px',
                    border: '1px solid #CCCCCC',
                    borderRadius: '4px',
                    fontSize: '16px',
                    boxSizing: 'border-box',
                    color: '#000000',
                    backgroundColor: '#F5F5F5',
                  }}
                />
              </div>
              <div>
                <label style={{ fontWeight: 'bold', color: '#555', display: 'block', marginBottom: '5px' }}>
                  Quantity:
                </label>
                <input
                  type="number"
                  value={editPackaging.quantity}
                  onChange={(e) => setEditPackaging({ ...editPackaging, quantity: parseInt(e.target.value) || 0 })}
                  min="0"
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
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-around', marginTop: '20px' }}>
              <button
                onClick={async () => {
                  try {
                    const res = await fetch(`${API_BASE_URL}/api/batches/${batchId}/package/${editPackaging.id}`, {
                      method: 'PATCH',
                      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
                      body: JSON.stringify({ quantity: editPackaging.quantity }),
                    });
                    if (!res.ok) {
                      const text = await res.text();
                      throw new Error(`Failed to update packaging: HTTP ${res.status}, Response: ${text.slice(0, 50)}`);
                    }
                    const data = await res.json();
                    console.log('Edit packaging success:', data);
                    setPackagingActions((prev) =>
                      prev.map((action) =>
                        action.id === editPackaging.id
                          ? { ...action, quantity: editPackaging.quantity, volume: editPackaging.quantity * (packageVolumes[action.packageType] || 0) }
                          : action
                      )
                    );
                    setBatch((prev) => ({ ...prev, volume: data.newBatchVolume }));
                    setEditPackaging(null);
                    setSuccessMessage('Packaging action updated successfully');
                    setTimeout(() => setSuccessMessage(null), 2000);
                    setError(null);
                    await refreshInventory();
                  } catch (err: unknown) {
                    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
                    console.error('Edit packaging error:', err);
                    setError('Failed to update packaging: ' + errorMessage);
                  }
                }}
                style={{
                  backgroundColor: '#2196F3',
                  color: '#fff',
                  padding: '10px 20px',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '16px',
                }}
              >
                Save
              </button>
              <button
                onClick={() => setEditPackaging(null)}
                style={{
                  backgroundColor: '#F86752',
                  color: '#fff',
                  padding: '10px 20px',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '16px',
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {showVolumePrompt && (
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
              width: '400px',
              boxShadow: '0 4px 8px rgba(0,0,0,0.2)',
              textAlign: 'center',
              color: '#555',
            }}
          >
            <h3 style={{ color: '#F86752', marginBottom: '10px' }}>Volume Adjustment Required</h3>
            <p style={{ marginBottom: '20px' }}>{showVolumePrompt.message}</p>
            <div style={{ display: 'flex', justifyContent: 'space-around' }}>
              <button
                onClick={() => handleVolumeAdjustment(true)}
                style={{
                  backgroundColor: '#2196F3',
                  color: '#fff',
                  padding: '10px 20px',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '16px',
                }}
              >
                Yes
              </button>
              <button
                onClick={() => handleVolumeAdjustment(false)}
                style={{
                  backgroundColor: '#F86752',
                  color: '#fff',
                  padding: '10px 20px',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '16px',
                }}
              >
                No
              </button>
            </div>
          </div>
        </div>
      )}

      {showLossPrompt && (
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
              width: '400px',
              boxShadow: '0 4px 8px rgba(0,0,0,0.2)',
              textAlign: 'center',
              color: '#555',
            }}
          >
            <h3 style={{ color: '#F86752', marginBottom: '10px' }}>Unpackaged Volume Detected</h3>
            <p style={{ marginBottom: '20px' }}>
              {showLossPrompt.volume.toFixed(3)} barrels remain unpackaged. Do you want to report a {showLossPrompt.volume.toFixed(3)} barrel loss?
            </p>
            <div style={{ display: 'flex', justifyContent: 'space-around' }}>
              <button
                onClick={() => handleLossConfirmation(true)}
                style={{
                  backgroundColor: '#2196F3',
                  color: '#fff',
                  padding: '10px 20px',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '16px',
                }}
              >
                Yes
              </button>
              <button
                onClick={() => handleLossConfirmation(false)}
                style={{
                  backgroundColor: '#F86752',
                  color: '#fff',
                  padding: '10px 20px',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '16px',
                }}
              >
                No
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BatchDetails;