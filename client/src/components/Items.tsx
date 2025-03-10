// client/src/components/Items.tsx
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

interface Item {
  name: string;
  enabled: boolean;
}

const Items: React.FC = () => {
  const [items, setItems] = useState<Item[]>([]);
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [newItemName, setNewItemName] = useState('');
  const [productionError, setProductionError] = useState<string | null>(null);

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

  const handleAddItem = async () => {
    if (!newItemName) {
      setProductionError('Item name is required');
      return;
    }
    try {
      const res = await fetch(`${API_BASE_URL}/api/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newItemName }),
      });
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
      setNewItemName('');
      fetchItems(); // Refresh list
      setProductionError(null);
    } catch (err: any) {
      console.error('Add item error:', err);
      setProductionError('Failed to add item: ' + err.message);
    }
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
      fetchItems(); // Refresh list
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
      fetchItems(); // Refresh list
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
    <div>
      <h2>Items List</h2>
      {productionError && <p style={{ color: 'red' }}>{productionError}</p>}
      <div style={{ marginBottom: '20px' }}>
        <input
          type="text"
          value={newItemName}
          onChange={(e) => setNewItemName(e.target.value)}
          placeholder="New Item Name"
          style={{ marginRight: '10px' }}
        />
        <button onClick={handleAddItem}>Add Item</button>
        <button onClick={handleDeleteItems} style={{ marginLeft: '10px' }}>Delete Item</button>
        <button onClick={() => handleToggleEnable(true)} style={{ marginLeft: '10px' }}>Enable Item</button>
        <button onClick={() => handleToggleEnable(false)} style={{ marginLeft: '10px' }}>Disable Item</button>
      </div>
      <table>
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
  );
};

export default Items;