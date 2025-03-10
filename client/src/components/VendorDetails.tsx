// client/src/components/VendorDetails.tsx
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

interface Vendor {
  name: string;
  type: 'Supplier' | 'Customer' | 'Distributor' | 'Delivery';
  enabled: number;
  address: string;
  email: string;
  phone: string;
}

interface InventoryReceipt {
  identifier: string;
  type: string;
  quantity: string;
  receivedDate: string;
  status: string; // Added to match inventory table schema
}

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
}

const VendorDetails: React.FC = () => {
  const { name } = useParams<{ name: string }>();
  const navigate = useNavigate();
  const [vendorDetails, setVendorDetails] = useState<Vendor | null>(null);
  const [editing, setEditing] = useState(name === 'new');
  const [editedVendor, setEditedVendor] = useState<Vendor>({
    name: '',
    type: 'Supplier',
    enabled: 1,
    address: '',
    email: '',
    phone: '',
  });
  const [productionError, setProductionError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'info' | 'receipts' | 'orders'>('info');
  const [receipts, setReceipts] = useState<InventoryReceipt[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);

  const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || '';

  useEffect(() => {
    if (name && name !== 'new') {
      fetchVendorDetails();
      fetchReceipts();
      fetchPurchaseOrders();
    }
  }, [name]);

  const fetchVendorDetails = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/vendors/${name}`);
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
      const data = await res.json();
      setVendorDetails(data);
      setEditedVendor(data);
    } catch (err: any) {
      console.error('Fetch vendor error:', err);
      setProductionError('Failed to fetch vendor: ' + err.message);
    }
  };

  const fetchReceipts = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/inventory?source=${name}`);
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
      const data = await res.json();
      setReceipts(data.filter((item: InventoryReceipt) => ['Received', 'Stored'].includes(item.status || '')));
    } catch (err: any) {
      console.error('Fetch receipts error:', err);
      setProductionError('Failed to fetch receipts: ' + err.message);
    }
  };

  const fetchPurchaseOrders = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/purchase-orders?supplier=${name}`);
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
      const data = await res.json();
      setPurchaseOrders(data);
    } catch (err: any) {
      console.error('Fetch purchase orders error:', err);
      setProductionError('Failed to fetch purchase orders: ' + err.message);
    }
  };

  const handleSave = async () => {
    if (!editedVendor.name) {
      setProductionError('Vendor name is required');
      return;
    }
    try {
      const method = name && name !== 'new' ? 'PUT' : 'POST';
      const url = method === 'PUT' ? `${API_BASE_URL}/api/vendors` : `${API_BASE_URL}/api/vendors`;
      const body = method === 'PUT'
        ? { oldName: name, newVendor: editedVendor }
        : { ...editedVendor };
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
      setVendorDetails(editedVendor);
      setEditing(false);
      setProductionError(null);
      navigate(`/vendors/${editedVendor.name}`);
    } catch (err: any) {
      console.error('Save vendor error:', err);
      setProductionError('Failed to save vendor: ' + err.message);
    }
  };

  const handleCancel = () => {
    if (name && name !== 'new') {
      setEditing(false);
      setEditedVendor(vendorDetails!);
    } else {
      navigate('/vendors');
    }
  };

  const handleAddReceipt = () => {
    navigate('/receive', { state: { vendor: vendorDetails?.name } });
  };

  const handleAddPurchaseOrder = () => {
    navigate(`/vendors/${name}/purchase-order/new`);
  };

  if (name && name !== 'new' && !vendorDetails) return <div>Loading...</div>;

  return (
    <div style={{ padding: '20px', backgroundColor: '#2E4655', borderRadius: '8px', maxWidth: '800px', margin: '20px auto' }}>
      <h2 style={{ color: '#EEC930', fontSize: '28px', marginBottom: '20px' }}>
        {name === 'new' ? 'Add New Vendor' : `${vendorDetails?.name} Details`}
      </h2>
      {name !== 'new' && (
        <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
          <button
            onClick={() => setActiveTab('info')}
            style={{
              backgroundColor: activeTab === 'info' ? '#F86752' : '#000000',
              color: activeTab === 'info' ? '#FFFFFF' : '#EEC930',
              padding: '10px 20px',
              border: 'none',
              borderRadius: '4px',
              fontSize: '16px',
              cursor: 'pointer',
            }}
          >
            Information
          </button>
          <button
            onClick={() => setActiveTab('receipts')}
            style={{
              backgroundColor: activeTab === 'receipts' ? '#F86752' : '#000000',
              color: activeTab === 'receipts' ? '#FFFFFF' : '#EEC930',
              padding: '10px 20px',
              border: 'none',
              borderRadius: '4px',
              fontSize: '16px',
              cursor: 'pointer',
            }}
          >
            Inventory Receipts
          </button>
          <button
            onClick={() => setActiveTab('orders')}
            style={{
              backgroundColor: activeTab === 'orders' ? '#F86752' : '#000000',
              color: activeTab === 'orders' ? '#FFFFFF' : '#EEC930',
              padding: '10px 20px',
              border: 'none',
              borderRadius: '4px',
              fontSize: '16px',
              cursor: 'pointer',
            }}
          >
            Purchase Orders
          </button>
        </div>
      )}
      {productionError && <p style={{ color: '#F86752', fontSize: '16px' }}>{productionError}</p>}
      
      {activeTab === 'info' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
          <label style={{ color: '#EEC930', fontSize: '18px' }}>
            Name:
            {editing ? (
              <input
                type="text"
                value={editedVendor.name}
                onChange={(e) => setEditedVendor({ ...editedVendor, name: e.target.value })}
                style={{ width: '100%', padding: '10px', fontSize: '16px', borderRadius: '4px', border: '1px solid #000000', marginTop: '5px' }}
              />
            ) : (
              <span style={{ color: '#FFFFFF', marginLeft: '10px' }}>{vendorDetails?.name}</span>
            )}
          </label>
          <label style={{ color: '#EEC930', fontSize: '18px' }}>
            Type:
            {editing ? (
              <select
                value={editedVendor.type}
                onChange={(e) => setEditedVendor({ ...editedVendor, type: e.target.value as Vendor['type'] })}
                style={{ width: '100%', padding: '10px', fontSize: '16px', borderRadius: '4px', border: '1px solid #000000', marginTop: '5px' }}
              >
                <option value="Supplier">Supplier</option>
                <option value="Customer">Customer</option>
                <option value="Distributor">Distributor</option>
                <option value="Delivery">Delivery</option>
              </select>
            ) : (
              <span style={{ color: '#FFFFFF', marginLeft: '10px' }}>{vendorDetails?.type}</span>
            )}
          </label>
          <label style={{ color: '#EEC930', fontSize: '18px' }}>
            Address:
            {editing ? (
              <textarea
                value={editedVendor.address}
                onChange={(e) => setEditedVendor({ ...editedVendor, address: e.target.value })}
                style={{ width: '100%', padding: '10px', fontSize: '16px', borderRadius: '4px', border: '1px solid #000000', marginTop: '5px', minHeight: '60px' }}
              />
            ) : (
              <span style={{ color: '#FFFFFF', marginLeft: '10px' }}>{vendorDetails?.address || 'N/A'}</span>
            )}
          </label>
          <label style={{ color: '#EEC930', fontSize: '18px' }}>
            Email:
            {editing ? (
              <input
                type="email"
                value={editedVendor.email}
                onChange={(e) => setEditedVendor({ ...editedVendor, email: e.target.value })}
                style={{ width: '100%', padding: '10px', fontSize: '16px', borderRadius: '4px', border: '1px solid #000000', marginTop: '5px' }}
              />
            ) : (
              <span style={{ color: '#FFFFFF', marginLeft: '10px' }}>{vendorDetails?.email || 'N/A'}</span>
            )}
          </label>
          <label style={{ color: '#EEC930', fontSize: '18px' }}>
            Phone:
            {editing ? (
              <input
                type="tel"
                value={editedVendor.phone}
                onChange={(e) => setEditedVendor({ ...editedVendor, phone: e.target.value })}
                style={{ width: '100%', padding: '10px', fontSize: '16px', borderRadius: '4px', border: '1px solid #000000', marginTop: '5px' }}
              />
            ) : (
              <span style={{ color: '#FFFFFF', marginLeft: '10px' }}>{vendorDetails?.phone || 'N/A'}</span>
            )}
          </label>
          {editing && (
            <div style={{ marginTop: '20px', textAlign: 'center' }}>
              <button
                onClick={handleSave}
                style={{ backgroundColor: '#F86752', color: '#FFFFFF', padding: '10px 20px', border: 'none', borderRadius: '4px', fontSize: '16px', cursor: 'pointer' }}
              >
                Save
              </button>
              <button
                onClick={handleCancel}
                style={{ backgroundColor: '#000000', color: '#EEC930', padding: '10px 20px', border: 'none', borderRadius: '4px', fontSize: '16px', marginLeft: '10px', cursor: 'pointer' }}
              >
                Cancel
              </button>
            </div>
          )}
          {!editing && (
            <div style={{ marginTop: '20px', textAlign: 'center' }}>
              <button
                onClick={() => setEditing(true)}
                style={{ backgroundColor: '#F86752', color: '#FFFFFF', padding: '10px 20px', border: 'none', borderRadius: '4px', fontSize: '16px', cursor: 'pointer' }}
              >
                Edit
              </button>
            </div>
          )}
        </div>
      )}

      {activeTab === 'receipts' && name !== 'new' && (
        <div>
          <h3 style={{ color: '#EEC930', fontSize: '20px', marginBottom: '10px' }}>Inventory Receipts</h3>
          <button
            onClick={handleAddReceipt}
            style={{ backgroundColor: '#F86752', color: '#FFFFFF', padding: '10px 20px', border: 'none', borderRadius: '4px', fontSize: '16px', cursor: 'pointer', marginBottom: '20px' }}
          >
            Add Receipt
          </button>
          <table>
            <thead>
              <tr>
                <th>Identifier</th>
                <th>Type</th>
                <th>Quantity</th>
                <th>Date Received</th>
              </tr>
            </thead>
            <tbody>
              {receipts.map((receipt) => (
                <tr key={receipt.identifier}>
                  <td>{receipt.identifier}</td>
                  <td>{receipt.type}</td>
                  <td>{receipt.quantity}</td>
                  <td>{receipt.receivedDate}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'orders' && name !== 'new' && (
        <div>
          <h3 style={{ color: '#EEC930', fontSize: '20px', marginBottom: '10px' }}>Purchase Orders</h3>
          <button
            onClick={handleAddPurchaseOrder}
            style={{ backgroundColor: '#F86752', color: '#FFFFFF', padding: '10px 20px', border: 'none', borderRadius: '4px', fontSize: '16px', cursor: 'pointer', marginBottom: '20px' }}
          >
            Add Purchase Order
          </button>
          <table>
            <thead>
              <tr>
                <th>PO Number</th>
                <th>Site</th>
                <th>PO Date</th>
                <th>Comments</th>
              </tr>
            </thead>
            <tbody>
              {purchaseOrders.map((order) => (
                <tr key={order.poNumber}>
                  <td>{order.poNumber}</td>
                  <td>{order.site}</td>
                  <td>{order.poDate}</td>
                  <td>{order.comments || 'N/A'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default VendorDetails;