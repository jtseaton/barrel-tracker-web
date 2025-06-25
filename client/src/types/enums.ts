export enum Status {
  Received = 'Received',
  Stored = 'Stored', // Matches backend inventory status; will transition to InStock for beer
  Processing = 'Processing',
  Packaged = 'Packaged',
  Completed = 'Completed', // Added for Batch.status
}

export enum Unit {
  Pounds = 'lbs',
  Gallons = 'gallons',
  Liters = 'liters',
  Barrels = 'barrels',
  Count = 'count',
}

export enum Role {
  SuperAdmin = 'SuperAdmin',
  Admin = 'Admin',
  Sales = 'Sales',
  Production = 'Production',
}

export const TEST_VALUE = 'test';

export enum MaterialType {
  Grain = 'Grain',
  Sugar = 'Sugar',
  Hops = 'Hops',
  Yeast = 'Yeast',
  Water = 'Water',
  Spirits = 'Spirits',
  Botanical = 'Botanical',
  Mash = 'Mash',
  Aging = 'Aging',
  Packaging = 'Packaging',
  Other = 'Other',
  FinishedGoods = 'Finished Goods',
  Marketing = 'Marketing',
}

export enum ProductClass {
  Beer = 'Beer',
  Wine = 'Wine',
  Spirits = 'Spirits',
}

export enum ProductType {
  Malt = 'Malt',
  Spirits = 'Spirits',
  Wine = 'Wine',
  Merchandise = 'Merchandise',
  Cider = 'Cider',
  Seltzer = 'Seltzer',
}

export enum Account {
  Storage = 'Storage',
  Processing = 'Processing',
  Production = 'Production',
}