import { Status, Style, Unit, MaterialType, ProductClass, Account, ProductType } from './enums';
export { Status, Style, Unit, MaterialType, ProductClass, Account, ProductType };

export interface Transaction {
  action: string;
  proofGallons: number;
  type: string;
  date: string;
  barrelId?: string;
  toAccount?: string;
}

export interface PackageType {
  type: string;
  price: string;
  isKegDepositItem: boolean;
}

export interface PackagingAction {
  id: number;
  batchId: string;
  packageType: string;
  quantity: number;
  volume: number;
  locationId: number;
  date: string;
  siteId: string;
  keg_codes?: string;
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
  locationId?: number;
  equipmentId?: number;
  name: string;
  abbreviation: string;
  batches?: Batch[];
}

export interface DailySummaryItem {
  date: string;
  account: string;
  type: string;
  totalProofGallons: string;
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
  enabled: number;
  priority: number;
  class: string; // Reverted to string for compatibility
  type: ProductType;
  style: Style | undefined;
  abv: number;
  ibu: number | null;
  packageTypes?: { type: string; price: string; isKegDepositItem: boolean }[];
}

export interface User {
  email: string;
  passwordHash: string | null;
  role: string;
  enabled: boolean;
  passkey: string | null;
}

export interface Recipe {
  id: number;
  name: string;
  productId: number;
  quantity: number;
  unit: string;
  ingredients: { itemName: string; quantity: number; unit: string }[];
}

export interface Ingredient {
  itemName: string;
  quantity: number;
  unit: string;
  isRecipe?: boolean;
  proof?: number;
  proofGallons?: number;
}

export interface Customer {
  customerId: number;
  name: string;
  email: string;
  address?: string;
  phone?: string;
  contactPerson?: string;
  licenseNumber?: string;
  notes?: string;
  enabled: number;
  createdDate?: string;
  updatedDate?: string;
}

export interface SalesOrder {
  orderId: number;
  customerId: number;
  poNumber?: string;
  status: string;
  createdDate: string;
  customerName?: string;
}

export interface SalesOrderItem {
  id?: number;
  itemName: string;
  quantity: number;
  unit: string;
  price: string;
  hasKegDeposit: boolean;
  kegCodes?: string[];
}

export interface InvoiceItem {
  id?: number;
  itemName: string;
  quantity: number;
  unit: string;
  price: string;
  hasKegDeposit: boolean;
  kegDeposit?: {
    itemName: string;
    quantity: number;
    unit: string;
    price: string;
    hasKegDeposit: boolean;
    isSubCharge: boolean;
  } | null;
  kegCodes?: string[];
}

export interface Invoice {
  invoiceId: number;
  orderId: number;
  customerId: number;
  status: string;
  createdDate: string;
  postedDate?: string;
  customerName: string;
  customerEmail: string;
  items?: InvoiceItem[];
  total: string;
  subtotal: string;
  keg_deposit_total: string;
  keg_deposit_price: string;
}

export interface Batch {
  batchId: string;
  productId: number;
  productName?: string;
  recipeId: number;
  recipeName?: string;
  siteId: string;
  siteName?: string;
  status: Status;
  date: string;
  ingredients?: Ingredient[];
  additionalIngredients?: Ingredient[];
  equipmentId?: number | null;
  fermenterId: number | null;
  stage?: 'Brewing' | 'Fermentation' | 'Filtering/Carbonating' | 'Packaging' | 'Completed';
  volume?: number;
}

export interface ReceiveForm {
  identifier: string;
  item: string;
  lotNumber: string;
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
  locationId?: string;
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
  account?: Account;
  proof?: string;
}

export interface ReceivableItem {
  identifier: string;
  item: string;
  lotNumber: string;
  materialType: MaterialType;
  quantity: string;
  unit: Unit;
  proof?: string;
  description?: string;
  cost?: string;
  poNumber?: string;
  siteId: string;
  locationId?: string;
}

export interface InventoryItem {
  identifier: string;
  item: string;
  lotNumber: string;
  account: Account;
  type: MaterialType;
  quantity: string;
  unit: Unit;
  proof?: string;
  proofGallons?: string;
  receivedDate: string;
  source?: string;
  dspNumber?: string;
  status: 'Received' | 'Stored' | 'Processing' | 'Packaged';
  description?: string;
  cost?: string;
  totalCost?: string;
  poNumber?: string;
  siteId: string;
  locationId?: number;
  price?: string;
  isKegDepositItem?: number | null;
}

export interface BatchDetailsProps {
  inventory: InventoryItem[];
  refreshInventory: () => Promise<void>;
}

export interface PurchaseOrder {
  poNumber: string;
  supplier: string;
  items: PurchaseOrderItem[];
  siteId?: string;
  poDate?: string;
  comments?: string;
}

export interface PurchaseOrderItem {
  name: string;
  materialType: MaterialType;
  quantity: number;
}

export interface Vendor {
  name: string;
  enabled?: number;
  type?: string;
  address?: string;
  email?: string;
  phone?: string;
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
  abbreviation: string;
  enabled: number;
}

export interface Equipment {
  equipmentId: number;
  siteId: string;
  name: string;
  abbreviation: string;
  enabled: number;
}

export interface Keg {
  id: number;
  code: string;
  status: string;
  productId?: number;
  lastScanned: string;
  location?: string;
  locationName?: string;
  customerId?: number;
  customerName?: string;
  productName?: string;
  packagingType?: string;
}

export interface KegTransaction {
  id: number;
  kegId: number;
  action: string;
  productId?: number;
  batchId?: string;
  invoiceId?: number;
  customerId?: number;
  date: string;
  location?: string;
  customerName?: string;
}

export interface KegTrackingProps {
  inventory: InventoryItem[];
  refreshInventory: () => Promise<void>;
}