import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { InventoryItem } from '../types/interfaces';

interface InventoryProps {
  inventory: InventoryItem[];
  refreshInventory: () => Promise<void>;
}

const InventoryItemDetails: React.FC<InventoryProps> = ({ refreshInventory }) => {
  const { identifier } = useParams<{ identifier: string }>(); // Still using identifier from URL for now
  const navigate = useNavigate();
  const [item, setItem] = useState<InventoryItem | null>(null);
  const [adjustForm, setAdjustForm] = useState<{ newQuantity: string; reason: string; date: string }>({
    newQuantity: '',
    reason: '',
    date: new Date().toISOString().split('T')[0],
  });
  const [showAdjustForm, setShowAdjustForm] = useState(false);
  const [productionError, setProductionError] = useState<string | null>(null);

  const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || '';

  const getIdentifier = (item: InventoryItem) => `${item.item}-${item.lotNumber}`;

  useEffect(() => {
    const fetchItem = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/inventory`);
        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
        const data = await res.json();
        const foundItem = data.find((i: InventoryItem) => getIdentifier(i) === identifier);
        if (foundItem) {
          setItem(foundItem);
          setAdjustForm(prev => ({ ...prev, newQuantity: foundItem.quantity || '' }));
        } else {
          setProductionError('Item not found');
        }
      } catch (err: any) {
        console.error('Fetch item error:', err);
        setProductionError('Failed to load item: ' + err.message);
      }
    };
    fetchItem();
  }, [identifier]);

  const handleAdjustChange = (field: keyof typeof adjustForm, value: string) => {
    setAdjustForm(prev => ({ ...prev, [field]: value }));
  };

  const handleAdjustSubmit = async () => {
    if (!item || !adjustForm.newQuantity || isNaN(parseFloat(adjustForm.newQuantity)) || parseFloat(adjustForm.newQuantity) < 0 || !adjustForm.reason) {
      setProductionError('Valid new quantity and reason are required');
      return;
    }
    try {
      const res = await fetch(`${API_BASE_URL}/api/inventory/adjust`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          identifier: getIdentifier(item), // Use combined item-lotNumber
          newQuantity: adjustForm.newQuantity,
          reason: adjustForm.reason,
          date: adjustForm.date,
        }),
      });
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
      const updatedItem = await res.json();
      setItem(prev => prev ? { ...prev, quantity: updatedItem.newQuantity, totalCost: updatedItem.newTotalCost } : null);
      setShowAdjustForm(false);
      setProductionError(null);
      await refreshInventory(); // Refresh inventory after adjustment
    } catch (err: any) {
      console.error('Adjust inventory error:', err);
      setProductionError('Failed to adjust item: ' + err.message);
    }
  };

  if (!item && !productionError) return <div style={{ color: '#FFFFFF', textAlign: 'center', padding: '20px' }}>Loading...</div>;
  if (productionError) return <div style={{ color: '#F86752', textAlign: 'center', padding: '20px' }}>{productionError}</div>;

  return (
    <div style={{ 
      padding: '20px', 
      backgroundColor: '#2E4655', 
      minHeight: '100vh', 
      color: '#FFFFFF', 
      fontFamily: 'Arial, sans-serif' 
    }}>
      <h2 style={{ color: '#EEC930', fontSize: '28px', marginBottom: '20px', textAlign: 'center' }}>
        Inventory Item Details
      </h2>
      <div style={{ 
        backgroundColor: '#FFFFFF', 
        color: '#000000', 
        padding: '30px', 
        borderRadius: '8px', 
        maxWidth: '600px', 
        margin: '0 auto',
        boxShadow: '0 4px 8px rgba(0,0,0,0.2)'
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
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
          <div><strong>Status:</strong> {item?.status || 'Stored'}</div>
          <div><strong>DSP Number:</strong> {item?.dspNumber || 'N/A'}</div>
        </div>
        {showAdjustForm && item && (
          <div style={{ marginTop: '20px', padding: '20px', backgroundColor: '#F5F5F5', borderRadius: '4px' }}>
            <h3 style={{ color: '#2E4655', fontSize: '20px', marginBottom: '15px' }}>Adjust Inventory</h3>
            <div style={{ marginBottom: '10px' }}>
              <strong>Current Quantity:</strong> {item.quantity} {item.unit}
            </div>
            <div style={{ marginBottom: '10px' }}>
              <strong>Current Total Cost:</strong> ${parseFloat(item.totalCost || '0').toFixed(2)}
            </div>
            <label style={{ display: 'block', marginBottom: '10px' }}>
              New Quantity:
              <input
                type="number"
                value={adjustForm.newQuantity}
                onChange={(e) => handleAdjustChange('newQuantity', e.target.value)}
                step="0.01"
                style={{ marginLeft: '10px', padding: '5px', width: '100px', borderRadius: '4px' }}
              />
            </label>
            <label style={{ display: 'block', marginBottom: '10px' }}>
              Reason:
              <select
                value={adjustForm.reason}
                onChange={(e) => handleAdjustChange('reason', e.target.value)}
                style={{ marginLeft: '10px', padding: '5px', width: '150px', borderRadius: '4px' }}
              >
                <option value="">Select Reason</option>
                <option value="Spillage">Spillage</option>
                <option value="Error">Error</option>
                <option value="Breakage">Breakage</option>
                <option value="Destroyed">Destroyed</option>
              </select>
            </label>
            <label style={{ display: 'block', marginBottom: '10px' }}>
              Date:
              <input
                type="date"
                value={adjustForm.date}
                onChange={(e) => handleAdjustChange('date', e.target.value)}
                style={{ marginLeft: '10px', padding: '5px', borderRadius: '4px' }}
              />
            </label>
            <button
              onClick={handleAdjustSubmit}
              style={{ 
                backgroundColor: '#F86752', 
                color: '#FFFFFF', 
                padding: '10px 20px', 
                border: 'none', 
                borderRadius: '4px', 
                cursor: 'pointer',
                fontSize: '16px'
              }}
            >
              Save Adjustment
            </button>
            {productionError && <p style={{ color: '#F86752', marginTop: '10px' }}>{productionError}</p>}
          </div>
        )}
        <div style={{ marginTop: '20px', textAlign: 'center' }}>
          <button
            onClick={() => setShowAdjustForm(!showAdjustForm)}
            style={{ 
              backgroundColor: '#EEC930', 
              color: '#000000', 
              padding: '10px 20px', 
              border: 'none', 
              borderRadius: '4px', 
              cursor: 'pointer',
              fontSize: '16px'
            }}
          >
            {showAdjustForm ? 'Cancel Adjustment' : 'Adjust Inventory'}
          </button>
          <button
            onClick={() => navigate('/inventory')}
            style={{ 
              backgroundColor: '#000000', 
              color: '#EEC930', 
              padding: '10px 20px', 
              border: 'none', 
              borderRadius: '4px', 
              cursor: 'pointer',
              fontSize: '16px',
              marginLeft: '20px'
            }}
          >
            Back to Inventory
          </button>
        </div>
      </div>
    </div>
  );
};

export default InventoryItemDetails;