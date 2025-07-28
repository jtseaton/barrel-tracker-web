import { InventoryItem, DailySummaryItem, ReportData } from '../types/interfaces';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:10000';

export interface InventoryResponse {
  items: InventoryItem[];
  totalPages: number;
}

export const fetchInventory = async () => {
  try {
    const token = localStorage.getItem('token');
    if (!token) {
      console.log('fetchInventory: No token found, redirecting to login');
      window.location.href = '/login';
      throw new Error('No token found in localStorage');
    }
    const response = await fetch(`${API_BASE_URL}/api/inventory`, {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
    });
    console.log('fetchInventory response:', { status: response.status, ok: response.ok });
    if (response.status === 401 || response.status === 403) {
      console.log('fetchInventory: Token invalid or expired, redirecting to login');
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
      throw new Error('Session expired, please log in again');
    }
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `HTTP error: ${response.status}`);
    }
    const data = await response.json();
    console.log('fetchInventory data:', data);
    return data;
  } catch (error) {
    console.error('fetchInventory error:', error);
    throw error;
  }
};

export const fetchVendors = async () => {
  try {
    const token = localStorage.getItem('token');
    if (!token) {
      console.log('fetchVendors: No token found, redirecting to login');
      window.location.href = '/login';
      throw new Error('No token found in localStorage');
    }
    const response = await fetch(`${API_BASE_URL}/api/vendors`, {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
    });
    console.log('fetchVendors response:', { status: response.status, ok: response.ok });
    if (response.status === 401 || response.status === 403) {
      console.log('fetchVendors: Token invalid or expired, redirecting to login');
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
      throw new Error('Session expired, please log in again');
    }
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `HTTP error: ${response.status}`);
    }
    const data = await response.json();
    console.log('fetchVendors data:', data);
    return data;
  } catch (error) {
    console.error('fetchVendors error:', error);
    throw error;
  }
};

export const fetchDailySummary = async () => {
  try {
    const token = localStorage.getItem('token');
    if (!token) {
      console.log('fetchDailySummary: No token found, redirecting to login');
      window.location.href = '/login';
      throw new Error('No token found in localStorage');
    }
    const response = await fetch(`${API_BASE_URL}/api/daily-summary`, {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
    });
    console.log('fetchDailySummary response:', { status: response.status, ok: response.ok });
    if (response.status === 401 || response.status === 403) {
      console.log('fetchDailySummary: Token invalid or expired, redirecting to login');
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
      throw new Error('Session expired, please log in again');
    }
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `HTTP error: ${response.status}`);
    }
    const data = await response.json();
    console.log('fetchDailySummary data:', data);
    return data;
  } catch (error) {
    console.error('fetchDailySummary error:', error);
    throw error;
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