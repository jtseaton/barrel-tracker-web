import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { InventoryItem, MoveForm, LossForm, Location, Vendor, DailySummaryItem, Site } from '../types/interfaces';
import { fetchDailySummary } from '../utils/fetchUtils';

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
  const [sites, setSites] = useState<Site[]>([]); // New state for sites
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

  // Fetch inventory on mount
  useEffect(() => {
    refreshInventory();
  }, [refreshInventory]);

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

  useEffect(() => {
    const fetchLocations = async () => {
      try {
        // Get unique siteIds using reduce
        const siteIds = inventory
          .map(item => item.siteId)
          .filter(Boolean)
          .reduce((unique, siteId) => 
            unique.includes(siteId) ? unique : [...unique, siteId], 
            [] as string[]
          );
        if (siteIds.length === 0) {
          // Fallback to OUR_DSP if no siteIds
          siteIds.push(OUR_DSP);
        }
        const locationPromises = siteIds.map(siteId =>
          fetch(`${API_BASE_URL}/api/locations?siteId=${encodeURIComponent(siteId)}`).then(res => {
            if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
            return res.json();
          })
        );
        const locationArrays = await Promise.all(locationPromises);
        const allLocations = locationArrays.flat();
        console.log('Fetched locations:', allLocations);
        setLocations(allLocations);
      } catch (err: any) {
        console.error('Failed to fetch locations:', err);
        setProductionError('Failed to fetch locations: ' + err.message);
      }
    };
    if (inventory.length > 0) {
      fetchLocations();
    }
  }, [API_BASE_URL, inventory]);
  
  // Fetch sites
  useEffect(() => {
    const fetchSites = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/sites`);
        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
        const data: Site[] = await res.json();
        console.log('Fetched sites:', data);
        setSites(data);
      } catch (err: any) {
        console.error('Failed to fetch sites:', err);
        setProductionError('Failed to fetch sites: ' + err.message);
      }
    };
    fetchSites();
  }, [API_BASE_URL]);

  // Helper function to map locationId to location name
  const getLocationName = (locationId: number | undefined) => {
    if (!locationId) return 'Unknown Location';
    const location = locations.find(loc => loc.locationId === locationId);
    return location ? location.name : 'Unknown Location';
  };

  // Helper function to map siteId to site name
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

  const getIdentifier = (item: InventoryItem) => item.identifier || 'N/A';

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
        <Link to="/receive">
          <button style={{ padding: '10px 20px', backgroundColor: '#EEC930', color: '#000', border: 'none', borderRadius: '4px' }}>
            Receive Inventory
          </button>
        </Link>
        <button onClick={() => setShowMoveModal(true)} style={{ marginLeft: '10px', padding: '10px 20px', backgroundColor: '#EEC930', color: '#000', border: 'none', borderRadius: '4px' }}>
          Move Inventory
        </button>
        <button onClick={() => setShowLossModal(true)} style={{ marginLeft: '10px', padding: '10px 20px', backgroundColor: '#EEC930', color: '#000', border: 'none', borderRadius: '4px' }}>
          Record Loss
        </button>
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

      {productionError && (
        <div style={{ color: '#F86752', backgroundColor: '#ffe6e6', padding: '10px', borderRadius: '4px', marginBottom: '10px', textAlign: 'center' }}>
          {productionError}
        </div>
      )}

      <h3 style={{ color: '#EEC930' }}>Received/Stored Inventory</h3>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', backgroundColor: '#fff', borderRadius: '8px', marginBottom: '20px' }}>
          <thead>
            <tr>
              <th style={{ padding: '10px', backgroundColor: '#f5f5f5', borderBottom: '1px solid #ddd', color: '#555' }}>Item-Lot</th>
              <th style={{ padding: '10px', backgroundColor: '#f5f5f5', borderBottom: '1px solid #ddd', color: '#555' }}>Type</th>
              <th style={{ padding: '10px', backgroundColor: '#f5f5f5', borderBottom: '1px solid #ddd', color: '#555' }}>Quantity</th>
              <th style={{ padding: '10px', backgroundColor: '#f5f5f5', borderBottom: '1px solid #ddd', color: '#555' }}>Unit</th>
              <th style={{ padding: '10px', backgroundColor: '#f5f5f5', borderBottom: '1px solid #ddd', color: '#555' }}>Received Date</th>
              <th style={{ padding: '10px', backgroundColor: '#f5f5f5', borderBottom: '1px solid #ddd', color: '#555' }}>Location</th>
              <th style={{ padding: '10px', backgroundColor: '#f5f5f5', borderBottom: '1px solid #ddd', color: '#555' }}>Site</th>
              <th style={{ padding: '10px', backgroundColor: '#f5f5f5', borderBottom: '1px solid #ddd', color: '#555' }}>Source</th>
              <th style={{ padding: '10px', backgroundColor: '#f5f5f5', borderBottom: '1px solid #ddd', color: '#555' }}>Description</th>
              <th style={{ padding: '10px', backgroundColor: '#f5f5f5', borderBottom: '1px solid #ddd', color: '#555' }}>Unit Cost</th>
            </tr>
          </thead>
          <tbody>
            {filteredInventory.map((item, index) => (
              <tr key={index} onClick={() => handleItemClick(item)} style={{ cursor: 'pointer' }}>
                <td style={{ padding: '10px' }}>{getIdentifier(item)}</td>
                <td style={{ padding: '10px' }}>{item.type}</td>
                <td style={{ padding: '10px' }}>{item.quantity}</td>
                <td style={{ padding: '10px' }}>{item.unit}</td>
                <td style={{ padding: '10px' }}>{item.receivedDate}</td>
                <td style={{ padding: '10px' }}>{getLocationName(item.locationId)}</td>
                <td style={{ padding: '10px' }}>{getSiteName(item.siteId)}</td>
                <td style={{ padding: '10px' }}>{item.source || 'Unknown'}</td>
                <td style={{ padding: '10px' }}>{item.description || 'N/A'}</td>
                <td style={{ padding: '10px' }}>{item.cost || 'N/A'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h3 style={{ color: '#EEC930' }}>Daily Summary</h3>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', backgroundColor: '#fff', borderRadius: '8px' }}>
          <thead>
            <tr>
              <th style={{ padding: '10px', backgroundColor: '#f5f5f5', borderBottom: '1px solid #ddd', color: '#555' }}>Date</th>
              <th style={{ padding: '10px', backgroundColor: '#f5f5f5', borderBottom: '1px solid #ddd', color: '#555' }}>Account</th>
              <th style={{ padding: '10px', backgroundColor: '#f5f5f5', borderBottom: '1px solid #ddd', color: '#555' }}>Type</th>
              <th style={{ padding: '10px', backgroundColor: '#f5f5f5', borderBottom: '1px solid #ddd', color: '#555' }}>Total Proof Gallons</th>
              <th style={{ padding: '10px', backgroundColor: '#f5f5f5', borderBottom: '1px solid #ddd', color: '#555' }}>Location</th>
            </tr>
          </thead>
          <tbody>
            {dailySummary.map((item, index) => (
              <tr key={index}>
                <td style={{ padding: '10px' }}>{item.date}</td>
                <td style={{ padding: '10px' }}>{item.account}</td>
                <td style={{ padding: '10px' }}>{item.type}</td>
                <td style={{ padding: '10px' }}>{parseFloat(item.totalProofGallons).toFixed(2)}</td>
                <td style={{ padding: '10px' }}>{getLocationName(item.locationId)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showMoveModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
          <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '5px', color: '#000' }}>
            <h3>Move Inventory</h3>
            <input
              type="text"
              placeholder="Item-Lot (e.g., Grain-NGS123)"
              value={moveForm.identifier}
              onChange={(e) => setMoveForm({ ...moveForm, identifier: e.target.value })}
              style={{ display: 'block', marginBottom: '10px', padding: '8px', boxSizing: 'border-box', width: '100%' }}
            />
            <select
              value={moveForm.toAccount}
              onChange={(e) => setMoveForm({ ...moveForm, toAccount: e.target.value })}
              style={{ display: 'block', marginBottom: '10px', padding: '8px', width: '100%' }}
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
              style={{ display: 'block', marginBottom: '10px', padding: '8px', boxSizing: 'border-box', width: '100%' }}
            />
            <button
              onClick={handleMove}
              style={{ padding: '10px 20px', backgroundColor: '#EEC930', color: '#000', border: 'none', borderRadius: '4px', marginRight: '10px' }}
            >
              Move
            </button>
            <button
              onClick={() => setShowMoveModal(false)}
              style={{ padding: '10px 20px', backgroundColor: '#ccc', color: '#000', border: 'none', borderRadius: '4px' }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {showLossModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
          <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '5px', color: '#000' }}>
            <h3>Record Loss</h3>
            <input
              type="text"
              placeholder="Item-Lot (e.g., Grain-NGS123)"
              value={lossForm.identifier}
              onChange={(e) => setLossForm({ ...lossForm, identifier: e.target.value })}
              style={{ display: 'block', marginBottom: '10px', padding: '8px', boxSizing: 'border-box', width: '100%' }}
            />
            <input
              type="number"
              placeholder="Quantity Lost"
              value={lossForm.quantityLost}
              onChange={(e) => setLossForm({ ...lossForm, quantityLost: e.target.value })}
              style={{ display: 'block', marginBottom: '10px', padding: '8px', boxSizing: 'border-box', width: '100%' }}
            />
            <input
              type="number"
              placeholder="Proof Gallons Lost"
              value={lossForm.proofGallonsLost}
              onChange={(e) => setLossForm({ ...lossForm, proofGallonsLost: e.target.value })}
              style={{ display: 'block', marginBottom: '10px', padding: '8px', boxSizing: 'border-box', width: '100%' }}
            />
            <input
              type="text"
              placeholder="Reason for Loss"
              value={lossForm.reason}
              onChange={(e) => setLossForm({ ...lossForm, reason: e.target.value })}
              style={{ display: 'block', marginBottom: '10px', padding: '8px', boxSizing: 'border-box', width: '100%' }}
            />
            <input
              type="date"
              value={lossForm.date}
              onChange={(e) => setLossForm({ ...lossForm, date: e.target.value })}
              style={{ display: 'block', marginBottom: '10px', padding: '8px', boxSizing: 'border-box', width: '100%' }}
            />
            <button
              onClick={handleRecordLoss}
              style={{ padding: '10px 20px', backgroundColor: '#EEC930', color: '#000', border: 'none', borderRadius: '4px', marginRight: '10px' }}
            >
              Record Loss
            </button>
            <button
              onClick={() => setShowLossModal(false)}
              style={{ padding: '10px 20px', backgroundColor: '#ccc', color: '#000', border: 'none', borderRadius: '4px' }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Inventory;