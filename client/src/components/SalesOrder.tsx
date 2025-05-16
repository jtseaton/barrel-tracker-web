import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Customer, InventoryItem, SalesOrder } from '../types/interfaces';
import { MaterialType } from '../types/enums';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:3000';

interface SalesOrderItem {
  itemName: string;
  quantity: number;
  unit: string;
  hasKegDeposit: boolean;
}

interface NewCustomer {
  name: string;
  email: string;
  address?: string;
}

const SalesOrderComponent: React.FC<{ inventory: InventoryItem[] }> = ({ inventory }) => {
  const navigate = useNavigate();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [salesOrder, setSalesOrder] = useState<Partial<SalesOrder>>({
    customerId: 0,
    poNumber: '',
    status: 'Draft',
  });
  const [items, setItems] = useState<SalesOrderItem[]>([{ itemName: '', quantity: 0, unit: 'Units', hasKegDeposit: false }]);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [showAddCustomerModal, setShowAddCustomerModal] = useState(false);
  const [newCustomer, setNewCustomer] = useState<NewCustomer>({ name: '', email: '', address: '' });

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/customers`, { headers: { Accept: 'application/json' } });
        console.log('fetchData: /api/customers response status', res.status);
        if (!res.ok) {
          throw new Error(`Failed to fetch customers: HTTP ${res.status}`);
        }
        const data = await res.json();
        console.log('fetchData: /api/customers data', data);
        setCustomers(data);
      } catch (err: any) {
        console.error('fetchData error:', err);
        setError('Failed to load customers: ' + err.message);
      }
    };
    fetchData();
  }, []);

  const addItem = () => {
    setItems([...items, { itemName: '', quantity: 0, unit: 'Units', hasKegDeposit: false }]);
  };

  const updateItem = (index: number, field: keyof SalesOrderItem, value: any) => {
    const updatedItems = [...items];
    updatedItems[index] = { ...updatedItems[index], [field]: value };
    setItems(updatedItems);
  };

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    if (!salesOrder.customerId || items.some(item => !item.itemName || item.quantity <= 0 || !item.unit)) {
      setError('Customer and valid items are required');
      return;
    }
    try {
      const res = await fetch(`${API_BASE_URL}/api/sales-orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ ...salesOrder, items }),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Failed to save sales order: ${text}`);
      }
      const data = await res.json();
      setSuccessMessage('Sales order created successfully');
      setTimeout(() => {
        setSuccessMessage(null);
        navigate('/sales-orders');
      }, 2000);
      setError(null);
    } catch (err: any) {
      setError('Failed to save sales order: ' + err.message);
    }
  };

  const handleApprove = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/sales-orders/${salesOrder.orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ status: 'Approved' }),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Failed to approve sales order: ${text}`);
      }
      const data = await res.json();
      setSuccessMessage(`Sales order approved, invoice ${data.invoiceId} created`);
      setTimeout(() => {
        setSuccessMessage(null);
        navigate(`/invoices/${data.invoiceId}`);
      }, 2000);
      setError(null);
    } catch (err: any) {
      setError('Failed to approve sales order: ' + err.message);
    }
  };

  const handleAddCustomer = async () => {
    if (!newCustomer.name || !newCustomer.email) {
      setError('Customer name and email are required');
      return;
    }
    try {
      const res = await fetch(`${API_BASE_URL}/api/customers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ ...newCustomer, enabled: 1 }),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Failed to add customer: ${text}`);
      }
      const data = await res.json();
      console.log('handleAddCustomer: Added customer', data);
      setCustomers([...customers, data]);
      setNewCustomer({ name: '', email: '', address: '' });
      setShowAddCustomerModal(false);
      setError(null);
    } catch (err: any) {
      setError('Failed to add customer: ' + err.message);
    }
  };

  return (
    <div className="page-container">
      <h2 style={{ color: '#333', fontSize: '24px', marginBottom: '20px' }}>Create Sales Order</h2>
      {error && <div className="error">{error}</div>}
      {successMessage && <div style={{ color: '#28A745', backgroundColor: '#e6ffe6', padding: '10px', borderRadius: '4px', marginBottom: '10px', textAlign: 'center' }}>{successMessage}</div>}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '15px', maxWidth: '500px' }}>
        <div>
          <label style={{ fontWeight: 'bold', color: '#555', display: 'block', marginBottom: '5px' }}>
            Customer (required):
          </label>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <select
              value={salesOrder.customerId || ''}
              onChange={(e) => setSalesOrder({ ...salesOrder, customerId: parseInt(e.target.value) })}
              style={{ width: '100%', padding: '10px', border: '1px solid #CCCCCC', borderRadius: '4px', fontSize: '16px' }}
            >
              <option value="">Select Customer</option>
              {customers.map((customer) => (
                <option key={customer.customerId} value={customer.customerId}>{customer.name}</option>
              ))}
            </select>
            <button
              onClick={() => setShowAddCustomerModal(true)}
              style={{
                backgroundColor: '#2196F3',
                color: '#fff',
                padding: '10px 15px',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
              }}
            >
              Add Customer
            </button>
          </div>
        </div>
        {/* ... rest of the form ... */}
      </div>
      {showAddCustomerModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 2000,
          }}
        >
          <div
            style={{
              backgroundColor: '#fff',
              padding: '20px',
              borderRadius: '8px',
              width: '400px',
              boxShadow: '0 4px 8px rgba(0,0,0,0.2)',
            }}
          >
            <h3 style={{ color: '#555', marginBottom: '20px', textAlign: 'center' }}>
              Add New Customer
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '15px' }}>
              <div>
                <label style={{ fontWeight: 'bold', color: '#555', display: 'block', marginBottom: '5px' }}>
                  Name (required):
                </label>
                <input
                  type="text"
                  value={newCustomer.name}
                  onChange={(e) => setNewCustomer({ ...newCustomer, name: e.target.value })}
                  placeholder="Enter customer name"
                  style={{
                    width: '100%',
                    padding: '10px',
                    border: '1px solid #CCCCCC',
                    borderRadius: '4px',
                    fontSize: '16px',
                  }}
                />
              </div>
              <div>
                <label style={{ fontWeight: 'bold', color: '#555', display: 'block', marginBottom: '5px' }}>
                  Email (required):
                </label>
                <input
                  type="email"
                  value={newCustomer.email}
                  onChange={(e) => setNewCustomer({ ...newCustomer, email: e.target.value })}
                  placeholder="Enter customer email"
                  style={{
                    width: '100%',
                    padding: '10px',
                    border: '1px solid #CCCCCC',
                    borderRadius: '4px',
                    fontSize: '16px',
                  }}
                />
              </div>
              <div>
                <label style={{ fontWeight: 'bold', color: '#555', display: 'block', marginBottom: '5px' }}>
                  Address (optional):
                </label>
                <input
                  type="text"
                  value={newCustomer.address || ''}
                  onChange={(e) => setNewCustomer({ ...newCustomer, address: e.target.value })}
                  placeholder="Enter customer address"
                  style={{
                    width: '100%',
                    padding: '10px',
                    border: '1px solid #CCCCCC',
                    borderRadius: '4px',
                    fontSize: '16px',
                  }}
                />
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '20px' }}>
              <button
                onClick={handleAddCustomer}
                style={{
                  backgroundColor: '#2196F3',
                  color: '#fff',
                  padding: '10px 20px',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                }}
              >
                Create
              </button>
              <button
                onClick={() => {
                  setShowAddCustomerModal(false);
                  setNewCustomer({ name: '', email: '', address: '' });
                  setError(null);
                }}
                style={{
                  backgroundColor: '#F86752',
                  color: '#fff',
                  padding: '10px 20px',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SalesOrderComponent;