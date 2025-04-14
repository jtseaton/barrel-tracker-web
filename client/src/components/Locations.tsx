import React, { useState, useEffect } from 'react';
import { Site, Location } from '../types/interfaces';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:3000';

const Locations: React.FC = () => {
  const [locations, setLocations] = useState<Location[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [newLocation, setNewLocation] = useState({ name: '', siteId: '', account: 'Storage' });
  const [showModal, setShowModal] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [locationsRes, sitesRes] = await Promise.all([
          fetch(`${API_BASE_URL}/api/locations`),
          fetch(`${API_BASE_URL}/api/sites`)
        ]);
        if (!locationsRes.ok || !sitesRes.ok) throw new Error('Failed to fetch data');
        const locationsData = await locationsRes.json();
        const sitesData = await sitesRes.json();
        setLocations(locationsData);
        setSites(sitesData);
      } catch (err: any) {
        setError('Failed to load locations or sites: ' + err.message);
      }
    };
    fetchData();
  }, []);

  const handleCreateLocation = async () => {
    if (!newLocation.name || !newLocation.siteId) {
      setError('Location name and site are required');
      return;
    }
    try {
      const res = await fetch(`${API_BASE_URL}/api/locations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newLocation.name,
          siteId: newLocation.siteId,
          account: newLocation.account,
          enabled: 1
        }),
      });
      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`Failed to create location: ${errorText}`);
      }
      const newLoc = await res.json();
      setLocations([...locations, newLoc]);
      setNewLocation({ name: '', siteId: '', account: 'Storage' });
      setShowModal(false);
      setError(null);
      setSuccessMessage('Location created successfully!');
      setTimeout(() => setSuccessMessage(null), 2000);
    } catch (err: any) {
      setError('Failed to create location: ' + err.message);
    }
  };

  const getSiteName = (siteId: string) => {
    const site = sites.find(s => s.siteId === siteId);
    return site ? site.name : 'Unknown';
  };

  return (
    <div style={{ padding: '20px', maxWidth: '800px', margin: '0 auto' }}>
      <h1 style={{ color: '#EEC930', fontSize: '24px', marginBottom: '20px' }}>Locations</h1>
      {error && <div style={{ color: '#F86752', backgroundColor: '#ffe6e6', padding: '10px', borderRadius: '4px', marginBottom: '10px' }}>{error}</div>}
      {successMessage && <div style={{ color: '#28A745', backgroundColor: '#e6ffe6', padding: '10px', borderRadius: '4px', marginBottom: '10px' }}>{successMessage}</div>}
      <button
        onClick={() => setShowModal(true)}
        style={{
          backgroundColor: '#2196F3',
          color: '#fff',
          padding: '10px 20px',
          border: 'none',
          borderRadius: '4px',
          cursor: 'pointer',
          marginBottom: '20px',
          fontSize: '16px',
        }}
        onMouseOver={(e) => (e.currentTarget.style.backgroundColor = '#1976D2')}
        onMouseOut={(e) => (e.currentTarget.style.backgroundColor = '#2196F3')}
      >
        Add New Location
      </button>
      <table style={{ width: '100%', borderCollapse: 'collapse', backgroundColor: '#fff', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
        <thead>
          <tr>
            <th style={{ border: '1px solid #ddd', padding: '12px', backgroundColor: '#f5f5f5', fontWeight: 'bold', color: '#555' }}>Location Name</th>
            <th style={{ border: '1px solid #ddd', padding: '12px', backgroundColor: '#f5f5f5', fontWeight: 'bold', color: '#555' }}>Site</th>
            <th style={{ border: '1px solid #ddd', padding: '12px', backgroundColor: '#f5f5f5', fontWeight: 'bold', color: '#555' }}>Account</th>
          </tr>
        </thead>
        <tbody>
          {locations.map(loc => (
            <tr key={loc.locationId}>
              <td style={{ border: '1px solid #ddd', padding: '8px' }}>{loc.name}</td>
              <td style={{ border: '1px solid #ddd', padding: '8px' }}>{getSiteName(loc.siteId)}</td>
              <td style={{ border: '1px solid #ddd', padding: '8px' }}>{loc.account}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {showModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 2000 }}>
          <div style={{ backgroundColor: '#fff', padding: '20px', borderRadius: '8px', width: '400px', boxShadow: '0 4px 8px rgba(0,0,0,0.2)' }}>
            <h2 style={{ color: '#555', marginBottom: '20px', textAlign: 'center' }}>Add New Location</h2>
            <div style={{ marginBottom: '15px' }}>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', color: '#555' }}>Name:</label>
              <input
                type="text"
                value={newLocation.name}
                onChange={e => setNewLocation({ ...newLocation, name: e.target.value })}
                placeholder="e.g., Distillery Grain Storage"
                style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '4px', fontSize: '16px' }}
              />
            </div>
            <div style={{ marginBottom: '15px' }}>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', color: '#555' }}>Site:</label>
              <select
                value={newLocation.siteId}
                onChange={e => setNewLocation({ ...newLocation, siteId: e.target.value })}
                style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '4px', fontSize: '16px' }}
              >
                <option value="">Select a site</option>
                {sites.map(site => (
                  <option key={site.siteId} value={site.siteId}>{site.name}</option>
                ))}
              </select>
            </div>
            <div style={{ marginBottom: '15px' }}>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', color: '#555' }}>Account:</label>
              <select
                value={newLocation.account}
                onChange={e => setNewLocation({ ...newLocation, account: e.target.value })}
                style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '4px', fontSize: '16px' }}
              >
                <option value="Storage">Storage</option>
                <option value="Processing">Processing</option>
                <option value="Production">Production</option>
              </select>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <button
                onClick={handleCreateLocation}
                style={{
                  backgroundColor: '#2196F3',
                  color: '#fff',
                  padding: '10px 20px',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '16px',
                }}
                onMouseOver={(e) => (e.currentTarget.style.backgroundColor = '#1976D2')}
                onMouseOut={(e) => (e.currentTarget.style.backgroundColor = '#2196F3')}
              >
                Create
              </button>
              <button
                onClick={() => {
                  setNewLocation({ name: '', siteId: '', account: 'Storage' });
                  setShowModal(false);
                  setError(null);
                }}
                style={{
                  backgroundColor: '#F86752',
                  color: '#fff',
                  padding: '10px 20px',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '16px',
                }}
                onMouseOver={(e) => (e.currentTarget.style.backgroundColor = '#D32F2F')}
                onMouseOut={(e) => (e.currentTarget.style.backgroundColor = '#F86752')}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Locations;