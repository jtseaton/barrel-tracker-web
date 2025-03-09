import { Status, Unit, MaterialType } from './enums';

export interface InventoryItem {
  identifier?: string;
  account: string;
  type: MaterialType;
  quantity: string;
  unit: string;
  proof?: string;
  proofGallons?: string;
  receivedDate: string;
  source: string;
  dspNumber: string;
  status: Status;
  description?: string;
}

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
  identifier?: string;
  account: string;
  materialType: MaterialType;
  quantity: string;
  unit: Unit;
  proof?: string;
  source: string;
  dspNumber: string;
  receivedDate: string;
  description?: string;
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