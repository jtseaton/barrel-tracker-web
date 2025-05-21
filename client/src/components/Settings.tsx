import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import '../Settings.css';

const Settings: React.FC = () => {
  const [settings, setSettings] = useState({ keg_deposit_price: '0.00' });
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const response = await fetch('/api/settings');
      if (!response.ok) throw new Error(`Failed to fetch settings: ${response.statusText}`);
      const data = await response.json();
      setSettings({ keg_deposit_price: data.keg_deposit_price || '0.00' });
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred';
      setError(errorMessage);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setSettings((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    const kegDepositPrice = parseFloat(settings.keg_deposit_price);
    if (isNaN(kegDepositPrice) || kegDepositPrice < 0) {
      setError('Keg deposit price must be a non-negative number');
      return;
    }
    try {
      const response = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keg_deposit_price: kegDepositPrice.toFixed(2) }),
      });
      if (!response.ok) throw new Error(`Failed to save settings: ${response.statusText}`);
      setSuccess('Settings saved successfully');
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred';
      setError(errorMessage);
    }
  };

  return (
    <div className="settings-container">
      <h2>Facility Settings</h2>
      {error && <div className="error">{error}</div>}
      {success && <div className="success">{success}</div>}
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="keg_deposit_price">Keg Deposit Price ($):</label>
          <input
            type="number"
            id="keg_deposit_price"
            name="keg_deposit_price"
            value={settings.keg_deposit_price}
            onChange={handleChange}
            step="0.01"
            min="0"
            required
          />
        </div>
        <button type="submit">Save Settings</button>
        <button type="button" onClick={() => navigate('/')}>Back</button>
      </form>
    </div>
  );
};

export default Settings;