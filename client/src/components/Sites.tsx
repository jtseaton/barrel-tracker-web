import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

interface Site {
  siteId: string;
  name: string;
  type?: string;
  address?: string;
  enabled?: number;
}

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:3000';

const Sites: React.FC = () => {
  const navigate = useNavigate();
  const locationState = useLocation().state as { fromReceive?: boolean };
  const [sites, setSites] = useState<Site[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [newSite, setNewSite] = useState({
    siteId: '',
    name: '',
    type: '',
    address: '',
  });

  useEffect(() => {
    const fetchSites = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/sites`);
        if (!res.ok) throw new Error('Failed to fetch sites');
        const data = await res.json();
        setSites(data);
      } catch (err: any) {
        setError('Failed to load sites: ' + err.message);
      }
    };
    fetchSites();
  }, []);

  const handleCreateSite = async () => {
    if (!newSite.siteId || !newSite.name) {
      setError('Site ID and name are required');
      return;
    }
    setIsSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE_URL}/api/sites`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          siteId: newSite.siteId,
          name: newSite.name,
          type: newSite.type || 'DSP',
          address: newSite.address || '',
          enabled: 1,
        }),
      });
      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`Failed to create site: ${errorText}`);
      }
      const newSiteData = await res.json();
      setSites([...sites, newSiteData]);
      setNewSite({ siteId: '', name: '', type: '', address: '' });
      setSuccessMessage('Site created successfully!');
      setTimeout(() => {
        setSuccessMessage(null);
        if (locationState?.fromReceive) {
          navigate('/receive', { state: { newSiteId: newSiteData.siteId } });
        }
      }, 1000);
    } catch (err: any) {
      setError('Failed to create site: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif' }}>
      <h2 style={{ color: '#333', marginBottom: '20px' }}>Sites</h2>
      {successMessage && (
        <div style={{ color: 'green', marginBottom: '15px', textAlign: 'center' }}>
          {successMessage}
        </div>
      )}
      {error && (
        <div style={{ color: 'red', marginBottom: '15px', textAlign: 'center' }}>
          {error}
        </div>
      )}
      <div style={{ backgroundColor: '#fff', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
        <h3 style={{ color: '#555', marginBottom: '20px' }}>Add New Site</h3>
        <div style={{ marginBottom: '15px' }}>
          <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', color: '#555' }}>Site ID (e.g., DSP-AL-20010):</label>
          <input
            type="text"
            value={newSite.siteId}
            onChange={(e) => setNewSite({ ...newSite, siteId: e.target.value })}
            placeholder="Enter Site ID"
            style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '4px', boxSizing: 'border-box', fontSize: '16px' }}
          />
        </div>
        <div style={{ marginBottom: '15px' }}>
          <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', color: '#555' }}>Name:</label>
          <input
            type="text"
            value={newSite.name}
            onChange={(e) => setNewSite({ ...newSite, name: e.target.value })}
            placeholder="e.g., Madison Distillery"
            style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '4px', boxSizing: 'border-box', fontSize: '16px' }}
          />
        </div>
        <div style={{ marginBottom: '15px' }}>
          <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', color: '#555' }}>Type:</label>
          <input
            type="text"
            value={newSite.type}
            onChange={(e) => setNewSite({ ...newSite, type: e.target.value })}
            placeholder="e.g., DSP"
            style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '4px', boxSizing: 'border-box', fontSize: '16px' }}
          />
        </div>
        <div style={{ marginBottom: '15px' }}>
          <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', color: '#555' }}>Address:</label>
          <input
            type="text"
            value={newSite.address}
            onChange={(e) => setNewSite({ ...newSite, address: e.target.value })}
            placeholder="e.g., 212 Main St, Madison, AL"
            style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '4px', boxSizing: 'border-box', fontSize: '16px' }}
          />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <button
            onClick={handleCreateSite}
            disabled={!newSite.siteId || !newSite.name || isSubmitting}
            style={{
              backgroundColor: (!newSite.siteId || !newSite.name || isSubmitting) ? '#ccc' : '#2196F3',
              color: '#fff',
              padding: '10px 20px',
              border: 'none',
              borderRadius: '4px',
              cursor: (!newSite.siteId || !newSite.name || isSubmitting) ? 'not-allowed' : 'pointer',
              fontSize: '16px',
            }}
            onMouseOver={(e) => {
              if (newSite.siteId && newSite.name && !isSubmitting) {
                e.currentTarget.style.backgroundColor = '#1976D2';
              }
            }}
            onMouseOut={(e) => {
              if (newSite.siteId && newSite.name && !isSubmitting) {
                e.currentTarget.style.backgroundColor = '#2196F3';
              }
            }}
          >
            {isSubmitting ? 'Creating...' : 'Create'}
          </button>
          <button
            onClick={() => navigate(locationState?.fromReceive ? '/receive' : '/')}
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
      <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '20px' }}>
        <thead>
          <tr>
            <th style={{ border: '1px solid #ddd', padding: '12px', backgroundColor: '#f5f5f5', color: '#333' }}>Site ID</th>
            <th style={{ border: '1px solid #ddd', padding: '12px', backgroundColor: '#f5f5f5', color: '#333' }}>Name</th>
            <th style={{ border: '1px solid #ddd', padding: '12px', backgroundColor: '#f5f5f5', color: '#333' }}>Type</th>
            <th style={{ border: '1px solid #ddd', padding: '12px', backgroundColor: '#f5f5f5', color: '#333' }}>Address</th>
          </tr>
        </thead>
        <tbody>
          {sites.map((site) => (
            <tr key={site.siteId}>
              <td style={{ border: '1px solid #ddd', padding: '12px', textAlign: 'center' }}>{site.siteId}</td>
              <td style={{ border: '1px solid #ddd', padding: '12px', textAlign: 'center' }}>{site.name}</td>
              <td style={{ border: '1px solid #ddd', padding: '12px', textAlign: 'center' }}>{site.type || 'N/A'}</td>
              <td style={{ border: '1px solid #ddd', padding: '12px', textAlign: 'center' }}>{site.address || 'N/A'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default Sites;