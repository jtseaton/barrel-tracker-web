import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { SalesOrder } from '../types/interfaces';
import '../App.css';
import 'bootstrap/dist/css/bootstrap.min.css';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:3000';

const SalesOrderList: React.FC = () => {
  const navigate = useNavigate();
  const [salesOrders, setSalesOrders] = useState<SalesOrder[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    const fetchSalesOrders = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/sales-orders?page=${page}&limit=10`, {
          headers: { Accept: 'application/json' },
        });
        console.log('fetchSalesOrders: /api/sales-orders response status', res.status);
        if (!res.ok) {
          throw new Error(`Failed to fetch sales orders: HTTP ${res.status}`);
        }
        const data = await res.json();
        console.log('fetchSalesOrders: /api/sales-orders data', data);
        setSalesOrders(data.orders || []);
        setTotalPages(data.totalPages || 1);
      } catch (err: any) {
        console.error('fetchSalesOrders error:', err);
        setError('Failed to load sales orders: ' + err.message);
      }
    };
    fetchSalesOrders();
  }, [page]);

  return (
    <div className="page-container container">
      <h2 className="text-warning mb-4">Sales Orders</h2>
      {error && <div className="alert alert-danger">{error}</div>}
      <button
        onClick={() => navigate('/sales-orders/new')}
        className="btn btn-primary mb-4"
      >
        Create New Sales Order
      </button>
      {salesOrders.length === 0 ? (
        <p>No sales orders found.</p>
      ) : (
        <>
          <table className="inventory-table table table-striped">
            <thead>
              <tr>
                <th>Order ID</th>
                <th>Customer</th>
                <th>PO Number</th>
                <th>Status</th>
                <th>Created Date</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {salesOrders.map((order) => (
                <tr key={order.orderId}>
                  <td>{order.orderId}</td>
                  <td>{order.customerName}</td>
                  <td>{order.poNumber || '-'}</td>
                  <td>{order.status}</td>
                  <td>{order.createdDate}</td>
                  <td>
                    <button
                      onClick={() => navigate(`/sales-orders/${order.orderId}`)}
                      className="btn btn-primary btn-sm"
                    >
                      View
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="order-list">
            {salesOrders.map((order) => (
              <div key={order.orderId} className="order-card card mb-2">
                <div className="card-body">
                  <h5 className="card-title">Order {order.orderId}</h5>
                  <p className="card-text">Customer: {order.customerName}</p>
                  <p className="card-text">PO: {order.poNumber || '-'}</p>
                  <p className="card-text">Status: {order.status}</p>
                  <p className="card-text">Date: {order.createdDate}</p>
                  <button
                    onClick={() => navigate(`/sales-orders/${order.orderId}`)}
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

export default SalesOrderList;