// src/components/BatchDetails.tsx (Part 1)
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Batch, Product, Site, Equipment, Ingredient, Location, InventoryItem, PackagingAction, BatchDetailsProps } from '../types/interfaces';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import '../App.css';
import 'bootstrap/dist/css/bootstrap.min.css';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:3000';

declare module 'jspdf' {
  interface jsPDF {
    autoTable: (options: any) => jsPDF;
    lastAutoTable: { finalY: number };
  }
}

interface BatchAction {
  id: number;
  action: string;
  timestamp: string;
}

const BatchDetails: React.FC<BatchDetailsProps> = ({ inventory, refreshInventory }) => {
  const { batchId } = useParams<{ batchId: string }>();
  const navigate = useNavigate();
  const [batch, setBatch] = useState<Batch | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [items, setItems] = useState<{ name: string; type: string; enabled: number }[]>([]);
  const [actions, setActions] = useState<BatchAction[]>([]);
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [selectedEquipmentId, setSelectedEquipmentId] = useState<number | null>(null);
  const [newAction, setNewAction] = useState('');
  const [newBatchId, setNewBatchId] = useState('');
  const [newIngredient, setNewIngredient] = useState<Ingredient>({ itemName: '', quantity: 0, unit: 'lbs' });
  const [newIngredients, setNewIngredients] = useState<Ingredient[]>([{ itemName: '', quantity: 0, unit: 'lbs' }]);
  const [stage, setStage] = useState<'' | 'Brewing' | 'Fermentation' | 'Filtering/Carbonating' | 'Packaging' | 'Completed'>('');
  const [packageType, setPackageType] = useState<string>('');
  const [packageTypes, setPackageTypes] = useState<{ name: string; volume: number; enabled: number }[]>([]);
  const [productPackageTypes, setProductPackageTypes] = useState<string[]>([]);
  const [packageQuantity, setPackageQuantity] = useState<number>(0);
  const [packageLocation, setPackageLocation] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [pendingDeletions, setPendingDeletions] = useState<Set<string>>(new Set());
  const [showVolumePrompt, setShowVolumePrompt] = useState<{ message: string; shortfall: number } | null>(null);
  const [showLossPrompt, setShowLossPrompt] = useState<{ volume: number } | null>(null);
  const [packagingActions, setPackagingActions] = useState<PackagingAction[]>([]);
  const [editPackaging, setEditPackaging] = useState<PackagingAction | null>(null);
  const [showKegPrompt, setShowKegPrompt] = useState<boolean>(false);
  const [kegCodes, setKegCodes] = useState<string[]>([]);
  const [currentKegCode, setCurrentKegCode] = useState('');
  const [manualKegEntry, setManualKegEntry] = useState(false);
  const packageVolumes: { [key: string]: number } = {
    '1/2 BBL Keg': 0.5,
    '1/6 BBL Keg': 0.167,
    '750ml Bottle': 0.006,
  };
  const validStages = ['Brewing', 'Fermentation', 'Filtering/Carbonating', 'Packaging', 'Completed'];

  useEffect(() => {
    const fetchData = async () => {
      try {
        const endpoints = [
          { url: `${API_BASE_URL}/api/batches/${batchId}`, setter: setBatch, name: 'batch', single: true },
          { url: `${API_BASE_URL}/api/products`, setter: setProducts, name: 'products' },
          { url: `${API_BASE_URL}/api/sites`, setter: setSites, name: 'sites' },
          { url: `${API_BASE_URL}/api/items`, setter: setItems, name: 'items' },
          { url: `${API_BASE_URL}/api/batches/${batchId}/actions`, setter: setActions, name: 'actions' },
          { url: `${API_BASE_URL}/api/batches/${batchId}/package`, setter: setPackagingActions, name: 'packaging' },
          { url: `${API_BASE_URL}/api/package-types`, setter: setPackageTypes, name: 'packageTypes' },
        ].filter(endpoint => endpoint.url !== null);

        const responses = await Promise.all(
          endpoints.map(({ url }) => fetch(url, { headers: { Accept: 'application/json' } }))
        );

        for (let i = 0; i < responses.length; i++) {
          const res = responses[i];
          const { name, setter, single } = endpoints[i];
          if (!res.ok) {
            const text = await res.text();
            throw new Error(`Failed to fetch ${name}: HTTP ${res.status}, Response: ${text.slice(0, 50)}`);
          }
          const contentType = res.headers.get('content-type');
          if (!contentType || !contentType.includes('application/json')) {
            const text = await res.text();
            throw new Error(`Invalid response for ${name}: Expected JSON, got ${contentType}`);
          }
          const data = await res.json();
if (name === 'batch') {
  console.log(`[BatchDetails] Fetched batch ${batchId}:`, { ingredients: data.ingredients, recipeId: data.recipeId });
}
setter(single ? data : data);
        }
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        setError('Failed to load batch details: ' + errorMessage);
      }
    };
    fetchData();
  }, [batchId]);

  // src/components/BatchDetails.tsx (Part 2)
  useEffect(() => {
    if (batch && products.length > 0) {
      const product = products.find((p: Product) => p.id === batch.productId);
      if (product && product.packageTypes) {
        setProductPackageTypes(product.packageTypes.map((pt: { type: string }) => pt.type));
      }
    }
  }, [batch, products]);

  useEffect(() => {
    if (!batch?.siteId) return;
    const fetchSiteData = async () => {
      try {
        const endpoints = [
          { url: `${API_BASE_URL}/api/equipment?siteId=${batch.siteId}`, setter: setEquipment, name: 'equipment' },
          { url: `${API_BASE_URL}/api/locations?siteId=${batch.siteId}`, setter: setLocations, name: 'locations' },
        ];
        const responses = await Promise.all(
          endpoints.map(({ url }) => fetch(url, { headers: { Accept: 'application/json' } }))
        );
        for (let i = 0; i < responses.length; i++) {
          const res = responses[i];
          const { name, setter } = endpoints[i];
          if (!res.ok) {
            const text = await res.text();
            throw new Error(`Failed to fetch ${name}: HTTP ${res.status}, Response: ${text.slice(0, 50)}`);
          }
          const contentType = res.headers.get('content-type');
          if (!contentType || !contentType.includes('application/json')) {
            const text = await res.text();
            throw new Error(`Invalid response for ${name}: Expected JSON, got ${contentType}`);
          }
          const data = await res.json();
          setter(data);
        }
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        setError('Failed to load site data: ' + errorMessage);
      }
    };
    fetchSiteData();
  }, [batch?.siteId]);

  const handleAddKegCode = async () => {
    if (!currentKegCode || !/^[A-Z0-9-]+$/.test(currentKegCode)) {
      setError('Valid keg code (e.g., KEG-001) required');
      return;
    }
    try {
      const res = await fetch(`${API_BASE_URL}/api/kegs/${currentKegCode}`, { headers: { Accept: 'application/json' } });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Keg not found: HTTP ${res.status}, ${text}`);
      }
      const keg = await res.json();
      if (keg.status !== 'Empty') {
        setError(`Keg ${currentKegCode} is not empty`);
        return;
      }
      if (kegCodes.includes(currentKegCode)) {
        setError(`Keg ${currentKegCode} already added`);
        return;
      }
      setKegCodes([...kegCodes, currentKegCode]);
      setCurrentKegCode('');
      setError(null);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError('Failed to add keg: ' + errorMessage);
    }
  };

  const handlePackage = async (skipKegPrompt: boolean = false) => {
    if (!packageType || packageQuantity <= 0 || !packageLocation) {
      setError('Please select a package type, quantity (> 0), and location');
      return;
    }
    if (packageType.includes('Keg') && kegCodes.length === 0 && !skipKegPrompt) {
      setShowKegPrompt(true);
      return;
    }
    try {
      const res = await fetch(`${API_BASE_URL}/api/batches/${batchId}/package`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          packageType,
          quantity: packageQuantity,
          locationId: packageLocation,
          kegCodes: packageType.includes('Keg') ? kegCodes : [],
        }),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Failed to package: HTTP ${res.status}, Response: ${text.slice(0, 50)}`);
      }
      const data = await res.json();
      if (data.prompt === 'volumeAdjustment') {
        setShowVolumePrompt({ message: data.message, shortfall: data.shortfall });
        return;
      }
      const batchRes = await fetch(`${API_BASE_URL}/api/batches/${batchId}`, {
        headers: { Accept: 'application/json' },
      });
      if (!batchRes.ok) {
        throw new Error(`Failed to refresh batch: HTTP ${batchRes.status}`);
      }
      const updatedBatch = await batchRes.json();
      setBatch(updatedBatch);
      const packagingRes = await fetch(`${API_BASE_URL}/api/batches/${batchId}/package`, {
        headers: { Accept: 'application/json' },
      });
      if (packagingRes.ok) {
        setPackagingActions(await packagingRes.json());
      }
      await refreshInventory();
      setPackageType('');
      setPackageQuantity(0);
      setPackageLocation('');
      setKegCodes([]);
      setShowKegPrompt(false);
      setSuccessMessage(data.message || 'Packaged successfully');
      setTimeout(() => setSuccessMessage(null), 2000);
      setError(null);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError('Failed to package: ' + errorMessage);
    }
  };

// src/components/BatchDetails.tsx (Part 3)
  const handleVolumeAdjustment = async (confirm: boolean) => {
    if (!showVolumePrompt) return;
    if (!confirm) {
      setShowVolumePrompt(null);
      setError('Packaging cancelled due to insufficient volume');
      return;
    }
    try {
      const res = await fetch(`${API_BASE_URL}/api/batches/${batchId}/adjust-volume`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ shortfall: showVolumePrompt.shortfall }),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Failed to adjust volume: HTTP ${res.status}, Response: ${text.slice(0, 50)}`);
      }
      const packageRes = await fetch(`${API_BASE_URL}/api/batches/${batchId}/package`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          packageType,
          quantity: packageQuantity,
          locationId: packageLocation,
          kegCodes: packageType.includes('Keg') ? kegCodes : [],
        }),
      });
      if (!packageRes.ok) {
        const text = await packageRes.text();
        throw new Error(`Failed to package after adjustment: HTTP ${packageRes.status}, Response: ${text.slice(0, 50)}`);
      }
      const data = await packageRes.json();
      const batchRes = await fetch(`${API_BASE_URL}/api/batches/${batchId}`, {
        headers: { Accept: 'application/json' },
      });
      if (!batchRes.ok) {
        throw new Error('Failed to refresh batch');
      }
      const updatedBatch = await batchRes.json();
      setBatch(updatedBatch);
      await refreshInventory();
      setPackageType('');
      setPackageQuantity(0);
      setPackageLocation('');
      setKegCodes([]);
      setShowVolumePrompt(null);
      setSuccessMessage(data.message || 'Packaged successfully after volume adjustment');
      setTimeout(() => setSuccessMessage(null), 2000);
      setError(null);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError('Failed to adjust volume or package: ' + errorMessage);
    }
  };

  const handleAddAction = async () => {
    if (!newAction) {
      setError('Action description is required');
      return;
    }
    try {
      const res = await fetch(`${API_BASE_URL}/api/batches/${batchId}/actions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ action: newAction }),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Failed to add action: HTTP ${res.status}, Response: ${text.slice(0, 50)}`);
      }
      const addedAction = await res.json();
      setActions([...actions, addedAction]);
      setNewAction('');
      setError(null);
      setSuccessMessage('Action added successfully');
      setTimeout(() => setSuccessMessage(null), 2000);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError('Failed to add action: ' + errorMessage);
    }
  };

  const handleCompleteBatch = async () => {
    if (!batch) return;
    if (batch.volume !== undefined && batch.volume > 0) {
      setShowLossPrompt({ volume: batch.volume });
      return;
    }
    try {
      const res = await fetch(`${API_BASE_URL}/api/batches/${batchId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ status: 'Completed', stage: 'Completed', equipmentId: null }),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Failed to complete batch: HTTP ${res.status}, Response: ${text.slice(0, 50)}`);
      }
      setBatch((prev) => prev ? { ...prev, status: 'Completed', stage: 'Completed', equipmentId: null } : null);
      setError(null);
      setSuccessMessage('Batch completed successfully');
      setTimeout(() => setSuccessMessage(null), 2000);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError('Failed to complete batch: ' + errorMessage);
    }
  };

  const handleLossConfirmation = async (confirm: boolean) => {
    if (!showLossPrompt || !batch) return;
    if (!confirm) {
      setShowLossPrompt(null);
      try {
        const res = await fetch(`${API_BASE_URL}/api/batches/${batchId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({ status: 'Completed', stage: 'Completed', equipmentId: null }),
        });
        if (!res.ok) {
          const text = await res.text();
          throw new Error(`Failed to complete batch: HTTP ${res.status}, Response: ${text.slice(0, 50)}`);
        }
        setBatch((prev) => prev ? { ...prev, status: 'Completed', stage: 'Completed', equipmentId: null } : null);
        setSuccessMessage('Batch completed without recording loss');
        setTimeout(() => setSuccessMessage(null), 2000);
        setError(null);
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        setError('Failed to complete batch: ' + errorMessage);
      }
      return;
    }
    try {
      const lossPayload = {
        identifier: batch.batchId,
        quantityLost: showLossPrompt.volume,
        proofGallonsLost: 0,
        reason: 'Fermentation loss due to trub/spillage',
        date: new Date().toISOString().split('T')[0],
        dspNumber: 'DSP-AL-20010',
      };
      const res = await fetch(`${API_BASE_URL}/api/record-loss`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(lossPayload),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Failed to record loss: HTTP ${res.status}, Response: ${text.slice(0, 50)}`);
      }
      const updateRes = await fetch(`${API_BASE_URL}/api/batches/${batchId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ volume: 0 }),
      });
      if (!updateRes.ok) {
        const text = await updateRes.text();
        throw new Error(`Failed to update batch volume: HTTP ${updateRes.status}, Response: ${text.slice(0, 50)}`);
      }
      const completeRes = await fetch(`${API_BASE_URL}/api/batches/${batchId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ status: 'Completed', stage: 'Completed', equipmentId: null }),
      });
      if (!completeRes.ok) {
        const text = await completeRes.text();
        throw new Error(`Failed to complete batch: HTTP ${completeRes.status}, Response: ${text.slice(0, 50)}`);
      }
      setBatch((prev) => prev ? { ...prev, status: 'Completed', stage: 'Completed', equipmentId: null, volume: 0 } : null);
      setShowLossPrompt(null);
      setSuccessMessage('Loss recorded and batch completed');
      setTimeout(() => setSuccessMessage(null), 2000);
      setError(null);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError('Failed to record loss or complete batch: ' + errorMessage);
    }
  };

  const handleEditBatchName = async () => {
    if (!newBatchId) {
      setError('New batch ID is required');
      return;
    }
    try {
      const res = await fetch(`${API_BASE_URL}/api/batches/${batchId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ batchId: newBatchId }),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Failed to update batch ID: HTTP ${res.status}, Response: ${text.slice(0, 50)}`);
      }
      setBatch((prev) => prev ? { ...prev, batchId: newBatchId } : null);
      setNewBatchId('');
      setError(null);
      setSuccessMessage('Batch ID updated successfully');
      setTimeout(() => {
        setSuccessMessage(null);
        navigate(`/production/${newBatchId}`);
      }, 2000);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError('Failed to update batch ID: ' + errorMessage);
    }
  };

  const handleDeleteBatch = async () => {
    if (!window.confirm('Are you sure you want to delete this batch?')) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/batches/${batchId}`, {
        method: 'DELETE',
        headers: { Accept: 'application/json' },
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Failed to delete batch: HTTP ${res.status}, Response: ${text.slice(0, 50)}`);
      }
      setError(null);
      setSuccessMessage('Batch deleted successfully');
      setTimeout(() => {
        setSuccessMessage(null);
        navigate('/production');
      }, 2000);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError('Failed to delete batch: ' + errorMessage);
    }
  };

  const handleAddIngredient = async () => {
    if (!newIngredient.itemName || newIngredient.quantity <= 0 || !newIngredient.unit) {
      setError('Valid item, quantity, and unit are required');
      return;
    }
    try {
      const res = await fetch(`${API_BASE_URL}/api/batches/${batchId}/ingredients`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(newIngredient),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Failed to add ingredient: HTTP ${res.status}, Response: ${text.slice(0, 50)}`);
      }
      const updatedBatch = await res.json();
      setBatch(updatedBatch);
      setNewIngredient({ itemName: '', quantity: 0, unit: 'lbs' });
      setError(null);
      setSuccessMessage('Ingredient added successfully');
      setTimeout(() => setSuccessMessage(null), 2000);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError('Failed to add ingredient: ' + errorMessage);
    }
  };

  const handleUpdateIngredient = async (original: Ingredient, updated: Ingredient) => {
    if (!original.itemName || !original.quantity || !original.unit ||
        !updated.itemName || updated.quantity <= 0 || !updated.unit) {
      setError('Valid original and updated item, quantity, and unit are required');
      return;
    }
    try {
      const res = await fetch(`${API_BASE_URL}/api/batches/${batchId}/ingredients`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ original, updated }),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Failed to update ingredient: HTTP ${res.status}, Response: ${text.slice(0, 50)}`);
      }
      const updatedBatch = await res.json();
      setBatch(updatedBatch);
      setNewIngredients(newIngredients.map(ing => 
        ing.itemName === original.itemName && ing.quantity === original.quantity && ing.unit === original.unit ? updated : ing
      ));
      setError(null);
      setSuccessMessage('Ingredient updated successfully');
      setTimeout(() => setSuccessMessage(null), 2000);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError('Failed to update ingredient: ' + errorMessage);
    }
  };

  const handleDeleteIngredient = async (ingredient: Ingredient) => {
    if (!ingredient.itemName || !ingredient.quantity || !ingredient.unit) {
      setError('Valid item, quantity, and unit are required for deletion');
      return;
    }
    try {
      const res = await fetch(`${API_BASE_URL}/api/batches/${batchId}/ingredients`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(ingredient),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Failed to delete ingredient: HTTP ${res.status}, Response: ${text.slice(0, 50)}`);
      }
      const updatedBatch = await res.json();
      setBatch(updatedBatch);
      setNewIngredients(newIngredients.filter(ing => 
        !(ing.itemName === ingredient.itemName && ing.quantity === ingredient.quantity && ing.unit === ingredient.unit)
      ));
      setError(null);
      setSuccessMessage('Ingredient deleted successfully');
      setTimeout(() => setSuccessMessage(null), 2000);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError('Failed to delete ingredient: ' + errorMessage);
    }
  };

  const handleUpdateEquipment = async () => {
    if (!selectedEquipmentId || !stage) {
      setError('Equipment and stage are required');
      return;
    }
    try {
      const res = await fetch(`${API_BASE_URL}/api/batches/${batchId}/equipment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ equipmentId: selectedEquipmentId, stage }),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Failed to update equipment: HTTP ${res.status}, Response: ${text.slice(0, 50)}`);
      }
      const data = await res.json();
      setBatch((prev) => prev ? { ...prev, equipmentId: data.equipmentId, stage: data.stage } : null);
      setSelectedEquipmentId(null);
      setStage('');
      setError(null);
      setSuccessMessage('Equipment and stage updated successfully');
      setTimeout(() => setSuccessMessage(null), 2000);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError('Failed to update equipment: ' + errorMessage);
    }
  };

  const handleEditPackaging = async () => {
    if (!editPackaging || editPackaging.quantity < 0) {
      setError('Valid quantity is required');
      return;
    }
    try {
      const res = await fetch(`${API_BASE_URL}/api/batches/${batchId}/package/${editPackaging.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ quantity: editPackaging.quantity }),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Failed to update packaging: HTTP ${res.status}, Response: ${text.slice(0, 50)}`);
      }
      const data = await res.json();
      const batchRes = await fetch(`${API_BASE_URL}/api/batches/${batchId}`, {
        headers: { Accept: 'application/json' },
      });
      if (!batchRes.ok) {
        throw new Error('Failed to refresh batch');
      }
      const updatedBatch = await batchRes.json();
      setBatch(updatedBatch);
      const packagingRes = await fetch(`${API_BASE_URL}/api/batches/${batchId}/package`, {
        headers: { Accept: 'application/json' },
      });
      if (packagingRes.ok) {
        setPackagingActions(await packagingRes.json());
      }
      await refreshInventory();
      setEditPackaging(null);
      setSuccessMessage('Packaging updated successfully');
      setTimeout(() => setSuccessMessage(null), 2000);
      setError(null);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError('Failed to update packaging: ' + errorMessage);
    }
  };

  const handleDeletePackaging = async (pkg: PackagingAction) => {
    if (pendingDeletions.has(pkg.id.toString())) return;
    setPendingDeletions(prev => new Set(prev).add(pkg.id.toString()));
    try {
      const res = await fetch(`${API_BASE_URL}/api/batches/${batchId}/package/${pkg.id}`, {
        method: 'DELETE',
        headers: { Accept: 'application/json' },
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Failed to delete packaging: HTTP ${res.status}, Response: ${text.slice(0, 50)}`);
      }
      const batchRes = await fetch(`${API_BASE_URL}/api/batches/${batchId}`, {
        headers: { Accept: 'application/json' },
      });
      if (!batchRes.ok) {
        throw new Error('Failed to refresh batch');
      }
      const updatedBatch = await batchRes.json();
      setBatch(updatedBatch);
      const packagingRes = await fetch(`${API_BASE_URL}/api/batches/${batchId}/package`, {
        headers: { Accept: 'application/json' },
      });
      if (packagingRes.ok) {
        setPackagingActions(await packagingRes.json());
      }
      await refreshInventory();
      setSuccessMessage('Packaging deleted successfully');
      setTimeout(() => setSuccessMessage(null), 2000);
      setError(null);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError('Failed to delete packaging: ' + errorMessage);
    } finally {
      setPendingDeletions(prev => {
        const newSet = new Set(prev);
        newSet.delete(pkg.id.toString());
        return newSet;
      });
    }
  };
  // src/components/BatchDetails.tsx (Part 4)
  const handlePrintBatchSheet = () => {
    if (!batch) return;
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.width;
    const margin = 10;
    const contentWidth = pageWidth - 2 * margin;

    doc.setFontSize(18);
    doc.text('Batch Sheet', margin, 20);
    doc.setFontSize(12);
    doc.text(`Batch ID: ${batch.batchId}`, margin, 30);
    doc.text(`Product: ${batch.productName || 'N/A'}`, margin, 40);
    doc.text(`Site: ${batch.siteName || 'N/A'}`, margin, 50);
    doc.text(`Status: ${batch.status}`, margin, 60);
    doc.text(`Date: ${batch.date}`, margin, 70);
    doc.text(`Volume: ${batch.volume ? batch.volume.toFixed(3) : 'N/A'} barrels`, margin, 80);
    doc.text(`Stage: ${batch.stage || 'N/A'}`, margin, 90);

    let yPos = 100;
    if (batch.ingredients && batch.ingredients.length > 0) {
      doc.text('Ingredients:', margin, yPos);
      yPos += 10;
      doc.autoTable({
        startY: yPos,
        head: [['Item', 'Quantity', 'Unit', 'Source']],
        body: batch.ingredients.map(ing => [
          ing.itemName,
          ing.quantity.toString(),
          ing.unit,
          ing.isRecipe ? 'Recipe' : 'Additional'
        ]),
        theme: 'striped',
        headStyles: { fillColor: [33, 150, 243], textColor: 255 },
        margin: { left: margin, right: margin },
        columnStyles: {
          0: { cellWidth: contentWidth * 0.4 },
          1: { cellWidth: contentWidth * 0.2 },
          2: { cellWidth: contentWidth * 0.2 },
          3: { cellWidth: contentWidth * 0.2 },
        },
        styles: { fontSize: 8 },
      });
      yPos = doc.lastAutoTable.finalY + 10;
    }

    if (actions.length > 0) {
      doc.text('Actions:', margin, yPos);
      yPos += 10;
      doc.autoTable({
        startY: yPos,
        head: [['Timestamp', 'Action']],
        body: actions.map(action => [action.timestamp, action.action]),
        theme: 'striped',
        headStyles: { fillColor: [33, 150, 243], textColor: 255 },
        margin: { left: margin, right: margin },
        columnStyles: {
          0: { cellWidth: contentWidth * 0.3 },
          1: { cellWidth: contentWidth * 0.7 },
        },
        styles: { fontSize: 8 },
      });
      yPos = doc.lastAutoTable.finalY + 10;
    }

    if (packagingActions.length > 0) {
      doc.text('Packaging Actions:', margin, yPos);
      yPos += 10;
      doc.autoTable({
        startY: yPos,
        head: [['Date', 'Package Type', 'Quantity', 'Volume (barrels)', 'Location', 'Keg Codes']],
        body: packagingActions.map(pkg => [
          pkg.date,
          pkg.packageType,
          pkg.quantity.toString(),
          pkg.volume.toFixed(3),
          locations.find(loc => loc.locationId === pkg.locationId)?.name || pkg.locationId,
          pkg.keg_codes ? JSON.parse(pkg.keg_codes).join(', ') : 'N/A'
        ]),
        theme: 'striped',
        headStyles: { fillColor: [33, 150, 243], textColor: 255 },
        margin: { left: margin, right: margin },
        columnStyles: {
          0: { cellWidth: contentWidth * 0.15 },
          1: { cellWidth: contentWidth * 0.15 },
          2: { cellWidth: contentWidth * 0.15 },
          3: { cellWidth: contentWidth * 0.15 },
          4: { cellWidth: contentWidth * 0.2 },
          5: { cellWidth: contentWidth * 0.2 },
        },
        styles: { fontSize: 8 },
      });
    }

    doc.save(`Batch_${batch.batchId}_Sheet.pdf`);
  };

  if (!batch) {
    return <div>Loading...</div>;
  }

  return (
    <div className="page-container container">
      <h2 className="text-warning mb-4">Batch {batch.batchId}</h2>
      {error && <div className="alert alert-danger">{error}</div>}
      {successMessage && (
        <div className="alert alert-success">{successMessage}</div>
      )}
      <div className="row mb-4">
        <div className="col-md-6">
          <h3 className="text-warning mb-3">Batch Details</h3>
          <p><strong>Product:</strong> {batch.productName || 'N/A'}</p>
          <p><strong>Site:</strong> {batch.siteName || 'N/A'}</p>
          <p><strong>Status:</strong> {batch.status}</p>
          <p><strong>Date:</strong> {batch.date}</p>
          <p><strong>Volume:</strong> {batch.volume ? batch.volume.toFixed(3) : 'N/A'} barrels</p>
          <p><strong>Stage:</strong> {batch.stage || 'N/A'}</p>
          <p><strong>Equipment:</strong> {equipment.find(e => e.equipmentId === batch.equipmentId)?.name || 'N/A'}</p>
          {batch.status !== 'Completed' && (
            <div className="mt-3">
              <h4 className="text-warning mb-2">Update Batch ID</h4>
              <div className="d-flex gap-2 align-items-center">
                <input
                  type="text"
                  value={newBatchId}
                  onChange={(e) => setNewBatchId(e.target.value)}
                  placeholder="New Batch ID"
                  className="form-control"
                  style={{ maxWidth: '200px' }}
                />
                <button className="btn btn-primary" onClick={handleEditBatchName}>
                  Update ID
                </button>
              </div>
            </div>
          )}
        </div>
        <div className="col-md-6">
          <h3 className="text-warning mb-3">Actions</h3>
          <div className="d-flex gap-2 mb-3 flex-wrap">
            <button className="btn btn-primary" onClick={handlePrintBatchSheet}>
              Print Batch Sheet
            </button>
            {batch.status !== 'Completed' && (
              <>
                <button className="btn btn-success" onClick={handleCompleteBatch}>
                  Complete Batch
                </button>
                <button className="btn btn-danger" onClick={handleDeleteBatch}>
                  Delete Batch
                </button>
              </>
            )}
          </div>
          {batch.status !== 'Completed' && (
            <div className="mb-3">
              <h4 className="text-warning mb-2">Update Equipment & Stage</h4>
              <div className="d-flex gap-2 align-items-center flex-wrap">
                <select
                  value={selectedEquipmentId || ''}
                  onChange={(e) => setSelectedEquipmentId(parseInt(e.target.value) || null)}
                  className="form-control"
                  style={{ maxWidth: '200px' }}
                >
                  <option value="">Select Equipment</option>
                  {equipment.map(eq => (
                    <option key={eq.equipmentId} value={eq.equipmentId}>{eq.name}</option>
                  ))}
                </select>
                <select
                  value={stage}
                  onChange={(e) => setStage(e.target.value as any)}
                  className="form-control"
                  style={{ maxWidth: '200px' }}
                >
                  <option value="">Select Stage</option>
                  {validStages.map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
                <button className="btn btn-primary" onClick={handleUpdateEquipment}>
                  Update
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
      {batch.status !== 'Completed' && (
        <div className="mb-4">
          <h3 className="text-warning mb-3">Add Action</h3>
          <div className="d-flex gap-2 align-items-center">
            <input
              type="text"
              value={newAction}
              onChange={(e) => setNewAction(e.target.value)}
              placeholder="Enter action description"
              className="form-control"
              style={{ maxWidth: '300px' }}
            />
            <button className="btn btn-primary" onClick={handleAddAction}>
              Add Action
            </button>
          </div>
        </div>
      )}
      <div className="mb-4">
        <h3 className="text-warning mb-3">Actions</h3>
        {actions.length > 0 ? (
          <>
            <table className="inventory-table table table-striped">
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {actions.map(action => (
                  <tr key={action.id}>
                    <td>{action.timestamp}</td>
                    <td>{action.action}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="action-list">
              {actions.map(action => (
                <div key={action.id} className="action-card card mb-2">
                  <div className="card-body">
                    <p className="card-text"><strong>Timestamp:</strong> {action.timestamp}</p>
                    <p className="card-text"><strong>Action:</strong> {action.action}</p>
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : (
          <p>No actions recorded.</p>
        )}
      </div>
      {batch.status !== 'Completed' && (
        <div className="mb-4">
          <h3 className="text-warning mb-3">Ingredients</h3>
          <div className="row g-2 mb-3">
            <div className="col-md-3">
              <label className="form-label text-warning">Item:</label>
              <select
                value={newIngredient.itemName}
                onChange={(e) => setNewIngredient({ ...newIngredient, itemName: e.target.value })}
                className="form-control"
              >
                <option value="">Select Item</option>
                {items.filter(item => item.enabled).map(item => (
                  <option key={item.name} value={item.name}>{item.name}</option>
                ))}
              </select>
            </div>
            <div className="col-md-3">
              <label className="form-label text-warning">Quantity:</label>
              <input
                type="number"
                value={newIngredient.quantity || ''}
                onChange={(e) => setNewIngredient({ ...newIngredient, quantity: parseFloat(e.target.value) || 0 })}
                placeholder="Quantity"
                min="0"
                className="form-control"
              />
            </div>
            <div className="col-md-3">
              <label className="form-label text-warning">Unit:</label>
              <select
                value={newIngredient.unit}
                onChange={(e) => setNewIngredient({ ...newIngredient, unit: e.target.value })}
                className="form-control"
              >
                <option value="lbs">lbs</option>
                <option value="gallons">gallons</option>
                <option value="liters">liters</option>
              </select>
            </div>
            <div className="col-md-3 d-flex align-items-end">
              <button className="btn btn-primary w-100" onClick={handleAddIngredient}>
                Add Ingredient
              </button>
            </div>
          </div>
        </div>
      )}
      <div className="mb-4">
        <h3 className="text-warning mb-3">Ingredients</h3>
        {batch.ingredients && batch.ingredients.length > 0 ? (
          <>
            <table className="inventory-table table table-striped">
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Quantity</th>
                  <th>Unit</th>
                  <th>Source</th>
                  {batch.status !== 'Completed' && <th>Actions</th>}
                </tr>
              </thead>
              <tbody>
                {batch.ingredients.map((ing, index) => (
                  <tr key={index}>
                    <td>
                      {newIngredients.some(n => 
                        n.itemName === ing.itemName && n.quantity === ing.quantity && n.unit === ing.unit
                      ) ? (
                        <select
                          value={newIngredients.find(n => 
                            n.itemName === ing.itemName && n.quantity === ing.quantity && n.unit === ing.unit
                          )?.itemName || ing.itemName}
                          onChange={(e) => {
                            const updated = { ...ing, itemName: e.target.value };
                            setNewIngredients(prev => prev.map(n => 
                              n.itemName === ing.itemName && n.quantity === ing.quantity && n.unit === ing.unit ? updated : n
                            ));
                          }}
                          className="form-control"
                        >
                          <option value="">Select Item</option>
                          {items.filter(item => item.enabled).map(item => (
                            <option key={item.name} value={item.name}>{item.name}</option>
                          ))}
                        </select>
                      ) : (
                        ing.itemName
                      )}
                    </td>
                    <td>
                      {newIngredients.some(n => 
                        n.itemName === ing.itemName && n.quantity === ing.quantity && n.unit === ing.unit
                      ) ? (
                        <input
                          type="number"
                          value={newIngredients.find(n => 
                            n.itemName === ing.itemName && n.quantity === ing.quantity && n.unit === ing.unit
                          )?.quantity || ing.quantity}
                          onChange={(e) => {
                            const updated = { ...ing, quantity: parseFloat(e.target.value) || 0 };
                            setNewIngredients(prev => prev.map(n => 
                              n.itemName === ing.itemName && n.quantity === ing.quantity && n.unit === ing.unit ? updated : n
                            ));
                          }}
                          className="form-control"
                          style={{ width: '80px' }}
                        />
                      ) : (
                        ing.quantity
                      )}
                    </td>
                    <td>
                      {newIngredients.some(n => 
                        n.itemName === ing.itemName && n.quantity === ing.quantity && n.unit === ing.unit
                      ) ? (
                        <select
                          value={newIngredients.find(n => 
                            n.itemName === ing.itemName && n.quantity === ing.quantity && n.unit === ing.unit
                          )?.unit || ing.unit}
                          onChange={(e) => {
                            const updated = { ...ing, unit: e.target.value };
                            setNewIngredients(prev => prev.map(n => 
                              n.itemName === ing.itemName && n.quantity === ing.quantity && n.unit === ing.unit ? updated : n
                            ));
                          }}
                          className="form-control"
                        >
                          <option value="lbs">lbs</option>
                          <option value="gallons">gallons</option>
                          <option value="liters">liters</option>
                        </select>
                      ) : (
                        ing.unit
                      )}
                    </td>
                    <td>{ing.isRecipe ? 'Recipe' : 'Additional'}</td>
                    {batch.status !== 'Completed' && (
                      <td>
                        {newIngredients.some(n => 
                          n.itemName === ing.itemName && n.quantity === ing.quantity && n.unit === ing.unit
                        ) ? (
                          <div className="d-flex gap-2">
                            <button
                              className="btn btn-primary btn-sm"
                              onClick={() => handleUpdateIngredient(ing, newIngredients.find(n => 
                                n.itemName === ing.itemName && n.quantity === ing.quantity && n.unit === ing.unit
                              )!)}
                            >
                              Save
                            </button>
                            <button
                              className="btn btn-danger btn-sm"
                              onClick={() => setNewIngredients(newIngredients.filter(n => 
                                !(n.itemName === ing.itemName && n.quantity === ing.quantity && n.unit === ing.unit)
                              ))}
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <div className="d-flex gap-2">
                            <button
                              className="btn btn-primary btn-sm"
                              onClick={() => setNewIngredients([...newIngredients, { ...ing }])}
                            >
                              Edit
                            </button>
                            <button
                              className="btn btn-danger btn-sm"
                              onClick={() => handleDeleteIngredient(ing)}
                            >
                              Delete
                            </button>
                          </div>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="ingredient-list">
              {batch.ingredients.map((ing, index) => (
                <div key={index} className="ingredient-card card mb-2">
                  <div className="card-body">
                    <p className="card-text"><strong>Item:</strong> {ing.itemName}</p>
                    <p className="card-text"><strong>Quantity:</strong> {ing.quantity}</p>
                    <p className="card-text"><strong>Unit:</strong> {ing.unit}</p>
                    <p className="card-text"><strong>Source:</strong> {ing.isRecipe ? 'Recipe' : 'Additional'}</p>
                    {batch.status !== 'Completed' && (
                      <div className="d-flex gap-2">
                        <button
                          className="btn btn-primary btn-sm"
                          onClick={() => setNewIngredients([...newIngredients, { ...ing }])}
                        >
                          Edit
                        </button>
                        <button
                          className="btn btn-danger btn-sm"
                          onClick={() => handleDeleteIngredient(ing)}
                        >
                          Delete
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : (
          <p>No ingredients recorded.</p>
        )}
      </div>
      {batch.stage === 'Packaging' && batch.status !== 'Completed' && (
        <div className="mb-4">
          <h3 className="text-warning mb-3">Package Batch</h3>
          <div className="row g-2 mb-3">
            <div className="col-md-4">
              <label className="form-label text-warning">Package Type:</label>
              <select
                value={packageType}
                onChange={(e) => setPackageType(e.target.value)}
                className="form-control"
              >
                <option value="">Select Package Type</option>
                {packageTypes
                  .filter((pkg) => pkg.enabled && productPackageTypes.includes(pkg.name))
                  .sort((a, b) => a.name.localeCompare(b.name))
                  .map((pkg) => (
                    <option key={pkg.name} value={pkg.name}>{`${pkg.name} (${(pkg.volume * 31).toFixed(2)} gal)`}</option>
                  ))}
              </select>
            </div>
            <div className="col-md-4">
              <label className="form-label text-warning">Quantity:</label>
              <input
                type="number"
                value={packageQuantity || ''}
                onChange={(e) => setPackageQuantity(parseInt(e.target.value) || 0)}
                placeholder="Quantity"
                min="0"
                className="form-control"
              />
            </div>
            <div className="col-md-4">
              <label className="form-label text-warning">Location:</label>
              <select
                value={packageLocation}
                onChange={(e) => setPackageLocation(e.target.value)}
                className="form-control"
              >
                <option value="">Select Location</option>
                {locations.map(loc => (
                  <option key={loc.locationId} value={loc.locationId}>{loc.name}</option>
                ))}
              </select>
            </div>
          </div>
          {packageType.includes('Keg') && (
            <div className="mt-3">
              <label className="form-label text-warning">Keg Codes:</label>
              <div className="d-flex gap-2 align-items-center mb-2">
                <input
                  type="text"
                  value={currentKegCode}
                  onChange={(e) => setCurrentKegCode(e.target.value)}
                  placeholder="Scan or enter keg code"
                  className="form-control"
                  style={{ maxWidth: '200px' }}
                />
                <label className="form-check-label">
                  <input
                    type="checkbox"
                    checked={manualKegEntry}
                    onChange={(e) => setManualKegEntry(e.target.checked)}
                    className="form-check-input"
                  />
                  Manual Entry
                </label>
                <button className="btn btn-primary" onClick={handleAddKegCode}>
                  Add Keg
                </button>
              </div>
              {kegCodes.length > 0 && (
                <div>
                  <p><strong>Added Kegs:</strong> {kegCodes.join(', ')}</p>
                  <button className="btn btn-danger btn-sm" onClick={() => setKegCodes([])}>
                    Clear Kegs
                  </button>
                </div>
              )}
            </div>
          )}
          <button className="btn btn-primary mt-3" onClick={() => handlePackage()}>
            Package
          </button>
        </div>
      )}
      <div className="mb-4">
        <h3 className="text-warning mb-3">Packaging Actions</h3>
        {packagingActions.length > 0 ? (
          <>
            <table className="inventory-table table table-striped">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Package Type</th>
                  <th>Quantity</th>
                  <th>Volume (barrels)</th>
                  <th>Location</th>
                  <th>Keg Codes</th>
                  {batch.status !== 'Completed' && <th>Actions</th>}
                </tr>
              </thead>
              <tbody>
                {packagingActions.map(pkg => (
                  <tr key={pkg.id}>
                    <td>{pkg.date}</td>
                    <td>{pkg.packageType}</td>
                    <td>
                      {editPackaging && editPackaging.id === pkg.id ? (
                        <input
                          type="number"
                          value={editPackaging.quantity}
                          onChange={(e) => setEditPackaging({ ...editPackaging, quantity: parseInt(e.target.value) || 0 })}
                          className="form-control"
                          style={{ width: '80px' }}
                        />
                      ) : (
                        pkg.quantity
                      )}
                    </td>
                    <td>{pkg.volume.toFixed(3)}</td>
                    <td>{locations.find(loc => loc.locationId === pkg.locationId)?.name || pkg.locationId}</td>
                    <td>{pkg.keg_codes ? JSON.parse(pkg.keg_codes).join(', ') : 'N/A'}</td>
                    {batch.status !== 'Completed' && (
                      <td>
                        {editPackaging && editPackaging.id === pkg.id ? (
                          <div className="d-flex gap-2">
                            <button className="btn btn-primary btn-sm" onClick={handleEditPackaging}>
                              Save
                            </button>
                            <button className="btn btn-danger btn-sm" onClick={() => setEditPackaging(null)}>
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <div className="d-flex gap-2">
                            <button className="btn btn-primary btn-sm" onClick={() => setEditPackaging(pkg)}>
                              Edit
                            </button>
                            <button
                              className="btn btn-danger btn-sm"
                              onClick={() => handleDeletePackaging(pkg)}
                              disabled={pendingDeletions.has(pkg.id.toString())}
                            >
                              Delete
                            </button>
                          </div>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="packaging-list">
              {packagingActions.map(pkg => (
                <div key={pkg.id} className="packaging-card card mb-2">
                  <div className="card-body">
                    <p className="card-text"><strong>Date:</strong> {pkg.date}</p>
                    <p className="card-text"><strong>Package Type:</strong> {pkg.packageType}</p>
                    <p className="card-text"><strong>Quantity:</strong> {pkg.quantity}</p>
                    <p className="card-text"><strong>Volume:</strong> {pkg.volume.toFixed(3)} barrels</p>
                    <p className="card-text"><strong>Location:</strong> {locations.find(loc => loc.locationId === pkg.locationId)?.name || pkg.locationId}</p>
                    <p className="card-text"><strong>Keg Codes:</strong> {pkg.keg_codes ? JSON.parse(pkg.keg_codes).join(', ') : 'N/A'}</p>
                    {batch.status !== 'Completed' && (
                      <div className="d-flex gap-2">
                        <button className="btn btn-primary btn-sm" onClick={() => setEditPackaging(pkg)}>
                          Edit
                        </button>
                        <button
                          className="btn btn-danger btn-sm"
                          onClick={() => handleDeletePackaging(pkg)}
                          disabled={pendingDeletions.has(pkg.id.toString())}
                        >
                          Delete
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : (
          <p>No packaging actions recorded.</p>
        )}
      </div>
      {showVolumePrompt && (
        <div className="modal fade show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-content" style={{ maxWidth: '400px', margin: '0 auto' }}>
            <div className="modal-header">
              <h5 className="modal-title">Volume Adjustment Required</h5>
            </div>
            <div className="modal-body">
              <p>{showVolumePrompt.message}</p>
            </div>
            <div className="modal-footer">
              <button className="btn btn-primary" onClick={() => handleVolumeAdjustment(true)}>
                Adjust Volume
              </button>
              <button className="btn btn-danger" onClick={() => handleVolumeAdjustment(false)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
      {showLossPrompt && (
        <div className="modal fade show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-content" style={{ maxWidth: '400px', margin: '0 auto' }}>
            <div className="modal-header">
              <h5 className="modal-title">Record Loss</h5>
            </div>
            <div className="modal-body">
              <p>{`Batch has ${showLossPrompt.volume.toFixed(3)} barrels remaining. Record as fermentation loss due to trub/spillage?`}</p>
            </div>
            <div className="modal-footer">
              <button className="btn btn-primary" onClick={() => handleLossConfirmation(true)}>
                Record Loss
              </button>
              <button className="btn btn-danger" onClick={() => handleLossConfirmation(false)}>
                Skip
              </button>
            </div>
          </div>
        </div>
      )}
      {showKegPrompt && (
        <div className="modal fade show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-content" style={{ maxWidth: '400px', margin: '0 auto' }}>
            <div className="modal-header">
              <h5 className="modal-title">Scan Kegs?</h5>
            </div>
            <div className="modal-body">
              <p>No kegs have been scanned for this packaging action. Would you like to scan kegs now?</p>
            </div>
            <div className="modal-footer">
              <button className="btn btn-primary" onClick={() => setShowKegPrompt(false)}>
                Yes, Scan Kegs
              </button>
              <button className="btn btn-danger" onClick={() => handlePackage(true)}>
                No, Proceed
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BatchDetails;