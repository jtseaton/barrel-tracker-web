import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

interface PurchaseOrder {
  poNumber: string;
  site: string;
  poDate: string;
  supplier: string;
  supplierAddress: string;
  supplierCity: string;
  supplierState: string;
  supplierZip: string;
  comments: string;
  shipToName: string;
  shipToAddress: string;
  shipToCity: string;
  shipToState: string;
  shipToZip: string;
  items: { name: string; quantity: number }[];
}

interface Item {
  name: string;
  type: string;
  enabled: number;
}

const PurchaseOrderForm: React.FC = () => {
  const { name, poNumber } = useParams<{ name: string; poNumber?: string }>();
  const navigate = useNavigate();
  const [vendorDetails, setVendorDetails] = useState<{ name: string; address: string } | null>(null);
  const [purchaseOrder, setPurchaseOrder] = useState<PurchaseOrder>({
    poNumber: poNumber || '',
    site: 'Main Site',
    poDate: new Date().toISOString().split('T')[0],
    supplier: name || '',
    supplierAddress: '',
    supplierCity: '',
    supplierState: '',
    supplierZip: '',
    comments: '',
    shipToName: 'Paws & Pours',
    shipToAddress: '789 Oak St',
    shipToCity: 'Birmingham',
    shipToState: 'AL',
    shipToZip: '35203',
    items: [],
  });
  const [productionError, setProductionError] = useState<string | null>(null);
  const [isSaved, setIsSaved] = useState(!!poNumber); // True if editing an existing PO
  const [availableItems, setAvailableItems] = useState<Item[]>([]);
  const [selectedItem, setSelectedItem] = useState<string>('');
  const [quantity, setQuantity] = useState<string>('');

  const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || '';

  useEffect(() => {
    fetchVendorDetails();
    fetchAvailableItems();
    if (poNumber) fetchPurchaseOrder();
  }, [name, poNumber]);

  const fetchVendorDetails = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/vendors/${name}`);
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
      const data = await res.json();
      setVendorDetails(data);
      setPurchaseOrder((prev) => ({
        ...prev,
        supplier: data.name,
        supplierAddress: data.address || '',
      }));
    } catch (err: any) {
      console.error('Fetch vendor error:', err);
      setProductionError('Failed to fetch vendor: ' + err.message);
    }
  };

  const fetchAvailableItems = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/items`);
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
      const data = await res.json();
      setAvailableItems(data.filter((item: Item) => item.enabled));
    } catch (err: any) {
      console.error('Fetch items error:', err);
      setProductionError('Failed to fetch items: ' + err.message);
    }
  };

  const fetchPurchaseOrder = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/purchase-orders/${poNumber}`);
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
      const data = await res.json();
      setPurchaseOrder(data);
    } catch (err: any) {
      console.error('Fetch PO error:', err);
      setProductionError('Failed to fetch purchase order: ' + err.message);
    }
  };

  const handleAddItem = () => {
    if (!selectedItem || !quantity || isNaN(parseFloat(quantity)) || parseFloat(quantity) <= 0) {
      setProductionError('Select an item and enter a valid quantity');
      return;
    }
    const newItem = { name: selectedItem, quantity: parseFloat(quantity) };
    setPurchaseOrder((prev) => ({
      ...prev,
      items: [...prev.items, newItem],
    }));
    setSelectedItem('');
    setQuantity('');
    setProductionError(null);
  };

  const handleRemoveItem = (index: number) => {
    setPurchaseOrder((prev) => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index),
    }));
  };

  const handleSave = async () => {
    if (!purchaseOrder.poNumber) {
      setProductionError('PO Number is required');
      return;
    }
    try {
      const res = await fetch(`${API_BASE_URL}/api/purchase-orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(purchaseOrder),
      });
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
      setIsSaved(true);
      setProductionError(null);
    } catch (err: any) {
      console.error('Save purchase order error:', err);
      setProductionError('Failed to save purchase order: ' + err.message);
    }
  };

  const handleEmail = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/purchase-orders/email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ poNumber: purchaseOrder.poNumber, supplier: purchaseOrder.supplier }),
      });
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
      alert('Email sent to vendor!');
      navigate(`/vendors/${name}`);
    } catch (err: any) {
      console.error('Email error:', err);
      setProductionError('Failed to send email: ' + err.message);
    }
  };

  const handleCancel = () => {
    navigate(`/vendors/${name}`);
  };

  return (
    <div style={{ 
      padding: '20px', 
      backgroundColor: '#2E4655', 
      borderRadius: '8px', 
      maxWidth: '800px', 
      margin: '20px auto',
      maxHeight: '80vh',
      overflowY: 'auto'
    }}>
      <h2 style={{ color: '#EEC930', fontSize: '28px', marginBottom: '20px' }}>
        {poNumber ? 'Edit Purchase Order' : 'Add New Purchase Order'}
      </h2>
      {productionError && <p style={{ color: '#F86752', fontSize: '16px' }}>{productionError}</p>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
        <label style={{ color: '#EEC930', fontSize: '18px' }}>
          PO Number:
          <input
            type="text"
            value={purchaseOrder.poNumber}
            onChange={(e) => setPurchaseOrder({ ...purchaseOrder, poNumber: e.target.value })}
            disabled={!!poNumber} // Lock PO number when editing
            style={{ width: '100%', padding: '10px', fontSize: '16px', borderRadius: '4px', border: '1px solid #000000', marginTop: '5px', boxSizing: 'border-box' }}
          />
        </label>
        <label style={{ color: '#EEC930', fontSize: '18px' }}>
          Site:
          <input
            type="text"
            value={purchaseOrder.site}
            onChange={(e) => setPurchaseOrder({ ...purchaseOrder, site: e.target.value })}
            style={{ width: '100%', padding: '10px', fontSize: '16px', borderRadius: '4px', border: '1px solid #000000', marginTop: '5px', boxSizing: 'border-box' }}
          />
        </label>
        <label style={{ color: '#EEC930', fontSize: '18px' }}>
          PO Date:
          <input
            type="date"
            value={purchaseOrder.poDate}
            onChange={(e) => setPurchaseOrder({ ...purchaseOrder, poDate: e.target.value })}
            style={{ width: '100%', padding: '10px', fontSize: '16px', borderRadius: '4px', border: '1px solid #000000', marginTop: '5px', boxSizing: 'border-box' }}
          />
        </label>
        <label style={{ color: '#EEC930', fontSize: '18px' }}>
          Supplier:
          <input
            type="text"
            value={purchaseOrder.supplier}
            disabled
            style={{ width: '100%', padding: '10px', fontSize: '16px', borderRadius: '4px', border: '1px solid #000000', marginTop: '5px', backgroundColor: '#000000', color: '#FFFFFF', boxSizing: 'border-box' }}
          />
        </label>
        <label style={{ color: '#EEC930', fontSize: '18px' }}>
          Supplier Address:
          <textarea
            value={purchaseOrder.supplierAddress}
            onChange={(e) => setPurchaseOrder({ ...purchaseOrder, supplierAddress: e.target.value })}
            style={{ width: '100%', padding: '10px', fontSize: '16px', borderRadius: '4px', border: '1px solid #000000', marginTop: '5px', minHeight: '60px', boxSizing: 'border-box' }}
          />
        </label>
        <label style={{ color: '#EEC930', fontSize: '18px' }}>
          Supplier City:
          <input
            type="text"
            value={purchaseOrder.supplierCity}
            onChange={(e) => setPurchaseOrder({ ...purchaseOrder, supplierCity: e.target.value })}
            style={{ width: '100%', padding: '10px', fontSize: '16px', borderRadius: '4px', border: '1px solid #000000', marginTop: '5px', boxSizing: 'border-box' }}
          />
        </label>
        <label style={{ color: '#EEC930', fontSize: '18px' }}>
          Supplier State:
          <input
            type="text"
            value={purchaseOrder.supplierState}
            onChange={(e) => setPurchaseOrder({ ...purchaseOrder, supplierState: e.target.value })}
            style={{ width: '100%', padding: '10px', fontSize: '16px', borderRadius: '4px', border: '1px solid #000000', marginTop: '5px', boxSizing: 'border-box' }}
          />
        </label>
        <label style={{ color: '#EEC930', fontSize: '18px' }}>
          Supplier Zip Code:
          <input
            type="text"
            value={purchaseOrder.supplierZip}
            onChange={(e) => setPurchaseOrder({ ...purchaseOrder, supplierZip: e.target.value })}
            style={{ width: '100%', padding: '10px', fontSize: '16px', borderRadius: '4px', border: '1px solid #000000', marginTop: '5px', boxSizing: 'border-box' }}
          />
        </label>
        <label style={{ color: '#EEC930', fontSize: '18px' }}>
          Comments:
          <textarea
            value={purchaseOrder.comments}
            onChange={(e) => setPurchaseOrder({ ...purchaseOrder, comments: e.target.value })}
            style={{ width: '100%', padding: '10px', fontSize: '16px', borderRadius: '4px', border: '1px solid #000000', marginTop: '5px', minHeight: '60px', boxSizing: 'border-box' }}
          />
        </label>
        <label style={{ color: '#EEC930', fontSize: '18px' }}>
          Ship To (Name):
          <input
            type="text"
            value={purchaseOrder.shipToName}
            onChange={(e) => setPurchaseOrder({ ...purchaseOrder, shipToName: e.target.value })}
            style={{ width: '100%', padding: '10px', fontSize: '16px', borderRadius: '4px', border: '1px solid #000000', marginTop: '5px', boxSizing: 'border-box' }}
          />
        </label>
        <label style={{ color: '#EEC930', fontSize: '18px' }}>
          Ship To Address:
          <textarea
            value={purchaseOrder.shipToAddress}
            onChange={(e) => setPurchaseOrder({ ...purchaseOrder, shipToAddress: e.target.value })}
            style={{ width: '100%', padding: '10px', fontSize: '16px', borderRadius: '4px', border: '1px solid #000000', marginTop: '5px', minHeight: '60px', boxSizing: 'border-box' }}
          />
        </label>
        <label style={{ color: '#EEC930', fontSize: '18px' }}>
          Ship To City:
          <input
            type="text"
            value={purchaseOrder.shipToCity}
            onChange={(e) => setPurchaseOrder({ ...purchaseOrder, shipToCity: e.target.value })}
            style={{ width: '100%', padding: '10px', fontSize: '16px', borderRadius: '4px', border: '1px solid #000000', marginTop: '5px', boxSizing: 'border-box' }}
          />
        </label>
        <label style={{ color: '#EEC930', fontSize: '18px' }}>
          Ship To State:
          <input
            type="text"
            value={purchaseOrder.shipToState}
            onChange={(e) => setPurchaseOrder({ ...purchaseOrder, shipToState: e.target.value })}
            style={{ width: '100%', padding: '10px', fontSize: '16px', borderRadius: '4px', border: '1px solid #000000', marginTop: '5px', boxSizing: 'border-box' }}
          />
        </label>
        <label style={{ color: '#EEC930', fontSize: '18px' }}>
          Ship To ZIP Code:
          <input
            type="text"
            value={purchaseOrder.shipToZip}
            onChange={(e) => setPurchaseOrder({ ...purchaseOrder, shipToZip: e.target.value })}
            style={{ width: '100%', padding: '10px', fontSize: '16px', borderRadius: '4px', border: '1px solid #000000', marginTop: '5px', boxSizing: 'border-box' }}
          />
        </label>
        <div style={{ color: '#EEC930', fontSize: '18px' }}>
          Items:
          <div style={{ display: 'flex', gap: '10px', marginTop: '5px' }}>
            <select
              value={selectedItem}
              onChange={(e) => setSelectedItem(e.target.value)}
              style={{ padding: '10px', fontSize: '16px', borderRadius: '4px', border: '1px solid #000000', flex: 1 }}
            >
              <option value="">Select Item</option>
              {availableItems.map((item) => (
                <option key={item.name} value={item.name}>{item.name}</option>
              ))}
            </select>
            <input
              type="number"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder="Quantity"
              min="1"
              style={{ padding: '10px', fontSize: '16px', borderRadius: '4px', border: '1px solid #000000', width: '100px' }}
            />
            <button
              onClick={handleAddItem}
              style={{ backgroundColor: '#F86752', color: '#FFFFFF', padding: '10px', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
            >
              Add
            </button>
          </div>
          <ul style={{ listStyle: 'none', padding: 0, marginTop: '10px' }}>
            {purchaseOrder.items.map((item, index) => (
              <li key={index} style={{ display: 'flex', justifyContent: 'space-between', color: '#FFFFFF', marginBottom: '5px' }}>
                {item.name}: {item.quantity}
                <button
                  onClick={() => handleRemoveItem(index)}
                  style={{ backgroundColor: '#F86752', color: '#FFFFFF', padding: '5px 10px', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <div style={{ marginTop: '20px', textAlign: 'center' }}>
        <button
          onClick={handleSave}
          style={{ backgroundColor: '#F86752', color: '#FFFFFF', padding: '10px 20px', border: 'none', borderRadius: '4px', fontSize: '16px', cursor: 'pointer' }}
        >
          Save
        </button>
        {(isSaved || poNumber) && ( // Show email button if saved or editing
          <button
            onClick={handleEmail}
            style={{ backgroundColor: '#EEC930', color: '#000000', padding: '10px 20px', border: 'none', borderRadius: '4px', fontSize: '16px', marginLeft: '10px', cursor: 'pointer' }}
          >
            Email to Vendor
          </button>
        )}
        <button
          onClick={handleCancel}
          style={{ backgroundColor: '#000000', color: '#EEC930', padding: '10px 20px', border: 'none', borderRadius: '4px', fontSize: '16px', marginLeft: '10px', cursor: 'pointer' }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
};

export default PurchaseOrderForm;