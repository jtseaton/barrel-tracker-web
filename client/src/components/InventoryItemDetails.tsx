// client/src/components/InventoryItemDetails.tsx
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { InventoryItem, Site } from '../types/interfaces';
import 'bootstrap/dist/css/bootstrap.min.css';
import '../App.css';

interface InventoryProps {
  inventory: InventoryItem[];
  refreshInventory: () => Promise<void>;
}

const InventoryItemDetails: React.FC<InventoryProps> = ({ refreshInventory }) => {
  const { identifier } = useParams<{ identifier: string }>();
  const navigate = useNavigate();
  const [item, setItem] = useState<InventoryItem | null>(null);
  const [sites, setSites] = useState<Site[]>([]);
  const [adjustForm, setAdjustForm] = useState<{ newQuantity: string; reason: string; date: string }>({
    newQuantity: '',
    reason: '',
    date: new Date().toISOString().split('T')[0],
  });
  const [showAdjustForm, setShowAdjustForm] = useState(false);
  const [productionError, setProductionError] = useState<string | null>(null);

  const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || '';

  const getIdentifier = (item: InventoryItem) => item.identifier || 'N/A';

  // Decode URL identifier (replace _ with /)
  const decodedIdentifier = identifier ? decodeURIComponent(identifier).replace(/_/g, '/') : '';

  // Helper function to get site name
  const getSiteName = (siteId: string | undefined) => {
    if (!siteId) return 'N/A';
    const site = sites.find((s) => s.siteId === siteId);
    return site ? site.name : 'N/A';
  };

  useEffect(() => {
    const fetchItem = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/inventory`, { headers: { Accept: 'application/json' } });
        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
        const data = await res.json();
        const foundItem = data.items.find((i: InventoryItem) => getIdentifier(i) === decodedIdentifier);
        if (foundItem) {
          console.log('[InventoryItemDetails] Fetched item:', foundItem);
          setItem(foundItem);
          setAdjustForm((prev) => ({ ...prev, newQuantity: foundItem.quantity || '' }));
        } else {
          setProductionError('Item not found');
        }
      } catch (err: any) {
        console.error('[InventoryItemDetails] Fetch item error:', err);
        setProductionError('Failed to load item: ' + err.message);
      }
    };
    fetchItem();
  }, [decodedIdentifier]);

  // Fetch sites
  useEffect(() => {
    const fetchSites = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/sites`, { headers: { Accept: 'application/json' } });
        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
        const data: Site[] = await res.json();
        console.log('[InventoryItemDetails] Fetched sites:', data);
        setSites(data);
      } catch (err: any) {
        console.error('[InventoryItemDetails] Fetch sites error:', err);
        setProductionError('Failed to fetch sites: ' + err.message);
      }
    };
    fetchSites();
  }, [API_BASE_URL]);

  const handleAdjustChange = (field: keyof typeof adjustForm, value: string) => {
    setAdjustForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleAdjustSubmit = async () => {
    if (!item || !adjustForm.newQuantity || isNaN(parseFloat(adjustForm.newQuantity)) || parseFloat(adjustForm.newQuantity) < 0 || !adjustForm.reason) {
      setProductionError('Valid new quantity and reason are required');
      return;
    }
    try {
      const res = await fetch(`${API_BASE_URL}/api/inventory/adjust`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          identifier: getIdentifier(item),
          newQuantity: adjustForm.newQuantity,
          reason: adjustForm.reason,
          date: adjustForm.date,
        }),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`HTTP error! status: ${res.status}, ${text.slice(0, 50)}`);
      }
      const updatedItem = await res.json();
      console.log('[InventoryItemDetails] Adjusted item:', updatedItem);
      setItem((prev) => (prev ? { ...prev, quantity: updatedItem.newQuantity, totalCost: updatedItem.newTotalCost } : null));
      setShowAdjustForm(false);
      setProductionError(null);
      await refreshInventory();
    } catch (err: any) {
      console.error('[InventoryItemDetails] Adjust inventory error:', err);
      setProductionError('Failed to adjust item: ' + err.message);
    }
  };

  console.log('[InventoryItemDetails] Render:', {
    identifier: decodedIdentifier,
    item: item ? getIdentifier(item) : null,
    showAdjustForm,
    productionError,
    isMobile: window.innerWidth <= 768,
  });

  if (!item && !productionError) return <div className="alert alert-info text-center">Loading...</div>;
  if (productionError) return <div className="alert alert-danger text-center">{productionError}</div>;

  return (
    <div className="page-container container">
      <h2 className="app-header mb-4">Inventory Item Details</h2>
      <div className="batch-details inventory-item-details">
        <div><strong>Item-Lot:</strong> {item ? getIdentifier(item) : 'N/A'}</div>
        <div><strong>Type:</strong> {item?.type}</div>
        <div><strong>Description:</strong> {item?.description || 'N/A'}</div>
        <div><strong>Quantity:</strong> {item?.quantity} {item?.unit}</div>
        <div><strong>Unit:</strong> {item?.unit || 'N/A'}</div>
        {item?.type === 'Spirits' && <div><strong>Proof:</strong> {item?.proof || 'N/A'}</div>}
        {item?.type === 'Spirits' && <div><strong>Proof Gallons:</strong> {item?.proofGallons || 'N/A'}</div>}
        <div><strong>Total Cost:</strong> {item?.totalCost ? `$${parseFloat(item.totalCost).toFixed(2)}` : 'N/A'}</div>
        <div><strong>Date Received:</strong> {item?.receivedDate || 'N/A'}</div>
        <div><strong>Source:</strong> {item?.source || 'N/A'}</div>
        <div><strong>Location:</strong> {item?.account || 'Storage'}</div>
        <div><strong>Site:</strong> {item ? getSiteName(item.siteId) : 'N/A'}</div>
        <div><strong>Status:</strong> {item?.status || 'Stored'}</div>
        <div><strong>DSP Number:</strong> {item?.dspNumber || 'N/A'}</div>
        {showAdjustForm && item && (
          <div className="adjust-form">
            <h3 className="app-header mb-3">Adjust Inventory</h3>
            <div className="mb-3"><strong>Current Quantity:</strong> {item.quantity} {item.unit}</div>
            <div className="mb-3"><strong>Current Total Cost:</strong> ${parseFloat(item.totalCost || '0').toFixed(2)}</div>
            <label className="form-label">
              New Quantity:
              <input
                type="number"
                value={adjustForm.newQuantity}
                onChange={(e) => handleAdjustChange('newQuantity', e.target.value)}
                step="0.01"
                className="form-control"
              />
            </label>
            <label className="form-label">
              Reason:
              <select
                value={adjustForm.reason}
                onChange={(e) => handleAdjustChange('reason', e.target.value)}
                className="form-control"
              >
                <option value="">Select Reason</option>
                <option value="Spillage">Spillage</option>
                <option value="Error">Error</option>
                <option value="Breakage">Breakage</option>
                <option value="Destroyed">Destroyed</option>
              </select>
            </label>
            <label className="form-label">
              Date:
              <input
                type="date"
                value={adjustForm.date}
                onChange={(e) => handleAdjustChange('date', e.target.value)}
                className="form-control"
              />
            </label>
            <button onClick={handleAdjustSubmit} className="btn btn-primary mt-3">
              Save Adjustment
            </button>
            {productionError && <div className="alert alert-danger mt-3">{productionError}</div>}
          </div>
        )}
        <div className="inventory-actions mt-4">
          <button
            onClick={() => setShowAdjustForm(!showAdjustForm)}
            className="btn btn-primary"
          >
            {showAdjustForm ? 'Cancel Adjustment' : 'Adjust Inventory'}
          </button>
          <button
            onClick={() => navigate('/inventory')}
            className="btn btn-danger"
          >
            Back to Inventory
          </button>
        </div>
      </div>
    </div>
  );
};

export default InventoryItemDetails;