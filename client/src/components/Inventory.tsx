import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { InventoryItem, MoveForm, LossForm, DailySummaryItem } from '../types/interfaces';
import { fetchDailySummary } from '../utils/fetchUtils';

const OUR_DSP = 'DSP-AL-20010';

interface InventoryProps {
  inventory: InventoryItem[];
  refreshInventory: () => Promise<void>;
}

const Inventory: React.FC<InventoryProps> = ({ inventory, refreshInventory }) => {
  // Old State
  const [dailySummary, setDailySummary] = useState<DailySummaryItem[]>([]);
  const [moveForm, setMoveForm] = useState<MoveForm>({ identifier: '', toAccount: 'Storage', proofGallons: '' });
  const [lossForm, setLossForm] = useState<LossForm>({
    identifier: '',
    quantityLost: '',
    proofGallonsLost: '',
    reason: '',
    date: new Date().toISOString().split('T')[0],
  });
  const [showMoveModal, setShowMoveModal] = useState(false);
  const [showLossModal, setShowLossModal] = useState(false);
  const [productionError, setProductionError] = useState<string | null>(null);

  // New State
  const [searchTerm, setSearchTerm] = useState<string>(''); // Added for search
  const [editItem, setEditItem] = useState<InventoryItem | null>(null); // Added for edit
  const [showEditModal, setShowEditModal] = useState(false); // Added for edit modal

  const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || '';

  // Old Effects
  useEffect(() => {
    console.log('Inventory component mounted, refreshing');
    refreshInventory();
  }, [refreshInventory]);

  useEffect(() => {
    console.log('Inventory prop received:', inventory);
    const receivedStored = inventory.filter((item) => ['Received', 'Stored'].includes(item.status));
    console.log('Filtered Received/Stored:', receivedStored);
  }, [inventory]);

  useEffect(() => {
    fetchDailySummary()
      .then((data) => {
        console.log('Daily summary fetched:', data);
        setDailySummary(data);
      })
      .catch((err) => console.error('Daily summary error:', err));
  }, []);

  // Old Handlers
  const handleMove = async () => {
    if (!moveForm.identifier || !moveForm.proofGallons) {
      setProductionError('Please fill in Identifier and Proof Gallons.');
      return;
    }
    try {
      const res = await fetch(`${API_BASE_URL}/api/move`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...moveForm, proofGallons: parseFloat(moveForm.proofGallons) }),
      });
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
      const responseData = await res.json();
      console.log('Move response:', responseData);
      await refreshInventory();
      console.log('Inventory after move:', inventory);
      setMoveForm({ identifier: '', toAccount: 'Storage', proofGallons: '' });
      setShowMoveModal(false);
      setProductionError(null);
    } catch (err: any) {
      console.error('Move error:', err);
      setProductionError('Failed to move item: ' + err.message);
    }
  };

  const handleRecordLoss = async () => {
    if (!lossForm.identifier || !lossForm.quantityLost || !lossForm.proofGallonsLost || !lossForm.reason) {
      setProductionError('Please fill in all fields.');
      return;
    }
    try {
      const res = await fetch(`${API_BASE_URL}/api/record-loss`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...lossForm, dspNumber: OUR_DSP }),
      });
      if (!res.ok) {
        const errorData = await res.text();
        throw new Error(`HTTP error! status: ${res.status}, body: ${errorData}`);
      }
      await refreshInventory();
      setLossForm({
        identifier: '',
        quantityLost: '',
        proofGallonsLost: '',
        reason: '',
        date: new Date().toISOString().split('T')[0],
      });
      setShowLossModal(false);
      setProductionError(null);
    } catch (err: any) {
      console.error('Record loss error:', err);
      setProductionError('Failed to record loss: ' + err.message);
    }
  };

  // New Handlers
  const handleEditClick = (item: InventoryItem) => {
    setEditItem({ ...item }); // Clone item for editing
    setShowEditModal(true);
  };

  const handleEditChange = (field: keyof InventoryItem, value: string) => {
    if (editItem) {
      setEditItem({ ...editItem, [field]: value });
    }
  };

  const handleEditSubmit = async () => {
    if (!editItem || !editItem.quantity || isNaN(parseFloat(editItem.quantity)) || parseFloat(editItem.quantity) < 0) {
      setProductionError('Valid quantity is required');
      return;
    }
    try {
      const res = await fetch(`${API_BASE_URL}/api/inventory/${editItem.identifier}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editItem),
      });
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
      await refreshInventory();
      setShowEditModal(false);
      setEditItem(null);
      setProductionError(null);
    } catch (err: any) {
      console.error('Edit inventory error:', err);
      setProductionError('Failed to update item: ' + err.message);
    }
  };

  // New: Filter inventory based on search term
  const filteredInventory = inventory.filter(item => 
    ['Received', 'Stored'].includes(item.status) && (
      (item.identifier || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (item.type || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (item.description || '').toLowerCase().includes(searchTerm.toLowerCase())
    )
  );

  return (
    <div>
      <h2>Inventory Management</h2>
      <div style={{ marginBottom: '20px' }}>
        <Link to="/receive"><button>Receive Inventory</button></Link>
        <button onClick={() => setShowMoveModal(true)} style={{ marginLeft: '10px' }}>Move Inventory</button>
        <button onClick={() => setShowLossModal(true)} style={{ marginLeft: '10px' }}>Record Loss</button>
      </div>

      {/* New: Search Bar */}
      <div style={{ marginBottom: '20px' }}>
        <input
          type="text"
          placeholder="Search by Identifier, Type, or Description"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{ padding: '10px', width: '300px', fontSize: '16px', borderRadius: '4px' }}
        />
      </div>

      {/* Old: Move Modal */}
      {showMoveModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
          <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '5px' }}>
            <h3>Move Inventory</h3>
            <input type="text" placeholder="Identifier" value={moveForm.identifier} onChange={(e) => setMoveForm({ ...moveForm, identifier: e.target.value })} />
            <select value={moveForm.toAccount} onChange={(e) => setMoveForm({ ...moveForm, toAccount: e.target.value })}>
              <option value="Production">Production</option>
              <option value="Storage">Storage</option>
              <option value="Processing">Processing</option>
            </select>
            <input type="number" placeholder="Proof Gallons" value={moveForm.proofGallons} onChange={(e) => setMoveForm({ ...moveForm, proofGallons: e.target.value })} step="0.01" />
            <button onClick={handleMove}>Submit</button>
            <button onClick={() => setShowMoveModal(false)} style={{ marginLeft: '10px' }}>Cancel</button>
            {productionError && <p style={{ color: 'red' }}>{productionError}</p>}
          </div>
        </div>
      )}

      {/* Old: Loss Modal */}
      {showLossModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
          <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '5px' }}>
            <h3>Record Loss</h3>
            <input type="text" placeholder="Identifier" value={lossForm.identifier} onChange={(e) => setLossForm({ ...lossForm, identifier: e.target.value })} />
            <input type="number" placeholder="Quantity Lost" value={lossForm.quantityLost} onChange={(e) => setLossForm({ ...lossForm, quantityLost: e.target.value })} step="0.01" />
            <input type="number" placeholder="Proof Gallons Lost" value={lossForm.proofGallonsLost} onChange={(e) => setLossForm({ ...lossForm, proofGallonsLost: e.target.value })} step="0.01" />
            <input type="text" placeholder="Reason" value={lossForm.reason} onChange={(e) => setLossForm({ ...lossForm, reason: e.target.value })} />
            <input type="date" value={lossForm.date} onChange={(e) => setLossForm({ ...lossForm, date: e.target.value })} />
            <button onClick={handleRecordLoss}>Submit</button>
            <button onClick={() => setShowLossModal(false)} style={{ marginLeft: '10px' }}>Cancel</button>
            {productionError && <p style={{ color: 'red' }}>{productionError}</p>}
          </div>
        </div>
      )}

      {/* New: Edit Modal */}
      {showEditModal && editItem && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
          <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '5px' }}>
            <h3>Edit Inventory Item</h3>
            <label>
              Identifier: {editItem.identifier} (read-only)
            </label><br />
            <label>
              Quantity:
              <input
                type="number"
                value={editItem.quantity || ''}
                onChange={(e) => handleEditChange('quantity', e.target.value)}
                step="0.01"
                style={{ marginLeft: '10px', padding: '5px' }}
              />
            </label><br />
            <label>
              Proof:
              <input
                type="number"
                value={editItem.proof || ''}
                onChange={(e) => handleEditChange('proof', e.target.value)}
                step="0.01"
                style={{ marginLeft: '10px', padding: '5px' }}
              />
            </label><br />
            <label>
              Total Cost:
              <input
                type="number"
                value={editItem.totalCost || ''}
                onChange={(e) => handleEditChange('totalCost', e.target.value)}
                step="0.01"
                style={{ marginLeft: '10px', padding: '5px' }}
              />
            </label><br />
            <label>
              Description:
              <input
                type="text"
                value={editItem.description || ''}
                onChange={(e) => handleEditChange('description', e.target.value)}
                style={{ marginLeft: '10px', padding: '5px' }}
              />
            </label><br />
            <label>
              Status:
              <select
                value={editItem.status || 'Stored'}
                onChange={(e) => handleEditChange('status', e.target.value)}
                style={{ marginLeft: '10px', padding: '5px' }}
              >
                <option value="Received">Received</option>
                <option value="Stored">Stored</option>
              </select>
            </label><br />
            <label>
              Location:
              <select
                value={editItem.account || 'Storage'}
                onChange={(e) => handleEditChange('account', e.target.value)}
                style={{ marginLeft: '10px', padding: '5px' }}
              >
                <option value="Storage">Storage</option>
                <option value="Production">Production</option>
                <option value="Processing">Processing</option>
              </select>
            </label><br />
            <button onClick={handleEditSubmit} style={{ marginTop: '10px' }}>Save</button>
            <button onClick={() => setShowEditModal(false)} style={{ marginLeft: '10px' }}>Cancel</button>
            {productionError && <p style={{ color: 'red' }}>{productionError}</p>}
          </div>
        </div>
      )}

      {/* Old: Daily Summary Table */}
      <h2>Daily Summary (Proof Gallons)</h2>
      <table>
        <thead>
          <tr><th>Account</th><th>Total Proof Gallons</th></tr>
        </thead>
        <tbody>
          {dailySummary.length > 0 ? dailySummary.map((item) => (
            <tr key={item.account}><td>{item.account}</td><td>{item.totalProofGallons || '0.00'}</td></tr>
          )) : <tr><td colSpan={2}>Loading summary...</td></tr>}
        </tbody>
      </table>

      {/* Old Table with New Click Functionality */}
      <h2>Received/Stored Inventory</h2>
      <table>
        <thead>
          <tr>
            <th>Identifier</th>
            <th>Type</th>
            <th>Description</th>
            <th>Quantity</th>
            <th>Unit</th>
            <th>Proof</th>
            <th>Total Cost</th>
            <th>Date Received</th>
            <th>Source</th>
            <th>Location</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {filteredInventory.map((item) => (
            <tr
              key={item.identifier || `${item.type}-${item.receivedDate}`}
              onClick={() => handleEditClick(item)} // New: Click to edit
              style={{ cursor: 'pointer' }} // New: Indicate clickable
            >
              <td>{item.identifier || 'N/A'}</td>
              <td>{item.type}</td>
              <td>{item.description || 'N/A'}</td>
              <td>{item.quantity || '0.00'}</td>
              <td>{item.unit || 'N/A'}</td>
              <td>{item.proof || 'N/A'}</td>
              <td>{item.totalCost ? `$${parseFloat(item.totalCost).toFixed(2)}` : 'N/A'}</td>
              <td>{item.receivedDate || 'N/A'}</td>
              <td>{item.source || 'N/A'}</td>
              <td>{item.account || 'Storage'}</td>
              <td>{item.status}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Old: Packaged Inventory Table */}
      <h2>Finished Packaged Inventory</h2>
      <table>
        <thead>
          <tr>
            <th>Identifier</th>
            <th>Type</th>
            <th>Quantity (WG)</th>
            <th>Proof</th>
            <th>Proof Gallons</th>
            <th>Date Packaged</th>
            <th>Source</th>
            <th>Location</th>
          </tr>
        </thead>
        <tbody>
          {inventory.filter((item) => item.account === 'Processing' && item.status === 'Packaged').map((item) => (
            <tr key={item.identifier || `${item.type}-${item.receivedDate}`}>
              <td>{item.identifier || 'N/A'}</td>
              <td>{item.type}</td>
              <td>{item.quantity || '0.00'}</td>
              <td>{item.proof || '0.00'}</td>
              <td>{item.proofGallons || '0.00'}</td>
              <td>{item.receivedDate || 'N/A'}</td>
              <td>{item.source || 'N/A'}</td>
              <td>{item.account || 'Storage'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default Inventory;