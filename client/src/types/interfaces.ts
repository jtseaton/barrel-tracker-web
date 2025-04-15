import { Status, Unit, MaterialType, ProductClass, Account } from './enums';
export { Status, Unit, MaterialType, ProductClass, Account };

export interface Transaction {
  action: string;
  proofGallons: number;
  type: string;
  date: string;
  barrelId?: string;
  toAccount?: string;
}

export interface ReportData {
  month?: string;
  date?: string;
  totalReceived: number;
  totalProcessed: number;
  totalMoved?: number;
  totalRemoved?: number;
  byType?: { [key: string]: number };
  transactions?: Transaction[];
}

export interface TankSummary {
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

export interface DailySummaryItem {
  account: string;
  totalProofGallons: string;
}

export interface MoveForm {
  identifier: string;
  toAccount: string;
  proofGallons: string;
}

export interface PackageForm {
  batchId: string;
  product: string;
  proofGallons: string;
  targetProof: string;
  netContents: string;
  alcoholContent: string;
  healthWarning: boolean;
}

export interface LossForm {
  identifier: string;
  quantityLost: string;
  proofGallonsLost: string;
  reason: string;
  date: string;
}

export interface Product {
  id: number;
  name: string;
  abbreviation: string;
  enabled: boolean;
  priority: number;
  class: string;
  productColor: string;
  type: string;
  style: string;
  abv: number;
  ibu: number;
}

export interface Recipe {
  id: number;
  productId: number;
  name: string;
  ingredients: string;
  instructions: string;
}

export interface ReceiveForm {
  identifier: string;
  item: string; // Replaces identifier
  lotNumber: string; // New field
  account: Account;
  materialType: MaterialType;
  quantity: string;
  unit: Unit;
  proof?: string;
  source: string;
  dspNumber?: string;
  receivedDate: string;
  description?: string;
  cost?: string;
  poNumber?: string;
  siteId: string;
  locationId?: string; // Optional
}

export interface ReceiveItem {
  identifier: string;
  item: string; // Replaces identifier
  lotNumber: string; // New field
  materialType: MaterialType;
  quantity: string;
  unit: Unit;
  proof?: string;
  description?: string;
  cost?: string;
  poNumber?: string;
  siteId: string;
  locationId?: string; // Optional
}

export interface ReceivableItem {
  identifier: string;
  item: string; // Replaces identifier
  lotNumber: string; // New field
  materialType: MaterialType;
  quantity: string;
  unit: Unit;
  proof?: string;
  description?: string;
  cost?: string;
  poNumber?: string;
  siteId: string;
  locationId?: string; // Optional
}

export interface InventoryItem {
  identifier: string;
  item: string;
  lotNumber: string;
  account: Account;
  type: MaterialType;
  quantity: string;
  unit: Unit;
  proof?: string; // Optional, string | undefined
  proofGallons?: string;
  receivedDate: string;
  source?: string;
  dspNumber?: string;
  status: Status;
  description?: string; // Optional, string | undefined
  cost?: string;
  totalCost?: string;
  poNumber?: string;
  siteId: string;
  locationId?: number;
}

export interface PurchaseOrder {
  poNumber: string;
  supplier: string;
  items: PurchaseOrderItem[];
  siteId?: string; // Added for VendorDetails.tsx
  poDate?: string; // Added for VendorDetails.tsx
  comments?: string; // Added for VendorDetails.tsx
}

export interface PurchaseOrderItem {
  name: string;
  materialType: MaterialType;
  quantity: number;
}

export interface Vendor {
  name: string;
  enabled?: number;
  type?: string; // Added for VendorDetails.tsx
  address?: string; // Added for VendorDetails.tsx
  email?: string; // Added for VendorDetails.tsx
  phone?: string; // Added for VendorDetails.tsx
}

export interface Site {
  siteId: string;
  name: string;
  type?: string;
  address?: string;
  enabled?: number;
}

export interface Location {
  locationId: number;
  siteId: string;
  account: string;
  name: string;
  enabled: number;
}