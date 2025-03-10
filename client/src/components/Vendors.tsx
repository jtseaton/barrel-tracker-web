// client/src/components/Vendors.tsx
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

interface Vendor {
  name: string;
  enabled: boolean;
}

const Vendors: React.FC = () => {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [selectedVendors, setSelectedVendors] = useState<string[]>([]);
  const [newVendorName, setNewVendorName] = useState('');
  const [productionError, setProductionError] = useState<string | null>(null);

  const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || '';

  useEffect(() => {
    fetchVendors();
  }, [API_BASE_URL]);

  const fetchVendors = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/vendors`);
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
      const data = await res.json();
      setVendors(data);
    } catch (err: any) {
      console.error('Fetch vendors error:', err);
      setProductionError('Failed to fetch vendors: ' + err.message);
    }
  };

  const handleAddVendor = async () => {
    if (!newVendorName) {
      setProductionError('Vendor name is required');
      return;
    }
    try {
      const res = await fetch(`${API_BASE_URL}/api/vendors`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newVendorName, type: 'Supplier', enabled: 1, address: '', email: '', phone: '' }), // Defaults
      });
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
      setNewVendorName('');
      fetchVendors(); // Refresh list
      setProductionError(null);
    } catch (err: any) {
      console.error('Add vendor error:', err);
      setProductionError('Failed to add vendor: ' + err.message);
    }
  };

  const handleDeleteVendors = async () => {
    if (selectedVendors.length === 0) {
      setProductionError('No vendors selected to delete');
      return;
    }
    try {
      const res = await fetch(`${API_BASE_URL}/api/vendors`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ names: selectedVendors }),
      });
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
      setSelectedVendors([]);
      fetchVendors();
      setProductionError(null);
    } catch (err: any) {
      console.error('Delete vendors error:', err);
      setProductionError('Failed to delete vendors: ' + err.message);
    }
  };

  const handleToggleEnable = async (enable: boolean) => {
    if (selectedVendors.length === 0) {
      setProductionError('No vendors selected to enable/disable');
      return;
    }
    try {
      const res = await fetch(`${API_BASE_URL}/api/vendors`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ names: selectedVendors, enabled: enable }),
      });
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
      setSelectedVendors([]);
      fetchVendors();
      setProductionError(null);
    } catch (err: any) {
      console.error('Toggle enable error:', err);
      setProductionError(`Failed to ${enable ? 'enable' : 'disable'} vendors: ` + err.message);
    }
  };

  const handleCheckboxChange = (name: string) => {
    setSelectedVendors((prev) =>
      prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name]
    );
  };

  return (
    <div>
      <h2>Vendors List</h2>
      {productionError && <p style={{ color: 'red' }}>{productionError}</p>}
      <div style={{ marginBottom: '20px' }}>
        <input
          type="text"
          value={newVendorName}
          onChange={(e) => setNewVendorName(e.target.value)}
          placeholder="New Vendor Name"
          style={{ marginRight: '10px' }}
        />
        <button onClick={handleAddVendor}>Add Vendor</button>
        <button onClick={handleDeleteVendors} style={{ marginLeft: '10px' }}>Delete Vendor</button>
        <button onClick={() => handleToggleEnable(true)} style={{ marginLeft: '10px' }}>Enable Vendor</button>
        <button onClick={() => handleToggleEnable(false)} style={{ marginLeft: '10px' }}>Disable Vendor</button>
      </div>
      <table>
        <thead>
          <tr>
            <th>Select</th>
            <th>Vendor Name</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {vendors.map((vendor) => (
            <tr key={vendor.name}>
              <td>
                <input
                  type="checkbox"
                  checked={selectedVendors.includes(vendor.name)}
                  onChange={() => handleCheckboxChange(vendor.name)}
                />
              </td>
              <td>
                <Link to={`/vendors/${vendor.name}`}>{vendor.name}</Link>
              </td>
              <td>{vendor.enabled ? 'Enabled' : 'Disabled'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default Vendors;