import * as XLSX from 'xlsx';
import { ReportData, TankSummary } from '../types/interfaces';

export const exportToExcel = (report: ReportData) => {
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
    ...(report.transactions || []).map((t) => [
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

export const exportTankSummaryToExcel = (tankSummary: TankSummary) => {
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
      ws[cell].s = { font: { bold: true }, fill: { fgColor: { rgb: 'FFFF00' } } };
    }
  });
  ws['!cols'] = [{ wch: 30 }, { wch: 35 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Tank Summary');
  XLSX.writeFile(wb, `${tankSummary.barrelId}_Tank_Summary_${tankSummary.serialNumber}.xlsx`);
};