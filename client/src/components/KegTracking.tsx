// src/components/KegTracking.tsx
import React, { useState, useEffect } from 'react';
import { InventoryItem, Keg, KegTrackingProps } from '../types/interfaces';
import QRScanner from './QRScanner';
import '../App.css';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:3000';

const KegTracking: React.FC<KegTrackingProps> = ({ inventory, refreshInventory }) => {
  const [kegs, setKegs] = useState<Keg[]>([]);
  const [newKegCode, setNewKegCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [transactionModal, setTransactionModal] = useState<{ keg: Keg; action: string } | null>(null);
  const [showScanner, setShowScanner] = useState(false);

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
        setKegs(data);
      } catch (err: any) {
        setError('Failed to load kegs: ' + err.message);
      }
    };
    fetchKegs();
  }, []);

  const handleAddKeg = async () => {
    if (!newKegCode || !/^[A-Z0-9-]+$/.test(newKegCode)) {
      setError('Valid keg code (e.g., KEG-001) required');
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
        throw new Error(`Failed to add keg: ${text}`);
      }
      const newKeg = await res.json();
      setKegs([...kegs, newKeg]);
      setSuccessMessage('Keg added successfully');
      setTimeout(() => setSuccessMessage(null), 2000);
      setNewKegCode('');
      setShowScanner(false);
      setError(null);
    } catch (err: any) {
      setError('Failed to add keg: ' + err.message);
    }
  };

  const handleTransaction = async (keg: Keg, action: string) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/kegs/${keg.code}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          status: action === 'Ship' ? 'Filled' : action === 'Return' ? 'Empty' : keg.status,
          location: action === 'Ship' ? 'At Distributor' : action === 'Return' ? 'Brewery' : keg.location,
        }),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Failed to perform ${action}: ${text}`);
      }
      const updatedKeg = await res.json();
      setKegs(kegs.map((k) => (k.id === keg.id ? updatedKeg : k)));
      setSuccessMessage(`${action} completed successfully`);
      setTimeout(() => setSuccessMessage(null), 2000);
      setTransactionModal(null);
      setError(null);
    } catch (err: any) {
      setError(`Failed to perform ${action}: ` + err.message);
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
      <div style={{ marginBottom: '20px' }}>
        <button
          onClick={() => setShowScanner(true)}
          style={{
            backgroundColor: '#2196F3',
            color: '#fff',
            padding: '10px 20px',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            marginRight: '10px',
          }}
        >
          Scan Keg
        </button>
        <input
          type="text"
          value={newKegCode}
          onChange={(e) => setNewKegCode(e.target.value)}
          placeholder="Enter keg code (e.g., KEG-001)"
          style={{ padding: '10px', marginRight: '10px', width: '200px' }}
          disabled={showScanner}
        />
        <button
          onClick={handleAddKeg}
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
          Add Keg
        </button>
      </div>
      <table className="inventory-table">
        <thead>
          <tr>
            <th>Code</th>
            <th>Status</th>
            <th>Customer</th>
            <th>Location</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {kegs.map((keg) => (
            <tr key={keg.code}>
              <td>{keg.code}</td>
              <td>{keg.status}</td>
              <td>{keg.customerName || 'N/A'}</td>
              <td>{keg.location || 'N/A'}</td>
              <td>
                <button
                  onClick={() => setTransactionModal({ keg, action: 'Ship' })}
                  style={{
                    backgroundColor: '#2196F3',
                    color: '#fff',
                    padding: '8px 12px',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    marginRight: '5px',
                  }}
                  disabled={keg.status !== 'Empty'}
                >
                  Ship
                </button>
                <button
                  onClick={() => setTransactionModal({ keg, action: 'Return' })}
                  style={{
                    backgroundColor: '#28A745',
                    color: '#fff',
                    padding: '8px 12px',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                  }}
                  disabled={keg.status !== 'Filled'}
                >
                  Return
                </button>
              </td>
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
                handleAddKeg();
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
      {transactionModal && (
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
              {transactionModal.action} Keg: {transactionModal.keg.code}
            </h3>
            <p>Confirm {transactionModal.action.toLowerCase()} action?</p>
            <div style={{ display: 'flex', justifyContent: 'space-around', marginTop: '20px' }}>
              <button
                onClick={() => handleTransaction(transactionModal.keg, transactionModal.action)}
                style={{
                  backgroundColor: '#28A745',
                  color: '#fff',
                  padding: '10px 20px',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                }}
              >
                Confirm
              </button>
              <button
                onClick={() => setTransactionModal(null)}
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