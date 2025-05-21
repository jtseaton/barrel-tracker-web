import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Customer, InventoryItem, SalesOrder, SalesOrderItem } from '../types/interfaces';
import { MaterialType } from '../types/enums';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:3000';

interface NewCustomer {
  name: string;
  email: string;
  address?: string;
}

interface PackageType {
  type: string;
  price: string;
  isKegDepositItem: boolean;
}

interface Product {
  id: number;
  name: string;
  packageTypes: PackageType[];
}

const SalesOrderComponent: React.FC<{ inventory: InventoryItem[] }> = ({ inventory }) => {
  const navigate = useNavigate();
  const { orderId } = useParams<{ orderId: string }>();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [salesOrder, setSalesOrder] = useState<Partial<SalesOrder>>({
    customerId: 0,
    poNumber: '',
    status: 'Draft',
  });
  const [items, setItems] = useState<SalesOrderItem[]>([
    { itemName: '', quantity: 0, unit: 'Units', hasKegDeposit: false, price: '0.00' },
  ]);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [showAddCustomerModal, setShowAddCustomerModal] = useState(false);
  const [newCustomer, setNewCustomer] = useState<NewCustomer>({ name: '', email: '', address: '' });

  const fetchProductByName = async (productName: string): Promise<Product | null> => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/products?name=${encodeURIComponent(productName)}`, {
        headers: { Accept: 'application/json' },
      });
      if (!res.ok) {
        throw new Error(`Failed to fetch product: HTTP ${res.status}`);
      }
      const data = await res.json();
      return Array.isArray(data) && data.length > 0 ? data[0] : null;
    } catch (err) {
      console.error('Fetch product error:', err);
      return null;
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch customers
        const customerRes = await fetch(`${API_BASE_URL}/api/customers`, {
          headers: { Accept: 'application/json' },
        });
        if (!customerRes.ok) {
          throw new Error(`Failed to fetch customers: HTTP ${customerRes.status}`);
        }
        const customerData = await customerRes.json();
        setCustomers(customerData);

        // Fetch products
        const productRes = await fetch(`${API_BASE_URL}/api/products`, {
          headers: { Accept: 'application/json' },
        });
        if (!productRes.ok) {
          throw new Error(`Failed to fetch products: HTTP ${productRes.status}`);
        }
        const productData = await productRes.json();
        setProducts(productData);
      } catch (err: any) {
        setError('Failed to load data: ' + err.message);
      }
    };
    fetchData();

    if (orderId) {
      const fetchOrder = async () => {
        try {
          const res = await fetch(`${API_BASE_URL}/api/sales-orders/${orderId}`, {
            headers: { Accept: 'application/json' },
          });
          if (!res.ok) {
            throw new Error(`Failed to fetch sales order: HTTP ${res.status}`);
          }
          const data = await res.json();
          setSalesOrder(data);
          setItems(
            data.items.map((item: SalesOrderItem) => ({
              ...item,
              price: item.price || '0.00',
            })) || [{ itemName: '', quantity: 0, unit: 'Units', hasKegDeposit: false, price: '0.00' }]
          );
        } catch (err: any) {
          setError('Failed to load sales order: ' + err.message);
        }
      };
      fetchOrder();
    }
  }, [orderId]);

  const addItem = () => {
    setItems([...items, { itemName: '', quantity: 0, unit: 'Units', hasKegDeposit: false, price: '0.00' }]);
  };

  const updateItem = async (index: number, field: keyof SalesOrderItem, value: any) => {
    const updatedItems = [...items];
    updatedItems[index] = { ...updatedItems[index], [field]: value };

    if (field === 'itemName' && typeof value === 'string') {
      // Split itemName into product name and package type
      const parts = value.trim().split(' ');
      let packageType: string = '';
      let productName: string = '';

      if (parts.length >= 3 && parts[parts.length - 1].toLowerCase() === 'keg') {
        packageType = parts.slice(-3).join(' ').replace(/\s*\/\s*/, '/');
        productName = parts.slice(0, -3).join(' ');
      } else {
        packageType = parts.slice(-2).join(' ').replace(/\s*\/\s*/, '/');
        productName = parts.slice(0, -2).join(' ');
      }

      // Find product and package type
      const product = products.find(p => p.name === productName);
      if (product && packageType) {
        const pkg = product.packageTypes?.find(pt => pt.type === packageType);
        if (pkg) {
          updatedItems[index].price = pkg.price;
          updatedItems[index].hasKegDeposit = !!pkg.isKegDepositItem;
          updatedItems[index].unit = 'Units';
        } else {
          updatedItems[index].price = '0.00';
          updatedItems[index].hasKegDeposit = false;
          updatedItems[index].unit = 'Units';
        }
      } else {
        const invItem = inventory.find(i => i.identifier === value && i.type === MaterialType.FinishedGoods);
        if (invItem && invItem.price) {
          updatedItems[index].price = invItem.price;
          updatedItems[index].hasKegDeposit = invItem.isKegDepositItem === 1; // Fixed: Safe comparison
          updatedItems[index].unit = 'Units';
        } else {
          updatedItems[index].price = '0.00';
          updatedItems[index].hasKegDeposit = false;
          updatedItems[index].unit = 'Units';
        }
      }
    } else if (field === 'price' && typeof value === 'string') {
      updatedItems[index].price = value;
    } else if (field === 'hasKegDeposit' && typeof value === 'boolean') {
      updatedItems[index].hasKegDeposit = value;
    }

    setItems(updatedItems);
  };

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    if (
      !salesOrder.customerId ||
      items.some(
        (item) =>
          !item.itemName ||
          item.quantity <= 0 ||
          !item.unit ||
          !item.price ||
          isNaN(parseFloat(item.price)) ||
          parseFloat(item.price) < 0
      )
    ) {
      setError('Customer and valid items with prices are required');
      return;
    }
    try {
      const method = orderId ? 'PATCH' : 'POST';
      const url = orderId ? `${API_BASE_URL}/api/sales-orders/${orderId}` : `${API_BASE_URL}/api/sales-orders`;
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          ...salesOrder,
          items: items.map(item => ({
            itemName: item.itemName,
            quantity: item.quantity,
            unit: item.unit,
            price: item.price,
            hasKegDeposit: item.hasKegDeposit ? 1 : 0 // Convert boolean to number for backend
          }))
        })
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Failed to save sales order: ${text}`);
      }
      const data = await res.json();
      setSalesOrder(data);
      setItems(
        data.items.map((item: SalesOrderItem) => ({
          ...item,
          price: item.price || '0.00',
          hasKegDeposit: !!item.hasKegDeposit // Convert number to boolean
        })) || [{ itemName: '', quantity: 0, unit: 'Units', hasKegDeposit: false, price: '0.00' }]
      );
      setSuccessMessage(`Sales order ${orderId ? 'updated' : 'created'} successfully`);
      setTimeout(() => {
        setSuccessMessage(null);
        navigate(`/sales-orders/${data.orderId || orderId}`);
      }, 2000);
      setError(null);
    } catch (err: any) {
      setError('Failed to save sales order: ' + err.message);
    }
  };

  const handleApprove = async () => {
    if (!salesOrder.orderId || !salesOrder.customerId || !items.length) {
      setError('Cannot approve: Missing order ID, customer, or items');
      return;
    }
    try {
      const res = await fetch(`${API_BASE_URL}/api/sales-orders/${salesOrder.orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          customerId: salesOrder.customerId,
          poNumber: salesOrder.poNumber || null,
          items: items.map(item => ({
            itemName: item.itemName,
            quantity: item.quantity,
            unit: item.unit,
            price: item.price,
            hasKegDeposit: item.hasKegDeposit ? 1 : 0 // Convert boolean to number for backend
          })),
          status: 'Approved'
        })
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
      <h2 style={{ color: '#EEC930', fontSize: '24px', marginBottom: '20px' }}>
        {orderId ? `Sales Order ${orderId}` : 'Create Sales Order'}
      </h2>
      {error && <div className="error">{error}</div>}
      {successMessage && (
        <div
          style={{
            color: '#28A745',
            backgroundColor: '#e6ffe6',
            padding: '10px',
            borderRadius: '4px',
            marginBottom: '10px',
            textAlign: 'center',
          }}
        >
          {successMessage}
        </div>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '15px', maxWidth: '600px' }}>
        <div>
          <label style={{ fontWeight: 'bold', color: '#EEC930', display: 'block', marginBottom: '5px' }}>
            Customer (required):
          </label>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <select
              value={salesOrder.customerId || ''}
              onChange={(e) => setSalesOrder({ ...salesOrder, customerId: parseInt(e.target.value) })}
              style={{ width: '100%', padding: '10px', border: '1px solid #CCCCCC', borderRadius: '4px', fontSize: '16px' }}
              disabled={salesOrder.status === 'Approved'}
            >
              <option value="">Select Customer</option>
              {customers.map((customer) => (
                <option key={customer.customerId} value={customer.customerId}>
                  {customer.name}
                </option>
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
              disabled={salesOrder.status === 'Approved'}
            >
              Add Customer
            </button>
          </div>
        </div>
        <div>
          <label style={{ fontWeight: 'bold', color: '#EEC930', display: 'block', marginBottom: '5px' }}>
            PO Number (optional):
          </label>
          <input
            type="text"
            value={salesOrder.poNumber || ''}
            onChange={(e) => setSalesOrder({ ...salesOrder, poNumber: e.target.value })}
            placeholder="Enter PO Number"
            style={{ width: '100%', padding: '10px', border: '1px solid #CCCCCC', borderRadius: '4px', fontSize: '16px' }}
            disabled={salesOrder.status === 'Approved'}
          />
        </div>
        <div>
          <label style={{ fontWeight: 'bold', color: '#EEC930', display: 'block', marginBottom: '5px' }}>
            Items (required):
          </label>
          {items.map((item, index) => {
            const selectedItem = inventory.find((inv) => inv.identifier === item.itemName);
            return (
              <div key={index} style={{ display: 'flex', gap: '10px', marginBottom: '10px', alignItems: 'center' }}>
                <select
                  value={item.itemName}
                  onChange={(e) => updateItem(index, 'itemName', e.target.value)}
                  style={{ width: '200px', padding: '10px', border: '1px solid #CCCCCC', borderRadius: '4px', fontSize: '16px' }}
                  disabled={salesOrder.status === 'Approved'}
                >
                  <option value="">Select Item</option>
                  {products.map(p => p.packageTypes.map(pt => (
                    <option key={`${p.name} ${pt.type}`} value={`${p.name} ${pt.type}`}>
                      {`${p.name} ${pt.type}`}
                    </option>
                  )))}
                </select>
                <input
                  type="number"
                  value={item.quantity || ''}
                  onChange={(e) => updateItem(index, 'quantity', parseInt(e.target.value) || 0)}
                  placeholder="Quantity"
                  min="0"
                  style={{ width: '100px', padding: '10px', border: '1px solid #CCCCCC', borderRadius: '4px', fontSize: '16px' }}
                  disabled={salesOrder.status === 'Approved'}
                />
                <select
                  value={item.unit}
                  onChange={(e) => updateItem(index, 'unit', e.target.value)}
                  style={{ width: '100px', padding: '10px', border: '1px solid #CCCCCC', borderRadius: '4px', fontSize: '16px' }}
                  disabled={salesOrder.status === 'Approved'}
                >
                  <option value="Units">Units</option>
                  <option value="Kegs">Kegs</option>
                  <option value="Bottles">Bottles</option>
                  <option value="Cans">Cans</option>
                </select>
                <input
                  type="number"
                  value={parseFloat(item.price)}
                  onChange={(e) => updateItem(index, 'price', e.target.value)}
                  placeholder="Price"
                  step="0.01"
                  min="0"
                  style={{ width: '100px', padding: '10px', border: '1px solid #CCCCCC', borderRadius: '4px', fontSize: '16px' }}
                  disabled={salesOrder.status === 'Approved'}
                />
                <label>
                  <input
                    type="checkbox"
                    checked={item.hasKegDeposit}
                    onChange={(e) => updateItem(index, 'hasKegDeposit', e.target.checked)}
                    disabled={salesOrder.status === 'Approved'}
                  />
                  Keg Deposit
                </label>
                <button
                  onClick={() => removeItem(index)}
                  style={{
                    backgroundColor: '#F86752',
                    color: '#fff',
                    padding: '8px 12px',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                  }}
                  disabled={salesOrder.status === 'Approved'}
                >
                  Remove
                </button>
              </div>
            );
          })}
          <button
            onClick={addItem}
            style={{
              backgroundColor: '#2196F3',
              color: '#fff',
              padding: '8px 12px',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
            }}
            disabled={salesOrder.status === 'Approved'}
          >
            Add Item
          </button>
        </div>
      </div>
      <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
        <button
          onClick={handleSave}
          style={{
            backgroundColor: '#2196F3',
            color: '#fff',
            padding: '10px 20px',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
          }}
          disabled={salesOrder.status === 'Approved'}
        >
          Save Sales Order
        </button>
        {salesOrder.orderId && salesOrder.status !== 'Approved' && (
          <button
            onClick={handleApprove}
            style={{
              backgroundColor: '#28A745',
              color: '#fff',
              padding: '10px 20px',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
            }}
          >
            Approve Sales Order
          </button>
        )}
        <button
          onClick={() => navigate('/sales-orders')}
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