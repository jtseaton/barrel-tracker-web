import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Customer } from '../types/interfaces';
import '../App.css';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:3000';

const CustomerDetails: React.FC = () => {
  const { customerId } = useParams<{ customerId: string }>();
  const navigate = useNavigate();
  const [customer, setCustomer] = useState<Partial<Customer>>({
    name: '',
    email: '',
    address: '',
    phone: '',
    contactPerson: '',
    licenseNumber: '',
    notes: '',
    enabled: 1,
  });
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    if (customerId && customerId !== 'new') {
      const fetchCustomer = async () => {
        try {
          const res = await fetch(`${API_BASE_URL}/api/customers/${customerId}`, {
            headers: { Accept: 'application/json' },
          });
          if (!res.ok) {
            const text = await res.text();
            throw new Error(`Failed to fetch customer: HTTP ${res.status}, Response: ${text.slice(0, 50)}`);
          }
          const data = await res.json();
          setCustomer(data);
        } catch (err: unknown) {
          const errorMessage = err instanceof Error ? err.message : 'Unknown error';
          setError('Failed to load customer: ' + errorMessage);
        }
      };
      fetchCustomer();
    }
  }, [customerId]);

  const handleSave = async () => {
    if (!customer.name || !customer.email) {
      setError('Name and email are required');
      return;
    }
    try {
      const method = customerId && customerId !== 'new' ? 'PATCH' : 'POST';
      const url = customerId && customerId !== 'new' ? `${API_BASE_URL}/api/customers/${customerId}` : `${API_BASE_URL}/api/customers`;
      console.log('Saving customer:', { method, url, payload: customer });
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(customer),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Failed to save customer: HTTP ${res.status}, Response: ${text.slice(0, 50)}`);
      }
      const data = await res.json();
      console.log('Saved customer response:', data);
      setSuccessMessage(customerId ? 'Customer updated successfully' : 'Customer created successfully');
      setTimeout(() => {
        setSuccessMessage(null);
        navigate('/customers');
      }, 2000);
      setError(null);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      console.error('Save customer error:', err);
      setError('Failed to save customer: ' + errorMessage);
    }
  };

  return (
    <div className="page-container">
      <h2 style={{ color: '#EEC930', fontSize: '24px', marginBottom: '20px' }}>
        {customerId && customerId !== 'new' ? 'Edit Customer' : 'Add Customer'}
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
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', maxWidth: '800px' }}>
        <div>
          <label style={{ fontWeight: 'bold', color: '#EEC930', display: 'block', marginBottom: '5px' }}>
            Name (required):
          </label>
          <input
            type="text"
            value={customer.name || ''}
            onChange={(e) => setCustomer({ ...customer, name: e.target.value })}
            placeholder="Enter customer name"
            style={{ width: '100%', padding: '10px', border: '1px solid #CCCCCC', borderRadius: '4px', fontSize: '16px' }}
          />
        </div>
        <div>
          <label style={{ fontWeight: 'bold', color: '#EEC930', display: 'block', marginBottom: '5px' }}>
            Email (required):
          </label>
          <input
            type="email"
            value={customer.email || ''}
            onChange={(e) => setCustomer({ ...customer, email: e.target.value })}
            placeholder="Enter email"
            style={{ width: '100%', padding: '10px', border: '1px solid #CCCCCC', borderRadius: '4px', fontSize: '16px' }}
          />
        </div>
        <div>
          <label style={{ fontWeight: 'bold', color: '#EEC930', display: 'block', marginBottom: '5px' }}>
            Phone:
          </label>
          <input
            type="text"
            value={customer.phone || ''}
            onChange={(e) => setCustomer({ ...customer, phone: e.target.value })}
            placeholder="Enter phone number"
            style={{ width: '100%', padding: '10px', border: '1px solid #CCCCCC', borderRadius: '4px', fontSize: '16px' }}
          />
        </div>
        <div>
          <label style={{ fontWeight: 'bold', color: '#EEC930', display: 'block', marginBottom: '5px' }}>
            Contact Person:
          </label>
          <input
            type="text"
            value={customer.contactPerson || ''}
            onChange={(e) => setCustomer({ ...customer, contactPerson: e.target.value })}
            placeholder="Enter contact person"
            style={{ width: '100%', padding: '10px', border: '1px solid #CCCCCC', borderRadius: '4px', fontSize: '16px' }}
          />
        </div>
        <div>
          <label style={{ fontWeight: 'bold', color: '#EEC930', display: 'block', marginBottom: '5px' }}>
            License Number:
          </label>
          <input
            type="text"
            value={customer.licenseNumber || ''}
            onChange={(e) => setCustomer({ ...customer, licenseNumber: e.target.value })}
            placeholder="Enter license number"
            style={{ width: '100%', padding: '10px', border: '1px solid #CCCCCC', borderRadius: '4px', fontSize: '16px' }}
          />
        </div>
        <div>
          <label style={{ fontWeight: 'bold', color: '#EEC930', display: 'block', marginBottom: '5px' }}>
            Address:
          </label>
          <input
            type="text"
            value={customer.address || ''}
            onChange={(e) => setCustomer({ ...customer, address: e.target.value })}
            placeholder="Enter address"
            style={{ width: '100%', padding: '10px', border: '1px solid #CCCCCC', borderRadius: '4px', fontSize: '16px' }}
          />
        </div>
        <div style={{ gridColumn: '1 / -1' }}>
          <label style={{ fontWeight: 'bold', color: '#EEC930', display: 'block', marginBottom: '5px' }}>
            Notes:
          </label>
          <textarea
            value={customer.notes || ''}
            onChange={(e) => setCustomer({ ...customer, notes: e.target.value })}
            placeholder="Enter any notes"
            style={{ width: '100%', padding: '10px', border: '1px solid #CCCCCC', borderRadius: '4px', fontSize: '16px', minHeight: '100px' }}
          />
        </div>
        <div>
          <label style={{ fontWeight: 'bold', color: '#EEC930', display: 'block', marginBottom: '5px' }}>
            Enabled:
          </label>
          <input
            type="checkbox"
            checked={customer.enabled === 1}
            onChange={(e) => setCustomer({ ...customer, enabled: e.target.checked ? 1 : 0 })}
            style={{ marginLeft: '10px' }}
          />
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
            fontSize: '16px',
          }}
        >
          Save Customer
        </button>
        <button
          onClick={() => navigate('/customers')}
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
    </div>
  );
};

export default CustomerDetails;