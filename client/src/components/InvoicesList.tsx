import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Invoice } from '../types/interfaces';
import '../App.css';
import 'bootstrap/dist/css/bootstrap.min.css';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:3000';

const InvoicesList: React.FC = () => {
  const navigate = useNavigate();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    const fetchInvoices = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/invoices?page=${page}&limit=10`, {
          headers: { Accept: 'application/json' },
        });
        console.log('fetchInvoices: /api/invoices response status', res.status);
        if (!res.ok) {
          throw new Error(`Failed to fetch invoices: HTTP ${res.status}`);
        }
        const data = await res.json();
        console.log('fetchInvoices: /api/invoices data', data);
        setInvoices(data.invoices || []);
        setTotalPages(data.totalPages || 1);
      } catch (err: any) {
        console.error('fetchInvoices error:', err);
        setError('Failed to load invoices: ' + err.message);
      }
    };
    fetchInvoices();
  }, [page]);

  return (
    <div className="page-container container">
      <h2 className="text-warning mb-4">Invoices</h2>
      {error && <div className="alert alert-danger">{error}</div>}
      {invoices.length === 0 ? (
        <p>No invoices found.</p>
      ) : (
        <>
          <table className="inventory-table table table-striped">
            <thead>
              <tr>
                <th>Invoice ID</th>
                <th>Customer</th>
                <th>Status</th>
                <th>Created Date</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((invoice) => (
                <tr key={invoice.invoiceId}>
                  <td>{invoice.invoiceId}</td>
                  <td>{invoice.customerName}</td>
                  <td>{invoice.status}</td>
                  <td>{invoice.createdDate}</td>
                  <td>
                    <button
                      onClick={() => navigate(`/invoices/${invoice.invoiceId}`)}
                      className="btn btn-primary btn-sm"
                    >
                      View
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="invoice-list">
            {invoices.map((invoice) => (
              <div key={invoice.invoiceId} className="invoice-card card mb-2">
                <div className="card-body">
                  <h5 className="card-title">Invoice {invoice.invoiceId}</h5>
                  <p className="card-text">Customer: {invoice.customerName}</p>
                  <p className="card-text">Status: {invoice.status}</p>
                  <p className="card-text">Date: {invoice.createdDate}</p>
                  <button
                    onClick={() => navigate(`/invoices/${invoice.invoiceId}`)}
                    className="btn btn-primary btn-sm"
                  >
                    View
                  </button>
                </div>
              </div>
            ))}
          </div>
          <div className="d-flex justify-content-between mt-3">
            <button
              className="btn btn-secondary"
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
            >
              Previous
            </button>
            <span>Page {page} of {totalPages}</span>
            <button
              className="btn btn-secondary"
              onClick={() => setPage(p => p + 1)}
              disabled={page === totalPages}
            >
              Next
            </button>
          </div>
        </>
      )}
    </div>
  );
};

export default InvoicesList;