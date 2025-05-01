export enum Status {
  Received = 'Received',
  Stored = 'Storage', // Changed to match CFR, though we'll phase this into Account
  Processing = 'Processing',
  Packaged = 'Packaged',
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