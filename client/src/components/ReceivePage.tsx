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
  const [showNewItemModal, setShowNewItemModal] = useState(false); // Modal state
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
      setShowNewItemModal(false); // Close modal
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
    <div style={{ padding: '20px', maxWidth: '600px', margin: '0 auto' }}>
      <h2>Receive Inventory</h2>
      {productionError && <p style={{ color: 'red' }}>{productionError}</p>}
      {successMessage && (
        <div style={{ color: 'green', textAlign: 'center' }}>
          <p>{successMessage}</p>
          <img src="/doggo-slurp.gif" alt="Dog slurping" style={{ width: '100px', height: '100px' }} />
        </div>
      )}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleReceive();
        }}
        style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}
      >
        <label>
          Item:
          <input
            type="text"
            value={receiveForm.identifier}
            onChange={handleItemInputChange}
            onKeyDown={handleKeyDown}
            placeholder="Type to search items"
            onFocus={() => setShowItemSuggestions(true)}
            onBlur={() => setTimeout(() => setShowItemSuggestions(false), 300)}
            style={{ width: '100%' }}
          />
          {showItemSuggestions && (
            <ul
              style={{
                border: '1px solid #ccc',
                maxHeight: '150px',
                overflowY: 'auto',
                position: 'absolute',
                backgroundColor: '#fff',
                width: '300px',
                listStyle: 'none',
                padding: 0,
                margin: 0,
                zIndex: 1000,
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
                      padding: '5px 10px',
                      cursor: 'pointer',
                      backgroundColor: receiveForm.identifier === item.name ? '#e0e0e0' : '#fff',
                    }}
                  >
                    {item.name}
                  </li>
                ))
              ) : (
                receiveForm.identifier && (
                  <li style={{ padding: '5px 10px' }}>
                    No matches found.{' '}
                    <button
                      type="button"
                      onClick={() => {
                        setNewItem(receiveForm.identifier || '');
                        setShowNewItemModal(true); // Open modal
                        setShowItemSuggestions(false);
                      }}
                    >
                      Create "{receiveForm.identifier}"
                    </button>
                  </li>
                )
              )}
            </ul>
          )}
        </label>

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
                borderRadius: '5px',
                width: '400px',
              }}
            >
              <h3>Create New Item</h3>
              <label>
                Item Name:
                <input
                  type="text"
                  value={newItem}
                  onChange={(e) => setNewItem(e.target.value)}
                  placeholder="Enter item name"
                  style={{ width: '100%', marginBottom: '10px' }}
                />
              </label>
              <label>
                Material Type:
                <select
                  value={newItemType}
                  onChange={(e) => setNewItemType(e.target.value)}
                  style={{ width: '100%', marginBottom: '10px' }}
                >
                  {Object.values(MaterialType).map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </label>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <button type="button" onClick={handleCreateItem}>
                  Create
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowNewItemModal(false);
                    setNewItem('');
                    setNewItemType(MaterialType.Grain);
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        <label>
          Material Type:
          <select
            value={receiveForm.materialType}
            onChange={(e) => setReceiveForm({ ...receiveForm, materialType: e.target.value as MaterialType })}
          >
            {Object.values(MaterialType).map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </label>
        {receiveForm.materialType === MaterialType.Spirits && (
          <>
            <label>
              Account:
              <select
                value={receiveForm.account}
                onChange={(e) => setReceiveForm({ ...receiveForm, account: e.target.value })}
              >
                <option value="Storage">Storage</option>
                <option value="Processing">Processing</option>
              </select>
            </label>
            <label>
              Proof:
              <input
                type="number"
                value={receiveForm.proof}
                onChange={(e) => setReceiveForm({ ...receiveForm, proof: e.target.value })}
                step="0.01"
                min="0"
                max="200"
              />
            </label>
            <label>
              DSP Number:
              <input
                type="text"
                value={receiveForm.dspNumber}
                onChange={(e) => setReceiveForm({ ...receiveForm, dspNumber: e.target.value })}
              />
            </label>
          </>
        )}
        <label>
          Quantity:
          <input
            type="number"
            value={receiveForm.quantity}
            onChange={(e) => setReceiveForm({ ...receiveForm, quantity: e.target.value })}
            step="0.01"
            min="0"
          />
        </label>
        <label>
          Unit:
          <select
            value={receiveForm.unit}
            onChange={(e) => setReceiveForm({ ...receiveForm, unit: e.target.value as Unit })}
          >
            {Object.values(Unit).map((unit) => (
              <option key={unit} value={unit}>
                {unit}
              </option>
            ))}
          </select>
        </label>
        <label>
          Vendor:
          <input
            type="text"
            value={receiveForm.source}
            onChange={handleVendorInputChange}
            placeholder="Type to search vendors"
            onFocus={() => setShowVendorSuggestions(true)}
            onBlur={() => setTimeout(() => setShowVendorSuggestions(false), 300)}
            style={{ width: '100%' }}
          />
          {showVendorSuggestions && (
            <ul
              style={{
                border: '1px solid #ccc',
                maxHeight: '150px',
                overflowY: 'auto',
                position: 'absolute',
                backgroundColor: '#fff',
                width: '300px',
                listStyle: 'none',
                padding: 0,
                margin: 0,
                zIndex: 1000,
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
                    padding: '5px 10px',
                    cursor: 'pointer',
                    backgroundColor: receiveForm.source === vendor.name ? '#e0e0e0' : '#fff',
                  }}
                >
                  {vendor.name}
                </li>
              ))}
            </ul>
          )}
        </label>
        <label>
          Cost:
          <input
            type="number"
            value={receiveForm.cost}
            onChange={(e) => setReceiveForm({ ...receiveForm, cost: e.target.value })}
            step="0.01"
            min="0"
            placeholder="Enter cost in USD"
          />
        </label>
        <label>
          Received Date:
          <input
            type="date"
            value={receiveForm.receivedDate}
            onChange={(e) => setReceiveForm({ ...receiveForm, receivedDate: e.target.value })}
          />
        </label>
        {receiveForm.materialType === MaterialType.Other && (
          <label>
            Description (Optional):
            <input
              type="text"
              value={receiveForm.description}
              onChange={(e) => setReceiveForm({ ...receiveForm, description: e.target.value })}
            />
          </label>
        )}
        <button type="submit">Receive</button>
        <button type="button" onClick={() => navigate('/')}>
          Cancel
        </button>
      </form>
    </div>
  );
};

export default ReceivePage;