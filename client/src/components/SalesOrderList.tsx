import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { SalesOrder } from '../types/interfaces';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:3000';

const SalesOrderList: React.FC = () => {
  const navigate = useNavigate();
  const [salesOrders, setSalesOrders] = useState<SalesOrder[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchSalesOrders = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/sales-orders`, {
          headers: { Accept: 'application/json' },
        });
        console.log('fetchSalesOrders: /api/sales-orders response status', res.status);
        if (!res.ok) {
          throw new Error(`Failed to fetch sales orders: HTTP ${res.status}`);
        }
        const data = await res.json();
        console.log('fetchSalesOrders: /api/sales-orders data', data);
        setSalesOrders(data);
      } catch (err: any) {
        console.error('fetchSalesOrders error:', err);
        setError('Failed to load sales orders: ' + err.message);
      }
    };
    fetchSalesOrders();
  }, []);

  return (
    <div className="page-container">
      <h2>Sales Orders</h2>
      {error && <div className="error">{error}</div>}
      <button
        onClick={() => navigate('/sales-orders/new')}
        style={{
          backgroundColor: '#2196F3',
          color: '#fff',
          padding: '10px 20px',
          border: 'none',
          borderRadius: '4px',
          cursor: 'pointer',
          marginBottom: '20px',
        }}
      >
        Create New Sales Order
      </button>
      {salesOrders.length === 0 ? (
        <p>No sales orders found.</p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', backgroundColor: '#fff', borderRadius: '8px' }}>
          <thead>
            <tr>
              <th style={{ padding: '10px', backgroundColor: '#f5f5f5', borderBottom: '1px solid #ddd', color: '#555' }}>Order ID</th>
              <th style={{ padding: '10px', backgroundColor: '#f5f5f5', borderBottom: '1px solid #ddd', color: '#555' }}>Customer</th>
              <th style={{ padding: '10px', backgroundColor: '#f5f5f5', borderBottom: '1px solid #ddd', color: '#555' }}>PO Number</th>
              <th style={{ padding: '10px', backgroundColor: '#f5f5f5', borderBottom: '1px solid #ddd', color: '#555' }}>Status</th>
              <th style={{ padding: '10px', backgroundColor: '#f5f5f5', borderBottom: '1px solid #ddd', color: '#555' }}>Created Date</th>
              <th style={{ padding: '10px', backgroundColor: '#f5f5f5', borderBottom: '1px solid #ddd', color: '#555' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {salesOrders.map((order) => (
              <tr key={order.orderId}>
                <td style={{ padding: '10px' }}>{order.orderId}</td>
                <td style={{ padding: '10px' }}>{order.customerName}</td>
                <td style={{ padding: '10px' }}>{order.poNumber || '-'}</td>
                <td style={{ padding: '10px' }}>{order.status}</td>
                <td style={{ padding: '10px' }}>{order.createdDate}</td>
                <td style={{ padding: '10px' }}>
                  <button
                    onClick={() => navigate(`/sales-orders/${order.orderId}`)}
                    style={{
                      backgroundColor: '#2196F3',
                      color: '#fff',
                      padding: '5px 10px',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      marginRight: '5px',
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

export default SalesOrderList;