import { InventoryItem, DailySummaryItem, ReportData } from '../types/interfaces';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:3000';

export interface InventoryResponse {
  items: InventoryItem[];
  totalPages: number;
}

export const fetchInventory = async (): Promise<InventoryResponse | null> => {
  try {
    const token = localStorage.getItem('token');
    const response = await fetch(`${API_BASE_URL}/api/inventory`, {
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    return Array.isArray(data.items) ? data : null;
  } catch (error) {
    console.error('[fetchInventory] Error:', error);
    return null;
  }
};

export const fetchVendors = async (): Promise<any[] | null> => {
  try {
    const token = localStorage.getItem('token');
    const response = await fetch(`${API_BASE_URL}/api/vendors`, {
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });
    if (!response.ok) {
      throw new Error(`Vendors fetch failed: HTTP ${response.status}`);
    }
    const data = await response.json();
    return Array.isArray(data) ? data : null;
  } catch (error) {
    console.error('[fetchVendors] Error:', error);
    return null;
  }
};

export const fetchDailySummary = async (): Promise<DailySummaryItem[] | null> => {
  try {
    const token = localStorage.getItem('token');
    const response = await fetch(`${API_BASE_URL}/api/daily-summary`, {
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    return Array.isArray(data) ? data : null;
  } catch (error) {
    console.error('[fetchDailySummary] Error:', error);
    return null;
  }
};

export const fetchMonthlyReport = async (month: string): Promise<ReportData | null> => {
  try {
    const token = localStorage.getItem('token');
    const response = await fetch(`${API_BASE_URL}/api/report/monthly?month=${month}`, {
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });
    if (!response.ok) {
      throw new Error(`Failed to fetch report: ${response.status}`);
    }
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('[fetchMonthlyReport] Error:', error);
    return null;
  }
};

export const fetchDailyReport = async (date: string): Promise<ReportData | null> => {
  try {
    const token = localStorage.getItem('token');
    const response = await fetch(`${API_BASE_URL}/api/report/daily?date=${date}`, {
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });
    if (!response.ok) {
      throw new Error(`Failed to fetch report: ${response.status}`);
    }
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('[fetchDailyReport] Error:', error);
    return null;
  }
};