// client/src/components/VendorDetails.tsx
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { Vendor, InventoryItem, PurchaseOrder } from '../types/interfaces';
import 'bootstrap/dist/css/bootstrap.min.css';
import '../App.css';

interface VendorDetailsProps {
  vendors: Vendor[];
  refreshVendors: () => Promise<void>;
  refreshInventory: () => Promise<void>;
}

const VendorDetails: React.FC<VendorDetailsProps> = ({ refreshVendors, refreshInventory }) => {
  const { name } = useParams<{ name: string }>();
  const navigate = useNavigate();
  const location = useLocation();
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
  const [receipts, setReceipts] = useState<InventoryItem[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);

  const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || '';

  const getIdentifier = (item: InventoryItem) => `${item.item}-${item.lotNumber}`;

  const fetchVendorDetails = async () => {
    if (!name || name === 'new') return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/vendors/${encodeURIComponent(name)}`, { headers: { Accept: 'application/json' } });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`HTTP error! status: ${res.status}, ${text.slice(0, 50)}`);
      }
      const data = await res.json();
      console.log('[VendorDetails] Fetched vendor:', data);
      setVendorDetails(data);
      setEditedVendor({
        name: data.name || '',
        type: data.type || 'Supplier',
        enabled: data.enabled ?? 1,
        address: data.address || '',
        email: data.email || '',
        phone: data.phone || '',
      });
      setProductionError(null);
    } catch (err: any) {
      setProductionError('Failed to fetch vendor details: ' + err.message);
      setVendorDetails({ name, type: 'Supplier', enabled: 1, address: '', email: '', phone: '' });
      console.error('[VendorDetails] Fetch vendor error:', err);
    }
  };

  useEffect(() => {
    if (name && name !== 'new') {
      fetchVendorDetails();
      fetchReceipts();
      fetchPurchaseOrders();
    }
  }, [name]);

  const fetchReceipts = async () => {
    try {
      const encodedName = encodeURIComponent(name || '');
      console.log('[VendorDetails] Fetching receipts:', { url: `${API_BASE_URL}/api/inventory?source=${encodedName}` });
      const res = await fetch(`${API_BASE_URL}/api/inventory?source=${encodedName}`, { headers: { Accept: 'application/json' } });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`HTTP error! status: ${res.status}, ${text.slice(0, 50)}`);
      }
      const data = await res.json();
      console.log('[VendorDetails] Fetched receipts:', data.items);
      setReceipts(data.items.filter((item: InventoryItem) => ['Received', 'Stored'].includes(item.status || '')));
      setProductionError(null);
    } catch (err: any) {
      setProductionError('Failed to fetch receipts: ' + err.message);
      setReceipts([]);
      console.error('[VendorDetails] Fetch receipts error:', err);
    }
  };

  const fetchPurchaseOrders = async () => {
    try {
      const encodedName = encodeURIComponent(name || '');
      console.log('[VendorDetails] Fetching purchase orders:', { url: `${API_BASE_URL}/api/purchase-orders?supplier=${encodedName}` });
      const res = await fetch(`${API_BASE_URL}/api/purchase-orders?supplier=${encodedName}`, { headers: { Accept: 'application/json' } });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`HTTP error! status: ${res.status}, ${text.slice(0, 50)}`);
      }
      const data = await res.json();
      console.log('[VendorDetails] Fetched purchase orders:', data);
      setPurchaseOrders(data);
    } catch (err: any) {
      setProductionError('Failed to fetch purchase orders: ' + err.message);
      console.error('[VendorDetails] Fetch purchase orders error:', err);
    }
  };

  const handleSave = async () => {
    if (!editedVendor.name) {
      setProductionError('Vendor name is required');
      return;
    }
    try {
      const method = name && name !== 'new' ? 'PUT' : 'POST';
      const url = `${API_BASE_URL}/api/vendors`;
      const body = method === 'PUT'
        ? {
            oldName: name,
            newVendor: {
              name: editedVendor.name,
              type: editedVendor.type || 'Supplier',
              enabled: editedVendor.enabled ?? 1,
              address: editedVendor.address || '',
              email: editedVendor.email || '',
              phone: editedVendor.phone || '',
            },
          }
        : {
            name: editedVendor.name,
            type: editedVendor.type || 'Supplier',
            enabled: editedVendor.enabled ?? 1,
            address: editedVendor.address || '',
            email: editedVendor.email || '',
            phone: editedVendor.phone || '',
          };
      console.log('[VendorDetails] Saving vendor:', { method, url, body });
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`HTTP error! status: ${res.status}, ${text.slice(0, 50)}`);
      }
      const updatedVendor = await res.json();
      console.log('[VendorDetails] Saved vendor:', updatedVendor);
      setVendorDetails(method === 'PUT' ? updatedVendor : body);
      setEditedVendor(method === 'PUT' ? updatedVendor : body);
      setEditing(false);
      await refreshVendors();
      setProductionError(null);
      if (location.state?.fromReceive) {
        navigate('/receive', { state: { vendor: editedVendor.name } });
      } else {
        navigate(`/vendors/${editedVendor.name}`);
      }
      // Refetch to ensure sync
      await fetchVendorDetails();
    } catch (err: any) {
      setProductionError('Failed to save vendor: ' + err.message);
      console.error('[VendorDetails] Save vendor error:', err);
    }
  };

  const handleCancel = () => {
    console.log('[VendorDetails] Cancel edit');
    if (name && name !== 'new') {
      setEditing(false);
      setEditedVendor(vendorDetails || { name: '', type: 'Supplier', enabled: 1, address: '', email: '', phone: '' });
    } else {
      navigate('/vendors');
    }
  };

  const handleAddReceipt = () => {
    navigate('/receive', { state: { vendor: vendorDetails?.name, fromVendor: true } });
  };

  const handleAddPurchaseOrder = () => {
    if (name === 'new') {
      setProductionError('Save the vendor before adding a purchase order');
      return;
    }
    navigate(`/vendors/${name}/purchase-orders/new`);
  };

  const handleViewPOs = () => {
    if (name === 'new') {
      setProductionError('Save the vendor before viewing purchase orders');
      return;
    }
    navigate(`/vendors/${name}/purchase-orders`);
    setActiveTab('orders');
  };

  const handleEditPO = (poNumber: string) => {
    navigate(`/vendors/${name}/purchase-orders/${poNumber}`);
  };

  useEffect(() => {
    if (location.state?.fromVendor && name && name !== 'new') {
      fetchReceipts();
      refreshInventory();
    }
  }, [location.state, name]);

  console.log('[VendorDetails] Render:', {
    vendor: name,
    vendorDetails,
    editedVendor,
    activeTab,
    editing,
    receiptsLength: receipts.length,
    purchaseOrdersLength: purchaseOrders.length,
    productionError,
    isMobile: window.innerWidth <= 768,
  });

  if (name && name !== 'new' && !vendorDetails) return <div className="alert alert-info text-center">Loading...</div>;

  return (
    <div className="page-container container">
      <h2 className="app-header mb-4">{name === 'new' ? 'Add New Vendor' : `${vendorDetails?.name} Details`}</h2>
      {name !== 'new' && (
        <div className="vendor-tabs">
          <button className={activeTab === 'info' ? 'active' : ''} onClick={() => setActiveTab('info')}>
            Information
          </button>
          <button className={activeTab === 'receipts' ? 'active' : ''} onClick={() => setActiveTab('receipts')}>
            Inventory Receipts
          </button>
          <button className={activeTab === 'orders' ? 'active' : ''} onClick={handleViewPOs}>
            Purchase Orders
          </button>
          <select
            value={activeTab}
            onChange={(e) => setActiveTab(e.target.value as 'info' | 'receipts' | 'orders')}
            className="form-control"
          >
            <option value="info">Information</option>
            <option value="receipts">Inventory Receipts</option>
            <option value="orders">Purchase Orders</option>
          </select>
        </div>
      )}
      {productionError && <div className="alert alert-danger">{productionError}</div>}

      {activeTab === 'info' && (
        <div className="vendor-form">
          <label className="form-label">
            Name:
            {editing ? (
              <input
                type="text"
                value={editedVendor.name}
                onChange={(e) => setEditedVendor({ ...editedVendor, name: e.target.value })}
                className="form-control"
              />
            ) : (
              <span>{vendorDetails?.name}</span>
            )}
          </label>
          <label className="form-label">
            Type:
            {editing ? (
              <select
                value={editedVendor.type || 'Supplier'}
                onChange={(e) => setEditedVendor({ ...editedVendor, type: e.target.value })}
                className="form-control"
              >
                <option value="Supplier">Supplier</option>
                <option value="Customer">Customer</option>
                <option value="Distributor">Distributor</option>
                <option value="Delivery">Delivery</option>
              </select>
            ) : (
              <span>{vendorDetails?.type || 'N/A'}</span>
            )}
          </label>
          <label className="form-label">
            Address:
            {editing ? (
              <textarea
                value={editedVendor.address || ''}
                onChange={(e) => setEditedVendor({ ...editedVendor, address: e.target.value })}
                className="form-control"
              />
            ) : (
              <span>{vendorDetails?.address || 'N/A'}</span>
            )}
          </label>
          <label className="form-label">
            Email:
            {editing ? (
              <input
                type="email"
                value={editedVendor.email || ''}
                onChange={(e) => setEditedVendor({ ...editedVendor, email: e.target.value })}
                className="form-control"
              />
            ) : (
              <span>{vendorDetails?.email || 'N/A'}</span>
            )}
          </label>
          <label className="form-label">
            Phone:
            {editing ? (
              <input
                type="tel"
                value={editedVendor.phone || ''}
                onChange={(e) => setEditedVendor({ ...editedVendor, phone: e.target.value })}
                className="form-control"
              />
            ) : (
              <span>{vendorDetails?.phone || 'N/A'}</span>
            )}
          </label>
          <div className="inventory-actions">
            {editing ? (
              <>
                <button onClick={handleSave} className="btn btn-primary">
                  Save
                </button>
                <button onClick={handleCancel} className="btn btn-danger">
                  Cancel
                </button>
              </>
            ) : (
              <button onClick={() => setEditing(true)} className="btn btn-primary">
                Edit
              </button>
            )}
          </div>
        </div>
      )}

      {activeTab === 'receipts' && name !== 'new' && (
        <div>
          <h3 className="app-header mb-3">Inventory Receipts</h3>
          <div className="inventory-actions mb-4">
            <button onClick={handleAddReceipt} className="btn btn-primary">
              Add Receipt
            </button>
          </div>
          <div className="inventory-table-container">
            {receipts.length > 0 ? (
              <>
                <table className="inventory-table table table-striped">
                  <thead>
                    <tr>
                      <th>Item-Lot</th>
                      <th>Type</th>
                      <th>Quantity</th>
                      <th>Date Received</th>
                    </tr>
                  </thead>
                  <tbody>
                    {receipts.map((receipt) => (
                      <tr key={getIdentifier(receipt)}>
                        <td>{getIdentifier(receipt)}</td>
                        <td>{receipt.type}</td>
                        <td>{receipt.quantity}</td>
                        <td>{receipt.receivedDate}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="vendor-receipts-list">
                  {receipts.map((receipt) => (
                    <div key={getIdentifier(receipt)} className="vendor-receipts-item card mb-2">
                      <div className="card-body">
                        <p className="card-text">
                          <strong>Item-Lot:</strong> {getIdentifier(receipt)}
                        </p>
                        <p className="card-text">
                          <strong>Type:</strong> {receipt.type}
                        </p>
                        <p className="card-text">
                          <strong>Quantity:</strong> {receipt.quantity}
                        </p>
                        <p className="card-text">
                          <strong>Date Received:</strong> {receipt.receivedDate}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="alert alert-info text-center">No receipts found.</div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'orders' && name !== 'new' && (
        <div>
          <h3 className="app-header mb-3">Purchase Orders</h3>
          <div className="inventory-actions mb-4">
            <button onClick={handleAddPurchaseOrder} className="btn btn-primary">
              Add Purchase Order
            </button>
          </div>
          <div className="inventory-table-container">
            {purchaseOrders.length > 0 ? (
              <>
                <table className="inventory-table table table-striped">
                  <thead>
                    <tr>
                      <th>PO Number</th>
                      <th>Site</th>
                      <th>PO Date</th>
                      <th>Comments</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {purchaseOrders.map((order) => (
                      <tr key={order.poNumber}>
                        <td>{order.poNumber}</td>
                        <td>{order.siteId || 'N/A'}</td>
                        <td>{order.poDate || 'N/A'}</td>
                        <td>{order.comments || 'N/A'}</td>
                        <td>
                          <button
                            onClick={() => handleEditPO(order.poNumber)}
                            className="btn btn-primary"
                          >
                            Edit
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="vendor-orders-list">
                  {purchaseOrders.map((order) => (
                    <div key={order.poNumber} className="vendor-orders-item card mb-2">
                      <div className="card-body">
                        <p className="card-text">
                          <strong>PO Number:</strong> {order.poNumber}
                        </p>
                        <p className="card-text">
                          <strong>Site:</strong> {order.siteId || 'N/A'}
                        </p>
                        <p className="card-text">
                          <strong>PO Date:</strong> {order.poDate || 'N/A'}
                        </p>
                        <p className="card-text">
                          <strong>Comments:</strong> {order.comments || 'N/A'}
                        </p>
                        <button
                          onClick={() => handleEditPO(order.poNumber)}
                          className="btn btn-primary"
                        >
                          Edit
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="alert alert-info text-center">
                No purchase orders found.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default VendorDetails;