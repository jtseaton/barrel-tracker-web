export enum Status {
  Received = 'Received',
  Stored = 'Stored',
  Processing = 'Processing',
  Packaged = 'Packaged',
  Completed = 'Completed',
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
  Marketing = 'Marketing'
}

export enum ProductClass {
  Beer = 'Beer',
  Wine = 'Wine',
  Spirits = 'Spirits',
}

export enum ProductType {
  MaltBeverage = 'MaltBeverage',
  Seltzer = 'Seltzer',
  GrapeWine = 'GrapeWine',
  SparklingWine = 'SparklingWine',
  CarbonatedWine = 'CarbonatedWine',
  FruitWine = 'FruitWine',
  Cider = 'Cider',
  OtherAgriculturalWine = 'OtherAgriculturalWine',
  NeutralSpirits = 'NeutralSpirits',
  Whisky = 'Whisky',
  Gin = 'Gin',
  Vodka = 'Vodka',
  Rum = 'Rum',
  Tequila = 'Tequila',
  CordialsLiqueurs = 'CordialsLiqueurs',
  FlavoredSpirits = 'FlavoredSpirits',
  DistilledSpiritsSpecialty = 'DistilledSpiritsSpecialty',
}

export enum Style {
  Ale = 'Ale',
  Lager = 'Lager',
  IPA = 'IPA',
  Stout = 'Stout',
  Porter = 'Porter',
  Pilsner = 'Pilsner',
  Wheat = 'Wheat',
  Red = 'Red',
  White = 'White',
  Rosé = 'Rosé',
  Champagne = 'Champagne',
  Sherry = 'Sherry',
  Port = 'Port',
  Madeira = 'Madeira',
  Bourbon = 'Bourbon',
  Scotch = 'Scotch',
  Rye = 'Rye',
  LondonDry = 'LondonDry',
  Genever = 'Genever',
  OldTom = 'OldTom',
  Blanco = 'Blanco',
  Reposado = 'Reposado',
  Añejo = 'Añejo',
  SpicedRum = 'SpicedRum',
  WhiteRum = 'WhiteRum',
  Cocktail = 'Cocktail',
  Other = 'Other',
}

export enum Account {
  Storage = 'Storage',
  Processing = 'Processing',
  Production = 'Production',
}