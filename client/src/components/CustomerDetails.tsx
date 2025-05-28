// client/src/components/CustomerDetails.tsx
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Customer } from '../types/interfaces';
import 'bootstrap/dist/css/bootstrap.min.css';
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
            throw new Error(`HTTP ${res.status}: ${text.slice(0, 50)}`);
          }
          const data = await res.json();
          console.log('[CustomerDetails] Fetched customer:', data);
          setCustomer({
            customerId: data.customerId,
            name: data.name || '',
            email: data.email || '',
            address: data.address || '',
            phone: data.phone || '',
            contactPerson: data.contactPerson || '',
            licenseNumber: data.licenseNumber || '',
            notes: data.notes || '',
            enabled: data.enabled ?? 1,
          });
        } catch (err: unknown) {
          const errorMessage = err instanceof Error ? err.message : 'Unknown error';
          console.error('[CustomerDetails] Fetch error:', err);
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
      const payload = {
        name: customer.name,
        email: customer.email,
        address: customer.address || '',
        phone: customer.phone || '',
        contactPerson: customer.contactPerson || '',
        licenseNumber: customer.licenseNumber || '',
        notes: customer.notes || '',
        enabled: customer.enabled ?? 1,
      };
      console.log('[CustomerDetails] Saving customer:', { method, url, payload });
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`HTTP ${res.status}: ${text.slice(0, 50)}`);
      }
      const data = await res.json();
      console.log('[CustomerDetails] Saved customer:', data);
      setSuccessMessage(customerId ? 'Customer updated successfully' : 'Customer created successfully');
      setTimeout(() => {
        setSuccessMessage(null);
        navigate('/customers');
      }, 2000);
      setError(null);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      console.error('[CustomerDetails] Save error:', err);
      setError('Failed to save customer: ' + errorMessage);
    }
  };

  console.log('[CustomerDetails] Render:', {
    customerId,
    customer,
    error,
    successMessage,
    isMobile: window.innerWidth <= 768,
  });

  return (
    <div className="page-container container">
      <h2 className="app-header mb-4">{customerId && customerId !== 'new' ? 'Edit Customer' : 'Add Customer'}</h2>
      {error && <div className="alert alert-danger">{error}</div>}
      {successMessage && <div className="alert alert-success">{successMessage}</div>}
      <div className="customer-form">
        <label className="form-label">
          Name (required):
          <input
            type="text"
            value={customer.name || ''}
            onChange={(e) => setCustomer({ ...customer, name: e.target.value })}
            placeholder="Enter customer name"
            className="form-control"
          />
        </label>
        <label className="form-label">
          Email (required):
          <input
            type="email"
            value={customer.email || ''}
            onChange={(e) => setCustomer({ ...customer, email: e.target.value })}
            placeholder="Enter email"
            className="form-control"
          />
        </label>
        <label className="form-label">
          Phone:
          <input
            type="text"
            value={customer.phone || ''}
            onChange={(e) => setCustomer({ ...customer, phone: e.target.value })}
            placeholder="Enter phone number"
            className="form-control"
          />
        </label>
        <label className="form-label">
          Contact Person:
          <input
            type="text"
            value={customer.contactPerson || ''}
            onChange={(e) => setCustomer({ ...customer, contactPerson: e.target.value })}
            placeholder="Enter contact person"
            className="form-control"
          />
        </label>
        <label className="form-label">
          License Number:
          <input
            type="text"
            value={customer.licenseNumber || ''}
            onChange={(e) => setCustomer({ ...customer, licenseNumber: e.target.value })}
            placeholder="Enter license number"
            className="form-control"
          />
        </label>
        <label className="form-label">
          Address:
          <input
            type="text"
            value={customer.address || ''}
            onChange={(e) => setCustomer({ ...customer, address: e.target.value })}
            placeholder="Enter address"
            className="form-control"
          />
        </label>
        <label className="form-label">
          Notes:
          <textarea
            value={customer.notes || ''}
            onChange={(e) => setCustomer({ ...customer, notes: e.target.value })}
            placeholder="Enter any notes"
            className="form-control"
          />
        </label>
        <label className="form-label">
          Enabled:
          <input
            type="checkbox"
            checked={customer.enabled === 1}
            onChange={(e) => setCustomer({ ...customer, enabled: e.target.checked ? 1 : 0 })}
            className="ms-2"
          />
        </label>
      </div>
      <div className="inventory-actions mt-4">
        <button onClick={handleSave} className="btn btn-primary">
          Save Customer
        </button>
        <button onClick={() => navigate('/customers')} className="btn btn-danger">
          Cancel
        </button>
      </div>
    </div>
  );
};

export default CustomerDetails;