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

interface PurchaseOrdersResponse {
  purchaseOrders: PurchaseOrder[];
  totalPages: number;
}

interface Item {
  name: string;
  type: string;
  enabled: number;
}

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:10000';

const ReceivePage: React.FC<ReceivePageProps> = ({ refreshInventory, vendors, refreshVendors }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const locationState = location.state as { newSiteId?: string; newLocationId?: string };
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const siteInputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const locationInputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const [selectedSite, setSelectedSite] = useState<string>(locationState?.newSiteId || '');
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
    siteId: locationState?.newSiteId || selectedSite || '',
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
  const [siteDropdownPosition, setSiteDropdownPosition] = useState<{ top: number; left: number } | null>(null);
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
  const [showMultipleItemsModal, setShowMultipleItemsModal] = useState(false);
  const [showSingleItemCloneModal, setShowSingleItemCloneModal] = useState(false);

  const fetchLocations = useCallback(async (siteId: string): Promise<void> => {
    if (!siteId) {
      setLocations([]);
      setFilteredLocations([]);
      setIsFetchingLocations(false);
      console.log('No siteId provided for fetchLocations');
      return;
    }

    setIsFetchingLocations(true);
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        console.error('fetchLocations: No token found, redirecting to login');
        navigate('/login');
        throw new Error('No token found in localStorage');
      }
      const url = `${API_BASE_URL}/api/locations?siteId=${encodeURIComponent(siteId)}`;
      console.log(`Fetching locations from: ${url}`);
      const res = await fetch(url, {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });
      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`HTTP error! status: ${res.status}, body: ${errorText}`);
      }
      const data: Location[] = await res.json();
      console.log(`Fetched locations for site ${siteId}:`, data);
      if (data.length === 0) {
        console.warn(`No locations returned for siteId ${siteId}`);
        setProductionError(`No locations found for site ${siteId}`);
      }
      setLocations(data);
      setFilteredLocations(data);
      setIsFetchingLocations(false);
    } catch (err: any) {
      console.error(`Fetch locations error for siteId ${siteId}:`, err);
      setProductionError(`Failed to fetch locations for site ${siteId}: ${err.message}`);
      setLocations([]);
      setFilteredLocations([]);
      setIsFetchingLocations(false);
    }
  }, [API_BASE_URL, navigate]);

  const fetchSites = useCallback(async () => {
  try {
    const token = localStorage.getItem('token');
    if (!token) {
      console.error('fetchSites: No token found, redirecting to login');
      navigate('/login');
      throw new Error('No token found in localStorage');
    }
    const url = `${API_BASE_URL}/api/sites`;
    console.log(`Fetching sites from: ${url}`);
    const res = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
    });
    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`HTTP error! status: ${res.status}, body: ${errorText}`);
    }
    const data: Site[] = await res.json() || [];
    console.log('Fetched sites:', data);
    if (data.length === 0) {
      console.warn('No sites returned from API');
      setProductionError('No sites found');
    }
    setSites(data);
    setFilteredSites(data);
    // Only set selectedSite and singleForm.siteId if not already set
    if (!selectedSite && !singleForm.siteId && !locationState?.newSiteId) {
      const newSiteId = data.length > 0 ? data[0].siteId : '';
      setSelectedSite(newSiteId);
      setSingleForm((prev) => ({ ...prev, siteId: newSiteId }));
      if (newSiteId) fetchLocations(newSiteId);
    }
  } catch (err: any) {
    console.error('Fetch sites error:', err);
    setProductionError('Failed to fetch sites: ' + err.message);
    setSites([]);
    setFilteredSites([]);
  }
}, [API_BASE_URL, navigate, locationState, selectedSite, singleForm.siteId, fetchLocations]);

  useEffect(() => {
    console.log('ReceivePage useEffect: Fetching initial data');
    
    const fetchItems = async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token) {
          console.error('fetchItems: No token found, redirecting to login');
          navigate('/login');
          throw new Error('No token found in localStorage');
        }
        const res = await fetch(`${API_BASE_URL}/api/items`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        if (!res.ok) {
          const errorText = await res.text();
          throw new Error(`HTTP error! status: ${res.status}, body: ${errorText}`);
        }
        const data = await res.json();
        console.log('Fetched items:', data);
        setItems(data);
        setFilteredItems(data);
      } catch (err: any) {
        setProductionError('Failed to fetch items: ' + err.message);
        console.error('fetchItems error:', err);
      }
    };

    const fetchVendors = async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token) {
          console.error('fetchVendors: No token found, redirecting to login');
          navigate('/login');
          throw new Error('No token found in localStorage');
        }
        const res = await fetch(`${API_BASE_URL}/api/vendors`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        if (!res.ok) {
          const errorText = await res.text();
          throw new Error(`HTTP error! status: ${res.status}, body: ${errorText}`);
        }
        const data = await res.json();
        console.log('Fetched vendors:', data);
        setFilteredVendors(data);
      } catch (err: any) {
        setProductionError('Failed to fetch vendors: ' + err.message);
        console.error('fetchVendors error:', err);
      }
    };

    fetchSites();
    fetchItems();
    fetchVendors();
  }, [fetchSites, navigate]);

  useEffect(() => {
  console.log('Fetching POs for source:', singleForm.source);
    const fetchPOs = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        console.error('fetchPOs: No token found, redirecting to login');
        navigate('/login');
        throw new Error('No token found in localStorage');
      }
      const encodedSource = encodeURIComponent(singleForm.source || '');
      const res = await fetch(`${API_BASE_URL}/api/purchase-orders?supplier=${encodedSource}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`HTTP error! status: ${res.status}, body: ${errorText}`);
      }
      const response: PurchaseOrdersResponse = await res.json(); // Type the response
      const data: PurchaseOrder[] = response.purchaseOrders || []; // Safely access purchaseOrders
      console.log('Fetched purchase orders:', data);
      setPurchaseOrders(data);
    } catch (err: any) {
      console.error('fetchPOs error:', err);
      setPurchaseOrders([]); // Set empty array on error
      if (err.message.includes('no table exist')) {
        // Suppress table not found error
      } else {
        setProductionError('Failed to fetch purchase orders: ' + err.message);
      }
    }
  };
  if (singleForm.source) fetchPOs();
}, [singleForm.source, navigate]);

  useEffect(() => {
    console.log('ReceivePage useEffect: Handling navigation state', location.state);
    const locationState = location.state as { fromLocations?: boolean; fromSites?: boolean; newLocationId?: string; newSiteId?: string };
    if (locationState?.fromLocations || locationState?.fromSites) {
      setTimeout(() => {
        navigate(location.pathname, { replace: true, state: {} });
      }, 0);
    }
    if (locationState?.newLocationId) {
      setSingleForm((prev) => ({ ...prev, locationId: locationState.newLocationId || '' }));
    }
    if (locationState?.newSiteId) {
      setSelectedSite(locationState.newSiteId);
      setSingleForm((prev) => ({ ...prev, siteId: locationState.newSiteId || '' }));
    }
  }, [location.state, navigate]);

  useEffect(() => {
    inputRefs.current = inputRefs.current.slice(0, receiveItems.length);
    locationInputRefs.current = locationInputRefs.current.slice(0, receiveItems.length);
  }, [receiveItems]);

  useEffect(() => {
    if (showSingleItemCloneModal) {
      console.log('Cloned Single Item Modal opened, setting filteredSites:', sites);
      setFilteredSites(sites);
    }
  }, [showSingleItemCloneModal, sites]);

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
        return { ...prev, siteId: selectedSite, locationId: '' };
      }
      return prev;
    });
  }, [selectedSite]);

  useEffect(() => {
    if (
      activeLocationDropdownIndex !== null &&
      locationInputRefs.current[activeLocationDropdownIndex] &&
      activeItemDropdownIndex === null
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
      activeLocationDropdownIndex === null
    ) {
      const input = inputRefs.current[activeItemDropdownIndex];
      const rect = input!.getBoundingClientRect();
      setDropdownPosition({
        top: rect.bottom + window.scrollY,
        left: rect.left + window.scrollX,
      });
    } else {
      setDropdownPosition(null);
    }
  }, [activeItemDropdownIndex, activeLocationDropdownIndex]);

  const calculateTotal = useMemo(() => {
    let total = 0;
    if (useSingleItem) {
      const singleCost = parseFloat(singleForm.cost || '0');
      total += isNaN(singleCost) ? 0 : singleCost;
    } else {
      const itemsTotal = receiveItems.reduce((sum, item) => {
        const cost = parseFloat(item.cost || '0');
        return sum + (isNaN(cost) ? 0 : cost);
      }, 0);
      total += itemsTotal;
      const chargesTotal = otherCharges.reduce((sum, charge) => {
        const cost = parseFloat(charge.cost || '0');
        return sum + (isNaN(cost) ? 0 : cost);
      }, 0);
      total += chargesTotal;
    }
    return total.toFixed(2);
  }, [useSingleItem, singleForm.cost, receiveItems, otherCharges]);

  const handleVendorInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSingleForm((prev: ReceiveForm) => ({ ...prev, source: value }));
    setFilteredVendors(vendors.filter(v => v.name.toLowerCase().includes(value.toLowerCase())));
    setShowVendorSuggestions(true);
  };

  const handleVendorSelect = (vendor: Vendor) => {
    console.log('Selecting vendor:', vendor.name, 'Current site:', selectedSite, 'Current form:', singleForm);
    setSingleForm((prev: ReceiveForm) => ({ ...prev, source: vendor.name }));
    setShowVendorSuggestions(false);
  };

  const handleItemSelect = (selectedItem: Item, index?: number) => {
    const normalizedType = selectedItem.type ? selectedItem.type.charAt(0).toUpperCase() + selectedItem.type.slice(1).toLowerCase() : 'Other';
    const materialType = Object.values(MaterialType).includes(normalizedType as MaterialType) ? normalizedType as MaterialType : MaterialType.Other;
    const defaultUnit = materialType === MaterialType.Spirits ? Unit.Gallons : Unit.Pounds;
    console.log('handleItemSelect:', { selectedItem, materialType, defaultUnit, index });
    if (useSingleItem || showSingleItemCloneModal) {
      setSingleForm((prev: ReceiveForm) => ({
        ...prev,
        identifier: selectedItem.name,
        item: selectedItem.name,
        materialType,
        unit: defaultUnit,
        lotNumber: materialType === MaterialType.Spirits ? prev.lotNumber || '' : undefined,
        proof: materialType === MaterialType.Spirits ? prev.proof || '' : undefined,
        account: materialType === MaterialType.Spirits ? prev.account || Account.Storage : undefined,
      }));
    } else if (index !== undefined) {
      const updatedItems = [...receiveItems];
      updatedItems[index] = {
        ...updatedItems[index],
        identifier: selectedItem.name,
        item: selectedItem.name,
        materialType,
        unit: defaultUnit,
        lotNumber: materialType === MaterialType.Spirits ? updatedItems[index].lotNumber || '' : undefined,
        proof: materialType === MaterialType.Spirits ? updatedItems[index].proof || '' : undefined,
        account: materialType === MaterialType.Spirits ? updatedItems[index].account || Account.Storage : undefined,
        locationId: updatedItems[index].locationId || '',
      };
      setReceiveItems(updatedItems);
    }
    setActiveItemDropdownIndex(null);
    setFilteredItems(items);
  };

  const handleLocationSelect = (location: Location, index?: number) => {
    console.log('handleLocationSelect:', { location, index });
    if (useSingleItem || showSingleItemCloneModal) {
      setSingleForm((prev: ReceiveForm) => {
        const updatedForm = {
          ...prev,
          locationId: location.locationId.toString(),
        };
        console.log('Updated singleForm.locationId:', updatedForm);
        return updatedForm;
      });
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
        item: item.name || 'UNKNOWN_ITEM',
        materialType: item.materialType,
        quantity: item.quantity.toString(),
        unit: Unit.Pounds,
        cost: '',
        description: item.materialType === MaterialType.Other ? '' : undefined,
        siteId: selectedSite,
        locationId: '',
        account: undefined,
        proof: undefined,
        poNumber: undefined,
        lotNumber: undefined,
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
        identifier: item.item || poItemToSplit.name,
        item: item.item || poItemToSplit.name,
        materialType: MaterialType.Spirits,
        quantity: item.quantity,
        unit: Unit.Gallons,
        cost: '',
        description: undefined,
        siteId: selectedSite,
        locationId: item.locationId || '',
        account: item.account || Account.Storage,
        proof: item.proof || '',
        poNumber: selectedPO || undefined,
        lotNumber: item.lotNumber || '',
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
      const token = localStorage.getItem('token');
      if (!token) {
        console.error('handleCreateItem: No token found, redirecting to login');
        navigate('/login');
        throw new Error('No token found in localStorage');
      }
      const res = await fetch(`${API_BASE_URL}/api/items`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ name: newItem, type: newItemType }),
      });
      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`HTTP error! status: ${res.status}, body: ${errorText}`);
      }
      const updatedItems = [...items, { name: newItem, type: newItemType, enabled: 1 }];
      setItems(updatedItems);
      setFilteredItems(updatedItems);
      const defaultUnit = newItemType === MaterialType.Spirits ? Unit.Gallons : Unit.Pounds;
      if (useSingleItem) {
        setSingleForm((prev: ReceiveForm) => ({
          ...prev,
          identifier: newItem,
          item: newItem,
          materialType: newItemType,
          unit: defaultUnit,
          lotNumber: newItemType === MaterialType.Spirits ? prev.lotNumber || '' : undefined,
          proof: newItemType === MaterialType.Spirits ? prev.proof || '' : undefined,
          account: newItemType === MaterialType.Spirits ? Account.Storage : undefined,
        }));
      } else {
        setReceiveItems([...receiveItems, {
          identifier: newItem,
          item: newItem,
          materialType: newItemType,
          quantity: '',
          unit: defaultUnit,
          cost: '',
          description: newItemType === MaterialType.Other ? '' : undefined,
          siteId: selectedSite,
          locationId: '',
          account: newItemType === MaterialType.Spirits ? Account.Storage : undefined,
          proof: newItemType === MaterialType.Spirits ? '' : undefined,
          poNumber: newItemType === MaterialType.Spirits ? '' : undefined,
          lotNumber: newItemType === MaterialType.Spirits ? '' : undefined,
        }]);
      }
      setNewItem('');
      setNewItemType(MaterialType.Grain);
      setShowNewItemModal(false);
      setProductionError(null);
    } catch (err: any) {
      setProductionError('Failed to create item: ' + err.message);
      console.error('handleCreateItem error:', err);
    }
  };

  // In ReceivePage.tsx, update the handleReceive function to swap item and description for spirits

  const handleReceive = async (items?: ReceiveItem[]) => {
    const itemsToReceive: ReceiveItem[] = items || (useSingleItem ? [singleForm as ReceiveItem] : receiveItems);
    if (useSingleItem) {
      console.log('Single Item Receive:', singleForm);
    } else {
      console.log('Multiple Items Receive:', itemsToReceive);
    }

    if (
      !itemsToReceive.length ||
      itemsToReceive.some(
        (item) =>
          !item.identifier ||
          !item.item ||
          !item.materialType ||
          !item.quantity ||
          !item.unit ||
          !item.siteId ||
          !item.locationId ||
          item.locationId.trim() === ''
      )
    ) {
      setProductionError('All inventory items must have Identifier, Item, Material Type, Quantity, Unit, Site, and Location');
      return;
    }
    const invalidItems = itemsToReceive.filter(
      (item) =>
        (item.materialType === MaterialType.Spirits &&
          (!item.lotNumber || !item.lotNumber.trim() || !item.proof || !item.proof.trim() || !item.account)) ||
        (item.materialType === MaterialType.Other && (!item.description || !item.description.trim())) ||
        isNaN(parseFloat(item.quantity)) ||
        parseFloat(item.quantity) <= 0 ||
        (item.proof && (isNaN(parseFloat(item.proof)) || parseFloat(item.proof) > 200 || parseFloat(item.proof) < 0)) ||
        (item.cost && (isNaN(parseFloat(item.cost)) || parseFloat(item.cost) < 0))
    );
    if (invalidItems.length) {
      setProductionError(
        'Invalid data: Spirits need lot number, proof, and account; Other needs description; numeric values must be valid'
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
      const finalAccount = item.materialType === MaterialType.Spirits ? item.account : undefined;
      const finalStatus = ['Grain', 'Hops'].includes(item.materialType) ? Status.Stored : Status.Received;

      let finalItem = item.item;
      let finalDescription = item.description;
      let finalIdentifier = item.identifier;
      let finalLotNumber = item.lotNumber;

      if (item.materialType === MaterialType.Spirits) {
        // Swap for spirits: item becomes lotNumber, description becomes original item name
        finalItem = item.lotNumber || 'UNKNOWN_LOT';
        finalDescription = item.item; // Original item name as description
        finalIdentifier = item.lotNumber || 'UNKNOWN_LOT'; // Use lotNumber as identifier for uniqueness
        finalLotNumber = undefined; // Optional: since item is now lotNumber, maybe clear this
      }

      return {
        identifier: finalIdentifier,
        item: finalItem,
        account: finalAccount,
        type: item.materialType,
        quantity: item.quantity,
        unit: item.unit,
        proof: item.proof,
        proofGallons: item.proof ? (parseFloat(item.quantity) * (parseFloat(item.proof) / 100)).toFixed(2) : undefined,
        receivedDate: singleForm.receivedDate,
        source: singleForm.source || 'Unknown',
        siteId: item.siteId || singleForm.siteId,
        locationId: parseInt(item.locationId, 10),
        status: finalStatus,
        description: finalDescription,
        cost: finalUnitCost,
        totalCost: finalTotalCost,
        poNumber: item.poNumber,
        lotNumber: finalLotNumber,
      };
    });

    console.log('Payload to /api/inventory/receive:', JSON.stringify(itemsToReceive.length === 1 ? inventoryItems[0] : inventoryItems, null, 2));

    try {
      const token = localStorage.getItem('token');
      if (!token) {
        console.error('handleReceive: No token found, redirecting to login');
        navigate('/login');
        throw new Error('No token found in localStorage');
      }
      const res = await fetch(`${API_BASE_URL}/api/inventory/receive`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(itemsToReceive.length === 1 ? inventoryItems[0] : inventoryItems),
      });
      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`HTTP error! status: ${res.status}, body: ${errorText}`);
      }
      setSuccessMessage('Items received successfully!');
      await refreshInventory();
      setTimeout(() => {
        setSuccessMessage(null);
        setShowMultipleItemsModal(false);
        setReceiveItems([]);
        navigate('/inventory');
      }, 1000);
    } catch (err: any) {
      setProductionError('Failed to receive items: ' + err.message);
      console.error('Receive error:', err);
    }
  };

return (
    <div style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto', minHeight: '100vh', overflowY: 'auto' }}>
      <div style={{ backgroundColor: '#fff', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)', padding: '20px', marginBottom: '20px', display: 'flex', flexDirection: 'column' }}>
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
            onClick={() => {
              setUseSingleItem(false);
              setShowMultipleItemsModal(true);
              setReceiveItems([]);
              setOtherCharges([]);
            }}
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

        {useSingleItem && (
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
                  if (value === '') {
                    setSelectedSite('');
                    setSingleForm((prev) => ({ ...prev, siteId: '', locationId: '' }));
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
              {showSiteSuggestions && Array.isArray(filteredSites) && (
                <ul className="typeahead">
                  {filteredSites.map((site) => (
                    <li
                      key={site.siteId}
                      onMouseDown={() => {
                        console.log('Selected site:', { siteId: site.siteId, siteName: site.name });
                        setSelectedSite(site.siteId);
                        setSingleForm((prev) => ({ ...prev, siteId: site.siteId, locationId: '' }));
                        setShowSiteSuggestions(false);
                        fetchLocations(site.siteId);
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
            {showLocationSuggestions && !isFetchingLocations && Array.isArray(filteredLocations) && (
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
            <label style={{ fontWeight: 'bold', color: '#555', display: 'block', marginBottom: '5px' }}>Vendor (optional):</label>
            <input
              type="text"
              value={singleForm.source}
              onChange={handleVendorInputChange}
              placeholder="Type to search vendors"
              onFocus={() => setShowVendorSuggestions(true)}
              onBlur={() => setTimeout(() => setShowVendorSuggestions(false), 300)}
              style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '4px', boxSizing: 'border-box', fontSize: '16px' }}
            />
            {showVendorSuggestions && Array.isArray(filteredVendors) && (
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
            <label style={{ fontWeight: 'bold', color: '#555', display: 'block', marginBottom: '5px' }}>Item (required):</label>
            <input
              type="text"
              value={singleForm.item}
              onChange={(e) => {
                const value = e.target.value;
                console.log('Item input change:', { value });
                setSingleForm((prev: ReceiveForm) => ({ ...prev, item: value, identifier: value }));
                setFilteredItems(items.filter(i => i.name.toLowerCase().includes(value.toLowerCase())));
                setActiveItemDropdownIndex(0);
              }}
              onFocus={() => {
                setActiveItemDropdownIndex(0);
                setFilteredItems(items);
              }}
              onBlur={() => setTimeout(() => setActiveItemDropdownIndex(null), 300)}
              placeholder="Type to search items"
              style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '4px', boxSizing: 'border-box', fontSize: '16px' }}
            />
            {activeItemDropdownIndex === 0 && Array.isArray(filteredItems) && (
              <ul className="typeahead">
                {filteredItems.length > 0 ? (
                  filteredItems.map((item) => (
                    <li
                      key={item.name}
                      onMouseDown={() => handleItemSelect(item)}
                      className={singleForm.item === item.name ? 'selected' : ''}
                    >
                      {item.name}
                    </li>
                  ))
                ) : (
                  <li style={{ padding: '8px 10px', color: '#888', borderBottom: '1px solid #eee' }}>
                    No items found
                  </li>
                )}
                <li
                  onMouseDown={() => setShowNewItemModal(true)}
                  className="add-new"
                >
                  Add New Item
                </li>
              </ul>
            )}
          </div>
          {singleForm.materialType === MaterialType.Spirits && (
            <div>
              <label style={{ fontWeight: 'bold', color: '#555', display: 'block', marginBottom: '5px' }}>Lot Number (required):</label>
              <input
                type="text"
                value={singleForm.lotNumber || ''}
                onChange={(e) => setSingleForm((prev: ReceiveForm) => ({ ...prev, lotNumber: e.target.value }))}
                style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '4px', boxSizing: 'border-box', fontSize: '16px' }}
              />
            </div>
          )}
          <div>
            <label style={{ fontWeight: 'bold', color: '#555', display: 'block', marginBottom: '5px' }}>Material Type:</label>
            <select
              value={singleForm.materialType}
              onChange={(e) => setSingleForm((prev: ReceiveForm) => ({
                ...prev,
                materialType: e.target.value as MaterialType,
                lotNumber: e.target.value === MaterialType.Spirits ? prev.lotNumber || '' : undefined,
                proof: e.target.value === MaterialType.Spirits ? prev.proof || '' : undefined,
                account: e.target.value === MaterialType.Spirits ? prev.account || Account.Storage : undefined,
                unit: e.target.value === MaterialType.Spirits ? Unit.Gallons : Unit.Pounds,
              }))}
              style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '4px', fontSize: '16px' }}
            >
              {Object.values(MaterialType).map(type => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
          </div>
          <div>
            <label style={{ fontWeight: 'bold', color: '#555', display: 'block', marginBottom: '5px' }}>Quantity (required):</label>
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
              style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '4px', fontSize: '16px' }}
            >
              {Object.values(Unit).map(unit => (
                <option key={unit} value={unit}>{unit}</option>
              ))}
            </select>
          </div>
          {singleForm.materialType === MaterialType.Spirits && (
            <>
              <div>
                <label style={{ fontWeight: 'bold', color: '#555', display: 'block', marginBottom: '5px' }}>Account (required):</label>
                <select
                  value={singleForm.account || ''}
                  onChange={(e) => setSingleForm((prev: ReceiveForm) => ({ ...prev, account: e.target.value as Account }))}
                  style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '4px', fontSize: '16px' }}
                >
                  <option value="">Select Account</option>
                  <option value={Account.Storage}>Storage</option>
                  <option value={Account.Processing}>Processing</option>
                  <option value={Account.Production}>Production</option>
                </select>
              </div>
              <div>
                <label style={{ fontWeight: 'bold', color: '#555', display: 'block', marginBottom: '5px' }}>Proof (required):</label>
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
              <label style={{ fontWeight: 'bold', color: '#555', display: 'block', marginBottom: '5px' }}>Description (required):</label>
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
              style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '4px', fontSize: '16px' }}
            >
              <option value="">Select PO (optional)</option>
              {Array.isArray(purchaseOrders) && purchaseOrders.map(po => (
                <option key={po.poNumber} value={po.poNumber}>{po.poNumber}</option>
              ))}
            </select>
          </div>
          <div style={{ gridColumn: 'span 2', textAlign: 'center' }}>
            <button
              onClick={() => handleReceive([singleForm as ReceiveItem])}
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
      )}

      {showMultipleItemsModal && (
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
              width: '600px',
              maxHeight: '80vh',
              overflowY: 'auto',
              boxShadow: '0 4px 8px rgba(0,0,0,0.2)',
            }}
          >
            <h3 style={{ color: '#555', marginBottom: '20px', textAlign: 'center' }}>
              Add Multiple Items
            </h3>
            <div style={{ position: 'relative', marginBottom: '20px' }}>
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
            <div style={{ marginBottom: '20px' }}>
              <label style={{ fontWeight: 'bold', color: '#555', display: 'block', marginBottom: '5px' }}>Received Date:</label>
              <input
                type="date"
                value={singleForm.receivedDate}
                onChange={(e) => setSingleForm((prev: ReceiveForm) => ({ ...prev, receivedDate: e.target.value }))}
                style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '4px', boxSizing: 'border-box', fontSize: '16px' }}
              />
            </div>
            <div style={{ marginBottom: '20px' }}>
              <label style={{ fontWeight: 'bold', color: '#555', display: 'block', marginBottom: '5px' }}>PO Number (optional):</label>
              <select
                value={singleForm.poNumber || ''}
                onChange={(e) => {
                  const poNumber = e.target.value;
                  setSingleForm((prev: ReceiveForm) => ({ ...prev, poNumber }));
                  if (poNumber) handlePOSelect(poNumber);
                }}
                style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '4px', fontSize: '16px' }}
              >
                <option value="">Select PO (optional)</option>
                {Array.isArray(purchaseOrders) && purchaseOrders.map(po => (
                  <option key={po.poNumber} value={po.poNumber}>{po.poNumber}</option>
                ))}
              </select>
            </div>
            <div style={{ marginBottom: '20px' }}>
              <button
                onClick={() => {
                  setShowSingleItemCloneModal(true);
                  setSingleForm({
                    identifier: '',
                    item: '',
                    lotNumber: '',
                    materialType: MaterialType.Grain,
                    quantity: '',
                    unit: Unit.Pounds,
                    cost: '',
                    description: '',
                    siteId: selectedSite || '',
                    locationId: '',
                    account: Account.Storage,
                    proof: '',
                    source: singleForm.source || '',
                    dspNumber: '',
                    receivedDate: singleForm.receivedDate,
                    poNumber: singleForm.poNumber || '',
                  });
                  if (selectedSite) {
                    fetchLocations(selectedSite);
                  }
                }}
                style={{
                  backgroundColor: '#2196F3',
                  color: '#fff',
                  padding: '10px 20px',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '16px',
                }}
              >
                Add Item
              </button>
              <h4 style={{ color: '#555', marginBottom: '10px' }}>Items</h4>
              {receiveItems.length === 0 ? (
                <p style={{ color: '#888', textAlign: 'center' }}>No items added yet</p>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      <th style={{ border: '1px solid #ddd', padding: '8px', backgroundColor: '#f5f5f5' }}>Item</th>
                      <th style={{ border: '1px solid #ddd', padding: '8px', backgroundColor: '#f5f5f5' }}>Site</th>
                      <th style={{ border: '1px solid #ddd', padding: '8px', backgroundColor: '#f5f5f5' }}>Location</th>
                      <th style={{ border: '1px solid #ddd', padding: '8px', backgroundColor: '#f5f5f5' }}>Quantity</th>
                      <th style={{ border: '1px solid #ddd', padding: '8px', backgroundColor: '#f5f5f5' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {receiveItems.map((item, index) => (
                      <tr key={index}>
                        <td style={{ border: '1px solid #ddd', padding: '8px' }}>{item.item}</td>
                        <td style={{ border: '1px solid #ddd', padding: '8px' }}>
                          {sites.find((s) => s.siteId === item.siteId)?.name || item.siteId}
                        </td>
                        <td style={{ border: '1px solid #ddd', padding: '8px' }}>
                          {locations.find((loc) => loc.locationId.toString() === item.locationId)?.name || item.locationId}
                        </td>
                        <td style={{ border: '1px solid #ddd', padding: '8px' }}>{item.quantity} {item.unit}</td>
                        <td style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'center' }}>
                          <button
                            onClick={() => setReceiveItems(receiveItems.filter((_, i) => i !== index))}
                            style={{
                              backgroundColor: '#F86752',
                              color: '#fff',
                              padding: '6px 12px',
                              border: 'none',
                              borderRadius: '4px',
                              cursor: 'pointer',
                              fontSize: '14px',
                            }}
                          >
                            Remove
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
            <div style={{ marginBottom: '20px' }}>
              <h4 style={{ color: '#555', marginBottom: '10px' }}>Other Charges</h4>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={{ border: '1px solid #ddd', padding: '8px', backgroundColor: '#f5f5f5' }}>Description</th>
                    <th style={{ border: '1px solid #ddd', padding: '8px', backgroundColor: '#f5f5f5' }}>Cost</th>
                    <th style={{ border: '1px solid #ddd', padding: '8px', backgroundColor: '#f5f5f5' }}>Action</th>
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
                          style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
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
                          style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
                        />
                      </td>
                      <td style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'center' }}>
                        <button
                          onClick={() => setOtherCharges(otherCharges.filter((_, i) => i !== index))}
                          style={{
                            backgroundColor: '#F86752',
                            color: '#fff',
                            padding: '6px 12px',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '14px',
                          }}
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
                  padding: '8px 16px',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  marginTop: '10px',
                }}
              >
                Add Charge
              </button>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
              <button
                onClick={() => handleReceive(receiveItems)}
                disabled={receiveItems.length === 0}
                style={{
                  backgroundColor: receiveItems.length === 0 ? '#ccc' : '#2196F3',
                  color: '#fff',
                  padding: '10px 20px',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: receiveItems.length === 0 ? 'not-allowed' : 'pointer',
                  fontSize: '16px',
                }}
              >
                Receive Items
              </button>
            </div>
            <div style={{ textAlign: 'center' }}>
              <button
                onClick={() => {
                  setShowMultipleItemsModal(false);
                  setReceiveItems([]);
                  setOtherCharges([]);
                }}
                style={{
                  backgroundColor: '#F86752',
                  color: '#fff',
                  padding: '10px 20px',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '16px',
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {showSingleItemCloneModal && (
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
            zIndex: 10001,
          }}
        >
          <div
            style={{
              backgroundColor: '#fff',
              padding: '20px',
              borderRadius: '8px',
              width: '600px',
              maxHeight: '80vh',
              overflowY: 'auto',
              boxShadow: '0 4px 8px rgba(0,0,0,0.2)',
            }}
          >
            <h3 style={{ color: '#555', marginBottom: '20px', textAlign: 'center' }}>
              Add Item
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
              <div style={{ position: 'relative' }}>
                <label style={{ fontWeight: 'bold', color: '#555', display: 'block', marginBottom: '5px' }}>
                  Site (required):
                </label>
                <input
                  type="text"
                  value={sites.find((s) => s.siteId === singleForm.siteId)?.name || ''}
                  onChange={(e) => {
                    const value = e.target.value;
                    setFilteredSites(
                      sites.filter((s) => s.name.toLowerCase().includes(value.toLowerCase()))
                    );
                    setShowSiteSuggestions(true);
                    if (!sites.find((s) => s.name.toLowerCase() === value.toLowerCase())) {
                      setSelectedSite('');
                      setSingleForm((prev) => ({ ...prev, siteId: '', locationId: '' }));
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
                {showSiteSuggestions && Array.isArray(filteredSites) && (
                  <ul className="typeahead">
                    {filteredSites.map((site) => (
                      <li
                        key={site.siteId}
                        onMouseDown={() => {
                          console.log('Selected site:', { siteId: site.siteId, siteName: site.name });
                          setSelectedSite(site.siteId);
                          setSingleForm((prev) => ({ ...prev, siteId: site.siteId, locationId: '' }));
                          setShowSiteSuggestions(false);
                          fetchLocations(site.siteId);
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
                  disabled={isFetchingLocations || !singleForm.siteId}
                  style={{
                    width: '100%',
                    padding: '10px',
                    border: '1px solid #ddd',
                    borderRadius: '4px',
                    boxSizing: 'border-box',
                    fontSize: '16px',
                    backgroundColor: isFetchingLocations || !singleForm.siteId ? '#f5f5f5' : '#fff',
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
                        No locations available for this site
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
                <label style={{ fontWeight: 'bold', color: '#555', display: 'block', marginBottom: '5px' }}>Vendor (optional):</label>
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
                <label style={{ fontWeight: 'bold', color: '#555', display: 'block', marginBottom: '5px' }}>Item (required):</label>
                <input
                  type="text"
                  value={singleForm.item}
                  onChange={(e) => {
                    const value = e.target.value;
                    console.log('Item input change:', { value });
                    setSingleForm((prev: ReceiveForm) => ({ ...prev, item: value, identifier: value }));
                    setFilteredItems(items.filter(i => i.name.toLowerCase().includes(value.toLowerCase())));
                    setActiveItemDropdownIndex(0);
                  }}
                  onFocus={() => {
                    setActiveItemDropdownIndex(0);
                    setFilteredItems(items);
                  }}
                  onBlur={() => setTimeout(() => setActiveItemDropdownIndex(null), 300)}
                  placeholder="Type to search items"
                  style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '4px', boxSizing: 'border-box', fontSize: '16px' }}
                />
                {activeItemDropdownIndex === 0 && (
                  <ul className="typeahead">
                    {filteredItems.length > 0 ? (
                      filteredItems.map((item) => (
                        <li
                          key={item.name}
                          onMouseDown={() => handleItemSelect(item)}
                          className={singleForm.item === item.name ? 'selected' : ''}
                        >
                          {item.name}
                        </li>
                      ))
                    ) : (
                      <li style={{ padding: '8px 10px', color: '#888', borderBottom: '1px solid #eee' }}>
                        No items found
                      </li>
                    )}
                    <li
                      onMouseDown={() => setShowNewItemModal(true)}
                      className="add-new"
                    >
                      Add New Item
                    </li>
                  </ul>
                )}
              </div>
              {singleForm.materialType === MaterialType.Spirits && (
                <div>
                  <label style={{ fontWeight: 'bold', color: '#555', display: 'block', marginBottom: '5px' }}>Lot Number (required):</label>
                  <input
                    type="text"
                    value={singleForm.lotNumber || ''}
                    onChange={(e) => setSingleForm((prev: ReceiveForm) => ({ ...prev, lotNumber: e.target.value }))}
                    style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '4px', boxSizing: 'border-box', fontSize: '16px' }}
                  />
                </div>
              )}
              <div>
                <label style={{ fontWeight: 'bold', color: '#555', display: 'block', marginBottom: '5px' }}>Material Type:</label>
                <select
                  value={singleForm.materialType}
                  onChange={(e) => setSingleForm((prev: ReceiveForm) => ({
                    ...prev,
                    materialType: e.target.value as MaterialType,
                    lotNumber: e.target.value === MaterialType.Spirits ? prev.lotNumber || '' : undefined,
                    proof: e.target.value === MaterialType.Spirits ? prev.proof || '' : undefined,
                    account: e.target.value === MaterialType.Spirits ? prev.account || Account.Storage : undefined,
                    unit: e.target.value === MaterialType.Spirits ? Unit.Gallons : Unit.Pounds,
                  }))}
                  style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '4px', fontSize: '16px' }}
                >
                  {Object.values(MaterialType).map(type => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={{ fontWeight: 'bold', color: '#555', display: 'block', marginBottom: '5px' }}>Quantity (required):</label>
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
                  style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '4px', fontSize: '16px' }}
                >
                  {Object.values(Unit).map(unit => (
                    <option key={unit} value={unit}>{unit}</option>
                  ))}
                </select>
              </div>
              {singleForm.materialType === MaterialType.Spirits && (
                <>
                  <div>
                    <label style={{ fontWeight: 'bold', color: '#555', display: 'block', marginBottom: '5px' }}>Account (required):</label>
                    <select
                      value={singleForm.account || ''}
                      onChange={(e) => setSingleForm((prev: ReceiveForm) => ({ ...prev, account: e.target.value as Account }))}
                      style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '4px', fontSize: '16px' }}
                    >
                      <option value="">Select Account</option>
                      <option value={Account.Storage}>Storage</option>
                      <option value={Account.Processing}>Processing</option>
                      <option value={Account.Production}>Production</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ fontWeight: 'bold', color: '#555', display: 'block', marginBottom: '5px' }}>Proof (required):</label>
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
                  <label style={{ fontWeight: 'bold', color: '#555', display: 'block', marginBottom: '5px' }}>Description (required):</label>
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
                  style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '4px', fontSize: '16px' }}
                >
                  <option value="">Select PO (optional)</option>
                  {Array.isArray(purchaseOrders) && purchaseOrders.map(po => (
                    <option key={po.poNumber} value={po.poNumber}>{po.poNumber}</option>
                  ))}
                </select>
              </div>
              <div style={{ gridColumn: 'span 2', textAlign: 'center', display: 'flex', justifyContent: 'space-between' }}>
                <button
                  onClick={() => {
                    if (!singleForm.item) {
                      setProductionError('Item is required');
                      return;
                    }
                    if (!singleForm.siteId) {
                      setProductionError('Site is required');
                      return;
                    }
                    if (!singleForm.locationId) {
                      setProductionError('Location is required');
                      return;
                    }
                    if (
                      singleForm.materialType === MaterialType.Spirits &&
                      (!singleForm.lotNumber || !singleForm.proof || !singleForm.account)
                    ) {
                      setProductionError('Spirits require Lot Number, Proof, and Account');
                      return;
                    }
                    if (
                      singleForm.materialType === MaterialType.Other &&
                      !singleForm.description
                    ) {
                      setProductionError('Other items require a Description');
                      return;
                    }
                    if (
                      !singleForm.quantity ||
                      isNaN(parseFloat(singleForm.quantity)) ||
                      parseFloat(singleForm.quantity) <= 0
                    ) {
                      setProductionError('Valid Quantity is required');
                      return;
                    }
                    if (
                      singleForm.proof &&
                      (isNaN(parseFloat(singleForm.proof)) ||
                        parseFloat(singleForm.proof) > 200 ||
                        parseFloat(singleForm.proof) < 0)
                    ) {
                      setProductionError('Proof must be between 0 and 200');
                      return;
                    }
                    if (
                      singleForm.cost &&
                      (isNaN(parseFloat(singleForm.cost)) ||
                        parseFloat(singleForm.cost) < 0)
                    ) {
                      setProductionError('Cost must be non-negative');
                      return;
                    }
                    const newItem: ReceiveItem = {
                      identifier: singleForm.identifier || 'UNKNOWN_ITEM',
                      item: singleForm.item || 'UNKNOWN_ITEM',
                      materialType: singleForm.materialType,
                      quantity: singleForm.quantity,
                      unit: singleForm.unit,
                      cost: singleForm.cost || '0',
                      description: singleForm.description,
                      siteId: singleForm.siteId,
                      locationId: singleForm.locationId,
                      account: singleForm.materialType === MaterialType.Spirits ? singleForm.account : undefined,
                      proof: singleForm.materialType === MaterialType.Spirits ? singleForm.proof : undefined,
                      poNumber: singleForm.materialType === MaterialType.Spirits ? singleForm.poNumber : undefined,
                      lotNumber: singleForm.materialType === MaterialType.Spirits ? singleForm.lotNumber : undefined,
                    };
                    setReceiveItems((prev) => {
                      const updatedItems = [...prev, newItem];
                      console.log('Added item to receiveItems:', newItem);
                      return updatedItems;
                    });
                    setSingleForm({
                      identifier: '',
                      item: '',
                      lotNumber: '',
                      materialType: MaterialType.Grain,
                      quantity: '',
                      unit: Unit.Pounds,
                      cost: '',
                      description: '',
                      siteId: selectedSite || '',
                      locationId: '',
                      account: Account.Storage,
                      proof: '',
                      source: singleForm.source || '',
                      dspNumber: '',
                      receivedDate: singleForm.receivedDate,
                      poNumber: singleForm.poNumber || '',
                    });
                    setShowSingleItemCloneModal(false);
                    setProductionError(null);
                    setShowSiteSuggestions(false);
                    setShowLocationSuggestions(false);
                    setActiveItemDropdownIndex(null);
                  }}
                  style={{
                    backgroundColor: '#2196F3',
                    color: '#fff',
                    padding: '12px 24px',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '16px',
                    width: '45%',
                    transition: 'background-color 0.3s',
                  }}
                  onMouseOver={(e) => (e.currentTarget.style.backgroundColor = '#1976D2')}
                  onMouseOut={(e) => (e.currentTarget.style.backgroundColor = '#2196F3')}
                >
                  Add
                </button>
                <button
                  onClick={() => {
                    setShowSingleItemCloneModal(false);
                    setSingleForm({
                      identifier: '',
                      item: '',
                      lotNumber: '',
                      materialType: MaterialType.Grain,
                      quantity: '',
                      unit: Unit.Pounds,
                      cost: '',
                      description: '',
                      siteId: selectedSite || '',
                      locationId: '',
                      account: Account.Storage,
                      proof: '',
                      source: singleForm.source || '',
                      dspNumber: '',
                      receivedDate: singleForm.receivedDate,
                      poNumber: singleForm.poNumber || '',
                    });
                    setShowSiteSuggestions(false);
                    setShowLocationSuggestions(false);
                    setActiveItemDropdownIndex(null);
                  }}
                  style={{
                    backgroundColor: '#F86752',
                    color: '#fff',
                    padding: '12px 24px',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '16px',
                    width: '45%',
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
              style={{ width: '100%', padding: '10px', marginBottom: '15px', border: '1px solid #ddd', borderRadius: '4px', fontSize: '16px' }}
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
                description: undefined,
                siteId: selectedSite,
                locationId: '',
                account: Account.Storage,
                proof: '',
                poNumber: selectedPO || undefined,
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