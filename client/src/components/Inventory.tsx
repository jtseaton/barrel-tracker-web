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
  const [dailySummary, setDailySummary] = useState<DailySummaryItem[]>([]);
  const [moveForm, setMoveForm] = useState<MoveForm>({ identifier: '', toAccount: 'Storage', proofGallons: '' });
  const [lossForm, setLossForm] = useState<LossForm>({
    identifier: '',
    quantityLost: '',
    proofGallonsLost: '',
    reason: '',
    date: new Date().toISOString().split('T')[0],
  });
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [editItem, setEditItem] = useState<InventoryItem | null>(null);
  const [showMoveModal, setShowMoveModal] = useState(false);
  const [showLossModal, setShowLossModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [adjustForm, setAdjustForm] = useState<{ newQuantity: string; reason: string; date: string }>({
    newQuantity: '',
    reason: '',
    date: new Date().toISOString().split('T')[0],
  });
  const [showAdjustModal, setShowAdjustModal] = useState(false);
  const [productionError, setProductionError] = useState<string | null>(null);

  const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || '';

  useEffect(() => {
    refreshInventory();
  }, [refreshInventory]);

  useEffect(() => {
    console.log('Inventory prop received:', inventory);
    const receivedStored = inventory.filter((item) => ['Received', 'Stored'].includes(item.status));
    console.log('Filtered Received/Stored:', receivedStored);
  }, [inventory]);

  useEffect(() => {
    fetchDailySummary()
      .then(setDailySummary)
      .catch((err) => console.error('Daily summary error:', err));
  }, []);

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
      await refreshInventory();
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
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
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

  const handleEditClick = (item: InventoryItem) => {
    setEditItem({ ...item });
    setShowEditModal(true);
  };

  const handleAdjustClick = () => {
    if (editItem) {
      setAdjustForm({ newQuantity: editItem.quantity || '', reason: '', date: new Date().toISOString().split('T')[0] });
      setShowAdjustModal(true);
    }
  };

  const handleAdjustChange = (field: keyof typeof adjustForm, value: string) => {
    setAdjustForm(prev => ({ ...prev, [field]: value }));
  };

  const handleAdjustSubmit = async () => {
    if (!editItem || !adjustForm.newQuantity || isNaN(parseFloat(adjustForm.newQuantity)) || parseFloat(adjustForm.newQuantity) < 0 || !adjustForm.reason) {
      setProductionError('Valid new quantity and reason are required');
      return;
    }
    try {
      const res = await fetch(`${API_BASE_URL}/api/inventory/adjust`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          identifier: editItem.identifier,
          newQuantity: adjustForm.newQuantity,
          reason: adjustForm.reason,
          date: adjustForm.date,
        }),
      });
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
      await refreshInventory();
      setShowAdjustModal(false);
      setShowEditModal(false);
      setEditItem(null);
      setProductionError(null);
    } catch (err: any) {
      console.error('Adjust inventory error:', err);
      setProductionError('Failed to adjust item: ' + err.message);
    }
  };

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

      <div style={{ marginBottom: '20px' }}>
        <input
          type="text"
          placeholder="Search by Identifier, Type, or Description"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{ padding: '10px', width: '300px', fontSize: '16px', borderRadius: '4px' }}
        />
      </div>

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

      {showEditModal && editItem && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
          <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '5px', maxWidth: '500px', overflowY: 'auto', maxHeight: '80vh' }}>
            <h3>Inventory Item Details</h3>
            <p><strong>Identifier:</strong> {editItem.identifier}</p>
            <p><strong>Type:</strong> {editItem.type}</p>
            <p><strong>Description:</strong> {editItem.description || 'N/A'}</p>
            <p><strong>Quantity:</strong> {editItem.quantity} {editItem.unit}</p>
            <p><strong>Unit:</strong> {editItem.unit || 'N/A'}</p>
            {editItem.type === 'Spirits' && <p><strong>Proof:</strong> {editItem.proof || 'N/A'}</p>}
            {editItem.type === 'Spirits' && <p><strong>Proof Gallons:</strong> {editItem.proofGallons || 'N/A'}</p>}
            <p><strong>Total Cost:</strong> {editItem.totalCost ? `$${parseFloat(editItem.totalCost).toFixed(2)}` : 'N/A'}</p>
            <p><strong>Date Received:</strong> {editItem.receivedDate || 'N/A'}</p>
            <p><strong>Source:</strong> {editItem.source || 'N/A'}</p>
            <p><strong>Location:</strong> {editItem.account || 'Storage'}</p>
            <p><strong>Status:</strong> {editItem.status || 'Stored'}</p>
            <p><strong>DSP Number:</strong> {editItem.dspNumber || 'N/A'}</p>
            <button onClick={handleAdjustClick} style={{ marginTop: '10px' }}>Adjust</button>
            <button onClick={() => setShowEditModal(false)} style={{ marginLeft: '10px' }}>Close</button>
          </div>
        </div>
      )}

      {showAdjustModal && editItem && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
          <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '5px' }}>
            <h3>Adjust Inventory</h3>
            <p><strong>Current Quantity:</strong> {editItem.quantity} {editItem.unit}</p>
            <p><strong>Current Total Cost:</strong> ${parseFloat(editItem.totalCost || '0').toFixed(2)}</p>
            <label>
              New Quantity:
              <input
                type="number"
                value={adjustForm.newQuantity}
                onChange={(e) => handleAdjustChange('newQuantity', e.target.value)}
                step="0.01"
                style={{ marginLeft: '10px', padding: '5px' }}
              />
            </label><br />
            <label>
              Reason:
              <select
                value={adjustForm.reason}
                onChange={(e) => handleAdjustChange('reason', e.target.value)}
                style={{ marginLeft: '10px', padding: '5px' }}
              >
                <option value="">Select Reason</option>
                <option value="Spillage">Spillage</option>
                <option value="Error">Error</option>
                <option value="Breakage">Breakage</option>
                <option value="Destroyed">Destroyed</option>
              </select>
            </label><br />
            <label>
              Date:
              <input
                type="date"
                value={adjustForm.date}
                onChange={(e) => handleAdjustChange('date', e.target.value)}
                style={{ marginLeft: '10px', padding: '5px' }}
              />
            </label><br />
            <button onClick={handleAdjustSubmit} style={{ marginTop: '10px' }}>Save Adjustment</button>
            <button onClick={() => setShowAdjustModal(false)} style={{ marginLeft: '10px' }}>Cancel</button>
            {productionError && <p style={{ color: 'red' }}>{productionError}</p>}
          </div>
        </div>
      )}

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
              onClick={() => handleEditClick(item)}
              style={{ cursor: 'pointer' }}
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