// client/src/fetchUtils.ts
import { InventoryItem, DailySummaryItem, ReportData } from '../types/interfaces';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:3000';

export interface InventoryResponse {
  items: InventoryItem[];
  totalPages: number;
}

export const fetchInventory = async (): Promise<InventoryResponse | null> => {
  try {
    const res = await fetch(`${API_BASE_URL}/api/inventory`, {
      headers: { 'Content-Type': 'application/json' },
    });
    if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
    return res.json();
  } catch (error) {
    console.error('[fetchInventory] Error:', error);
    return null;
  }
};

export const fetchDailySummary = async (): Promise<DailySummaryItem[]> => {
  try {
    const res = await fetch(`${API_BASE_URL}/api/daily-summary`, {
      headers: { 'Content-Type': 'application/json' },
    });
    if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
    return res.json();
  } catch (error) {
    console.error('[fetchDailySummary] Error:', error);
    return [];
  }
};

export const fetchMonthlyReport = async (month: string): Promise<ReportData> => {
  const res = await fetch(`${API_BASE_URL}/api/report/monthly?month=${month}`);
  if (!res.ok) throw new Error(`Failed to fetch report: ${res.status}`);
  return res.json();
};

export const fetchDailyReport = async (date: string): Promise<ReportData> => {
  const res = await fetch(`${API_BASE_URL}/api/report/daily?date=${date}`);
  if (!res.ok) throw new Error(`Failed to fetch report: ${res.status}`);
  return res.json();
};