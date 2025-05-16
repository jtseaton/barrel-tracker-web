import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Invoice } from '../types/interfaces';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:3000';

const InvoicesList: React.FC = () => {
  const navigate = useNavigate();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchInvoices = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/invoices`, {
          headers: { Accept: 'application/json' },
        });
        console.log('fetchInvoices: /api/invoices response status', res.status);
        if (!res.ok) {
          throw new Error(`Failed to fetch invoices: HTTP ${res.status}`);
        }
        const data = await res.json();
        console.log('fetchInvoices: /api/invoices data', data);
        setInvoices(data);
      } catch (err: any) {
        console.error('fetchInvoices error:', err);
        setError('Failed to load invoices: ' + err.message);
      }
    };
    fetchInvoices();
  }, []);

  return (
    <div className="page-container">
      <h2>Invoices</h2>
      {error && <div className="error">{error}</div>}
      {invoices.length === 0 ? (
        <p>No invoices found.</p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', backgroundColor: '#fff', borderRadius: '8px' }}>
          <thead>
            <tr>
              <th style={{ padding: '10px', backgroundColor: '#f5f5f5', borderBottom: '1px solid #ddd', color: '#555' }}>Invoice ID</th>
              <th style={{ padding: '10px', backgroundColor: '#f5f5f5', borderBottom: '1px solid #ddd', color: '#555' }}>Customer</th>
              <th style={{ padding: '10px', backgroundColor: '#f5f5f5', borderBottom: '1px solid #ddd', color: '#555' }}>Status</th>
              <th style={{ padding: '10px', backgroundColor: '#f5f5f5', borderBottom: '1px solid #ddd', color: '#555' }}>Created Date</th>
              <th style={{ padding: '10px', backgroundColor: '#f5f5f5', borderBottom: '1px solid #ddd', color: '#555' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {invoices.map((invoice) => (
              <tr key={invoice.invoiceId}>
                <td style={{ padding: '10px' }}>{invoice.invoiceId}</td>
                <td style={{ padding: '10px' }}>{invoice.customerName}</td>
                <td style={{ padding: '10px' }}>{invoice.status}</td>
                <td style={{ padding: '10px' }}>{invoice.createdDate}</td>
                <td style={{ padding: '10px' }}>
                  <button
                    onClick={() => navigate(`/invoices/${invoice.invoiceId}`)}
                    style={{
                      backgroundColor: '#2196F3',
                      color: '#fff',
                      padding: '5px 10px',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                    }}
                  >
                    View
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

export default InvoicesList;