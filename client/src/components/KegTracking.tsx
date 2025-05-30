// src/components/KegTracking.tsx
import React, { useState, useEffect } from 'react';
import { InventoryItem, Keg, KegTransaction, KegTrackingProps, Location, Product, PackageType } from '../types/interfaces';
import QRScanner from './QRScanner';
import '../App.css';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:3000';

const KegTracking: React.FC<KegTrackingProps> = ({ inventory, refreshInventory }) => {
  const [kegs, setKegs] = useState<Keg[]>([]);
  const [newKegCode, setNewKegCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [showScanner, setShowScanner] = useState(false);
  const [detailsModal, setDetailsModal] = useState<{ keg: Keg; transactions: KegTransaction[] } | null>(null);
  const [updateModal, setUpdateModal] = useState<Keg | null>(null);
  const [updateForm, setUpdateForm] = useState({ status: '', locationId: '', lastScanned: '', productId: '', packagingType: '' });
  const [locations, setLocations] = useState<Location[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [packageTypes, setPackageTypes] = useState<PackageType[]>([]);

  useEffect(() => {
    const fetchKegs = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/kegs`, {
          headers: { Accept: 'application/json' },
        });
        if (!res.ok) {
          throw new Error(`Failed to fetch kegs: HTTP ${res.status}`);
        }
        const data = await res.json();
        console.log('Fetched kegs:', data);
        setKegs(data.sort((a: Keg, b: Keg) => a.code.localeCompare(b.code)));
      } catch (err: any) {
        setError('Failed to load kegs: ' + err.message);
      }
    };

    const fetchLocations = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/locations`, {
          headers: { Accept: 'application/json' },
        });
        if (!res.ok) {
          throw new Error(`Failed to fetch locations: HTTP ${res.status}`);
        }
        const data = await res.json();
        setLocations(data);
      } catch (err: any) {
        setError('Failed to load locations: ' + err.message);
      }
    };

    const fetchProducts = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/products`, {
          headers: { Accept: 'application/json' },
        });
        if (!res.ok) {
          throw new Error(`Failed to fetch products: HTTP ${res.status}`);
        }
        const data = await res.json();
        setProducts(data);
      } catch (err: any) {
        setError('Failed to load products: ' + err.message);
      }
    };

    fetchKegs();
    fetchLocations();
    fetchProducts();
  }, []);

  useEffect(() => {
    if (updateForm.productId) {
      const fetchPackageTypes = async () => {
        try {
          const res = await fetch(`${API_BASE_URL}/api/product-package-types?productId=${updateForm.productId}`, {
            headers: { Accept: 'application/json' },
          });
          if (!res.ok) {
            throw new Error(`Failed to fetch package types: HTTP ${res.status}`);
          }
          const data = await res.json();
          setPackageTypes(data);
        } catch (err: any) {
          setError('Failed to load package types: ' + err.message);
        }
      };
      fetchPackageTypes();
    } else {
      setPackageTypes([]);
    }
  }, [updateForm.productId]);

  const handleRegisterKeg = async () => {
    if (!newKegCode || !/^[A-Z0-9-]+$/.test(newKegCode)) {
      setError('Valid keg code (e.g., EK10000) required');
      return;
    }
    try {
      const res = await fetch(`${API_BASE_URL}/api/kegs/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ code: newKegCode }),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Failed to register keg: ${text}`);
      }
      const newKeg = await res.json();
      setKegs([...kegs, newKeg].sort((a, b) => a.code.localeCompare(b.code)));
      setSuccessMessage('Keg registered successfully');
      setTimeout(() => setSuccessMessage(null), 2000);
      setNewKegCode('');
      setShowScanner(false);
      setError(null);
    } catch (err: any) {
      setError('Failed to register keg: ' + err.message);
    }
  };

  const handleViewDetails = async (keg: Keg) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/kegs/${keg.code}/transactions`, {
        headers: { Accept: 'application/json' },
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Failed to fetch transactions: ${text}`);
      }
      const transactions = await res.json();
      console.log('Fetched transactions for keg:', keg.code, transactions);
      setDetailsModal({ keg, transactions });
    } catch (err: any) {
      setError('Failed to load keg transactions: ' + err.message);
    }
  };

  const handleManualUpdate = async () => {
    if (!updateModal) return;
    const { status, locationId, lastScanned, productId, packagingType } = updateForm;
    if (!status && !locationId && !lastScanned && !productId && !packagingType) {
      setError('At least one field (status, location, date, product, or packaging type) must be provided');
      return;
    }
    try {
      const updateData: { status?: string; location?: string; lastScanned?: string; productId?: number; packagingType?: string } = {};
      if (status) updateData.status = status;
      if (locationId) updateData.location = locationId;
      if (lastScanned) updateData.lastScanned = lastScanned;
      if (productId) updateData.productId = parseInt(productId);
      if (packagingType) updateData.packagingType = packagingType;
      const res = await fetch(`${API_BASE_URL}/api/kegs/${updateModal.code}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(updateData),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Failed to update keg: ${text}`);
      }
      const updatedKeg = await res.json();
      setKegs(kegs.map((k) => (k.id === updateModal.id ? updatedKeg : k)).sort((a, b) => a.code.localeCompare(b.code)));
      setSuccessMessage('Keg updated successfully');
      setTimeout(() => setSuccessMessage(null), 2000);
      setUpdateModal(null);
      setUpdateForm({ status: '', locationId: '', lastScanned: '', productId: '', packagingType: '' });
      setError(null);
    } catch (err: any) {
      setError('Failed to update keg: ' + err.message);
    }
  };

  return (
    <div className="page-container">
      <h2 style={{ color: '#EEC930', fontSize: '24px', marginBottom: '20px' }}>Keg Tracking</h2>
      {error && <div className="error">{error}</div>}
      {successMessage && (
        <div className="error" style={{ color: '#28A745', backgroundColor: '#e6ffe6' }}>
          {successMessage}
        </div>
      )}
      <div style={{ marginBottom: '20px', display: 'flex', gap: '10px' }}>
        <button
          onClick={() => setShowScanner(true)}
          style={{
            backgroundColor: '#2196F3',
            color: '#fff',
            padding: '10px 20px',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
          }}
        >
          Scan Keg
        </button>
        <input
          type="text"
          value={newKegCode}
          onChange={(e) => setNewKegCode(e.target.value)}
          placeholder="Enter keg code (e.g., EK10000)"
          style={{ padding: '10px', width: '200px' }}
          disabled={showScanner}
        />
        <button
          onClick={handleRegisterKeg}
          style={{
            backgroundColor: '#2196F3',
            color: '#fff',
            padding: '10px 20px',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
          }}
          disabled={showScanner}
        >
          Register Keg
        </button>
        <button
          onClick={() => setUpdateModal({ id: 0, code: '', status: '', lastScanned: '' })}
          style={{
            backgroundColor: '#28A745',
            color: '#fff',
            padding: '10px 20px',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
          }}
        >
          Manual Update
        </button>
      </div>
      <table className="inventory-table">
        <thead>
          <tr>
            <th>Code</th>
            <th>Product</th>
            <th>Packaging Type</th>
            <th>Status</th>
            <th>Customer</th>
            <th>Location</th>
          </tr>
        </thead>
        <tbody>
          {kegs.map((keg) => (
            <tr key={keg.code}>
              <td>
                <span
                  onClick={() => handleViewDetails(keg)}
                  style={{ color: '#2196F3', cursor: 'pointer', textDecoration: 'underline' }}
                >
                  {keg.code}
                </span>
              </td>
              <td>{keg.productName || 'N/A'}</td>
              <td>{keg.packagingType || 'N/A'}</td>
              <td>{keg.status}</td>
              <td>{keg.customerName || 'N/A'}</td>
              <td>{keg.locationName || 'N/A'}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {showScanner && (
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
            <h3 style={{ color: '#555', marginBottom: '20px' }}>Scan Keg</h3>
            <QRScanner
              onScan={(code) => {
                setNewKegCode(code);
                handleRegisterKeg();
              }}
              onError={(error) => setError(error)}
            />
            <button
              onClick={() => setShowScanner(false)}
              style={{
                backgroundColor: '#F86752',
                color: '#fff',
                padding: '10px 20px',
                marginTop: '10px',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
      {detailsModal && (
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
              width: '600px',
              boxShadow: '0 4px 8px rgba(0,0,0,0.2)',
              textAlign: 'center',
              color: '#555',
            }}
          >
            <h3 style={{ color: '#555', marginBottom: '20px' }}>Keg Details: {detailsModal.keg.code}</h3>
            <p><strong>Status:</strong> {detailsModal.keg.status}</p>
            <p><strong>Location:</strong> {detailsModal.keg.locationName || 'N/A'}</p>
            <p><strong>Customer:</strong> {detailsModal.keg.customerName || 'N/A'}</p>
            <p><strong>Last Scanned:</strong> {detailsModal.keg.lastScanned}</p>
            <h4 style={{ color: '#555', margin: '20px 0 10px' }}>Transaction History</h4>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ backgroundColor: '#f4f4f4' }}>
                  <th style={{ border: '1px solid #ddd', padding: '8px' }}>Date</th>
                  <th style={{ border: '1px solid #ddd', padding: '8px' }}>Action</th>
                  <th style={{ border: '1px solid #ddd', padding: '8px' }}>Location</th>
                  <th style={{ border: '1px solid #ddd', padding: '8px' }}>Customer</th>
                </tr>
              </thead>
              <tbody>
                {detailsModal.transactions.map((tx) => (
                  <tr key={tx.id}>
                    <td style={{ border: '1px solid #ddd', padding: '8px' }}>{tx.date}</td>
                    <td style={{ border: '1px solid #ddd', padding: '8px' }}>{tx.action}</td>
                    <td style={{ border: '1px solid #ddd', padding: '8px' }}>{tx.location || 'N/A'}</td>
                    <td style={{ border: '1px solid #ddd', padding: '8px' }}>{tx.customerName || 'N/A'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <button
              onClick={() => setDetailsModal(null)}
              style={{
                backgroundColor: '#F86752',
                color: '#fff',
                padding: '10px 20px',
                marginTop: '20px',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
              }}
            >
              Close
            </button>
          </div>
        </div>
      )}
      {updateModal && (
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
            <h3 style={{ color: '#555', marginBottom: '20px' }}>Manual Update Keg</h3>
            <div style={{ marginBottom: '10px' }}>
              <label style={{ display: 'block', marginBottom: '5px' }}>Keg Code:</label>
              <input
                type="text"
                value={updateModal.code}
                onChange={(e) => setUpdateModal({ ...updateModal, code: e.target.value })}
                placeholder="Enter keg code (e.g., EK10000)"
                style={{ padding: '10px', width: '100%', border: '1px solid #CCCCCC', borderRadius: '4px' }}
              />
            </div>
            <div style={{ marginBottom: '10px' }}>
              <label style={{ display: 'block', marginBottom: '5px' }}>Status:</label>
              <select
                value={updateForm.status}
                onChange={(e) => setUpdateForm({ ...updateForm, status: e.target.value })}
                style={{ padding: '10px', width: '100%', border: '1px solid #CCCCCC', borderRadius: '4px' }}
              >
                <option value="">Select Status</option>
                <option value="Filled">Filled</option>
                <option value="Empty">Empty</option>
                <option value="Destroyed">Destroyed</option>
                <option value="Broken">Broken</option>
              </select>
            </div>
            <div style={{ marginBottom: '10px' }}>
              <label style={{ display: 'block', marginBottom: '5px' }}>Location:</label>
              <select
                value={updateForm.locationId}
                onChange={(e) => setUpdateForm({ ...updateForm, locationId: e.target.value })}
                style={{ padding: '10px', width: '100%', border: '1px solid #CCCCCC', borderRadius: '4px' }}
              >
                <option value="">Select Location</option>
                {locations.map((loc) => (
                  <option key={loc.locationId} value={loc.locationId}>
                    {loc.name} ({loc.siteId})
                  </option>
                ))}
              </select>
            </div>
            <div style={{ marginBottom: '10px' }}>
              <label style={{ display: 'block', marginBottom: '5px' }}>Last Scanned Date:</label>
              <input
                type="date"
                value={updateForm.lastScanned}
                onChange={(e) => setUpdateForm({ ...updateForm, lastScanned: e.target.value })}
                style={{ padding: '10px', width: '100%', border: '1px solid #CCCCCC', borderRadius: '4px' }}
              />
            </div>
            <div style={{ marginBottom: '10px' }}>
              <label style={{ display: 'block', marginBottom: '5px' }}>Product:</label>
              <select
                value={updateForm.productId}
                onChange={(e) => setUpdateForm({ ...updateForm, productId: e.target.value, packagingType: '' })}
                style={{ padding: '10px', width: '100%', border: '1px solid #CCCCCC', borderRadius: '4px' }}
              >
                <option value="">Select Product</option>
                {products.map((prod) => (
                  <option key={prod.id} value={prod.id}>
                    {prod.name}
                  </option>
                ))}
              </select>
            </div>
            <div style={{ marginBottom: '10px' }}>
              <label style={{ display: 'block', marginBottom: '5px' }}>Packaging Type:</label>
              <select
                value={updateForm.packagingType}
                onChange={(e) => setUpdateForm({ ...updateForm, packagingType: e.target.value })}
                style={{ padding: '10px', width: '100%', border: '1px solid #CCCCCC', borderRadius: '4px' }}
                disabled={!updateForm.productId}
              >
                <option value="">Select Packaging Type</option>
                {packageTypes.map((pt) => (
                  <option key={pt.type} value={pt.type}>
                    {pt.type} (${pt.price}, {pt.isKegDepositItem ? 'Keg Deposit' : 'No Deposit'})
                  </option>
                ))}
              </select>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-around', marginTop: '20px' }}>
              <button
                onClick={handleManualUpdate}
                style={{
                  backgroundColor: '#28A745',
                  color: '#fff',
                  padding: '10px 20px',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                }}
              >
                Update
              </button>
              <button
                onClick={() => {
                  setUpdateModal(null);
                  setUpdateForm({ status: '', locationId: '', lastScanned: '', productId: '', packagingType: '' });
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

export default KegTracking;