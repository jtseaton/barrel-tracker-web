import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
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
  const [showMoveModal, setShowMoveModal] = useState(false);
  const [showLossModal, setShowLossModal] = useState(false);
  const [productionError, setProductionError] = useState<string | null>(null);

  const navigate = useNavigate();
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

  const getIdentifier = (item: InventoryItem) => `${item.item}-${item.lotNumber}`;

  const handleItemClick = (item: InventoryItem) => {
    navigate(`/inventory/${getIdentifier(item)}`);
  };

  const filteredInventory = inventory.filter(item => 
    ['Received', 'Stored'].includes(item.status) && (
      (getIdentifier(item) || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (item.type || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (item.description || '').toLowerCase().includes(searchTerm.toLowerCase())
    )
  );

  return (
    <div style={{ padding: '20px', backgroundColor: '#2E4655', color: '#FFFFFF', fontFamily: 'Arial, sans-serif' }}>
      <h2 style={{ color: '#EEC930', textAlign: 'center' }}>Inventory Management</h2>
      <div style={{ marginBottom: '20px' }}>
        <Link to="/receive"><button style={{ padding: '10px 20px', backgroundColor: '#EEC930', color: '#000', border: 'none', borderRadius: '4px' }}>Receive Inventory</button></Link>
        <button onClick={() => setShowMoveModal(true)} style={{ marginLeft: '10px', padding: '10px 20px', backgroundColor: '#EEC930', color: '#000', border: 'none', borderRadius: '4px' }}>Move Inventory</button>
        <button onClick={() => setShowLossModal(true)} style={{ marginLeft: '10px', padding: '10px 20px', backgroundColor: '#EEC930', color: '#000', border: 'none', borderRadius: '4px' }}>Record Loss</button>
      </div>

      <div style={{ marginBottom: '20px' }}>
        <input
          type="text"
          placeholder="Search by Item-Lot, Type, or Description"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{ padding: '10px', width: '300px', fontSize: '16px', borderRadius: '4px', border: '1px solid #ccc' }}
        />
      </div>

      {showMoveModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
          <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '5px', color: '#000' }}>
            <h3>Move Inventory</h3>
            <input type="text" placeholder="Item-Lot (e.g., Grain-NGS123)" value={moveForm.identifier} onChange={(e) => setMoveForm({ ...moveForm, identifier: e.target.value })} style={{ display: 'block', marginBottom: '10px', padding: '5px', width: '100%' }} />
            <select value={moveForm.toAccount} onChange={(e) => setMoveForm({ ...moveForm, toAccount: e.target.value })} style={{ display: 'block', marginBottom: '10px', padding: '5px', width: '100%' }}>
              <option value="Production">Production</option>
              <option value="Storage">Storage</option>
              <option value="Processing">Processing</option>
            </select>
            <input type="number" placeholder="Proof Gallons" value={moveForm.proofGallons} onChange={(e) => setMoveForm({ ...moveForm, proofGallons: e.target.value })} step="0.01" style={{ display: 'block', marginBottom: '10px', padding: '5px', width: '100%' }} />
            <button onClick={handleMove} style={{ padding: '10px 20px', backgroundColor: '#F86752', color: '#FFF', border: 'none', borderRadius: '4px' }}>Submit</button>
            <button onClick={() => setShowMoveModal(false)} style={{ marginLeft: '10px', padding: '10px 20px', backgroundColor: '#000', color: '#EEC930', border: 'none', borderRadius: '4px' }}>Cancel</button>
            {productionError && <p style={{ color: 'red', marginTop: '10px' }}>{productionError}</p>}
          </div>
        </div>
      )}

      {showLossModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
          <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '5px', color: '#000' }}>
            <h3>Record Loss</h3>
            <input type="text" placeholder="Item-Lot (e.g., Grain-NGS123)" value={lossForm.identifier} onChange={(e) => setLossForm({ ...lossForm, identifier: e.target.value })} style={{ display: 'block', marginBottom: '10px', padding: '5px', width: '100%' }} />
            <input type="number" placeholder="Quantity Lost" value={lossForm.quantityLost} onChange={(e) => setLossForm({ ...lossForm, quantityLost: e.target.value })} step="0.01" style={{ display: 'block', marginBottom: '10px', padding: '5px', width: '100%' }} />
            <input type="number" placeholder="Proof Gallons Lost" value={lossForm.proofGallonsLost} onChange={(e) => setLossForm({ ...lossForm, proofGallonsLost: e.target.value })} step="0.01" style={{ display: 'block', marginBottom: '10px', padding: '5px', width: '100%' }} />
            <input type="text" placeholder="Reason" value={lossForm.reason} onChange={(e) => setLossForm({ ...lossForm, reason: e.target.value })} style={{ display: 'block', marginBottom: '10px', padding: '5px', width: '100%' }} />
            <input type="date" value={lossForm.date} onChange={(e) => setLossForm({ ...lossForm, date: e.target.value })} style={{ display: 'block', marginBottom: '10px', padding: '5px', width: '100%' }} />
            <button onClick={handleRecordLoss} style={{ padding: '10px 20px', backgroundColor: '#F86752', color: '#FFF', border: 'none', borderRadius: '4px' }}>Submit</button>
            <button onClick={() => setShowLossModal(false)} style={{ marginLeft: '10px', padding: '10px 20px', backgroundColor: '#000', color: '#EEC930', border: 'none', borderRadius: '4px' }}>Cancel</button>
            {productionError && <p style={{ color: 'red', marginTop: '10px' }}>{productionError}</p>}
          </div>
        </div>
      )}

      <h2 style={{ color: '#EEC930', marginTop: '20px' }}>Daily Summary (Proof Gallons)</h2>
      <table style={{ width: '100%', borderCollapse: 'collapse', backgroundColor: '#FFF', color: '#000', marginBottom: '20px', borderRadius: '8px' }}>
        <thead>
          <tr style={{ backgroundColor: '#EEC930' }}>
            <th style={{ padding: '10px' }}>Account</th>
            <th style={{ padding: '10px' }}>Total Proof Gallons</th>
          </tr>
        </thead>
        <tbody>
          {dailySummary.length > 0 ? dailySummary.map((item) => (
            <tr key={item.account} style={{ borderBottom: '1px solid #ddd' }}>
              <td style={{ padding: '10px' }}>{item.account}</td>
              <td style={{ padding: '10px' }}>{item.totalProofGallons || '0.00'}</td>
            </tr>
          )) : <tr><td colSpan={2} style={{ padding: '10px', textAlign: 'center' }}>Loading summary...</td></tr>}
        </tbody>
      </table>

      <h2 style={{ color: '#EEC930' }}>Received/Stored Inventory</h2>
      <table style={{ width: '100%', borderCollapse: 'collapse', backgroundColor: '#FFF', color: '#000', borderRadius: '8px' }}>
        <thead>
          <tr style={{ backgroundColor: '#EEC930' }}>
            <th style={{ padding: '10px' }}>Item-Lot</th>
            <th style={{ padding: '10px' }}>Type</th>
            <th style={{ padding: '10px' }}>Description</th>
            <th style={{ padding: '10px' }}>Quantity</th>
            <th style={{ padding: '10px' }}>Unit</th>
            <th style={{ padding: '10px' }}>Proof</th>
            <th style={{ padding: '10px' }}>Total Cost</th>
            <th style={{ padding: '10px' }}>Date Received</th>
            <th style={{ padding: '10px' }}>Source</th>
            <th style={{ padding: '10px' }}>Location</th>
            <th style={{ padding: '10px' }}>Status</th>
          </tr>
        </thead>
        <tbody>
          {filteredInventory.map((item) => (
            <tr
              key={getIdentifier(item)}
              onClick={() => handleItemClick(item)}
              style={{ cursor: 'pointer', borderBottom: '1px solid #ddd' }}
            >
              <td style={{ padding: '10px' }}>{getIdentifier(item) || 'N/A'}</td>
              <td style={{ padding: '10px' }}>{item.type}</td>
              <td style={{ padding: '10px' }}>{item.description || 'N/A'}</td>
              <td style={{ padding: '10px' }}>{item.quantity || '0.00'}</td>
              <td style={{ padding: '10px' }}>{item.unit || 'N/A'}</td>
              <td style={{ padding: '10px' }}>{item.proof || 'N/A'}</td>
              <td style={{ padding: '10px' }}>{item.totalCost ? `$${parseFloat(item.totalCost).toFixed(2)}` : 'N/A'}</td>
              <td style={{ padding: '10px' }}>{item.receivedDate || 'N/A'}</td>
              <td style={{ padding: '10px' }}>{item.source || 'N/A'}</td>
              <td style={{ padding: '10px' }}>{item.account || 'Storage'}</td>
              <td style={{ padding: '10px' }}>{item.status}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2 style={{ color: '#EEC930', marginTop: '20px' }}>Finished Packaged Inventory</h2>
      <table style={{ width: '100%', borderCollapse: 'collapse', backgroundColor: '#FFF', color: '#000', borderRadius: '8px' }}>
        <thead>
          <tr style={{ backgroundColor: '#EEC930' }}>
            <th style={{ padding: '10px' }}>Item-Lot</th>
            <th style={{ padding: '10px' }}>Type</th>
            <th style={{ padding: '10px' }}>Quantity (WG)</th>
            <th style={{ padding: '10px' }}>Proof</th>
            <th style={{ padding: '10px' }}>Proof Gallons</th>
            <th style={{ padding: '10px' }}>Date Packaged</th>
            <th style={{ padding: '10px' }}>Source</th>
            <th style={{ padding: '10px' }}>Location</th>
          </tr>
        </thead>
        <tbody>
          {inventory.filter((item) => item.account === 'Processing' && item.status === 'Packaged').map((item) => (
            <tr
              key={getIdentifier(item)}
              onClick={() => handleItemClick(item)}
              style={{ cursor: 'pointer', borderBottom: '1px solid #ddd' }}
            >
              <td style={{ padding: '10px' }}>{getIdentifier(item) || 'N/A'}</td>
              <td style={{ padding: '10px' }}>{item.type}</td>
              <td style={{ padding: '10px' }}>{item.quantity || '0.00'}</td>
              <td style={{ padding: '10px' }}>{item.proof || '0.00'}</td>
              <td style={{ padding: '10px' }}>{item.proofGallons || '0.00'}</td>
              <td style={{ padding: '10px' }}>{item.receivedDate || 'N/A'}</td>
              <td style={{ padding: '10px' }}>{item.source || 'N/A'}</td>
              <td style={{ padding: '10px' }}>{item.account || 'Storage'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default Inventory;