import React from 'react';
import { useNavigate } from 'react-router-dom';

const SalesDashboard: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="sales-dashboard">
      <h2>Sales & Distribution</h2>
      <div className="dashboard-buttons">
        <button
          onClick={() => navigate('/sales-orders')}
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
          Create Sales Order
        </button>
        <button
          onClick={() => navigate('/invoices')}
          style={{
            backgroundColor: '#2196F3',
            color: '#fff',
            padding: '10px 20px',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
          }}
        >
          View Invoices
        </button>
      </div>
    </div>
  );
};

export default SalesDashboard;