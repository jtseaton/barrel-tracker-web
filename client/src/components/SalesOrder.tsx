import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Customer, InventoryItem, SalesOrder } from '../types/interfaces';
import { MaterialType } from '../types/enums'; // Update import

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:3000';

interface SalesOrderItem {
  itemName: string;
  quantity: number;
  unit: string;
  hasKegDeposit: boolean;
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

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/customers`, { headers: { Accept: 'application/json' } });
        if (!res.ok) {
          throw new Error(`Failed to fetch customers: HTTP ${res.status}`);
        }
        const data = await res.json();
        setCustomers(data);
      } catch (err: any) {
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

  return (
    <div className="page-container">
      <h2>Create Sales Order</h2>
      {error && <div className="error">{error}</div>}
      {successMessage && <div style={{ color: '#28A745', backgroundColor: '#e6ffe6', padding: '10px', borderRadius: '4px', marginBottom: '10px', textAlign: 'center' }}>{successMessage}</div>}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '15px', maxWidth: '500px' }}>
        <div>
          <label style={{ fontWeight: 'bold', color: '#555' }}>Customer (required):</label>
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
        </div>
        <div>
          <label style={{ fontWeight: 'bold', color: '#555' }}>PO Number (optional):</label>
          <input
            type="text"
            value={salesOrder.poNumber || ''}
            onChange={(e) => setSalesOrder({ ...salesOrder, poNumber: e.target.value })}
            placeholder="Enter PO Number"
            style={{ width: '100%', padding: '10px', border: '1px solid #CCCCCC', borderRadius: '4px', fontSize: '16px' }}
          />
        </div>
        <div>
          <label style={{ fontWeight: 'bold', color: '#555' }}>Items (required):</label>
          {items.map((item, index) => (
            <div key={index} style={{ display: 'flex', gap: '10px', marginBottom: '10px', alignItems: 'center' }}>
              <select
                value={item.itemName}
                onChange={(e) => updateItem(index, 'itemName', e.target.value)}
                style={{ width: '200px', padding: '10px', border: '1px solid #CCCCCC', borderRadius: '4px', fontSize: '16px' }}
              >
                <option value="">Select Item</option>
                {inventory.filter(i => i.type === MaterialType.FinishedGoods || i.type === MaterialType.Marketing).map((inv) => (
    <option key={inv.identifier} value={inv.identifier}>{inv.identifier}</option>
  ))}
              </select>
              <input
                type="number"
                value={item.quantity || ''}
                onChange={(e) => updateItem(index, 'quantity', parseInt(e.target.value) || 0)}
                placeholder="Quantity"
                min="0"
                style={{ width: '100px', padding: '10px', border: '1px solid #CCCCCC', borderRadius: '4px', fontSize: '16px' }}
              />
              <select
                value={item.unit}
                onChange={(e) => updateItem(index, 'unit', e.target.value)}
                style={{ width: '100px', padding: '10px', border: '1px solid #CCCCCC', borderRadius: '4px', fontSize: '16px' }}
              >
                <option value="Units">Units</option>
                <option value="Kegs">Kegs</option>
                <option value="Bottles">Bottles</option>
                <option value="Cans">Cans</option>
              </select>
              <label>
                <input
                  type="checkbox"
                  checked={item.hasKegDeposit}
                  onChange={(e) => updateItem(index, 'hasKegDeposit', e.target.checked)}
                />
                Keg Deposit
              </label>
              <button
                onClick={() => removeItem(index)}
                style={{ backgroundColor: '#F86752', color: '#fff', padding: '8px 12px', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
              >
                Remove
              </button>
            </div>
          ))}
          <button
            onClick={addItem}
            style={{ backgroundColor: '#2196F3', color: '#fff', padding: '8px 12px', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
          >
            Add Item
          </button>
        </div>
      </div>
      <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
        <button
          onClick={handleSave}
          style={{ backgroundColor: '#2196F3', color: '#fff', padding: '10px 20px', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
        >
          Save Sales Order
        </button>
        <button
          onClick={handleApprove}
          disabled={!salesOrder.orderId}
          style={{
            backgroundColor: salesOrder.orderId ? '#28A745' : '#ccc',
            color: '#fff',
            padding: '10px 20px',
            border: 'none',
            borderRadius: '4px',
            cursor: salesOrder.orderId ? 'pointer' : 'not-allowed',
          }}
        >
          Approve Sales Order
        </button>
        <button
          onClick={() => navigate('/sales-orders')}
          style={{ backgroundColor: '#F86752', color: '#fff', padding: '10px 20px', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
};

export default SalesOrderComponent;