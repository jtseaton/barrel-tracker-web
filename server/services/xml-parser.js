const fs = require('fs').promises;
const path = require('path');
const xml2js = require('xml2js');
const { db } = require('./database');

let packageVolumes = {};

const loadPackageTypesFromXML = async () => {
  try {
    const data = await fs.readFile(path.join(__dirname, '../config/package_types.xml'), 'utf8');
    const result = await xml2js.parseStringPromise(data);
    const packageTypes = result.packageTypes.packageType || [];
    packageVolumes = packageTypes.reduce((acc, pkg) => {
      const attributes = pkg.$ || {};
      const name = String(attributes.name || '').replace(/[^\w\s\/-]/g, '');
      const volume = parseFloat(attributes.volume || '0');
      const enabled = parseInt(attributes.enabled || '1', 10);
      if (name && volume > 0 && enabled === 1) {
        acc[name] = volume;
      }
      return acc;
    }, {});
    console.log('Loaded package volumes:', packageVolumes);
    module.exports.packageVolumes = packageVolumes;
  } catch (err) {
    console.error('Error loading package_types.xml:', err);
  }
};

const loadItemsFromXML = () => {
  fs.readFile(path.join(__dirname, '../config/items.xml'), 'utf8', (err, data) => {
    if (err) {
      console.error('Error reading items.xml:', err);
      return;
    }
    xml2js.parseString(data, (err, result) => {
      if (err) {
        console.error('Error parsing items.xml:', err);
        return;
      }
      const items = result.items.item || [];
      items.forEach((item) => {
        const attributes = item.$ || {};
        const name = String(attributes.name || '').replace(/[^a-zA-Z0-9\s]/g, '');
        const type = String(attributes.type || 'Other').replace(/[^a-zA-Z0-9\s]/g, '');
        const enabled = parseInt(attributes.enabled || '1', 10) || 1;
        db.run(
          'INSERT OR IGNORE INTO items (name, type, enabled) VALUES (?, ?, ?)',
          [name, type, enabled],
          (err) => {
            if (err) console.error(`Error inserting item ${name}:`, err);
          }
        );
      });
    });
  });
};

module.exports = { loadPackageTypesFromXML, loadItemsFromXML, get packageVolumes() { return packageVolumes; } };