import React, { useState } from 'react';
import { BrowserRouter as Router, Route, Routes, Link } from 'react-router-dom';
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
  const [menuOpen, setMenuOpen] = useState(true);
  const [showInventorySubmenu, setShowInventorySubmenu] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  React.useEffect(() => {
    setTimeout(() => setIsLoading(false), 4000);
  }, []);

  const handleInventoryClick = () => {
    if (activeSection === 'Inventory' && showInventorySubmenu) {
      setShowInventorySubmenu(false);
      setActiveSection('Home');
    } else {
      setActiveSection('Inventory');
      setShowInventorySubmenu(true);
    }
  };

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
            {showInventorySubmenu ? (
              [
                { name: 'Vendors', action: () => setActiveSection('Vendors') },
                { name: 'Receive Inventory', path: '/receive' }, // Renamed back to "Receive Inventory"
                { name: 'Transfers', action: () => setActiveSection('Transfers') },
                { name: 'Inventory', action: () => setActiveSection('Inventory') },
                { name: 'Items', action: () => setActiveSection('Inventory') }, // No modal trigger here
              ].map((item) => (
                <li key={item.name}>
                  {item.path ? (
                    <Link to={item.path} onClick={() => setActiveSection('Inventory')}>
                      {item.name}
                    </Link>
                  ) : (
                    <button onClick={item.action}>{item.name}</button>
                  )}
                </li>
              ))
            ) : (
              [
                { name: 'Home', subMenu: null },
                { name: 'Production', subMenu: null },
                { name: 'Inventory', subMenu: true },
                { name: 'Processing', subMenu: null },
                { name: 'Sales & Distribution', subMenu: null },
                { name: 'Users', subMenu: null },
                { name: 'Reporting', subMenu: null },
              ].map((section) => (
                <li key={section.name}>
                  <button
                    onClick={() => {
                      if (section.name === 'Inventory') {
                        handleInventoryClick();
                      } else {
                        setActiveSection(section.name);
                        setShowInventorySubmenu(false);
                      }
                    }}
                    className={activeSection === section.name ? 'active' : ''}
                  >
                    {section.name}
                  </button>
                </li>
              ))
            )}
          </ul>
        </nav>
        <div className="content">
          <h1>Tilly - Distillery Dog</h1>
          <Routes>
            <Route
              path="/"
              element={
                <>
                  {activeSection === 'Home' && <Home />}
                  {activeSection === 'Production' && <Production />}
                  {activeSection === 'Inventory' && <Inventory />} {/* Removed showItemsModalFromMenu */}
                  {activeSection === 'Vendors' && <div><h2>Vendors</h2><p>Vendors page coming soon</p></div>}
                  {activeSection === 'Transfers' && <div><h2>Transfers</h2><p>Transfers page coming soon</p></div>}
                  {activeSection === 'Processing' && <Processing />}
                  {activeSection === 'Sales & Distribution' && <Sales />}
                  {activeSection === 'Users' && <Users />}
                  {activeSection === 'Reporting' && <Reporting exportToExcel={exportToExcel} />}
                </>
              }
            />
            <Route
              path="/receive"
              element={<ReceivePage fetchInventory={fetchInventory} exportTankSummary={exportTankSummaryToExcel} />}
            />
          </Routes>
        </div>
      </div>
    </Router>
  );
};

export default App;