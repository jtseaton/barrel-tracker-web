import React, { useState } from 'react';
import { ReportData, TankSummary } from '../types/interfaces';
import { fetchMonthlyReport, fetchDailyReport } from '../utils/fetchUtils';
import { exportTankSummaryToExcel } from '../utils/excelUtils'; // Add this import

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:3000';

const Reporting: React.FC<{ exportToExcel: (report: ReportData) => void }> = ({ exportToExcel }) => {
  const [report, setReport] = useState<ReportData | null>(null);
  const [reportMonth, setReportMonth] = useState(new Date().toISOString().slice(0, 7));
  const [reportDate, setReportDate] = useState(new Date().toISOString().split('T')[0]);

  const handleFetchMonthlyReport = async () => {
    try {
      const data = await fetchMonthlyReport(reportMonth);
      setReport(data);
    } catch (err) {
      console.error('Report error:', err);
    }
  };

  const handleFetchDailyReport = async () => {
    try {
      const data = await fetchDailyReport(reportDate);
      setReport(data);
    } catch (err) {
      console.error('Daily report error:', err);
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

  const sampleTankSummary: TankSummary = {
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
  };

  return (
    <div>
      <h2>Reporting</h2>
      <div>
        <input type="month" value={reportMonth} onChange={(e) => setReportMonth(e.target.value)} />
        <button onClick={handleFetchMonthlyReport}>Fetch Monthly Report</button>
        {report && report.month && <button onClick={() => exportToExcel(report)}>Export to Excel</button>}
      </div>
      <div>
        <input type="date" value={reportDate} onChange={(e) => setReportDate(e.target.value)} />
        <button onClick={handleFetchDailyReport}>Fetch Daily Report</button>
      </div>
      <div>
        <button onClick={handlePhysicalInventory}>Record Physical Inventory</button>
        <button onClick={() => exportTankSummaryToExcel(sampleTankSummary)}>Export Tank Summary</button>
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
              {report.transactions.map((t, i) => (
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
};

export default Reporting;