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
const [packageTypes, setPackageTypes] = useState<{ name: string; volume: number; enabled: number }[]>([]); // Added
const [packageQuantity, setPackageQuantity] = useState<number>(0);
const [packageLocation, setPackageLocation] = useState<string>('');
const [error, setError] = useState<string | null>(null);
const [successMessage, setSuccessMessage] = useState<string | null>(null);
const [pendingDeletions, setPendingDeletions] = useState<Set<string>>(new Set());
const [showVolumePrompt, setShowVolumePrompt] = useState<{ message: string; shortfall: number } | null>(null);
const [showLossPrompt, setShowLossPrompt] = useState<{ volume: number } | null>(null);
const [packagingActions, setPackagingActions] = useState<PackagingAction[]>([]);
const [editPackaging, setEditPackaging] = useState<PackagingAction | null>(null);
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
        { url: `${API_BASE_URL}/api/package-types`, setter: setPackageTypes, name: 'packageTypes' }, // Added
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
  
  // handleLossConfirmation (line ~400)
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
      console.log('Add ingredient response:', updatedBatch);
      setBatch({ ...updatedBatch, ingredients: [...updatedBatch.ingredients] });
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

  const handleRemoveIngredient = async (ingredient: Ingredient) => {
    const deletionKey = `${ingredient.itemName}-${ingredient.quantity}-${ingredient.unit || 'lbs'}`;
    if (pendingDeletions.has(deletionKey)) return;
    setPendingDeletions(prev => new Set(prev).add(deletionKey));
    console.log('Attempting to delete ingredient:', { ...ingredient, unit: ingredient.unit || 'lbs' });
    try {
      if (!window.confirm(`Remove ${ingredient.quantity} ${ingredient.unit || 'lbs'} of ${ingredient.itemName}?`)) {
        setPendingDeletions(prev => {
          const newSet = new Set(prev);
          newSet.delete(deletionKey);
          return newSet;
        });
        return;
      }
      const res = await fetch(`${API_BASE_URL}/api/batches/${batchId}/ingredients`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ ...ingredient, unit: ingredient.unit || 'lbs' }),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Failed to remove ingredient: HTTP ${res.status}, Response: ${text.slice(0, 50)}`);
      }
      const updatedBatch = await res.json();
      console.log('Delete response:', updatedBatch);
      if (!Array.isArray(updatedBatch.ingredients)) {
        console.error('Invalid ingredients array in response:', updatedBatch.ingredients);
        throw new Error('Invalid server response: ingredients array missing');
      }
      setBatch({ ...updatedBatch, ingredients: [...updatedBatch.ingredients] });
      setError(null);
      setSuccessMessage('Ingredient removed successfully');
      setTimeout(() => setSuccessMessage(null), 2000);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      console.error('Remove ingredient error:', err);
      setError('Failed to remove ingredient: ' + errorMessage);
    } finally {
      setPendingDeletions(prev => {
        const newSet = new Set(prev);
        newSet.delete(deletionKey);
        return newSet;
      });
    }
  };

  const handleUnCompleteBatch = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/batches/${batchId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ status: 'In Progress' }),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Failed to un-complete batch: HTTP ${res.status}, Response: ${text.slice(0, 50)}`);
      }
      setBatch((prev) => prev ? { ...prev, status: 'In Progress' } : null);
      setError(null);
      setSuccessMessage('Batch un-completed successfully');
      setTimeout(() => setSuccessMessage(null), 2000);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      console.error('Un-complete batch error:', err);
      setError('Failed to un-complete batch: ' + errorMessage);
    }
  };

  const handleProgressBatch = async () => {
    console.log('handleProgressBatch: Selected stage:', stage, 'Selected equipmentId:', selectedEquipmentId);
    if (!stage || (stage !== 'Completed' && stage !== 'Packaging' && !selectedEquipmentId)) {
      setError('Please select both stage and equipment (if not Completed or Packaging)');
      return;
    }
    if (stage === 'Packaging' && packagingActions.length > 0) {
      setError('Cannot progress to Packaging: existing packaging actions must be deleted first');
      return;
    }
    if (batch?.status === 'Completed') {
      setError('Cannot progress a completed batch');
      return;
    }
    try {
      const res = await fetch(`${API_BASE_URL}/api/batches/${batchId}/equipment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          equipmentId: stage === 'Completed' || stage === 'Packaging' ? null : selectedEquipmentId,
          stage,
        }),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Failed to progress batch: HTTP ${res.status}, Response: ${text.slice(0, 50)}`);
      }
      const data = await res.json();
      console.log('handleProgressBatch: API response:', data);
      setBatch((prev) => prev ? { ...prev, equipmentId: stage === 'Completed' || stage === 'Packaging' ? null : selectedEquipmentId, stage } : null);
      setStage('');
      setSelectedEquipmentId(null);
      setSuccessMessage(data.message || 'Batch progressed successfully');
      setTimeout(() => setSuccessMessage(null), 2000);
      setError(null);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      console.error('Progress batch error:', err);
      setError('Failed to progress batch: ' + errorMessage);
    }
  };

  const handlePackage = async () => {
  console.log('handlePackage: Attempting to package', { batchId, packageType, packageQuantity, packageLocation });

  if (!packageType || packageQuantity <= 0 || !packageLocation) {
    console.error('handlePackage: Invalid input', { packageType, packageQuantity, packageLocation });
    setError('Please select a package type, quantity (> 0), and location');
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

  const handleDeletePackaging = async (action: PackagingAction) => {
    if (!window.confirm(`Are you sure you want to delete the packaging action for ${action.quantity} ${action.packageType}?`)) return;
    console.log('handleDeletePackaging: Attempting to delete', {
      batchId,
      packageId: action.id,
      packageType: action.packageType,
      quantity: action.quantity,
    });
    try {
      const res = await fetch(`${API_BASE_URL}/api/batches/${batchId}/package/${action.id}`, {
        method: 'DELETE',
        headers: { Accept: 'application/json' },
      });
      if (!res.ok) {
        const text = await res.text();
        console.error('handleDeletePackaging: Failed to delete', {
          status: res.status,
          response: text.slice(0, 100),
        });
        throw new Error(`Failed to delete packaging: HTTP ${res.status}, Response: ${text.slice(0, 50)}`);
      }
      const data = await res.json();
      console.log('handleDeletePackaging: Success', data);
      setPackagingActions((prev) => prev.filter((a) => a.id !== action.id));
      setBatch((prev) => prev ? { ...prev, volume: data.newBatchVolume } : prev);
      await refreshInventory();
      setSuccessMessage('Packaging action deleted successfully');
      setTimeout(() => setSuccessMessage(null), 2000);
      setError(null);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      console.error('handleDeletePackaging: Error', err);
      setError(`Failed to delete packaging: ${errorMessage}`);
    }
  };

  const handlePrintBatchSheet = async () => {
    try {
      const batchRes = await fetch(`${API_BASE_URL}/api/batches/${batchId}`, {
        headers: { Accept: 'application/json' },
      });
      if (!batchRes.ok) {
        throw new Error('Failed to fetch batch details');
      }
      const batchData = await batchRes.json();
      const brewLogRes = await fetch(`${API_BASE_URL}/api/batches/${batchId}/brewlog`, {
        headers: { Accept: 'application/json' },
      });
      if (!brewLogRes.ok) {
        throw new Error('Failed to fetch brew log');
      }
      const brewLog = await batchRes.json();
      const product = products.find(p => p.id === batchData.productId)?.name || 'Unknown';
      const site = sites.find(s => s.siteId === batchData.siteId)?.name || batchData.siteId;
      const fermenterName = batchData.equipmentId ? equipment.find((e) => e.equipmentId === batchData.equipmentId)?.name || `Equipment ID: ${batchData.equipmentId}` : 'None';  
      const doc = new jsPDF();
      const margin = 8;
      let y = margin;
  
      doc.setFont('times', 'bold');
      doc.setFontSize(18);
      doc.setTextColor(33, 150, 243);
      doc.text(`Batch Sheet: ${batchData.batchId}`, 105, y, { align: 'center' });
      y += 8;
  
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.setTextColor(0);
      doc.text('Batch Details', margin, y);
      y += 4;
      doc.setLineWidth(0.5);
      doc.setDrawColor(33, 150, 243);
      doc.line(margin, y, 202 - margin, y);
      y += 8;
  
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      const batchDetails = [
        { label: 'Batch ID', value: batchData.batchId },
        { label: 'Product', value: product },
        { label: 'Recipe', value: batchData.recipeName || 'Unknown' },
        { label: 'Site', value: site },
        { label: 'Status', value: batchData.status },
        { label: 'Stage', value: batchData.stage || 'Brewing' },
        { label: 'Current Equipment', value: fermenterName },
        { label: 'Volume', value: batchData.volume ? `${batchData.volume.toFixed(2)} barrels` : 'N/A' },
        { label: 'Date', value: batchData.date },
      ];
      batchDetails.forEach(({ label, value }) => {
        doc.text(`${label}: ${value}`, margin, y);
        y += 6;
      });
  
      y += 4;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.text('Ingredients', margin, y);
      y += 4;
      doc.setLineWidth(0.5);
      doc.line(margin, y, 202 - margin, y);
      y += 8;
  
      if (batchData.ingredients.length > 0) {
        doc.autoTable({
          startY: y,
          head: [['Item', 'Quantity', 'Unit', 'Source']],
          body: batchData.ingredients.map((ing: Ingredient) => [
            ing.itemName,
            ing.quantity,
            ing.unit || 'lbs',
            ing.isRecipe ? 'Recipe' : 'Added',
          ]),
          theme: 'grid',
          headStyles: { fillColor: [33, 150, 243], textColor: 255, fontStyle: 'bold', font: 'helvetica' },
          styles: { fontSize: 9, cellPadding: 2, font: 'helvetica' },
          columnStyles: {
            0: { cellWidth: 80 },
            1: { cellWidth: 30 },
            2: { cellWidth: 30 },
            3: { cellWidth: 40 },
          },
          margin: { left: margin, right: margin },
        });
        y = doc.lastAutoTable.finalY + 8;
      } else {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        doc.text('None', margin, y);
        y += 8;
      }
  
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.text('Brew Day Log', margin, y);
      y += 4;
      doc.setLineWidth(0.5);
      doc.line(margin, y, 202 - margin, y);
      y += 8;
  
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      if (brewLog.date) {
        const logDetails = [
          { label: 'Date', value: brewLog.date },
          { label: 'Notes', value: brewLog.notes },
          { label: 'Temperature', value: brewLog.temperature ? `${brewLog.temperature} °C` : 'N/A' },
          { label: 'Gravity', value: brewLog.gravity || 'N/A' },
        ];
        logDetails.forEach(({ label, value }) => {
          if (label === 'Notes') {
            const splitNotes = doc.splitTextToSize(value, 184);
            doc.text(`${label}:`, margin, y);
            doc.text(splitNotes, margin + 20, y);
            y += splitNotes.length * 6;
          } else {
            doc.text(`${label}: ${value}`, margin, y);
            y += 6;
          }
        });
      } else {
        doc.text('No brew log available', margin, y);
        y += 8;
      }
  
      y += 4;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.text('Batch Actions', margin, y);
      y += 4;
      doc.setLineWidth(0.5);
      doc.line(margin, y, 202 - margin, y);
      y += 8;
  
      if (actions.length > 0) {
        actions.forEach((action) => {
          const timestamp = new Date(action.timestamp).toLocaleString();
          const actionText = `- ${action.action} (${timestamp})`;
          const splitAction = doc.splitTextToSize(actionText, 184);
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(10);
          doc.text(splitAction, margin, y);
          y += splitAction.length * 6;
        });
      } else {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        doc.text('No actions recorded', margin, y);
        y += 8;
      }
  
      doc.save(`batch_${batchData.batchId}_sheet.pdf`);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      console.error('Print batch sheet error:', err);
      setError('Failed to generate batch sheet: ' + errorMessage);
    }
  };

  if (!batch) return <div>Loading...</div>;

  const product = products.find(p => p.id === batch.productId);
  const site = sites.find(s => s.siteId === batch.siteId);
  const currentEquipment = equipment.find((e: Equipment) => e.equipmentId === batch.equipmentId);

  return (
    <div className="page-container">
      <h2>Batch Details: {batch.batchId}</h2>
      {error && <div className="error">{error}</div>}
      {successMessage && (
        <div style={{ color: '#28A745', backgroundColor: '#e6ffe6', padding: '10px', borderRadius: '4px', marginBottom: '10px', textAlign: 'center' }}>
          {successMessage}
        </div>
      )}
      <h3>Batch Management</h3>
      <div style={{ display: 'flex', gap: '20px', marginBottom: '20px', flexWrap: 'wrap' }}>
        <div>
          <input
            type="text"
            value={newBatchId}
            onChange={(e) => setNewBatchId(e.target.value)}
            placeholder="New Batch ID"
            style={{ padding: '10px', border: '1px solid #CCCCCC', borderRadius: '4px', fontSize: '16px', width: '200px', marginRight: '10px' }}
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
            Edit Batch Name
          </button>
        </div>
        <button
          onClick={handleCompleteBatch}
          disabled={batch.status === 'Completed'}
          style={{
            backgroundColor: batch.status === 'Completed' ? '#ccc' : '#2196F3',
            color: '#fff',
            padding: '10px 20px',
            border: 'none',
            borderRadius: '4px',
            cursor: batch.status === 'Completed' ? 'not-allowed' : 'pointer',
          }}
        >
          Complete Batch
        </button>
        <button
          onClick={handleUnCompleteBatch}
          disabled={batch.status !== 'Completed'}
          style={{
            backgroundColor: batch.status !== 'Completed' ? '#ccc' : '#2196F3',
            color: '#fff',
            padding: '10px 20px',
            border: 'none',
            borderRadius: '4px',
            cursor: batch.status !== 'Completed' ? 'not-allowed' : 'pointer',
          }}
        >
          Un-Complete Batch
        </button>
        <button
          onClick={handleDeleteBatch}
          disabled={batch.status === 'Completed'}
          style={{
            backgroundColor: batch.status === 'Completed' ? '#ccc' : '#F86752',
            color: '#fff',
            padding: '10px 20px',
            border: 'none',
            borderRadius: '4px',
            cursor: batch.status === 'Completed' ? 'not-allowed' : 'pointer',
          }}
        >
          Delete Batch
        </button>
        <button
          onClick={() => navigate(`/production/${batchId}/brewlog`)}
          style={{
            backgroundColor: '#2196F3',
            color: '#fff',
            padding: '10px 20px',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
          }}
        >
          Add Brew Day Log
        </button>
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
      </div>
      <div style={{ marginTop: '20px' }}>
        <h3>Progress Batch</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxWidth: '300px' }}>
        <select
          value={stage}
          onChange={(e) => {
            const newStage = e.target.value as typeof stage;
            console.log('Dropdown onChange: Selected stage:', newStage);
            setStage(newStage);
          }}
          style={{ padding: '10px', border: '1px solid #CCCCCC', borderRadius: '4px', fontSize: '16px', width: '100%' }}
          disabled={batch?.status === 'Completed'}
        >
          <option value="">Select Stage</option>
          {validStages.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <select
          value={selectedEquipmentId || ''}
          onChange={(e) => {
            const newEquipmentId = parseInt(e.target.value) || null;
            console.log('Dropdown onChange: Selected equipmentId:', newEquipmentId);
            setSelectedEquipmentId(newEquipmentId);
          }}
          style={{ padding: '10px', border: '1px solid #CCCCCC', borderRadius: '4px', fontSize: '16px', width: '100%' }}
          disabled={stage === 'Completed' || stage === 'Packaging' || !stage || batch?.status === 'Completed'}
        >
          <option value="">Select Equipment</option>
          {equipment.map((equip) => (
            <option key={equip.equipmentId} value={equip.equipmentId}>{equip.name}</option>
          ))}
        </select>
        {stage === 'Packaging' && (
  <>
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      <h4 style={{ margin: '0', fontSize: '16px' }}>Package Batch</h4>
      {batch?.status === 'Completed' ? (
        <p style={{ color: '#555' }}>Cannot package a completed batch.</p>
      ) : (
        <>
          <select
  value={packageType}
  onChange={(e) => setPackageType(e.target.value)}
  style={{ padding: '10px', border: '1px solid #CCCCCC', borderRadius: '4px', fontSize: '16px', width: '100%' }}
>
  <option value="">Select Package Type</option>
  {packageTypes
    .filter((pkg) => pkg.enabled)
    .sort((a, b) => a.name.localeCompare(b.name)) // Ensure client-side sorting
    .map((pkg) => (
      <option key={pkg.name} value={pkg.name}>{`${pkg.name} (${(pkg.volume * 31).toFixed(2)} gal)`}</option>
    ))}
</select>
          <input
            type="number"
            value={packageQuantity || ''}
            onChange={(e) => setPackageQuantity(parseInt(e.target.value) || 0)}
            placeholder="Quantity"
            min="1"
            style={{ padding: '10px', border: '1px solid #CCCCCC', borderRadius: '4px', fontSize: '16px', width: '100%' }}
          />
          <select
            value={packageLocation}
            onChange={(e) => setPackageLocation(e.target.value)}
            style={{ padding: '10px', border: '1px solid #CCCCCC', borderRadius: '4px', fontSize: '16px', width: '100%' }}
          >
            <option value="">Select Location</option>
            {locations.map((loc) => (
              <option key={loc.locationId} value={loc.locationId}>{loc.name}</option>
            ))}
          </select>
          <button
            onClick={handlePackage}
            disabled={!packageType || packageQuantity <= 0 || !packageLocation}
            style={{
              backgroundColor: !packageType || packageQuantity <= 0 || !packageLocation ? '#ccc' : '#28A745',
              color: '#fff',
              padding: '10px 20px',
              border: 'none',
              borderRadius: '4px',
              cursor: !packageType || packageQuantity <= 0 || !packageLocation ? 'not-allowed' : 'pointer',
              fontSize: '16px',
              width: '100%',
            }}
          >
            Package
          </button>
        </>
      )}
    </div>
    <div style={{ marginTop: '20px' }}>
      <h4 style={{ margin: '0', fontSize: '16px' }}>Packaging Actions</h4>
      {packagingActions.length === 0 ? (
        <p>No packaging actions recorded.</p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', backgroundColor: '#fff', borderRadius: '8px', marginTop: '10px' }}>
          <thead>
            <tr>
              <th style={{ padding: '10px', backgroundColor: '#f5f5f5', borderBottom: '1px solid #ddd', color: '#555' }}>Package Type</th>
              <th style={{ padding: '10px', backgroundColor: '#f5f5f5', borderBottom: '1px solid #ddd', color: '#555' }}>Quantity</th>
              <th style={{ padding: '10px', backgroundColor: '#f5f5f5', borderBottom: '1px solid #ddd', color: '#555' }}>Volume (Barrels)</th>
              <th style={{ padding: '10px', backgroundColor: '#f5f5f5', borderBottom: '1px solid #ddd', color: '#555' }}>Date</th>
              <th style={{ padding: '10px', backgroundColor: '#f5f5f5', borderBottom: '1px solid #ddd', color: '#555' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {packagingActions.map((action) => (
              <tr key={action.id}>
                <td style={{ padding: '10px' }}>{action.packageType}</td>
                <td style={{ padding: '10px' }}>{action.quantity}</td>
                <td style={{ padding: '10px' }}>{action.volume.toFixed(3)}</td>
                <td style={{ padding: '10px' }}>{action.date}</td>
                <td style={{ padding: '10px' }}>
                  {batch?.status === 'Completed' ? (
                    <span style={{ color: '#555' }}>Locked</span>
                  ) : (
                    <>
                      <button
                        onClick={() => setEditPackaging(action)}
                        style={{
                          backgroundColor: '#2196F3',
                          color: '#fff',
                          padding: '8px 12px',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontSize: '14px',
                          marginRight: '5px',
                        }}
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDeletePackaging(action)}
                        style={{
                          backgroundColor: '#F86752',
                          color: '#fff',
                          padding: '8px 12px',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontSize: '14px',
                        }}
                      >
                        Delete
                      </button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  </>
)}
<button
  onClick={handleProgressBatch}
  disabled={!stage || (stage !== 'Completed' && stage !== 'Packaging' && !selectedEquipmentId) || (stage === 'Packaging' && packagingActions.length > 0) || batch?.status === 'Completed'}
  style={{
    backgroundColor: (!stage || (stage !== 'Completed' && stage !== 'Packaging' && !selectedEquipmentId) || (stage === 'Packaging' && packagingActions.length > 0) || batch?.status === 'Completed') ? '#ccc' : '#2196F3',
    color: '#fff',
    padding: '10px 20px',
    border: 'none',
    borderRadius: '4px',
    cursor: (!stage || (stage !== 'Completed' && stage !== 'Packaging' && !selectedEquipmentId) || (stage === 'Packaging' && packagingActions.length > 0) || batch?.status === 'Completed') ? 'not-allowed' : 'pointer',
    fontSize: '16px',
    width: '100%',
  }}
>
  {stage ? `Progress to ${stage}` : 'Select Stage to Progress'}
</button>
        </div>
      </div>
      <div className="batch-details">
        <p><strong>Product:</strong> {product?.name || 'Unknown'}</p>
        <p><strong>Recipe:</strong> {batch.recipeName || 'Unknown'}</p>
        <p><strong>Site:</strong> {site?.name || batch.siteId}</p>
        <p><strong>Status:</strong> {batch.status}</p>
        <p><strong>Current Equipment:</strong> {batch?.equipmentId ? equipment.find((e) => e.equipmentId === batch.equipmentId)?.name || `Equipment ID: ${batch.equipmentId}` : 'None'}</p>
        <p><strong>Stage:</strong> {batch.stage || 'None'}</p>
        <p><strong>Volume:</strong> {batch.volume ? `${batch.volume.toFixed(2)} barrels` : 'N/A'}</p>
        <p><strong>Date:</strong> {batch.date}</p>
      </div>

      <h3>Ingredients</h3>
      <div className="batch-details">
        {batch && batch.ingredients && batch.ingredients.length > 0 ? (
          <table className="inventory-table">
            <thead>
              <tr>
                <th>Item</th>
                <th>Quantity</th>
                <th>Unit</th>
                <th>Source</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {batch.ingredients.map((ing: Ingredient, index: number) => {
                const deletionKey = `${ing.itemName}-${ing.quantity}-${ing.unit || 'lbs'}`;
                return (
                  <tr key={index}>
                    <td>{ing.itemName}</td>
                    <td>{ing.quantity}</td>
                    <td>{ing.unit || 'lbs'}</td>
                    <td>{ing.isRecipe ? 'Recipe' : 'Added'}</td>
                    <td>
                      {batch.status === 'Completed' ? (
                        <span style={{ color: '#555' }}>Locked</span>
                      ) : (
                        <button
                          onClick={() => handleRemoveIngredient(ing)}
                          disabled={pendingDeletions.has(deletionKey)}
                          style={{
                            backgroundColor: '#F86752',
                            color: '#fff',
                            padding: '8px 12px',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: pendingDeletions.has(deletionKey) ? 'not-allowed' : 'pointer',
                            opacity: pendingDeletions.has(deletionKey) ? 0.6 : 1,
                          }}
                        >
                          Remove
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <p>No ingredients</p>
        )}
        <div style={{ marginTop: '20px' }}>
          <h4>Add Ingredient</h4>
          {batch?.status === 'Completed' ? (
            <p style={{ color: '#555' }}>Cannot add ingredients to a completed batch.</p>
          ) : (
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
              <select
                value={newIngredient.itemName}
                onChange={(e) => setNewIngredient({ ...newIngredient, itemName: e.target.value })}
                style={{ padding: '10px', border: '1px solid #CCCCCC', borderRadius: '4px', fontSize: '16px', flex: '1', minWidth: '150px' }}
              >
                <option value="">Select Item</option>
                {items.filter(item => item.enabled).map((item) => (
                  <option key={item.name} value={item.name}>{item.name}</option>
                ))}
              </select>
              <input
                type="number"
                value={newIngredient.quantity || ''}
                onChange={(e) => setNewIngredient({ ...newIngredient, quantity: parseFloat(e.target.value) || 0 })}
                placeholder="Quantity"
                step="0.01"
                min="0"
                style={{ padding: '10px', border: '1px solid #CCCCCC', borderRadius: '4px', fontSize: '16px', width: '100px' }}
              />
              <select
                value={newIngredient.unit}
                onChange={(e) => setNewIngredient({ ...newIngredient, unit: e.target.value })}
                style={{ padding: '10px', border: '1px solid #CCCCCC', borderRadius: '4px', fontSize: '16px', flex: '1', minWidth: '100px' }}
              >
                <option value="lbs">lbs</option>
                <option value="kg">kg</option>
                <option value="oz">oz</option>
                <option value="gal">gal</option>
                <option value="l">l</option>
              </select>
              <button
                onClick={handleAddIngredient}
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
                Add
              </button>
            </div>
          )}
        </div>
      </div>

      <h3>Actions</h3>
      <div style={{ marginBottom: '20px' }}>
        {actions.length > 0 ? (
          <ul>
            {actions.map((action) => (
              <li key={action.id}>{action.action} - {new Date(action.timestamp).toLocaleString()}</li>
            ))}
          </ul>
        ) : (
          <p>No actions recorded</p>
        )}
        <div style={{ marginTop: '20px' }}>
          <h4>Add New Action</h4>
          <input
            type="text"
            value={newAction}
            onChange={(e) => setNewAction(e.target.value)}
            placeholder="Enter action (e.g., Added hops)"
            style={{ padding: '10px', border: '1px solid #CCCCCC', borderRadius: '4px', fontSize: '16px', width: '300px', marginRight: '10px' }}
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
              fontSize: '16px',
            }}
          >
            Add Action
          </button>
        </div>
      </div>

      {editPackaging && (
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
      <h3 style={{ color: '#555', marginBottom: '20px' }}>Edit Packaging Action</h3>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '15px' }}>
        <div>
          <label style={{ fontWeight: 'bold', color: '#555', display: 'block', marginBottom: '5px' }}>
            Package Type:
          </label>
          <input
            type="text"
            value={editPackaging.packageType}
            disabled
            style={{
              width: '100%',
              padding: '10px',
              border: '1px solid #CCCCCC',
              borderRadius: '4px',
              fontSize: '16px',
              boxSizing: 'border-box',
              color: '#000000',
              backgroundColor: '#F5F5F5',
            }}
          />
        </div>
        <div>
          <label style={{ fontWeight: 'bold', color: '#555', display: 'block', marginBottom: '5px' }}>
            Quantity:
          </label>
          <input
            type="number"
            value={editPackaging.quantity}
            onChange={(e) => setEditPackaging({ ...editPackaging, quantity: parseInt(e.target.value) || 0 })}
            min="0"
            style={{
              width: '100%',
              padding: '10px',
              border: '1px solid #CCCCCC',
              borderRadius: '4px',
              fontSize: '16px',
              boxSizing: 'border-box',
              color: '#000000',
              backgroundColor: '#FFFFFF',
            }}
          />
        </div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-around', marginTop: '20px' }}>
        <button
          onClick={async () => {
            console.log('Edit packaging: Attempting to update', {
              batchId,
              packageId: editPackaging.id,
              packageType: editPackaging.packageType,
              newQuantity: editPackaging.quantity,
            });
            try {
              const res = await fetch(`${API_BASE_URL}/api/batches/${batchId}/package/${editPackaging.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
                body: JSON.stringify({ quantity: editPackaging.quantity }),
              });
              if (!res.ok) {
                const text = await res.text();
                console.error('Edit packaging: Failed to update', {
                  status: res.status,
                  response: text.slice(0, 100),
                });
                throw new Error(`Failed to update packaging: HTTP ${res.status}, Response: ${text.slice(0, 50)}`);
              }
              const data = await res.json();
              console.log('Edit packaging success:', data);
              const packageVolume = packageTypes.find((pkg) => pkg.name === editPackaging.packageType)?.volume || 0;
              setPackagingActions((prev) =>
                prev.map((action) =>
                  action.id === editPackaging.id
                    ? { ...action, quantity: editPackaging.quantity, volume: editPackaging.quantity * packageVolume }
                    : action
                )
              );
              setBatch((prev) => prev ? { ...prev, volume: data.newBatchVolume } : prev);
              setEditPackaging(null);
              setSuccessMessage('Packaging action updated successfully');
              setTimeout(() => setSuccessMessage(null), 2000);
              setError(null);
              await refreshInventory();
            } catch (err: unknown) {
              const errorMessage = err instanceof Error ? err.message : 'Unknown error';
              console.error('Edit packaging error:', err);
              setError(`Failed to update packaging: ${errorMessage}`);
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
          Save
        </button>
        <button
          onClick={() => setEditPackaging(null)}
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
            <h3 style={{ color: '#F86752', marginBottom: '10px' }}>Volume Adjustment Required</h3>
            <p style={{ marginBottom: '20px' }}>{showVolumePrompt.message}</p>
            <div style={{ display: 'flex', justifyContent: 'space-around' }}>
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
                Yes
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
                No
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
            <h3 style={{ color: '#F86752', marginBottom: '10px' }}>Unpackaged Volume Detected</h3>
            <p style={{ marginBottom: '20px' }}>
              {showLossPrompt.volume.toFixed(3)} barrels remain unpackaged. Do you want to report a {showLossPrompt.volume.toFixed(3)} barrel loss?
            </p>
            <div style={{ display: 'flex', justifyContent: 'space-around' }}>
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
                Yes
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
                No
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BatchDetails;