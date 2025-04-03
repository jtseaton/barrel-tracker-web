import { Status, Unit, MaterialType, ProductClass } from './enums';
export { Status, Unit, MaterialType, ProductClass };

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
  account: string;
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
}

export interface ReceiveItem {
  identifier: string;
  materialType: MaterialType;
  quantity: string;
  unit: Unit;
  proof?: string;
  cost?: string;
  description?: string;
  poNumber?: string;
  isShipping?: boolean;
}

export interface InventoryItem {
  identifier: string;
  account: string;
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
  source: string;
  status: 'Open' | 'Closed';
  items: PurchaseOrderItem[];
}

export interface PurchaseOrderItem {
  name: string;
  quantity: number;
  materialType: MaterialType;
}