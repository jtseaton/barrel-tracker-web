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

export interface ReceiveForm {
  identifier: string;
  account: Account; // Updated to use enum
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
  locationId: string;
}

export interface ReceiveItem {
  identifier: string;
  materialType: MaterialType;
  quantity: string;
  unit: Unit;
  proof?: string;
  description?: string;
  cost?: string;
  poNumber?: string;
  siteId: string;
  locationId: string;
}

export interface ReceivableItem {
  identifier: string;
  materialType: MaterialType;
  quantity: string;
  unit: Unit;
  proof?: string;
  description?: string;
  cost?: string;
  poNumber?: string;
  siteId: string;
  locationId: string;
}

export interface InventoryItem {
  identifier: string;
  account: Account; // Updated to use enum
  type: MaterialType;
  quantity: string;
  unit: Unit;
  proof?: string;
  proofGallons?: string;
  receivedDate: string;
  source?: string;
  dspNumber?: string;
  status: Status;
  description?: string;
  cost?: string;
  poNumber?: string;
  totalCost?: string;
  siteId: string;
  locationId: number;
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

export interface PurchaseOrder {
  poNumber: string;
  poDate: string;
  supplier: string;
  status: 'Open' | 'Closed';
  siteId?: string;
  comments?: string;
  items: PurchaseOrderItem[];
}

export interface PurchaseOrderItem {
  name: string;
  quantity: number;
  materialType: MaterialType;
}

export interface Vendor {
  name: string;
  enabled: number;
  contact?: string;
  address?: string;
  type: 'Supplier' | 'Customer' | 'Distributor' | 'Delivery';
  email?: string;
  phone?: string;
}

export interface Site {
  siteId: string;
  name: string;
  type: string;
  address?: string;
  enabled: number;
}

export interface Location {
  locationId: number;
  siteId: string;
  account: string; // Kept as string to match DB, could use Account if normalized
  name: string;
  enabled: number;
}