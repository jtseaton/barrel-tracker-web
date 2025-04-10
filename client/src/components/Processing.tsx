import React, { useState, useEffect } from 'react';
import { InventoryItem, PackageForm } from '../types/interfaces';

interface ProcessingProps {
  inventory: InventoryItem[];
  refreshInventory: () => Promise<void>;
}

const Processing: React.FC<ProcessingProps> = ({ inventory, refreshInventory }) => {
  const [packageForm, setPackageForm] = useState<PackageForm>({
    batchId: '',
    product: 'Old Black Bear Vodka',
    proofGallons: '',
    targetProof: '80',
    netContents: '',
    alcoholContent: '',
    healthWarning: false,
  });
  const [editingBatchId, setEditingBatchId] = useState<string | null>(null);
  const [editedBatchId, setEditedBatchId] = useState<string>('');
  const [productionError, setProductionError] = useState<string | null>(null);

  const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:3000';

  useEffect(() => {
    console.log('Processing inventory:', inventory);
  }, [inventory]);

  const getIdentifier = (item: InventoryItem) => `${item.item}-${item.lotNumber}`;

  const handlePackage = async () => {
    if (!packageForm.batchId || !packageForm.proofGallons || !packageForm.targetProof || !packageForm.netContents || !packageForm.alcoholContent || !packageForm.healthWarning) {
      setProductionError('Please fill in all fields and confirm health warning.');
      return;
    }
    const sourceProofGallons = parseFloat(packageForm.proofGallons);
    const targetProof = parseFloat(packageForm.targetProof);
    const bottleSizeGal = 0.198129;
    const sourceItem = inventory.find((item) => getIdentifier(item) === packageForm.batchId.trim() && item.account === 'Processing');
    if (!sourceItem) {
      setProductionError('Batch not found in Processing!');
      return;
    }
    const sourceProof = parseFloat(sourceItem.proof || '0');
    const sourceVolume = sourceProofGallons / (sourceProof / 100);
    const targetVolume = sourceProofGallons / (targetProof / 100);
    const waterVolume = targetVolume - sourceVolume;
    const shrinkageFactor = 0.98;
    const finalVolume = targetVolume * shrinkageFactor;
    const bottleCount = Math.floor(finalVolume / bottleSizeGal);
    const finalProofGallons = bottleCount * bottleSizeGal * (targetProof / 100);
  
    try {
      const res = await fetch(`${API_BASE_URL}/api/package`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          batchId: packageForm.batchId,
          product: packageForm.product,
          proofGallons: finalProofGallons.toFixed(2),
          targetProof: targetProof.toFixed(2),
          waterVolume: waterVolume.toFixed(2),
          bottleCount,
          netContents: packageForm.netContents,
          alcoholContent: packageForm.alcoholContent,
          healthWarning: packageForm.healthWarning,
          toAccount: 'Processing',
          date: new Date().toISOString().split('T')[0],
        }),
      });
      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`HTTP error! status: ${res.status}, body: ${errorText}`);
      }
      const responseData = await res.json();
      console.log('Package response:', responseData);
      await refreshInventory();
      setPackageForm({
        batchId: '',
        product: 'Old Black Bear Vodka',
        proofGallons: '',
        targetProof: '80',
        netContents: '',
        alcoholContent: '',
        healthWarning: false,
      });
      setProductionError(null);
    } catch (err: any) {
      console.error('Package error:', err);
      setProductionError('Failed to package item: ' + err.message);
    }
  };

  const handleBatchIdUpdate = async (oldBatchId: string) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/update-batch-id`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ oldBatchId, newBatchId: editedBatchId }),
      });
      if (!res.ok) throw new Error('Failed to update batch ID');
      await refreshInventory();
      setEditingBatchId(null);
      setEditedBatchId('');
      setProductionError(null);
    } catch (err: any) {
      console.error('Update error:', err);
      setProductionError('Failed to update batch ID: ' + err.message);
    }
  };

  return (
    <div>
      <h2>Processing</h2>
      <div>
        <h3>Package Product</h3>
        <input type="text" placeholder="Batch ID in Processing (e.g., Spirits-NGS123)" value={packageForm.batchId} onChange={(e) => setPackageForm({ ...packageForm, batchId: e.target.value })} />
        <select value={packageForm.product} onChange={(e) => setPackageForm({ ...packageForm, product: e.target.value })}>
          <option value="Old Black Bear Vodka">Old Black Bear Vodka (Vodka)</option>
          <option value="Old Black Bear Gin">Old Black Bear Gin (Gin)</option>
          <option value="Old Black Bear Rum">Old Black Bear Rum (Rum)</option>
          <option value="Shine-O-Mite">Shine-O-Mite (Moonshine)</option>
        </select>
        <input type="number" placeholder="Proof Gallons" value={packageForm.proofGallons} onChange={(e) => setPackageForm({ ...packageForm, proofGallons: e.target.value })} step="0.01" />
        <input type="number" placeholder="Target Proof" value={packageForm.targetProof} onChange={(e) => setPackageForm({ ...packageForm, targetProof: e.target.value })} step="0.01" />
        <input type="text" placeholder="Net Contents" value={packageForm.netContents} onChange={(e) => setPackageForm({ ...packageForm, netContents: e.target.value })} />
        <input type="text" placeholder="Alcohol Content" value={packageForm.alcoholContent} onChange={(e) => setPackageForm({ ...packageForm, alcoholContent: e.target.value })} />
        <label>
          <input type="checkbox" checked={packageForm.healthWarning} onChange={(e) => setPackageForm({ ...packageForm, healthWarning: e.target.checked })} />
          Include Health Warning (Required)
        </label>
        <button onClick={handlePackage}>Complete Packaging</button>
        {productionError && <p style={{ color: 'red' }}>{productionError}</p>}
      </div>
      <h2>Processing Inventory</h2>
      <h3>Liquid in Processing</h3>
      <table>
        <thead>
          <tr>
            <th>Batch ID</th><th>Type</th><th>Quantity (WG)</th><th>Proof</th><th>Proof Gallons</th><th>Date Received</th><th>Source</th><th>DSP Number</th><th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {inventory.filter((item) => item.account === 'Processing' && item.status === 'Processing').map((item) => (
            <tr key={getIdentifier(item)}>
              <td>
                {editingBatchId === getIdentifier(item) ? (
                  <input type="text" value={editedBatchId} onChange={(e) => setEditedBatchId(e.target.value)} />
                ) : (
                  getIdentifier(item)
                )}
              </td>
              <td>{item.type}</td>
              <td>{item.quantity || '0.00'}</td>
              <td>{item.proof || '0.00'}</td>
              <td>{item.proofGallons || '0.00'}</td>
              <td>{item.receivedDate || 'N/A'}</td>
              <td>{item.source || 'N/A'}</td>
              <td>{item.dspNumber || 'N/A'}</td>
              <td>
                {editingBatchId === getIdentifier(item) ? (
                  <>
                    <button onClick={() => handleBatchIdUpdate(getIdentifier(item))}>Save</button>
                    <button onClick={() => setEditingBatchId(null)}>Cancel</button>
                  </>
                ) : (
                  <button onClick={() => { setEditingBatchId(getIdentifier(item)); setEditedBatchId(getIdentifier(item)); }}>Edit</button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <h3>Bottled in Processing</h3>
      <table>
        <thead>
          <tr>
            <th>Batch ID</th><th>Type</th><th>Quantity (WG)</th><th>Proof</th><th>Proof Gallons</th><th>Date Packaged</th><th>Source</th><th>DSP Number</th><th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {inventory.filter((item) => item.account === 'Processing' && item.status === 'Packaged').map((item) => (
            <tr key={getIdentifier(item)}>
              <td>
                {editingBatchId === getIdentifier(item) ? (
                  <input type="text" value={editedBatchId} onChange={(e) => setEditedBatchId(e.target.value)} />
                ) : (
                  getIdentifier(item)
                )}
              </td>
              <td>{item.type}</td>
              <td>{item.quantity || '0.00'}</td>
              <td>{item.proof || '0.00'}</td>
              <td>{item.proofGallons || '0.00'}</td>
              <td>{item.receivedDate || 'N/A'}</td>
              <td>{item.source || 'N/A'}</td>
              <td>{item.dspNumber || 'N/A'}</td>
              <td>
                {editingBatchId === getIdentifier(item) ? (
                  <>
                    <button onClick={() => handleBatchIdUpdate(getIdentifier(item))}>Save</button>
                    <button onClick={() => setEditingBatchId(null)}>Cancel</button>
                  </>
                ) : (
                  <button onClick={() => { setEditingBatchId(getIdentifier(item)); setEditedBatchId(getIdentifier(item)); }}>Edit</button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default Processing;