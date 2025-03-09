// client/src/components/Items.tsx
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

const Items: React.FC = () => {
  const [items, setItems] = useState<string[]>([]);
  const [productionError, setProductionError] = useState<string | null>(null);

  const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || '';

  useEffect(() => {
    const fetchItems = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/items`);
        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
        const data = await res.json();
        setItems(data.map((item: { name: string }) => item.name));
      } catch (err: any) {
        console.error('Fetch items error:', err);
        setProductionError('Failed to fetch items: ' + err.message);
      }
    };
    fetchItems();
  }, [API_BASE_URL]);

  return (
    <div>
      <h2>Items List</h2>
      {productionError && <p style={{ color: 'red' }}>{productionError}</p>}
      <table>
        <thead>
          <tr>
            <th>Item Name</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item}>
              <td>
                <Link to={`/items/${item}`}>{item}</Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default Items;