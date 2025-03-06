import React, { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import './App.css';

interface InventoryItem {
  barrelId: string;
  account: string;
  type: string;
  quantity: number; // Wine gallons
  proof: number;
  proofGallons: number;
  receivedDate: string;
  source: string;
  dspNumber: string;
}

interface ReportData {
  month?: string;
  date?: string;
  totalReceived: number;
  totalProcessed: number;
  totalMoved?: number;
  totalRemoved?: number;
  transactions?: { action: string; proofGallons: number; type: string; date: string; barrelId?: string }[];
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
  const [report, setReport] = useState<ReportData | null>(null);
  const [reportMonth, setReportMonth] = useState(new Date().toISOString().slice(0, 7));
  const [reportDate, setReportDate] = useState(new Date().toISOString().split('T')[0]);

  useEffect(() => {
    fetch('/api/inventory')
      .then(res => res.json())
      .then(data => setInventory(data));
  }, []);

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
      const inventoryRes = await fetch('/api/inventory');
      if (!inventoryRes.ok) throw new Error('Failed to fetch inventory');
      const inventoryData = await inventoryRes.json();
      console.log('Updated inventory:', inventoryData);
      setInventory(inventoryData);
      setReceiveForm({ ...receiveForm, barrelId: '', quantity: '', proof: '', source: '', receivedDate: new Date().toISOString().split('T')[0] });
    } catch (err: unknown) {
      const error = err as Error;
      console.error('Receive error:', error);
      alert('Failed to receive item: ' + error.message);
    }
  };

  const handleMove = async () => {
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
      const inventoryRes = await fetch('/api/inventory');
      if (!inventoryRes.ok) throw new Error('Failed to fetch inventory');
      const inventoryData = await inventoryRes.json();
      console.log('Updated inventory after move:', inventoryData);
      setInventory(inventoryData);
      setMoveForm({ barrelId: '', toAccount: 'Storage', proofGallons: '' });
    } catch (err: unknown) {
      const error = err as Error;
      console.error('Move error:', error);
      alert('Failed to move item: ' + error.message);
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
      alert('Failed to fetch monthly report: ' + (err instanceof Error ? err.message : 'Unknown error'));
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
      alert('Failed to fetch daily report: ' + (err instanceof Error ? err.message : 'Unknown error'));
    }
  };

  const exportToExcel = () => {
    if (!report || !report.month) return;
    const wsData = [
      ['TTB F 5110.40 - Monthly Report', report.month],
      [''],
      ['Total Received (PG)', report.totalReceived],
      ['Total Processed (PG)', report.totalProcessed],
      ['Total Moved (PG)', report.totalMoved || 0],
      ['Total Removed (PG)', report.totalRemoved || 0],
      [''],
      ['Transactions'],
      ['Action', 'Proof Gallons', 'Type', 'Date', 'Barrel ID'],
      ...(report.transactions || []).map(t => [t.action, t.proofGallons, t.type, t.date, t.barrelId || 'N/A'])
    ];
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Monthly Report');
    XLSX.writeFile(wb, `Monthly_Report_${report.month}.xlsx`);
  };

  return (
    <div className="App">
      <h1>Barrel Tracker</h1>
      <div>
        <h2>Receive Inventory</h2>
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
        <input type="number" placeholder="Quantity (WG)" value={receiveForm.quantity} onChange={e => setReceiveForm({ ...receiveForm, quantity: e.target.value })} />
        <input type="number" placeholder="Proof (if Spirits)" value={receiveForm.proof} onChange={e => setReceiveForm({ ...receiveForm, proof: e.target.value })} />
        <input type="text" placeholder="Source" value={receiveForm.source} onChange={e => setReceiveForm({ ...receiveForm, source: e.target.value })} />
        <input type="text" placeholder="DSP Number" value={receiveForm.dspNumber} onChange={e => setReceiveForm({ ...receiveForm, dspNumber: e.target.value })} />
        <input type="date" value={receiveForm.receivedDate} onChange={e => setReceiveForm({ ...receiveForm, receivedDate: e.target.value })} />
        <button onClick={handleReceive}>Receive</button>
      </div>
      <div>
        <h2>Move Inventory</h2>
        <input type="text" placeholder="Barrel ID (e.g., GNS250329)" value={moveForm.barrelId} onChange={e => setMoveForm({ ...moveForm, barrelId: e.target.value })} />
        <select value={moveForm.toAccount} onChange={e => setMoveForm({ ...moveForm, toAccount: e.target.value })}>
          <option value="Production">Production</option>
          <option value="Storage">Storage</option>
          <option value="Processing">Processing</option>
        </select>
        <input type="number" placeholder="Proof Gallons to Move" value={moveForm.proofGallons} onChange={e => setMoveForm({ ...moveForm, proofGallons: e.target.value })} />
        <button onClick={handleMove}>Move</button>
      </div>
      <div>
  <h2>Inventory</h2>
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
          <td>{item.quantity !== null ? item.quantity : 'N/A'}</td>
          <td>{item.proof !== null ? item.proof : 'N/A'}</td>
          <td>{item.proofGallons}</td>
          <td>{item.receivedDate || 'N/A'}</td>
          <td>{item.source || 'N/A'}</td>
          <td>{item.dspNumber || 'N/A'}</td>
        </tr>
      ))}
    </tbody>
  </table>
</div>
      <div>
        <h2>Reports</h2>
        <div>
          <input type="month" value={reportMonth} onChange={e => setReportMonth(e.target.value)} />
          <button onClick={fetchMonthlyReport}>Fetch Monthly Report</button>
          {report && report.month && <button onClick={exportToExcel}>Export to Excel</button>}
        </div>
        <div>
          <input type="date" value={reportDate} onChange={e => setReportDate(e.target.value)} />
          <button onClick={fetchDailyReport}>Fetch Daily Report</button>
        </div>
        {report ? (
          <div>
            <h3>{report.month ? `Monthly Report: ${report.month}` : `Daily Report: ${report.date}`}</h3>
            <p>Total Received: {report.totalReceived} PG</p>
            <p>Total Processed: {report.totalProcessed} PG</p>
            {report.totalMoved !== undefined && <p>Total Moved: {report.totalMoved} PG</p>}
            {report.totalRemoved !== undefined && <p>Total Removed: {report.totalRemoved} PG</p>}
            {report.transactions && (
              <ul>
                {report.transactions.map((t, i) => (
                  <li key={i}>{`${t.action}: ${t.proofGallons} PG (${t.type}) on ${t.date} ${t.barrelId ? `(Barrel: ${t.barrelId})` : ''}`}</li>
                ))}
              </ul>
            )}
          </div>
        ) : (
          <p>Select a month or date and fetch a report.</p>
        )}
      </div>
    </div>
  );
};

export default App;