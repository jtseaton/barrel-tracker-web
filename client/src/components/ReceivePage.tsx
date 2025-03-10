import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ReceiveForm, InventoryItem } from '../types/interfaces';
import { MaterialType, Unit, Status } from '../types/enums';

const OUR_DSP = 'DSP-AL-20010';

interface ReceivePageProps {
  refreshInventory: () => Promise<void>;
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
  });
  const [items, setItems] = useState<string[]>([]);
  const [newItem, setNewItem] = useState('');
  const [showNewItemInput, setShowNewItemInput] = useState(false);
  const [productionError, setProductionError] = useState<string | null>(null);

  const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || '';

  useEffect(() => {
    const fetchItems = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/items`);
        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
        const data = await res.json();
        setItems(data.map((item: { name: string }) => item.name));
      } catch (err: any) {
        console.error('Fetch items error:', err);
        setProductionError('Failed to fetch items: ' + err.message);
      }
    };
    fetchItems();
  }, [API_BASE_URL]);

  const handleCreateItem = async () => {
    if (!newItem) {
      setProductionError('New item name is required');
      return;
    }
    try {
      const res = await fetch(`${API_BASE_URL}/api/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newItem }),
      });
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || `HTTP error! status: ${res.status}`);
      }
      setItems([...items, newItem]);
      setReceiveForm({ ...receiveForm, identifier: newItem });
      setNewItem('');
      setShowNewItemInput(false);
      setProductionError(null);
    } catch (err: any) {
      console.error('Create item error:', err);
      setProductionError('Failed to create item: ' + err.message);
    }
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
    if (isNaN(quantity) || quantity <= 0 || (proof && (isNaN(proof) || proof > 200 || proof < 0))) {
      setProductionError('Invalid quantity or proof');
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
      dspNumber: receiveForm.dspNumber,
      status: Status.Received,
      description: receiveForm.description,
    };
    try {
      const res = await fetch(`${API_BASE_URL}/api/receive`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newItem),
      });
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
      await refreshInventory(); // Refresh inventory after successful POST
      navigate('/');
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
          <select
            value={receiveForm.identifier}
            onChange={(e) => setReceiveForm({ ...receiveForm, identifier: e.target.value })}
          >
            <option value="">Select an item</option>
            {items.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
          <button type="button" onClick={() => setShowNewItemInput(true)}>
            Add New Item
          </button>
        </label>
        {showNewItemInput && (
          <div>
            <input
              type="text"
              value={newItem}
              onChange={(e) => setNewItem(e.target.value)}
              placeholder="New item name"
            />
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
        {receiveForm.materialType === MaterialType.Spirits && (
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
        )}
        <label>
          Source:
          <input
            type="text"
            value={receiveForm.source}
            onChange={(e) => setReceiveForm({ ...receiveForm, source: e.target.value })}
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