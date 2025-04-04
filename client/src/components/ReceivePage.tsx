import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { PurchaseOrder, ReceiveItem, InventoryItem, Status } from '../types/interfaces';
import { MaterialType, Unit } from '../types/enums';

const OUR_DSP = 'DSP-AL-20010';

interface ReceivePageProps {
  refreshInventory: () => Promise<void>;
}

interface OtherCharge {
  name: string;
  cost: string;
}

interface Item {
  name: string;
  type: string;
  enabled: number;
}

interface Vendor {
  name: string;
  enabled: number;
  contact?: string; // Added for new vendor form
  address?: string;
}

interface ReceiveForm {
  identifier: string;
  account: string;
  materialType: MaterialType;
  quantity: string;
  unit: Unit;
  proof: string;
  source: string;
  dspNumber: string;
  receivedDate: string;
  description: string;
  cost: string;
  poNumber?: string;
}

interface ReceivableItem {
  identifier: string;
  materialType: MaterialType;
  quantity: string;
  unit: Unit;
  proof?: string;
  description?: string;
  cost?: string;
  poNumber?: string;
}

const OTHER_CHARGES_OPTIONS = [
  'Credit Card Processing',
  'Freight',
  'Shipping',
  'Skid',
  'Milling',
  'Tote Service',
  'Storage',
  'Discount',
];

const ReceivePage: React.FC<ReceivePageProps> = ({ refreshInventory }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [receiveItems, setReceiveItems] = useState<ReceiveItem[]>([]);
  const [otherCharges, setOtherCharges] = useState<OtherCharge[]>([]);
  const [singleForm, setSingleForm] = useState<ReceiveForm>({
    identifier: '',
    account: 'Stored',
    materialType: MaterialType.Grain,
    quantity: '',
    unit: Unit.Pounds,
    proof: '',
    source: location.state?.vendor || '',
    dspNumber: OUR_DSP,
    receivedDate: new Date().toISOString().split('T')[0],
    description: '',
    cost: '',
    poNumber: '',
  });
  const [useSingleItem, setUseSingleItem] = useState(true);
  const [items, setItems] = useState<Item[]>([]);
  const [filteredItems, setFilteredItems] = useState<Item[]>([]);
  const [showItemSuggestions, setShowItemSuggestions] = useState(false);
  const [newItem, setNewItem] = useState<string>('');
  const [newItemType, setNewItemType] = useState<MaterialType>(MaterialType.Grain);
  const [showNewItemModal, setShowNewItemModal] = useState(false);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [filteredVendors, setFilteredVendors] = useState<Vendor[]>([]);
  const [showVendorSuggestions, setShowVendorSuggestions] = useState(false);
  const [newVendor, setNewVendor] = useState<Vendor>({ name: '', enabled: 1, contact: '', address: '' }); // Added for modal
  const [showNewVendorModal, setShowNewVendorModal] = useState(false); // Added for modal
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [selectedPO, setSelectedPO] = useState<string>('');
  const [productionError, setProductionError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [lotItems, setLotItems] = useState<ReceiveItem[]>([]);
  const [showLotModal, setShowLotModal] = useState(false);
  const [poItemToSplit, setPoItemToSplit] = useState<{ name: string; quantity: number } | null>(null);

  const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:3000';

  useEffect(() => {
    const fetchItems = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/items`);
        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
        const data = await res.json();
        setItems(data);
        setFilteredItems(data);
      } catch (err: any) {
        setProductionError('Failed to fetch items: ' + err.message);
      }
    };

    const fetchVendors = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/vendors`);
        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
        const data = await res.json();
        setVendors(data);
        setFilteredVendors(data);
      } catch (err: any) {
        setProductionError('Failed to fetch vendors: ' + err.message);
      }
    };

    const fetchPOs = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/purchase-orders?supplier=${encodeURIComponent(singleForm.source || '')}`);
        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
        const data = await res.json();
        setPurchaseOrders(data);
      } catch (err: any) {
        setProductionError('Failed to fetch POs: ' + err.message);
      }
    };

    fetchItems();
    fetchVendors();
    if (singleForm.source) fetchPOs();
  }, [API_BASE_URL, singleForm.source]);

  const handleItemInputChange = (e: React.ChangeEvent<HTMLInputElement>, index?: number) => {
    const value = e.target.value;
    if (useSingleItem) {
      setSingleForm({ ...singleForm, identifier: value });
      setShowItemSuggestions(true);
      setFilteredItems(value.trim() ? items.filter(item => item.name.toLowerCase().includes(value.toLowerCase())) : items);
    } else if (index !== undefined) {
      const updatedItems = [...receiveItems];
      updatedItems[index].identifier = value;
      setReceiveItems(updatedItems);
      setShowItemSuggestions(true);
      setFilteredItems(value.trim() ? items.filter(item => item.name.toLowerCase().includes(value.toLowerCase())) : items);
    }
  };

  const handleItemSelect = (item: Item, index?: number) => {
    const normalizedType = item.type ? item.type.charAt(0).toUpperCase() + item.type.slice(1).toLowerCase() : 'Other';
    const materialType = Object.values(MaterialType).includes(normalizedType as MaterialType) ? normalizedType as MaterialType : MaterialType.Other;
    if (useSingleItem) {
      setSingleForm({ ...singleForm, identifier: item.name, materialType });
    } else if (index !== undefined) {
      const updatedItems = [...receiveItems];
      updatedItems[index] = { ...updatedItems[index], identifier: item.name, materialType };
      setReceiveItems(updatedItems);
    }
    setShowItemSuggestions(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, index?: number) => {
    if (e.key === 'Enter' && filteredItems.length > 0) {
      e.preventDefault();
      handleItemSelect(filteredItems[0], index);
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
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
      const updatedItems = [...items, { name: newItem, type: newItemType, enabled: 1 }];
      setItems(updatedItems);
      setFilteredItems(updatedItems);
      if (useSingleItem) {
        setSingleForm({ ...singleForm, identifier: newItem, materialType: newItemType });
      } else {
        setReceiveItems([...receiveItems, { identifier: newItem, materialType: newItemType, quantity: '', unit: Unit.Pounds }]);
      }
      setNewItem('');
      setNewItemType(MaterialType.Grain);
      setShowNewItemModal(false);
      setProductionError(null);
    } catch (err: any) {
      setProductionError('Failed to create item: ' + err.message);
    }
  };

  const handleVendorInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSingleForm({ ...singleForm, source: value });
    setShowVendorSuggestions(true);
    setFilteredVendors(value.trim() ? vendors.filter(vendor => vendor.name.toLowerCase().includes(value.toLowerCase())) : vendors);
  };

  const handleVendorSelect = (vendor: Vendor) => {
    setSingleForm({ ...singleForm, source: vendor.name });
    setShowVendorSuggestions(false);
  };

  const handleCreateVendor = async () => {
    if (!newVendor.name) {
      setProductionError('Vendor name is required');
      return;
    }
    try {
      const res = await fetch(`${API_BASE_URL}/api/vendors`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newVendor),
      });
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
      const addedVendor = await res.json();
      const updatedVendors = [...vendors, addedVendor];
      setVendors(updatedVendors);
      setFilteredVendors(updatedVendors);
      setSingleForm({ ...singleForm, source: addedVendor.name });
      setNewVendor({ name: '', enabled: 1, contact: '', address: '' });
      setShowNewVendorModal(false);
      setShowVendorSuggestions(false);
      setProductionError(null);
    } catch (err: any) {
      setProductionError('Failed to create vendor: ' + err.message);
    }
  };

  const handlePOSelect = (poNumber: string) => {
    setSelectedPO(poNumber);
    setSingleForm({ ...singleForm, poNumber });
    const po = purchaseOrders.find(p => p.poNumber === poNumber);
    if (po) {
      const nonSpiritsItems = po.items
        .filter(item => item.materialType !== MaterialType.Spirits)
        .map(item => ({
          identifier: item.name,
          materialType: item.materialType,
          quantity: item.quantity.toString(),
          unit: Unit.Pounds,
          cost: '',
          poNumber: poNumber,
        }));
      const spiritsItems = po.items.filter(item => item.materialType === MaterialType.Spirits);
      setReceiveItems(nonSpiritsItems);
      if (spiritsItems.length > 0) {
        setPoItemToSplit(spiritsItems[0]);
        setShowLotModal(true);
      } else {
        setUseSingleItem(false);
      }
    }
  };

  const handleLotSplit = () => {
    if (!poItemToSplit || lotItems.length === 0 || lotItems.some(item => !item.identifier || !item.quantity)) {
      setProductionError('All lots must have a Lot Number and Quantity');
      return;
    }
    const totalQuantity = lotItems.reduce((sum, item) => sum + parseFloat(item.quantity || '0'), 0);
    if (totalQuantity !== poItemToSplit.quantity) {
      setProductionError(`Total quantity (${totalQuantity}) must equal PO quantity (${poItemToSplit.quantity})`);
      return;
    }
    setReceiveItems(prev => [
      ...prev,
      ...lotItems.map(item => ({
        ...item,
        materialType: MaterialType.Spirits,
        unit: Unit.Gallons,
        poNumber: selectedPO || undefined,
      })),
    ]);
    setLotItems([]);
    setShowLotModal(false);
    setPoItemToSplit(null);
    setUseSingleItem(false);
  };

  const addChargeRow = () => {
    setOtherCharges([...otherCharges, { name: '', cost: '' }]);
  };

  const removeChargeRow = (index: number) => {
    setOtherCharges(otherCharges.filter((_, i) => i !== index));
  };

  const addItemRow = () => {
    setReceiveItems([...receiveItems, { 
      identifier: '', 
      materialType: MaterialType.Grain, 
      quantity: '', 
      unit: Unit.Pounds,
      cost: '',
    }]);
  };

  const removeItemRow = (index: number) => {
    setReceiveItems(receiveItems.filter((_, i) => i !== index));
  };

  const handleReceive = async () => {
    const itemsToReceive: ReceivableItem[] = useSingleItem ? [singleForm] : receiveItems;
    if (!itemsToReceive.length || itemsToReceive.some(item => !item.identifier || !item.materialType || !item.quantity || !item.unit)) {
      setProductionError('All inventory items must have Item/Lot Number, Material Type, Quantity, and Unit');
      return;
    }
    const invalidItems = itemsToReceive.filter(item =>
      (item.materialType === MaterialType.Spirits && !item.proof) ||
      (item.materialType === MaterialType.Other && !item.description?.trim()) ||
      isNaN(parseFloat(item.quantity)) || parseFloat(item.quantity) <= 0 ||
      (item.proof && (isNaN(parseFloat(item.proof)) || parseFloat(item.proof) > 200 || parseFloat(item.proof) < 0)) ||
      (item.cost && (isNaN(parseFloat(item.cost)) || parseFloat(item.cost) < 0))
    );
    if (invalidItems.length) {
      setProductionError('Invalid data in inventory items: check Spirits proof, Other description, or numeric values');
      return;
    }
    const invalidCharges = otherCharges.filter(charge => 
      !charge.name || (charge.cost && (isNaN(parseFloat(charge.cost)) || parseFloat(charge.cost) < 0))
    );
    if (invalidCharges.length) {
      setProductionError('Invalid other charges: ensure name is selected and cost is valid');
      return;
    }

    const totalOtherCost = otherCharges.reduce((sum, charge) => 
      sum + (charge.cost ? parseFloat(charge.cost) : 0), 0);
    const costPerItem = itemsToReceive.length > 0 ? totalOtherCost / itemsToReceive.length : 0;

    const inventoryItems: InventoryItem[] = itemsToReceive.map(item => {
      const totalItemCost = item.cost ? parseFloat(item.cost) : 0;
      const quantity = parseFloat(item.quantity);
      const unitCost = totalItemCost / quantity || 0;
      const finalTotalCost = (totalItemCost + costPerItem).toFixed(2);
      const finalUnitCost = (parseFloat(finalTotalCost) / quantity || 0).toFixed(2);
      return {
        identifier: item.materialType === MaterialType.Spirits ? item.identifier : (item.identifier || 'N/A'),
        account: item.materialType === MaterialType.Spirits ? singleForm.account : 'Stored',
        type: item.materialType,
        quantity: item.quantity,
        unit: item.unit,
        proof: item.proof,
        proofGallons: item.proof ? (parseFloat(item.quantity) * (parseFloat(item.proof) / 100)).toFixed(2) : undefined,
        receivedDate: singleForm.receivedDate,
        source: singleForm.source,
        dspNumber: item.materialType === MaterialType.Spirits ? singleForm.dspNumber : undefined,
        status: Status.Received,
        description: item.description,
        cost: finalUnitCost,
        totalCost: finalTotalCost,
        poNumber: item.poNumber,
      };
    });

    try {
      const res = await fetch(`${API_BASE_URL}/api/receive`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(useSingleItem ? inventoryItems[0] : inventoryItems),
      });
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
      setSuccessMessage('Items received successfully!');
      await refreshInventory();
      setTimeout(() => {
        setSuccessMessage(null);
        navigate('/inventory');
      }, 1000);
    } catch (err: any) {
      setProductionError('Failed to receive items: ' + err.message);
    }
  };

  return (
    <div style={{ padding: '20px', backgroundColor: '#2E4655', borderRadius: '8px', maxWidth: '800px', margin: '20px auto', maxHeight: '80vh', overflowY: 'auto' }}>
      <h2 style={{ color: '#EEC930', marginBottom: '20px', textAlign: 'center' }}>Receive Inventory</h2>
      <div style={{ backgroundColor: '#fff', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
        {productionError && <p style={{ color: '#F86752', marginBottom: '15px', textAlign: 'center' }}>{productionError}</p>}
        {successMessage && (
          <div style={{ color: '#4CAF50', textAlign: 'center', marginBottom: '15px' }}>
            <p>{successMessage}</p>
            <img src="/doggo-slurp.gif" alt="Dog slurping" style={{ width: '100px', height: '100px' }} />
          </div>
        )}
        <div style={{ marginBottom: '15px' }}>
          <label style={{ fontWeight: 'bold', color: '#555', marginRight: '10px' }}>Receive Mode:</label>
          <button
            onClick={() => { setUseSingleItem(true); setReceiveItems([]); }}
            style={{ backgroundColor: useSingleItem ? '#EEC930' : '#ddd', color: useSingleItem ? '#000' : '#555', padding: '5px 10px', border: 'none', borderRadius: '4px', marginRight: '10px' }}
          >
            Single Item
          </button>
          <button
            onClick={() => { setUseSingleItem(false); if (!receiveItems.length) addItemRow(); }}
            style={{ backgroundColor: !useSingleItem ? '#EEC930' : '#ddd', color: !useSingleItem ? '#000' : '#555', padding: '5px 10px', border: 'none', borderRadius: '4px' }}
          >
            Multiple Items
          </button>
        </div>
        <div style={{ position: 'relative', marginBottom: '15px' }}>
          <label style={{ fontWeight: 'bold', color: '#555', display: 'block', marginBottom: '5px' }}>Vendor:</label>
          <input
            type="text"
            value={singleForm.source}
            onChange={handleVendorInputChange}
            placeholder="Type to search vendors"
            onFocus={() => setShowVendorSuggestions(true)}
            onBlur={() => setTimeout(() => setShowVendorSuggestions(false), 300)}
            style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px', boxSizing: 'border-box' }}
          />
          {showVendorSuggestions && (
            <ul style={{ border: '1px solid #ddd', maxHeight: '150px', overflowY: 'auto', position: 'absolute', backgroundColor: '#fff', width: '100%', listStyle: 'none', padding: 0, margin: 0, zIndex: 1000, borderRadius: '4px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
              {filteredVendors.map((vendor) => (
                <li
                  key={vendor.name}
                  onMouseDown={(e) => { e.preventDefault(); handleVendorSelect(vendor); }}
                  style={{ padding: '8px 10px', cursor: 'pointer', backgroundColor: singleForm.source === vendor.name ? '#e0e0e0' : '#fff', borderBottom: '1px solid #eee' }}
                >
                  {vendor.name}
                </li>
              ))}
              {filteredVendors.length === 0 && singleForm.source && (
                <li style={{ padding: '8px 10px', borderBottom: '1px solid #eee' }}>
                  No matches found.{' '}
                  <button
                    type="button"
                    onClick={() => { setNewVendor({ ...newVendor, name: singleForm.source }); setShowNewVendorModal(true); setShowVendorSuggestions(false); }}
                    style={{ backgroundColor: '#F86752', color: 'white', border: 'none', borderRadius: '4px', padding: '5px 10px', cursor: 'pointer' }}
                  >
                    Add "{singleForm.source}"
                  </button>
                </li>
              )}
            </ul>
          )}
        </div>
        {singleForm.source && (
          <div style={{ marginBottom: '15px' }}>
            <label style={{ fontWeight: 'bold', color: '#555', display: 'block', marginBottom: '5px' }}>Open Purchase Orders:</label>
            {purchaseOrders.length > 0 ? (
              <ul style={{ listStyle: 'none', padding: 0, maxHeight: '150px', overflowY: 'auto', border: '1px solid #ddd', borderRadius: '4px', backgroundColor: '#fff' }}>
                {purchaseOrders.map(po => (
                  <li
                    key={po.poNumber}
                    onClick={() => handlePOSelect(po.poNumber)}
                    style={{
                      padding: '8px 10px',
                      cursor: 'pointer',
                      backgroundColor: selectedPO === po.poNumber ? '#e0e0e0' : '#fff',
                      borderBottom: '1px solid #eee',
                    }}
                  >
                    {po.poNumber} - {po.poDate} ({po.items.length} items)
                  </li>
                ))}
              </ul>
            ) : (
              <p style={{ color: '#555' }}>No open POs for {singleForm.source}</p>
            )}
          </div>
        )}
        {useSingleItem ? (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '15px' }}>
            <div style={{ position: 'relative' }}>
              <label style={{ fontWeight: 'bold', color: '#555', display: 'block', marginBottom: '5px' }}>Item:</label>
              <input
                type="text"
                value={singleForm.identifier}
                onChange={handleItemInputChange}
                onKeyDown={handleKeyDown}
                placeholder="Type to search items"
                onFocus={() => setShowItemSuggestions(true)}
                onBlur={() => setTimeout(() => setShowItemSuggestions(false), 300)}
                style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px', boxSizing: 'border-box' }}
              />
              {showItemSuggestions && (
                <ul style={{ border: '1px solid #ddd', maxHeight: '150px', overflowY: 'auto', position: 'absolute', backgroundColor: '#fff', width: '100%', listStyle: 'none', padding: 0, margin: 0, zIndex: 1000, borderRadius: '4px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
                  {filteredItems.length > 0 ? (
                    filteredItems.map((item) => (
                      <li
                        key={item.name}
                        onMouseDown={(e) => { e.preventDefault(); handleItemSelect(item); }}
                        style={{ padding: '8px 10px', cursor: 'pointer', backgroundColor: singleForm.identifier === item.name ? '#e0e0e0' : '#fff', borderBottom: '1px solid #eee' }}
                      >
                        {item.name}
                      </li>
                    ))
                  ) : (
                    singleForm.identifier && (
                      <li style={{ padding: '8px 10px', borderBottom: '1px solid #eee' }}>
                        No matches found.{' '}
                        <button
                          type="button"
                          onClick={() => { setNewItem(singleForm.identifier); setShowNewItemModal(true); setShowItemSuggestions(false); }}
                          style={{ backgroundColor: '#F86752', color: 'white', border: 'none', borderRadius: '4px', padding: '5px 10px', cursor: 'pointer' }}
                        >
                          Create "{singleForm.identifier}"
                        </button>
                      </li>
                    )
                  )}
                </ul>
              )}
            </div>
            <div>
              <label style={{ fontWeight: 'bold', color: '#555', display: 'block', marginBottom: '5px' }}>Material Type:</label>
              <select
                value={singleForm.materialType}
                onChange={(e) => setSingleForm({ ...singleForm, materialType: e.target.value as MaterialType })}
                style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px', boxSizing: 'border-box' }}
              >
                {Object.values(MaterialType).map((type) => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={{ fontWeight: 'bold', color: '#555', display: 'block', marginBottom: '5px' }}>Quantity:</label>
              <input
                type="number"
                value={singleForm.quantity}
                onChange={(e) => setSingleForm({ ...singleForm, quantity: e.target.value })}
                step="0.01"
                min="0"
                placeholder="Enter quantity"
                style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px', boxSizing: 'border-box' }}
              />
            </div>
            <div>
              <label style={{ fontWeight: 'bold', color: '#555', display: 'block', marginBottom: '5px' }}>Unit:</label>
              <select
                value={singleForm.unit}
                onChange={(e) => setSingleForm({ ...singleForm, unit: e.target.value as Unit })}
                style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px', boxSizing: 'border-box' }}
              >
                {Object.values(Unit).map((unit) => (
                  <option key={unit} value={unit}>{unit}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={{ fontWeight: 'bold', color: '#555', display: 'block', marginBottom: '5px' }}>Cost (USD):</label>
              <input
                type="number"
                value={singleForm.cost}
                onChange={(e) => setSingleForm({ ...singleForm, cost: e.target.value })}
                step="0.01"
                min="0"
                placeholder="Enter cost"
                style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px', boxSizing: 'border-box' }}
              />
            </div>
            {singleForm.materialType === MaterialType.Spirits && (
              <>
                <div>
                  <label style={{ fontWeight: 'bold', color: '#555', display: 'block', marginBottom: '5px' }}>Account:</label>
                  <select
                    value={singleForm.account}
                    onChange={(e) => setSingleForm({ ...singleForm, account: e.target.value })}
                    style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px', boxSizing: 'border-box' }}
                  >
                    <option value="Stored">Stored</option>
                    <option value="Processing">Processing</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontWeight: 'bold', color: '#555', display: 'block', marginBottom: '5px' }}>Proof:</label>
                  <input
                    type="number"
                    value={singleForm.proof}
                    onChange={(e) => setSingleForm({ ...singleForm, proof: e.target.value })}
                    step="0.01"
                    min="0"
                    max="200"
                    style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px', boxSizing: 'border-box' }}
                  />
                </div>
                <div>
                  <label style={{ fontWeight: 'bold', color: '#555', display: 'block', marginBottom: '5px' }}>DSP Number:</label>
                  <input
                    type="text"
                    value={singleForm.dspNumber}
                    onChange={(e) => setSingleForm({ ...singleForm, dspNumber: e.target.value })}
                    style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px', boxSizing: 'border-box' }}
                  />
                </div>
              </>
            )}
            {singleForm.materialType === MaterialType.Other && (
              <div>
                <label style={{ fontWeight: 'bold', color: '#555', display: 'block', marginBottom: '5px' }}>Description:</label>
                <input
                  type="text"
                  value={singleForm.description}
                  onChange={(e) => setSingleForm({ ...singleForm, description: e.target.value })}
                  style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px', boxSizing: 'border-box' }}
                />
              </div>
            )}
          </div>
        ) : (
          <div>
            <h3 style={{ color: '#555', marginBottom: '10px' }}>Inventory Items</h3>
            {receiveItems.map((item, index) => (
              <div key={`item-${index}`} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr 0.5fr', gap: '10px', marginBottom: '10px' }}>
                <div style={{ position: 'relative' }}>
                  <input
                    type="text"
                    value={item.identifier}
                    onChange={(e) => handleItemInputChange(e, index)}
                    onKeyDown={(e) => handleKeyDown(e, index)}
                    placeholder="Item"
                    onFocus={() => setShowItemSuggestions(true)}
                    onBlur={() => setTimeout(() => setShowItemSuggestions(false), 300)}
                    style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px', boxSizing: 'border-box' }}
                  />
                  {showItemSuggestions && index === receiveItems.length - 1 && (
                    <ul style={{ border: '1px solid #ddd', maxHeight: '150px', overflowY: 'auto', position: 'absolute', backgroundColor: '#fff', width: '100%', listStyle: 'none', padding: 0, margin: 0, zIndex: 1000, borderRadius: '4px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
                      {filteredItems.length > 0 ? (
                        filteredItems.map((i) => (
                          <li
                            key={i.name}
                            onMouseDown={(e) => { e.preventDefault(); handleItemSelect(i, index); }}
                            style={{ padding: '8px 10px', cursor: 'pointer', backgroundColor: item.identifier === i.name ? '#e0e0e0' : '#fff', borderBottom: '1px solid #eee' }}
                          >
                            {i.name}
                          </li>
                        ))
                      ) : (
                        item.identifier && (
                          <li style={{ padding: '8px 10px', borderBottom: '1px solid #eee' }}>
                            No matches.{' '}
                            <button
                              type="button"
                              onClick={() => { setNewItem(item.identifier); setShowNewItemModal(true); setShowItemSuggestions(false); }}
                              style={{ backgroundColor: '#F86752', color: 'white', border: 'none', borderRadius: '4px', padding: '5px 10px', cursor: 'pointer' }}
                            >
                              Create "{item.identifier}"
                            </button>
                          </li>
                        )
                      )}
                    </ul>
                  )}
                </div>
                <select
                  value={item.materialType}
                  onChange={(e) => {
                    const updatedItems = [...receiveItems];
                    updatedItems[index].materialType = e.target.value as MaterialType;
                    setReceiveItems(updatedItems);
                  }}
                  style={{ padding: '8px', border: '1px solid #ddd', borderRadius: '4px', boxSizing: 'border-box' }}
                >
                  {Object.values(MaterialType).map((type) => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
                <input
                  type="number"
                  value={item.quantity}
                  onChange={(e) => {
                    const updatedItems = [...receiveItems];
                    updatedItems[index].quantity = e.target.value;
                    setReceiveItems(updatedItems);
                  }}
                  step="0.01"
                  min="0"
                  placeholder="Qty"
                  style={{ padding: '8px', border: '1px solid #ddd', borderRadius: '4px', boxSizing: 'border-box' }}
                />
                <select
                  value={item.unit}
                  onChange={(e) => {
                    const updatedItems = [...receiveItems];
                    updatedItems[index].unit = e.target.value as Unit;
                    setReceiveItems(updatedItems);
                  }}
                  style={{ padding: '8px', border: '1px solid #ddd', borderRadius: '4px', boxSizing: 'border-box' }}
                >
                  {Object.values(Unit).map((unit) => (
                    <option key={unit} value={unit}>{unit}</option>
                  ))}
                </select>
                <input
                  type="number"
                  value={item.cost || ''}
                  onChange={(e) => {
                    const updatedItems = [...receiveItems];
                    updatedItems[index].cost = e.target.value;
                    setReceiveItems(updatedItems);
                  }}
                  step="0.01"
                  min="0"
                  placeholder="Cost"
                  style={{ padding: '8px', border: '1px solid #ddd', borderRadius: '4px', boxSizing: 'border-box' }}
                />
                <button
                  type="button"
                  onClick={() => removeItemRow(index)}
                  style={{ backgroundColor: '#F86752', color: 'white', border: 'none', borderRadius: '4px', padding: '8px', cursor: 'pointer' }}
                >
                  X
                </button>
                {item.materialType === MaterialType.Spirits && (
                  <input
                    type="number"
                    value={item.proof || ''}
                    onChange={(e) => {
                      const updatedItems = [...receiveItems];
                      updatedItems[index].proof = e.target.value;
                      setReceiveItems(updatedItems);
                    }}
                    step="0.01"
                    min="0"
                    max="200"
                    placeholder="Proof"
                    style={{ padding: '8px', border: '1px solid #ddd', borderRadius: '4px', boxSizing: 'border-box', gridColumn: 'span 6' }}
                  />
                )}
                {item.materialType === MaterialType.Other && (
                  <input
                    type="text"
                    value={item.description || ''}
                    onChange={(e) => {
                      const updatedItems = [...receiveItems];
                      updatedItems[index].description = e.target.value;
                      setReceiveItems(updatedItems);
                    }}
                    placeholder="Description"
                    style={{ padding: '8px', border: '1px solid #ddd', borderRadius: '4px', boxSizing: 'border-box', gridColumn: 'span 6' }}
                  />
                )}
              </div>
            ))}
            <button
              type="button"
              onClick={addItemRow}
              style={{ backgroundColor: '#F86752', color: 'white', padding: '10px 20px', border: 'none', borderRadius: '4px', cursor: 'pointer', marginTop: '10px' }}
            >
              Add Item
            </button>
            <h3 style={{ color: '#555', marginTop: '20px', marginBottom: '10px' }}>Other Charges</h3>
            {otherCharges.map((charge, index) => (
              <div key={`charge-${index}`} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 0.5fr', gap: '10px', marginBottom: '10px' }}>
                <select
                  value={charge.name}
                  onChange={(e) => {
                    const updatedCharges = [...otherCharges];
                    updatedCharges[index].name = e.target.value;
                    setOtherCharges(updatedCharges);
                  }}
                  style={{ padding: '8px', border: '1px solid #ddd', borderRadius: '4px', boxSizing: 'border-box' }}
                >
                  <option value="">Select Charge</option>
                  {OTHER_CHARGES_OPTIONS.map(option => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
                <input
                  type="number"
                  value={charge.cost}
                  onChange={(e) => {
                    const updatedCharges = [...otherCharges];
                    updatedCharges[index].cost = e.target.value;
                    setOtherCharges(updatedCharges);
                  }}
                  step="0.01"
                  min="0"
                  placeholder="Cost"
                  style={{ padding: '8px', border: '1px solid #ddd', borderRadius: '4px', boxSizing: 'border-box' }}
                />
                <button
                  type="button"
                  onClick={() => removeChargeRow(index)}
                  style={{ backgroundColor: '#F86752', color: 'white', border: 'none', borderRadius: '4px', padding: '8px', cursor: 'pointer' }}
                >
                  X
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={addChargeRow}
              style={{ backgroundColor: '#F86752', color: 'white', padding: '10px 20px', border: 'none', borderRadius: '4px', cursor: 'pointer', marginTop: '10px' }}
            >
              Add Charge
            </button>
          </div>
        )}
        {showLotModal && poItemToSplit && (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 2000 }}>
            <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '8px', width: '500px' }}>
              <h3>Split Spirits into Lots</h3>
              <p>Split {poItemToSplit.name} ({poItemToSplit.quantity} gallons) into individual lots:</p>
              {lotItems.map((lot, index) => (
                <div key={`lot-${index}`} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 0.5fr', gap: '10px', marginBottom: '10px' }}>
                  <input
                    type="text"
                    placeholder="Lot Number"
                    value={lot.identifier || ''}
                    onChange={(e) => {
                      const updatedLots = [...lotItems];
                      updatedLots[index].identifier = e.target.value;
                      setLotItems(updatedLots);
                    }}
                    style={{ padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
                  />
                  <input
                    type="number"
                    placeholder="Quantity (gallons)"
                    value={lot.quantity || ''}
                    onChange={(e) => {
                      const updatedLots = [...lotItems];
                      updatedLots[index].quantity = e.target.value;
                      setLotItems(updatedLots);
                    }}
                    step="0.01"
                    min="0"
                    style={{ padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
                  />
                  <button
                    type="button"
                    onClick={() => setLotItems(lotItems.filter((_, i) => i !== index))}
                    style={{ backgroundColor: '#F86752', color: 'white', border: 'none', borderRadius: '4px', padding: '8px', cursor: 'pointer' }}
                  >
                    X
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() => setLotItems([...lotItems, { identifier: '', quantity: '', materialType: MaterialType.Spirits, unit: Unit.Gallons }])}
                style={{ backgroundColor: '#F86752', color: 'white', padding: '10px 20px', border: 'none', borderRadius: '4px', cursor: 'pointer', marginTop: '10px' }}
              >
                Add Lot
              </button>
              <div style={{ marginTop: '15px' }}>
                <button
                  type="button"
                  onClick={handleLotSplit}
                  style={{ backgroundColor: '#EEC930', color: '#000', padding: '10px 20px', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                >
                  Submit
                </button>
                <button
                  type="button"
                  onClick={() => { setShowLotModal(false); setLotItems([]); setPoItemToSplit(null); }}
                  style={{ backgroundColor: '#F86752', color: 'white', padding: '10px 20px', border: 'none', borderRadius: '4px', cursor: 'pointer', marginLeft: '10px' }}
                >
                  Cancel
                </button>
              </div>
              {productionError && <p style={{ color: '#F86752', marginTop: '10px' }}>{productionError}</p>}
            </div>
          </div>
        )}
        {showNewVendorModal && (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 2000 }}>
            <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '8px', width: '400px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
              <h3 style={{ color: '#2E4655', marginBottom: '15px' }}>Add New Vendor</h3>
              <label style={{ display: 'block', marginBottom: '10px' }}>
                Vendor Name:
                <input
                  type="text"
                  value={newVendor.name}
                  onChange={(e) => setNewVendor({ ...newVendor, name: e.target.value })}
                  placeholder="Enter vendor name"
                  style={{ width: '100%', padding: '8px', marginTop: '5px', border: '1px solid #ddd', borderRadius: '4px' }}
                />
              </label>
              <label style={{ display: 'block', marginBottom: '10px' }}>
                Contact (optional):
                <input
                  type="text"
                  value={newVendor.contact || ''}
                  onChange={(e) => setNewVendor({ ...newVendor, contact: e.target.value })}
                  placeholder="Enter contact info"
                  style={{ width: '100%', padding: '8px', marginTop: '5px', border: '1px solid #ddd', borderRadius: '4px' }}
                />
              </label>
              <label style={{ display: 'block', marginBottom: '10px' }}>
                Address (optional):
                <input
                  type="text"
                  value={newVendor.address || ''}
                  onChange={(e) => setNewVendor({ ...newVendor, address: e.target.value })}
                  placeholder="Enter address"
                  style={{ width: '100%', padding: '8px', marginTop: '5px', border: '1px solid #ddd', borderRadius: '4px' }}
                />
              </label>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <button
                  type="button"
                  onClick={handleCreateVendor}
                  style={{ backgroundColor: '#EEC930', color: '#000', padding: '10px 20px', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                >
                  Add Vendor
                </button>
                <button
                  type="button"
                  onClick={() => { setShowNewVendorModal(false); setNewVendor({ name: '', enabled: 1, contact: '', address: '' }); }}
                  style={{ backgroundColor: '#F86752', color: 'white', padding: '10px 20px', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                >
                  Cancel
                </button>
              </div>
              {productionError && <p style={{ color: '#F86752', marginTop: '10px' }}>{productionError}</p>}
            </div>
          </div>
        )}
        <div>
          <label style={{ fontWeight: 'bold', color: '#555', display: 'block', marginBottom: '5px', marginTop: '15px' }}>Received Date:</label>
          <input
            type="date"
            value={singleForm.receivedDate}
            onChange={(e) => setSingleForm({ ...singleForm, receivedDate: e.target.value })}
            style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px', boxSizing: 'border-box' }}
          />
        </div>
        {showNewItemModal && (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 2000 }}>
            <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '8px', width: '400px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
              <h3 style={{ color: '#2E4655', marginBottom: '15px' }}>Create New Item</h3>
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
                  onChange={(e) => setNewItemType(e.target.value as MaterialType)}
                  style={{ width: '100%', padding: '8px', marginTop: '5px', border: '1px solid #ddd', borderRadius: '4px' }}
                >
                  {Object.values(MaterialType).map((type) => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              </label>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <button
                  type="button"
                  onClick={handleCreateItem}
                  style={{ backgroundColor: '#EEC930', color: '#000', padding: '10px 20px', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                >
                  Create
                </button>
                <button
                  type="button"
                  onClick={() => { setShowNewItemModal(false); setNewItem(''); setNewItemType(MaterialType.Grain); }}
                  style={{ backgroundColor: '#F86752', color: 'white', padding: '10px 20px', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '15px' }}>
          <button
            type="button"
            onClick={handleReceive}
            style={{ backgroundColor: '#EEC930', color: '#000', padding: '10px 20px', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '16px' }}
          >
            Receive
          </button>
          <button
            type="button"
            onClick={() => navigate('/inventory')}
            style={{ backgroundColor: '#F86752', color: 'white', padding: '10px 20px', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '16px' }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

export default ReceivePage;