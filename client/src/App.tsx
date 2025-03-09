import React, { useState, useEffect, useCallback } from 'react';
import { BrowserRouter as Router, Route, Routes, Link, useNavigate } from 'react-router-dom';
import * as XLSX from 'xlsx';
import './App.css';

const OUR_DSP = 'DSP-AL-20010';

// Enums
enum Status {
  Received = 'Received',
  Stored = 'Stored',
  Processing = 'Processing',
  Packaged = 'Packaged',
}

enum Unit {
  Pounds = 'lbs',
  Gallons = 'gallons',
  Count = 'count',
}

enum MaterialType {
  Grain = 'Grain',
  Yeast = 'Yeast',
  Spirits = 'Spirits',
  Bottles = 'Bottles',
  Labels = 'Labels',
  Caps = 'Caps',
  Other = 'Other',
}

// Interfaces
interface InventoryItem {
  identifier?: string;
  account: string;
  type: MaterialType;
  quantity: string;
  unit: string;
  proof?: string;
  proofGallons?: string;
  receivedDate: string;
  source: string;
  dspNumber: string;
  status: Status;
  description?: string; // Added for "Other" type
}

interface Transaction {
  action: string;
  proofGallons: number;
  type: string;
  date: string;
  barrelId?: string;
  toAccount?: string;
}

interface ReportData {
  month?: string;
  date?: string;
  totalReceived: number;
  totalProcessed: number;
  totalMoved?: number;
  totalRemoved?: number;
  byType?: { [key: string]: number };
  transactions?: Transaction[];
}

interface TankSummary {
  barrelId: string;
  type: string;
  proofGallons: string;
  proof: string;
  totalProofGallonsLeft: string;
  date: string;
  fromAccount?: string;
  toAccount: string;
  serialNumber: string;
  producingDSP: string;
  waterVolume?: string;
  bottleCount?: number;
}

interface DailySummaryItem {
  account: string;
  totalProofGallons: string;
}

interface ReceiveForm {
  identifier?: string;
  account: string;
  materialType: MaterialType;
  quantity: string;
  unit: Unit;
  proof?: string;
  source: string;
  dspNumber: string;
  receivedDate: string;
  description?: string; // Added for "Other" type
}

interface MoveForm {
  identifier: string;
  toAccount: string;
  proofGallons: string;
}

interface PackageForm {
  batchId: string;
  product: string;
  proofGallons: string;
  targetProof: string;
  netContents: string;
  alcoholContent: string;
  healthWarning: boolean;
}

interface LossForm {
  identifier: string;
  quantityLost: string;
  proofGallonsLost: string;
  reason: string;
  date: string;
}

const App: React.FC = () => {
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [moveForm, setMoveForm] = useState<MoveForm>({
    identifier: '',
    toAccount: 'Storage',
    proofGallons: '',
  });
  const [packageForm, setPackageForm] = useState<PackageForm>({
    batchId: '',
    product: 'Old Black Bear Vodka',
    proofGallons: '',
    targetProof: '80',
    netContents: '',
    alcoholContent: '',
    healthWarning: false,
  });
  const [lossForm, setLossForm] = useState<LossForm>({
    identifier: '',
    quantityLost: '',
    proofGallonsLost: '',
    reason: '',
    date: new Date().toISOString().split('T')[0],
  });
  const [report, setReport] = useState<ReportData | null>(null);
  const [reportMonth, setReportMonth] = useState(new Date().toISOString().slice(0, 7));
  const [reportDate, setReportDate] = useState(new Date().toISOString().split('T')[0]);
  const [dailySummary, setDailySummary] = useState<DailySummaryItem[]>([]);
  const [editingBatchId, setEditingBatchId] = useState<string | null>(null);
  const [editedBatchId, setEditedBatchId] = useState<string>('');
  const [activeSection, setActiveSection] = useState('Home');
  const [menuOpen, setMenuOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [showMoveModal, setShowMoveModal] = useState(false);
  const [showLossModal, setShowLossModal] = useState(false);
  const [productionError, setProductionError] = useState<string | null>(null);

  const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:3000';

  const fetchInventory = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/inventory`, {
        headers: { 'Content-Type': 'application/json' },
      });
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
      const data = await res.json();
      console.log('Fetched inventory data:', data);
      setInventory(data);
    } catch (err: any) {
      console.error('Fetch inventory error:', err);
    }
  }, [API_BASE_URL]);

  const fetchDailySummary = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/daily-summary`, {
        headers: { 'Content-Type': 'application/json' },
      });
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
      const data = await res.json();
      setDailySummary(data);
    } catch (err: any) {
      console.error('Fetch daily summary error:', err);
    }
  }, [API_BASE_URL]);

  useEffect(() => {
    fetchInventory();
    fetchDailySummary();
  }, [fetchInventory, fetchDailySummary]);

  useEffect(() => {
    setTimeout(() => setIsLoading(false), 4000);
  }, []);

  useEffect(() => {
    console.log('Inventory state updated:', inventory);
  }, [inventory]);

  const fetchMonthlyReport = async () => {
    console.log('Fetching monthly report for:', reportMonth);
    try {
      const res = await fetch(`${API_BASE_URL}/api/report/monthly?month=${reportMonth}`);
      if (!res.ok) throw new Error(`Failed to fetch report: ${res.status}`);
      const data = await res.json();
      console.log('Monthly report data:', data);
      setReport(data);
    } catch (err: any) {
      console.error('Report error:', err);
    }
  };

  const fetchDailyReport = async () => {
    console.log('Fetching daily report for:', reportDate);
    try {
      const res = await fetch(`${API_BASE_URL}/api/report/daily?date=${reportDate}`);
      if (!res.ok) throw new Error(`Failed to fetch report: ${res.status}`);
      const data = await res.json();
      console.log('Daily report data:', data);
      setReport(data);
    } catch (err: any) {
      console.error('Daily report error:', err);
    }
  };

  const handleMove = async () => {
    if (!moveForm.identifier || !moveForm.proofGallons) {
      console.log('Invalid move request: missing identifier or proofGallons');
      setProductionError('Please fill in Identifier and Proof Gallons.');
      return;
    }
    console.log('Sending move request:', moveForm);
    try {
      const res = await fetch(`${API_BASE_URL}/api/move`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...moveForm,
          proofGallons: parseFloat(moveForm.proofGallons),
        }),
      });
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
      const data = await res.json();
      console.log('Move response:', data);
      if (data.batchId) setPackageForm((prev) => ({ ...prev, batchId: data.batchId }));
      await fetchInventory();
      if (data.tankSummary) exportTankSummaryToExcel(data.tankSummary);
      setMoveForm({ identifier: '', toAccount: 'Storage', proofGallons: '' });
      setShowMoveModal(false);
      setProductionError(null);
    } catch (err: any) {
      console.error('Move error:', err);
      setProductionError('Failed to move item: ' + err.message);
    }
  };

  const handlePackage = async () => {
    if (
      !packageForm.batchId ||
      !packageForm.proofGallons ||
      !packageForm.targetProof ||
      !packageForm.netContents ||
      !packageForm.alcoholContent ||
      !packageForm.healthWarning
    ) {
      console.log('Invalid package request:', packageForm);
      setProductionError('Please fill in all fields and confirm health warning.');
      return;
    }
    const sourceProofGallons = parseFloat(packageForm.proofGallons);
    const targetProof = parseFloat(packageForm.targetProof);
    const bottleSizeGal = 0.198129;

    const sourceItem = inventory.find(
      (item) => item.identifier === packageForm.batchId.trim() && item.account === 'Processing'
    );
    if (!sourceItem) {
      console.log('Batch not found in Processing. Entered Batch ID:', packageForm.batchId);
      console.log('Processing inventory:', inventory.filter((item) => item.account === 'Processing'));
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

    console.log('Packaging calc:', {
      batchId: packageForm.batchId,
      sourceProofGallons,
      sourceProof,
      targetProof,
      sourceVolume,
      targetVolume,
      waterVolume,
      finalVolume,
      bottleCount,
      finalProofGallons,
    });
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
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
      const data = await res.json();
      console.log('Package response:', data);
      await fetchInventory();
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

  const handleRecordLoss = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/record-loss`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(lossForm),
      });
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
      await fetchInventory();
      setLossForm({
        identifier: '',
        quantityLost: '',
        proofGallonsLost: '',
        reason: '',
        date: new Date().toISOString().split('T')[0],
      });
      setShowLossModal(false);
      setProductionError(null);
    } catch (err: any) {
      console.error('Record loss error:', err);
      setProductionError('Failed to record loss: ' + err.message);
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
      await fetchInventory();
      setEditingBatchId(null);
      setEditedBatchId('');
      setProductionError(null);
    } catch (err: any) {
      console.error('Update error:', err);
      setProductionError('Failed to update batch ID: ' + err.message);
    }
  };

  const handlePhysicalInventory = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/physical-inventory`, { method: 'POST' });
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
      const data = await res.json();
      alert(`Physical inventory recorded at ${data.timestamp}`);
    } catch (err: any) {
      console.error('Physical inventory error:', err);
      alert('Failed to record physical inventory: ' + err.message);
    }
  };

  const exportToExcel = () => {
    if (!report || !report.month) return;
    const wsData = [
      ['TTB F 5110.40 - Monthly Report', report.month],
      [''],
      ['Total Received (PG)', report.totalReceived.toFixed(2)],
      ['Total Processed (PG)', report.totalProcessed.toFixed(2)],
      ['Total Moved (PG)', (report.totalMoved || 0).toFixed(2)],
      ['Total Removed (PG)', (report.totalRemoved || 0).toFixed(2)],
      [''],
      ['Processed by Type (PG)'],
      ...(report.byType ? Object.entries(report.byType).map(([type, pg]) => [type, Number(pg).toFixed(2)]) : []),
      [''],
      ['Transactions'],
      ['Action', 'Proof Gallons', 'Type', 'Date', 'Barrel ID', 'To Account'],
      ...(report.transactions || []).map((t: Transaction) => [
        t.action,
        Number(t.proofGallons).toFixed(2),
        t.type,
        t.date,
        t.barrelId || 'N/A',
        t.toAccount || 'N/A',
      ]),
    ];
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Monthly Report');
    XLSX.writeFile(wb, `Monthly_Report_${report.month}.xlsx`);
  };

  const exportTankSummaryToExcel = (tankSummary: TankSummary) => {
    console.log('Starting exportTankSummaryToExcel with:', tankSummary);
    try {
      const wsData = [
        [`Tank Summary Report - ${tankSummary.serialNumber}`],
        [''],
        ['Barrel ID:', tankSummary.barrelId],
        ['Date:', tankSummary.date],
        ['Type:', tankSummary.type],
        ['Proof:', Number(tankSummary.proof).toFixed(2)],
        ['Proof Gallons Moved:', Number(tankSummary.proofGallons).toFixed(2)],
        ['Total Proof Gallons Left:', Number(tankSummary.totalProofGallonsLeft).toFixed(2)],
        ['Producing DSP:', tankSummary.producingDSP],
        ['To Account:', tankSummary.toAccount],
        ...(tankSummary.fromAccount ? [['From Account:', tankSummary.fromAccount]] : []),
        ...(tankSummary.waterVolume ? [['Water Added (gal):', tankSummary.waterVolume]] : []),
        ...(tankSummary.bottleCount ? [['Bottle Count (750ml):', tankSummary.bottleCount]] : []),
        [''],
        [''],
        ['I certify under penalty of perjury that the information provided is true and correct.'],
        ['Signature:', '____________________'],
        ['Date:', '____________________'],
      ];
      const ws = XLSX.utils.aoa_to_sheet(wsData);
      const labelCells = [
        'A1', 'A3', 'A4', 'A5', 'A6', 'A7', 'A8', 'A9', 'A10',
        ...(tankSummary.fromAccount ? ['A11'] : []),
        ...(tankSummary.waterVolume ? ['A12'] : []),
        ...(tankSummary.bottleCount ? ['A13'] : []),
        'A15', 'A16',
      ];
      labelCells.forEach((cell) => {
        if (ws[cell]) {
          ws[cell].s = {
            font: { bold: true },
            fill: { fgColor: { rgb: 'FFFF00' } },
            border: {
              top: { style: 'thin', color: { rgb: '000000' } },
              bottom: { style: 'thin', color: { rgb: '000000' } },
              left: { style: 'thin', color: { rgb: '000000' } },
              right: { style: 'thin', color: { rgb: '000000' } },
            },
          };
        }
      });
      if (ws['A1']) {
        ws['A1'].s = {
          font: { bold: true },
          fill: { fgColor: { rgb: 'FFFF00' } },
          alignment: { horizontal: 'center' },
          border: {
            top: { style: 'thin', color: { rgb: '000000' } },
            bottom: { style: 'thin', color: { rgb: '000000' } },
            left: { style: 'thin', color: { rgb: '000000' } },
            right: { style: 'thin', color: { rgb: '000000' } },
          },
        };
      }
      if (ws['A15']) {
        ws['A15'].s = {
          font: { bold: true },
          alignment: { horizontal: 'left', wrapText: true },
        };
      }
      ws['!cols'] = [{ wch: 30 }, { wch: 35 }];
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Tank Summary');
      const filename = `${tankSummary.barrelId}_Tank_Summary_${tankSummary.serialNumber}.xlsx`;
      console.log('Writing file:', filename);
      XLSX.writeFile(wb, filename);
      console.log('Export successful:', filename);
    } catch (err: any) {
      console.error('Export failed:', err);
      alert('Failed to export tank summary: ' + err.message);
    }
  };

  // Render Section Function
  const renderSection = () => {
    switch (activeSection) {
      case 'Home':
        return (
          <div>
            <h2>Welcome to Tilly - Distillery Dog</h2>
            <p>Select a section to manage your distillery operations.</p>
          </div>
        );
      case 'Production':
        return (
          <div>
            <h2>Production</h2>
            <p>Production features coming soon.</p>
          </div>
        );
      case 'Inventory':
        return (
          <div>
            <h2>Inventory Management</h2>
            <div style={{ marginBottom: '20px' }}>
              <Link to="/receive">
                <button>Receive Inventory</button>
              </Link>
              <button onClick={() => setShowMoveModal(true)} style={{ marginLeft: '10px' }}>
                Move Inventory
              </button>
              <button onClick={() => setShowLossModal(true)} style={{ marginLeft: '10px' }}>
                Record Loss
              </button>
            </div>
            {showMoveModal && (
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
                }}
              >
                <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '5px' }}>
                  <h3>Move Inventory</h3>
                  <input
                    type="text"
                    placeholder="Identifier (e.g., GNS250329)"
                    value={moveForm.identifier}
                    onChange={(e) => setMoveForm({ ...moveForm, identifier: e.target.value })}
                  />
                  <select
                    value={moveForm.toAccount}
                    onChange={(e) => setMoveForm({ ...moveForm, toAccount: e.target.value })}
                  >
                    <option value="Production">Production</option>
                    <option value="Storage">Storage</option>
                    <option value="Processing">Processing</option>
                  </select>
                  <input
                    type="number"
                    placeholder="Proof Gallons to Move"
                    value={moveForm.proofGallons}
                    onChange={(e) => setMoveForm({ ...moveForm, proofGallons: e.target.value })}
                    step="0.01"
                  />
                  <button onClick={handleMove}>Submit</button>
                  <button onClick={() => setShowMoveModal(false)} style={{ marginLeft: '10px' }}>
                    Cancel
                  </button>
                  {productionError && <p style={{ color: 'red' }}>{productionError}</p>}
                </div>
              </div>
            )}
            {showLossModal && (
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
                }}
              >
                <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '5px' }}>
                  <h3>Record Loss</h3>
                  <input
                    type="text"
                    placeholder="Identifier"
                    value={lossForm.identifier}
                    onChange={(e) => setLossForm({ ...lossForm, identifier: e.target.value })}
                  />
                  <input
                    type="number"
                    placeholder="Quantity Lost"
                    value={lossForm.quantityLost}
                    onChange={(e) => setLossForm({ ...lossForm, quantityLost: e.target.value })}
                    step="0.01"
                  />
                  <input
                    type="number"
                    placeholder="Proof Gallons Lost"
                    value={lossForm.proofGallonsLost}
                    onChange={(e) => setLossForm({ ...lossForm, proofGallonsLost: e.target.value })}
                    step="0.01"
                  />
                  <input
                    type="text"
                    placeholder="Reason for Loss"
                    value={lossForm.reason}
                    onChange={(e) => setLossForm({ ...lossForm, reason: e.target.value })}
                  />
                  <input
                    type="date"
                    value={lossForm.date}
                    onChange={(e) => setLossForm({ ...lossForm, date: e.target.value })}
                  />
                  <button onClick={handleRecordLoss}>Submit</button>
                  <button onClick={() => setShowLossModal(false)} style={{ marginLeft: '10px' }}>
                    Cancel
                  </button>
                  {productionError && <p style={{ color: 'red' }}>{productionError}</p>}
                </div>
              </div>
            )}
            <h2>Daily Summary (Proof Gallons)</h2>
            <table>
              <thead>
                <tr>
                  <th>Account</th>
                  <th>Total Proof Gallons</th>
                </tr>
              </thead>
              <tbody>
                {dailySummary.length > 0 ? (
                  dailySummary.map((item) => (
                    <tr key={item.account}>
                      <td>{item.account}</td>
                      <td>{item.totalProofGallons || '0.00'}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={2}>Loading summary...</td>
                  </tr>
                )}
              </tbody>
            </table>
            <h2>Received/Stored Inventory</h2>
            <table>
              <thead>
                <tr>
                  <th>Identifier</th>
                  <th>Type</th>
                  <th>Description</th>
                  <th>Quantity</th>
                  <th>Unit</th>
                  <th>Proof</th>
                  <th>Proof Gallons</th>
                  <th>Date Received</th>
                  <th>Source</th>
                  <th>DSP Number</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {inventory
                  .filter((item) => ['Received', 'Stored'].includes(item.status))
                  .map((item) => (
                    <tr key={item.identifier}>
                      <td>{item.identifier || 'N/A'}</td>
                      <td>{item.type}</td>
                      <td>{item.description || 'N/A'}</td>
                      <td>{item.quantity || '0.00'}</td>
                      <td>{item.unit || 'N/A'}</td>
                      <td>{item.proof || 'N/A'}</td>
                      <td>{item.proofGallons || '0.00'}</td>
                      <td>{item.receivedDate || 'N/A'}</td>
                      <td>{item.source || 'N/A'}</td>
                      <td>{item.dspNumber || 'N/A'}</td>
                      <td>{item.status}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
            <h2>Finished Packaged Inventory</h2>
            <table>
              <thead>
                <tr>
                  <th>Identifier</th>
                  <th>Type</th>
                  <th>Quantity (WG)</th>
                  <th>Proof</th>
                  <th>Proof Gallons</th>
                  <th>Date Packaged</th>
                  <th>Source</th>
                  <th>DSP Number</th>
                </tr>
              </thead>
              <tbody>
                {inventory
                  .filter((item) => item.account === 'Processing' && item.status === 'Packaged')
                  .map((item) => (
                    <tr key={item.identifier}>
                      <td>{item.identifier || 'N/A'}</td>
                      <td>{item.type}</td>
                      <td>{item.quantity || '0.00'}</td>
                      <td>{item.proof || '0.00'}</td>
                      <td>{item.proofGallons || '0.00'}</td>
                      <td>{item.receivedDate || 'N/A'}</td>
                      <td>{item.source || 'N/A'}</td>
                      <td>{item.dspNumber || 'N/A'}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        );
      case 'Processing':
        return (
          <div>
            <h2>Processing</h2>
            <div>
              <h3>Package Product</h3>
              <input
                type="text"
                placeholder="Batch ID in Processing"
                value={packageForm.batchId}
                onChange={(e) => setPackageForm({ ...packageForm, batchId: e.target.value })}
              />
              <select
                value={packageForm.product}
                onChange={(e) => setPackageForm({ ...packageForm, product: e.target.value })}
              >
                <option value="Old Black Bear Vodka">Old Black Bear Vodka (Vodka)</option>
                <option value="Old Black Bear Gin">Old Black Bear Gin (Gin)</option>
                <option value="Old Black Bear Rum">Old Black Bear Rum (Rum)</option>
                <option value="Shine-O-Mite">Shine-O-Mite (Moonshine)</option>
              </select>
              <input
                type="number"
                placeholder="Proof Gallons to Package"
                value={packageForm.proofGallons}
                onChange={(e) => setPackageForm({ ...packageForm, proofGallons: e.target.value })}
                step="0.01"
              />
              <input
                type="number"
                placeholder="Target Proof (e.g., 80)"
                value={packageForm.targetProof}
                onChange={(e) => setPackageForm({ ...packageForm, targetProof: e.target.value })}
                step="0.01"
              />
              <input
                type="text"
                placeholder="Net Contents (e.g., 750ml)"
                value={packageForm.netContents}
                onChange={(e) => setPackageForm({ ...packageForm, netContents: e.target.value })}
              />
              <input
                type="text"
                placeholder="Alcohol Content (e.g., 40% ABV)"
                value={packageForm.alcoholContent}
                onChange={(e) => setPackageForm({ ...packageForm, alcoholContent: e.target.value })}
              />
              <label>
                <input
                  type="checkbox"
                  checked={packageForm.healthWarning}
                  onChange={(e) => setPackageForm({ ...packageForm, healthWarning: e.target.checked })}
                />
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
                  <th>Batch ID</th>
                  <th>Type</th>
                  <th>Quantity (WG)</th>
                  <th>Proof</th>
                  <th>Proof Gallons</th>
                  <th>Date Received</th>
                  <th>Source</th>
                  <th>DSP Number</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {inventory
                  .filter((item) => item.account === 'Processing' && item.status === 'Processing')
                  .map((item) => (
                    <tr key={item.identifier}>
                      <td>
                        {editingBatchId === item.identifier ? (
                          <input
                            type="text"
                            value={editedBatchId}
                            onChange={(e) => setEditedBatchId(e.target.value)}
                          />
                        ) : (
                          item.identifier
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
                        {editingBatchId === item.identifier ? (
                          <>
                            <button onClick={() => handleBatchIdUpdate(item.identifier!)}>Save</button>
                            <button onClick={() => setEditingBatchId(null)}>Cancel</button>
                          </>
                        ) : (
                          <button
                            onClick={() => {
                              setEditingBatchId(item.identifier!);
                              setEditedBatchId(item.identifier!);
                            }}
                          >
                            Edit
                          </button>
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
                  <th>Batch ID</th>
                  <th>Type</th>
                  <th>Quantity (WG)</th>
                  <th>Proof</th>
                  <th>Proof Gallons</th>
                  <th>Date Packaged</th>
                  <th>Source</th>
                  <th>DSP Number</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {inventory
                  .filter((item) => item.account === 'Processing' && item.status === 'Packaged')
                  .map((item) => (
                    <tr key={item.identifier}>
                      <td>
                        {editingBatchId === item.identifier ? (
                          <input
                            type="text"
                            value={editedBatchId}
                            onChange={(e) => setEditedBatchId(e.target.value)}
                          />
                        ) : (
                          item.identifier
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
                        {editingBatchId === item.identifier ? (
                          <>
                            <button onClick={() => handleBatchIdUpdate(item.identifier!)}>Save</button>
                            <button onClick={() => setEditingBatchId(null)}>Cancel</button>
                          </>
                        ) : (
                          <button
                            onClick={() => {
                              setEditingBatchId(item.identifier!);
                              setEditedBatchId(item.identifier!);
                            }}
                          >
                            Edit
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        );
      case 'Sales & Distribution':
        return (
          <div>
            <h2>Sales & Distribution</h2>
            <p>Sales features coming soon.</p>
          </div>
        );
      case 'Users':
        return (
          <div>
            <h2>Users</h2>
            <p>User management coming soon.</p>
          </div>
        );
      case 'Reporting':
        return (
          <div>
            <h2>Reporting</h2>
            <div>
              <input type="month" value={reportMonth} onChange={(e) => setReportMonth(e.target.value)} />
              <button onClick={fetchMonthlyReport}>Fetch Monthly Report</button>
              {report && report.month && <button onClick={exportToExcel}>Export to Excel</button>}
            </div>
            <div>
              <input type="date" value={reportDate} onChange={(e) => setReportDate(e.target.value)} />
              <button onClick={fetchDailyReport}>Fetch Daily Report</button>
            </div>
            <div>
              <button onClick={handlePhysicalInventory}>Record Physical Inventory</button>
              <button
                onClick={() =>
                  exportTankSummaryToExcel({
                    barrelId: 'GNS250329',
                    type: 'Spirits',
                    proofGallons: '0',
                    proof: '0',
                    totalProofGallonsLeft: '0',
                    date: 'N/A',
                    fromAccount: 'Storage',
                    toAccount: 'Processing',
                    serialNumber: '250307',
                    producingDSP: 'DSP-KY-417',
                  })
                }
              >
                Export Tank Summary
              </button>
            </div>
            {report ? (
              <div>
                <h3>{report.month ? `Monthly Report: ${report.month}` : `Daily Report: ${report.date}`}</h3>
                <p>Total Received: {Number(report.totalReceived).toFixed(2)} PG</p>
                <p>Total Processed: {Number(report.totalProcessed).toFixed(2)} PG</p>
                {report.totalMoved !== undefined && <p>Total Moved: {Number(report.totalMoved).toFixed(2)} PG</p>}
                {report.totalRemoved !== undefined && <p>Total Removed: {Number(report.totalRemoved).toFixed(2)} PG</p>}
                {report.byType && (
                  <div>
                    <h4>Processed by Type</h4>
                    <ul>
                      {Object.entries(report.byType).map(([type, pg]) => (
                        <li key={type}>{`${type}: ${Number(pg).toFixed(2)} PG`}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {report.transactions && (
                  <ul>
                    {report.transactions.map((t: Transaction, i) => (
                      <li key={i}>
                        {`${t.action}: ${Number(t.proofGallons).toFixed(2)} PG (${t.type}) on ${t.date} ${
                          t.barrelId ? `(Barrel: ${t.barrelId})` : ''
                        } ${t.toAccount ? `to ${t.toAccount}` : ''}`}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ) : (
              <p>Select a month or date and fetch a report.</p>
            )}
          </div>
        );
      default:
        return null;
    }
  };

  if (isLoading) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100vh',
          backgroundColor: '#f5f5f5',
        }}
      >
        <img src="/tilly-logo.png" alt="Tilly Logo" style={{ maxWidth: '80%', maxHeight: '60vh' }} />
        <h1 style={{ fontFamily: 'Arial, sans-serif', color: '#333' }}>Tilly</h1>
        <p style={{ fontFamily: 'Arial, sans-serif', color: '#666' }}>Powered by Paws & Pours</p>
      </div>
    );
  }

  return (
    <Router>
      <div className="App">
        <button className="hamburger" onClick={() => setMenuOpen(!menuOpen)}>
          ☰
        </button>
        <nav className={`menu ${menuOpen ? 'open' : ''}`}>
          <ul>
            <li>
              <button
                onClick={() => {
                  setActiveSection('Home');
                  setMenuOpen(false);
                }}
                className={activeSection === 'Home' ? 'active' : ''}
              >
                Home
              </button>
            </li>
            <li>
              <button
                onClick={() => {
                  setActiveSection('Production');
                  setMenuOpen(false);
                }}
                className={activeSection === 'Production' ? 'active' : ''}
              >
                Production
              </button>
            </li>
            <li>
              <button
                onClick={() => {
                  setActiveSection('Inventory');
                  setMenuOpen(false);
                }}
                className={activeSection === 'Inventory' ? 'active' : ''}
              >
                Inventory
              </button>
            </li>
            <li>
              <button
                onClick={() => {
                  setActiveSection('Processing');
                  setMenuOpen(false);
                }}
                className={activeSection === 'Processing' ? 'active' : ''}
              >
                Processing
              </button>
            </li>
            <li>
              <button
                onClick={() => {
                  setActiveSection('Sales & Distribution');
                  setMenuOpen(false);
                }}
                className={activeSection === 'Sales & Distribution' ? 'active' : ''}
              >
                Sales & Distribution
              </button>
            </li>
            <li>
              <button
                onClick={() => {
                  setActiveSection('Users');
                  setMenuOpen(false);
                }}
                className={activeSection === 'Users' ? 'active' : ''}
              >
                Users
              </button>
            </li>
            <li>
              <button
                onClick={() => {
                  setActiveSection('Reporting');
                  setMenuOpen(false);
                }}
                className={activeSection === 'Reporting' ? 'active' : ''}
              >
                Reporting
              </button>
            </li>
          </ul>
        </nav>
        <div className="content">
          <h1>Tilly - Distillery Dog</h1>
          <Routes>
            <Route path="/" element={renderSection()} />
            <Route
              path="/receive"
              element={<ReceivePage fetchInventory={fetchInventory} exportTankSummary={exportTankSummaryToExcel} />}
            />
          </Routes>
        </div>
      </div>
    </Router>
  );
};

// Receive Page Component
const ReceivePage: React.FC<{
  fetchInventory: () => Promise<void>;
  exportTankSummary: (tankSummary: TankSummary) => void;
}> = ({ fetchInventory, exportTankSummary }) => {
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
  const [productionError, setProductionError] = useState<string | null>(null);

  const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:3000';

  const handleReceive = async () => {
    if (!receiveForm.account || !receiveForm.materialType || !receiveForm.quantity || !receiveForm.unit) {
      setProductionError('All required fields must be filled');
      return;
    }
    if (receiveForm.materialType === MaterialType.Spirits && (!receiveForm.identifier || !receiveForm.proof)) {
      setProductionError('Spirits require an identifier and proof');
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
      account: receiveForm.account,
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
      const data = await res.json();
      console.log('Receive response:', data);
      if (data.tankSummary) exportTankSummary(data.tankSummary);
      await fetchInventory();
      navigate('/');
    } catch (err: any) {
      console.error('Receive error:', err);
      setProductionError(err.message);
    }
  };

  return (
    <div style={{ padding: '20px', maxWidth: '600px', margin: '0 auto' }}>
      <h2>Receive Inventory</h2>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleReceive();
        }}
        style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}
      >
        <label>
          Identifier (required for Spirits):
          <input
            type="text"
            value={receiveForm.identifier || ''}
            onChange={(e) => setReceiveForm({ ...receiveForm, identifier: e.target.value || undefined })}
            style={{ width: '100%' }}
          />
        </label>
        <label>
          Material Type:
          <select
            value={receiveForm.materialType}
            onChange={(e) => setReceiveForm({ ...receiveForm, materialType: e.target.value as MaterialType })}
            style={{ width: '100%' }}
          >
            {Object.values(MaterialType).map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </label>
        {receiveForm.materialType === MaterialType.Other && (
          <label>
            Description (e.g., Case Boxes, Activated Carbon):
            <input
              type="text"
              value={receiveForm.description || ''}
              onChange={(e) => setReceiveForm({ ...receiveForm, description: e.target.value || undefined })}
              style={{ width: '100%' }}
            />
          </label>
        )}
        <label>
          Quantity:
          <input
            type="number"
            value={receiveForm.quantity}
            onChange={(e) => setReceiveForm({ ...receiveForm, quantity: e.target.value })}
            step="0.01"
            style={{ width: '100%' }}
          />
        </label>
        <label>
          Unit:
          <select
            value={receiveForm.unit}
            onChange={(e) => setReceiveForm({ ...receiveForm, unit: e.target.value as Unit })}
            style={{ width: '100%' }}
          >
            {Object.values(Unit).map((unit) => (
              <option key={unit} value={unit}>
                {unit}
              </option>
            ))}
          </select>
        </label>
        <label>
          Proof (Spirits only):
          <input
            type="number"
            value={receiveForm.proof || ''}
            onChange={(e) => setReceiveForm({ ...receiveForm, proof: e.target.value || '' })}
            step="0.01"
            style={{ width: '100%' }}
          />
        </label>
        <label>
          Account:
          <select
            value={receiveForm.account}
            onChange={(e) => setReceiveForm({ ...receiveForm, account: e.target.value })}
            style={{ width: '100%' }}
          >
            <option value="Production">Production</option>
            <option value="Storage">Storage</option>
            <option value="Processing">Processing</option>
          </select>
        </label>
        <label>
          Source:
          <input
            type="text"
            value={receiveForm.source}
            onChange={(e) => setReceiveForm({ ...receiveForm, source: e.target.value })}
            style={{ width: '100%' }}
          />
        </label>
        <label>
          DSP Number:
          <input
            type="text"
            value={receiveForm.dspNumber}
            onChange={(e) => setReceiveForm({ ...receiveForm, dspNumber: e.target.value })}
            style={{ width: '100%' }}
          />
        </label>
        <label>
          Received Date:
          <input
            type="date"
            value={receiveForm.receivedDate}
            onChange={(e) => setReceiveForm({ ...receiveForm, receivedDate: e.target.value })}
            style={{ width: '100%' }}
          />
        </label>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button type="submit">Submit</button>
          <button type="button" onClick={() => navigate('/')}>
            Cancel
          </button>
        </div>
        {productionError && <p style={{ color: 'red' }}>{productionError}</p>}
      </form>
    </div>
  );
};

export default App;