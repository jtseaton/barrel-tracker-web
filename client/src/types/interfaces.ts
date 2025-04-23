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

export interface DesignObject {
  id: string;
  type: 'Tank' | 'Storage';
  shape: 'circle' | 'rectangle';
  x: number;
  y: number;
  width?: number;
  height?: number;
  radius?: number;
  locationId?: number; // Optional
  equipmentId?: number; // New: Optional equipment assignment
  name: string;
  abbreviation: string;
}

export interface DailySummaryItem {
  date: string; // Add this
  account: string;
  type: string; // Add this (for the next error)
  totalProofGallons: string;
  locationId: number; // Add this (for the last error)
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
  type: string;
  style: string;
  abv: number;
  ibu: number;
}


export interface Recipe {
  id: number;
  name: string;
  productId: number;
  ingredients: { itemName: string; quantity: number }[];
}

export interface Batch {
  batchId: string;
  productId: number;
  productName: string;
  recipeId: number;
  recipeName: string;
  siteId: string;
  siteName: string;
  status: string;
  date: string;
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
  item: string;
  lotNumber: string;
  materialType: MaterialType;
  quantity: string;
  unit: Unit;
  cost: string;
  description: string;
  siteId: string;
  locationId: string;
  poNumber?: string;
  account?: Account; // Add optional account
  proof?: string; // Add optional proof
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
  name: string;
  abbreviation: string; // Added
  enabled: number;
}

export interface Equipment {
  equipmentId: number;
  siteId: string;
  name: string;
  abbreviation: string; // Added
  enabled: number;
}