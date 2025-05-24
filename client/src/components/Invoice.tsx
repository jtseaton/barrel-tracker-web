import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { InventoryItem, Invoice, InvoiceItem } from '../types/interfaces';
import { MaterialType } from '../types/enums';
import QRScanner from './QRScanner'; // Added for keg scanning
import '../App.css';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:3000';

// Added interface to extend InvoiceItem with kegCodes
interface ExtendedInvoiceItem extends InvoiceItem {
  kegCodes?: string[];
}

const InvoiceComponent: React.FC<{ inventory: InventoryItem[], refreshInventory: () => Promise<void> }> = ({
  inventory,
  refreshInventory,
}) => {
  const { invoiceId } = useParams<{ invoiceId: string }>();
  const navigate = useNavigate();
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [items, setItems] = useState<ExtendedInvoiceItem[]>([]); // Updated to use ExtendedInvoiceItem
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  // Added states for keg scanning
  const [kegScanning, setKegScanning] = useState<{ itemIndex: number | null; kegCodes: string[] }>({ itemIndex: null, kegCodes: [] });
  const [currentKegCode, setCurrentKegCode] = useState('');
  const [manualKegEntry, setManualKegEntry] = useState(false);

  useEffect(() => {
    const fetchInvoice = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/invoices/${invoiceId}`, {
          headers: { Accept: 'application/json' },
        });
        if (!res.ok) {
          throw new Error(`Failed to fetch invoice: HTTP ${res.status}`);
        }
        const data = await res.json();
        setInvoice(data);
        setItems(
          data.items && Array.isArray(data.items)
            ? data.items.map((item: InvoiceItem) => ({
                ...item,
                price: item.price || '0.00',
                hasKegDeposit: !!item.hasKegDeposit,
                kegCodes: item.kegCodes || [], // Added kegCodes
                kegDeposit: item.kegDeposit ? {
                  ...item.kegDeposit,
                  price: item.kegDeposit.price || '0.00',
                  hasKegDeposit: !!item.kegDeposit.hasKegDeposit,
                  isSubCharge: item.kegDeposit.isSubCharge || false,
                } : null,
              }))
            : []
        );
      } catch (err: any) {
        setError('Failed to load invoice: ' + err.message);
      }
    };
    fetchInvoice();
  }, [invoiceId]);

  const addItem = () => {
    setItems([...items, { itemName: '', quantity: 0, unit: 'Units', hasKegDeposit: false, price: '0.00', kegCodes: [] }]);
  };

  const updateItem = (index: number, field: keyof ExtendedInvoiceItem, value: any) => {
    const updatedItems = [...items];
    updatedItems[index] = { ...updatedItems[index], [field]: value };
    if (field === 'itemName') {
      const selectedItem = inventory.find((inv) => inv.identifier === value);
      if (selectedItem) {
        updatedItems[index].price = selectedItem.price || '0.00';
        updatedItems[index].hasKegDeposit = selectedItem.isKegDepositItem === 1;
      }
    } else if (field === 'hasKegDeposit') {
      updatedItems[index].hasKegDeposit = value;
      if (!value) {
        updatedItems[index].kegCodes = []; // Clear kegCodes if hasKegDeposit is unchecked
      }
    }
    setItems(updatedItems);
  };

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  // Added function to handle adding a scanned or manually entered keg code
  const handleAddKegCode = async (index: number) => {
    if (!currentKegCode || !/^[A-Z0-9-]+$/.test(currentKegCode)) {
      setError('Valid keg code (e.g., KEG-001) required');
      return;
    }
    try {
      const res = await fetch(`${API_BASE_URL}/api/kegs/${currentKegCode}`, { headers: { Accept: 'application/json' } });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Keg not found: HTTP ${res.status}, ${text}`);
      }
      const keg = await res.json();
      if (keg.status !== 'Filled') {
        setError(`Keg ${currentKegCode} is not filled (status: ${keg.status})`);
        return;
      }
      // Verify product matches
      const item = items[index];
      const parts = item.itemName.trim().split(' ');
      const productName = parts.slice(0, -3).join(' ');
      const productRes = await fetch(`${API_BASE_URL}/api/products?name=${encodeURIComponent(productName)}`, {
        headers: { Accept: 'application/json' },
      });
      if (!productRes.ok) {
        throw new Error(`Failed to fetch product: HTTP ${productRes.status}`);
      }
      const productData = await productRes.json();
      const product = Array.isArray(productData) && productData.length > 0 ? productData[0] : null;
      if (!product || keg.productId !== product.id) {
        setError(`Keg ${currentKegCode} does not contain ${productName}`);
        return;
      }
      if (kegScanning.kegCodes.includes(currentKegCode)) {
        setError(`Keg ${currentKegCode} already added`);
        return;
      }
      const updatedKegCodes = [...kegScanning.kegCodes, currentKegCode];
      setKegScanning({ ...kegScanning, kegCodes: updatedKegCodes });
      setCurrentKegCode('');
      setError(null);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      console.error('Add keg code error:', err);
      setError('Failed to add keg: ' + errorMessage);
    }
  };

  // Added function to save scanned keg codes
  const saveKegCodes = () => {
    if (kegScanning.itemIndex === null) return;
    const updatedItems = [...items];
    updatedItems[kegScanning.itemIndex].kegCodes = kegScanning.kegCodes;
    setItems(updatedItems);
    setKegScanning({ itemIndex: null, kegCodes: [] });
    setCurrentKegCode('');
    setManualKegEntry(false);
    setSuccessMessage('Keg codes saved');
    setTimeout(() => setSuccessMessage(null), 2000);
  };

  const handleSave = async () => {
    // Added validation for keg codes
    for (const item of items) {
      if (item.hasKegDeposit && (!item.kegCodes || item.kegCodes.length !== item.quantity)) {
        setError(`Item ${item.itemName} requires ${item.quantity} keg codes`);
        return;
      }
    }
    try {
      console.log('handleSave: Saving invoice', { invoiceId, items });
      const res = await fetch(`${API_BASE_URL}/api/invoices/${invoiceId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          items: items.map(({ id, itemName, quantity, unit, price, hasKegDeposit, kegCodes }) => ({
            id,
            itemName,
            quantity,
            unit,
            price,
            hasKegDeposit,
            kegCodes, // Added kegCodes
          })),
        }),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Failed to save invoice: ${text}`);
      }
      const updatedInvoice = await res.json();
      console.log('handleSave: Invoice saved successfully', updatedInvoice);
      setInvoice(updatedInvoice);
      setItems(
        updatedInvoice.items && Array.isArray(updatedInvoice.items)
          ? updatedInvoice.items.map((item: InvoiceItem) => ({
              ...item,
              price: item.price || '0.00',
              hasKegDeposit: !!item.hasKegDeposit,
              kegCodes: item.kegCodes || [], // Added kegCodes
              kegDeposit: item.kegDeposit ? {
                ...item.kegDeposit,
                price: item.kegDeposit.price || '0.00',
                hasKegDeposit: !!item.kegDeposit.hasKegDeposit,
                isSubCharge: item.kegDeposit.isSubCharge || false,
              } : null,
            }))
          : []
      );
      setSuccessMessage('Invoice saved successfully');
      setTimeout(() => setSuccessMessage(null), 2000);
      setError(null);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      console.error('handleSave: Error', { invoiceId, error: errorMessage });
      setError('Failed to save invoice: ' + errorMessage);
    }
  };

  const handlePost = async () => {
    // Added validation for keg codes
    for (const item of items) {
      if (item.hasKegDeposit && (!item.kegCodes || item.kegCodes.length !== item.quantity)) {
        setError(`Item ${item.itemName} requires ${item.quantity} keg codes`);
        return;
      }
    }
    try {
      const res = await fetch(`${API_BASE_URL}/api/invoices/${invoiceId}/post`, {
        method: 'POST',
        headers: { Accept: 'application/json' },
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Failed to post invoice: ${text}`);
      }
      const data = await res.json();
      await refreshInventory();
      setInvoice((prev) =>
        prev
          ? {
              ...prev,
              status: 'Posted',
              postedDate: new Date().toISOString().split('T')[0],
              total: data.total,
              subtotal: data.subtotal,
              keg_deposit_total: data.keg_deposit_total,
            }
          : null
      );
      setItems(
        data.items && Array.isArray(data.items)
          ? data.items.map((item: InvoiceItem) => ({
              ...item,
              price: item.price || '0.00',
              hasKegDeposit: !!item.hasKegDeposit,
              kegCodes: item.kegCodes || [], // Added kegCodes
              kegDeposit: item.kegDeposit ? {
                ...item.kegDeposit,
                price: item.kegDeposit.price || '0.00',
                hasKegDeposit: !!item.kegDeposit.hasKegDeposit,
                isSubCharge: item.kegDeposit.isSubCharge || false,
              } : null,
            }))
          : items
      );
      setSuccessMessage('Invoice posted successfully');
      setTimeout(() => setSuccessMessage(null), 2000);
      setError(null);
    } catch (err: any) {
      setError('Failed to post invoice: ' + err.message);
    }
  };

  const handleEmail = async () => {
    try {
      console.log('handleEmail: Sending email for invoice', { invoiceId });
      const res = await fetch(`${API_BASE_URL}/api/invoices/${invoiceId}/email`, {
        method: 'POST',
        headers: { Accept: 'application/json' },
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Failed to send email: ${text}`);
      }
      console.log('handleEmail: Email sent successfully', { invoiceId });
      setSuccessMessage('Email sent successfully');
      setTimeout(() => setSuccessMessage(null), 2000);
      setError(null);
      const refreshRes = await fetch(`${API_BASE_URL}/api/invoices/${invoiceId}`, {
        headers: { Accept: 'application/json' },
      });
      if (!refreshRes.ok) {
        throw new Error(`Failed to refresh invoice: HTTP ${refreshRes.status}`);
      }
      const refreshedInvoice = await refreshRes.json();
      console.log('handleEmail: Refreshed invoice data', {
        invoiceId,
        total: refreshedInvoice.total,
        subtotal: refreshedInvoice.subtotal,
        keg_deposit_total: refreshedInvoice.keg_deposit_total,
        items: refreshedInvoice.items,
      });
      setInvoice(refreshedInvoice);
      setItems(
        refreshedInvoice.items && Array.isArray(refreshedInvoice.items)
          ? refreshedInvoice.items.map((item: InvoiceItem) => ({
              ...item,
              price: item.price || '0.00',
              hasKegDeposit: !!item.hasKegDeposit,
              kegCodes: item.kegCodes || [], // Added kegCodes
              kegDeposit: item.kegDeposit ? {
                ...item.kegDeposit,
                price: item.kegDeposit.price || '0.00',
                hasKegDeposit: !!item.kegDeposit.hasKegDeposit,
                isSubCharge: item.kegDeposit.isSubCharge || false,
              } : null,
            }))
          : items
      );
    } catch (err: any) {
      console.error('handleEmail: Error', { invoiceId, error: err.message });
      setError('Failed to send email: ' + err.message);
    }
  };

  if (!invoice) return <div>Loading...</div>;

  return (
    <div className="page-container">
      <h2 style={{ color: '#EEC930', fontSize: '24px', marginBottom: '20px' }}>
        Invoice {invoice.invoiceId}
      </h2>
      {error && <div className="error">{error}</div>}
      {successMessage && (
        <div className="error" style={{ color: '#28A745', backgroundColor: '#e6ffe6' }}>
          {successMessage}
        </div>
      )}
      <div style={{ marginBottom: '20px' }}>
        <p><strong>Customer:</strong> {invoice.customerName}</p>
        <p><strong>Email:</strong> {invoice.customerEmail}</p>
        <p><strong>Status:</strong> {invoice.status}</p>
        <p><strong>Created Date:</strong> {invoice.createdDate}</p>
        {invoice.postedDate && <p><strong>Posted Date:</strong> {invoice.postedDate}</p>}
        {invoice.total && <p><strong>Total:</strong> ${parseFloat(invoice.total).toFixed(2)}</p>}
      </div>
      <h3 style={{ color: '#EEC930', marginBottom: '10px' }}>Items</h3>
      {invoice.status === 'Draft' ? (
        <>
          <table className="inventory-table">
            <thead>
              <tr>
                <th>Item</th>
                <th>Quantity</th>
                <th>Unit</th>
                <th>Price</th>
                <th>Subtotal</th>
                <th>Keg Deposit</th>
                <th>Keg Codes</th> {/* Added column for keg codes */}
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, index) => (
                <React.Fragment key={index}>
                  <tr>
                    <td>
                      <select
                        value={item.itemName}
                        onChange={(e: React.ChangeEvent<HTMLSelectElement>) => updateItem(index, 'itemName', e.target.value)}
                        style={{ width: '200px', padding: '10px', border: '1px solid #CCCCCC', borderRadius: '4px', fontSize: '16px' }}
                        disabled={kegScanning.itemIndex === index}
                      >
                        <option value="">Select Item</option>
                        {inventory
                          .filter((i) => (i.type === MaterialType.FinishedGoods || i.type === MaterialType.Marketing) && i.identifier !== 'Keg Deposit')
                          .map((inv) => (
                            <option key={inv.identifier} value={inv.identifier}>
                              {inv.identifier}
                            </option>
                          ))}
                      </select>
                    </td>
                    <td>
                      <input
                        type="number"
                        value={item.quantity || ''}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateItem(index, 'quantity', parseInt(e.target.value) || 0)}
                        placeholder="Quantity"
                        min="0"
                        style={{ width: '100px', padding: '10px', border: '1px solid #CCCCCC', borderRadius: '4px', fontSize: '16px' }}
                        disabled={kegScanning.itemIndex === index}
                      />
                    </td>
                    <td>
                      <select
                        value={item.unit}
                        onChange={(e: React.ChangeEvent<HTMLSelectElement>) => updateItem(index, 'unit', e.target.value)}
                        style={{ width: '100px', padding: '10px', border: '1px solid #CCCCCC', borderRadius: '4px', fontSize: '16px' }}
                        disabled={kegScanning.itemIndex === index}
                      >
                        <option value="Units">Units</option>
                        <option value="Kegs">Kegs</option>
                        <option value="Bottles">Bottles</option>
                        <option value="Cans">Cans</option>
                      </select>
                    </td>
                    <td>
                      <input
                        type="number"
                        value={parseFloat(item.price)}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateItem(index, 'price', e.target.value)}
                        placeholder="Price"
                        step="0.01"
                        min="0"
                        style={{ width: '100px', padding: '10px', border: '1px solid #CCCCCC', borderRadius: '4px', fontSize: '16px' }}
                        disabled={kegScanning.itemIndex === index}
                      />
                    </td>
                    <td>${(parseFloat(item.price) * item.quantity).toFixed(2)}</td>
                    <td>
                      <label>
                        <input
                          type="checkbox"
                          checked={item.hasKegDeposit}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateItem(index, 'hasKegDeposit', e.target.checked)}
                          disabled={kegScanning.itemIndex === index}
                        />
                        Keg Deposit
                      </label>
                    </td>
                    <td>
                      {item.hasKegDeposit && (
                        <button
                          onClick={() => setKegScanning({ itemIndex: index, kegCodes: item.kegCodes || [] })}
                          style={{
                            backgroundColor: '#2196F3',
                            color: '#fff',
                            padding: '8px 12px',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer',
                          }}
                          disabled={kegScanning.itemIndex !== null}
                        >
                          {item.kegCodes && item.kegCodes.length > 0 ? `Edit Kegs (${item.kegCodes.length})` : 'Scan Kegs'}
                        </button>
                      )}
                      {item.kegCodes && item.kegCodes.length > 0 && (
                        <p style={{ marginTop: '5px' }}>{item.kegCodes.join(', ')}</p>
                      )}
                    </td>
                    <td>
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
                        disabled={kegScanning.itemIndex === index}
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                  {item.kegDeposit && (
                    <tr>
                      <td style={{ paddingLeft: '30px' }}>Keg Deposit (Sub-Charge)</td>
                      <td>{item.kegDeposit.quantity}</td>
                      <td>{item.kegDeposit.unit}</td>
                      <td>${parseFloat(item.kegDeposit.price).toFixed(2)}</td>
                      <td>${(parseFloat(item.kegDeposit.price) * item.kegDeposit.quantity).toFixed(2)}</td>
                      <td></td>
                      <td></td>
                      <td></td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
          <button
            onClick={addItem}
            style={{
              backgroundColor: '#2196F3',
              color: '#fff',
              padding: '8px 12px',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              marginTop: '10px',
            }}
            disabled={kegScanning.itemIndex !== null}
          >
            Add Item
          </button>
        </>
      ) : (
        <table className="inventory-table">
          <thead>
            <tr>
              <th>Item</th>
              <th>Quantity</th>
              <th>Unit</th>
              <th>Price</th>
              <th>Subtotal</th>
              <th>Keg Codes</th> {/* Added column for keg codes */}
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <React.Fragment key={item.id || `${item.itemName}-${item.quantity}`}>
                <tr>
                  <td>{item.itemName || 'Unknown'}</td>
                  <td>{item.quantity}</td>
                  <td>{item.unit}</td>
                  <td>${parseFloat(item.price).toFixed(2)}</td>
                  <td>${(parseFloat(item.price) * item.quantity).toFixed(2)}</td>
                  <td>{item.kegCodes && item.kegCodes.length > 0 ? item.kegCodes.join(', ') : '-'}</td>
                </tr>
                {item.kegDeposit && (
                  <tr>
                    <td style={{ paddingLeft: '30px' }}>Keg Deposit (Sub-Charge)</td>
                    <td>{item.kegDeposit.quantity}</td>
                    <td>{item.kegDeposit.unit}</td>
                    <td>${parseFloat(item.kegDeposit.price).toFixed(2)}</td>
                    <td>${(parseFloat(item.kegDeposit.price) * item.kegDeposit.quantity).toFixed(2)}</td>
                    <td>-</td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      )}
      {invoice.status !== 'Draft' && (
        <div style={{ marginTop: '20px' }}>
          <p><strong>Subtotal:</strong> ${invoice.subtotal ? parseFloat(invoice.subtotal).toFixed(2) : '0.00'}</p>
          <p><strong>Keg Deposit Total:</strong> ${invoice.keg_deposit_total ? parseFloat(invoice.keg_deposit_total).toFixed(2) : '0.00'}</p>
          <p><strong>Invoice Total:</strong> ${invoice.total ? parseFloat(invoice.total).toFixed(2) : '0.00'}</p>
        </div>
      )}
      <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
        {invoice.status === 'Draft' && (
          <>
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
              disabled={kegScanning.itemIndex !== null}
            >
              Save Invoice
            </button>
            <button
              onClick={handlePost}
              style={{
                backgroundColor: '#28A745',
                color: '#fff',
                padding: '10px 20px',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
              }}
              disabled={kegScanning.itemIndex !== null}
            >
              Post Invoice
            </button>
          </>
        )}
        <button
          onClick={handleEmail}
          style={{
            backgroundColor: '#2196F3',
            color: '#fff',
            padding: '10px 20px',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
          }}
          disabled={kegScanning.itemIndex !== null}
        >
          Email Invoice
        </button>
        <button
          onClick={() => navigate('/invoices')}
          style={{
            backgroundColor: '#F86752',
            color: '#fff',
            padding: '10px 20px',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
          }}
          disabled={kegScanning.itemIndex !== null}
        >
          Cancel
        </button>
      </div>
      {/* Added modal for keg scanning */}
      {kegScanning.itemIndex !== null && (
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
            zIndex: 2100,
          }}
        >
          <div
            style={{
              backgroundColor: '#fff',
              padding: '20px',
              borderRadius: '8px',
              width: '400px',
              boxShadow: '0 4px 8px rgba(0,0,0,0.2)',
              textAlign: 'center',
              color: '#555',
            }}
          >
            <h3 style={{ color: '#555', marginBottom: '20px' }}>
              Scan Kegs for {items[kegScanning.itemIndex].itemName}
            </h3>
            {manualKegEntry ? (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '15px' }}>
                <div>
                  <label style={{ fontWeight: 'bold', color: '#555', display: 'block', marginBottom: '5px' }}>
                    Keg Code:
                  </label>
                  <input
                    type="text"
                    value={currentKegCode}
                    onChange={(e) => setCurrentKegCode(e.target.value)}
                    placeholder="Enter keg code (e.g., KEG-001)"
                    style={{
                      width: '100%',
                      padding: '10px',
                      border: '1px solid #CCCCCC',
                      borderRadius: '4px',
                      fontSize: '16px',
                    }}
                  />
                </div>
                {kegScanning.kegCodes.length > 0 && (
                  <div>
                    <p><strong>Scanned Kegs:</strong> {kegScanning.kegCodes.join(', ')}</p>
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-around', marginTop: '20px' }}>
                  <button
                    onClick={() => handleAddKegCode(kegScanning.itemIndex!)}
                    style={{
                      backgroundColor: '#2196F3',
                      color: '#fff',
                      padding: '10px 20px',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '16px',
                    }}
                  >
                    Add Keg
                  </button>
                  <button
                    onClick={saveKegCodes}
                    style={{
                      backgroundColor: '#28A745',
                      color: '#fff',
                      padding: '10px 20px',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '16px',
                    }}
                  >
                    Save
                  </button>
                  <button
                    onClick={() => {
                      setKegScanning({ itemIndex: null, kegCodes: [] });
                      setCurrentKegCode('');
                      setManualKegEntry(false);
                      setError(null);
                    }}
                    style={{
                      backgroundColor: '#F86752',
                      color: '#fff',
                      padding: '10px 20px',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '16px',
                    }}
                  >
                    Cancel
                  </button>
                </div>
                <button
                  onClick={() => setManualKegEntry(false)}
                  style={{
                    backgroundColor: '#2196F3',
                    color: '#fff',
                    padding: '10px 20px',
                    marginTop: '10px',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                  }}
                >
                  Use Camera
                </button>
              </div>
            ) : (
              <div>
                <QRScanner
                  onScan={(code) => {
                    setCurrentKegCode(code);
                    handleAddKegCode(kegScanning.itemIndex!);
                  }}
                  onError={(error) => setError(error)}
                />
                {kegScanning.kegCodes.length > 0 && (
                  <div style={{ marginTop: '10px' }}>
                    <p><strong>Scanned Kegs:</strong> {kegScanning.kegCodes.join(', ')}</p>
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-around', marginTop: '20px' }}>
                  <button
                    onClick={saveKegCodes}
                    style={{
                      backgroundColor: '#28A745',
                      color: '#fff',
                      padding: '10px 20px',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '16px',
                    }}
                  >
                    Save
                  </button>
                  <button
                    onClick={() => {
                      setKegScanning({ itemIndex: null, kegCodes: [] });
                      setCurrentKegCode('');
                      setManualKegEntry(false);
                      setError(null);
                    }}
                    style={{
                      backgroundColor: '#F86752',
                      color: '#fff',
                      padding: '10px 20px',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '16px',
                    }}
                  >
                    Cancel
                  </button>
                </div>
                <button
                  onClick={() => setManualKegEntry(true)}
                  style={{
                    backgroundColor: '#2196F3',
                    color: '#fff',
                    padding: '10px 20px',
                    marginTop: '10px',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                  }}
                >
                  Manual Entry
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default InvoiceComponent;