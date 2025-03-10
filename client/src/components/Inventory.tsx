import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { InventoryItem, MoveForm, LossForm, DailySummaryItem } from '../types/interfaces';

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
  const [showMoveModal, setShowMoveModal] = useState(false);
  const [showLossModal, setShowLossModal] = useState(false);
  const [productionError, setProductionError] = useState<string | null>(null);

  const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || '';

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
      await refreshInventory(); // Use parent's refresh function
      setMoveForm({ identifier: '', toAccount: 'Storage', proofGallons: '' });
      setShowMoveModal(false);
      setProductionError(null);
    } catch (err: any) {
      console.error('Move error:', err);
      setProductionError('Failed to move item: ' + err.message);
    }
  };

  const handleRecordLoss = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/record-loss`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(lossForm),
      });
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
      await refreshInventory(); // Use parent's refresh function
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

  return (
    <div>
      <h2>Inventory Management</h2>
      <div style={{ marginBottom: '20px' }}>
        <Link to="/receive"><button>Receive Inventory</button></Link>
        <button onClick={() => setShowMoveModal(true)} style={{ marginLeft: '10px' }}>Move Inventory</button>
        <button onClick={() => setShowLossModal(true)} style={{ marginLeft: '10px' }}>Record Loss</button>
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
            <th>Identifier</th><th>Type</th><th>Description</th><th>Quantity</th><th>Unit</th><th>Proof</th><th>Proof Gallons</th><th>Date Received</th><th>Source</th><th>DSP Number</th><th>Status</th>
          </tr>
        </thead>
        <tbody>
          {inventory.filter((item) => ['Received', 'Stored'].includes(item.status)).map((item) => (
            <tr key={item.identifier || `${item.type}-${item.receivedDate}`}>
              <td>{item.identifier || 'N/A'}</td>
              <td>{item.type}</td>
              <td>{item.description || 'N/A'}</td>
              <td>{item.quantity || '0.00'}</td>
              <td>{item.unit || 'N/A'}</td>
              <td>{item.proof || 'N/A'}</td>
              <td>{item.proofGallons || '0.00'}</td>
              <td>{item.receivedDate || 'N/A'}</td>
              <td>{item.source || 'N/A'}</td>
              <td>{item.dspNumber || 'N/A'}</td>
              <td>{item.status}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <h2>Finished Packaged Inventory</h2>
      <table>
        <thead>
          <tr>
            <th>Identifier</th><th>Type</th><th>Quantity (WG)</th><th>Proof</th><th>Proof Gallons</th><th>Date Packaged</th><th>Source</th><th>DSP Number</th>
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
              <td>{item.dspNumber || 'N/A'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default Inventory;