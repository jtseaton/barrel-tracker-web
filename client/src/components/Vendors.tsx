import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Vendor } from '../types/interfaces'; // Updated import

interface VendorsProps {
  vendors: Vendor[];
  refreshVendors: () => Promise<void>;
}

const Vendors: React.FC<VendorsProps> = ({ vendors, refreshVendors }) => {
  const [selectedVendors, setSelectedVendors] = useState<string[]>([]);
  const [productionError, setProductionError] = useState<string | null>(null);
  const navigate = useNavigate();

  const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || '';

  useEffect(() => {
    refreshVendors(); // Fetch on mount
  }, [refreshVendors]);

  const handleAddVendor = () => {
    navigate('/vendors/new');
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
      await refreshVendors();
      setProductionError(null);
    } catch (err: any) {
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
      await refreshVendors();
      setProductionError(null);
    } catch (err: any) {
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
      {productionError && <p style={{ color: '#F86752' }}>{productionError}</p>}
      <div style={{ marginBottom: '20px' }}>
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