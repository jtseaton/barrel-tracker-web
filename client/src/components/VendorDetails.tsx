// client/src/components/VendorDetails.tsx
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

interface Vendor {
  name: string;
  type: 'Supplier' | 'Customer' | 'Distributor' | 'Delivery';
  enabled: number;
  address: string;
  email: string;
  phone: string;
}

const VendorDetails: React.FC = () => {
  const { name } = useParams<{ name: string }>();
  const navigate = useNavigate();
  const [vendorDetails, setVendorDetails] = useState<Vendor | null>(null);
  const [editing, setEditing] = useState(!name); // Edit mode if new vendor
  const [editedVendor, setEditedVendor] = useState<Vendor>({
    name: '',
    type: 'Supplier',
    enabled: 1,
    address: '',
    email: '',
    phone: '',
  });
  const [productionError, setProductionError] = useState<string | null>(null);

  const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || '';

  useEffect(() => {
    if (name) {
      fetchVendorDetails();
    }
  }, [name]);

  const fetchVendorDetails = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/vendors/${name}`);
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
      const data = await res.json();
      setVendorDetails(data);
      setEditedVendor(data);
    } catch (err: any) {
      console.error('Fetch vendor error:', err);
      setProductionError('Failed to fetch vendor: ' + err.message);
    }
  };

  const handleSave = async () => {
    try {
      const method = name ? 'PUT' : 'POST';
      const url = name ? `${API_BASE_URL}/api/vendors` : `${API_BASE_URL}/api/vendors`;
      const body = name
        ? { oldName: name, newVendor: editedVendor }
        : { ...editedVendor };
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
      setVendorDetails(editedVendor);
      setEditing(false);
      setProductionError(null);
      navigate(`/vendors/${editedVendor.name}`);
    } catch (err: any) {
      console.error('Save vendor error:', err);
      setProductionError('Failed to save vendor: ' + err.message);
    }
  };

  const handleCancel = () => {
    if (name) {
      setEditing(false);
      setEditedVendor(vendorDetails!);
    } else {
      navigate('/vendors');
    }
  };

  if (name && !vendorDetails) return <div>Loading...</div>;

  return (
    <div>
      <h2>{name ? 'Vendor Details' : 'Add New Vendor'}</h2>
      {productionError && <p style={{ color: 'red' }}>{productionError}</p>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <label>
          Name:
          {editing ? (
            <input
              type="text"
              value={editedVendor.name}
              onChange={(e) => setEditedVendor({ ...editedVendor, name: e.target.value })}
            />
          ) : (
            <span> {vendorDetails?.name}</span>
          )}
        </label>
        <label>
          Type:
          {editing ? (
            <select
              value={editedVendor.type}
              onChange={(e) => setEditedVendor({ ...editedVendor, type: e.target.value as Vendor['type'] })}
            >
              <option value="Supplier">Supplier</option>
              <option value="Customer">Customer</option>
              <option value="Distributor">Distributor</option>
              <option value="Delivery">Delivery</option>
            </select>
          ) : (
            <span> {vendorDetails?.type}</span>
          )}
        </label>
        <label>
          Address:
          {editing ? (
            <input
              type="text"
              value={editedVendor.address}
              onChange={(e) => setEditedVendor({ ...editedVendor, address: e.target.value })}
            />
          ) : (
            <span> {vendorDetails?.address || 'N/A'}</span>
          )}
        </label>
        <label>
          Email:
          {editing ? (
            <input
              type="email"
              value={editedVendor.email}
              onChange={(e) => setEditedVendor({ ...editedVendor, email: e.target.value })}
            />
          ) : (
            <span> {vendorDetails?.email || 'N/A'}</span>
          )}
        </label>
        <label>
          Phone:
          {editing ? (
            <input
              type="tel"
              value={editedVendor.phone}
              onChange={(e) => setEditedVendor({ ...editedVendor, phone: e.target.value })}
            />
          ) : (
            <span> {vendorDetails?.phone || 'N/A'}</span>
          )}
        </label>
      </div>
      {editing ? (
        <div style={{ marginTop: '10px' }}>
          <button onClick={handleSave}>Save</button>
          <button onClick={handleCancel} style={{ marginLeft: '10px' }}>Cancel</button>
        </div>
      ) : (
        <button onClick={() => setEditing(true)} style={{ marginTop: '10px' }}>Edit</button>
      )}
    </div>
  );
};

export default VendorDetails;