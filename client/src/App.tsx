import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Route, Routes, Link, useLocation, useNavigate } from 'react-router-dom';
import { Role } from './types/enums';
import { InventoryItem, Vendor, User } from './types/interfaces';
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
import PurchaseOrderList from './components/PurchaseOrderList';
import Products from './components/Products';
import ProductDetails from './components/ProductDetails';
import InventoryItemDetails from './components/InventoryItemDetails';
import Locations from './components/Locations';
import Sites from './components/Sites';
import FacilityDesigner from './components/FacilityDesigner';
import FacilityView from './components/FacilityView';
import EquipmentPage from './components/Equipment';
import Login from './components/Login';
import { fetchInventory, fetchDailySummary } from './utils/fetchUtils';
import { exportTankSummaryToExcel, exportToExcel } from './utils/excelUtils';
import './App.css';

// Stub component
const ProductionPage: React.FC = () => <div><h2>Production</h2><p>Production page coming soon</p></div>;

interface InventoryProps {
  vendors: Vendor[];
  refreshVendors: () => Promise<void>;
  inventory: InventoryItem[];
  refreshInventory: () => Promise<void>;
}

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:3000';

const AppContent: React.FC = () => {
  const [activeSection, setActiveSection] = useState('Home');
  const [menuOpen, setMenuOpen] = useState(true);
  const [showInventorySubmenu, setShowInventorySubmenu] = useState(false);
  const [showProductionSubmenu, setShowProductionSubmenu] = useState(false);
  const [showManagementSubmenu, setShowManagementSubmenu] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const location = useLocation();
  const navigate = useNavigate();

  // Authentication state
  const [currentUser, setCurrentUser] = useState<User | null>(
    JSON.parse(localStorage.getItem('user') || 'null')
  );
  const isAuthenticated = !!currentUser?.email;
  const isAdmin = currentUser && [Role.SuperAdmin, Role.Admin].includes(currentUser.role as Role);

  // Force re-render on currentUser change
  useEffect(() => {
    const user = JSON.parse(localStorage.getItem('user') || 'null');
    if (user !== currentUser) {
      setCurrentUser(user);
    }
  }, [location.pathname]);

  // Reset activeSection to Home on login
  //useEffect(() => {
    //if (isAuthenticated && location.pathname === '/') {
      //setActiveSection('Home');
    //}
  //}, [isAuthenticated, location.pathname]);

  const refreshInventory = async () => {
    try {
      const data = await fetchInventory();
      console.log('Refresh inventory fetched:', data);
      setInventory(data);
      console.log('Inventory state updated:', data);
    } catch (error) {
      console.error('Error refreshing inventory:', error);
    }
  };

  const refreshVendors = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/vendors`);
      if (!res.ok) throw new Error('Failed to fetch vendors');
      const data = await res.json();
      setVendors(data);
    } catch (err) {
      console.error('Fetch vendors error:', err);
    }
  };

  useEffect(() => {
    const loadData = async () => {
      await Promise.all([refreshInventory(), refreshVendors()]);
      setTimeout(() => setIsLoading(false), 4000);
    };
    loadData();
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

  const handleProductionClick = () => {
    if (activeSection === 'Production' && showProductionSubmenu) {
      setShowProductionSubmenu(false);
      setActiveSection('Home');
      navigate('/');
    } else {
      setActiveSection('Production');
      setShowProductionSubmenu(true);
      navigate('/production');
    }
  };

  const handleManagementClick = () => {
    if (activeSection === 'Management' && showManagementSubmenu) {
      setShowManagementSubmenu(false);
      setActiveSection('Home');
      navigate('/');
    } else {
      setActiveSection('Management');
      setShowManagementSubmenu(true);
      navigate('/management');
    }
  };

  const handleLogOff = () => {
    localStorage.removeItem('user');
    setCurrentUser(null);
    setActiveSection('Home');
    setShowManagementSubmenu(false);
    navigate('/login');
  };

  const handleBackClick = () => {
    setShowInventorySubmenu(false);
    setShowProductionSubmenu(false);
    setShowManagementSubmenu(false);
    setActiveSection('Home');
    navigate('/');
  };

  if (!isAuthenticated) {
    return <Login />;
  }

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
          ) : showProductionSubmenu ? (
            [
              { name: 'Back', action: handleBackClick },
              { name: 'Planning', path: '/planning', disabled: true },
              { name: 'Products', path: '/products' },
              { name: 'Facility View', path: '/facility-view' },
              { name: 'Production', path: '/production' },
              { name: 'Equipment', path: '/equipment' },
            ].map((item) => (
              <li key={item.name}>
                {item.disabled ? (
                  <span style={{ color: '#888' }}>{item.name}</span>
                ) : item.path ? (
                  <Link to={item.path} onClick={() => setActiveSection(item.name)}>
                    {item.name}
                  </Link>
                ) : (
                  <button onClick={item.action}>{item.name}</button>
                )}
              </li>
            ))
          ) : showManagementSubmenu && isAdmin ? (
            [
              { name: 'Back', action: handleBackClick },
              { name: 'Locations', path: '/locations' },
              { name: 'Sites', path: '/sites' },
              { name: 'Facility Designer', path: '/facility-designer' },
              { name: 'Log Off', action: handleLogOff },
            ].map((item) => (
              <li key={item.name}>
                {item.path ? (
                  <Link to={item.path} onClick={() => setActiveSection(item.name)}>
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
              { name: 'Production', subMenu: true },
              { name: 'Inventory', subMenu: true },
              { name: 'Processing', subMenu: null },
              { name: 'Sales & Distribution', subMenu: null },
              { name: 'Users', subMenu: null },
              { name: 'Reporting', subMenu: null },
              ...(isAdmin ? [{ name: 'Management', subMenu: true }] : []),
            ].map((section) => (
              <li key={section.name}>
                <button
                  onClick={() => {
                    if (section.name === 'Production') {
                      handleProductionClick();
                    } else if (section.name === 'Inventory') {
                      handleInventoryClick();
                    } else if (section.name === 'Management') {
                      handleManagementClick();
                    } else {
                      setActiveSection(section.name);
                      setShowInventorySubmenu(false);
                      setShowProductionSubmenu(false);
                      setShowManagementSubmenu(false);
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
        <Routes>
          <Route
            path="/"
            element={
              <>
                {activeSection === 'Home' && <FacilityView siteId="DSP-AL-20010" />}
                {activeSection === 'Inventory' && (
                  <Inventory
                    vendors={vendors}
                    refreshVendors={refreshVendors}
                    inventory={inventory}
                    refreshInventory={refreshInventory}
                  />
                )}
                {activeSection === 'Production' && location.pathname === '/production' && <Production />}
                {activeSection === 'Products' && <Products />}
                {activeSection === 'Production' && location.pathname === '/production-page' && <ProductionPage />}
                {activeSection === 'Locations' && isAdmin && <Locations />}
                {activeSection === 'Equipment' && <EquipmentPage />}
                {activeSection === 'Planning' && <div><h2>Planning</h2><p>Coming soon</p></div>}
                {activeSection === 'Facility Designer' && isAdmin && <FacilityDesigner />}
                {activeSection === 'Facility View' && <FacilityView siteId="DSP-AL-20010" />}
                {activeSection === 'Vendors' && <Vendors vendors={vendors} refreshVendors={refreshVendors} />}
                {activeSection === 'Transfers' && <div><h2>Transfers</h2><p>Transfers page coming soon</p></div>}
                {activeSection === 'Processing' && <Processing inventory={inventory} refreshInventory={refreshInventory} />}
                {activeSection === 'Sales & Distribution' && <Sales />}
                {activeSection === 'Users' && <Users />}
                {activeSection === 'Reporting' && <Reporting exportToExcel={exportToExcel} />}
                {activeSection === 'Management' && isAdmin && location.pathname === '/management' && <div><h2>Management</h2><p>Select an option from the menu</p></div>}
              </>
            }
          />
          <Route path="/login" element={<Login />} />
          <Route
            path="/inventory"
            element={
              <Inventory
                vendors={vendors}
                refreshVendors={refreshVendors}
                inventory={inventory}
                refreshInventory={refreshInventory}
              />
            }
          />
          <Route path="/inventory/:identifier" element={<InventoryItemDetails inventory={inventory} refreshInventory={refreshInventory} />} />
          <Route path="/transfers" element={<div><h2>Transfers</h2><p>Transers page coming soon</p></div>} />
          <Route path="/items" element={<Items />} />
          <Route path="/items/:name" element={<ItemDetails />} />
          <Route path="/sites" element={isAdmin ? <Sites /> : <div><h2>Access Denied</h2><p>Only Admins can access this page</p></div>} />
          <Route path="/receive" element={<ReceivePage refreshInventory={refreshInventory} vendors={vendors} refreshVendors={refreshVendors} />} />
          <Route path="/vendors" element={<Vendors vendors={vendors} refreshVendors={refreshVendors} />} />
          <Route path="/vendors/:name" element={<VendorDetails vendors={vendors} refreshVendors={refreshVendors} refreshInventory={refreshInventory} />} />
          <Route path="/vendors/:name/purchase-orders" element={<PurchaseOrderList />} />
          <Route path="/vendors/:name/purchase-orders/new" element={<PurchaseOrderForm />} />
          <Route path="/vendors/:name/purchase-orders/:poNumber" element={<PurchaseOrderForm />} />
          <Route path="/processing" element={<Processing inventory={inventory} refreshInventory={refreshInventory} />} />
          <Route path="/products" element={<Products />} />
          <Route path="/products/:id" element={<ProductDetails />} />
          <Route path="/production" element={<Production />} />
          <Route path="/production-page" element={<ProductionPage />} />
          <Route path="/locations" element={isAdmin ? <Locations /> : <div><h2>Access Denied</h2><p>Only Admins can access this page</p></div>} />
          <Route path="/equipment" element={<EquipmentPage />} />
          <Route path="/planning" element={<div><h2>Planning</h2><p>Coming soon</p></div>} />
          <Route path="/facility-designer" element={isAdmin ? <FacilityDesigner /> : <div><h2>Access Denied</h2><p>Only Admins can access this page</p></div>} />
          <Route path="/facility-view" element={<FacilityView siteId="DSP-AL-20010" />} />
          <Route path="/management" element={isAdmin ? <div><h2>Management</h2><p>Select an option from the menu</p></div> : <div><h2>Access Denied</h2><p>Only Admins can access this page</p></div>} />
          <Route path="/users" element={<Users />} />
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