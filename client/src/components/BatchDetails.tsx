import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Batch, Product, Site, Equipment, Ingredient } from '../types/interfaces';
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

const BatchDetails: React.FC = () => {
  const { batchId } = useParams<{ batchId: string }>();
  const navigate = useNavigate();
  const [batch, setBatch] = useState<Batch | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [items, setItems] = useState<{ name: string; type: string; enabled: number }[]>([]);
  const [actions, setActions] = useState<BatchAction[]>([]);
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [selectedEquipmentId, setSelectedEquipmentId] = useState<number | null>(null);
  const [newAction, setNewAction] = useState('');
  const [newBatchId, setNewBatchId] = useState('');
  const [newIngredient, setNewIngredient] = useState<Ingredient>({ itemName: '', quantity: 0, unit: 'lbs' });
  const [newIngredients, setNewIngredients] = useState<Ingredient[]>([{ itemName: '', quantity: 0, unit: 'lbs' }]);
  const [stage, setStage] = useState<'Mashing' | 'Boiling' | 'Fermenting' | 'Bright Tank' | 'Packaging' | 'Completed'>('Mashing');
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [pendingDeletions, setPendingDeletions] = useState<Set<string>>(new Set());

  useEffect(() => {
    const fetchData = async () => {
      try {
        const endpoints = [
          { url: `${API_BASE_URL}/api/batches/${batchId}`, setter: setBatch, name: 'batch', single: true },
          { url: `${API_BASE_URL}/api/products`, setter: setProducts, name: 'products' },
          { url: `${API_BASE_URL}/api/sites`, setter: setSites, name: 'sites' },
          { url: `${API_BASE_URL}/api/items`, setter: setItems, name: 'items' },
          { url: `${API_BASE_URL}/api/batches/${batchId}/actions`, setter: setActions, name: 'actions' },
          { url: batch?.siteId ? `${API_BASE_URL}/api/equipment?siteId=${batch.siteId}` : null, setter: setEquipment, name: 'equipment', single: false },
        ].filter(endpoint => endpoint.url !== null);
        const responses = await Promise.all(
          endpoints.map(({ url }) => fetch(url!, { headers: { Accept: 'application/json' } }))
        );
        for (let i = 0; i < responses.length; i++) {
          const res = responses[i];
          const { name, setter, single } = endpoints[i];
          if (!res.ok) {
            const text = await res.text();
            throw new Error(`Failed to fetch ${name}: HTTP ${res.status}, Response: ${text.slice(0, 50)}`);
          }
          const data = await res.json();
          setter(single ? data : data);
        }
        if (batch) {
          setSelectedEquipmentId(batch.equipmentId || null);
          setStage(batch.stage || 'Mashing');
          setNewIngredients(batch.additionalIngredients || [{ itemName: '', quantity: 0, unit: 'lbs' }]);
        }
      } catch (err: any) {
        console.error('Fetch error:', err);
        setError('Failed to load batch details: ' + err.message);
      }
    };
    fetchData();
  }, [batchId, batch?.siteId]);

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
    } catch (err: any) {
      console.error('Add action error:', err);
      setError('Failed to add action: ' + err.message);
    }
  };

  const handleCompleteBatch = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/batches/${batchId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ status: 'Completed' }),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Failed to complete batch: HTTP ${res.status}, Response: ${text.slice(0, 50)}`);
      }
      setBatch((prev) => prev ? { ...prev, status: 'Completed' } : null);
      setError(null);
      setSuccessMessage('Batch completed successfully');
      setTimeout(() => setSuccessMessage(null), 2000);
    } catch (err: any) {
      console.error('Complete batch error:', err);
      setError('Failed to complete batch: ' + err.message);
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
    } catch (err: any) {
      console.error('Update batch ID error:', err);
      setError('Failed to update batch ID: ' + err.message);
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
    } catch (err: any) {
      console.error('Delete batch error:', err);
      setError('Failed to delete batch: ' + err.message);
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
    } catch (err: any) {
      console.error('Add ingredient error:', err);
      setError('Failed to add ingredient: ' + err.message);
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
    } catch (err: any) {
      console.error('Remove ingredient error:', err);
      setError('Failed to remove ingredient: ' + err.message);
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
    } catch (err: any) {
      console.error('Un-complete batch error:', err);
      setError('Failed to un-complete batch: ' + err.message);
    }
  };

  const handleProgressBatch = async () => {
    if (!stage || (stage !== 'Completed' && !selectedEquipmentId)) {
      setError('Please select stage and equipment (if not Completed)');
      return;
    }
    try {
      const res = await fetch(`${API_BASE_URL}/api/batches/${batchId}/equipment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          equipmentId: stage === 'Completed' ? null : selectedEquipmentId,
          ingredients: stage === 'Boiling' ? newIngredients.filter(ing => ing.itemName && ing.quantity > 0) : [],
          stage,
        }),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Failed to progress batch: HTTP ${res.status}, Response: ${text.slice(0, 50)}`);
      }
      const data = await res.json();
      setBatch((prev) => prev && (stage === 'Completed' || selectedEquipmentId) ? { ...prev, equipmentId: stage === 'Completed' ? null : selectedEquipmentId, stage } : prev);
      setSuccessMessage(data.message || 'Batch progressed successfully');
      setTimeout(() => setSuccessMessage(null), 2000);
      setError(null);
    } catch (err: any) {
      console.error('Progress batch error:', err);
      setError('Failed to progress batch: ' + err.message);
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
      const brewLog = await brewLogRes.json();
      const product = products.find(p => p.id === batchData.productId)?.name || 'Unknown';
      const site = sites.find(s => s.siteId === batchData.siteId)?.name || batchData.siteId;

      // Create PDF
      const doc = new jsPDF();
      const margin = 8;
      let y = margin;

      // Title
      doc.setFont('times', 'bold');
      doc.setFontSize(18);
      doc.setTextColor(33, 150, 243); // Blue #2196F3
      doc.text(`Batch Sheet: ${batchData.batchId}`, 105, y, { align: 'center' });
      y += 8;

      // Batch Details Section
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
        { label: 'Stage', value: batchData.stage || 'Mashing' },
        { label: 'Date', value: batchData.date },
      ];
      batchDetails.forEach(({ label, value }) => {
        doc.text(`${label}: ${value}`, margin, y);
        y += 6;
      });

      // Ingredients Section
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

      // Brew Day Log Section
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

      // Batch Actions Section
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

      // Save PDF
      doc.save(`batch_${batchData.batchId}_sheet.pdf`);
    } catch (err: any) {
      console.error('Print batch sheet error:', err);
      setError('Failed to generate batch sheet: ' + err.message);
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
      {successMessage && <div style={{ color: '#28A745', backgroundColor: '#e6ffe6', padding: '10px', borderRadius: '4px', marginBottom: '10px', textAlign: 'center' }}>{successMessage}</div>}
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
            onChange={(e) => setStage(e.target.value as typeof stage)}
            style={{ padding: '10px', border: '1px solid #CCCCCC', borderRadius: '4px', fontSize: '16px', width: '100%' }}
          >
            <option value="Mashing">Mashing</option>
            <option value="Boiling">Boiling</option>
            <option value="Fermenting">Fermenting</option>
            <option value="Bright Tank">Bright Tank</option>
            <option value="Packaging">Packaging</option>
            <option value="Completed">Completed</option>
          </select>
          <select
            value={selectedEquipmentId || ''}
            onChange={(e) => setSelectedEquipmentId(parseInt(e.target.value) || null)}
            style={{ padding: '10px', border: '1px solid #CCCCCC', borderRadius: '4px', fontSize: '16px', width: '100%' }}
            disabled={stage === 'Completed'}
          >
            <option value="">Select Equipment</option>
            {equipment.map((equip) => (
              <option key={equip.equipmentId} value={equip.equipmentId}>{equip.name}</option>
            ))}
          </select>
          {stage === 'Boiling' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <h4 style={{ margin: '0', fontSize: '16px' }}>Add Ingredients (Optional)</h4>
              <select
                value={newIngredients[0]?.itemName || ''}
                onChange={(e) => setNewIngredients([{ ...newIngredients[0], itemName: e.target.value }])}
                style={{ padding: '10px', border: '1px solid #CCCCCC', borderRadius: '4px', fontSize: '16px', width: '100%' }}
              >
                <option value="">Select Item</option>
                {items.filter(item => item.enabled).map((item) => (
                  <option key={item.name} value={item.name}>{item.name}</option>
                ))}
              </select>
              <input
                type="number"
                value={newIngredients[0]?.quantity || ''}
                onChange={(e) => setNewIngredients([{ ...newIngredients[0], quantity: parseFloat(e.target.value) || 0 }])}
                placeholder="Quantity"
                step="0.01"
                min="0"
                style={{ padding: '10px', border: '1px solid #CCCCCC', borderRadius: '4px', fontSize: '16px', width: '100%' }}
              />
              <select
                value={newIngredients[0]?.unit || 'lbs'}
                onChange={(e) => setNewIngredients([{ ...newIngredients[0], unit: e.target.value }])}
                style={{ padding: '10px', border: '1px solid #CCCCCC', borderRadius: '4px', fontSize: '16px', width: '100%' }}
              >
                <option value="lbs">lbs</option>
                <option value="kg">kg</option>
                <option value="oz">oz</option>
                <option value="gal">gal</option>
                <option value="l">l</option>
              </select>
            </div>
          )}
          <button
            onClick={handleProgressBatch}
            style={{
              backgroundColor: '#2196F3',
              color: '#fff',
              padding: '10px 20px',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '16px',
              width: '100%',
            }}
          >
            Progress to {stage}
          </button>
        </div>
      </div>
      <div className="batch-details">
        <p><strong>Product:</strong> {product?.name || 'Unknown'}</p>
        <p><strong>Recipe:</strong> {batch.recipeName || 'Unknown'}</p>
        <p><strong>Site:</strong> {site?.name || batch.siteId}</p>
        <p><strong>Status:</strong> {batch.status}</p>
        <p><strong>Current Equipment:</strong> {currentEquipment?.name || (batch?.equipmentId ? `Equipment ID: ${batch.equipmentId}` : 'None')}</p>
        <p><strong>Stage:</strong> {batch.stage || 'Mashing'}</p>
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
    </div>
  );
};

export default BatchDetails;