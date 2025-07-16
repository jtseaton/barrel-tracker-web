import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_BASE_URL } from '../config';

const Login: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await fetch(`${API_BASE_URL}/api/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('Login endpoint not found. Please contact the administrator.');
        } else if (response.status === 401) {
          throw new Error('Invalid email or password');
        }
        const data = await response.json();
        throw new Error(data.error || `HTTP error! status: ${response.status}`);
      }
      const { token, user } = await response.json();
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(user));
      navigate('/', { replace: true });
    } catch (err) {
      console.error('Login error:', err);
      setError(err instanceof Error ? err.message : 'An error occurred during login');
    }
  };

  const handleForgotPassword = () => {
    console.log('Forgot Password clicked for email:', email);
    setError('Password reset not implemented yet. Contact admin or use jtseaton@gmail.com with password: P@$$w0rd1234');
  };

  return (
    <div className="page-container" style={{ maxWidth: '400px', margin: '0 auto', paddingTop: '100px' }}>
      <h2 style={{ color: '#EEC930', textAlign: 'center', marginBottom: '20px' }}>Login</h2>
      {error && <div className="error" style={{ color: 'red', marginBottom: '15px' }}>{error}</div>}
      <form onSubmit={handleLogin}>
        <div style={{ display: 'grid', gap: '15px' }}>
          <div>
            <label style={{ fontWeight: 'bold', color: '#555', display: 'block', marginBottom: '5px' }}>Email:</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter email"
              style={{
                width: '100%',
                padding: '10px',
                border: '1px solid #CCCCCC',
                borderRadius: '4px',
                fontSize: '16px',
                boxSizing: 'border-box',
                color: '#000000',
                backgroundColor: '#FFFFFF',
              }}
              required
            />
          </div>
          <div>
            <label style={{ fontWeight: 'bold', color: '#555', display: 'block', marginBottom: '5px' }}>Password:</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter password"
              style={{
                width: '100%',
                padding: '10px',
                border: '1px solid #CCCCCC',
                borderRadius: '4px',
                fontSize: '16px',
                boxSizing: 'border-box',
                color: '#000000',
                backgroundColor: '#FFFFFF',
              }}
              required
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
              fontSize: '16px',
              transition: 'background-color 0.3s',
            }}
            onMouseOver={(e) => (e.currentTarget.style.backgroundColor = '#1976D2')}
            onMouseOut={(e) => (e.currentTarget.style.backgroundColor = '#2196F3')}
          >
            Login
          </button>
          <div style={{ textAlign: 'center' }}>
            <button
              onClick={handleForgotPassword}
              style={{ color: '#0066CC', textDecoration: 'underline', fontSize: '14px', background: 'none', border: 'none', cursor: 'pointer' }}
              onMouseOver={(e) => (e.currentTarget.style.color = '#F86752')}
              onMouseOut={(e) => (e.currentTarget.style.color = '#0066CC')}
            >
              Forgot Password?
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};

export default Login;