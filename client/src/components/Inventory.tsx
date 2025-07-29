import React, { useState, useEffect, useCallback } from 'react';
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

const Inventory: React.FC<InventoryProps> = ({ inventory, refreshInventory, vendors, refreshVendors }) => {
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
  const [searchTerm, setSearchTerm] = useState('');
  const [showMoveModal, setShowMoveModal] = useState(false);
  const [showLossModal, setShowLossModal] = useState(false);
  const [productionError, setProductionError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const navigate = useNavigate();
  const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:10000';

  // Stable fetch functions
  const fetchSites = useCallback(async (signal: AbortSignal) => {
    const token = localStorage.getItem('token');
    if (!token) {
      console.error('[Inventory] No token found, redirecting to login');
      navigate('/login');
      return [];
    }
    const res = await fetch(`${API_BASE_URL}/api/sites`, {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      signal,
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Sites fetch failed: HTTP ${res.status}, Response: ${text.slice(0, 50)}`);
    }
    return await res.json();
  }, [navigate, API_BASE_URL]);

  const fetchLocations = useCallback(async (siteId: string, signal: AbortSignal) => {
    if (!siteId) return [];
    const token = localStorage.getItem('token');
    if (!token) {
      console.error('[Inventory] No token found, redirecting to login');
      navigate('/login');
      return [];
    }
    const res = await fetch(`${API_BASE_URL}/api/locations?siteId=${encodeURIComponent(siteId)}`, {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      signal,
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Locations fetch failed for siteId ${siteId}: HTTP ${res.status}, Response: ${text.slice(0, 50)}`);
    }
    return await res.json();
  }, [navigate, API_BASE_URL]);

  // Fetch inventory on mount
  useEffect(() => {
    const abortController = new AbortController();
    const fetchData = async () => {
      setIsLoading(true);
      try {
        await refreshInventory();
        console.log('[Inventory] refreshInventory called');
      } catch (err) {
        console.error('[Inventory] refreshInventory error:', err);
        setProductionError(err instanceof Error ? `Failed to refresh inventory: ${err.message}` : 'Failed to refresh inventory: Unknown error');
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
    return () => abortController.abort();
  }, [refreshInventory]);

  // Fetch daily summary on mount
  useEffect(() => {
    const abortController = new AbortController();
    console.log('[Inventory] Fetching daily summary');
    fetchDailySummary()
      .then(data => {
        console.log('[Inventory] Daily summary:', {
          data,
          isArray: Array.isArray(data),
          length: Array.isArray(data) ? data.length : 'N/A',
        });
        setDailySummary(data || []);
      })
      .catch(err => {
        console.error('[Inventory] Daily summary error:', err);
        setProductionError(err instanceof Error ? `Failed to load daily summary: ${err.message}` : 'Failed to load daily summary: Unknown error');
        setDailySummary([]);
      })
      .finally(() => setIsLoading(false));
    return () => abortController.abort();
  }, []);

  // Fetch sites and locations on mount
  useEffect(() => {
    const abortController = new AbortController();
    const fetchLocationsAndSites = async () => {
      setIsLoading(true);
      try {
        const sitesData: Site[] = await fetchSites(abortController.signal);
        console.log('[Inventory] Fetched sites:', sitesData);
        setSites(sitesData || []);

        const siteIds = Array.from(new Set([
          ...inventory.map(item => item?.siteId).filter((siteId): siteId is string => !!siteId),
          OUR_DSP,
        ]));
        console.log('[Inventory] Site IDs:', siteIds);

        const locationPromises = siteIds.map(siteId =>
          fetchLocations(siteId, abortController.signal).catch(err => {
            console.error('[Inventory] Locations fetch error for siteId:', siteId, err);
            return [];
          })
        );
        const locationArrays = await Promise.all(locationPromises);
        const allLocations = locationArrays.flat();
        console.log('[Inventory] Fetched locations:', allLocations);
        setLocations(allLocations || []);
      } catch (err: unknown) {
        if (err instanceof Error && err.name === 'AbortError') return;
        console.error('[Inventory] Fetch locations/sites error:', err);
        setProductionError(err instanceof Error ? `Failed to fetch locations or sites: ${err.message}` : 'Failed to fetch locations or sites: Unknown error');
        setSites([]);
        setLocations([]);
      } finally {
        setIsLoading(false);
      }
    };
    fetchLocationsAndSites();
    return () => abortController.abort();
  }, [fetchSites, fetchLocations]);

  const getLocationName = (locationId: number | undefined) => {
    if (!locationId) return 'Unknown Location';
    const location = locations.find(loc => loc?.locationId === locationId);
    return location?.name || 'Unknown Location';
  };

  const getSiteName = (siteId: string | undefined) => {
    if (!siteId) return 'Unknown Site';
    const site = sites.find(site => site?.siteId === siteId);
    return site?.name || 'Unknown Site';
  };

  const handleMove = async () => {
    if (!moveForm.identifier || !moveForm.toAccount || !moveForm.proofGallons) {
      setProductionError('Please fill in Identifier, To Account, and Proof Gallons.');
      return;
    }
    const parsedProofGallons = parseFloat(moveForm.proofGallons);
    if (isNaN(parsedProofGallons) || parsedProofGallons <= 0) {
      setProductionError('Proof Gallons must be a positive number.');
      return;
    }
    try {
      console.log('[Inventory] Moving item:', moveForm);
      const token = localStorage.getItem('token');
      if (!token) {
        console.error('[Inventory] No token found, redirecting to login');
        navigate('/login');
        throw new Error('No token found in localStorage');
      }
      const res = await fetch(`${API_BASE_URL}/api/inventory/move`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ ...moveForm, proofGallons: parsedProofGallons }),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Move failed: HTTP ${res.status}, Response: ${text.slice(0, 50)}`);
      }
      await refreshInventory();
      setMoveForm({ identifier: '', toAccount: 'Storage', proofGallons: '' });
      setShowMoveModal(false);
      setProductionError(null);
      console.log('[Inventory] Move successful');
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setProductionError(`Failed to move item: ${errorMessage}`);
      console.error('[Inventory] Move error:', err);
    }
  };

  const handleRecordLoss = async () => {
    if (!lossForm.identifier || !lossForm.quantityLost || !lossForm.reason) {
      setProductionError('Please fill in Identifier, Quantity Lost, and Reason.');
      return;
    }
    try {
      console.log('[Inventory] Recording loss:', lossForm);
      const res = await fetch(`${API_BASE_URL}/api/inventory/loss`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token') || ''}`,
        },
        body: JSON.stringify({ ...lossForm, dspNumber: OUR_DSP }),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Record loss failed: HTTP ${res.status}, Response: ${text.slice(0, 50)}`);
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
      console.log('[Inventory] Loss recorded');
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setProductionError(`Failed to record loss: ${errorMessage}`);
      console.error('[Inventory] Record loss error:', err);
    }
  };

  const getIdentifier = (item: InventoryItem) => item?.identifier || 'N/A';

  const handleItemClick = (item: InventoryItem) => {
    const encodedIdentifier = encodeURIComponent(getIdentifier(item).replace(/\//g, '_'));
    console.log('[Inventory] Navigating to:', `/inventory/${encodedIdentifier}`);
    navigate(`/inventory/${encodedIdentifier}`);
  };

  const filteredInventory = React.useMemo(() =>
    inventory.filter(item =>
      item?.status && ['Received', 'Stored', 'Processing', 'Packaged'].includes(item.status) && (
        (getIdentifier(item) || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (item?.type || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (item?.description || '').toLowerCase().includes(searchTerm.toLowerCase())
      )
    ), [inventory, searchTerm]);

  console.log('[Inventory] Render:', {
    isLoading,
    productionError,
    filteredInventoryLength: filteredInventory.length,
    inventoryLength: inventory.length,
    dailySummaryLength: dailySummary.length,
    filteredInventory: filteredInventory.map(item => ({
      identifier: item.identifier,
      status: item.status,
      type: item.type,
      siteId: item.siteId,
      locationId: item.locationId,
      account: item.account,
    })),
  });

  if (isLoading) {
    return (
      <div className="page-container container text-center">
        <div className="alert alert-info">Loading inventory...</div>
      </div>
    );
  }

  return (
    <div className="page-container container">
      <h2 className="app-header mb-4">Inventory Management</h2>
      {productionError && (
        <div className="alert alert-danger mb-3">{productionError}</div>
      )}
      {!filteredInventory.length && !productionError && (
        <div className="alert alert-warning mb-3">No inventory items found.</div>
      )}
      <div className="inventory-actions mb-4 d-flex gap-2 flex-wrap">
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
          onChange={e => setSearchTerm(e.target.value)}
          className="form-control"
          style={{ maxWidth: '300px' }}
        />
      </div>

      <h3 className="app-header mb-3">Inventory</h3>
      <div className="inventory-table-container">
        {filteredInventory.length > 0 ? (
          <>
            <table className="inventory-table table table-striped">
              <thead>
                <tr>
                  <th>Item-Lot</th>
                  <th>Type</th>
                  <th>Quantity</th>
                  <th>Unit</th>
                  <th>Received Date</th>
                  <th>Location</th>
                  <th>Site</th>
                  <th>Account</th>
                  <th>Source</th>
                  <th>Description</th>
                  <th>Unit Cost</th>
                </tr>
              </thead>
              <tbody>
                {filteredInventory.map((item, index) => (
                  <tr key={item.identifier} onClick={() => handleItemClick(item)} style={{ cursor: 'pointer' }}>
                    <td>{getIdentifier(item)}</td>
                    <td>{item?.type || 'N/A'}</td>
                    <td>{item?.quantity ?? 'N/A'}</td>
                    <td>{item?.unit || 'N/A'}</td>
                    <td>{item?.receivedDate || 'N/A'}</td>
                    <td>{getLocationName(item?.locationId)}</td>
                    <td>{getSiteName(item?.siteId)}</td>
                    <td>{item?.account || 'N/A'}</td>
                    <td>{item?.source || 'Unknown'}</td>
                    <td>{item?.description || 'N/A'}</td>
                    <td>{item?.cost || 'N/A'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="card-list">
              {filteredInventory.map((item, index) => (
                <div key={item.identifier} className="card-item card mb-2" onClick={() => handleItemClick(item)} style={{ cursor: 'pointer' }}>
                  <div className="card-body">
                    <p className="card-text"><strong>Item-Lot:</strong> {getIdentifier(item)}</p>
                    <p className="card-text"><strong>Type:</strong> {item?.type || 'N/A'}</p>
                    <p className="card-text"><strong>Quantity:</strong> {item?.quantity ?? 'N/A'}</p>
                    <p className="card-text"><strong>Unit:</strong> {item?.unit || 'N/A'}</p>
                    <p className="card-text"><strong>Received Date:</strong> {item?.receivedDate || 'N/A'}</p>
                    <p className="card-text"><strong>Location:</strong> {getLocationName(item?.locationId)}</p>
                    <p className="card-text"><strong>Site:</strong> {getSiteName(item?.siteId)}</p>
                    <p className="card-text"><strong>Account:</strong> {item?.account || 'N/A'}</p>
                    <p className="card-text"><strong>Source:</strong> {item?.source || 'Unknown'}</p>
                    <p className="card-text"><strong>Description:</strong> {item?.description || 'N/A'}</p>
                    <p className="card-text"><strong>Unit Cost:</strong> {item?.cost || 'N/A'}</p>
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="alert alert-info text-center">No inventory items found.</div>
        )}
      </div>

      <h3 className="app-header mb-3">Daily Summary</h3>
      <div className="inventory-table-container">
        {dailySummary.length > 0 ? (
          <>
            <table className="inventory-table table table-striped">
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
                    <td>{item?.date || 'N/A'}</td>
                    <td>{item?.account || 'N/A'}</td>
                    <td>{item?.type || 'N/A'}</td>
                    <td>{item?.totalProofGallons ? parseFloat(item.totalProofGallons.toString()).toFixed(2) : 'N/A'}</td>
                    <td>{getLocationName(item?.locationId)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="card-list">
              {dailySummary.map((item, index) => (
                <div key={index} className="card-item card mb-2">
                  <div className="card-body">
                    <p className="card-text"><strong>Date:</strong> {item?.date || 'N/A'}</p>
                    <p className="card-text"><strong>Account:</strong> {item?.account || 'N/A'}</p>
                    <p className="card-text"><strong>Type:</strong> {item?.type || 'N/A'}</p>
                    <p className="card-text"><strong>Total Proof Gallons:</strong> {item?.totalProofGallons ? parseFloat(item.totalProofGallons.toString()).toFixed(2) : 'N/A'}</p>
                    <p className="card-text"><strong>Location:</strong> {getLocationName(item?.locationId)}</p>
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="alert alert-info text-center">No daily summary data available.</div>
        )}
      </div>

      {showMoveModal && (
        <div className="modal fade show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 2000 }}>
          <div className="modal-dialog modal-content" style={{ maxWidth: '400px', margin: '0 auto', backgroundColor: '#FFFFFF' }}>
            <div className="modal-header">
              <h5 className="modal-title" style={{ color: '#555555' }}>Move Inventory</h5>
            </div>
            <div className="modal-body">
              <input
                type="text"
                placeholder="Item-Lot (e.g., Flaked Corn)"
                value={moveForm.identifier}
                onChange={e => setMoveForm({ ...moveForm, identifier: e.target.value })}
                className="form-control mb-2"
              />
              <select
                value={moveForm.toAccount}
                onChange={e => setMoveForm({ ...moveForm, toAccount: e.target.value })}
                className="form-control mb-2"
              >
                <option value="Storage">Storage</option>
                <option value="Processing">Processing</option>
                <option value="Production">Production</option>
              </select>
              <input
                type="number"
                placeholder="Proof Gallons"
                value={moveForm.proofGallons}
                onChange={e => setMoveForm({ ...moveForm, proofGallons: e.target.value })}
                className="form-control mb-2"
              />
            </div>
            <div className="modal-footer">
              <button className="btn btn-primary" onClick={handleMove}>
                Move
              </button>
              <button className="btn btn-danger" onClick={() => setShowMoveModal(false)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {showLossModal && (
        <div className="modal fade show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 2000 }}>
          <div className="modal-dialog modal-content" style={{ maxWidth: '400px', margin: '0 auto', backgroundColor: '#FFFFFF' }}>
            <div className="modal-header">
              <h5 className="modal-title" style={{ color: '#555555' }}>Record Loss</h5>
            </div>
            <div className="modal-body">
              <input
                type="text"
                placeholder="Item-Lot (e.g., Flaked Corn)"
                value={lossForm.identifier}
                onChange={e => setLossForm({ ...lossForm, identifier: e.target.value })}
                className="form-control mb-2"
              />
              <input
                type="number"
                placeholder="Quantity Lost"
                value={lossForm.quantityLost}
                onChange={e => setLossForm({ ...lossForm, quantityLost: e.target.value })}
                className="form-control mb-2"
              />
              <input
                type="number"
                placeholder="Proof Gallons Lost"
                value={lossForm.proofGallonsLost}
                onChange={e => setLossForm({ ...lossForm, proofGallonsLost: e.target.value })}
                className="form-control mb-2"
              />
              <input
                type="text"
                placeholder="Reason for Loss"
                value={lossForm.reason}
                onChange={e => setLossForm({ ...lossForm, reason: e.target.value })}
                className="form-control mb-2"
              />
              <input
                type="date"
                value={lossForm.date}
                onChange={e => setLossForm({ ...lossForm, date: e.target.value })}
                className="form-control mb-2"
              />
            </div>
            <div className="modal-footer">
              <button className="btn btn-primary" onClick={handleRecordLoss}>
                Record Loss
              </button>
              <button className="btn btn-danger" onClick={() => setShowLossModal(false)}>
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