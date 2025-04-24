// client/src/components/Items.tsx
import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';

interface Item {
  name: string;
  enabled: boolean;
}

const Items: React.FC = () => {
  const [items, setItems] = useState<Item[]>([]);
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [productionError, setProductionError] = useState<string | null>(null);
  const navigate = useNavigate();

  const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || '';

  useEffect(() => {
    fetchItems();
  }, [API_BASE_URL]);

  const fetchItems = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/items`);
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
      const data = await res.json();
      setItems(data);
    } catch (err: any) {
      console.error('Fetch items error:', err);
      setProductionError('Failed to fetch items: ' + err.message);
    }
  };

  const handleAddItem = () => {
    navigate('/items/new');
  };

  const handleDeleteItems = async () => {
    if (selectedItems.length === 0) {
      setProductionError('No items selected to delete');
      return;
    }
    try {
      const res = await fetch(`${API_BASE_URL}/api/items`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ names: selectedItems }),
      });
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
      setSelectedItems([]);
      fetchItems();
      setProductionError(null);
    } catch (err: any) {
      console.error('Delete items error:', err);
      setProductionError('Failed to delete items: ' + err.message);
    }
  };

  const handleToggleEnable = async (enable: boolean) => {
    if (selectedItems.length === 0) {
      setProductionError('No items selected to enable/disable');
      return;
    }
    try {
      const res = await fetch(`${API_BASE_URL}/api/items`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ names: selectedItems, enabled: enable }),
      });
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
      setSelectedItems([]);
      fetchItems();
      setProductionError(null);
    } catch (err: any) {
      console.error('Toggle enable error:', err);
      setProductionError(`Failed to ${enable ? 'enable' : 'disable'} items: ` + err.message);
    }
  };

  const handleCheckboxChange = (name: string) => {
    setSelectedItems((prev) =>
      prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name]
    );
  };

  return (
    <div className="page-container" style={{ overflowY: 'auto', maxHeight: '100vh' }}>
      <h2 style={{ color: '#EEC930', fontSize: '24px', marginBottom: '20px', textAlign: 'center' }}>Items List</h2>
      {productionError && <div className="error">{productionError}</div>}
      <div className="inventory-actions">
        <button onClick={handleAddItem}>Add Item</button>
        <button onClick={handleDeleteItems} disabled={selectedItems.length === 0}>Delete Item</button>
        <button onClick={() => handleToggleEnable(true)} disabled={selectedItems.length === 0}>Enable Item</button>
        <button onClick={() => handleToggleEnable(false)} disabled={selectedItems.length === 0}>Disable Item</button>
      </div>
      <div className="inventory-table-container">
        <table className="inventory-table">
          <thead>
            <tr>
              <th>Select</th>
              <th>Item Name</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.name}>
                <td>
                  <input
                    type="checkbox"
                    checked={selectedItems.includes(item.name)}
                    onChange={() => handleCheckboxChange(item.name)}
                  />
                </td>
                <td>
                  <Link to={`/items/${item.name}`}>{item.name}</Link>
                </td>
                <td>{item.enabled ? 'Enabled' : 'Disabled'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default Items;