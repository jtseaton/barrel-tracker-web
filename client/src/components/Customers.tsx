// client/src/components/Customers.tsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Customer } from '../types/interfaces';
import 'bootstrap/dist/css/bootstrap.min.css';
import '../App.css';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'https://tilly.onrender.com';

const Customers: React.FC = () => {
  const navigate = useNavigate();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    const fetchCustomers = async () => {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);
        const res = await fetch(`${API_BASE_URL}/api/customers`, {
          headers: { Accept: 'application/json' },
          signal: controller.signal,
        });
        clearTimeout(timeoutId);
        console.log('[Customers] Fetch /api/customers: Status:', res.status);
        if (!res.ok) {
          const text = await res.text();
          throw new Error(`HTTP ${res.status}: ${text.slice(0, 100)}`);
        }
        const contentType = res.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
          const text = await res.text();
          throw new Error(`Expected JSON, got ${contentType || 'none'}: ${text}`);
        }
        const data = await res.json();
        console.log('[Customers] Fetched customers:', data);
        setCustomers(data);
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        console.error('[Customers] Fetch error:', err);
        setError('Failed to load customers: ' + errorMessage);
      }
    };
    fetchCustomers();
  }, []);

  const handleDelete = async (customerId: number) => {
    if (!window.confirm('Are you sure you want to delete this customer?')) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/customers/${customerId}`, {
        method: 'DELETE',
        headers: { Accept: 'application/json' },
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`HTTP ${res.status}: ${text.slice(0, 50)}`);
      }
      console.log('[Customers] Deleted customer:', customerId);
      setCustomers(customers.filter(c => c.customerId !== customerId));
      setSuccessMessage('Customer deleted successfully');
      setTimeout(() => setSuccessMessage(null), 2000);
      setError(null);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      console.error('[Customers] Delete error:', err);
      setError('Failed to delete customer: ' + errorMessage);
    }
  };

  console.log('[Customers] Render:', {
    customersLength: customers.length,
    error,
    successMessage,
    isMobile: window.innerWidth <= 768 ? 'cards' : 'table',
  });

  return (
    <div className="page-container container">
      <h2 className="app-header mb-4">Customers</h2>
      {error && <div className="alert alert-danger">{error}</div>}
      {successMessage && <div className="alert alert-success">{successMessage}</div>}
      <div className="inventory-actions mb-4">
        <button onClick={() => navigate('/customers/new')} className="btn btn-primary">
          Add Customer
        </button>
      </div>
      <div className="inventory-table-container">
        {customers.length === 0 ? (
          <div className="alert alert-info text-center">No customers found.</div>
        ) : (
          <>
            <table className="inventory-table table table-striped">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Phone</th>
                  <th>Enabled</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {customers.map((customer) => (
                  <tr
                    key={customer.customerId}
                    onClick={() => navigate(`/customers/${customer.customerId}`)}
                  >
                    <td>{customer.name}</td>
                    <td>{customer.email}</td>
                    <td>{customer.phone || 'N/A'}</td>
                    <td>{customer.enabled ? 'Yes' : 'No'}</td>
                    <td>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(customer.customerId);
                        }}
                        className="btn btn-danger"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="customer-card-list">
              {customers.map((customer) => (
                <div key={customer.customerId} className="customer-card-item card mb-2">
                  <div className="card-body">
                    <p className="card-text"><strong>Name:</strong> {customer.name}</p>
                    <p className="card-text"><strong>Email:</strong> {customer.email}</p>
                    <p className="card-text"><strong>Phone:</strong> {customer.phone || 'N/A'}</p>
                    <p className="card-text"><strong>Enabled:</strong> {customer.enabled ? 'Yes' : 'No'}</p>
                    <button
                      onClick={() => handleDelete(customer.customerId)}
                      className="btn btn-danger"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default Customers;