import { Status, Unit, MaterialType } from './enums';

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
  isShipping?: boolean; // Add this
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
  // No isShipping here—it’s not stored
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
  id: number; // Assuming DB ID
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
  id: number; // Assuming DB ID
  productId: number;
  name: string;
  ingredients: string; // Simplified for now, could be an array later
  instructions: string;
}