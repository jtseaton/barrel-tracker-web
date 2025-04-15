import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

interface Location {
  locationId: string;
  name: string;
  siteId: string;
  enabled: number;
}

interface Site {
  siteId: string;
  name: string;
}

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:3000';

const Locations: React.FC = () => {
  const navigate = useNavigate();
  const locationState = useLocation().state as { fromReceive?: boolean; siteId?: string };
  const [locations, setLocations] = useState<Location[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(true); // Auto-open modal if fromReceive
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [newLocation, setNewLocation] = useState({
    name: '',
    siteId: locationState?.siteId || '',
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [locationsRes, sitesRes] = await Promise.all([
          fetch(`${API_BASE_URL}/api/locations`),
          fetch(`${API_BASE_URL}/api/sites`),
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
    setIsSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE_URL}/api/locations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newLocation.name,
          siteId: newLocation.siteId,
          enabled: 1,
        }),
      });
      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`Failed to create location: ${errorText}`);
      }
      const newLoc = await res.json();
      setLocations([...locations, newLoc]);
      setNewLocation({ name: '', siteId: locationState?.siteId || '' });
      setShowModal(false);
      setSuccessMessage('Location created successfully!');
      setTimeout(() => {
        setSuccessMessage(null);
        if (locationState?.fromReceive) {
          navigate('/receive', { state: { newLocationId: newLoc.locationId.toString() } });
        }
      }, 1000);
    } catch (err: any) {
      setError('Failed to create location: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (error && !showModal) {
    return <div style={{ color: 'red', textAlign: 'center', marginTop: '20px' }}>{error}</div>;
  }

  return (
    <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif' }}>
      <h2 style={{ color: '#333', marginBottom: '20px' }}>Locations</h2>
      {successMessage && (
        <div style={{ color: 'green', marginBottom: '15px', textAlign: 'center' }}>
          {successMessage}
        </div>
      )}
      {!locationState?.fromReceive && (
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
      )}
      {showModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 2000,
          }}
        >
          <div
            style={{
              backgroundColor: '#fff',
              padding: '20px',
              borderRadius: '8px',
              width: '400px',
              boxShadow: '0 4px 8px rgba(0,0,0,0.2)',
            }}
          >
            <h2 style={{ color: '#555', marginBottom: '20px', textAlign: 'center' }}>
              Add New Location
            </h2>
            {error && (
              <div style={{ color: 'red', marginBottom: '15px', textAlign: 'center' }}>
                {error}
              </div>
            )}
            <div style={{ marginBottom: '15px' }}>
              <label
                style={{
                  display: 'block',
                  marginBottom: '5px',
                  fontWeight: 'bold',
                  color: '#555',
                }}
              >
                Name:
              </label>
              <input
                type="text"
                value={newLocation.name}
                onChange={(e) =>
                  setNewLocation({ ...newLocation, name: e.target.value })
                }
                placeholder="e.g., Cold Storage"
                style={{
                  width: '100%',
                  padding: '10px',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  fontSize: '16px',
                }}
              />
            </div>
            <div style={{ marginBottom: '15px' }}>
              <label
                style={{
                  display: 'block',
                  marginBottom: '5px',
                  fontWeight: 'bold',
                  color: '#555',
                }}
              >
                Site:
              </label>
              <select
                value={newLocation.siteId}
                onChange={(e) =>
                  setNewLocation({ ...newLocation, siteId: e.target.value })
                }
                disabled={!!locationState?.siteId}
                style={{
                  width: '100%',
                  padding: '10px',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  fontSize: '16px',
                }}
              >
                <option value="">Select a site</option>
                {sites.map((site) => (
                  <option key={site.siteId} value={site.siteId}>
                    {site.name}
                  </option>
                ))}
              </select>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <button
                onClick={handleCreateLocation}
                disabled={!newLocation.name || !newLocation.siteId || isSubmitting}
                style={{
                  backgroundColor:
                    !newLocation.name || !newLocation.siteId || isSubmitting
                      ? '#ccc'
                      : '#2196F3',
                  color: '#fff',
                  padding: '10px 20px',
                  border: 'none',
                  borderRadius: '4px',
                  cursor:
                    !newLocation.name || !newLocation.siteId || isSubmitting
                      ? 'not-allowed'
                      : 'pointer',
                  fontSize: '16px',
                }}
                onMouseOver={(e) => {
                  if (newLocation.name && newLocation.siteId && !isSubmitting) {
                    e.currentTarget.style.backgroundColor = '#1976D2';
                  }
                }}
                onMouseOut={(e) => {
                  if (newLocation.name && newLocation.siteId && !isSubmitting) {
                    e.currentTarget.style.backgroundColor = '#2196F3';
                  }
                }}
              >
                {isSubmitting ? 'Creating...' : 'Create'}
              </button>
              <button
                onClick={() => {
                  setNewLocation({ name: '', siteId: locationState?.siteId || '' });
                  setShowModal(false);
                  setError(null);
                  if (locationState?.fromReceive) {
                    navigate('/receive');
                  }
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
      {!locationState?.fromReceive && (
        <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '20px' }}>
          <thead>
            <tr>
              <th
                style={{
                  border: '1px solid #ddd',
                  padding: '12px',
                  backgroundColor: '#f5f5f5',
                  color: '#333',
                }}
              >
                Location Name
              </th>
              <th
                style={{
                  border: '1px solid #ddd',
                  padding: '12px',
                  backgroundColor: '#f5f5f5',
                  color: '#333',
                }}
              >
                Site
              </th>
            </tr>
          </thead>
          <tbody>
            {locations.map((location) => (
              <tr key={location.locationId}>
                <td
                  style={{
                    border: '1px solid #ddd',
                    padding: '12px',
                    textAlign: 'center',
                  }}
                >
                  {location.name}
                </td>
                <td
                  style={{
                    border: '1px solid #ddd',
                    padding: '12px',
                    textAlign: 'center',
                  }}
                >
                  {sites.find((site) => site.siteId === location.siteId)?.name ||
                    'Unknown Site'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
};

export default Locations;