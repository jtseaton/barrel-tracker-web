import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import '../App.css';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:3000';

interface BrewLog {
  date: string;
  notes: string;
  temperature?: number;
  gravity?: number;
}

const BrewLog: React.FC = () => {
  const { batchId } = useParams<{ batchId: string }>();
  const navigate = useNavigate();
  const [brewLog, setBrewLog] = useState<BrewLog>({ date: '', notes: '', temperature: undefined, gravity: undefined });
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    const fetchBrewLog = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/batches/${batchId}/brewlog`, {
          headers: { Accept: 'application/json' },
        });
        if (!res.ok) {
          const text = await res.text();
          throw new Error(`Failed to fetch brew log: HTTP ${res.status}, Response: ${text.slice(0, 50)}`);
        }
        const data = await res.json();
        if (data.date) {
          setBrewLog(data);
        }
      } catch (err: any) {
        console.error('Fetch brew log error:', err);
        setError('Failed to load brew log: ' + err.message);
      }
    };
    fetchBrewLog();
  }, [batchId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!brewLog.date || !brewLog.notes) {
      setError('Date and notes are required');
      return;
    }
    try {
      const res = await fetch(`${API_BASE_URL}/api/batches/${batchId}/brewlog`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(brewLog),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Failed to save brew log: HTTP ${res.status}, Response: ${text.slice(0, 50)}`);
      }
      setError(null);
      setSuccessMessage('Brew log saved successfully');
      setTimeout(() => {
        setSuccessMessage(null);
        navigate(`/production/${batchId}`);
      }, 2000);
    } catch (err: any) {
      console.error('Save brew log error:', err);
      setError('Failed to save brew log: ' + err.message);
    }
  };

  return (
    <div className="page-container">
      <h2>Brew Day Log for Batch {batchId}</h2>
      {error && <div className="error">{error}</div>}
      {successMessage && <div style={{ color: '#28A745', backgroundColor: '#e6ffe6', padding: '10px', borderRadius: '4px', marginBottom: '10px', textAlign: 'center' }}>{successMessage}</div>}
      <form onSubmit={handleSubmit} className="batch-details">
        <div style={{ marginBottom: '20px' }}>
          <label>Date:</label>
          <input
            type="date"
            value={brewLog.date}
            onChange={(e) => setBrewLog({ ...brewLog, date: e.target.value })}
            required
            style={{ padding: '10px', border: '1px solid #CCCCCC', borderRadius: '4px', fontSize: '16px', width: '200px' }}
          />
        </div>
        <div style={{ marginBottom: '20px' }}>
          <label>Notes:</label>
          <textarea
            value={brewLog.notes}
            onChange={(e) => setBrewLog({ ...brewLog, notes: e.target.value })}
            required
            placeholder="Enter brew day notes (e.g., fermentation details)"
            style={{ padding: '10px', border: '1px solid #CCCCCC', borderRadius: '4px', fontSize: '16px', width: '300px', height: '100px' }}
          />
        </div>
        <div style={{ marginBottom: '20px' }}>
          <label>Temperature (°C):</label>
          <input
            type="number"
            value={brewLog.temperature || ''}
            onChange={(e) => setBrewLog({ ...brewLog, temperature: parseFloat(e.target.value) || undefined })}
            placeholder="Optional"
            step="0.1"
            style={{ padding: '10px', border: '1px solid #CCCCCC', borderRadius: '4px', fontSize: '16px', width: '100px' }}
          />
        </div>
        <div style={{ marginBottom: '20px' }}>
          <label>Gravity:</label>
          <input
            type="number"
            value={brewLog.gravity || ''}
            onChange={(e) => setBrewLog({ ...brewLog, gravity: parseFloat(e.target.value) || undefined })}
            placeholder="Optional"
            step="0.001"
            style={{ padding: '10px', border: '1px solid #CCCCCC', borderRadius: '4px', fontSize: '16px', width: '100px' }}
          />
        </div>
        <button
          type="submit"
          style={{
            backgroundColor: '#2196F3',
            color: '#fff',
            padding: '10px 20px',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
          }}
        >
          Save Brew Log
        </button>
        <button
          type="button"
          onClick={() => navigate(`/production/${batchId}`)}
          style={{
            backgroundColor: '#F86752',
            color: '#fff',
            padding: '10px 20px',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            marginLeft: '10px',
          }}
        >
          Cancel
        </button>
      </form>
    </div>
  );
};

export default BrewLog;