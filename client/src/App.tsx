import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Route, Routes, Link, useLocation, useNavigate } from 'react-router-dom';
import Home from './components/Home';
import Production from './components/Production';
import Inventory from './components/Inventory';
import Processing from './components/Processing';
import Sales from './components/Sales';
import Users from './components/Users';
import Reporting from './components/Reporting';
import ReceivePage from './components/ReceivePage';
import Items from './components/Items';
import ItemDetails from './components/ItemDetails';
import Vendors from './components/Vendors';
import VendorDetails from './components/VendorDetails';
import PurchaseOrderForm from './components/PurchaseOrderForm';
import { fetchInventory, fetchDailySummary } from './utils/fetchUtils';
import { exportTankSummaryToExcel, exportToExcel } from './utils/excelUtils';
import { InventoryItem } from './types/interfaces'; // Assuming InventoryItem type is defined here
import './App.css';

const AppContent: React.FC = () => {
  const [activeSection, setActiveSection] = useState('Home');
  const [menuOpen, setMenuOpen] = useState(true);
  const [showInventorySubmenu, setShowInventorySubmenu] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [inventory, setInventory] = useState<InventoryItem[]>([]); // Inventory state typed as InventoryItem[]
  const location = useLocation();
  const navigate = useNavigate();

  // Simulate loading screen
  useEffect(() => {
    setTimeout(() => setIsLoading(false), 4000);
  }, []);

  // Update active section based on route
  useEffect(() => {
    const path = location.pathname;
    if (path === '/' || path === '/production' || path === '/processing' || path === '/sales-distribution' || path === '/users' || path === '/reporting') {
      setShowInventorySubmenu(false);
      setActiveSection(path === '/' ? 'Home' : path.slice(1).replace('-', ' & ').replace(/(^\w|\s\w)/g, m => m.toUpperCase()));
    } else if (path === '/inventory' || path === '/receive' || path === '/transfers' || path === '/items' || path.startsWith('/items/') || path.startsWith('/vendors/')) {
      setShowInventorySubmenu(true);
      if (path === '/inventory') setActiveSection('Inventory');
      else if (path === '/receive') setActiveSection('Inventory');
      else if (path === '/transfers') setActiveSection('Transfers');
      else if (path === '/items' || path.startsWith('/items/')) setActiveSection('Items');
      else if (path === '/vendors' || path.startsWith('/vendors/')) setActiveSection('Vendors');
    }
  }, [location.pathname]);

  // Function to fetch and refresh inventory
  const refreshInventory = async () => {
    try {
      const data = await fetchInventory(); // Assuming fetchInventory returns InventoryItem[]
      setInventory(data);
    } catch (error) {
      console.error('Error fetching inventory:', error);
    }
  };

  // Fetch inventory when the component mounts
  useEffect(() => {
    refreshInventory();
  }, []);

  const handleInventoryClick = () => {
    if (activeSection === 'Inventory' && showInventorySubmenu) {
      setShowInventorySubmenu(false);
      setActiveSection('Home');
      navigate('/');
    } else {
      setActiveSection('Inventory');
      setShowInventorySubmenu(true);
      navigate('/inventory');
    }
  };

  const handleBackClick = () => {
    setShowInventorySubmenu(false);
    setActiveSection('Home');
    navigate('/');
  };

  if (isLoading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', backgroundColor: '#f5f5f5' }}>
        <img src="/tilly-logo.png" alt="Tilly Logo" style={{ maxWidth: '80%', maxHeight: '60vh' }} />
        <h1 style={{ fontFamily: 'Arial, sans-serif', color: '#333' }}>Tilly</h1>
        <p style={{ fontFamily: 'Arial, sans-serif', color: '#666' }}>Powered by Paws & Pours</p>
      </div>
    );
  }

  return (
    <div className="App">
      <button className="hamburger" onClick={() => setMenuOpen(!menuOpen)}>☰</button>
      <nav className={`menu ${menuOpen ? 'open' : ''}`}>
        <ul>
          {showInventorySubmenu ? (
            [
              { name: 'Back', action: handleBackClick },
              { name: 'Vendors', path: '/vendors' },
              { name: 'Receive Inventory', path: '/receive' },
              { name: 'Transfers', path: '/transfers' },
              { name: 'Inventory', path: '/inventory' },
              { name: 'Items', path: '/items' },
            ].map((item) => (
              <li key={item.name}>
                {item.path ? (
                  <Link to={item.path} onClick={() => setActiveSection(item.name === 'Receive Inventory' ? 'Inventory' : item.name)}>
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
                      navigate(section.name === 'Home' ? '/' : `/${section.name.toLowerCase().replace(' & ', '-')}`);
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
                {activeSection === 'Inventory' && <Inventory inventory={inventory} />}
                {activeSection === 'Vendors' && <Vendors />}
                {activeSection === 'Transfers' && <div><h2>Transfers</h2><p>Transfers page coming soon</p></div>}
                {activeSection === 'Processing' && <Processing />}
                {activeSection === 'Sales & Distribution' && <Sales />}
                {activeSection === 'Users' && <Users />}
                {activeSection === 'Reporting' && <Reporting exportToExcel={exportToExcel} />}
              </>
            }
          />
          <Route path="/inventory" element={<Inventory inventory={inventory} />} />
          <Route path="/transfers" element={<div><h2>Transfers</h2><p>Transfers page coming soon</p></div>} />
          <Route path="/receive" element={<ReceivePage refreshInventory={refreshInventory} />} />
          <Route path="/items" element={<Items />} />
          <Route path="/items/:name" element={<ItemDetails />} />
          <Route path="/vendors" element={<Vendors />} />
          <Route path="/vendors/:name" element={<VendorDetails />} />
          <Route path="/vendors/:name/purchase-order/new" element={<PurchaseOrderForm />} />
        </Routes>
      </div>
    </div>
  );
};

const App: React.FC = () => {
  return (
    <Router>
      <AppContent />
    </Router>
  );
};

export default App;