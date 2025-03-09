// client/src/components/ItemDetails.tsx
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

const ItemDetails: React.FC = () => {
  const { name } = useParams<{ name: string }>();
  const navigate = useNavigate();
  const [itemDetails, setItemDetails] = useState<{ name: string } | null>(null); // Placeholder, expand as needed
  const [editing, setEditing] = useState(false);
  const [editedName, setEditedName] = useState('');
  const [productionError, setProductionError] = useState<string | null>(null);

  const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || '';

  useEffect(() => {
    // For now, simulate fetching details with the name from params
    // In a real app, fetch from an API endpoint like /api/items/:name
    setItemDetails({ name: name || '' });
    setEditedName(name || '');
  }, [name]);

  const handleEdit = () => {
    setEditing(true);
  };

  const handleSave = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/items`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ oldName: name, newName: editedName }),
      });
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
      setItemDetails({ name: editedName });
      setEditing(false);
      setProductionError(null);
      navigate(`/items/${editedName}`); // Update URL with new name
    } catch (err: any) {
      console.error('Update item error:', err);
      setProductionError('Failed to update item: ' + err.message);
    }
  };

  const handleCancel = () => {
    setEditing(false);
    setEditedName(itemDetails?.name || '');
  };

  if (!itemDetails) return <div>Loading...</div>;

  return (
    <div>
      <h2>Item Details</h2>
      {productionError && <p style={{ color: 'red' }}>{productionError}</p>}
      <div>
        <label>
          Name:
          {editing ? (
            <input
              type="text"
              value={editedName}
              onChange={(e) => setEditedName(e.target.value)}
            />
          ) : (
            <span> {itemDetails.name}</span>
          )}
        </label>
      </div>
      {editing ? (
        <div style={{ marginTop: '10px' }}>
          <button onClick={handleSave}>Save</button>
          <button onClick={handleCancel} style={{ marginLeft: '10px' }}>Cancel</button>
        </div>
      ) : (
        <button onClick={handleEdit} style={{ marginTop: '10px' }}>Edit</button>
      )}
      {/* Add more fields here as needed */}
    </div>
  );
};

export default ItemDetails;