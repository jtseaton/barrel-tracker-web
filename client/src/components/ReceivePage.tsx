import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { PurchaseOrder, ReceiveItem, ReceivableItem, InventoryItem, Status, Vendor, ReceiveForm, PurchaseOrderItem } from '../types/interfaces';
import { MaterialType, Unit, Account } from '../types/enums';
import { Site, Location } from '../types/interfaces';

interface ReceivePageProps {
  refreshInventory: () => Promise<void>;
  vendors: Vendor[];
  refreshVendors: () => Promise<void>;
}

interface Item {
  name: string;
  type: string;
  enabled: number;
}

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:3001';

const ReceivePage: React.FC<ReceivePageProps> = ({ refreshInventory, vendors, refreshVendors }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const locationState = location.state as { newSiteId?: string; newLocationId?: string };
  const [singleForm, setSingleForm] = useState<ReceiveForm>({
    identifier: '',
    item: '',
    lotNumber: '',
    account: Account.Storage,
    materialType: MaterialType.Grain,
    quantity: '',
    unit: Unit.Pounds,
    proof: '',
    source: location.state?.vendor || '',
    dspNumber: '',
    receivedDate: new Date().toISOString().split('T')[0],
    description: '',
    cost: '',
    poNumber: '',
    siteId: 'DSP-AL-20010',
    locationId: '',
  });
  const [receiveItems, setReceiveItems] = useState<ReceiveItem[]>([]);
  const [useSingleItem, setUseSingleItem] = useState(true);
  const [items, setItems] = useState<Item[]>([]);
  const [filteredItems, setFilteredItems] = useState<Item[]>([]);
  const [showItemSuggestions, setShowItemSuggestions] = useState(false);
  const [selectedSite, setSelectedSite] = useState<string>('DSP-AL-20010');
  const [sites, setSites] = useState<Site[]>([]);
  const [filteredSites, setFilteredSites] = useState<Site[]>([]);
  const [showSiteSuggestions, setShowSiteSuggestions] = useState(false);
  const [locations, setLocations] = useState<Location[]>([]);
  const [filteredLocations, setFilteredLocations] = useState<Location[]>([]);
  const [filteredVendors, setFilteredVendors] = useState<Vendor[]>(vendors);
  const [showVendorSuggestions, setShowVendorSuggestions] = useState(false);
  const [showLocationSuggestions, setShowLocationSuggestions] = useState(false);
  const [productionError, setProductionError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [selectedPO, setSelectedPO] = useState<string | null>(null);
  const [poItemToSplit, setPoItemToSplit] = useState<PurchaseOrderItem | null>(null);
  const [lotItems, setLotItems] = useState<ReceiveItem[]>([]);
  const [newItem, setNewItem] = useState('');
  const [newItemType, setNewItemType] = useState<MaterialType>(MaterialType.Grain);
  const [showNewItemModal, setShowNewItemModal] = useState(false);
  const [otherCharges, setOtherCharges] = useState<{ description: string; cost: string }[]>([]);
  const [isFetchingLocations, setIsFetchingLocations] = useState(false);

  // Memoized fetchLocations with retry logic
  const fetchLocations = useCallback(async (siteId: string, retryCount = 3, delay = 1000): Promise<void> => {
    if (!siteId) {
      setLocations([]);
      setFilteredLocations([]);
      setIsFetchingLocations(false);
      return;
    }
    setIsFetchingLocations(true);
    try {
      const url = `${API_BASE_URL}/api/locations?siteId=${encodeURIComponent(siteId)}`;
      console.log('Fetching locations from:', url);
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(`HTTP error! status: ${res.status}, message: ${errorData.error || 'Unknown error'}`);
      }
      const data: Location[] = await res.json();
      console.log('Fetched locations:', data);
      setLocations(data);
      setFilteredLocations(data);
      setProductionError(null);
    } catch (err: any) {
      console.error('Fetch locations error:', err);
      if (retryCount > 0 && err.name !== 'AbortError') {
        console.log(`Retrying fetchLocations, attempts left: ${retryCount}`);
        await new Promise(resolve => setTimeout(resolve, delay));
        return fetchLocations(siteId, retryCount - 1, delay * 2);
      }
      setProductionError(`Failed to fetch locations: ${err.message}`);
      setLocations([]);
      setFilteredLocations([]);
    } finally {
      setIsFetchingLocations(false);
    }
  }, []);

  useEffect(() => {
    if (locationState?.newSiteId) {
      setSelectedSite(locationState.newSiteId);
    }
    if (locationState?.newLocationId) {
      setSingleForm((prev) => ({ ...prev, locationId: locationState.newLocationId }));
    }

    const fetchItems = async () => {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);
        const res = await fetch(`${API_BASE_URL}/api/items`, { signal: controller.signal });
        clearTimeout(timeoutId);
        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
        const data = await res.json();
        setItems(data);
        setFilteredItems(data);
      } catch (err: any) {
        setProductionError('Failed to fetch items: ' + err.message);
      }
    };

    const fetchPOs = async () => {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);
        const res = await fetch(
          `${API_BASE_URL}/api/purchase-orders?supplier=${encodeURIComponent(singleForm.source || '')}`,
          { signal: controller.signal }
        );
        clearTimeout(timeoutId);
        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
        const data = await res.json();
        setPurchaseOrders(data);
      } catch (err: any) {
        setProductionError('Failed to fetch POs: ' + err.message);
      }
    };

    const fetchSites = async () => {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);
        const res = await fetch(`${API_BASE_URL}/api/sites`, { signal: controller.signal });
        clearTimeout(timeoutId);
        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
        const data = await res.json();
        setSites(data);
        setFilteredSites(data);
      } catch (err: any) {
        setProductionError('Failed to fetch sites: ' + err.message);
      }
    };

    fetchSites();
    fetchItems();
    if (singleForm.source) fetchPOs();
    setFilteredVendors(vendors);
  }, [locationState, singleForm.source, vendors]);

  // Fetch locations when selectedSite changes
  useEffect(() => {
    fetchLocations(selectedSite);
  }, [selectedSite, fetchLocations]);

  const handleVendorInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSingleForm((prev: ReceiveForm) => ({ ...prev, source: value }));
    setFilteredVendors(vendors.filter(v => v.name.toLowerCase().includes(value.toLowerCase())));
    setShowVendorSuggestions(true);
  };

  const handleVendorSelect = (vendor: Vendor) => {
    setSingleForm((prev: ReceiveForm) => ({ ...prev, source: vendor.name }));
    setShowVendorSuggestions(false);
  };

  const handleItemSelect = (item: Item, index?: number) => {
    const normalizedType = item.type ? item.type.charAt(0).toUpperCase() + item.type.slice(1).toLowerCase() : 'Other';
    const materialType = Object.values(MaterialType).includes(normalizedType as MaterialType) ? normalizedType as MaterialType : MaterialType.Other;
    if (useSingleItem) {
      setSingleForm((prev: ReceiveForm) => ({ ...prev, item: item.name, materialType }));
    } else if (index !== undefined) {
      const updatedItems = [...receiveItems];
      updatedItems[index] = { 
        ...updatedItems[index], 
        item: item.name,
        materialType,
        siteId: selectedSite,
        locationId: singleForm.locationId || updatedItems[index].locationId,
      };
      setReceiveItems(updatedItems);
    }
    setShowItemSuggestions(false);
  };

  const handleLocationSelect = (location: Location) => {
    setSingleForm((prev: ReceiveForm) => ({ ...prev, locationId: location.locationId.toString() }));
    setShowLocationSuggestions(false);
  };

  const handleAddNewLocation = () => {
    navigate('/locations', {
      state: { fromReceive: true, siteId: selectedSite },
    });
    setShowLocationSuggestions(false);
  };

  const handlePOSelect = (poNumber: string) => {
    const po = purchaseOrders.find((p) => p.poNumber === poNumber);
    if (!po) {
      setProductionError('Selected PO not found');
      return;
    }
    if (!po.items || po.items.length === 0) {
      setProductionError('Selected PO has no items');
      return;
    }
    setSelectedPO(poNumber);
    const nonSpiritsItems = po.items
      .filter((item) => item.materialType !== MaterialType.Spirits)
      .map((item) => ({
        identifier: item.name || 'UNKNOWN_ITEM',
        item: item.name,
        lotNumber: '',
        materialType: item.materialType,
        quantity: item.quantity.toString(),
        unit: Unit.Pounds,
        cost: '',
        poNumber,
        siteId: selectedSite,
        locationId: singleForm.locationId || (locations.length > 0 ? locations[0].locationId.toString() : '1'),
        description: '',
      }));
    const spiritsItems = po.items.filter((item) => item.materialType === MaterialType.Spirits);
    if (spiritsItems.length > 0) {
      setPoItemToSplit(spiritsItems[0]);
    } else {
      setPoItemToSplit(null);
    }
    setReceiveItems(nonSpiritsItems);
    setSingleForm((prev: ReceiveForm) => ({ ...prev, poNumber }));
  };

  const handleLotSplit = () => {
    if (!poItemToSplit) return;
    const totalGallons = lotItems.reduce((sum, item) => sum + parseFloat(item.quantity || '0'), 0);
    const poQuantity = parseFloat(poItemToSplit.quantity.toString());
    if (Math.abs(totalGallons - poQuantity) > 0.01) {
      setProductionError(`Total gallons (${totalGallons.toFixed(2)}) must match PO quantity (${poQuantity.toFixed(2)})`);
      return;
    }
    setReceiveItems((prev) => [
      ...prev,
      ...lotItems.map((item) => ({
        ...item,
        materialType: MaterialType.Spirits,
        unit: Unit.Gallons,
        poNumber: selectedPO || undefined,
        siteId: selectedSite,
        locationId: singleForm.locationId || (locations.length > 0 ? locations[0].locationId.toString() : '1'),
        description: item.description || '',
      })),
    ]);
    setPoItemToSplit(null);
    setLotItems([]);
    setProductionError(null);
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
        setSingleForm((prev: ReceiveForm) => ({ ...prev, item: newItem, materialType: newItemType }));
      } else {
        setReceiveItems([...receiveItems, { 
          identifier: 'Unknown',
          item: newItem,
          lotNumber: '',
          materialType: newItemType,
          quantity: '',
          unit: Unit.Pounds,
          siteId: selectedSite,
          locationId: singleForm.locationId || '',
        }]);
      }
      setNewItem('');
      setNewItemType(MaterialType.Grain);
      setShowNewItemModal(false);
      setProductionError(null);
    } catch (err: any) {
      setProductionError('Failed to create item: ' + err.message);
    }
  };

  const addItemRow = () => {
    setReceiveItems([
      ...receiveItems,
      {
        identifier: '',
        item: '',
        lotNumber: '',
        materialType: MaterialType.Grain,
        quantity: '',
        unit: Unit.Pounds,
        cost: '',
        description: '',
        siteId: selectedSite,
        locationId: singleForm.locationId || (locations.length > 0 ? locations[0].locationId.toString() : '1'),
      },
    ]);
  };

  const handleReceive = async () => {
    const itemsToReceive: ReceivableItem[] = useSingleItem ? [singleForm] : receiveItems;
    if (
      !itemsToReceive.length ||
      itemsToReceive.some(
        (item) =>
          !item.item ||
          !item.materialType ||
          !item.quantity ||
          !item.unit ||
          !item.siteId ||
          !item.locationId ||
          item.locationId.trim() === ''
      )
    ) {
      setProductionError('All inventory items must have Item, Material Type, Quantity, Unit, Site, and Location');
      return;
    }
    const invalidItems = itemsToReceive.filter(
      (item) =>
        (item.materialType === MaterialType.Spirits &&
          (!item.lotNumber || !item.lotNumber.trim() || !item.proof || item.proof.trim() === '')) ||
        (item.materialType === MaterialType.Other && (!item.description || !item.description.trim())) ||
        isNaN(parseFloat(item.quantity)) ||
        parseFloat(item.quantity) <= 0 ||
        (item.proof && (isNaN(parseFloat(item.proof)) || parseFloat(item.proof) > 200 || parseFloat(item.proof) < 0)) ||
        (item.cost && (isNaN(parseFloat(item.cost)) || parseFloat(item.cost) < 0))
    );
    if (invalidItems.length) {
      setProductionError(
        'Invalid data: Spirits need lot number and proof, Other needs description, and numeric values must be valid'
      );
      return;
    }
    const totalOtherCost = otherCharges.reduce((sum, charge) => sum + (charge.cost ? parseFloat(charge.cost) : 0), 0);
    const costPerItem = itemsToReceive.length > 0 ? totalOtherCost / itemsToReceive.length : 0;
  
    const inventoryItems: InventoryItem[] = itemsToReceive.map((item) => {
      const totalItemCost = item.cost ? parseFloat(item.cost) : 0;
      const quantity = parseFloat(item.quantity);
      const unitCost = totalItemCost / quantity || 0;
      const finalTotalCost = (totalItemCost + costPerItem).toFixed(2);
      const finalUnitCost = (parseFloat(finalTotalCost) / quantity || 0).toFixed(2);
      const identifier =
        item.materialType === MaterialType.Spirits ? item.lotNumber || 'UNKNOWN_LOT' : item.item || 'UNKNOWN_ITEM';
      const locationId = item.locationId && item.locationId.trim() !== '' ? parseInt(item.locationId, 10) : 1;
      return {
        identifier,
        item: item.item,
        lotNumber: item.lotNumber || '',
        account: item.materialType === MaterialType.Spirits ? singleForm.account : Account.Storage,
        type: item.materialType,
        quantity: item.quantity,
        unit: item.unit,
        proof: item.proof || (item.materialType === MaterialType.Spirits ? '0' : undefined),
        proofGallons: item.proof ? (parseFloat(item.quantity) * (parseFloat(item.proof) / 100)).toFixed(2) : undefined,
        receivedDate: singleForm.receivedDate,
        source: singleForm.source || 'Unknown',
        siteId: singleForm.siteId,
        locationId,
        status: Status.Received,
        description: item.description || (item.materialType === MaterialType.Other ? 'N/A' : undefined),
        cost: finalUnitCost,
        totalCost: finalTotalCost,
        poNumber: item.poNumber,
      };
    });
  
    console.log('Payload to /api/receive:', JSON.stringify(useSingleItem ? inventoryItems[0] : inventoryItems, null, 2));
  
    try {
      const res = await fetch(`${API_BASE_URL}/api/receive`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(useSingleItem ? inventoryItems[0] : inventoryItems),
      });
      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`HTTP error! status: ${res.status}, body: ${errorText}`);
      }
      setSuccessMessage('Items received successfully!');
      await refreshInventory();
      setTimeout(() => {
        setSuccessMessage(null);
        navigate('/inventory');
      }, 1000);
    } catch (err: any) {
      setProductionError('Failed to receive items: ' + err.message);
      console.error('Receive error:', err);
    }
  };

  return (
    <div style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto', height: 'calc(100vh - 40px)', overflowY: 'auto' }}>
      <div style={{ backgroundColor: '#fff', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)', padding: '20px', marginBottom: '20px' }}>
        <h1 style={{ color: '#EEC930', fontSize: '24px', marginBottom: '20px', textAlign: 'center' }}>Receive Inventory</h1>
        {productionError && <div style={{ color: '#F86752', backgroundColor: '#ffe6e6', padding: '10px', borderRadius: '4px', marginBottom: '10px', textAlign: 'center' }}>{productionError}</div>}
        {successMessage && <div style={{ color: '#28A745', backgroundColor: '#e6ffe6', padding: '10px', borderRadius: '4px', marginBottom: '10px', textAlign: 'center' }}>{successMessage}</div>}

        <div style={{ display: 'flex', justifyContent: 'center', gap: '10px', marginBottom: '20px' }}>
          <button
            onClick={() => setUseSingleItem(true)}
            style={{
              backgroundColor: useSingleItem ? '#2196F3' : '#ddd',
              color: useSingleItem ? '#fff' : '#555',
              padding: '10px 20px',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '16px',
              transition: 'background-color 0.3s',
            }}
            onMouseOver={(e) => (e.currentTarget.style.backgroundColor = useSingleItem ? '#1976D2' : '#ccc')}
            onMouseOut={(e) => (e.currentTarget.style.backgroundColor = useSingleItem ? '#2196F3' : '#ddd')}
          >
            Single Item
          </button>
          <button
            onClick={() => setUseSingleItem(false)}
            style={{
              backgroundColor: !useSingleItem ? '#2196F3' : '#ddd',
              color: !useSingleItem ? '#fff' : '#555',
              padding: '10px 20px',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '16px',
              transition: 'background-color 0.3s',
            }}
            onMouseOver={(e) => (e.currentTarget.style.backgroundColor = !useSingleItem ? '#1976D2' : '#ccc')}
            onMouseOut={(e) => (e.currentTarget.style.backgroundColor = !useSingleItem ? '#2196F3' : '#ddd')}
          >
            Multiple Items
          </button>
        </div>

        {useSingleItem ? (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
            {/* Site Selector */}
            <div style={{ position: 'relative' }}>
              <label style={{ fontWeight: 'bold', color: '#555', display: 'block', marginBottom: '5px' }}>
                Site (required):
              </label>
              <input
                type="text"
                value={sites.find((s) => s.siteId === selectedSite)?.name || ''}
                onChange={(e) => {
                  const value = e.target.value;
                  setFilteredSites(
                    sites.filter((s) => s.name.toLowerCase().includes(value.toLowerCase()))
                  );
                  setShowSiteSuggestions(true);
                  if (!sites.find((s) => s.name.toLowerCase() === value.toLowerCase())) {
                    setSelectedSite('');
                    setSingleForm((prev) => ({ ...prev, locationId: '' }));
                    setFilteredLocations([]);
                  }
                }}
                onFocus={() => setShowSiteSuggestions(true)}
                onBlur={() => setTimeout(() => setShowSiteSuggestions(false), 300)}
                placeholder="Type to search sites"
                style={{
                  width: '100%',
                  padding: '10px',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  boxSizing: 'border-box',
                  fontSize: '16px',
                }}
              />
              {showSiteSuggestions && (
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
                  {filteredSites.map((site) => (
                    <li
                      key={site.siteId}
                      onMouseDown={() => {
                        setSelectedSite(site.siteId);
                        setShowSiteSuggestions(false);
                      }}
                      style={{
                        padding: '8px 10px',
                        cursor: 'pointer',
                        backgroundColor:
                          selectedSite === site.siteId ? '#e0e0e0' : '#fff',
                        borderBottom: '1px solid #eee',
                      }}
                    >
                      {site.name}
                    </li>
                  ))}
                  <li
                    onMouseDown={() => {
                      navigate('/sites', { state: { fromReceive: true } });
                      setShowSiteSuggestions(false);
                    }}
                    style={{
                      padding: '8px 10px',
                      cursor: 'pointer',
                      backgroundColor: '#fff',
                      borderBottom: '1px solid #eee',
                      color: '#2196F3',
                      fontWeight: 'bold',
                    }}
                  >
                    Add New Site
                  </li>
                </ul>
              )}
            </div>
            {/* Physical Location Selector */}
            <div style={{ position: 'relative' }}>
              <label
                style={{
                  fontWeight: 'bold',
                  color: '#555',
                  display: 'block',
                  marginBottom: '5px',
                }}
              >
                Physical Location (required):
              </label>
              <input
                type="text"
                value={
                  singleForm.locationId
                    ? locations.find((loc) => loc.locationId.toString() === singleForm.locationId)?.name || ''
                    : ''
                }
                onChange={(e) => {
                  const value = e.target.value;
                  setSingleForm((prev: ReceiveForm) => ({ ...prev, locationId: '' }));
                  setFilteredLocations(
                    locations.filter((loc) =>
                      loc.name.toLowerCase().includes(value.toLowerCase())
                    )
                  );
                  setShowLocationSuggestions(true);
                }}
                onFocus={() => {
                  if (!isFetchingLocations && locations.length > 0) {
                    setShowLocationSuggestions(true);
                    setFilteredLocations(locations);
                  }
                }}
                onBlur={() => {
                  setTimeout(() => {
                    setShowLocationSuggestions(false);
                  }, 300);
                }}
                placeholder={isFetchingLocations ? 'Loading locations...' : 'Type to search locations'}
                disabled={isFetchingLocations || !selectedSite}
                style={{
                  width: '100%',
                  padding: '10px',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  boxSizing: 'border-box',
                  fontSize: '16px',
                  backgroundColor: isFetchingLocations || !selectedSite ? '#f5f5f5' : '#fff',
                }}
              />
              {showLocationSuggestions && !isFetchingLocations && (
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
                  {filteredLocations.length > 0 ? (
                    filteredLocations.map((location) => (
                      <li
                        key={location.locationId}
                        onMouseDown={() => handleLocationSelect(location)}
                        style={{
                          padding: '8px 10px',
                          cursor: 'pointer',
                          backgroundColor:
                            singleForm.locationId === location.locationId.toString()
                              ? '#e0e0e0'
                              : '#fff',
                          borderBottom: '1px solid #eee',
                        }}
                      >
                        {location.name}
                      </li>
                    ))
                  ) : (
                    <li
                      style={{
                        padding: '8px 10px',
                        color: '#888',
                        borderBottom: '1px solid #eee',
                      }}
                    >
                      No locations found
                    </li>
                  )}
                  <li
                    onMouseDown={() => handleAddNewLocation()}
                    style={{
                      padding: '8px 10px',
                      cursor: 'pointer',
                      backgroundColor: '#fff',
                      borderBottom: '1px solid #eee',
                      color: '#2196F3',
                      fontWeight: 'bold',
                    }}
                  >
                    Add New Location
                  </li>
                </ul>
              )}
            </div>
            {/* Vendor Selector */}
            <div style={{ position: 'relative' }}>
              <label style={{ fontWeight: 'bold', color: '#555', display: 'block', marginBottom: '5px' }}>Vendor:</label>
              <input
                type="text"
                value={singleForm.source}
                onChange={handleVendorInputChange}
                placeholder="Type to search vendors"
                onFocus={() => setShowVendorSuggestions(true)}
                onBlur={() => setTimeout(() => setShowVendorSuggestions(false), 300)}
                style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '4px', boxSizing: 'border-box', fontSize: '16px' }}
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
                  <li
                    onMouseDown={(e) => { e.preventDefault(); navigate('/vendors/new', { state: { fromReceive: true } }); setShowVendorSuggestions(false); }}
                    style={{ padding: '8px 10px', cursor: 'pointer', backgroundColor: '#fff', borderBottom: '1px solid #eee', color: '#2196F3', fontWeight: 'bold' }}
                  >
                    Add New Vendor
                  </li>
                </ul>
              )}
            </div>
            {/* Item */}
            <div style={{ position: 'relative' }}>
              <label style={{ fontWeight: 'bold', color: '#555', display: 'block', marginBottom: '5px' }}>Item:</label>
              <input
                type="text"
                value={singleForm.item}
                onChange={(e) => {
                  setSingleForm((prev: ReceiveForm) => ({ ...prev, item: e.target.value }));
                  setFilteredItems(items.filter(i => i.name.toLowerCase().includes(e.target.value.toLowerCase())));
                  setShowItemSuggestions(true);
                }}
                onFocus={() => setShowItemSuggestions(true)}
                onBlur={() => setTimeout(() => setShowItemSuggestions(false), 300)}
                style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '4px', boxSizing: 'border-box', fontSize: '16px' }}
              />
              {showItemSuggestions && (
                <ul style={{ border: '1px solid #ddd', maxHeight: '150px', overflowY: 'auto', position: 'absolute', backgroundColor: '#fff', width: '100%', listStyle: 'none', padding: 0, margin: 0, zIndex: 1000, borderRadius: '4px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
                  {filteredItems.map(item => (
                    <li
                      key={item.name}
                      onMouseDown={() => handleItemSelect(item)}
                      style={{ padding: '8px 10px', cursor: 'pointer', backgroundColor: singleForm.item === item.name ? '#e0e0e0' : '#fff', borderBottom: '1px solid #eee' }}
                    >
                      {item.name}
                    </li>
                  ))}
                  <li
                    onMouseDown={() => setShowNewItemModal(true)}
                    style={{ padding: '8px 10px', cursor: 'pointer', backgroundColor: '#fff', borderBottom: '1px solid #eee', color: '#2196F3', fontWeight: 'bold' }}
                  >
                    Add New Item
                  </li>
                </ul>
              )}
            </div>
            {/* Lot Number */}
            <div>
              <label style={{ fontWeight: 'bold', color: '#555', display: 'block', marginBottom: '5px' }}>Lot Number:</label>
              <input
                type="text"
                value={singleForm.lotNumber}
                onChange={(e) => setSingleForm((prev: ReceiveForm) => ({ ...prev, lotNumber: e.target.value }))}
                style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '4px', boxSizing: 'border-box', fontSize: '16px' }}
              />
            </div>
            {/* Material Type */}
            <div>
              <label style={{ fontWeight: 'bold', color: '#555', display: 'block', marginBottom: '5px' }}>Material Type:</label>
              <select
                value={singleForm.materialType}
                onChange={(e) => setSingleForm((prev: ReceiveForm) => ({ ...prev, materialType: e.target.value as MaterialType }))}
                style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '4px', boxSizing: 'border-box', fontSize: '16px' }}
              >
                {Object.values(MaterialType).map(type => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
            </div>
            {/* Quantity */}
            <div>
              <label style={{ fontWeight: 'bold', color: '#555', display: 'block', marginBottom: '5px' }}>Quantity:</label>
              <input
                type="number"
                value={singleForm.quantity}
                onChange={(e) => setSingleForm((prev: ReceiveForm) => ({ ...prev, quantity: e.target.value }))}
                step="0.01"
                min="0"
                style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '4px', boxSizing: 'border-box', fontSize: '16px' }}
              />
            </div>
            {/* Unit */}
            <div>
              <label style={{ fontWeight: 'bold', color: '#555', display: 'block', marginBottom: '5px' }}>Unit:</label>
              <select
                value={singleForm.unit}
                onChange={(e) => setSingleForm((prev: ReceiveForm) => ({ ...prev, unit: e.target.value as Unit }))}
                style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '4px', boxSizing: 'border-box', fontSize: '16px' }}
              >
                {Object.values(Unit).map(unit => (
                  <option key={unit} value={unit}>{unit}</option>
                ))}
              </select>
            </div>
            {/* Spirits-specific fields */}
            {singleForm.materialType === MaterialType.Spirits && (
              <>
                <div>
                  <label style={{ fontWeight: 'bold', color: '#555', display: 'block', marginBottom: '5px' }}>Account:</label>
                  <select
                    value={singleForm.account}
                    onChange={(e) => setSingleForm((prev: ReceiveForm) => ({ ...prev, account: e.target.value as Account }))}
                    style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '4px', boxSizing: 'border-box', fontSize: '16px' }}
                  >
                    <option value={Account.Storage}>Storage</option>
                    <option value={Account.Processing}>Processing</option>
                    <option value={Account.Production}>Production</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontWeight: 'bold', color: '#555', display: 'block', marginBottom: '5px' }}>Proof:</label>
                  <input
                    type="number"
                    value={singleForm.proof || ''}
                    onChange={(e) => setSingleForm((prev: ReceiveForm) => ({ ...prev, proof: e.target.value }))}
                    step="0.01"
                    min="0"
                    max="200"
                    style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '4px', boxSizing: 'border-box', fontSize: '16px' }}
                  />
                </div>
              </>
            )}
            {/* Other-specific fields */}
            {singleForm.materialType === MaterialType.Other && (
              <div style={{ gridColumn: 'span 2' }}>
                <label style={{ fontWeight: 'bold', color: '#555', display: 'block', marginBottom: '5px' }}>Description:</label>
                <input
                  type="text"
                  value={singleForm.description || ''}
                  onChange={(e) => setSingleForm((prev: ReceiveForm) => ({ ...prev, description: e.target.value }))}
                  style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '4px', boxSizing: 'border-box', fontSize: '16px' }}
                />
              </div>
            )}
            {/* Received Date */}
            <div>
              <label style={{ fontWeight: 'bold', color: '#555', display: 'block', marginBottom: '5px' }}>Received Date:</label>
              <input
                type="date"
                value={singleForm.receivedDate}
                onChange={(e) => setSingleForm((prev: ReceiveForm) => ({ ...prev, receivedDate: e.target.value }))}
                style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '4px', boxSizing: 'border-box', fontSize: '16px' }}
              />
            </div>
            {/* Cost */}
            <div>
              <label style={{ fontWeight: 'bold', color: '#555', display: 'block', marginBottom: '5px' }}>Cost:</label>
              <input
                type="number"
                value={singleForm.cost || ''}
                onChange={(e) => setSingleForm((prev: ReceiveForm) => ({ ...prev, cost: e.target.value }))}
                step="0.01"
                min="0"
                style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '4px', boxSizing: 'border-box', fontSize: '16px' }}
              />
            </div>
            {/* PO Number */}
            <div style={{ gridColumn: 'span 2' }}>
              <label style={{ fontWeight: 'bold', color: '#555', display: 'block', marginBottom: '5px' }}>PO Number (optional):</label>
              <select
                value={singleForm.poNumber || ''}
                onChange={(e) => {
                  const poNumber = e.target.value;
                  setSingleForm((prev: ReceiveForm) => ({ ...prev, poNumber }));
                  if (poNumber) handlePOSelect(poNumber);
                }}
                style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '4px', boxSizing: 'border-box', fontSize: '16px' }}
              >
                <option value="">Select PO (optional)</option>
                {purchaseOrders.map(po => (
                  <option key={po.poNumber} value={po.poNumber}>{po.poNumber}</option>
                ))}
              </select>
            </div>
            {/* Submit Button */}
            <div style={{ gridColumn: 'span 2', textAlign: 'center' }}>
              <button
                onClick={handleReceive}
                style={{
                  backgroundColor: '#2196F3',
                  color: '#fff',
                  padding: '12px 24px',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '16px',
                  width: '100%',
                  maxWidth: '300px',
                  transition: 'background-color 0.3s',
                }}
                onMouseOver={(e) => (e.currentTarget.style.backgroundColor = '#1976D2')}
                onMouseOut={(e) => (e.currentTarget.style.backgroundColor = '#2196F3')}
              >
                Receive Item
              </button>
            </div>
          </div>
        ) : (
          <div>
            <div style={{ overflowX: 'auto', marginBottom: '20px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', backgroundColor: '#fff', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
                <thead>
                  <tr>
                    <th style={{ border: '1px solid #ddd', padding: '12px', backgroundColor: '#f5f5f5', fontWeight: 'bold', color: '#555' }}>Item</th>
                    <th style={{ border: '1px solid #ddd', padding: '12px', backgroundColor: '#f5f5f5', fontWeight: 'bold', color: '#555' }}>Lot Number</th>
                    <th style={{ border: '1px solid #ddd', padding: '12px', backgroundColor: '#f5f5f5', fontWeight: 'bold', color: '#555' }}>Material Type</th>
                    <th style={{ border: '1px solid #ddd', padding: '12px', backgroundColor: '#f5f5f5', fontWeight: 'bold', color: '#555' }}>Quantity</th>
                    <th style={{ border: '1px solid #ddd', padding: '12px', backgroundColor: '#f5f5f5', fontWeight: 'bold', color: '#555' }}>Unit</th>
                    <th style={{ border: '1px solid #ddd', padding: '12px', backgroundColor: '#f5f5f5', fontWeight: 'bold', color: '#555' }}>Cost</th>
                    <th style={{ border: '1px solid #ddd', padding: '12px', backgroundColor: '#f5f5f5', fontWeight: 'bold', color: '#555' }}>Description</th>
                    <th style={{ border: '1px solid #ddd', padding: '12px', backgroundColor: '#f5f5f5', fontWeight: 'bold', color: '#555' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {receiveItems.map((item, index) => (
                    <tr key={index}>
                      <td style={{ border: '1px solid #ddd', padding: '8px', position: 'relative' }}>
                        <input
                          type="text"
                          value={item.item}
                          onChange={(e) => {
                            const updatedItems = [...receiveItems];
                            updatedItems[index].item = e.target.value;
                            setReceiveItems(updatedItems);
                            setFilteredItems(items.filter(i => i.name.toLowerCase().includes(e.target.value.toLowerCase())));
                            setShowItemSuggestions(true);
                          }}
                          onFocus={() => setShowItemSuggestions(true)}
                          onBlur={() => setTimeout(() => setShowItemSuggestions(false), 300)}
                          style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '4px', boxSizing: 'border-box', fontSize: '16px' }}
                        />
                        {showItemSuggestions && (
                          <ul style={{ border: '1px solid #ddd', maxHeight: '150px', overflowY: 'auto', position: 'absolute', backgroundColor: '#fff', width: '200px', listStyle: 'none', padding: 0, margin: 0, zIndex: 1000, borderRadius: '4px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
                            {filteredItems.map(i => (
                              <li
                                key={i.name}
                                onMouseDown={() => handleItemSelect(i, index)}
                                style={{ padding: '8px 10px', cursor: 'pointer', backgroundColor: item.item === i.name ? '#e0e0e0' : '#fff', borderBottom: '1px solid #eee' }}
                              >
                                {i.name}
                              </li>
                            ))}
                            <li
                              onMouseDown={() => setShowNewItemModal(true)}
                              style={{ padding: '8px 10px', cursor: 'pointer', backgroundColor: '#fff', borderBottom: '1px solid #eee', color: '#2196F3', fontWeight: 'bold' }}
                            >
                              Add New Item
                            </li>
                          </ul>
                        )}
                      </td>
                      <td style={{ border: '1px solid #ddd', padding: '8px' }}>
                        <input
                          type="text"
                          value={item.lotNumber}
                          onChange={(e) => {
                            const updatedItems = [...receiveItems];
                            updatedItems[index].lotNumber = e.target.value;
                            setReceiveItems(updatedItems);
                          }}
                          style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '4px', boxSizing: 'border-box', fontSize: '16px' }}
                        />
                      </td>
                      <td style={{ border: '1px solid #ddd', padding: '8px' }}>
                        <select
                          value={item.materialType}
                          onChange={(e) => {
                            const updatedItems = [...receiveItems];
                            updatedItems[index].materialType = e.target.value as MaterialType;
                            setReceiveItems(updatedItems);
                          }}
                          style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '4px', boxSizing: 'border-box', fontSize: '16px' }}
                        >
                          {Object.values(MaterialType).map(type => (
                            <option key={type} value={type}>{type}</option>
                          ))}
                        </select>
                      </td>
                      <td style={{ border: '1px solid #ddd', padding: '8px' }}>
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
                          style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '4px', boxSizing: 'border-box', fontSize: '16px' }}
                        />
                      </td>
                      <td style={{ border: '1px solid #ddd', padding: '8px' }}>
                        <select
                          value={item.unit}
                          onChange={(e) => {
                            const updatedItems = [...receiveItems];
                            updatedItems[index].unit = e.target.value as Unit;
                            setReceiveItems(updatedItems);
                          }}
                          style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '4px', boxSizing: 'border-box', fontSize: '16px' }}
                        >
                          {Object.values(Unit).map(unit => (
                            <option key={unit} value={unit}>{unit}</option>
                          ))}
                        </select>
                      </td>
                      <td style={{ border: '1px solid #ddd', padding: '8px' }}>
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
                          style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '4px', boxSizing: 'border-box', fontSize: '16px' }}
                        />
                      </td>
                      <td style={{ border: '1px solid #ddd', padding: '8px' }}>
                        <input
                          type="text"
                          value={item.description || ''}
                          onChange={(e) => {
                            const updatedItems = [...receiveItems];
                            updatedItems[index].description = e.target.value;
                            setReceiveItems(updatedItems);
                          }}
                          placeholder={item.materialType === MaterialType.Other ? 'Required for Other' : 'Optional'}
                          style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '4px', boxSizing: 'border-box', fontSize: '16px' }}
                        />
                      </td>
                      <td style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'center' }}>
                        <button
                          onClick={() => setReceiveItems(receiveItems.filter((_, i) => i !== index))}
                          style={{
                            backgroundColor: '#F86752',
                            color: '#fff',
                            padding: '8px 16px',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '14px',
                            transition: 'background-color 0.3s',
                          }}
                          onMouseOver={(e) => (e.currentTarget.style.backgroundColor = '#D32F2F')}
                          onMouseOut={(e) => (e.currentTarget.style.backgroundColor = '#F86752')}
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div style={{ marginBottom: '20px' }}>
                <h3 style={{ color: '#555', marginBottom: '10px' }}>Other Charges (e.g., Freight, Milling)</h3>
                <table style={{ width: '100%', borderCollapse: 'collapse', backgroundColor: '#fff', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
                  <thead>
                    <tr>
                      <th style={{ border: '1px solid #ddd', padding: '12px', backgroundColor: '#f5f5f5', fontWeight: 'bold', color: '#555' }}>Description</th>
                      <th style={{ border: '1px solid #ddd', padding: '12px', backgroundColor: '#f5f5f5', fontWeight: 'bold', color: '#555' }}>Cost</th>
                      <th style={{ border: '1px solid #ddd', padding: '12px', backgroundColor: '#f5f5f5', fontWeight: 'bold', color: '#555' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {otherCharges.map((charge, index) => (
                      <tr key={index}>
                        <td style={{ border: '1px solid #ddd', padding: '8px' }}>
                          <input
                            type="text"
                            value={charge.description}
                            onChange={(e) => {
                              const updatedCharges = [...otherCharges];
                              updatedCharges[index].description = e.target.value;
                              setOtherCharges(updatedCharges);
                            }}
                            style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '4px', boxSizing: 'border-box', fontSize: '16px' }}
                          />
                        </td>
                        <td style={{ border: '1px solid #ddd', padding: '8px' }}>
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
                            style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '4px', boxSizing: 'border-box', fontSize: '16px' }}
                          />
                        </td>
                        <td style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'center' }}>
                          <button
                            onClick={() => setOtherCharges(otherCharges.filter((_, i) => i !== index))}
                            style={{
                              backgroundColor: '#F86752',
                              color: '#fff',
                              padding: '8px 16px',
                              border: 'none',
                              borderRadius: '4px',
                              cursor: 'pointer',
                              fontSize: '14px',
                              transition: 'background-color 0.3s',
                            }}
                            onMouseOver={(e) => (e.currentTarget.style.backgroundColor = '#D32F2F')}
                            onMouseOut={(e) => (e.currentTarget.style.backgroundColor = '#F86752')}
                          >
                            Remove
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <button
                  onClick={() => setOtherCharges([...otherCharges, { description: '', cost: '' }])}
                  style={{
                    backgroundColor: '#2196F3',
                    color: '#fff',
                    padding: '10px 20px',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '16px',
                    marginTop: '10px',
                    transition: 'background-color 0.3s',
                  }}
                  onMouseOver={(e) => (e.currentTarget.style.backgroundColor = '#1976D2')}
                  onMouseOut={(e) => (e.currentTarget.style.backgroundColor = '#2196F3')}
                >
                  Add Charge
                </button>
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '20px', marginBottom: '20px' }}>
              <button
                onClick={addItemRow}
                style={{
                  backgroundColor: '#2196F3',
                  color: '#fff',
                  padding: '10px 20px',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '16px',
                  transition: 'background-color 0.3s',
                }}
                onMouseOver={(e) => (e.currentTarget.style.backgroundColor = '#1976D2')}
                onMouseOut={(e) => (e.currentTarget.style.backgroundColor = '#2196F3')}
              >
                Add Item
              </button>
              <div style={{ flex: 1 }}>
                <label style={{ fontWeight: 'bold', color: '#555', display: 'block', marginBottom: '5px' }}>Vendor:</label>
                <input
                  type="text"
                  value={singleForm.source}
                  onChange={handleVendorInputChange}
                  placeholder="Type to search vendors"
                  onFocus={() => setShowVendorSuggestions(true)}
                  onBlur={() => setTimeout(() => setShowVendorSuggestions(false), 300)}
                  style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '4px', boxSizing: 'border-box', fontSize: '16px' }}
                />
                {showVendorSuggestions && (
                  <ul style={{ border: '1px solid #ddd', maxHeight: '150px', overflowY: 'auto', position: 'absolute', backgroundColor: '#fff', width: '200px', listStyle: 'none', padding: 0, margin: 0, zIndex: 1000, borderRadius: '4px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
                    {filteredVendors.map((vendor) => (
                      <li
                        key={vendor.name}
                        onMouseDown={(e) => { e.preventDefault(); handleVendorSelect(vendor); }}
                        style={{ padding: '8px 10px', cursor: 'pointer', backgroundColor: singleForm.source === vendor.name ? '#e0e0e0' : '#fff', borderBottom: '1px solid #eee' }}
                      >
                        {vendor.name}
                      </li>
                    ))}
                    <li
                      onMouseDown={(e) => { e.preventDefault(); navigate('/vendors/new', { state: { fromReceive: true } }); setShowVendorSuggestions(false); }}
                      style={{ padding: '8px 10px', cursor: 'pointer', backgroundColor: '#fff', borderBottom: '1px solid #eee', color: '#2196F3', fontWeight: 'bold' }}
                    >
                      Add New Vendor
                    </li>
                  </ul>
                )}
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
              <div>
                <label style={{ fontWeight: 'bold', color: '#555', display: 'block', marginBottom: '5px' }}>Received Date:</label>
                <input
                  type="date"
                  value={singleForm.receivedDate}
                  onChange={(e) => setSingleForm((prev: ReceiveForm) => ({ ...prev, receivedDate: e.target.value }))}
                  style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '4px', boxSizing: 'border-box', fontSize: '16px' }}
                />
              </div>
              <div>
                <label style={{ fontWeight: 'bold', color: '#555', display: 'block', marginBottom: '5px' }}>PO Number (optional):</label>
                <select
                  value={singleForm.poNumber || ''}
                  onChange={(e) => {
                    const poNumber = e.target.value;
                    setSingleForm((prev: ReceiveForm) => ({ ...prev, poNumber }));
                    if (poNumber) handlePOSelect(poNumber);
                  }}
                  style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '4px', boxSizing: 'border-box', fontSize: '16px' }}
                >
                  <option value="">Select PO (optional)</option>
                  {purchaseOrders.map(po => (
                    <option key={po.poNumber} value={po.poNumber}>{po.poNumber}</option>
                  ))}
                </select>
              </div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <button
                onClick={handleReceive}
                style={{
                  backgroundColor: '#2196F3',
                  color: '#fff',
                  padding: '12px 24px',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '16px',
                  width: '100%',
                  maxWidth: '300px',
                  transition: 'background-color 0.3s',
                }}
                onMouseOver={(e) => (e.currentTarget.style.backgroundColor = '#1976D2')}
                onMouseOut={(e) => (e.currentTarget.style.backgroundColor = '#2196F3')}
              >
                Receive Items
              </button>
            </div>
          </div>
        )}
        {showNewItemModal && (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 2000 }}>
            <div style={{ backgroundColor: '#fff', padding: '20px', borderRadius: '8px', width: '400px', boxShadow: '0 4px 8px rgba(0,0,0,0.2)' }}>
              <h3 style={{ color: '#555', marginBottom: '20px', textAlign: 'center' }}>Create New Item</h3>
              <input
                type="text"
                value={newItem}
                onChange={(e) => setNewItem(e.target.value)}
                placeholder="Item Name"
                style={{ width: '100%', padding: '10px', marginBottom: '15px', border: '1px solid #ddd', borderRadius: '4px', boxSizing: 'border-box', fontSize: '16px' }}
              />
              <select
                value={newItemType}
                onChange={(e) => setNewItemType(e.target.value as MaterialType)}
                style={{ width: '100%', padding: '10px', marginBottom: '15px', border: '1px solid #ddd', borderRadius: '4px', boxSizing: 'border-box', fontSize: '16px' }}
              >
                {Object.values(MaterialType).map(type => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <button
                  onClick={handleCreateItem}
                  style={{
                    backgroundColor: '#2196F3',
                    color: '#fff',
                    padding: '10px 20px',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '16px',
                    transition: 'background-color 0.3s',
                  }}
                  onMouseOver={(e) => (e.currentTarget.style.backgroundColor = '#1976D2')}
                  onMouseOut={(e) => (e.currentTarget.style.backgroundColor = '#2196F3')}
                >
                  Create
                </button>
                <button
                  onClick={() => setShowNewItemModal(false)}
                  style={{
                    backgroundColor: '#F86752',
                    color: '#fff',
                    padding: '10px 20px',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '16px',
                    transition: 'background-color 0.3s',
                  }}
                  onMouseOver={(e) => (e.currentTarget.style.backgroundColor = '#D32F2F')}
                  onMouseOut={(e) => (e.currentTarget.style.backgroundColor = '#F86752')}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
        {poItemToSplit && (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 2000 }}>
            <div style={{ backgroundColor: '#fff', padding: '20px', borderRadius: '8px', width: '500px', boxShadow: '0 4px 8px rgba(0,0,0,0.2)' }}>
              <h3 style={{ color: '#555', marginBottom: '20px', textAlign: 'center' }}>Split Spirits into Lots</h3>
              <p style={{ textAlign: 'center', marginBottom: '15px' }}>Split {poItemToSplit.name} ({poItemToSplit.quantity} gallons) into individual lots:</p>
              {lotItems.map((lot, index) => (
                <div key={`lot-${index}`} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 0.5fr', gap: '10px', marginBottom: '10px' }}>
                  <input
                    type="text"
                    value={lot.lotNumber}
                    onChange={(e) => {
                      const updatedLots = [...lotItems];
                      updatedLots[index].lotNumber = e.target.value;
                      setLotItems(updatedLots);
                    }}
                    placeholder="Lot Number"
                    style={{ padding: '10px', border: '1px solid #ddd', borderRadius: '4px', boxSizing: 'border-box', fontSize: '16px' }}
                  />
                  <input
                    type="number"
                    value={lot.quantity}
                    onChange={(e) => {
                      const updatedLots = [...lotItems];
                      updatedLots[index].quantity = e.target.value;
                      setLotItems(updatedLots);
                    }}
                    placeholder="Gallons"
                    step="0.01"
                    min="0"
                    style={{ padding: '10px', border: '1px solid #ddd', borderRadius: '4px', boxSizing: 'border-box', fontSize: '16px' }}
                  />
                  <button
                    onClick={() => setLotItems(lotItems.filter((_, i) => i !== index))}
                    style={{
                      backgroundColor: '#F86752',
                      color: '#fff',
                      padding: '8px 16px',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '14px',
                      transition: 'background-color 0.3s',
                    }}
                    onMouseOver={(e) => (e.currentTarget.style.backgroundColor = '#D32F2F')}
                    onMouseOut={(e) => (e.currentTarget.style.backgroundColor = '#F86752')}
                  >
                    Remove
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() => setLotItems([...lotItems, { 
                  identifier: '',
                  item: poItemToSplit.name,
                  lotNumber: '',
                  quantity: '',
                  materialType: MaterialType.Spirits,
                  unit: Unit.Gallons,
                  siteId: selectedSite,
                  locationId: singleForm.locationId || '',
                }])}
                style={{
                  backgroundColor: '#2196F3',
                  color: '#fff',
                  padding: '10px 20px',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '16px',
                  display: 'block',
                  margin: '15px auto 0',
                  transition: 'background-color 0.3s',
                }}
                onMouseOver={(e) => (e.currentTarget.style.backgroundColor = '#1976D2')}
                onMouseOut={(e) => (e.currentTarget.style.backgroundColor = '#2196F3')}
              >
                Add Lot
              </button>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '20px' }}>
                <button
                  onClick={handleLotSplit}
                  style={{
                    backgroundColor: '#2196F3',
                    color: '#fff',
                    padding: '10px 20px',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '16px',
                    transition: 'background-color 0.3s',
                  }}
                  onMouseOver={(e) => (e.currentTarget.style.backgroundColor = '#1976D2')}
                  onMouseOut={(e) => (e.currentTarget.style.backgroundColor = '#2196F3')}
                >
                  Save Lots
                </button>
                <button
                  onClick={() => {
                    setPoItemToSplit(null);
                    setLotItems([]);
                  }}
                  style={{
                    backgroundColor: '#F86752',
                    color: '#fff',
                    padding: '10px 20px',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '16px',
                    transition: 'background-color 0.3s',
                  }}
                  onMouseOver={(e) => (e.currentTarget.style.backgroundColor = '#D32F2F')}
                  onMouseOut={(e) => (e.currentTarget.style.backgroundColor = '#F86752')}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ReceivePage;