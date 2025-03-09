import React, { useState } from 'react';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import Home from './components/Home';
import Production from './components/Production';
import Inventory from './components/Inventory';
import Processing from './components/Processing';
import Sales from './components/Sales';
import Users from './components/Users';
import Reporting from './components/Reporting';
import ReceivePage from './components/ReceivePage';
import { fetchInventory, fetchDailySummary } from './utils/fetchUtils';
import { exportTankSummaryToExcel, exportToExcel } from './utils/excelUtils';
import './App.css';

const App: React.FC = () => {
  const [activeSection, setActiveSection] = useState('Home');
  const [menuOpen, setMenuOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  React.useEffect(() => {
    setTimeout(() => setIsLoading(false), 4000);
  }, []);

  if (isLoading) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100vh',
          backgroundColor: '#f5f5f5',
        }}
      >
        <img src="/tilly-logo.png" alt="Tilly Logo" style={{ maxWidth: '80%', maxHeight: '60vh' }} />
        <h1 style={{ fontFamily: 'Arial, sans-serif', color: '#333' }}>Tilly</h1>
        <p style={{ fontFamily: 'Arial, sans-serif', color: '#666' }}>Powered by Paws & Pours</p>
      </div>
    );
  }

  return (
    <Router>
      <div className="App">
        <button className="hamburger" onClick={() => setMenuOpen(!menuOpen)}>
          ☰
        </button>
        <nav className={`menu ${menuOpen ? 'open' : ''}`}>
          <ul>
            {['Home', 'Production', 'Inventory', 'Processing', 'Sales & Distribution', 'Users', 'Reporting'].map((section) => (
              <li key={section}>
                <button
                  onClick={() => {
                    setActiveSection(section);
                    setMenuOpen(false);
                  }}
                  className={activeSection === section ? 'active' : ''}
                >
                  {section}
                </button>
              </li>
            ))}
          </ul>
        </nav>
        <div className="content">
          <h1>Tilly - Distillery Dog</h1>
          <Routes>
            <Route path="/" element={
              <>
                {activeSection === 'Home' && <Home />}
                {activeSection === 'Production' && <Production />}
                {activeSection === 'Inventory' && <Inventory />}
                {activeSection === 'Processing' && <Processing />}
                {activeSection === 'Sales & Distribution' && <Sales />}
                {activeSection === 'Users' && <Users />}
                {activeSection === 'Reporting' && <Reporting exportToExcel={exportToExcel} />}
              </>
            } />
            <Route path="/receive" element={<ReceivePage fetchInventory={fetchInventory} exportTankSummary={exportTankSummaryToExcel} />} />
          </Routes>
        </div>
      </div>
    </Router>
  );
};

export default App;