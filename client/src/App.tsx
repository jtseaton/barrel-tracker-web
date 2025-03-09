import React, { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import './App.css';

const OUR_DSP = 'DSP-AL-20010';

// Interfaces
interface InventoryItem {
  barrelId: string;
  account: string;
  type: string;
  quantity: string;
  proof: string;
  proofGallons: string;
  receivedDate: string;
  source: string;
  dspNumber: string;
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

interface ProductionForm {
  barrelId: string;
  proof: string;
  quantity: string;
}

interface ProductionRecord {
  barrelId: string;
  type: string;
  proofGallons: string;
  date: string;
}

const App: React.FC = () => {
  // State Management
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [receiveForm, setReceiveForm] = useState({
    barrelId: '',
    account: 'Storage',
    type: 'Spirits',
    quantity: '',
    proof: '',
    source: '',
    dspNumber: OUR_DSP,
    receivedDate: new Date().toISOString().split('T')[0]
  });
  const [moveForm, setMoveForm] = useState({
    barrelId: '',
    toAccount: 'Storage',
    proofGallons: ''
  });
  const [packageForm, setPackageForm] = useState({
    batchId: '',
    product: 'Old Black Bear Vodka',
    proofGallons: '',
    targetProof: '80',
    netContents: '',
    alcoholContent: '',
    healthWarning: false
  });
  const [lossForm, setLossForm] = useState({
    barrelId: '',
    quantityLost: '',
    proofGallonsLost: '',
    reason: '',
    date: new Date().toISOString().split('T')[0]
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
  const [showReceiveModal, setShowReceiveModal] = useState(false);
  const [showMoveModal, setShowMoveModal] = useState(false);
  const [showLossModal, setShowLossModal] = useState(false);
  const [productionForm, setProductionForm] = useState<ProductionForm>({
    barrelId: '',
    proof: '',
    quantity: ''
  });
  const [productionRecords, setProductionRecords] = useState<ProductionRecord[]>([]);
  const [productionError, setProductionError] = useState<string | null>(null);
  
  const handleProductionGauge = async () => {
    if (!productionForm.barrelId || !productionForm.proof || !productionForm.quantity) {
      setProductionError('All fields are required');
      return;
    }
    const proof = parseFloat(productionForm.proof);
    const quantity = parseFloat(productionForm.quantity);
    if (isNaN(proof) || isNaN(quantity) || proof > 200 || quantity <= 0) {
      setProductionError('Invalid proof or quantity');
      return;
    }
    const proofGallons = (quantity * (proof / 100)).toFixed(2);
    const newRecord: ProductionRecord = {
      barrelId: productionForm.barrelId,
      type: 'Spirits', // Default type; adjust if multiple types are needed
      proofGallons,
      date: new Date().toISOString().split('T')[0]
    };
    try {
      const res = await fetch('/api/produce', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newRecord)
      });
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
      const data = await res.json();
      console.log('Production gauge response:', data);
      setProductionRecords([...productionRecords, newRecord]);
      setProductionForm({ barrelId: '', proof: '', quantity: '' });
      setProductionError(null);
      await fetchInventory(); // Update inventory state
    } catch (err: any) {
      console.error('Production gauge error:', err);
      setProductionError(err.message);
    }
  };

  // Fetch Data
  useEffect(() => {
    fetchInventory();
    fetchDailySummary();
  }, []);

  useEffect(() => {
    setTimeout(() => setIsLoading(false), 4000);
  }, []);

  useEffect(() => {
    console.log('Inventory state updated:', inventory);
  }, [inventory]);

  const fetchInventory = async () => {
    try {
      const res = await fetch('/api/inventory');
      console.log('Fetch inventory status:', res.status, res.statusText);
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
      const text = await res.text();
      console.log('Raw fetch response:', text);
      const data = JSON.parse(text);
      console.log('Fetched inventory data:', data);
      setInventory(data);
    } catch (err: any) {
      console.error('Fetch inventory error:', err);
      if (err.message.includes('Unexpected token')) {
        console.error('Server returned HTML instead of JSON');
      }
    }
  };

  const fetchDailySummary = async () => {
    try {
      const res = await fetch('/api/daily-summary');
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
      const data = await res.json();
      setDailySummary(data);
    } catch (err: any) {
      console.error('Fetch daily summary error:', err);
    }
  };

  const fetchMonthlyReport = async () => {
    console.log('Fetching monthly report for:', reportMonth);
    try {
      const res = await fetch(`/api/report/monthly?month=${reportMonth}`);
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
      const res = await fetch(`/api/report/daily?date=${reportDate}`);
      if (!res.ok) throw new Error(`Failed to fetch report: ${res.status}`);
      const data = await res.json();
      console.log('Daily report data:', data);
      setReport(data);
    } catch (err: any) {
      console.error('Daily report error:', err);
    }
  };

  // Handlers
  const handleReceive = async () => {
    console.log('Sending receive request:', receiveForm);
    try {
      const res = await fetch('/api/receive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(receiveForm)
      });
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
      const data = await res.json();
      console.log('Receive response:', data);
      await fetchInventory();
      if (data.tankSummary) exportTankSummaryToExcel(data.tankSummary);
      setReceiveForm({
        barrelId: '',
        account: 'Storage',
        type: 'Spirits',
        quantity: '',
        proof: '',
        source: '',
        dspNumber: OUR_DSP,
        receivedDate: new Date().toISOString().split('T')[0]
      });
      setShowReceiveModal(false);
    } catch (err: any) {
      console.error('Receive error:', err);
      alert('Failed to receive item: ' + err.message);
    }
  };

  const handleMove = async () => {
    if (!moveForm.barrelId || !moveForm.proofGallons) {
      console.log('Invalid move request: missing barrelId or proofGallons');
      alert('Please fill in Barrel ID and Proof Gallons.');
      return;
    }
    console.log('Sending move request:', moveForm);
    try {
      const res = await fetch('/api/move', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...moveForm,
          proofGallons: parseFloat(moveForm.proofGallons)
        })
      });
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
      const data = await res.json();
      console.log('Move response:', data);
      if (data.batchId) setPackageForm(prev => ({ ...prev, batchId: data.batchId }));
      await fetchInventory();
      if (data.tankSummary) exportTankSummaryToExcel(data.tankSummary);
      setMoveForm({ barrelId: '', toAccount: 'Storage', proofGallons: '' });
      setShowMoveModal(false);
    } catch (err: any) {
      console.error('Move error:', err);
      alert('Failed to move item: ' + err.message);
    }
  };

  const handlePackage = async () => {
    if (!packageForm.batchId || !packageForm.proofGallons || !packageForm.targetProof || !packageForm.netContents || !packageForm.alcoholContent || !packageForm.healthWarning) {
      console.log('Invalid package request:', packageForm);
      alert('Please fill in all fields and confirm health warning.');
      return;
    }
    const sourceProofGallons = parseFloat(packageForm.proofGallons);
    const targetProof = parseFloat(packageForm.targetProof);
    const bottleSizeGal = 0.198129;

    const sourceItem = inventory.find(item => item.barrelId === packageForm.batchId.trim() && item.account === 'Processing');
    if (!sourceItem) {
      console.log('Batch not found in Processing. Entered Batch ID:', packageForm.batchId);
      console.log('Processing inventory:', inventory.filter(item => item.account === 'Processing'));
      alert('Batch not found in Processing!');
      return;
    }
    const sourceProof = parseFloat(sourceItem.proof);
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
      finalProofGallons
    });
    try {
      const res = await fetch('/api/package', {
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
          date: new Date().toISOString().split('T')[0]
        })
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
        healthWarning: false
      });
    } catch (err: any) {
      console.error('Package error:', err);
      alert('Failed to package item: ' + err.message);
    }
  };

  const handleRecordLoss = async () => {
    try {
      const res = await fetch('/api/record-loss', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(lossForm)
      });
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
      await fetchInventory();
      setLossForm({
        barrelId: '',
        quantityLost: '',
        proofGallonsLost: '',
        reason: '',
        date: new Date().toISOString().split('T')[0]
      });
      setShowLossModal(false);
    } catch (err: any) {
      console.error('Record loss error:', err);
      alert('Failed to record loss: ' + err.message);
    }
  };

  const handleBatchIdUpdate = async (oldBatchId: string) => {
    try {
      const res = await fetch('/api/update-batch-id', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ oldBatchId, newBatchId: editedBatchId })
      });
      if (!res.ok) throw new Error('Failed to update batch ID');
      await fetchInventory();
      setEditingBatchId(null);
      setEditedBatchId('');
    } catch (err: any) {
      console.error('Update error:', err);
      alert('Failed to update batch ID: ' + err.message);
    }
  };

  const handlePhysicalInventory = async () => {
    try {
      const res = await fetch('/api/physical-inventory', { method: 'POST' });
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
      const data = await res.json();
      alert(`Physical inventory recorded at ${data.timestamp}`);
    } catch (err: any) {
      console.error('Physical inventory error:', err);
      alert('Failed to record physical inventory: ' + err.message);
    }
  };

  // Exports
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
        t.toAccount || 'N/A'
      ])
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
        ['Date:', '____________________']
      ];
      const ws = XLSX.utils.aoa_to_sheet(wsData);
      const labelCells = [
        'A1', 'A3', 'A4', 'A5', 'A6', 'A7', 'A8', 'A9', 'A10',
        ...(tankSummary.fromAccount ? ['A11'] : []),
        ...(tankSummary.waterVolume ? ['A12'] : []),
        ...(tankSummary.bottleCount ? ['A13'] : []),
        'A15', 'A16'
      ];
      labelCells.forEach(cell => {
        if (ws[cell]) {
          ws[cell].s = {
            font: { bold: true },
            fill: { fgColor: { rgb: 'FFFF00' } },
            border: {
              top: { style: 'thin', color: { rgb: '000000' } },
              bottom: { style: 'thin', color: { rgb: '000000' } },
              left: { style: 'thin', color: { rgb: '000000' } },
              right: { style: 'thin', color: { rgb: '000000' } }
            }
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
            right: { style: 'thin', color: { rgb: '000000' } }
          }
        };
      }
      if (ws['A15']) {
        ws['A15'].s = {
          font: { bold: true },
          alignment: { horizontal: 'left', wrapText: true }
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

  // Render
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
      <div>
        <h3>Production Gauge</h3>
        <input
          type="text"
          placeholder="Barrel ID"
          value={productionForm.barrelId}
          onChange={(e) => setProductionForm({ ...productionForm, barrelId: e.target.value })}
        />
        <input
          type="number"
          placeholder="Proof"
          value={productionForm.proof}
          onChange={(e) => setProductionForm({ ...productionForm, proof: e.target.value })}
          step="0.1"
          min="0"
          max="200"
        />
        <input
          type="number"
          placeholder="Quantity (Gallons)"
          value={productionForm.quantity}
          onChange={(e) => setProductionForm({ ...productionForm, quantity: e.target.value })}
          step="0.01"
          min="0"
        />
        <button onClick={handleProductionGauge}>Gauge Production</button>
        {productionError && <p style={{ color: 'red' }}>{productionError}</p>}
      </div>
      <h3>Daily Production Records</h3>
      <table>
        <thead>
          <tr>
            <th>Barrel ID</th>
            <th>Type</th>
            <th>Proof Gallons</th>
            <th>Date</th>
          </tr>
        </thead>
        <tbody>
          {productionRecords.length > 0 ? (
            productionRecords.map((record) => (
              <tr key={record.barrelId}>
                <td>{record.barrelId}</td>
                <td>{record.type}</td>
                <td>{record.proofGallons}</td>
                <td>{record.date}</td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={4}>No production records yet</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
      case 'Inventory':
        return (
          <div>
            <h2>Inventory Management</h2>
            <div style={{ marginBottom: '20px' }}>
              <button onClick={() => setShowReceiveModal(true)}>Receive Inventory</button>
              <button onClick={() => setShowMoveModal(true)} style={{ marginLeft: '10px' }}>Move Inventory</button>
              <button onClick={() => setShowLossModal(true)} style={{ marginLeft: '10px' }}>Record Loss</button>
            </div>
            {/* Modals */}
            {showReceiveModal && (
              <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '5px' }}>
                  <h3>Receive Inventory</h3>
                  <input
                    type="text"
                    placeholder="Barrel ID (e.g., GNS250329)"
                    value={receiveForm.barrelId}
                    onChange={e => setReceiveForm({ ...receiveForm, barrelId: e.target.value })}
                  />
                  <select value={receiveForm.account} onChange={e => setReceiveForm({ ...receiveForm, account: e.target.value })}>
                    <option value="Production">Production</option>
                    <option value="Storage">Storage</option>
                    <option value="Processing">Processing</option>
                  </select>
                  <select value={receiveForm.type} onChange={e => setReceiveForm({ ...receiveForm, type: e.target.value })}>
                    <option value="Cane Sugar">Cane Sugar</option>
                    <option value="Corn Sugar">Corn Sugar</option>
                    <option value="Agave Syrup">Agave Syrup</option>
                    <option value="Flaked Corn">Flaked Corn</option>
                    <option value="Rye Barley">Rye Barley</option>
                    <option value="Malted Barley">Malted Barley</option>
                    <option value="Spirits">Spirits</option>
                  </select>
                  <input
                    type="number"
                    placeholder="Quantity (WG)"
                    value={receiveForm.quantity}
                    onChange={e => setReceiveForm({ ...receiveForm, quantity: e.target.value })}
                    step="0.01"
                  />
                  <input
                    type="number"
                    placeholder="Proof (if Spirits)"
                    value={receiveForm.proof}
                    onChange={e => setReceiveForm({ ...receiveForm, proof: e.target.value })}
                    step="0.01"
                  />
                  <input
                    type="text"
                    placeholder="Source"
                    value={receiveForm.source}
                    onChange={e => setReceiveForm({ ...receiveForm, source: e.target.value })}
                  />
                  <input
                    type="text"
                    placeholder="DSP Number"
                    value={receiveForm.dspNumber}
                    onChange={e => setReceiveForm({ ...receiveForm, dspNumber: e.target.value })}
                  />
                  <input
                    type="date"
                    value={receiveForm.receivedDate}
                    onChange={e => setReceiveForm({ ...receiveForm, receivedDate: e.target.value })}
                  />
                  <button onClick={handleReceive}>Submit</button>
                  <button onClick={() => setShowReceiveModal(false)} style={{ marginLeft: '10px' }}>Cancel</button>
                </div>
              </div>
            )}
            {showMoveModal && (
              <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '5px' }}>
                  <h3>Move Inventory</h3>
                  <input
                    type="text"
                    placeholder="Barrel ID (e.g., GNS250329)"
                    value={moveForm.barrelId}
                    onChange={e => setMoveForm({ ...moveForm, barrelId: e.target.value })}
                  />
                  <select value={moveForm.toAccount} onChange={e => setMoveForm({ ...moveForm, toAccount: e.target.value })}>
                    <option value="Production">Production</option>
                    <option value="Storage">Storage</option>
                    <option value="Processing">Processing</option>
                  </select>
                  <input
                    type="number"
                    placeholder="Proof Gallons to Move"
                    value={moveForm.proofGallons}
                    onChange={e => setMoveForm({ ...moveForm, proofGallons: e.target.value })}
                    step="0.01"
                  />
                  <button onClick={handleMove}>Submit</button>
                  <button onClick={() => setShowMoveModal(false)} style={{ marginLeft: '10px' }}>Cancel</button>
                </div>
              </div>
            )}
            {showLossModal && (
              <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '5px' }}>
                  <h3>Record Loss</h3>
                  <input
                    type="text"
                    placeholder="Barrel ID"
                    value={lossForm.barrelId}
                    onChange={e => setLossForm({ ...lossForm, barrelId: e.target.value })}
                  />
                  <input
                    type="number"
                    placeholder="Quantity Lost"
                    value={lossForm.quantityLost}
                    onChange={e => setLossForm({ ...lossForm, quantityLost: e.target.value })}
                    step="0.01"
                  />
                  <input
                    type="number"
                    placeholder="Proof Gallons Lost"
                    value={lossForm.proofGallonsLost}
                    onChange={e => setLossForm({ ...lossForm, proofGallonsLost: e.target.value })}
                    step="0.01"
                  />
                  <input
                    type="text"
                    placeholder="Reason for Loss"
                    value={lossForm.reason}
                    onChange={e => setLossForm({ ...lossForm, reason: e.target.value })}
                  />
                  <input
                    type="date"
                    value={lossForm.date}
                    onChange={e => setLossForm({ ...lossForm, date: e.target.value })}
                  />
                  <button onClick={handleRecordLoss}>Submit</button>
                  <button onClick={() => setShowLossModal(false)} style={{ marginLeft: '10px' }}>Cancel</button>
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
                  dailySummary.map(item => (
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
            <h2>Storage Inventory</h2>
            <table>
              <thead>
                <tr>
                  <th>Barrel ID</th>
                  <th>Type</th>
                  <th>Quantity</th>
                  <th>Proof</th>
                  <th>Proof Gallons</th>
                  <th>Date Received</th>
                  <th>Source</th>
                  <th>DSP Number</th>
                </tr>
              </thead>
              <tbody>
                {inventory.filter(item => item.account === 'Storage').map(item => (
                  <tr key={item.barrelId}>
                    <td>{item.barrelId}</td>
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
            <h2>Production Inventory</h2>
            <table>
              <thead>
                <tr>
                  <th>Barrel ID</th>
                  <th>Type</th>
                  <th>Quantity</th>
                  <th>Proof</th>
                  <th>Proof Gallons</th>
                  <th>Date Received</th>
                  <th>Source</th>
                  <th>DSP Number</th>
                </tr>
              </thead>
              <tbody>
                {inventory.filter(item => item.account === 'Production').map(item => (
                  <tr key={item.barrelId}>
                    <td>{item.barrelId}</td>
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
            <h2>Finished Packaged Inventory</h2>
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
                </tr>
              </thead>
              <tbody>
                {inventory
                  .filter(item => item.account === 'Processing' && !item.barrelId.includes('-BATCH-'))
                  .map(item => (
                    <tr key={item.barrelId}>
                      <td>{item.barrelId}</td>
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
                onChange={e => setPackageForm({ ...packageForm, batchId: e.target.value })}
              />
              <select value={packageForm.product} onChange={e => setPackageForm({ ...packageForm, product: e.target.value })}>
                <option value="Old Black Bear Vodka">Old Black Bear Vodka (Vodka)</option>
                <option value="Old Black Bear Gin">Old Black Bear Gin (Gin)</option>
                <option value="Old Black Bear Rum">Old Black Bear Rum (Rum)</option>
                <option value="Shine-O-Mite">Shine-O-Mite (Moonshine)</option>
              </select>
              <input
                type="number"
                placeholder="Proof Gallons to Package"
                value={packageForm.proofGallons}
                onChange={e => setPackageForm({ ...packageForm, proofGallons: e.target.value })}
                step="0.01"
              />
              <input
                type="number"
                placeholder="Target Proof (e.g., 80)"
                value={packageForm.targetProof}
                onChange={e => setPackageForm({ ...packageForm, targetProof: e.target.value })}
                step="0.01"
              />
              <input
                type="text"
                placeholder="Net Contents (e.g., 750ml)"
                value={packageForm.netContents}
                onChange={e => setPackageForm({ ...packageForm, netContents: e.target.value })}
              />
              <input
                type="text"
                placeholder="Alcohol Content (e.g., 40% ABV)"
                value={packageForm.alcoholContent}
                onChange={e => setPackageForm({ ...packageForm, alcoholContent: e.target.value })}
              />
              <label>
                <input
                  type="checkbox"
                  checked={packageForm.healthWarning}
                  onChange={e => setPackageForm({ ...packageForm, healthWarning: e.target.checked })}
                />
                Include Health Warning (Required)
              </label>
              <button onClick={handlePackage}>Complete Packaging</button>
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
                  .filter(item => item.account === 'Processing' && item.barrelId.includes('-BATCH-'))
                  .map(item => (
                    <tr key={item.barrelId}>
                      <td>
                        {editingBatchId === item.barrelId ? (
                          <input
                            type="text"
                            value={editedBatchId}
                            onChange={e => setEditedBatchId(e.target.value)}
                          />
                        ) : (
                          item.barrelId
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
                        {editingBatchId === item.barrelId ? (
                          <>
                            <button onClick={() => handleBatchIdUpdate(item.barrelId)}>Save</button>
                            <button onClick={() => setEditingBatchId(null)}>Cancel</button>
                          </>
                        ) : (
                          <button onClick={() => { setEditingBatchId(item.barrelId); setEditedBatchId(item.barrelId); }}>
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
                  .filter(item => item.account === 'Processing' && !item.barrelId.includes('-BATCH-'))
                  .map(item => (
                    <tr key={item.barrelId}>
                      <td>
                        {editingBatchId === item.barrelId ? (
                          <input
                            type="text"
                            value={editedBatchId}
                            onChange={e => setEditedBatchId(e.target.value)}
                          />
                        ) : (
                          item.barrelId
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
                        {editingBatchId === item.barrelId ? (
                          <>
                            <button onClick={() => handleBatchIdUpdate(item.barrelId)}>Save</button>
                            <button onClick={() => setEditingBatchId(null)}>Cancel</button>
                          </>
                        ) : (
                          <button onClick={() => { setEditingBatchId(item.barrelId); setEditedBatchId(item.barrelId); }}>
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
              <input type="month" value={reportMonth} onChange={e => setReportMonth(e.target.value)} />
              <button onClick={fetchMonthlyReport}>Fetch Monthly Report</button>
              {report && report.month && <button onClick={exportToExcel}>Export to Excel</button>}
            </div>
            <div>
              <input type="date" value={reportDate} onChange={e => setReportDate(e.target.value)} />
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
                    producingDSP: 'DSP-KY-417'
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
                        {`${t.action}: ${Number(t.proofGallons).toFixed(2)} PG (${t.type}) on ${t.date} ${t.barrelId ? `(Barrel: ${t.barrelId})` : ''} ${t.toAccount ? `to ${t.toAccount}` : ''}`}
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
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', backgroundColor: '#f5f5f5' }}>
        <img src="/tilly-logo.png" alt="Tilly Logo" style={{ maxWidth: '80%', maxHeight: '60vh' }} />
        <h1 style={{ fontFamily: 'Arial, sans-serif', color: '#333' }}>Tilly</h1>
        <p style={{ fontFamily: 'Arial, sans-serif', color: '#666' }}>Powered by Paws & Pours</p>
      </div>
    );
  }

  return (
    <div className="App">
      <button className="hamburger" onClick={() => setMenuOpen(!menuOpen)}>
        ☰
      </button>
      <nav className={`menu ${menuOpen ? 'open' : ''}`}>
        <ul>
          <li><button onClick={() => { setActiveSection('Home'); setMenuOpen(false); }} className={activeSection === 'Home' ? 'active' : ''}>Home</button></li>
          <li><button onClick={() => { setActiveSection('Production'); setMenuOpen(false); }} className={activeSection === 'Production' ? 'active' : ''}>Production</button></li>
          <li><button onClick={() => { setActiveSection('Inventory'); setMenuOpen(false); }} className={activeSection === 'Inventory' ? 'active' : ''}>Inventory</button></li>
          <li><button onClick={() => { setActiveSection('Processing'); setMenuOpen(false); }} className={activeSection === 'Processing' ? 'active' : ''}>Processing</button></li>
          <li><button onClick={() => { setActiveSection('Sales & Distribution'); setMenuOpen(false); }} className={activeSection === 'Sales & Distribution' ? 'active' : ''}>Sales & Distribution</button></li>
          <li><button onClick={() => { setActiveSection('Users'); setMenuOpen(false); }} className={activeSection === 'Users' ? 'active' : ''}>Users</button></li>
          <li><button onClick={() => { setActiveSection('Reporting'); setMenuOpen(false); }} className={activeSection === 'Reporting' ? 'active' : ''}>Reporting</button></li>
        </ul>
      </nav>
      <div className="content">
        <h1>Tilly - Distillery Dog</h1>
        {renderSection()}
      </div>
    </div>
  );
};

export default App;