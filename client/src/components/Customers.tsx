import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Customer } from '../types/interfaces';
import '../App.css';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:3000';

const Customers: React.FC = () => {
  const navigate = useNavigate();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    const fetchCustomers = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/customers`, {
          headers: { Accept: 'application/json' },
        });
        if (!res.ok) {
          const text = await res.text();
          throw new Error(`Failed to fetch customers: HTTP ${res.status}, Response: ${text.slice(0, 50)}`);
        }
        const data = await res.json();
        setCustomers(data);
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
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
        throw new Error(`Failed to delete customer: HTTP ${res.status}, Response: ${text.slice(0, 50)}`);
      }
      setCustomers(customers.filter(c => c.customerId !== customerId));
      setSuccessMessage('Customer deleted successfully');
      setTimeout(() => setSuccessMessage(null), 2000);
      setError(null);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError('Failed to delete customer: ' + errorMessage);
    }
  };

  return (
    <div className="page-container">
      <h2 style={{ color: '#EEC930', fontSize: '24px', marginBottom: '20px' }}>Customers</h2>
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
      <div style={{ marginBottom: '20px' }}>
        <button
          onClick={() => navigate('/customers/new')}
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
          Add Customer
        </button>
      </div>
      {customers.length === 0 ? (
        <p style={{ color: '#555' }}>No customers found.</p>
      ) : (
        <table
          style={{
            width: '100%',
            borderCollapse: 'collapse',
            backgroundColor: '#fff',
            borderRadius: '8px',
            marginTop: '10px',
          }}
        >
          <thead>
            <tr>
              <th style={{ padding: '10px', backgroundColor: '#f5f5f5', borderBottom: '1px solid #ddd', color: '#555' }}>Name</th>
              <th style={{ padding: '10px', backgroundColor: '#f5f5f5', borderBottom: '1px solid #ddd', color: '#555' }}>Email</th>
              <th style={{ padding: '10px', backgroundColor: '#f5f5f5', borderBottom: '1px solid #ddd', color: '#555' }}>Phone</th>
              <th style={{ padding: '10px', backgroundColor: '#f5f5f5', borderBottom: '1px solid #ddd', color: '#555' }}>Enabled</th>
              <th style={{ padding: '10px', backgroundColor: '#f5f5f5', borderBottom: '1px solid #ddd', color: '#555' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {customers.map((customer) => (
              <tr
                key={customer.customerId}
                style={{ cursor: 'pointer' }}
                onClick={() => navigate(`/customers/${customer.customerId}`)}
              >
                <td style={{ padding: '10px' }}>{customer.name}</td>
                <td style={{ padding: '10px' }}>{customer.email}</td>
                <td style={{ padding: '10px' }}>{customer.phone || 'N/A'}</td>
                <td style={{ padding: '10px' }}>{customer.enabled ? 'Yes' : 'No'}</td>
                <td style={{ padding: '10px' }}>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(customer.customerId);
                    }}
                    style={{
                      backgroundColor: '#F86752',
                      color: '#fff',
                      padding: '8px 12px',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '14px',
                    }}
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
};

export default Customers;