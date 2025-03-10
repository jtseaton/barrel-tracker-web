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
    cost: '', // Added
  });
  const [items, setItems] = useState<Item[]>([]);
  const [filteredItems, setFilteredItems] = useState<Item[]>([]);
  const [showItemSuggestions, setShowItemSuggestions] = useState(false);
  const [newItem, setNewItem] = useState<string>('');
  const [newItemType, setNewItemType] = useState<string>(MaterialType.Grain);
  const [showNewItemInput, setShowNewItemInput] = useState(false);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [filteredVendors, setFilteredVendors] = useState<Vendor[]>([]);
  const [showVendorSuggestions, setShowVendorSuggestions] = useState(false);
  const [productionError, setProductionError] = useState<string | null>(null);

  const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || '';

  // ... (useEffect unchanged)

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
    setReceiveForm({ ...receiveForm, identifier: item.name, materialType: item.type as MaterialType });
    setShowItemSuggestions(false);
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
      setShowNewItemInput(false);
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
    if (!receiveForm.identifier || !receiveForm.materialType || !receiveForm.quantity || !receiveForm.unit) {
      setProductionError('Item, Material Type, Quantity, and Unit are required');
      return;
    }
    if (receiveForm.materialType === MaterialType.Spirits && !receiveForm.proof) {
      setProductionError('Proof is required for Spirits');
      return;
    }
    if (receiveForm.materialType === MaterialType.Other && !receiveForm.description) {
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
      cost: receiveForm.cost || undefined, // Added
    };
    try {
      const res = await fetch(`${API_BASE_URL}/api/receive`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newItem),
      });
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || `HTTP error! status: ${res.status}`);
      }
      console.log('Receive successful, refreshing inventory');
      await refreshInventory();
      navigate('/inventory');
    } catch (err: any) {
      console.error('Receive error:', err);
      setProductionError(err.message);
    }
  };

  return (
    <div style={{ padding: '20px', maxWidth: '600px', margin: '0 auto' }}>
      <h2>Receive Inventory</h2>
      {productionError && <p style={{ color: 'red' }}>{productionError}</p>}
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
            placeholder="Type to search items"
            onFocus={() => setShowItemSuggestions(true)}
            onBlur={() => setTimeout(() => setShowItemSuggestions(false), 200)}
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
              }}
            >
              {filteredItems.map((item) => (
                <li
                  key={item.name}
                  onClick={() => handleItemSelect(item)}
                  style={{
                    padding: '5px 10px',
                    cursor: 'pointer',
                    backgroundColor: receiveForm.identifier === item.name ? '#e0e0e0' : '#fff',
                  }}
                >
                  {item.name}
                </li>
              ))}
              {filteredItems.length === 0 && receiveForm.identifier && (
                <li style={{ padding: '5px 10px' }}>
                  No matches found.{' '}
                  <button
                    type="button"
                    onClick={() => {
                      setNewItem(receiveForm.identifier || '');
                      setShowNewItemInput(true);
                      setShowItemSuggestions(false);
                    }}
                  >
                    Create "{receiveForm.identifier}"
                  </button>
                </li>
              )}
            </ul>
          )}
        </label>
        {showNewItemInput && (
          <div>
            <input
              type="text"
              value={newItem}
              onChange={(e) => setNewItem(e.target.value)}
              placeholder="Confirm new item name"
            />
            <select
              value={newItemType}
              onChange={(e) => setNewItemType(e.target.value)}
            >
              {Object.values(MaterialType).map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
            <button type="button" onClick={handleCreateItem}>
              Create
            </button>
            <button type="button" onClick={() => setShowNewItemInput(false)}>
              Cancel
            </button>
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
            onBlur={() => setTimeout(() => setShowVendorSuggestions(false), 200)}
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
              }}
            >
              {filteredVendors.map((vendor) => (
                <li
                  key={vendor.name}
                  onClick={() => handleVendorSelect(vendor)}
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
            Description:
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