// client/src/components/ItemDetails.tsx
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

interface Item {
  name: string;
}

const ItemDetails: React.FC = () => {
  const { name } = useParams<{ name: string }>();
  const navigate = useNavigate();
  const [itemDetails, setItemDetails] = useState<Item | null>(null);
  const [editing, setEditing] = useState(name === 'new'); // Edit mode only for new
  const [editedItem, setEditedItem] = useState<Item>({ name: '' });
  const [productionError, setProductionError] = useState<string | null>(null);

  const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || '';

  useEffect(() => {
    if (name && name !== 'new') {
      fetchItemDetails();
    }
  }, [name]);

  const fetchItemDetails = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/items/${name}`);
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
      const data = await res.json();
      setItemDetails({ name: data.name });
      setEditedItem({ name: data.name });
    } catch (err: any) {
      console.error('Fetch item error:', err);
      setProductionError('Failed to fetch item: ' + err.message);
    }
  };

  const handleSave = async () => {
    if (!editedItem.name) {
      setProductionError('Item name is required');
      return;
    }
    try {
      const method = name && name !== 'new' ? 'PUT' : 'POST';
      const url = `${API_BASE_URL}/api/items`;
      const body = method === 'PUT'
        ? { oldName: name, newName: editedItem.name }
        : { name: editedItem.name };
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
      setItemDetails(editedItem);
      setEditing(false);
      setProductionError(null);
      navigate(`/items/${editedItem.name}`);
    } catch (err: any) {
      console.error('Save item error:', err);
      setProductionError('Failed to save item: ' + err.message);
    }
  };

  const handleCancel = () => {
    if (name && name !== 'new') {
      setEditing(false);
      setEditedItem(itemDetails!);
    } else {
      navigate('/items');
    }
  };

  if (name && name !== 'new' && !itemDetails) return <div>Loading...</div>;

  return (
    <div style={{ padding: '20px', backgroundColor: '#2E4655', borderRadius: '8px', maxWidth: '600px', margin: '20px auto' }}>
      <h2 style={{ color: '#EEC930', fontSize: '28px', marginBottom: '20px' }}>
        {name === 'new' ? 'Add New Item' : 'Item Details'}
      </h2>
      {productionError && <p style={{ color: '#F86752', fontSize: '16px' }}>{productionError}</p>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
        <label style={{ color: '#EEC930', fontSize: '18px' }}>
          Name:
          {editing ? (
            <input
              type="text"
              value={editedItem.name}
              onChange={(e) => setEditedItem({ ...editedItem, name: e.target.value })}
              style={{ width: '100%', padding: '10px', fontSize: '16px', borderRadius: '4px', border: '1px solid #000000', marginTop: '5px' }}
            />
          ) : (
            <span style={{ color: '#FFFFFF', marginLeft: '10px' }}>{itemDetails?.name}</span>
          )}
        </label>
      </div>
      {editing && (
        <div style={{ marginTop: '20px', textAlign: 'center' }}>
          <button
            onClick={handleSave}
            style={{ backgroundColor: '#F86752', color: '#FFFFFF', padding: '10px 20px', border: 'none', borderRadius: '4px', fontSize: '16px', cursor: 'pointer' }}
          >
            Save
          </button>
          <button
            onClick={handleCancel}
            style={{ backgroundColor: '#000000', color: '#EEC930', padding: '10px 20px', border: 'none', borderRadius: '4px', fontSize: '16px', marginLeft: '10px', cursor: 'pointer' }}
          >
            Cancel
          </button>
        </div>
      )}
      {!editing && (
        <div style={{ marginTop: '20px', textAlign: 'center' }}>
          <button
            onClick={() => setEditing(true)}
            style={{ backgroundColor: '#F86752', color: '#FFFFFF', padding: '10px 20px', border: 'none', borderRadius: '4px', fontSize: '16px', cursor: 'pointer' }}
          >
            Edit
          </button>
        </div>
      )}
    </div>
  );
};

export default ItemDetails;