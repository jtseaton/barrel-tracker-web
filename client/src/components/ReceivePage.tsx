import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ReceiveForm, InventoryItem } from '../types/interfaces';
import { MaterialType, Unit, Status } from '../types/enums';

const OUR_DSP = 'DSP-AL-20010';

interface ReceivePageProps {
  refreshInventory: () => Promise<void>;
}

interface Item {
  name: string;
  type: string;
  enabled: number;
}

interface Vendor {
  name: string;
  enabled: number;
}

const ReceivePage: React.FC<ReceivePageProps> = ({ refreshInventory }) => {
  const navigate = useNavigate();
  const [receiveForm, setReceiveForm] = useState<ReceiveForm>({
    identifier: '',
    account: 'Storage',
    materialType: MaterialType.Grain,
    quantity: '',
    unit: Unit.Pounds,
    proof: '',
    source: '',
    dspNumber: OUR_DSP,
    receivedDate: new Date().toISOString().split('T')[0],
    description: '',
    cost: '',
  });
  const [items, setItems] = useState<Item[]>([]);
  const [filteredItems, setFilteredItems] = useState<Item[]>([]);
  const [showItemSuggestions, setShowItemSuggestions] = useState(false);
  const [newItem, setNewItem] = useState<string>('');
  const [newItemType, setNewItemType] = useState<string>(MaterialType.Grain);
  const [showNewItemModal, setShowNewItemModal] = useState(false);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [filteredVendors, setFilteredVendors] = useState<Vendor[]>([]);
  const [showVendorSuggestions, setShowVendorSuggestions] = useState(false);
  const [productionError, setProductionError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:3000';

  useEffect(() => {
    const fetchItems = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/items`);
        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
        const data = await res.json();
        console.log('Fetched items:', data);
        setItems(data);
        setFilteredItems(data);
      } catch (err: any) {
        console.error('Fetch items error:', err);
        setProductionError('Failed to fetch items: ' + err.message);
      }
    };

    const fetchVendors = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/vendors`);
        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
        const data = await res.json();
        console.log('Fetched vendors:', data);
        setVendors(data);
        setFilteredVendors(data);
      } catch (err: any) {
        console.error('Fetch vendors error:', err);
        setProductionError('Failed to fetch vendors: ' + err.message);
      }
    };

    fetchItems();
    fetchVendors();
  }, [API_BASE_URL]);

  const handleItemInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setReceiveForm({ ...receiveForm, identifier: value });
    setShowItemSuggestions(true);
    if (value.trim() === '') {
      setFilteredItems(items);
    } else {
      const filtered = items.filter(item =>
        item.name.toLowerCase().includes(value.toLowerCase())
      );
      setFilteredItems(filtered);
    }
  };

  const handleItemSelect = (item: Item) => {
    console.log('Selected item:', item);
    const normalizedType = item.type
      ? item.type.charAt(0).toUpperCase() + item.type.slice(1).toLowerCase()
      : 'Other';
    const materialType = Object.values(MaterialType).includes(normalizedType as MaterialType)
      ? normalizedType as MaterialType
      : MaterialType.Other;
    console.log('Normalized type:', normalizedType, 'Setting materialType to:', materialType);
    setReceiveForm(prev => {
      const updated = { ...prev, identifier: item.name, materialType };
      console.log('Updated form state:', updated);
      return updated;
    });
    setShowItemSuggestions(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && filteredItems.length > 0) {
      e.preventDefault();
      handleItemSelect(filteredItems[0]);
    }
  };

  const handleCreateItem = async () => {
    if (!newItem) {
      setProductionError('New item name is required');
      return;
    }
    try {
      const res = await fetch(`${API_BASE_URL}/api/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newItem, type: newItemType }),
      });
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || `HTTP error! status: ${res.status}`);
      }
      const updatedItems = [...items, { name: newItem, type: newItemType, enabled: 1 }];
      setItems(updatedItems);
      setFilteredItems(updatedItems);
      setReceiveForm({ ...receiveForm, identifier: newItem, materialType: newItemType as MaterialType });
      setNewItem('');
      setNewItemType(MaterialType.Grain);
      setShowNewItemModal(false);
      setProductionError(null);
    } catch (err: any) {
      console.error('Create item error:', err);
      setProductionError('Failed to create item: ' + err.message);
    }
  };

  const handleVendorInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setReceiveForm({ ...receiveForm, source: value });
    setShowVendorSuggestions(true);
    if (value.trim() === '') {
      setFilteredVendors(vendors);
    } else {
      const filtered = vendors.filter(vendor =>
        vendor.name.toLowerCase().includes(value.toLowerCase())
      );
      setFilteredVendors(filtered);
    }
  };

  const handleVendorSelect = (vendor: Vendor) => {
    setReceiveForm({ ...receiveForm, source: vendor.name });
    setShowVendorSuggestions(false);
  };

  const handleReceive = async () => {
    console.log('handleReceive triggered, form:', receiveForm);
    if (!receiveForm.identifier || !receiveForm.materialType || !receiveForm.quantity || !receiveForm.unit) {
      setProductionError('Item, Material Type, Quantity, and Unit are required');
      return;
    }
    if (receiveForm.materialType === MaterialType.Spirits && !receiveForm.proof) {
      setProductionError('Proof is required for Spirits');
      return;
    }
    if (receiveForm.materialType === MaterialType.Other && !(receiveForm.description || '').trim()) {
      setProductionError('Description is required for Other material type');
      return;
    }
    const quantity = parseFloat(receiveForm.quantity);
    const proof = receiveForm.proof ? parseFloat(receiveForm.proof) : undefined;
    const cost = receiveForm.cost ? parseFloat(receiveForm.cost) : undefined;
    if (isNaN(quantity) || quantity <= 0 || (proof && (isNaN(proof) || proof > 200 || proof < 0)) || (cost && (isNaN(cost) || cost < 0))) {
      setProductionError('Invalid quantity, proof, or cost');
      return;
    }
    const proofGallons = proof ? (quantity * (proof / 100)).toFixed(2) : undefined;
    const newItem: InventoryItem = {
      identifier: receiveForm.identifier,
      account: receiveForm.materialType === MaterialType.Spirits ? receiveForm.account : 'Storage',
      type: receiveForm.materialType,
      quantity: receiveForm.quantity,
      unit: receiveForm.unit,
      proof: receiveForm.proof || undefined,
      proofGallons: proofGallons,
      receivedDate: receiveForm.receivedDate,
      source: receiveForm.source,
      dspNumber: receiveForm.materialType === MaterialType.Spirits ? receiveForm.dspNumber : undefined,
      status: Status.Received,
      description: receiveForm.description,
      cost: receiveForm.cost || undefined,
    };
    console.log('Submitting item:', newItem);
    try {
      const res = await fetch(`${API_BASE_URL}/api/receive`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newItem),
      });
      console.log('Fetch sent, status:', res.status);
      if (!res.ok) {
        const text = await res.text();
        console.log('Non-JSON response:', text);
        throw new Error(`HTTP error! status: ${res.status}, body: ${text}`);
      }
      const responseData = await res.json();
      console.log('Receive response:', responseData);
      setSuccessMessage('Item received successfully!');
      await refreshInventory();
      setTimeout(() => {
        setSuccessMessage(null);
        navigate('/inventory');
      }, 1000);
    } catch (err: any) {
      console.error('Receive error:', err);
      setProductionError(err.message || 'Failed to receive item—server error');
    }
  };

  return (
    <div style={{ padding: '20px', maxWidth: '600px', margin: '0 auto', fontFamily: 'Arial, sans-serif' }}>
      <h2 style={{ color: '#333', marginBottom: '20px' }}>Receive Inventory</h2>
      <div style={{ backgroundColor: '#fff', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
        {productionError && <p style={{ color: '#f44336', marginBottom: '15px', textAlign: 'center' }}>{productionError}</p>}
        {successMessage && (
          <div style={{ color: '#4CAF50', textAlign: 'center', marginBottom: '15px' }}>
            <p>{successMessage}</p>
            <img src="/doggo-slurp.gif" alt="Dog slurping" style={{ width: '100px', height: '100px' }} />
          </div>
        )}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleReceive();
          }}
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr',
            gap: '15px',
            boxSizing: 'border-box',
          }}
        >
          <div style={{ position: 'relative' }}>
            <label style={{ fontWeight: 'bold', color: '#555', display: 'block', marginBottom: '5px' }}>
              Item:
            </label>
            <input
              type="text"
              value={receiveForm.identifier}
              onChange={handleItemInputChange}
              onKeyDown={handleKeyDown}
              placeholder="Type to search items"
              onFocus={() => setShowItemSuggestions(true)}
              onBlur={() => setTimeout(() => setShowItemSuggestions(false), 300)}
              style={{
                width: '100%',
                padding: '8px',
                border: '1px solid #ddd',
                borderRadius: '4px',
                boxSizing: 'border-box',
              }}
            />
            {showItemSuggestions && (
              <ul
                style={{
                  border: '1px solid #ddd',
                  maxHeight: '150px',
                  overflowY: 'auto',
                  position: 'absolute',
                  backgroundColor: '#fff',
                  width: '100%',
                  listStyle: 'none',
                  padding: 0,
                  margin: 0,
                  zIndex: 1000,
                  borderRadius: '4px',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                }}
              >
                {filteredItems.length > 0 ? (
                  filteredItems.map((item) => (
                    <li
                      key={item.name}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        handleItemSelect(item);
                      }}
                      style={{
                        padding: '8px 10px',
                        cursor: 'pointer',
                        backgroundColor: receiveForm.identifier === item.name ? '#e0e0e0' : '#fff',
                        borderBottom: '1px solid #eee',
                      }}
                    >
                      {item.name}
                    </li>
                  ))
                ) : (
                  receiveForm.identifier && (
                    <li style={{ padding: '8px 10px', borderBottom: '1px solid #eee' }}>
                      No matches found.{' '}
                      <button
                        type="button"
                        onClick={() => {
                          setNewItem(receiveForm.identifier || '');
                          setShowNewItemModal(true);
                          setShowItemSuggestions(false);
                        }}
                        style={{
                          backgroundColor: '#2196F3',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          padding: '5px 10px',
                          cursor: 'pointer',
                          transition: 'background-color 0.3s',
                        }}
                        onMouseOver={(e) => (e.currentTarget.style.backgroundColor = '#1976D2')}
                        onMouseOut={(e) => (e.currentTarget.style.backgroundColor = '#2196F3')}
                      >
                        Create "{receiveForm.identifier}"
                      </button>
                    </li>
                  )
                )}
              </ul>
            )}
          </div>

          {/* New Item Modal */}
          {showNewItemModal && (
            <div
              style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: 'rgba(0,0,0,0.5)',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                zIndex: 2000,
              }}
            >
              <div
                style={{
                  backgroundColor: 'white',
                  padding: '20px',
                  borderRadius: '8px',
                  width: '400px',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                }}
              >
                <h3 style={{ color: '#333', marginBottom: '15px' }}>Create New Item</h3>
                <label style={{ display: 'block', marginBottom: '10px' }}>
                  Item Name:
                  <input
                    type="text"
                    value={newItem}
                    onChange={(e) => setNewItem(e.target.value)}
                    placeholder="Enter item name"
                    style={{ width: '100%', padding: '8px', marginTop: '5px', border: '1px solid #ddd', borderRadius: '4px' }}
                  />
                </label>
                <label style={{ display: 'block', marginBottom: '10px' }}>
                  Material Type:
                  <select
                    value={newItemType}
                    onChange={(e) => setNewItemType(e.target.value)}
                    style={{ width: '100%', padding: '8px', marginTop: '5px', border: '1px solid #ddd', borderRadius: '4px' }}
                  >
                    {Object.values(MaterialType).map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </select>
                </label>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <button
                    type="button"
                    onClick={handleCreateItem}
                    style={{
                      backgroundColor: '#4CAF50',
                      color: 'white',
                      padding: '10px 20px',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      transition: 'background-color 0.3s',
                    }}
                    onMouseOver={(e) => (e.currentTarget.style.backgroundColor = '#45a049')}
                    onMouseOut={(e) => (e.currentTarget.style.backgroundColor = '#4CAF50')}
                  >
                    Create
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowNewItemModal(false);
                      setNewItem('');
                      setNewItemType(MaterialType.Grain);
                    }}
                    style={{
                      backgroundColor: '#f44336',
                      color: 'white',
                      padding: '10px 20px',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      transition: 'background-color 0.3s',
                    }}
                    onMouseOver={(e) => (e.currentTarget.style.backgroundColor = '#da190b')}
                    onMouseOut={(e) => (e.currentTarget.style.backgroundColor = '#f44336')}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}

          <div>
            <label style={{ fontWeight: 'bold', color: '#555', display: 'block', marginBottom: '5px' }}>
              Material Type:
            </label>
            <select
              value={receiveForm.materialType}
              onChange={(e) => setReceiveForm({ ...receiveForm, materialType: e.target.value as MaterialType })}
              style={{
                width: '100%',
                padding: '8px',
                border: '1px solid #ddd',
                borderRadius: '4px',
                boxSizing: 'border-box',
              }}
            >
              {Object.values(MaterialType).map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </div>

          {/* Quantity Field Added Here */}
          <div>
            <label style={{ fontWeight: 'bold', color: '#555', display: 'block', marginBottom: '5px' }}>
              Quantity:
            </label>
            <input
              type="number"
              value={receiveForm.quantity}
              onChange={(e) => setReceiveForm({ ...receiveForm, quantity: e.target.value })}
              step="0.01"
              min="0"
              placeholder="Enter quantity"
              style={{
                width: '100%',
                padding: '8px',
                border: '1px solid #ddd',
                borderRadius: '4px',
                boxSizing: 'border-box',
              }}
            />
          </div>

          {receiveForm.materialType === MaterialType.Spirits && (
            <>
              <div>
                <label style={{ fontWeight: 'bold', color: '#555', display: 'block', marginBottom: '5px' }}>
                  Account:
                </label>
                <select
                  value={receiveForm.account}
                  onChange={(e) => setReceiveForm({ ...receiveForm, account: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '8px',
                    border: '1px solid #ddd',
                    borderRadius: '4px',
                    boxSizing: 'border-box',
                  }}
                >
                  <option value="Storage">Storage</option>
                  <option value="Processing">Processing</option>
                </select>
              </div>
              <div>
                <label style={{ fontWeight: 'bold', color: '#555', display: 'block', marginBottom: '5px' }}>
                  Proof:
                </label>
                <input
                  type="number"
                  value={receiveForm.proof}
                  onChange={(e) => setReceiveForm({ ...receiveForm, proof: e.target.value })}
                  step="0.01"
                  min="0"
                  max="200"
                  style={{
                    width: '100%',
                    padding: '8px',
                    border: '1px solid #ddd',
                    borderRadius: '4px',
                    boxSizing: 'border-box',
                  }}
                />
              </div>
              <div style={{ position: 'relative' }}>
                <label style={{ fontWeight: 'bold', color: '#555', display: 'block', marginBottom: '5px' }}>
                  DSP Number:
                </label>
                <input
                  type="text"
                  value={receiveForm.dspNumber}
                  onChange={(e) => setReceiveForm({ ...receiveForm, dspNumber: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '8px',
                    border: '1px solid #ddd',
                    borderRadius: '4px',
                    boxSizing: 'border-box',
                  }}
                />
              </div>
            </>
          )}

          <div>
            <label style={{ fontWeight: 'bold', color: '#555', display: 'block', marginBottom: '5px' }}>
              Unit:
            </label>
            <select
              value={receiveForm.unit}
              onChange={(e) => setReceiveForm({ ...receiveForm, unit: e.target.value as Unit })}
              style={{
                width: '100%',
                padding: '8px',
                border: '1px solid #ddd',
                borderRadius: '4px',
                boxSizing: 'border-box',
              }}
            >
              {Object.values(Unit).map((unit) => (
                <option key={unit} value={unit}>
                  {unit}
                </option>
              ))}
            </select>
          </div>

          <div style={{ position: 'relative' }}>
            <label style={{ fontWeight: 'bold', color: '#555', display: 'block', marginBottom: '5px' }}>
              Vendor:
            </label>
            <input
              type="text"
              value={receiveForm.source}
              onChange={handleVendorInputChange}
              placeholder="Type to search vendors"
              onFocus={() => setShowVendorSuggestions(true)}
              onBlur={() => setTimeout(() => setShowVendorSuggestions(false), 300)}
              style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px', boxSizing: 'border-box' }}
            />
            {showVendorSuggestions && (
              <ul
                style={{
                  border: '1px solid #ddd',
                  maxHeight: '150px',
                  overflowY: 'auto',
                  position: 'absolute',
                  backgroundColor: '#fff',
                  width: '100%',
                  listStyle: 'none',
                  padding: 0,
                  margin: 0,
                  zIndex: 1000,
                  borderRadius: '4px',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                }}
              >
                {filteredVendors.map((vendor) => (
                  <li
                    key={vendor.name}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      handleVendorSelect(vendor);
                    }}
                    style={{
                      padding: '8px 10px',
                      cursor: 'pointer',
                      backgroundColor: receiveForm.source === vendor.name ? '#e0e0e0' : '#fff',
                      borderBottom: '1px solid #eee',
                    }}
                  >
                    {vendor.name}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div>
            <label style={{ fontWeight: 'bold', color: '#555', display: 'block', marginBottom: '5px' }}>
              Cost:
            </label>
            <input
              type="number"
              value={receiveForm.cost}
              onChange={(e) => setReceiveForm({ ...receiveForm, cost: e.target.value })}
              step="0.01"
              min="0"
              placeholder="Enter cost in USD"
              style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px', boxSizing: 'border-box' }}
            />
          </div>

          <div>
            <label style={{ fontWeight: 'bold', color: '#555', display: 'block', marginBottom: '5px' }}>
              Received Date:
            </label>
            <input
              type="date"
              value={receiveForm.receivedDate}
              onChange={(e) => setReceiveForm({ ...receiveForm, receivedDate: e.target.value })}
              style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px', boxSizing: 'border-box' }}
            />
          </div>

          {receiveForm.materialType === MaterialType.Other && (
            <div>
              <label style={{ fontWeight: 'bold', color: '#555', display: 'block', marginBottom: '5px' }}>
                Description (Optional):
              </label>
              <input
                type="text"
                value={receiveForm.description}
                onChange={(e) => setReceiveForm({ ...receiveForm, description: e.target.value })}
                style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px', boxSizing: 'border-box' }}
              />
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '15px' }}>
            <button
              type="submit"
              style={{
                backgroundColor: '#4CAF50',
                color: 'white',
                padding: '10px 20px',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '16px',
                transition: 'background-color 0.3s',
              }}
              onMouseOver={(e) => (e.currentTarget.style.backgroundColor = '#45a049')}
              onMouseOut={(e) => (e.currentTarget.style.backgroundColor = '#4CAF50')}
            >
              Receive
            </button>
            <button
              type="button"
              onClick={() => navigate('/')}
              style={{
                backgroundColor: '#f44336',
                color: 'white',
                padding: '10px 20px',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '16px',
                transition: 'background-color 0.3s',
              }}
              onMouseOver={(e) => (e.currentTarget.style.backgroundColor = '#da190b')}
              onMouseOut={(e) => (e.currentTarget.style.backgroundColor = '#f44336')}
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ReceivePage;