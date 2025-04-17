import React, { useState, useEffect } from 'react';
import { Site, Equipment } from '../types/interfaces';

const API_BASE_URL: string = process.env.REACT_APP_API_BASE_URL || 'http://localhost:3000';

const EquipmentPage: React.FC = () => {
  const [sites, setSites] = useState<Site[]>([]);
  const [siteId, setSiteId] = useState<string>('');
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [name, setName] = useState<string>('');
  const [abbreviation, setAbbreviation] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [editingEquipmentId, setEditingEquipmentId] = useState<number | null>(null);
  const [editName, setEditName] = useState<string>('');
  const [editAbbreviation, setEditAbbreviation] = useState<string>('');
  const [editSiteId, setEditSiteId] = useState<string>('');

  // Fetch sites and equipment concurrently
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [sitesResponse, equipmentResponse] = await Promise.all([
          fetch(`${API_BASE_URL}/api/sites`).then((res) => res.json()),
          siteId
            ? fetch(`${API_BASE_URL}/api/equipment?siteId=${siteId}`).then((res) => res.json())
            : Promise.resolve([]),
        ]);
        setSites(sitesResponse);
        setEquipment(equipmentResponse);
      } catch (err) {
        setError('Failed to load data: ' + (err instanceof Error ? err.message : 'Unknown error'));
      }
    };
    fetchData();
  }, [siteId]);

  // Handle add equipment submission
  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!siteId || !name || !abbreviation) {
      setError('Site, equipment name, and abbreviation are required');
      return;
    }
    fetch(`${API_BASE_URL}/api/equipment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, abbreviation, siteId, enabled: 1 }),
    })
      .then((res) => res.json())
      .then((data: { equipmentId: number; message: string }) => {
        setSuccessMessage(data.message);
        setName('');
        setAbbreviation('');
        setEquipment([...equipment, { equipmentId: data.equipmentId, name, abbreviation, siteId, enabled: 1 }]);
        setTimeout(() => setSuccessMessage(null), 2000);
      })
      .catch((err) => setError('Failed to add equipment: ' + (err instanceof Error ? err.message : 'Unknown error')));
  };

  // Handle edit equipment click
  const handleEditClick = (eq: Equipment) => {
    setEditingEquipmentId(eq.equipmentId);
    setEditName(eq.name);
    setEditAbbreviation(eq.abbreviation || '');
    setEditSiteId(eq.siteId);
  };

  // Handle edit equipment submission
  const handleEditSubmit = (e: React.FormEvent<HTMLFormElement>, equipmentId: number) => {
    e.preventDefault();
    if (!editName || !editAbbreviation || !editSiteId) {
      setError('Name, abbreviation, and site are required');
      return;
    }
    fetch(`${API_BASE_URL}/api/equipment/${equipmentId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: editName, abbreviation: editAbbreviation, siteId: editSiteId, enabled: 1 }),
    })
      .then((res) => res.json())
      .then((data: { message: string }) => {
        setSuccessMessage(data.message);
        setEquipment(
          equipment.map((eq) =>
            eq.equipmentId === equipmentId
              ? { ...eq, name: editName, abbreviation: editAbbreviation, siteId: editSiteId }
              : eq
          )
        );
        setEditingEquipmentId(null);
        setEditName('');
        setEditAbbreviation('');
        setEditSiteId('');
        setTimeout(() => setSuccessMessage(null), 2000);
      })
      .catch((err) => setError('Failed to update equipment: ' + (err instanceof Error ? err.message : 'Unknown error')));
  };

  // Cancel editing
  const handleCancelEdit = () => {
    setEditingEquipmentId(null);
    setEditName('');
    setEditAbbreviation('');
    setEditSiteId('');
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
        {/* Add Equipment Form */}
        <div
          style={{
            width: '400px',
            marginRight: '20px',
            backgroundColor: '#fff',
            padding: '20px',
            borderRadius: '8px',
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
          }}
        >
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
                {sites.map((site: Site) => (
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
            <div style={{ marginBottom: '15px' }}>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', color: '#555' }}>
                Abbreviation:
              </label>
              <input
                type="text"
                value={abbreviation}
                onChange={(e) => setAbbreviation(e.target.value)}
                placeholder="e.g., FRM1"
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
        <div
          style={{
            flex: 1,
            backgroundColor: '#fff',
            padding: '20px',
            borderRadius: '8px',
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
          }}
        >
          <h3 style={{ color: '#555', marginBottom: '10px' }}>Equipment List</h3>
          {equipment.length === 0 ? (
            <p style={{ color: '#777' }}>No equipment found for this site</p>
          ) : (
            <ul style={{ listStyle: 'none', padding: 0 }}>
              {equipment.map((eq: Equipment) => (
                <li
                  key={eq.equipmentId}
                  style={{ padding: '10px', borderBottom: '1px solid #eee', color: '#333' }}
                >
                  {editingEquipmentId === eq.equipmentId ? (
                    <form onSubmit={(e) => handleEditSubmit(e, eq.equipmentId)}>
                      <div style={{ marginBottom: '10px' }}>
                        <input
                          type="text"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          placeholder="Equipment Name"
                          style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
                        />
                      </div>
                      <div style={{ marginBottom: '10px' }}>
                        <input
                          type="text"
                          value={editAbbreviation}
                          onChange={(e) => setEditAbbreviation(e.target.value)}
                          placeholder="Abbreviation"
                          style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
                        />
                      </div>
                      <div style={{ marginBottom: '10px' }}>
                        <select
                          value={editSiteId}
                          onChange={(e) => setEditSiteId(e.target.value)}
                          style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
                        >
                          <option value="">Select Site</option>
                          {sites.map((site: Site) => (
                            <option key={site.siteId} value={site.siteId}>
                              {site.name}
                            </option>
                          ))}
                        </select>
                      </div>
                      <button
                        type="submit"
                        style={{
                          padding: '8px',
                          backgroundColor: '#2196F3',
                          color: '#fff',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          marginRight: '10px',
                        }}
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        onClick={handleCancelEdit}
                        style={{
                          padding: '8px',
                          backgroundColor: '#f44336',
                          color: '#fff',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer',
                        }}
                      >
                        Cancel
                      </button>
                    </form>
                  ) : (
                    <div
                      style={{ cursor: 'pointer' }}
                      onClick={() => handleEditClick(eq)}
                    >
                      {eq.name} ({eq.abbreviation}) - {eq.siteId}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
};

export default EquipmentPage;