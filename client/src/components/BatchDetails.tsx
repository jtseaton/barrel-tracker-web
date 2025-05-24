// src/components/BatchDetails.tsx
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Batch, Product, Site, Equipment, Ingredient, Location, InventoryItem, PackagingAction, BatchDetailsProps } from '../types/interfaces';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import '../App.css';

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

        console.log('Fetching endpoints:', endpoints.map(e => e.url));

        const responses = await Promise.all(
          endpoints.map(({ url }) => fetch(url, { headers: { Accept: 'application/json' } }))
        );

        for (let i = 0; i < responses.length; i++) {
          const res = responses[i];
          const { name, setter, single } = endpoints[i];
          console.log(`Response for ${name}:`, { url: endpoints[i].url, status: res.status, ok: res.ok });

          if (!res.ok) {
            const text = await res.text();
            console.error(`Failed to fetch ${name}: HTTP ${res.status}, Response:`, text.slice(0, 100));
            throw new Error(`Failed to fetch ${name}: HTTP ${res.status}, Response: ${text.slice(0, 50)}`);
          }

          const contentType = res.headers.get('content-type');
          if (!contentType || !contentType.includes('application/json')) {
            const text = await res.text();
            console.error(`Invalid content-type for ${name}:`, contentType, 'Response:', text.slice(0, 100));
            throw new Error(`Invalid response for ${name}: Expected JSON, got ${contentType}`);
          }

          const data = await res.json();
          setter(single ? data : data);
        }
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        console.error('Fetch error:', err);
        setError('Failed to load batch details: ' + errorMessage);
      }
    };
    fetchData();
  }, [batchId]);

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
        console.log('Fetching site endpoints:', endpoints.map(e => e.url));
        const responses = await Promise.all(
          endpoints.map(({ url }) => fetch(url, { headers: { Accept: 'application/json' } }))
        );
        for (let i = 0; i < responses.length; i++) {
          const res = responses[i];
          const { name, setter } = endpoints[i];
          console.log(`Response for ${name}:`, { url: endpoints[i].url, status: res.status, ok: res.ok });
          if (!res.ok) {
            const text = await res.text();
            console.error(`Failed to fetch ${name}: HTTP ${res.status}, Response:`, text.slice(0, 100));
            throw new Error(`Failed to fetch ${name}: HTTP ${res.status}, Response: ${text.slice(0, 50)}`);
          }
          const contentType = res.headers.get('content-type');
          if (!contentType || !contentType.includes('application/json')) {
            const text = await res.text();
            console.error(`Invalid content-type for ${name}:`, contentType, 'Response:', text.slice(0, 100));
            throw new Error(`Invalid response for ${name}: Expected JSON, got ${contentType}`);
          }
          const data = await res.json();
          setter(data);
        }
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        console.error('Fetch site data error:', err);
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
      console.error('Add keg code error:', err);
      setError('Failed to add keg: ' + errorMessage);
    }
  };

  const handlePackage = async (skipKegPrompt: boolean = false) => {
    console.log('handlePackage: Attempting to package', { batchId, packageType, packageQuantity, packageLocation, kegCodes });
    if (!packageType || packageQuantity <= 0 || !packageLocation) {
      console.error('handlePackage: Invalid input', { packageType, packageQuantity, packageLocation });
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
      console.log('handlePackage: Response received', { status: res.status, ok: res.ok });
      if (!res.ok) {
        const text = await res.text();
        console.error('handlePackage: Failed to package', { status: res.status, response: text.slice(0, 100) });
        throw new Error(`Failed to package: HTTP ${res.status}, Response: ${text.slice(0, 50)}`);
      }
      const data = await res.json();
      console.log('handlePackage: Response data', data);
      if (data.prompt === 'volumeAdjustment') {
        setShowVolumePrompt({ message: data.message, shortfall: data.shortfall });
        return;
      }
      const batchRes = await fetch(`${API_BASE_URL}/api/batches/${batchId}`, {
        headers: { Accept: 'application/json' },
      });
      if (!batchRes.ok) {
        const text = await batchRes.text();
        console.error('handlePackage: Failed to refresh batch', { status: batchRes.status, response: text });
        throw new Error(`Failed to refresh batch: HTTP ${batchRes.status}, Response: ${text.slice(0, 50)}`);
      }
      const updatedBatch = await batchRes.json();
      setBatch(updatedBatch);
      const packagingRes = await fetch(`${API_BASE_URL}/api/batches/${batchId}/package`, {
        headers: { Accept: 'application/json' },
      });
      if (packagingRes.ok) {
        const packagingData = await packagingRes.json();
        setPackagingActions(packagingData);
      } else {
        console.error('handlePackage: Failed to refresh packaging actions', { status: packagingRes.status });
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
      console.error('Package error:', err);
      setError('Failed to package: ' + errorMessage);
    }
  };

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
      console.error('Volume adjustment error:', err);
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
      console.error('Add action error:', err);
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
      console.error('Complete batch error:', err);
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
          console.error('handleLossConfirmation: Complete batch failed', { status: res.status, response: text });
          throw new Error(`Failed to complete batch: HTTP ${res.status}, Response: ${text.slice(0, 50)}`);
        }
        setBatch((prev) => prev ? { ...prev, status: 'Completed', stage: 'Completed', equipmentId: null } : null);
        setSuccessMessage('Batch completed without recording loss');
        setTimeout(() => setSuccessMessage(null), 2000);
        setError(null);
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        console.error('Complete batch error:', err);
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
      console.log('handleLossConfirmation: Sending loss payload', {
        batchId: batch.batchId,
        productName: batch.productName,
        siteId: batch.siteId,
        volume: batch.volume,
        payload: lossPayload,
      });
      const res = await fetch(`${API_BASE_URL}/api/record-loss`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(lossPayload),
      });
      if (!res.ok) {
        const text = await res.text();
        console.error('handleLossConfirmation: Loss recording failed', { status: res.status, response: text });
        throw new Error(`Failed to record loss: HTTP ${res.status}, Response: ${text.slice(0, 50)}`);
      }
      const responseData = await res.json();
      console.log('handleLossConfirmation: Loss recorded', responseData);
      const updateRes = await fetch(`${API_BASE_URL}/api/batches/${batchId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ volume: 0 }),
      });
      if (!updateRes.ok) {
        const text = await updateRes.text();
        console.error('handleLossConfirmation: Update batch volume failed', { status: updateRes.status, response: text });
        throw new Error(`Failed to update batch volume: HTTP ${updateRes.status}, Response: ${text.slice(0, 50)}`);
      }
      const completeRes = await fetch(`${API_BASE_URL}/api/batches/${batchId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ status: 'Completed', stage: 'Completed', equipmentId: null }),
      });
      if (!completeRes.ok) {
        const text = await completeRes.text();
        console.error('handleLossConfirmation: Complete batch failed', { status: completeRes.status, response: text });
        throw new Error(`Failed to complete batch: HTTP ${completeRes.status}, Response: ${text.slice(0, 50)}`);
      }
      setBatch((prev) => prev ? { ...prev, status: 'Completed', stage: 'Completed', equipmentId: null, volume: 0 } : null);
      setShowLossPrompt(null);
      setSuccessMessage('Loss recorded and batch completed');
      setTimeout(() => setSuccessMessage(null), 2000);
      setError(null);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      console.error('Loss confirmation error:', err);
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
      console.error('Update batch ID error:', err);
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
      console.error('Delete batch error:', err);
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
      console.error('Add ingredient error:', err);
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
      console.error('Update ingredient error:', err);
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
      console.error('Delete ingredient error:', err);
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
      console.error('Update equipment error:', err);
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
        const packagingData = await packagingRes.json();
        setPackagingActions(packagingData);
      }
      await refreshInventory();
      setEditPackaging(null);
      setSuccessMessage('Packaging updated successfully');
      setTimeout(() => setSuccessMessage(null), 2000);
      setError(null);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      console.error('Edit packaging error:', err);
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
        const packagingData = await packagingRes.json();
        setPackagingActions(packagingData);
      }
      await refreshInventory();
      setSuccessMessage('Packaging deleted successfully');
      setTimeout(() => setSuccessMessage(null), 2000);
      setError(null);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      console.error('Delete packaging error:', err);
      setError('Failed to delete packaging: ' + errorMessage);
    } finally {
      setPendingDeletions(prev => {
        const newSet = new Set(prev);
        newSet.delete(pkg.id.toString());
        return newSet;
      });
    }
  };

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
      });
    }

    doc.save(`Batch_${batch.batchId}_Sheet.pdf`);
  };

  if (!batch) {
    return <div>Loading...</div>;
  }

  return (
    <div className="page-container">
      <h2 style={{ color: '#EEC930', fontSize: '24px', marginBottom: '20px' }}>
        Batch {batch.batchId}
      </h2>
      {error && <div className="error">{error}</div>}
      {successMessage && (
        <div style={{ color: '#28A745', backgroundColor: '#e6ffe6', padding: '10px', borderRadius: '4px', marginBottom: '10px', textAlign: 'center' }}>
          {successMessage}
        </div>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
        <div>
          <h3 style={{ color: '#EEC930', fontSize: '18px', marginBottom: '10px' }}>Batch Details</h3>
          <p><strong>Product:</strong> {batch.productName || 'N/A'}</p>
          <p><strong>Site:</strong> {batch.siteName || 'N/A'}</p>
          <p><strong>Status:</strong> {batch.status}</p>
          <p><strong>Date:</strong> {batch.date}</p>
          <p><strong>Volume:</strong> {batch.volume ? batch.volume.toFixed(3) : 'N/A'} barrels</p>
          <p><strong>Stage:</strong> {batch.stage || 'N/A'}</p>
          <p><strong>Equipment:</strong> {equipment.find(e => e.equipmentId === batch.equipmentId)?.name || 'N/A'}</p>
          {batch.status !== 'Completed' && (
            <div style={{ marginTop: '20px' }}>
              <h4 style={{ color: '#EEC930', fontSize: '16px', marginBottom: '10px' }}>Update Batch ID</h4>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                <input
                  type="text"
                  value={newBatchId}
                  onChange={(e) => setNewBatchId(e.target.value)}
                  placeholder="New Batch ID"
                  style={{ padding: '10px', border: '1px solid #CCCCCC', borderRadius: '4px', fontSize: '16px', width: '200px' }}
                />
                <button
                  onClick={handleEditBatchName}
                  style={{
                    backgroundColor: '#2196F3',
                    color: '#fff',
                    padding: '10px 20px',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                  }}
                >
                  Update ID
                </button>
              </div>
            </div>
          )}
        </div>
        <div>
          <h3 style={{ color: '#EEC930', fontSize: '18px', marginBottom: '10px' }}>Actions</h3>
          <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
            <button
              onClick={handlePrintBatchSheet}
              style={{
                backgroundColor: '#2196F3',
                color: '#fff',
                padding: '10px 20px',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
              }}
            >
              Print Batch Sheet
            </button>
            {batch.status !== 'Completed' && (
              <>
                <button
                  onClick={handleCompleteBatch}
                  style={{
                    backgroundColor: '#28A745',
                    color: '#fff',
                    padding: '10px 20px',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                  }}
                >
                  Complete Batch
                </button>
                <button
                  onClick={handleDeleteBatch}
                  style={{
                    backgroundColor: '#F86752',
                    color: '#fff',
                    padding: '10px 20px',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                  }}
                >
                  Delete Batch
                </button>
              </>
            )}
          </div>
          {batch.status !== 'Completed' && (
            <div style={{ marginBottom: '20px' }}>
              <h4 style={{ color: '#EEC930', fontSize: '16px', marginBottom: '10px' }}>Update Equipment & Stage</h4>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                <select
                  value={selectedEquipmentId || ''}
                  onChange={(e) => setSelectedEquipmentId(parseInt(e.target.value) || null)}
                  style={{ padding: '10px', border: '1px solid #CCCCCC', borderRadius: '4px', fontSize: '16px', width: '200px' }}
                >
                  <option value="">Select Equipment</option>
                  {equipment.map(eq => (
                    <option key={eq.equipmentId} value={eq.equipmentId}>{eq.name}</option>
                  ))}
                </select>
                <select
                  value={stage}
                  onChange={(e) => setStage(e.target.value as any)}
                  style={{ padding: '10px', border: '1px solid #CCCCCC', borderRadius: '4px', fontSize: '16px', width: '200px' }}
                >
                  <option value="">Select Stage</option>
                  {validStages.map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
                <button
                  onClick={handleUpdateEquipment}
                  style={{
                    backgroundColor: '#2196F3',
                    color: '#fff',
                    padding: '10px 20px',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                  }}
                >
                  Update
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
      {batch.status !== 'Completed' && (
        <div style={{ marginBottom: '20px' }}>
          <h3 style={{ color: '#EEC930', fontSize: '18px', marginBottom: '10px' }}>Add Action</h3>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <input
              type="text"
              value={newAction}
              onChange={(e) => setNewAction(e.target.value)}
              placeholder="Enter action description"
              style={{ padding: '10px', border: '1px solid #CCCCCC', borderRadius: '4px', fontSize: '16px', width: '300px' }}
            />
            <button
              onClick={handleAddAction}
              style={{
                backgroundColor: '#2196F3',
                color: '#fff',
                padding: '10px 20px',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
              }}
            >
              Add Action
            </button>
          </div>
        </div>
      )}
      <div style={{ marginBottom: '20px' }}>
        <h3 style={{ color: '#EEC930', fontSize: '18px', marginBottom: '10px' }}>Actions</h3>
        {actions.length > 0 ? (
          <table className="inventory-table">
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
        ) : (
          <p>No actions recorded.</p>
        )}
      </div>
      {batch.status !== 'Completed' && (
        <div style={{ marginBottom: '20px' }}>
          <h3 style={{ color: '#EEC930', fontSize: '18px', marginBottom: '10px' }}>Ingredients</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '10px', marginBottom: '10px' }}>
            <div>
              <label style={{ fontWeight: 'bold', color: '#EEC930', display: 'block', marginBottom: '5px' }}>
                Item:
              </label>
              <select
                value={newIngredient.itemName}
                onChange={(e) => setNewIngredient({ ...newIngredient, itemName: e.target.value })}
                style={{ padding: '10px', border: '1px solid #CCCCCC', borderRadius: '4px', fontSize: '16px', width: '100%' }}
              >
                <option value="">Select Item</option>
                {items.filter(item => item.enabled).map(item => (
                  <option key={item.name} value={item.name}>{item.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={{ fontWeight: 'bold', color: '#EEC930', display: 'block', marginBottom: '5px' }}>
                Quantity:
              </label>
              <input
                type="number"
                value={newIngredient.quantity || ''}
                onChange={(e) => setNewIngredient({ ...newIngredient, quantity: parseFloat(e.target.value) || 0 })}
                placeholder="Quantity"
                min="0"
                style={{ padding: '10px', border: '1px solid #CCCCCC', borderRadius: '4px', fontSize: '16px', width: '100%' }}
              />
            </div>
            <div>
              <label style={{ fontWeight: 'bold', color: '#EEC930', display: 'block', marginBottom: '5px' }}>
                Unit:
              </label>
              <select
                value={newIngredient.unit}
                onChange={(e) => setNewIngredient({ ...newIngredient, unit: e.target.value })}
                style={{ padding: '10px', border: '1px solid #CCCCCC', borderRadius: '4px', fontSize: '16px', width: '100%' }}
              >
                <option value="lbs">lbs</option>
                <option value="gallons">gallons</option>
                <option value="liters">liters</option>
              </select>
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-end' }}>
              <button
                onClick={handleAddIngredient}
                style={{
                  backgroundColor: '#2196F3',
                  color: '#fff',
                  padding: '10px 20px',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  width: '100%',
                }}
              >
                Add Ingredient
              </button>
            </div>
          </div>
        </div>
      )}
      <div style={{ marginBottom: '20px' }}>
        <h3 style={{ color: '#EEC930', fontSize: '18px', marginBottom: '10px' }}>Ingredients</h3>
        {batch.ingredients && batch.ingredients.length > 0 ? (
          <table className="inventory-table">
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
                        style={{ padding: '5px', border: '1px solid #CCCCCC', borderRadius: '4px', fontSize: '14px' }}
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
                        style={{ padding: '5px', border: '1px solid #CCCCCC', borderRadius: '4px', fontSize: '14px', width: '80px' }}
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
                        style={{ padding: '5px', border: '1px solid #CCCCCC', borderRadius: '4px', fontSize: '14px' }}
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
                        <div style={{ display: 'flex', gap: '5px' }}>
                          <button
                            onClick={() => handleUpdateIngredient(ing, newIngredients.find(n => 
                              n.itemName === ing.itemName && n.quantity === ing.quantity && n.unit === ing.unit
                            )!)}
                            style={{
                              backgroundColor: '#2196F3',
                              color: '#fff',
                              padding: '5px 10px',
                              border: 'none',
                              borderRadius: '4px',
                              cursor: 'pointer',
                            }}
                          >
                            Save
                          </button>
                          <button
                            onClick={() => setNewIngredients(newIngredients.filter(n => 
                              !(n.itemName === ing.itemName && n.quantity === ing.quantity && n.unit === ing.unit)
                            ))}
                            style={{
                              backgroundColor: '#F86752',
                              color: '#fff',
                              padding: '5px 10px',
                              border: 'none',
                              borderRadius: '4px',
                              cursor: 'pointer',
                            }}
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', gap: '5px' }}>
                          <button
                            onClick={() => setNewIngredients([...newIngredients, { ...ing }])}
                            style={{
                              backgroundColor: '#2196F3',
                              color: '#fff',
                              padding: '5px 10px',
                              border: 'none',
                              borderRadius: '4px',
                              cursor: 'pointer',
                            }}
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDeleteIngredient(ing)}
                            style={{
                              backgroundColor: '#F86752',
                              color: '#fff',
                              padding: '5px 10px',
                              border: 'none',
                              borderRadius: '4px',
                              cursor: 'pointer',
                            }}
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
        ) : (
          <p>No ingredients recorded.</p>
        )}
      </div>
      {batch.stage === 'Packaging' && batch.status !== 'Completed' && (
        <div style={{ marginBottom: '20px' }}>
          <h3 style={{ color: '#EEC930', fontSize: '18px', marginBottom: '10px' }}>Package Batch</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', marginBottom: '10px' }}>
            <div>
              <label style={{ fontWeight: 'bold', color: '#EEC930', display: 'block', marginBottom: '5px' }}>
                Package Type:
              </label>
              <select
                value={packageType}
                onChange={(e) => setPackageType(e.target.value)}
                style={{ padding: '10px', border: '1px solid #CCCCCC', borderRadius: '4px', fontSize: '16px', width: '100%' }}
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
            <div>
              <label style={{ fontWeight: 'bold', color: '#EEC930', display: 'block', marginBottom: '5px' }}>
                Quantity:
              </label>
              <input
                type="number"
                value={packageQuantity || ''}
                onChange={(e) => setPackageQuantity(parseInt(e.target.value) || 0)}
                placeholder="Quantity"
                min="0"
                style={{ padding: '10px', border: '1px solid #CCCCCC', borderRadius: '4px', fontSize: '16px', width: '100%' }}
              />
            </div>
            <div>
              <label style={{ fontWeight: 'bold', color: '#EEC930', display: 'block', marginBottom: '5px' }}>
                Location:
              </label>
              <select
                value={packageLocation}
                onChange={(e) => setPackageLocation(e.target.value)}
                style={{ padding: '10px', border: '1px solid #CCCCCC', borderRadius: '4px', fontSize: '16px', width: '100%' }}
              >
                <option value="">Select Location</option>
                {locations.map(loc => (
                  <option key={loc.locationId} value={loc.locationId}>{loc.name}</option>
                ))}
              </select>
            </div>
          </div>
          {packageType.includes('Keg') && (
            <div style={{ marginTop: '10px' }}>
              <label style={{ fontWeight: 'bold', color: '#EEC930', display: 'block', marginBottom: '5px' }}>
                Keg Codes:
              </label>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '10px' }}>
                <input
                  type="text"
                  value={currentKegCode}
                  onChange={(e) => setCurrentKegCode(e.target.value)}
                  placeholder="Scan or enter keg code"
                  style={{ padding: '10px', border: '1px solid #CCCCCC', borderRadius: '4px', fontSize: '16px', width: '200px' }}
                />
                <label>
                  <input
                    type="checkbox"
                    checked={manualKegEntry}
                    onChange={(e) => setManualKegEntry(e.target.checked)}
                  />
                  Manual Entry
                </label>
                <button
                  onClick={handleAddKegCode}
                  style={{
                    backgroundColor: '#2196F3',
                    color: '#fff',
                    padding: '10px 20px',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                  }}
                >
                  Add Keg
                </button>
              </div>
              {kegCodes.length > 0 && (
                <div>
                  <p><strong>Added Kegs:</strong> {kegCodes.join(', ')}</p>
                  <button
                    onClick={() => setKegCodes([])}
                    style={{
                      backgroundColor: '#F86752',
                      color: '#fff',
                      padding: '8px 12px',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                    }}
                  >
                    Clear Kegs
                  </button>
                </div>
              )}
            </div>
          )}
          <button
            onClick={() => handlePackage()}
            style={{
              backgroundColor: '#2196F3',
              color: '#fff',
              padding: '10px 20px',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              marginTop: '10px',
            }}
          >
            Package
          </button>
        </div>
      )}
      <div style={{ marginBottom: '20px' }}>
        <h3 style={{ color: '#EEC930', fontSize: '18px', marginBottom: '10px' }}>Packaging Actions</h3>
        {packagingActions.length > 0 ? (
          <table className="inventory-table">
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
                        style={{ padding: '5px', border: '1px solid #CCCCCC', borderRadius: '4px', fontSize: '14px', width: '80px' }}
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
                        <div style={{ display: 'flex', gap: '5px' }}>
                          <button
                            onClick={handleEditPackaging}
                            style={{
                              backgroundColor: '#2196F3',
                              color: '#fff',
                              padding: '5px 10px',
                              border: 'none',
                              borderRadius: '4px',
                              cursor: 'pointer',
                            }}
                          >
                            Save
                          </button>
                          <button
                            onClick={() => setEditPackaging(null)}
                            style={{
                              backgroundColor: '#F86752',
                              color: '#fff',
                              padding: '5px 10px',
                              border: 'none',
                              borderRadius: '4px',
                              cursor: 'pointer',
                            }}
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', gap: '5px' }}>
                          <button
                            onClick={() => setEditPackaging(pkg)}
                            style={{
                              backgroundColor: '#2196F3',
                              color: '#fff',
                              padding: '5px 10px',
                              border: 'none',
                              borderRadius: '4px',
                              cursor: 'pointer',
                            }}
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDeletePackaging(pkg)}
                            style={{
                              backgroundColor: '#F86752',
                              color: '#fff',
                              padding: '5px 10px',
                              border: 'none',
                              borderRadius: '4px',
                              cursor: pendingDeletions.has(pkg.id.toString()) ? 'not-allowed' : 'pointer',
                              opacity: pendingDeletions.has(pkg.id.toString()) ? 0.5 : 1,
                            }}
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
        ) : (
          <p>No packaging actions recorded.</p>
        )}
      </div>
      {showVolumePrompt && (
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
            zIndex: 2100,
          }}
        >
          <div
            style={{
              backgroundColor: '#fff',
              padding: '20px',
              borderRadius: '8px',
              width: '400px',
              boxShadow: '0 4px 8px rgba(0,0,0,0.2)',
              textAlign: 'center',
              color: '#555',
            }}
          >
            <h3 style={{ color: '#555', marginBottom: '20px' }}>Volume Adjustment Required</h3>
            <p>{showVolumePrompt.message}</p>
            <div style={{ display: 'flex', justifyContent: 'space-around', marginTop: '20px' }}>
              <button
                onClick={() => handleVolumeAdjustment(true)}
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
                Adjust Volume
              </button>
              <button
                onClick={() => handleVolumeAdjustment(false)}
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
      {showLossPrompt && (
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
            zIndex: 2100,
          }}
        >
          <div
            style={{
              backgroundColor: '#fff',
              padding: '20px',
              borderRadius: '8px',
              width: '400px',
              boxShadow: '0 4px 8px rgba(0,0,0,0.2)',
              textAlign: 'center',
              color: '#555',
            }}
          >
            <h3 style={{ color: '#555', marginBottom: '20px' }}>Record Loss</h3>
            <p>
              {`Batch has ${showLossPrompt.volume.toFixed(3)} barrels remaining. Record as fermentation loss due to trub/spillage?`}
            </p>
            <div style={{ display: 'flex', justifyContent: 'space-around', marginTop: '20px' }}>
              <button
                onClick={() => handleLossConfirmation(true)}
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
                Record Loss
              </button>
              <button
                onClick={() => handleLossConfirmation(false)}
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
                Skip
              </button>
            </div>
          </div>
        </div>
      )}
      {showKegPrompt && (
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
            zIndex: 2100,
          }}
        >
          <div
            style={{
              backgroundColor: '#fff',
              padding: '20px',
              borderRadius: '8px',
              width: '400px',
              boxShadow: '0 4px 8px rgba(0,0,0,0.2)',
              textAlign: 'center',
              color: '#555',
            }}
          >
            <h3 style={{ color: '#555', marginBottom: '20px' }}>Scan Kegs?</h3>
            <p>No kegs have been scanned for this packaging action. Would you like to scan kegs now?</p>
            <div style={{ display: 'flex', justifyContent: 'space-around', marginTop: '20px' }}>
              <button
                onClick={() => setShowKegPrompt(false)}
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
                Yes, Scan Kegs
              </button>
              <button
                onClick={() => handlePackage(true)}
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