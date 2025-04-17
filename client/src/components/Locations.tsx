import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

interface Location {
  locationId: number; // Fixed from string to number
  name: string;
  siteId: string;
  enabled: number;
  abbreviation?: string;
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
  const [showModal, setShowModal] = useState(!!locationState?.fromReceive); // Auto-open modal if fromReceive
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [newLocation, setNewLocation] = useState({
    name: '',
    siteId: locationState?.siteId || '',
    abbreviation: '',
  });
  const [editLocation, setEditLocation] = useState<Location | null>(null);

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
        console.log('Fetched locations:', locationsData);
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
          abbreviation: newLocation.abbreviation || null,
          enabled: 1,
        }),
      });
      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`Failed to create location: ${errorText}`);
      }
      const newLoc = await res.json();
      setLocations([...locations, newLoc]);
      setNewLocation({ name: '', siteId: locationState?.siteId || '', abbreviation: '' });
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

  const handleEditLocation = (loc: Location) => {
    setEditLocation(loc);
  };

  const handleSaveEdit = async () => {
    if (!editLocation || !editLocation.name || !editLocation.siteId) {
      setError('Location name and site are required');
      return;
    }
    setIsSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE_URL}/api/locations/${editLocation.locationId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editLocation.name,
          siteId: editLocation.siteId,
          abbreviation: editLocation.abbreviation || null,
          enabled: editLocation.enabled,
        }),
      });
      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`Failed to update location: ${errorText}`);
      }
      setEditLocation(null);
      const [locationsRes] = await Promise.all([
        fetch(`${API_BASE_URL}/api/locations`),
      ]);
      if (!locationsRes.ok) throw new Error('Failed to fetch locations');
      const locationsData = await locationsRes.json();
      console.log('Fetched locations after update:', locationsData);
      setLocations(locationsData);
      setSuccessMessage('Location updated successfully!');
      setTimeout(() => setSuccessMessage(null), 1000);
    } catch (err: any) {
      setError('Failed to update location: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancelEdit = () => {
    setEditLocation(null);
    setError(null);
  };

  if (error && !showModal && !editLocation) {
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
      {(showModal || editLocation) && (
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
              {editLocation ? 'Edit Location' : 'Add New Location'}
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
                value={editLocation ? editLocation.name : newLocation.name}
                onChange={(e) =>
                  editLocation
                    ? setEditLocation({ ...editLocation, name: e.target.value })
                    : setNewLocation({ ...newLocation, name: e.target.value })
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
                value={editLocation ? editLocation.siteId : newLocation.siteId}
                onChange={(e) =>
                  editLocation
                    ? setEditLocation({ ...editLocation, siteId: e.target.value })
                    : setNewLocation({ ...newLocation, siteId: e.target.value })
                }
                disabled={!!locationState?.siteId && !editLocation}
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
            <div style={{ marginBottom: '15px' }}>
              <label
                style={{
                  display: 'block',
                  marginBottom: '5px',
                  fontWeight: 'bold',
                  color: '#555',
                }}
              >
                Abbreviation:
              </label>
              <input
                type="text"
                value={editLocation ? (editLocation.abbreviation || '') : newLocation.abbreviation}
                onChange={(e) =>
                  editLocation
                    ? setEditLocation({ ...editLocation, abbreviation: e.target.value })
                    : setNewLocation({ ...newLocation, abbreviation: e.target.value })
                }
                placeholder="e.g., Beer Cooler"
                style={{
                  width: '100%',
                  padding: '10px',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  fontSize: '16px',
                }}
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <button
                onClick={editLocation ? handleSaveEdit : handleCreateLocation}
                disabled={
                  (editLocation
                    ? !editLocation.name || !editLocation.siteId
                    : !newLocation.name || !newLocation.siteId) || isSubmitting
                }
                style={{
                  backgroundColor:
                    (editLocation
                      ? !editLocation.name || !editLocation.siteId
                      : !newLocation.name || !newLocation.siteId) || isSubmitting
                      ? '#ccc'
                      : '#2196F3',
                  color: '#fff',
                  padding: '10px 20px',
                  border: 'none',
                  borderRadius: '4px',
                  cursor:
                    (editLocation
                      ? !editLocation.name || !editLocation.siteId
                      : !newLocation.name || !newLocation.siteId) || isSubmitting
                      ? 'not-allowed'
                      : 'pointer',
                  fontSize: '16px',
                }}
                onMouseOver={(e) => {
                  if (
                    (editLocation
                      ? editLocation.name && editLocation.siteId
                      : newLocation.name && newLocation.siteId) &&
                    !isSubmitting
                  ) {
                    e.currentTarget.style.backgroundColor = '#1976D2';
                  }
                }}
                onMouseOut={(e) => {
                  if (
                    (editLocation
                      ? editLocation.name && editLocation.siteId
                      : newLocation.name && newLocation.siteId) &&
                    !isSubmitting
                  ) {
                    e.currentTarget.style.backgroundColor = '#2196F3';
                  }
                }}
              >
                {isSubmitting ? 'Saving...' : editLocation ? 'Save' : 'Create'}
              </button>
              <button
                onClick={editLocation ? handleCancelEdit : () => {
                  setNewLocation({ name: '', siteId: locationState?.siteId || '', abbreviation: '' });
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
              <th
                style={{
                  border: '1px solid #ddd',
                  padding: '12px',
                  backgroundColor: '#f5f5f5',
                  color: '#333',
                }}
              >
                Abbreviation
              </th>
              <th
                style={{
                  border: '1px solid #ddd',
                  padding: '12px',
                  backgroundColor: '#f5f5f5',
                  color: '#333',
                }}
              >
                Action
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
                <td
                  style={{
                    border: '1px solid #ddd',
                    padding: '12px',
                    textAlign: 'center',
                  }}
                >
                  {location.abbreviation || 'None'}
                </td>
                <td
                  style={{
                    border: '1px solid #ddd',
                    padding: '12px',
                    textAlign: 'center',
                  }}
                >
                  <button
                    onClick={() => handleEditLocation(location)}
                    style={{
                      backgroundColor: '#2196F3',
                      color: '#fff',
                      padding: '5px 10px',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                    }}
                    onMouseOver={(e) => (e.currentTarget.style.backgroundColor = '#1976D2')}
                    onMouseOut={(e) => (e.currentTarget.style.backgroundColor = '#2196F3')}
                  >
                    Edit
                  </button>
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