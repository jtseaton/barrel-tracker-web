// client/src/components/Vendors.tsx
import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Vendor } from '../types/interfaces';
import 'bootstrap/dist/css/bootstrap.min.css';
import '../App.css';

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
    refreshVendors();
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
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ names: selectedVendors }),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`HTTP error! status: ${res.status}, ${text.slice(0, 50)}`);
      }
      console.log('[Vendors] Deleted vendors:', selectedVendors);
      setSelectedVendors([]);
      await refreshVendors();
      setProductionError(null);
    } catch (err: any) {
      setProductionError('Failed to delete vendors: ' + err.message);
      console.error('[Vendors] Delete vendors error:', err);
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
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ names: selectedVendors, enabled: enable }),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`HTTP error! status: ${res.status}, ${text.slice(0, 50)}`);
      }
      console.log('[Vendors] Toggled enable:', { enable, vendors: selectedVendors });
      setSelectedVendors([]);
      await refreshVendors();
      setProductionError(null);
    } catch (err: any) {
      setProductionError(`Failed to ${enable ? 'enable' : 'disable'} vendors: ` + err.message);
      console.error('[Vendors] Toggle enable error:', err);
    }
  };

  const handleCheckboxChange = (name: string) => {
    setSelectedVendors((prev) =>
      prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name]
    );
  };

  console.log('[Vendors] Render:', {
    vendorsLength: vendors.length,
    selectedVendors,
    isMobile: window.innerWidth <= 768 ? 'cards' : 'table',
    productionError,
  });

  return (
    <div className="page-container container">
      <h2 className="app-header mb-4">Vendors List</h2>
      {productionError && <div className="alert alert-danger">{productionError}</div>}
      <div className="inventory-actions mb-4">
        <button onClick={handleAddVendor} className="btn btn-primary">
          Add Vendor
        </button>
        <button onClick={handleDeleteVendors} className="btn btn-danger">
          Delete Vendor
        </button>
        <button onClick={() => handleToggleEnable(true)} className="btn btn-primary">
          Enable Vendor
        </button>
        <button onClick={() => handleToggleEnable(false)} className="btn btn-primary">
          Disable Vendor
        </button>
      </div>
      <div className="inventory-table-container">
        {vendors.length > 0 ? (
          <>
            <table className="inventory-table table table-striped">
              <thead>
                <tr>
                  <th>
                    <input
                      type="checkbox"
                      checked={selectedVendors.length === vendors.length && vendors.length > 0}
                      onChange={() =>
                        setSelectedVendors(
                          selectedVendors.length === vendors.length ? [] : vendors.map(v => v.name)
                        )
                      }
                    />
                  </th>
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
                      <Link to={`/vendors/${vendor.name}`} className="text-primary text-decoration-underline">
                        {vendor.name}
                      </Link>
                    </td>
                    <td>{vendor.enabled ? 'Enabled' : 'Disabled'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="vendor-card-list">
              {vendors.map((vendor) => (
                <div key={vendor.name} className="vendor-card-item card mb-2">
                  <div className="card-body">
                    <input
                      type="checkbox"
                      checked={selectedVendors.includes(vendor.name)}
                      onChange={() => handleCheckboxChange(vendor.name)}
                      className="me-2"
                    />
                    <p className="card-text">
                      <strong>Name:</strong>{' '}
                      <Link to={`/vendors/${vendor.name}`} className="text-primary text-decoration-underline">
                        {vendor.name}
                      </Link>
                    </p>
                    <p className="card-text"><strong>Status:</strong> {vendor.enabled ? 'Enabled' : 'Disabled'}</p>
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="alert alert-info text-center">No vendors found.</div>
        )}
      </div>
    </div>
  );
};

export default Vendors;