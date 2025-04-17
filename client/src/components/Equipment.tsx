// src/components/Equipment.tsx
import React, { useState, useEffect } from 'react';
import { Site, Equipment } from '../types/interfaces';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:3000';

const Equipment: React.FC = () => {
  const [sites, setSites] = useState<Site[]>([]);
  const [siteId, setSiteId] = useState<string>('');
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [name, setName] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Fetch sites
  useEffect(() => {
    fetch(`${API_BASE_URL}/api/sites`)
      .then((res) => res.json())
      .then((data) => setSites(data))
      .catch((err) => setError('Failed to load sites: ' + err.message));
  }, []);

  // Fetch equipment for selected site
  useEffect(() => {
    if (siteId) {
      fetch(`${API_BASE_URL}/api/equipment?siteId=${siteId}`)
        .then((res) => res.json())
        .then((data) => setEquipment(data))
        .catch((err) => setError('Failed to load equipment: ' + err.message));
    } else {
      setEquipment([]);
    }
  }, [siteId]);

  // Handle form submission
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!siteId || !name) {
      setError('Site and equipment name are required');
      return;
    }
    fetch(`${API_BASE_URL}/api/equipment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, siteId, enabled: 1 }),
    })
      .then((res) => res.json())
      .then((data) => {
        setSuccessMessage(data.message);
        setName('');
        setEquipment([...equipment, { equipmentId: data.equipmentId, name, siteId, enabled: 1 }]);
        setTimeout(() => setSuccessMessage(null), 2000);
      })
      .catch((err) => setError('Failed to add equipment: ' + err.message));
  };

  return (
    <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif', maxWidth: '1200px', margin: '0 auto' }}>
      <h2 style={{ color: '#333', marginBottom: '20px', textAlign: 'center' }}>Manage Equipment</h2>
      {error && (
        <div style={{ color: 'red', marginBottom: '15px', textAlign: 'center' }}>{error}</div>
      )}
      {successMessage && (
        <div style={{ color: 'green', marginBottom: '15px', textAlign: 'center' }}>{successMessage}</div>
      )}
      <div style={{ display: 'flex' }}>
        {/* Form */}
        <div style={{
          width: '400px',
          marginRight: '20px',
          backgroundColor: '#fff',
          padding: '20px',
          borderRadius: '8px',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
        }}>
          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: '15px' }}>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', color: '#555' }}>
                Site:
              </label>
              <select
                value={siteId}
                onChange={(e) => setSiteId(e.target.value)}
                style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '4px', fontSize: '16px' }}
              >
                <option value="">Select Site</option>
                {sites.map((site) => (
                  <option key={site.siteId} value={site.siteId}>
                    {site.name}
                  </option>
                ))}
              </select>
            </div>
            <div style={{ marginBottom: '15px' }}>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', color: '#555' }}>
                Equipment Name:
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Fermenter 1"
                style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '4px', fontSize: '16px' }}
              />
            </div>
            <button
              type="submit"
              style={{
                width: '100%',
                padding: '10px',
                backgroundColor: '#2196F3',
                color: '#fff',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '16px',
              }}
              onMouseOver={(e) => (e.currentTarget.style.backgroundColor = '#1976D2')}
              onMouseOut={(e) => (e.currentTarget.style.backgroundColor = '#2196F3')}
            >
              Add Equipment
            </button>
          </form>
        </div>
        {/* Equipment List */}
        <div style={{
          flex: 1,
          backgroundColor: '#fff',
          padding: '20px',
          borderRadius: '8px',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
        }}>
          <h3 style={{ color: '#555', marginBottom: '10px' }}>Equipment List</h3>
          {equipment.length === 0 ? (
            <p style={{ color: '#777' }}>No equipment found for this site</p>
          ) : (
            <ul style={{ listStyle: 'none', padding: 0 }}>
              {equipment.map((eq) => (
                <li
                  key={eq.equipmentId}
                  style={{ padding: '10px', borderBottom: '1px solid #eee', color: '#333' }}
                >
                  {eq.name}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
};

export default Equipment;