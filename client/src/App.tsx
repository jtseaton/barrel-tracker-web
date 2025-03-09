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
  const [menuOpen, setMenuOpen] = useState(true); // Menu persistent by default
  const [showInventorySubmenu, setShowInventorySubmenu] = useState(false); // Control Inventory submenu
  const [isLoading, setIsLoading] = useState(true);

  React.useEffect(() => {
    setTimeout(() => setIsLoading(false), 4000);
  }, []);

  const handleInventoryClick = () => {
    if (activeSection === 'Inventory' && showInventorySubmenu) {
      // If already on Inventory submenu, go back to main menu
      setShowInventorySubmenu(false);
      setActiveSection('Home');
    } else {
      // Show Inventory submenu
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
              // Inventory submenu options
              [
                { name: 'Vendors', action: () => setActiveSection('Vendors') },
                { name: 'Receipts', path: '/receive' },
                { name: 'Transfers', action: () => setActiveSection('Transfers') },
                { name: 'Inventory', action: () => setActiveSection('Inventory') },
                { name: 'Items', action: () => setActiveSection('Inventory') }, // Triggers items modal via prop
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
              // Main menu options
              [
                { name: 'Home', subMenu: null },
                { name: 'Production', subMenu: null },
                { name: 'Inventory', subMenu: true }, // Submenu exists but hidden until clicked
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
                        setShowInventorySubmenu(false); // Reset submenu when switching sections
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
                  {activeSection === 'Inventory' && <Inventory showItemsModalFromMenu={activeSection === 'Inventory' && showInventorySubmenu && menuOpen} />}
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