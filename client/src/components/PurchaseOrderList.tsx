import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

interface PurchaseOrder {
  poNumber: string;
  poDate: string;
  supplier: string;
  items: { name: string; quantity: number }[];
}

const PurchaseOrderList: React.FC = () => {
  const { name } = useParams<{ name: string }>();
  const navigate = useNavigate();
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [error, setError] = useState<string | null>(null);

  const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || '';

  useEffect(() => {
    if (name) fetchPurchaseOrders();
  }, [name]);

  const fetchPurchaseOrders = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/purchase-orders?supplier=${name}`);
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
      const data = await res.json();
      setPurchaseOrders(data);
    } catch (err: any) {
      console.error('Fetch POs error:', err);
      setError('Failed to fetch purchase orders: ' + err.message);
    }
  };

  const handleEdit = (poNumber: string) => {
    navigate(`/vendors/${name}/purchase-orders/${poNumber}`);
  };

  const handleCreateNew = () => {
    navigate(`/vendors/${name}/purchase-orders/new`);
  };

  return (
    <div style={{ 
      padding: '20px', 
      backgroundColor: '#2E4655', 
      borderRadius: '8px', 
      maxWidth: '800px', 
      margin: '20px auto',
    }}>
      <h2 style={{ color: '#EEC930', fontSize: '28px', marginBottom: '20px' }}>
        Purchase Orders for {name}
      </h2>
      {error && <p style={{ color: '#F86752', fontSize: '16px' }}>{error}</p>}
      <button
        onClick={handleCreateNew}
        style={{ backgroundColor: '#F86752', color: '#FFFFFF', padding: '10px 20px', border: 'none', borderRadius: '4px', fontSize: '16px', cursor: 'pointer', marginBottom: '20px' }}
      >
        Create New Purchase Order
      </button>
      <ul style={{ listStyle: 'none', padding: 0 }}>
        {purchaseOrders.map((po) => (
          <li 
            key={po.poNumber} 
            onClick={() => handleEdit(po.poNumber)}
            style={{ 
              color: '#FFFFFF', 
              padding: '10px', 
              backgroundColor: '#3A5A6A', 
              borderRadius: '4px', 
              marginBottom: '10px', 
              cursor: 'pointer',
              display: 'flex',
              justifyContent: 'space-between',
            }}
          >
            <span>PO #{po.poNumber} - {po.poDate}</span>
            <span>{po.items.length} items</span>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default PurchaseOrderList;