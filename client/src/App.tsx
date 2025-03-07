import React, { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import './App.css';

interface InventoryItem {
  barrelId: string;
  account: string;
  type: string;
  quantity: number;
  proof: number;
  proofGallons: number;
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

const App: React.FC = () => {
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [receiveForm, setReceiveForm] = useState({
    barrelId: '',
    account: 'Production',
    type: 'Cane Sugar',
    quantity: '',
    proof: '',
    source: '',
    dspNumber: 'DSP-AL-20010',
    receivedDate: new Date().toISOString().split('T')[0]
  });
  const [moveForm, setMoveForm] = useState({
    barrelId: '',
    toAccount: 'Storage',
    proofGallons: ''
  });
  const [packageForm, setPackageForm] = useState({
    barrelId: '',
    product: 'Old Black Bear Vodka',
    proofGallons: '',
    targetProof: '80'
  });
  const [report, setReport] = useState<ReportData | null>(null);
  const [reportMonth, setReportMonth] = useState(new Date().toISOString().slice(0, 7));
  const [reportDate, setReportDate] = useState(new Date().toISOString().split('T')[0]);
  const [activeSection, setActiveSection] = useState('Home');
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    fetchInventory();
  }, []);

  const fetchInventory = async () => {
    try {
      const res = await fetch('/api/inventory');
      if (!res.ok) throw new Error(`Failed to fetch inventory: ${res.status}`);
      const data = await res.json();
      console.log('Updated inventory:', data);
      setInventory(data);
    } catch (err: unknown) {
      const error = err as Error;
      console.error('Inventory fetch error:', error);
    }
  };

  const handleReceive = async () => {
    console.log('Sending receive request:', receiveForm);
    try {
      const res = await fetch('/api/receive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...receiveForm,
          quantity: parseFloat(receiveForm.quantity),
          proof: parseFloat(receiveForm.proof) || 0
        })
      });
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
      const data = await res.json();
      console.log('Receive response:', data);
      await fetchInventory();
      if (data.tankSummary) {
        console.log('Exporting tank summary for receive:', data.tankSummary);
        exportTankSummaryToExcel(data.tankSummary);
      }
      setReceiveForm({ ...receiveForm, barrelId: '', quantity: '', proof: '', source: '', receivedDate: new Date().toISOString().split('T')[0] });
    } catch (err: unknown) {
      const error = err as Error;
      console.error('Receive error:', error);
      alert('Failed to receive item: ' + error.message);
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
      await fetchInventory();
      if (data.tankSummary) {
        console.log('tankSummary exists, forcing export:', data.tankSummary);
        exportTankSummaryToExcel(data.tankSummary);
      }
      setMoveForm({ barrelId: '', toAccount: 'Storage', proofGallons: '' });
    } catch (err: unknown) {
      const error = err as Error;
      console.error('Move error:', error);
      alert('Failed to move item: ' + error.message);
    }
  };

  const handlePackage = async () => {
    if (!packageForm.barrelId || !packageForm.proofGallons || !packageForm.targetProof) {
      console.log('Invalid package request: missing fields');
      alert('Please fill in Barrel ID, Proof Gallons, and Target Proof.');
      return;
    }
    const sourceProofGallons = parseFloat(packageForm.proofGallons);
    const targetProof = parseFloat(packageForm.targetProof);
    const bottleSizeGal = 0.198129; // 750ml in gallons

    // Fetch source barrel to get proof
    const sourceItem = inventory.find(item => item.barrelId === packageForm.barrelId && item.account === 'Processing');
    if (!sourceItem) {
      alert('Barrel not found in Processing!');
      return;
    }
    const sourceProof = sourceItem.proof;
    const sourceVolume = sourceProofGallons / (sourceProof / 100); // Gallons
    const targetVolume = sourceProofGallons / (targetProof / 100); // Gallons before shrinkage
    const waterVolume = targetVolume - sourceVolume;
    const shrinkageFactor = 0.98; // ~2% shrinkage
    const finalVolume = targetVolume * shrinkageFactor;
    const bottleCount = Math.floor(finalVolume / bottleSizeGal);
    const finalProofGallons = bottleCount * bottleSizeGal * (targetProof / 100);

    console.log('Packaging calc:', { sourceProofGallons, sourceProof, targetProof, sourceVolume, targetVolume, waterVolume, finalVolume, bottleCount, finalProofGallons });

    try {
      const res = await fetch('/api/package', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          barrelId: packageForm.barrelId,
          product: packageForm.product,
          proofGallons: finalProofGallons.toFixed(2),
          targetProof: targetProof.toFixed(2),
          waterVolume: waterVolume.toFixed(2),
          bottleCount,
          toAccount: 'Finished Goods',
          date: new Date().toISOString().split('T')[0]
        })
      });
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
      const data = await res.json();
      console.log('Package response:', data);
      await fetchInventory();
      if (data.tankSummary) {
        console.log('Exporting tank summary for package:', data.tankSummary);
        exportTankSummaryToExcel(data.tankSummary);
      }
      setPackageForm({ barrelId: '', product: 'Old Black Bear Vodka', proofGallons: '', targetProof: '80' });
    } catch (err: unknown) {
      const error = err as Error;
      console.error('Package error:', error);
      alert('Failed to package item: ' + error.message);
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
    } catch (err: unknown) {
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
    } catch (err: unknown) {
      console.error('Daily report error:', err);
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
    } catch (err: unknown) {
      console.error('Export failed:', err);
      alert('Failed to export tank summary: ' + (err instanceof Error ? err.message : 'Unknown error'));
    }
  };

  const renderSection = () => {
    switch (activeSection) {
      case 'Home':
        return <div><h2>Welcome to Barrel Tracker</h2><p>Select a section from the menu.</p></div>;
      case 'Production':
        return <div><h2>Production</h2><p>Production features coming soon.</p></div>;
      case 'Inventory':
        return (
          <div>
            <h2>Inventory</h2>
            <div>
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
              <input type="number" placeholder="Quantity (WG)" value={receiveForm.quantity} onChange={e => setReceiveForm({ ...receiveForm, quantity: e.target.value })} step="0.01" />
              <input type="number" placeholder="Proof (if Spirits)" value={receiveForm.proof} onChange={e => setReceiveForm({ ...receiveForm, proof: e.target.value })} step="0.01" />
              <input type="text" placeholder="Source" value={receiveForm.source} onChange={e => setReceiveForm({ ...receiveForm, source: e.target.value })} />
              <input type="text" placeholder="DSP Number" value={receiveForm.dspNumber} onChange={e => setReceiveForm({ ...receiveForm, dspNumber: e.target.value })} />
              <input type="date" value={receiveForm.receivedDate} onChange={e => setReceiveForm({ ...receiveForm, receivedDate: e.target.value })} />
              <button onClick={handleReceive}>Receive</button>
            </div>
            <div>
              <h3>Move Inventory</h3>
              <input type="text" placeholder="Barrel ID (e.g., GNS250329)" value={moveForm.barrelId} onChange={e => setMoveForm({ ...moveForm, barrelId: e.target.value })} />
              <select value={moveForm.toAccount} onChange={e => setMoveForm({ ...moveForm, toAccount: e.target.value })}>
                <option value="Production">Production</option>
                <option value="Storage">Storage</option>
                <option value="Processing">Processing</option>
              </select>
              <input type="number" placeholder="Proof Gallons to Move" value={moveForm.proofGallons} onChange={e => setMoveForm({ ...moveForm, proofGallons: e.target.value })} step="0.01" />
              <button onClick={handleMove}>Move</button>
            </div>
            <h3>All Inventory</h3>
            <table>
              <thead>
                <tr>
                  <th>Barrel ID</th>
                  <th>Account</th>
                  <th>Type</th>
                  <th>Quantity (WG)</th>
                  <th>Proof</th>
                  <th>Proof Gallons</th>
                  <th>Date</th>
                  <th>Source</th>
                  <th>DSP Number</th>
                </tr>
              </thead>
              <tbody>
                {inventory.map(item => (
                  <tr key={item.barrelId}>
                    <td>{item.barrelId}</td>
                    <td>{item.account}</td>
                    <td>{item.type}</td>
                    <td>{item.quantity !== null ? Number(item.quantity).toFixed(2) : 'N/A'}</td>
                    <td>{item.proof !== null ? Number(item.proof).toFixed(2) : 'N/A'}</td>
                    <td>{Number(item.proofGallons).toFixed(2)}</td>
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
                placeholder="Barrel ID in Processing"
                value={packageForm.barrelId}
                onChange={e => setPackageForm({ ...packageForm, barrelId: e.target.value })}
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
              <button onClick={handlePackage}>Complete Packaging</button>
            </div>
            <h3>Processing Inventory</h3>
            <table>
              <thead>
                <tr>
                  <th>Barrel ID</th>
                  <th>Type</th>
                  <th>Quantity (WG)</th>
                  <th>Proof</th>
                  <th>Proof Gallons</th>
                  <th>Date</th>
                  <th>Source</th>
                  <th>DSP Number</th>
                </tr>
              </thead>
              <tbody>
                {inventory.filter(item => item.account === 'Processing').map(item => (
                  <tr key={item.barrelId}>
                    <td>{item.barrelId}</td>
                    <td>{item.type}</td>
                    <td>{item.quantity !== null ? Number(item.quantity).toFixed(2) : 'N/A'}</td>
                    <td>{item.proof !== null ? Number(item.proof).toFixed(2) : 'N/A'}</td>
                    <td>{Number(item.proofGallons).toFixed(2)}</td>
                    <td>{item.receivedDate || 'N/A'}</td>
                    <td>{item.source || 'N/A'}</td>
                    <td>{item.dspNumber || 'N/A'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      case 'Sales & Distribution':
        return <div><h2>Sales & Distribution</h2><p>Sales features coming soon.</p></div>;
      case 'Users':
        return <div><h2>Users</h2><p>User management coming soon.</p></div>;
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
              <button onClick={() => exportTankSummaryToExcel({
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
              })}>
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
                      <li key={i}>{`${t.action}: ${Number(t.proofGallons).toFixed(2)} PG (${t.type}) on ${t.date} ${t.barrelId ? `(Barrel: ${t.barrelId})` : ''} ${t.toAccount ? `to ${t.toAccount}` : ''}`}</li>
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
        <h1>Barrel Tracker</h1>
        {renderSection()}
      </div>
    </div>
  );
};

export default App;