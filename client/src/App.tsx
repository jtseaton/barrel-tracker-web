// client/src/App.tsx
import React, { useState, useEffect, useRef } from 'react';
import { BrowserRouter as Router, Route, Routes, Link, useLocation, useNavigate } from 'react-router-dom';
import { Role } from './types/enums';
import { InventoryItem, Vendor, User } from './types/interfaces';
import Home from './components/Home';
import Production from './components/Production';
import BrewLog from './components/BrewLog';
import Inventory from './components/Inventory';
import Processing from './components/Processing';
import SalesDashboard from './components/SalesDashboard';
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
import { fetchInventory, fetchDailySummary, InventoryResponse } from './utils/fetchUtils';
import { exportTankSummaryToExcel, exportToExcel } from './utils/excelUtils';
import './App.css';
import 'bootstrap/dist/css/bootstrap.min.css';
import BatchDetails from './components/BatchDetails';
import SalesOrderComponent from './components/SalesOrder';
import InvoiceComponent from './components/Invoice';
import SalesOrderList from './components/SalesOrderList';
import InvoicesList from './components/InvoicesList';
import Customers from './components/Customers';
import CustomerDetails from './components/CustomerDetails';
import Settings from './components/Settings';
import KegTracking from './components/KegTracking';

// Stub component
const ProductionPage: React.FC = () => <div className="container"><h2>Production</h2><p>Production page coming soon</p></div>;

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:3000';

const AppContent: React.FC = () => {
  const [activeSection, setActiveSection] = useState('Home');
  const [menuOpen, setMenuOpen] = useState(false); // Default closed on mobile
  const [showInventorySubmenu, setShowInventorySubmenu] = useState(false);
  const [showProductionSubmenu, setShowProductionSubmenu] = useState(false);
  const [showManagementSubmenu, setShowManagementSubmenu] = useState(false);
  const [showSalesSubmenu, setShowSalesSubmenu] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const location = useLocation();
  const navigate = useNavigate();
  const menuRef = useRef<HTMLDivElement>(null); // Ref for menu

  // Authentication state
  const [currentUser, setCurrentUser] = useState<User | null>(
    JSON.parse(localStorage.getItem('user') || 'null')
  );
  const isAuthenticated = !!currentUser?.email;
  const isAdmin = currentUser && [Role.SuperAdmin, Role.Admin].includes(currentUser.role as Role);

  useEffect(() => {
    const user = JSON.parse(localStorage.getItem('user') || 'null');
    if (user !== currentUser) {
      setCurrentUser(user);
    }
  }, [location.pathname]);

  const refreshInventory = async () => {
    try {
      const data: InventoryResponse | null = await fetchInventory();
      console.log('[App] fetchInventory response:', {
        data,
        isObject: data && typeof data === 'object',
        hasItems: data && 'items' in data,
        itemsIsArray: data && Array.isArray(data?.items),
        itemsLength: data && Array.isArray(data?.items) ? data.items.length : 'N/A',
        totalPages: data && 'totalPages' in data ? data.totalPages : 'N/A',
      });
      setInventory(data && typeof data === 'object' && Array.isArray(data.items) ? data.items : []);
    } catch (error) {
      console.error('[App] refreshInventory error:', error);
      setInventory([]);
    }
  };

  const refreshVendors = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/vendors`, {
        headers: { 'Content-Type': 'application/json' },
      });
      if (!res.ok) throw new Error(`Vendors fetch failed: HTTP ${res.status}`);
      const data = await res.json();
      console.log('[App] fetchVendors response:', {
        data,
        isArray: Array.isArray(data),
        length: Array.isArray(data) ? data.length : 'N/A',
      });
      setVendors(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('[App] Fetch vendors error:', err);
      setVendors([]);
    }
  };

  useEffect(() => {
    const loadData = async () => {
      await Promise.all([refreshInventory(), refreshVendors()]);
      setTimeout(() => setIsLoading(false), 4000);
    };
    loadData();
  }, []);

  // Handle outside clicks to close menu
  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (
        menuOpen &&
        menuRef.current &&
        !menuRef.current.contains(event.target as Node) &&
        !(event.target as HTMLElement).closest('.hamburger')
      ) {
        console.log('[App] Closing menu due to outside click');
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [menuOpen]);

  const handleInventoryClick = () => {
    console.log('[App] Inventory menu clicked');
    if (activeSection === 'Inventory' && showInventorySubmenu) {
      setShowInventorySubmenu(false);
      setActiveSection('Home');
      navigate('/');
    } else {
      setActiveSection('Inventory');
      setShowInventorySubmenu(true);
      navigate('/inventory');
    }
    // Removed setMenuOpen(false)
  };

  const handleProductionClick = () => {
    console.log('[App] Production menu clicked');
    if (activeSection === 'Production' && showProductionSubmenu) {
      setShowProductionSubmenu(false);
      setActiveSection('Home');
      navigate('/');
    } else {
      setActiveSection('Production');
      setShowProductionSubmenu(true);
      navigate('/production');
    }
    // Removed setMenuOpen(false)
  };

  const handleManagementClick = () => {
    console.log('[App] Management menu clicked');
    if (activeSection === 'Management' && showManagementSubmenu) {
      setShowManagementSubmenu(false);
      setActiveSection('Home');
      navigate('/');
    } else {
      setActiveSection('Management');
      setShowManagementSubmenu(true);
      navigate('/management');
    }
    // Removed setMenuOpen(false)
  };

  const handleSalesClick = () => {
    console.log('[App] Sales & Distribution menu clicked');
    if (activeSection === 'Sales & Distribution' && showSalesSubmenu) {
      setShowSalesSubmenu(false);
      setActiveSection('Home');
      navigate('/');
    } else {
      setActiveSection('Sales & Distribution');
      setShowSalesSubmenu(true);
      navigate('/sales-orders');
    }
    // Removed setMenuOpen(false)
  };

  const handleLogOff = () => {
    console.log('[App] Log Off clicked');
    localStorage.removeItem('user');
    setCurrentUser(null);
    setActiveSection('Home');
    setShowManagementSubmenu(false);
    navigate('/login');
    setMenuOpen(false); // Keep retraction for Log Off
  };

  const handleBackClick = () => {
    console.log('[App] Back clicked');
    setShowInventorySubmenu(false);
    setShowProductionSubmenu(false);
    setShowManagementSubmenu(false);
    setShowSalesSubmenu(false);
    setActiveSection('Home');
    navigate('/');
    // Removed setMenuOpen(false)
  };

  if (!isAuthenticated) {
    return <Login />;
  }

  if (isLoading) {
    return (
      <div className="loading-container">
        <img src="/tilly-logo.png" alt="Tilly Logo" className="loading-logo" />
        <h1 className="loading-title">Tilly</h1>
        <p className="loading-subtitle">Powered by Paws & Pours</p>
      </div>
    );
  }

  return (
    <div className="App">
      <button className="hamburger" onClick={() => {
        console.log('[App] Hamburger clicked, menuOpen:', !menuOpen);
        setMenuOpen(!menuOpen);
      }}>☰</button>
      <nav className={`menu ${menuOpen ? 'open' : ''}`} ref={menuRef}>
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
                  <Link
                    to={item.path}
                    onClick={() => {
                      console.log('[App] Submenu item clicked:', item.name);
                      setActiveSection(item.name === 'Receive Inventory' ? 'Inventory' : item.name);
                      // Removed setMenuOpen(false)
                    }}
                  >
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
                  <span className="disabled">{item.name}</span>
                ) : item.path ? (
                  <Link
                    to={item.path}
                    onClick={() => {
                      console.log('[App] Submenu item clicked:', item.name);
                      setActiveSection(item.name);
                      // Removed setMenuOpen(false)
                    }}
                  >
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
              { name: 'Settings', path: '/settings' },
              { name: 'Log Off', action: handleLogOff },
            ].map((item) => (
              <li key={item.name}>
                {item.path ? (
                  <Link
                    to={item.path}
                    onClick={() => {
                      console.log('[App] Submenu item clicked:', item.name);
                      setActiveSection(item.name);
                      // Removed setMenuOpen(false)
                    }}
                  >
                    {item.name}
                  </Link>
                ) : (
                  <button onClick={item.action}>{item.name}</button>
                )}
              </li>
            ))
          ) : showSalesSubmenu ? (
            [
              { name: 'Back', action: handleBackClick },
              { name: 'Sales Orders', path: '/sales-orders' },
              { name: 'Invoices', path: '/invoices' },
              { name: 'Customers', path: '/customers' },
              { name: 'Keg Tracking and Management', path: '/keg-tracking' },
            ].map((item) => (
              <li key={item.name}>
                {item.path ? (
                  <Link
                    to={item.path}
                    onClick={() => {
                      console.log('[App] Submenu item clicked:', item.name);
                      setActiveSection('Sales & Distribution');
                      // Removed setMenuOpen(false)
                    }}
                  >
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
              { name: 'Sales & Distribution', subMenu: true },
              { name: 'Users', subMenu: null },
              { name: 'Reporting', subMenu: null },
              ...(isAdmin ? [{ name: 'Management', subMenu: true }] : []),
            ].map((section) => (
              <li key={section.name}>
                <button
                  onClick={() => {
                    console.log('[App] Main menu item clicked:', section.name);
                    if (section.name === 'Production') {
                      handleProductionClick();
                    } else if (section.name === 'Inventory') {
                      handleInventoryClick();
                    } else if (section.name === 'Management') {
                      handleManagementClick();
                    } else if (section.name === 'Sales & Distribution') {
                      handleSalesClick();
                    } else {
                      setActiveSection(section.name);
                      setShowInventorySubmenu(false);
                      setShowProductionSubmenu(false);
                      setShowManagementSubmenu(false);
                      setShowSalesSubmenu(false);
                      navigate(section.name === 'Home' ? '/' : `/${section.name.toLowerCase().replace(' & ', '-')}`);
                      // Removed setMenuOpen(false)
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
                {activeSection === 'Production' && location.pathname === '/production' && (
                  <Production inventory={inventory} refreshInventory={refreshInventory} />
                )}
                {activeSection === 'Products' && <Products />}
                {activeSection === 'Production' && location.pathname === '/production-page' && <ProductionPage />}
                {activeSection === 'Locations' && isAdmin && <Locations />}
                {activeSection === 'Equipment' && <EquipmentPage />}
                {activeSection === 'Planning' && <div className="container"><h2>Planning</h2><p>Coming soon</p></div>}
                {activeSection === 'Facility Designer' && isAdmin && <FacilityDesigner />}
                {activeSection === 'Facility View' && <FacilityView siteId="DSP-AL-20010" />}
                {activeSection === 'Vendors' && <Vendors vendors={vendors} refreshVendors={refreshVendors} />}
                {activeSection === 'Transfers' && <div className="container"><h2>Transfers</h2><p>Transfers page coming soon</p></div>}
                {activeSection === 'Processing' && <Processing inventory={inventory} refreshInventory={refreshInventory} />}
                {activeSection === 'Sales & Distribution' && <SalesDashboard />}
                {activeSection === 'Users' && <Users />}
                {activeSection === 'Reporting' && <Reporting exportToExcel={exportToExcel} />}
                {activeSection === 'Management' && isAdmin && location.pathname === '/management' && <div className="container"><h2>Management</h2><p>Select an option from the menu</p></div>}
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
          <Route path="/transfers" element={<div className="container"><h2>Transfers</h2><p>Transfers page coming soon</p></div>} />
          <Route path="/items" element={<Items />} />
          <Route path="/items/:name" element={<ItemDetails />} />
          <Route path="/sites" element={isAdmin ? <Sites /> : <div className="container"><h2>Access Denied</h2><p>Only Admins can access this page</p></div>} />
          <Route path="/receive" element={<ReceivePage refreshInventory={refreshInventory} vendors={vendors} refreshVendors={refreshVendors} />} />
          <Route path="/vendors" element={<Vendors vendors={vendors} refreshVendors={refreshVendors} />} />
          <Route path="/vendors/:name" element={<VendorDetails vendors={vendors} refreshVendors={refreshVendors} refreshInventory={refreshInventory} />} />
          <Route path="/vendors/:name/purchase-orders" element={<PurchaseOrderList />} />
          <Route path="/vendors/:name/purchase-orders/new" element={<PurchaseOrderForm />} />
          <Route path="/vendors/:name/purchase-orders/:poNumber" element={<PurchaseOrderForm />} />
          <Route path="/processing" element={<Processing inventory={inventory} refreshInventory={refreshInventory} />} />
          <Route path="/products" element={<Products />} />
          <Route path="/products/:id" element={<ProductDetails />} />
          <Route path="/production" element={<Production inventory={inventory} refreshInventory={refreshInventory} />} />
          <Route
            path="/production/:batchId"
            element={<BatchDetails inventory={inventory} refreshInventory={refreshInventory} />}
          />
          <Route path="/production/:batchId/brewlog" element={<BrewLog />} />
          <Route path="/production-page" element={<ProductionPage />} />
          <Route path="/locations" element={isAdmin ? <Locations /> : <div className="container"><h2>Access Denied</h2><p>Only Admins can access this page</p></div>} />
          <Route path="/equipment" element={<EquipmentPage />} />
          <Route path="/planning" element={<div className="container"><h2>Planning</h2><p>Coming soon</p></div>} />
          <Route path="/facility-designer" element={isAdmin ? <FacilityDesigner /> : <div className="container"><h2>Access Denied</h2><p>Only Admins can access this page</p></div>} />
          <Route path="/facility-view" element={<FacilityView siteId="DSP-AL-20010" />} />
          <Route path="/management" element={isAdmin ? <div className="container"><h2>Management</h2><p>Select an option from the menu</p></div> : <div className="container"><h2>Access Denied</h2><p>Only Admins can access this page</p></div>} />
          <Route path="/users" element={<Users />} />
          <Route path="/sales-orders" element={<SalesOrderList />} />
          <Route path="/sales-orders/new" element={<SalesOrderComponent inventory={inventory} />} />
          <Route path="/sales-orders/:orderId" element={<SalesOrderComponent inventory={inventory} />} />
          <Route path="/invoices" element={<InvoicesList />} />
          <Route path="/invoices/:invoiceId" element={<InvoiceComponent inventory={inventory} refreshInventory={refreshInventory} />} />
          <Route path="/customers" element={<Customers />} />
          <Route path="/customers/:customerId" element={<CustomerDetails />} />
          <Route path="/keg-tracking" element={<KegTracking inventory={inventory} refreshInventory={refreshInventory} />} />
          <Route path="/settings" element={<Settings />} />
        </Routes>
      </div>
      <nav className="navbar-mobile">
        <Link to="/keg-tracking" onClick={() => {
          console.log('[App] Navbar-mobile Kegs clicked');
          setMenuOpen(false); // Keep for mobile bottom nav
        }}>Kegs</Link>
        <Link to="/sales-orders" onClick={() => {
          console.log('[App] Navbar-mobile Sales Orders clicked');
          setMenuOpen(false); // Keep for mobile bottom nav
        }}>Sales Orders</Link>
        <Link to="/invoices" onClick={() => {
          console.log('[App] Navbar-mobile Invoices clicked');
          setMenuOpen(false); // Keep for mobile bottom nav
        }}>Invoices</Link>
        <Link to="/production" onClick={() => {
          console.log('[App] Navbar-mobile Batches clicked');
          setMenuOpen(false); // Keep for mobile bottom nav
        }}>Batches</Link>
      </nav>
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