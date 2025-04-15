import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  InventoryItem,
  Status,
  MaterialType,
  Unit,
  Account,
  Vendor,
  Site,
} from '../types/interfaces';

interface InventoryProps {
  vendors: Vendor[];
  refreshVendors: () => Promise<void>;
}

const Inventory: React.FC<InventoryProps> = ({ vendors, refreshVendors }) => {
  const navigate = useNavigate();
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [filteredInventory, setFilteredInventory] = useState<InventoryItem[]>([]);
  const [sites, setSites] = useState<Site[]>([]); // New state for sites
  const [filter, setFilter] = useState({
    identifier: '',
    item: '',
    lotNumber: '',
    account: '',
    type: '',
    quantity: '',
    unit: '',
    proof: '',
    proofGallons: '',
    receivedDate: '',
    source: '',
    description: '',
    cost: '',
    totalCost: '',
    poNumber: '',
    siteName: '', // New filter for site name
  });
  const [sortConfig, setSortConfig] = useState<{
    key: keyof InventoryItem | 'siteName';
    direction: 'asc' | 'desc';
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:3001';

  const refreshInventory = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/inventory`);
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
      const data: InventoryItem[] = await res.json();
      setInventory(data);
      setFilteredInventory(data);
    } catch (err: any) {
      setError('Failed to fetch inventory: ' + err.message);
    }
  };

  // New function to fetch sites
  const fetchSites = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/sites`);
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
      const data: Site[] = await res.json();
      setSites(data);
    } catch (err: any) {
      setError('Failed to fetch sites: ' + err.message);
    }
  };

  useEffect(() => {
    refreshInventory();
    fetchSites(); // Fetch sites on mount
  }, []);

  useEffect(() => {
    let filtered = [...inventory];

    if (filter.identifier) {
      filtered = filtered.filter((item) =>
        item.identifier.toLowerCase().includes(filter.identifier.toLowerCase())
      );
    }
    if (filter.item) {
      filtered = filtered.filter((item) =>
        item.item.toLowerCase().includes(filter.item.toLowerCase())
      );
    }
    if (filter.lotNumber) {
      filtered = filtered.filter((item) =>
        item.lotNumber.toLowerCase().includes(filter.lotNumber.toLowerCase())
      );
    }
    if (filter.account) {
      filtered = filtered.filter((item) =>
        item.account.toLowerCase().includes(filter.account.toLowerCase())
      );
    }
    if (filter.type) {
      filtered = filtered.filter((item) =>
        item.type.toLowerCase().includes(filter.type.toLowerCase())
      );
    }
    if (filter.quantity) {
      filtered = filtered.filter((item) =>
        item.quantity.toString().includes(filter.quantity)
      );
    }
    if (filter.unit) {
      filtered = filtered.filter((item) =>
        item.unit.toLowerCase().includes(filter.unit.toLowerCase())
      );
    }
    if (filter.proof) {
      filtered = filtered.filter((item) =>
        item.proof?.toLowerCase().includes(filter.proof.toLowerCase())
      );
    }
    if (filter.proofGallons) {
      filtered = filtered.filter((item) =>
        item.proofGallons?.toString().includes(filter.proofGallons)
      );
    }
    if (filter.receivedDate) {
      filtered = filtered.filter((item) =>
        item.receivedDate.toLowerCase().includes(filter.receivedDate.toLowerCase())
      );
    }
    if (filter.source) {
      filtered = filtered.filter((item) =>
        item.source?.toLowerCase().includes(filter.source.toLowerCase())
      );
    }
    if (filter.description) {
      filtered = filtered.filter((item) =>
        item.description?.toLowerCase().includes(filter.description.toLowerCase())
      );
    }
    if (filter.cost) {
      filtered = filtered.filter((item) =>
        item.cost?.toString().includes(filter.cost)
      );
    }
    if (filter.totalCost) {
      filtered = filtered.filter((item) =>
        item.totalCost?.toString().includes(filter.totalCost)
      );
    }
    if (filter.poNumber) {
      filtered = filtered.filter((item) =>
        item.poNumber?.toLowerCase().includes(filter.poNumber.toLowerCase())
      );
    }
    // New filter for siteName
    if (filter.siteName) {
      filtered = filtered.filter((item) => {
        const site = sites.find((s) => s.siteId === item.siteId);
        return site?.name.toLowerCase().includes(filter.siteName.toLowerCase());
      });
    }

    if (sortConfig !== null) {
      filtered.sort((a, b) => {
        let aValue: any;
        let bValue: any;

        if (sortConfig.key === 'siteName') {
          aValue = sites.find((s) => s.siteId === a.siteId)?.name || '';
          bValue = sites.find((s) => s.siteId === b.siteId)?.name || '';
        } else {
          aValue = a[sortConfig.key];
          bValue = b[sortConfig.key];
        }

        if (aValue === undefined || aValue === null) aValue = '';
        if (bValue === undefined || bValue === null) bValue = '';

        if (aValue < bValue) {
          return sortConfig.direction === 'asc' ? -1 : 1;
        }
        if (aValue > bValue) {
          return sortConfig.direction === 'asc' ? 1 : -1;
        }
        return 0;
      });
    }

    setFilteredInventory(filtered);
  }, [inventory, filter, sortConfig, sites]);

  const handleSort = (key: keyof InventoryItem | 'siteName') => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const handleFilterChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFilter((prev) => ({ ...prev, [name]: value }));
  };

  const handleReceive = () => {
    navigate('/receive', { state: { vendor: '' } });
  };

  const handleMove = () => {
    navigate('/move');
  };

  const handlePackage = () => {
    navigate('/package');
  };

  const handleLoss = () => {
    navigate('/loss');
  };

  const handleVendorDetails = () => {
    navigate('/vendor-details');
  };

  const columns = [
    { id: 'identifier', label: 'Identifier' },
    { id: 'item', label: 'Item' },
    { id: 'lotNumber', label: 'Lot Number' },
    { id: 'account', label: 'Account' },
    { id: 'type', label: 'Type' },
    { id: 'quantity', label: 'Quantity' },
    { id: 'unit', label: 'Unit' },
    { id: 'proof', label: 'Proof' },
    { id: 'proofGallons', label: 'Proof Gallons' },
    { id: 'receivedDate', label: 'Received Date' },
    { id: 'source', label: 'Source' },
    { id: 'siteName', label: 'Site' }, // Replaced status with siteName
    { id: 'description', label: 'Description' },
    { id: 'cost', label: 'Cost' },
    { id: 'totalCost', label: 'Total Cost' },
    { id: 'poNumber', label: 'PO Number' },
  ];

  return (
    <div className="inventory-container">
      <h2>Inventory</h2>
      {error && <div className="error">{error}</div>}
      <div className="inventory-actions">
        <button onClick={handleReceive}>Receive Inventory</button>
        <button onClick={handleMove}>Move Inventory</button>
        <button onClick={handlePackage}>Package Inventory</button>
        <button onClick={handleLoss}>Report Loss</button>
        <button onClick={handleVendorDetails}>Vendor Details</button>
      </div>
      <div className="inventory-table-container">
        <table className="inventory-table">
          <thead>
            <tr>
              {columns.map((column) => (
                <th
                  key={column.id}
                  onClick={() => handleSort(column.id as keyof InventoryItem | 'siteName')}
                >
                  {column.label}
                  {sortConfig?.key === column.id ? (
                    sortConfig.direction === 'asc' ? (
                      ' ↑'
                    ) : (
                      ' ↓'
                    )
                  ) : null}
                </th>
              ))}
            </tr>
            <tr>
              {columns.map((column) => (
                <th key={column.id}>
                  <input
                    type="text"
                    name={column.id}
                    value={filter[column.id as keyof typeof filter] || ''}
                    onChange={handleFilterChange}
                    placeholder={`Filter ${column.label}`}
                    style={{ width: '100%' }}
                  />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filteredInventory.map((item, index) => (
              <tr key={index}>
                {columns.map((column) => {
                  if (column.id === 'siteName') {
                    const site = sites.find((s) => s.siteId === item.siteId);
                    return <td key={column.id}>{site?.name || 'Unknown'}</td>;
                  }
                  return (
                    <td key={column.id}>
                      {item[column.id as keyof InventoryItem]?.toString() || ''}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default Inventory;