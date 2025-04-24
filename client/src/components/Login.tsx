import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Role } from '../types/enums';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:3000';

const Login: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const handleLogin = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Login failed');
      }
      const user = await res.json();
      localStorage.setItem('user', JSON.stringify(user));
      navigate('/users');
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleForgotPassword = () => {
    // Placeholder: Log action (full reset flow TBD)
    console.log('Forgot Password clicked for email:', email);
    setError('Password reset not implemented yet. Contact admin or use superadmin@example.com with password: temp123');
  };

  return (
    <div className="page-container" style={{ maxWidth: '400px', margin: '0 auto', paddingTop: '100px' }}>
      <h2 style={{ color: '#EEC930', textAlign: 'center', marginBottom: '20px' }}>Login</h2>
      {error && <div className="error">{error}</div>}
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
          />
        </div>
        <button
          onClick={handleLogin}
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
          <a
            href="#"
            onClick={(e) => {
              e.preventDefault();
              handleForgotPassword();
            }}
            style={{ color: '#0066CC', textDecoration: 'underline', fontSize: '14px' }}
            onMouseOver={(e) => (e.currentTarget.style.color = '#F86752')}
            onMouseOut={(e) => (e.currentTarget.style.color = '#0066CC')}
          >
            Forgot Password?
          </a>
        </div>
      </div>
    </div>
  );
};

export default Login;