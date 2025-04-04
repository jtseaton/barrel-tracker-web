export enum Status {
  Received = 'Received',
  Stored = 'Stored',
  Processing = 'Processing',
  Packaged = 'Packaged',
}

export enum Unit {
  Pounds = 'lbs',
  Gallons = 'gallons',
  Count = 'count',
}
export const TEST_VALUE = 'test'; // Add this line

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