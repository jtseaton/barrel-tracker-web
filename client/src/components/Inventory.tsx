// src/components/Inventory.tsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { InventoryItem, MoveForm, LossForm, Location, Vendor, DailySummaryItem, Site } from '../types/interfaces';
import { fetchDailySummary } from '../utils/fetchUtils';
import 'bootstrap/dist/css/bootstrap.min.css';
import '../App.css';

const OUR_DSP = 'DSP-AL-20010';

interface InventoryProps {
  vendors: Vendor[];
  refreshVendors: () => Promise<void>;
  inventory: InventoryItem[];
  refreshInventory: () => Promise<void>;
}

const Inventory: React.FC<InventoryProps> = ({ inventory, refreshInventory }) => {
  const [dailySummary, setDailySummary] = useState<DailySummaryItem[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
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
  const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:3001';

  // Log inventory for debugging
  useEffect(() => {
    console.log('Inventory prop received:', inventory);
    const receivedStored = inventory.filter((item) => ['Received', 'Stored'].includes(item.status));
    console.log('Filtered Received/Stored:', receivedStored);
  }, [inventory]);

  // Fetch daily summary
  useEffect(() => {
    fetchDailySummary()
      .then(setDailySummary)
      .catch((err) => console.error('Daily summary error:', err));
  }, []);

  // Fetch locations and sites
  useEffect(() => {
    const fetchLocationsAndSites = async () => {
      try {
        const sitesRes = await fetch(`${API_BASE_URL}/api/sites`, { headers: { Accept: 'application/json' } });
        if (!sitesRes.ok) throw new Error(`HTTP error! status: ${sitesRes.status}`);
        const sitesData: Site[] = await sitesRes.json();
        setSites(sitesData);

        // Deduplicate siteIds without Set
        const siteIds = inventory
          .map(item => item.siteId)
          .filter((siteId): siteId is string => !!siteId)
          .concat([OUR_DSP])
          .filter((siteId, index, arr) => arr.indexOf(siteId) === index);

        const locationPromises = siteIds.map(siteId =>
          fetch(`${API_BASE_URL}/api/locations?siteId=${encodeURIComponent(siteId)}`, {
            headers: { Accept: 'application/json' }
          }).then(res => {
            if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
            return res.json();
          })
        );
        const locationArrays = await Promise.all(locationPromises);
        setLocations(locationArrays.flat());
      } catch (err: any) {
        setProductionError('Failed to fetch locations or sites: ' + err.message);
      }
    };

    if (inventory.length > 0) {
      fetchLocationsAndSites();
    }
  }, [API_BASE_URL, inventory]);

  const getLocationName = (locationId: number | undefined) => {
    if (!locationId) return 'Unknown Location';
    const location = locations.find(loc => loc.locationId === locationId);
    return location ? location.name : 'Unknown Location';
  };

  const getSiteName = (siteId: string | undefined) => {
    if (!siteId) return 'Unknown Site';
    const site = sites.find(site => site.siteId === siteId);
    return site ? site.name : 'Unknown Site';
  };

  const handleMove = async () => {
    if (!moveForm.identifier || !moveForm.proofGallons) {
      setProductionError('Please fill in Identifier and Proof Gallons.');
      return;
    }
    try {
      const res = await fetch(`${API_BASE_URL}/api/move`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ ...moveForm, proofGallons: parseFloat(moveForm.proofGallons) }),
      });
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
      await refreshInventory();
      setMoveForm({ identifier: '', toAccount: 'Storage', proofGallons: '' });
      setShowMoveModal(false);
      setProductionError(null);
    } catch (err: any) {
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
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
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
      setProductionError('Failed to record loss: ' + err.message);
    }
  };

  const getIdentifier = (item: InventoryItem) => item.identifier || 'N/A';

  const handleItemClick = (item: InventoryItem) => {
    const encodedIdentifier = encodeURIComponent(getIdentifier(item).replace(/\//g, '_'));
    navigate(`/inventory/${encodedIdentifier}`);
  };

  const filteredInventory = inventory.filter(item => 
    ['Received', 'Stored'].includes(item.status) && (
      (getIdentifier(item) || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (item.type || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (item.description || '').toLowerCase().includes(searchTerm.toLowerCase())
    )
  );

  return (
    <div className="page-container container">
      <h2 className="text-warning mb-4">Inventory Management</h2>
      {productionError && (
        <div className="alert alert-danger mb-3">{productionError}</div>
      )}
      <div className="inventory-actions mb-4">
        <button className="btn btn-primary" onClick={() => navigate('/receive')}>
          Receive Inventory
        </button>
        <button className="btn btn-primary" onClick={() => setShowMoveModal(true)}>
          Move Item
        </button>
        <button className="btn btn-primary" onClick={() => setShowLossModal(true)}>
          Record Loss
        </button>
      </div>

      <div className="mb-3">
        <input
          type="text"
          placeholder="Search by Item-Lot, Type, or Description"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="form-control"
          style={{ maxWidth: '300px' }}
        />
      </div>

      <h3 className="text-warning mb-3">Received/Stored Inventory</h3>
      <div className="inventory-table-container">
        <table className="inventory-table table-striped">
          <thead>
            <tr>
              <th>Item-Lot</th>
              <th>Type</th>
              <th>Quantity</th>
              <th>Unit</th>
              <th>Received Date</th>
              <th>Location</th>
              <th>Site</th>
              <th>Source</th>
              <th>Description</th>
              <th>Unit Cost</th>
            </tr>
          </thead>
          <tbody>
            {filteredInventory.map((item, index) => (
              <tr key={index} onClick={() => handleItemClick(item)} style={{ cursor: 'pointer' }}>
                <td>{getIdentifier(item)}</td>
                <td>{item.type}</td>
                <td>{item.quantity}</td>
                <td>{item.unit}</td>
                <td>{item.receivedDate}</td>
                <td>{getLocationName(item.locationId)}</td>
                <td>{getSiteName(item.siteId)}</td>
                <td>{item.source || 'Unknown'}</td>
                <td>{item.description || 'N/A'}</td>
                <td>{item.cost || 'N/A'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="card-list">
          {filteredInventory.map((item, index) => (
            <div key={index} className="card-item card mb-2" onClick={() => handleItemClick(item)} style={{ cursor: 'pointer' }}>
              <div className="card-body">
                <p className="card-text"><strong>Item-Lot:</strong> {getIdentifier(item)}</p>
                <p className="card-text"><strong>Type:</strong> {item.type}</p>
                <p className="card-text"><strong>Quantity:</strong> {item.quantity}</p>
                <p className="card-text"><strong>Unit:</strong> {item.unit}</p>
                <p className="card-text"><strong>Received Date:</strong> {item.receivedDate}</p>
                <p className="card-text"><strong>Location:</strong> {getLocationName(item.locationId)}</p>
                <p className="card-text"><strong>Site:</strong> {getSiteName(item.siteId)}</p>
                <p className="card-text"><strong>Source:</strong> {item.source || 'Unknown'}</p>
                <p className="card-text"><strong>Description:</strong> {item.description || 'N/A'}</p>
                <p className="card-text"><strong>Unit Cost:</strong> {item.cost || 'N/A'}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <h3 className="text-warning mb-3">Daily Summary</h3>
      <div className="inventory-table-container">
        <table className="inventory-table table-striped">
          <thead>
            <tr>
              <th>Date</th>
              <th>Account</th>
              <th>Type</th>
              <th>Total Proof Gallons</th>
              <th>Location</th>
            </tr>
          </thead>
          <tbody>
            {dailySummary.map((item, index) => (
              <tr key={index}>
                <td>{item.date}</td>
                <td>{item.account}</td>
                <td>{item.type}</td>
                <td>{parseFloat(item.totalProofGallons).toFixed(2)}</td>
                <td>{getLocationName(item.locationId)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="card-list">
          {dailySummary.map((item, index) => (
            <div key={index} className="card-item card mb-2">
              <div className="card-body">
                <p className="card-text"><strong>Date:</strong> {item.date}</p>
                <p className="card-text"><strong>Account:</strong> {item.account}</p>
                <p className="card-text"><strong>Type:</strong> {item.type}</p>
                <p className="card-text"><strong>Total Proof Gallons:</strong> {parseFloat(item.totalProofGallons).toFixed(2)}</p>
                <p className="card-text"><strong>Location:</strong> {getLocationName(item.locationId)}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {showMoveModal && (
        <div className="modal fade show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-content" style={{ maxWidth: '400px', margin: '0 auto' }}>
            <div className="modal-header">
              <h5 className="modal-title">Move Inventory</h5>
            </div>
            <div className="modal-body">
              <input
                type="text"
                placeholder="Item-Lot (e.g., Grain-NGS123)"
                value={moveForm.identifier}
                onChange={(e) => setMoveForm({ ...moveForm, identifier: e.target.value })}
                className="form-control mb-3"
              />
              <select
                value={moveForm.toAccount}
                onChange={(e) => setMoveForm({ ...moveForm, toAccount: e.target.value })}
                className="form-control mb-3"
              >
                <option value="Storage">Storage</option>
                <option value="Processing">Processing</option>
                <option value="Production">Production</option>
              </select>
              <input
                type="number"
                placeholder="Proof Gallons"
                value={moveForm.proofGallons}
                onChange={(e) => setMoveForm({ ...moveForm, proofGallons: e.target.value })}
                className="form-control mb-3"
              />
            </div>
            <div className="modal-footer">
              <button className="btn btn-primary" onClick={handleMove}>
                Move
              </button>
              <button className="btn btn-secondary" onClick={() => setShowMoveModal(false)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {showLossModal && (
        <div className="modal fade show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-content" style={{ maxWidth: '400px', margin: '0 auto' }}>
            <div className="modal-header">
              <h5 className="modal-title">Record Loss</h5>
            </div>
            <div className="modal-body">
              <input
                type="text"
                placeholder="Item-Lot (e.g., Grain-NGS123)"
                value={lossForm.identifier}
                onChange={(e) => setLossForm({ ...lossForm, identifier: e.target.value })}
                className="form-control mb-3"
              />
              <input
                type="number"
                placeholder="Quantity Lost"
                value={lossForm.quantityLost}
                onChange={(e) => setLossForm({ ...lossForm, quantityLost: e.target.value })}
                className="form-control mb-3"
              />
              <input
                type="number"
                placeholder="Proof Gallons Lost"
                value={lossForm.proofGallonsLost}
                onChange={(e) => setLossForm({ ...lossForm, proofGallonsLost: e.target.value })}
                className="form-control mb-3"
              />
              <input
                type="text"
                placeholder="Reason for Loss"
                value={lossForm.reason}
                onChange={(e) => setLossForm({ ...lossForm, reason: e.target.value })}
                className="form-control mb-3"
              />
              <input
                type="date"
                value={lossForm.date}
                onChange={(e) => setLossForm({ ...lossForm, date: e.target.value })}
                className="form-control mb-3"
              />
            </div>
            <div className="modal-footer">
              <button className="btn btn-primary" onClick={handleRecordLoss}>
                Record Loss
              </button>
              <button className="btn btn-secondary" onClick={() => setShowLossModal(false)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Inventory;