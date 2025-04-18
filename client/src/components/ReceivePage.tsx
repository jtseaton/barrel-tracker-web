import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { createPortal } from 'react-dom';
import { PurchaseOrder, ReceiveItem, ReceivableItem, InventoryItem, Status, Vendor, ReceiveForm, PurchaseOrderItem, Site, Location } from '../types/interfaces';
import { MaterialType, Unit, Account } from '../types/enums';

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
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const siteInputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const [showAddItemModal, setShowAddItemModal] = useState(false);
  const [newReceiveItem, setNewReceiveItem] = useState<ReceiveItem>({
    identifier: '',
    item: '',
    lotNumber: '',
    materialType: MaterialType.Grain,
    quantity: '',
    unit: Unit.Pounds,
    cost: '',
    description: '',
    siteId: 'DSP-AL-20010', // Default site, adjust or remove as needed
    locationId: '',
    account: Account.Storage,
    proof: '',
  });
  const [rowLocations, setRowLocations] = useState<Location[][]>([]);
  const [rowFilteredLocations, setRowFilteredLocations] = useState<Location[][]>([]);
  const [rowFetchingLocations, setRowFetchingLocations] = useState<boolean[]>([]);
  const locationInputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const [selectedSite, setSelectedSite] = useState<string>(locationState?.newSiteId || ''); // Initialize with newSiteId
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
    siteId: locationState?.newSiteId || selectedSite || '', // Use selectedSite
    locationId: '',
  });
  const [receiveItems, setReceiveItems] = useState<ReceiveItem[]>([]);
  const [useSingleItem, setUseSingleItem] = useState(true);
  const [items, setItems] = useState<Item[]>([]);
  const [filteredItems, setFilteredItems] = useState<Item[]>([]);
  const [activeItemDropdownIndex, setActiveItemDropdownIndex] = useState<number | null>(null);
  const [dropdownPosition, setDropdownPosition] = useState<{ top: number; left: number } | null>(null);
  const [itemDropdownPosition, setItemDropdownPosition] = useState<{ top: number; left: number } | null>(null);
  const [sites, setSites] = useState<Site[]>([]);
  const [filteredSites, setFilteredSites] = useState<Site[]>([]);
  const [showSiteSuggestions, setShowSiteSuggestions] = useState(false);
  const [siteDropdownPosition, setSiteDropdownPosition] = useState<{ top: number; left: number } | null>(null); // New state for Site dropdown position
  const [activeSiteDropdownIndex, setActiveSiteDropdownIndex] = useState<number | null>(null);
  const [locations, setLocations] = useState<Location[]>([]);
  const [filteredLocations, setFilteredLocations] = useState<Location[]>([]);
  const [filteredVendors, setFilteredVendors] = useState<Vendor[]>(vendors);
  const [showVendorSuggestions, setShowVendorSuggestions] = useState(false);
  const [showLocationSuggestions, setShowLocationSuggestions] = useState(false);
  const [activeLocationDropdownIndex, setActiveLocationDropdownIndex] = useState<number | null>(null);
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

  const fetchLocations = useCallback(async (siteId: string, rowIndex: number = 9999): Promise<void> => {
    if (!siteId) {
      // Clear locations for both Single and Multiple Items mode
      if (rowIndex === 9999) {
        setLocations([]);
        setFilteredLocations([]);
        setIsFetchingLocations(false);
      }
      setRowLocations((prev) => {
        const newLocations = [...prev];
        newLocations[rowIndex] = [];
        return newLocations;
      });
      setRowFilteredLocations((prev) => {
        const newFiltered = [...prev];
        newFiltered[rowIndex] = [];
        return newFiltered;
      });
      setRowFetchingLocations((prev) => {
        const newFetching = [...prev];
        newFetching[rowIndex] = false;
        return newFetching;
      });
      return;
    }
  
    // Set fetching state
    if (rowIndex === 9999) {
      setIsFetchingLocations(true);
    }
    setRowFetchingLocations((prev) => {
      const newFetching = [...prev];
      newFetching[rowIndex] = true;
      return newFetching;
    });
  
    try {
      const url = `${API_BASE_URL}/api/locations?siteId=${encodeURIComponent(siteId)}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
      const data: Location[] = await res.json();
      console.log(`Fetched locations for site ${siteId} at index ${rowIndex}:`, data); // Debug log
  
      // Update locations for Single Item mode if rowIndex is 9999
      if (rowIndex === 9999) {
        setLocations(data);
        setFilteredLocations(data);
        setIsFetchingLocations(false);
      }
  
      // Update rowLocations for Multiple Items mode
      setRowLocations((prev) => {
        const newLocations = [...prev];
        newLocations[rowIndex] = data;
        return newLocations;
      });
      setRowFilteredLocations((prev) => {
        const newFiltered = [...prev];
        newFiltered[rowIndex] = data;
        return newFiltered;
      });
      setRowFetchingLocations((prev) => {
        const newFetching = [...prev];
        newFetching[rowIndex] = false;
        return newFetching;
      });
    } catch (err: any) {
      console.error('Fetch locations error:', err);
      setProductionError(`Failed to fetch locations: ${err.message}`);
  
      // Clear locations on error
      if (rowIndex === 9999) {
        setLocations([]);
        setFilteredLocations([]);
        setIsFetchingLocations(false);
      }
      setRowLocations((prev) => {
        const newLocations = [...prev];
        newLocations[rowIndex] = [];
        return newLocations;
      });
      setRowFilteredLocations((prev) => {
        const newFiltered = [...prev];
        newFiltered[rowIndex] = [];
        return newFiltered;
      });
      setRowFetchingLocations((prev) => {
        const newFetching = [...prev];
        newFetching[rowIndex] = false;
        return newFetching;
      });
    }
  }, [API_BASE_URL]);

  useEffect(() => {
    if (locationState?.newSiteId) {
      setSelectedSite(locationState.newSiteId);
      setSingleForm((prev) => ({ ...prev, siteId: locationState.newSiteId || '' }));
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

  useEffect(() => {
    if (activeSiteDropdownIndex !== null && siteInputRefs.current[activeSiteDropdownIndex]) {
      const input = siteInputRefs.current[activeSiteDropdownIndex];
      const rect = input!.getBoundingClientRect();
      setSiteDropdownPosition({
        top: rect.bottom + window.scrollY,
        left: rect.left + window.scrollX,
      });
    } else {
      setSiteDropdownPosition(null);
    }
  }, [activeSiteDropdownIndex]);

  useEffect(() => {
    setSingleForm((prev) => {
      if (prev.siteId !== selectedSite) {
        console.log('Syncing singleForm.siteId with selectedSite:', selectedSite);
        return { ...prev, siteId: selectedSite, locationId: '' }; // Reset locationId when site changes
      }
      return prev;
    });
  }, [selectedSite]);

  useEffect(() => {
    if (
      activeLocationDropdownIndex !== null &&
      locationInputRefs.current[activeLocationDropdownIndex] &&
      activeItemDropdownIndex === null // Ensure Item isn’t active
    ) {
      const input = locationInputRefs.current[activeLocationDropdownIndex];
      const rect = input!.getBoundingClientRect();
      setDropdownPosition({
        top: rect.bottom + window.scrollY,
        left: rect.left + window.scrollX,
      });
    } else {
      setDropdownPosition(null);
    }
  }, [activeLocationDropdownIndex, activeItemDropdownIndex]);

  useEffect(() => {
    console.log('selectedSite changed:', selectedSite);
    if (selectedSite) {
      fetchLocations(selectedSite);
    } else {
      setLocations([]);
      setFilteredLocations([]);
      setIsFetchingLocations(false);
    }
  }, [selectedSite, fetchLocations]);

  useEffect(() => {
    if (
      activeItemDropdownIndex !== null &&
      inputRefs.current[activeItemDropdownIndex] &&
      activeLocationDropdownIndex === null // Ensure Location isn’t active
    ) {
      const input = inputRefs.current[activeItemDropdownIndex];
      const rect = input!.getBoundingClientRect();
      setItemDropdownPosition({
        top: rect.bottom + window.scrollY,
        left: rect.left + window.scrollX,
      });
    } else {
      setItemDropdownPosition(null);
    }
  }, [activeItemDropdownIndex, activeLocationDropdownIndex]);

  const calculateTotal = useMemo(() => {
    let total = 0;
  
    // Item costs
    if (useSingleItem) {
      const singleCost = parseFloat(singleForm.cost || '0');
      total += isNaN(singleCost) ? 0 : singleCost;
    } else {
      const itemsTotal = receiveItems.reduce((sum, item) => {
        const cost = parseFloat(item.cost || '0');
        return sum + (isNaN(cost) ? 0 : cost);
      }, 0);
      total += itemsTotal;
  
      // Other charges (only in Multiple Items mode)
      const chargesTotal = otherCharges.reduce((sum, charge) => {
        const cost = parseFloat(charge.cost || '0');
        return sum + (isNaN(cost) ? 0 : cost);
      }, 0);
      total += chargesTotal;
    }
  
    return total.toFixed(2); // Return as string with 2 decimal places
  }, [useSingleItem, singleForm.cost, receiveItems, otherCharges]);

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

  const handleItemSelect = (selectedItem: Item, index?: number) => {
    const normalizedType = selectedItem.type ? selectedItem.type.charAt(0).toUpperCase() + selectedItem.type.slice(1).toLowerCase() : 'Other';
    const materialType = Object.values(MaterialType).includes(normalizedType as MaterialType) ? normalizedType as MaterialType : MaterialType.Other;
    if (useSingleItem) {
      setSingleForm((prev: ReceiveForm) => ({ ...prev, item: selectedItem.name, materialType }));
    } else if (index !== undefined) {
      const updatedItems = [...receiveItems];
      updatedItems[index] = { 
        ...updatedItems[index], 
        item: selectedItem.name,
        materialType,
        // Explicitly preserve existing locationId
        locationId: updatedItems[index].locationId || '',
      };
      setReceiveItems(updatedItems);
    }
    setActiveItemDropdownIndex(null);
  };

  const handleLocationSelect = (location: Location, index?: number) => {
    if (useSingleItem) {
      console.log('Selected location for Single Item:', {
        locationId: location.locationId,
        locationName: location.name,
      });
      setSingleForm((prev: ReceiveForm) => ({
        ...prev,
        locationId: location.locationId.toString(),
      }));
      setShowLocationSuggestions(false);
    } else if (index !== undefined) {
      const updatedItems = [...receiveItems];
      updatedItems[index].locationId = location.locationId.toString();
      setReceiveItems(updatedItems);
      setActiveLocationDropdownIndex(null);
    }
  };

  const handleAddNewLocation = () => {
    navigate('/locations', {
      state: { fromReceive: true, siteId: selectedSite },
    });
    setShowLocationSuggestions(false);
    setActiveLocationDropdownIndex(null);
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
        locationId: '',
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
        locationId: item.locationId || '',
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
          cost: '',
          description: '',
          siteId: selectedSite,
          locationId: '',
          account: newItemType === MaterialType.Spirits ? Account.Storage : undefined,
          proof: newItemType === MaterialType.Spirits ? '' : undefined,
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
    setShowAddItemModal(true);
    // Initialize modal location data
    setRowLocations((prev) => {
      const newLocations = [...prev];
      newLocations[9999] = [];
      return newLocations;
    });
    setRowFilteredLocations((prev) => {
      const newFiltered = [...prev];
      newFiltered[9999] = [];
      return newFiltered;
    });
    setRowFetchingLocations((prev) => {
      const newFetching = [...prev];
      newFetching[9999] = false;
      return newFetching;
    });
    // Fetch locations for the default site if set
    if (newReceiveItem.siteId) {
      console.log(`Fetching locations for default siteId: ${newReceiveItem.siteId}`);
      fetchLocations(newReceiveItem.siteId, 9999);
    }
  };

  const handleReceive = async () => {
    const itemsToReceive: ReceivableItem[] = useSingleItem ? [singleForm] : receiveItems;
    // Debug singleForm in Single Item mode
    if (useSingleItem) {
      console.log('singleForm on Receive:', {
        item: singleForm.item,
        materialType: singleForm.materialType,
        quantity: singleForm.quantity,
        unit: singleForm.unit,
        siteId: singleForm.siteId,
        locationId: singleForm.locationId,
        locationIdType: typeof singleForm.locationId,
        locationIdLength: singleForm.locationId?.length,
      });
    }
    
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
        siteId: item.siteId || singleForm.siteId,
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

  const renderItemDropdown = (index: number, item: ReceiveItem) => {
    if (activeItemDropdownIndex !== index || !itemDropdownPosition) return null;
    return createPortal(
      <ul className="typeahead">
        {filteredItems.length > 0 ? (
          filteredItems.map((i) => (
            <li
              key={i.name}
              onMouseDown={() => handleItemSelect(i, index)}
              className={item.item === i.name ? 'selected' : ''}
            >
              {i.name}
            </li>
          ))
        ) : (
          <li style={{ padding: '8px 10px', color: '#888', borderBottom: '1px solid #eee' }}>
            No items found
          </li>
        )}
        <li
          onMouseDown={() => {
            setNewItem(item.item);
            setNewItemType(item.materialType);
            setShowNewItemModal(true);
            setActiveItemDropdownIndex(null);
          }}
          className="add-new"
        >
          Add New Item
        </li>
      </ul>,
      document.getElementById('dropdown-portal') || document.body
    );
  };

return (
  <div style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto', minHeight: '100vh', overflowY: 'auto' }}>
    <div style={{ backgroundColor: '#fff', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)', padding: '20px', marginBottom: '20px', display: 'flex', flexDirection: 'column' }}>
      {/* Total Display */}
      <div style={{ textAlign: 'center', marginBottom: '20px', padding: '10px', backgroundColor: '#f5f5f5', borderRadius: '4px' }}>
        <h2 style={{ color: '#555', fontSize: '20px', margin: 0 }}>
          Total Receipt Value: ${calculateTotal}
        </h2>
      </div>
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
              <ul className="typeahead">
                {filteredSites.map((site) => (
                  <li
                    key={site.siteId}
                    onMouseDown={() => {
                      console.log('Selected site:', { siteId: site.siteId, siteName: site.name });
                      setSelectedSite(site.siteId);
                      setSingleForm((prev) => ({ ...prev, siteId: site.siteId }));
                      setShowSiteSuggestions(false);
                    }}
                    className={selectedSite === site.siteId ? 'selected' : ''}
                  >
                    {site.name}
                  </li>
                ))}
                <li
                  onMouseDown={() => {
                    navigate('/sites', { state: { fromReceive: true } });
                    setShowSiteSuggestions(false);
                  }}
                  className="add-new"
                >
                  Add New Site
                </li>
              </ul>
            )}
          </div>
          <div style={{ position: 'relative' }}>
            <label style={{ fontWeight: 'bold', color: '#555', display: 'block', marginBottom: '5px' }}>
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
                console.log('Location input change:', { value, locations, singleFormLocationId: singleForm.locationId });
                setSingleForm((prev: ReceiveForm) => ({ ...prev, locationId: '' }));
                setFilteredLocations(
                  locations.filter((loc) =>
                    loc.name.toLowerCase().includes(value.toLowerCase())
                  )
                );
                setShowLocationSuggestions(true);
              }}
              onFocus={() => {
                console.log('Location input focus:', { isFetchingLocations, locations, selectedSite, singleForm });
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
              <ul className="typeahead">
                {filteredLocations.length > 0 ? (
                  filteredLocations.map((location) => (
                    <li
                      key={location.locationId}
                      onMouseDown={() => handleLocationSelect(location)}
                      className={singleForm.locationId === location.locationId.toString() ? 'selected' : ''}
                    >
                      {location.name}
                    </li>
                  ))
                ) : (
                  <li style={{ padding: '8px 10px', color: '#888', borderBottom: '1px solid #eee' }}>
                    No locations found
                  </li>
                )}
                <li
                  onMouseDown={() => handleAddNewLocation()}
                  className="add-new"
                >
                  Add New Location
                </li>
              </ul>
            )}
          </div>
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
              <ul className="typeahead">
                {filteredVendors.map((vendor) => (
                  <li
                    key={vendor.name}
                    onMouseDown={(e) => { e.preventDefault(); handleVendorSelect(vendor); }}
                    className={singleForm.source === vendor.name ? 'selected' : ''}
                  >
                    {vendor.name}
                  </li>
                ))}
                <li
                  onMouseDown={(e) => { e.preventDefault(); navigate('/vendors/new', { state: { fromReceive: true } }); setShowVendorSuggestions(false); }}
                  className="add-new"
                >
                  Add New Vendor
                </li>
              </ul>
            )}
          </div>
          <div style={{ position: 'relative' }}>
            <label style={{ fontWeight: 'bold', color: '#555', display: 'block', marginBottom: '5px' }}>Item:</label>
            <input
              type="text"
              value={singleForm.item}
              onChange={(e) => {
                setSingleForm((prev: ReceiveForm) => ({ ...prev, item: e.target.value }));
                setFilteredItems(items.filter(i => i.name.toLowerCase().includes(e.target.value.toLowerCase())));
                setActiveItemDropdownIndex(0);
              }}
              onFocus={() => setActiveItemDropdownIndex(0)}
              onBlur={() => setTimeout(() => setActiveItemDropdownIndex(null), 300)}
              style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '4px', boxSizing: 'border-box', fontSize: '16px' }}
            />
            {activeItemDropdownIndex === 0 && (
              <ul className="typeahead">
                {filteredItems.map(item => (
                  <li
                    key={item.name}
                    onMouseDown={() => handleItemSelect(item)}
                    className={singleForm.item === item.name ? 'selected' : ''}
                  >
                    {item.name}
                  </li>
                ))}
                <li
                  onMouseDown={() => setShowNewItemModal(true)}
                  className="add-new"
                >
                  Add New Item
                </li>
              </ul>
            )}
          </div>
          <div>
            <label style={{ fontWeight: 'bold', color: '#555', display: 'block', marginBottom: '5px' }}>Lot Number:</label>
            <input
              type="text"
              value={singleForm.lotNumber}
              onChange={(e) => setSingleForm((prev: ReceiveForm) => ({ ...prev, lotNumber: e.target.value }))}
              style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '4px', boxSizing: 'border-box', fontSize: '16px' }}
            />
          </div>
          <div>
            <label style={{ fontWeight: 'bold', color: '#555', display: 'block', marginBottom: '5px' }}>Material Type:</label>
            <select
              value={singleForm.materialType}
              onChange={(e) => setSingleForm((prev: ReceiveForm) => ({ ...prev, materialType: e.target.value as MaterialType }))}
            >
              {Object.values(MaterialType).map(type => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
          </div>
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
          <div>
            <label style={{ fontWeight: 'bold', color: '#555', display: 'block', marginBottom: '5px' }}>Unit:</label>
            <select
              value={singleForm.unit}
              onChange={(e) => setSingleForm((prev: ReceiveForm) => ({ ...prev, unit: e.target.value as Unit }))}
            >
              {Object.values(Unit).map(unit => (
                <option key={unit} value={unit}>{unit}</option>
              ))}
            </select>
          </div>
          {singleForm.materialType === MaterialType.Spirits && (
            <>
              <div>
                <label style={{ fontWeight: 'bold', color: '#555', display: 'block', marginBottom: '5px' }}>Account:</label>
                <select
                  value={singleForm.account}
                  onChange={(e) => setSingleForm((prev: ReceiveForm) => ({ ...prev, account: e.target.value as Account }))}
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
          <div style={{ gridColumn: 'span 2' }}>
            <label style={{ fontWeight: 'bold', color: '#555', display: 'block', marginBottom: '5px' }}>PO Number (optional):</label>
            <select
              value={singleForm.poNumber || ''}
              onChange={(e) => {
                const poNumber = e.target.value;
                setSingleForm((prev: ReceiveForm) => ({ ...prev, poNumber }));
                if (poNumber) handlePOSelect(poNumber);
              }}
            >
              <option value="">Select PO (optional)</option>
              {purchaseOrders.map(po => (
                <option key={po.poNumber} value={po.poNumber}>{po.poNumber}</option>
              ))}
            </select>
          </div>
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
                <ul className="typeahead">
                  {filteredVendors.map((vendor) => (
                    <li
                      key={vendor.name}
                      onMouseDown={(e) => { e.preventDefault(); handleVendorSelect(vendor); }}
                      className={singleForm.source === vendor.name ? 'selected' : ''}
                    >
                      {vendor.name}
                    </li>
                  ))}
                  <li
                    onMouseDown={(e) => { e.preventDefault(); navigate('/vendors/new', { state: { fromReceive: true } }); setShowVendorSuggestions(false); }}
                    className="add-new"
                  >
                    Add New Vendor
                  </li>
                </ul>
              )}
            </div>
          </div>
          <div style={{ overflowX: 'auto', marginBottom: '20px', position: 'relative', zIndex: 1000 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '800px' }}>
              <thead>
                <tr>
                  <th style={{ border: '1px solid #ddd', padding: '12px 16px', backgroundColor: '#f5f5f5', fontWeight: 'bold', color: '#555', minWidth: '200px' }}>Name</th>
                  <th style={{ border: '1px solid #ddd', padding: '12px 16px', backgroundColor: '#f5f5f5', fontWeight: 'bold', color: '#555', minWidth: '100px' }}>Qty</th>
                  <th style={{ border: '1px solid #ddd', padding: '12px 16px', backgroundColor: '#f5f5f5', fontWeight: 'bold', color: '#555', minWidth: '100px' }}>Unit</th>
                  <th style={{ border: '1px solid #ddd', padding: '12px 16px', backgroundColor: '#f5f5f5', fontWeight: 'bold', color: '#555', minWidth: '100px' }}>Cost</th>
                  <th style={{ border: '1px solid #ddd', padding: '12px 16px', backgroundColor: '#f5f5f5', fontWeight: 'bold', color: '#555', minWidth: '180px' }}>Location</th>
                  <th style={{ border: '1px solid #ddd', padding: '12px 16px', backgroundColor: '#f5f5f5', fontWeight: 'bold', color: '#555', minWidth: '100px', position: 'sticky', right: 0, zIndex: 1 }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {receiveItems.map((item, index) => (
                  <tr key={index}>
                    <td style={{ border: '1px solid #ddd', padding: '8px 16px', minWidth: '200px' }}>
                      <input
                        type="text"
                        value={item.item}
                        ref={(el) => { inputRefs.current[index] = el; }}
                        onChange={(e) => {
                          const updatedItems = [...receiveItems];
                          updatedItems[index].item = e.target.value;
                          setReceiveItems(updatedItems);
                          setFilteredItems(items.filter((i) => i.name.toLowerCase().includes(e.target.value.toLowerCase())));
                          setActiveItemDropdownIndex(index);
                        }}
                        onFocus={() => {
                          setActiveItemDropdownIndex(index);
                          setFilteredItems(items);
                        }}
                        onBlur={() => setTimeout(() => setActiveItemDropdownIndex(null), 300)}
                        placeholder="Select item"
                        style={{ width: '100%', padding: '12px', border: '1px solid #ddd', borderRadius: '4px', boxSizing: 'border-box', fontSize: '16px' }}
                      />
                      {renderItemDropdown(index, item)}
                    </td>
                    <td style={{ border: '1px solid #ddd', padding: '8px 16px', minWidth: '100px' }}>
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
                        style={{ width: '100%', padding: '12px', border: '1px solid #ddd', borderRadius: '4px', boxSizing: 'border-box', fontSize: '16px' }}
                      />
                    </td>
                    <td style={{ border: '1px solid #ddd', padding: '8px 16px', minWidth: '100px' }}>
                      <select
                        value={item.unit}
                        onChange={(e) => {
                          const updatedItems = [...receiveItems];
                          updatedItems[index].unit = e.target.value as Unit;
                          setReceiveItems(updatedItems);
                        }}
                      >
                        {Object.values(Unit).map((unit) => (
                          <option key={unit} value={unit}>{unit}</option>
                        ))}
                      </select>
                    </td>
                    <td style={{ border: '1px solid #ddd', padding: '8px 16px', minWidth: '100px' }}>
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
                        style={{ width: '100%', padding: '12px', border: '1px solid #ddd', borderRadius: '4px', boxSizing: 'border-box', fontSize: '16px' }}
                      />
                    </td>
                    <td style={{ border: '1px solid #ddd', padding: '8px 16px', minWidth: '180px' }}>
                      <>
                        {console.log(`Table Location for index ${index}:`, {
                          locationId: item.locationId,
                          locations: rowLocations[index],
                          name: rowLocations[index]?.find((loc) => loc.locationId.toString() === item.locationId)?.name,
                        })}
                        <input
                          type="text"
                          value={
                            item.locationId && rowLocations[index]
                              ? rowLocations[index].find((loc) => loc.locationId.toString() === item.locationId)?.name || ''
                              : ''
                          }
                          ref={(el) => { locationInputRefs.current[index] = el; }}
                          onChange={(e) => {
                            const value = e.target.value;
                            const updatedItems = [...receiveItems];
                            updatedItems[index].locationId = '';
                            setReceiveItems(updatedItems);
                            setRowFilteredLocations((prev) => {
                              const newFiltered = [...prev];
                              newFiltered[index] = rowLocations[index]?.filter((loc) =>
                                loc.name.toLowerCase().includes(value.toLowerCase())
                              ) || [];
                              return newFiltered;
                            });
                            setActiveLocationDropdownIndex(index);
                          }}
                          onFocus={() => {
                            if (!rowFetchingLocations[index] && rowLocations[index]?.length > 0) {
                              setActiveLocationDropdownIndex(index);
                              setRowFilteredLocations((prev) => {
                                const newFiltered = [...prev];
                                newFiltered[index] = rowLocations[index] || [];
                                return newFiltered;
                              });
                            }
                          }}
                          onBlur={() => setTimeout(() => setActiveLocationDropdownIndex(null), 300)}
                          placeholder={rowFetchingLocations[index] ? 'Loading locations...' : 'Select location'}
                          disabled={!item.siteId || rowFetchingLocations[index]}
                          style={{
                            width: '100%',
                            padding: '12px',
                            border: '1px solid #ddd',
                            borderRadius: '4px',
                            boxSizing: 'border-box',
                            fontSize: '16px',
                            backgroundColor: !item.siteId || rowFetchingLocations[index] ? '#f5f5f5' : '#fff',
                          }}
                        />
                        {activeLocationDropdownIndex === index && !rowFetchingLocations[index] && dropdownPosition && createPortal(
                          <ul className="typeahead">
                            {rowFilteredLocations[index]?.length > 0 ? (
                              rowFilteredLocations[index].map((location) => (
                                <li
                                  key={location.locationId}
                                  onMouseDown={() => {
                                    const updatedItems = [...receiveItems];
                                    updatedItems[index].locationId = location.locationId.toString();
                                    setReceiveItems(updatedItems);
                                    setActiveLocationDropdownIndex(null);
                                  }}
                                  className={item.locationId === location.locationId.toString() ? 'selected' : ''}
                                >
                                  {location.name}
                                </li>
                              ))
                            ) : (
                              <li style={{ padding: '8px 10px', color: '#888', borderBottom: '1px solid #eee' }}>
                                No locations found
                              </li>
                            )}
                            <li
                              onMouseDown={() => {
                                navigate('/locations', { state: { fromReceive: true, siteId: item.siteId } });
                                setActiveLocationDropdownIndex(null);
                              }}
                              className="add-new"
                            >
                              Add New Location
                            </li>
                          </ul>,
                          document.getElementById('dropdown-portal') || document.body
                        )}
                      </>
                    </td>
                    <td style={{ border: '1px solid #ddd', padding: '8px 16px', minWidth: '100px', position: 'sticky', right: 0, backgroundColor: '#fff', zIndex: 1 }}>
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
                          width: '100%',
                        }}
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ marginBottom: '20px', position: 'relative', zIndex: 500 }}>
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
              >
                <option value="">Select PO (optional)</option>
                {purchaseOrders.map(po => (
                  <option key={po.poNumber} value={po.poNumber}>{po.poNumber}</option>
                ))}
              </select>
            </div>
          </div>
          <div style={{ textAlign: 'center', paddingBottom: '20px' }}>
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
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 10000 }}>
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
      {showAddItemModal && (
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
            zIndex: 10000,
          }}
        >
          <div
            style={{
              backgroundColor: '#fff',
              padding: '20px',
              borderRadius: '8px',
              width: '400px',
              boxShadow: '0 4px 8px rgba(0,0,0,0.2)',
              maxHeight: '80vh',
              overflowY: 'auto',
            }}
          >
            <h3 style={{ color: '#555', marginBottom: '20px', textAlign: 'center' }}>
              Add New Item
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '15px' }}>
              {/* Item */}
              <div style={{ position: 'relative' }}>
                <label style={{ fontWeight: 'bold', color: '#555', display: 'block', marginBottom: '5px' }}>
                  Item (required):
                </label>
                <input
                  type="text"
                  value={newReceiveItem.item}
                  ref={(el) => { inputRefs.current[9999] = el; }}
                  onChange={(e) => {
                    setNewReceiveItem({ ...newReceiveItem, item: e.target.value });
                    setFilteredItems(
                      items.filter((i) =>
                        i.name.toLowerCase().includes(e.target.value.toLowerCase())
                      )
                    );
                    setActiveItemDropdownIndex(9999);
                  }}
                  onFocus={() => {
                    setActiveItemDropdownIndex(9999);
                    setFilteredItems(items);
                  }}
                  onBlur={() => setTimeout(() => setActiveItemDropdownIndex(null), 200)}
                  placeholder="Type to search items"
                  style={{
                    width: '100%',
                    maxWidth: '300px',
                    padding: '10px',
                    border: '1px solid #ddd',
                    borderRadius: '4px',
                    fontSize: '16px',
                  }}
                />
                {activeItemDropdownIndex === 9999 && itemDropdownPosition && createPortal(
                  <ul className="typeahead">
                    {filteredItems.length > 0 ? (
                      filteredItems.map((filteredItem) => (
                        <li
                          key={filteredItem.name}
                          onMouseDown={() => {
                            setNewReceiveItem({
                              ...newReceiveItem,
                              item: filteredItem.name,
                              materialType: (filteredItem.type.charAt(0).toUpperCase() +
                                filteredItem.type.slice(1).toLowerCase()) as MaterialType,
                            });
                            setActiveItemDropdownIndex(null);
                          }}
                          className={newReceiveItem.item === filteredItem.name ? 'selected' : ''}
                        >
                          {filteredItem.name}
                        </li>
                      ))
                    ) : (
                      <li style={{ padding: '8px 10px', color: '#888', borderBottom: '1px solid #eee' }}>
                        No items found
                      </li>
                    )}
                    <li
                      onMouseDown={() => {
                        setNewItem(newReceiveItem.item);
                        setNewItemType(newReceiveItem.materialType);
                        setShowNewItemModal(true);
                        setActiveItemDropdownIndex(null);
                      }}
                      className="add-new"
                    >
                      Add New Item
                    </li>
                  </ul>,
                  document.getElementById('dropdown-portal') || document.body
                )}
              </div>
              {/* Site */}
              <div style={{ position: 'relative' }}>
                <label style={{ fontWeight: 'bold', color: '#555', display: 'block', marginBottom: '5px' }}>
                  Site (required):
                </label>
                <input
                  type="text"
                  value={
                    sites.find((s) => s.siteId === newReceiveItem.siteId)?.name || ''
                  }
                  ref={(el) => { siteInputRefs.current[9999] = el; }}
                  onChange={(e) => {
                    const value = e.target.value;
                    setNewReceiveItem({ ...newReceiveItem, siteId: '', locationId: '' });
                    setFilteredSites(
                      sites.filter((s) =>
                        s.name.toLowerCase().includes(value.toLowerCase())
                      )
                    );
                    setActiveSiteDropdownIndex(9999);
                  }}
                  onFocus={() => {
                    setActiveSiteDropdownIndex(9999);
                    setFilteredSites(sites);
                  }}
                  onBlur={() => setTimeout(() => setActiveSiteDropdownIndex(null), 200)}
                  placeholder="Type to search sites"
                  style={{
                    width: '100%',
                    maxWidth: '300px',
                    padding: '10px',
                    border: '1px solid #ddd',
                    borderRadius: '4px',
                    fontSize: '16px',
                  }}
                />
                {activeSiteDropdownIndex === 9999 && siteDropdownPosition && createPortal(
                  <ul className="typeahead">
                    {filteredSites.length > 0 ? (
                      filteredSites.map((site) => (
                        <li
                          key={site.siteId}
                          onMouseDown={() => {
                            setNewReceiveItem({
                              ...newReceiveItem,
                              siteId: site.siteId,
                              locationId: '',
                            });
                            fetchLocations(site.siteId, 9999);
                            setActiveSiteDropdownIndex(null);
                          }}
                          className={newReceiveItem.siteId === site.siteId ? 'selected' : ''}
                        >
                          {site.name}
                        </li>
                      ))
                    ) : (
                      <li style={{ padding: '8px 10px', color: '#888', borderBottom: '1px solid #eee' }}>
                        No sites found
                      </li>
                    )}
                    <li
                      onMouseDown={() => {
                        navigate('/sites', { state: { fromReceive: true } });
                        setActiveSiteDropdownIndex(null);
                      }}
                      className="add-new"
                    >
                      Add New Site
                    </li>
                  </ul>,
                  document.getElementById('dropdown-portal') || document.body
                )}
              </div>
              {/* Location */}
              <div style={{ position: 'relative' }}>
                <label style={{ fontWeight: 'bold', color: '#555', display: 'block', marginBottom: '5px' }}>
                  Location (required):
                </label>
                <input
                  type="text"
                  value={
                    newReceiveItem.locationId && rowLocations[9999]
                      ? rowLocations[9999].find(
                          (loc) => loc.locationId.toString() === newReceiveItem.locationId
                        )?.name || ''
                      : ''
                  }
                  ref={(el) => { locationInputRefs.current[9999] = el; }}
                  onChange={(e) => {
                    const value = e.target.value;
                    setRowFilteredLocations((prev) => {
                      const newFiltered = [...prev];
                      newFiltered[9999] =
                        rowLocations[9999]?.filter((loc) =>
                          loc.name.toLowerCase().includes(value.toLowerCase())
                        ) || [];
                      return newFiltered;
                    });
                    setActiveLocationDropdownIndex(9999);
                  }}
                  onFocus={() => {
                    if (!rowFetchingLocations[9999] && rowLocations[9999]?.length > 0) {
                      setActiveLocationDropdownIndex(9999);
                      setRowFilteredLocations((prev) => {
                        const newFiltered = [...prev];
                        newFiltered[9999] = rowLocations[9999] || [];
                        return newFiltered;
                      });
                    }
                  }}
                  onBlur={() => setTimeout(() => setActiveLocationDropdownIndex(null), 200)}
                  placeholder={
                    rowFetchingLocations[9999]
                      ? 'Loading locations...'
                      : newReceiveItem.siteId
                      ? 'Type to search locations'
                      : 'Select a site first'
                  }
                  disabled={!newReceiveItem.siteId || rowFetchingLocations[9999]}
                  style={{
                    width: '100%',
                    maxWidth: '300px',
                    padding: '10px',
                    border: '1px solid #ddd',
                    borderRadius: '4px',
                    fontSize: '16px',
                    backgroundColor:
                      !newReceiveItem.siteId || rowFetchingLocations[9999]
                        ? '#f5f5f5'
                        : '#fff',
                  }}
                />
                {activeLocationDropdownIndex === 9999 &&
                  !rowFetchingLocations[9999] &&
                  dropdownPosition && (
                    <>
                      {console.log('Location dropdown rendering:', {
                        locations: rowLocations[9999],
                        filtered: rowFilteredLocations[9999],
                      })}
                      {createPortal(
                        <ul className="typeahead">
                          {rowFilteredLocations[9999]?.length > 0 ? (
                            rowFilteredLocations[9999].map((location) => (
                              <li
                                key={location.locationId}
                                onMouseDown={() => {
                                  setNewReceiveItem({
                                    ...newReceiveItem,
                                    locationId: location.locationId.toString(),
                                  });
                                  setActiveLocationDropdownIndex(null);
                                }}
                                className={newReceiveItem.locationId === location.locationId.toString() ? 'selected' : ''}
                              >
                                {location.name}
                              </li>
                            ))
                          ) : (
                            <li style={{ padding: '8px 10px', color: '#888', borderBottom: '1px solid #eee' }}>
                              No locations found
                            </li>
                          )}
                          <li
                            onMouseDown={() => {
                              navigate('/locations', {
                                state: { fromReceive: true, siteId: newReceiveItem.siteId },
                              });
                              setActiveLocationDropdownIndex(null);
                            }}
                            className="add-new"
                          >
                            Add New Location
                          </li>
                        </ul>,
                        document.getElementById('dropdown-portal') || document.body
                      )}
                    </>
                  )}
              </div>
              {/* Material Type */}
              <div>
                <label style={{ fontWeight: 'bold', color: '#555', display: 'block', marginBottom: '5px' }}>
                  Material Type (required):
                </label>
                <select
                  value={newReceiveItem.materialType}
                  onChange={(e) =>
                    setNewReceiveItem({
                      ...newReceiveItem,
                      materialType: e.target.value as MaterialType,
                      proof: '',
                      account: Account.Storage,
                    })
                  }
                >
                  {Object.values(MaterialType).map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </div>
              {/* Quantity */}
              <div>
                <label style={{ fontWeight: 'bold', color: '#555', display: 'block', marginBottom: '5px' }}>
                  Quantity (required):
                </label>
                <input
                  type="number"
                  value={newReceiveItem.quantity}
                  onChange={(e) =>
                    setNewReceiveItem({ ...newReceiveItem, quantity: e.target.value })
                  }
                  step="0.01"
                  min="0"
                  style={{
                    width: '100%',
                    maxWidth: '300px',
                    padding: '10px',
                    border: '1px solid #ddd',
                    borderRadius: '4px',
                    fontSize: '16px',
                  }}
                />
              </div>
              {/* Unit */}
              <div>
                <label style={{ fontWeight: 'bold', color: '#555', display: 'block', marginBottom: '5px' }}>
                  Unit (required):
                </label>
                <select
                  value={newReceiveItem.unit}
                  onChange={(e) =>
                    setNewReceiveItem({
                      ...newReceiveItem,
                      unit: e.target.value as Unit,
                    })
                  }
                >
                  {Object.values(Unit).map((unit) => (
                    <option key={unit} value={unit}>
                      {unit}
                    </option>
                  ))}
                </select>
              </div>
              {/* Lot Number */}
              <div>
                <label style={{ fontWeight: 'bold', color: '#555', display: 'block', marginBottom: '5px' }}>
                  Lot Number:
                </label>
                <input
                  type="text"
                  value={newReceiveItem.lotNumber}
                  onChange={(e) =>
                    setNewReceiveItem({ ...newReceiveItem, lotNumber: e.target.value })
                  }
                  style={{
                    width: '100%',
                    maxWidth: '300px',
                    padding: '10px',
                    border: '1px solid #ddd',
                    borderRadius: '4px',
                    fontSize: '16px',
                  }}
                />
              </div>
              {/* Account (for Spirits) */}
              {newReceiveItem.materialType === MaterialType.Spirits && (
                <div>
                  <label style={{ fontWeight: 'bold', color: '#555', display: 'block', marginBottom: '5px' }}>
                    Account:
                  </label>
                  <select
                    value={newReceiveItem.account || Account.Storage}
                    onChange={(e) =>
                      setNewReceiveItem({
                        ...newReceiveItem,
                        account: e.target.value as Account,
                      })
                    }
                  >
                    <option value={Account.Storage}>Storage</option>
                    <option value={Account.Processing}>Processing</option>
                    <option value={Account.Production}>Production</option>
                  </select>
                </div>
              )}
              {/* Proof (for Spirits) */}
              {newReceiveItem.materialType === MaterialType.Spirits && (
                <div>
                  <label style={{ fontWeight: 'bold', color: '#555', display: 'block', marginBottom: '5px' }}>
                    Proof:
                  </label>
                  <input
                    type="number"
                    value={newReceiveItem.proof || ''}
                    onChange={(e) =>
                      setNewReceiveItem({ ...newReceiveItem, proof: e.target.value })
                    }
                    step="0.01"
                    min="0"
                    max="200"
                    style={{
                      width: '100%',
                      maxWidth: '300px',
                      padding: '10px',
                      border: '1px solid #ddd',
                      borderRadius: '4px',
                      fontSize: '16px',
                    }}
                  />
                </div>
              )}
              {/* Cost */}
              <div>
                <label style={{ fontWeight: 'bold', color: '#555', display: 'block', marginBottom: '5px' }}>
                  Cost:
                </label>
                <input
                  type="number"
                  value={newReceiveItem.cost || ''}
                  onChange={(e) =>
                    setNewReceiveItem({ ...newReceiveItem, cost: e.target.value })
                  }
                  step="0.01"
                  min="0"
                  style={{
                    width: '100%',
                    maxWidth: '300px',
                    padding: '10px',
                    border: '1px solid #ddd',
                    borderRadius: '4px',
                    fontSize: '16px',
                  }}
                />
              </div>
              {/* Description */}
              <div>
                <label style={{ fontWeight: 'bold', color: '#555', display: 'block', marginBottom: '5px' }}>
                  Description:
                </label>
                <input
                  type="text"
                  value={newReceiveItem.description || ''}
                  onChange={(e) =>
                    setNewReceiveItem({
                      ...newReceiveItem,
                      description: e.target.value,
                    })
                  }
                  placeholder={
                    newReceiveItem.materialType === MaterialType.Other
                      ? 'Required for Other'
                      : 'Optional'
                  }
                  style={{
                    width: '100%',
                    maxWidth: '300px',
                    padding: '10px',
                    border: '1px solid #ddd',
                    borderRadius: '4px',
                    fontSize: '16px',
                  }}
                />
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '20px' }}>
              <button
                onClick={() => {
                  // Validation
                  if (!newReceiveItem.item) {
                    setProductionError('Item is required');
                    return;
                  }
                  if (!newReceiveItem.siteId) {
                    setProductionError('Site is required');
                    return;
                  }
                  if (!newReceiveItem.locationId) {
                    setProductionError('Location is required');
                    return;
                  }
                  if (
                    newReceiveItem.materialType === MaterialType.Spirits &&
                    (!newReceiveItem.lotNumber || !newReceiveItem.proof)
                  ) {
                    setProductionError('Spirits require Lot Number and Proof');
                    return;
                  }
                  if (
                    newReceiveItem.materialType === MaterialType.Other &&
                    !newReceiveItem.description
                  ) {
                    setProductionError('Other items require a Description');
                    return;
                  }
                  if (
                    !newReceiveItem.quantity ||
                    isNaN(parseFloat(newReceiveItem.quantity)) ||
                    parseFloat(newReceiveItem.quantity) <= 0
                  ) {
                    setProductionError('Valid Quantity is required');
                    return;
                  }
                  if (
                    newReceiveItem.proof &&
                    (isNaN(parseFloat(newReceiveItem.proof)) ||
                      parseFloat(newReceiveItem.proof) > 200 ||
                      parseFloat(newReceiveItem.proof) < 0)
                  ) {
                    setProductionError('Proof must be between 0 and 200');
                    return;
                  }
                  if (
                    newReceiveItem.cost &&
                    (isNaN(parseFloat(newReceiveItem.cost)) ||
                      parseFloat(newReceiveItem.cost) < 0)
                  ) {
                    setProductionError('Cost must be non-negative');
                    return;
                  }
                  // Update rowLocations and rowFilteredLocations first
                  const newIndex = receiveItems.length;
                  setRowLocations((prev) => {
                    const newLocations = [...prev];
                    newLocations[newIndex] = rowLocations[9999] || [];
                    console.log(`Setting rowLocations[${newIndex}]:`, newLocations[newIndex]);
                    return newLocations;
                  });
                  setRowFilteredLocations((prev) => {
                    const newFiltered = [...prev];
                    newFiltered[newIndex] = rowFilteredLocations[9999] || [];
                    return newFiltered;
                  });
                  setRowFetchingLocations((prev) => {
                    const newFetching = [...prev];
                    newFetching[newIndex] = false;
                    return newFetching;
                  });
                  // Add to receiveItems
                  const newItem = {
                    ...newReceiveItem,
                    identifier: newReceiveItem.item || 'UNKNOWN_ITEM',
                  };
                  setReceiveItems((prev) => {
                    const updatedItems = [...prev, newItem];
                    console.log(`Added item to receiveItems[${newIndex}]:`, newItem);
                    return updatedItems;
                  });
                  // Reset modal state
                  setNewReceiveItem({
                    identifier: '',
                    item: '',
                    lotNumber: '',
                    materialType: MaterialType.Grain,
                    quantity: '',
                    unit: Unit.Pounds,
                    cost: '',
                    description: '',
                    siteId: '',
                    locationId: '',
                    account: Account.Storage,
                    proof: '',
                  });
                  // Clear modal location data
                  setRowLocations((prev) => {
                    const newLocations = [...prev];
                    newLocations[9999] = [];
                    return newLocations;
                  });
                  setRowFilteredLocations((prev) => {
                    const newFiltered = [...prev];
                    newFiltered[9999] = [];
                    return newFiltered;
                  });
                  setRowFetchingLocations((prev) => {
                    const newFetching = [...prev];
                    newFetching[9999] = false;
                    return newFetching;
                  });
                  setShowAddItemModal(false);
                  setProductionError(null);
                  setActiveItemDropdownIndex(null);
                  setActiveSiteDropdownIndex(null);
                  setActiveLocationDropdownIndex(null);
                }}
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
                Add
              </button>
              <button
                onClick={() => {
                  setShowAddItemModal(false);
                  setNewReceiveItem({
                    identifier: '',
                    item: '',
                    lotNumber: '',
                    materialType: MaterialType.Grain,
                    quantity: '',
                    unit: Unit.Pounds,
                    cost: '',
                    description: '',
                    siteId: '',
                    locationId: '',
                    account: Account.Storage,
                    proof: '',
                  });
                  setActiveItemDropdownIndex(null);
                  setActiveSiteDropdownIndex(null);
                  setActiveLocationDropdownIndex(null);
                  // Clear modal location data
                  setRowLocations((prev) => {
                    const newLocations = [...prev];
                    newLocations[9999] = [];
                    return newLocations;
                  });
                  setRowFilteredLocations((prev) => {
                    const newFiltered = [...prev];
                    newFiltered[9999] = [];
                    return newFiltered;
                  });
                  setRowFetchingLocations((prev) => {
                    const newFetching = [...prev];
                    newFetching[9999] = false;
                    return newFetching;
                  });
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
      {poItemToSplit && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 10000 }}>
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
                cost: '',
                description: '',
                siteId: selectedSite,
                locationId: '',
                account: Account.Storage,
                proof: '',
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