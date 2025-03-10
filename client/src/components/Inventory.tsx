import React from 'react';
import { InventoryItem } from '../types/interfaces';

interface InventoryProps {
  inventory: InventoryItem[];
}

const Inventory: React.FC<InventoryProps> = ({ inventory }) => {
  return (
    <div style={{ padding: '20px' }}>
      <h2>Inventory Management</h2>
      <h2>Received/Stored Inventory</h2>
      {inventory.length === 0 ? (
        <p>No inventory items found.</p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '20px' }}>
          <thead>
            <tr>
              <th style={{ border: '1px solid #ddd', padding: '8px' }}>Identifier</th>
              <th style={{ border: '1px solid #ddd', padding: '8px' }}>Type</th>
              <th style={{ border: '1px solid #ddd', padding: '8px' }}>Description</th>
              <th style={{ border: '1px solid #ddd', padding: '8px' }}>Quantity</th>
              <th style={{ border: '1px solid #ddd', padding: '8px' }}>Unit</th>
              <th style={{ border: '1px solid #ddd', padding: '8px' }}>Proof</th>
              <th style={{ border: '1px solid #ddd', padding: '8px' }}>Proof Gallons</th>
              <th style={{ border: '1px solid #ddd', padding: '8px' }}>Date Received</th>
              <th style={{ border: '1px solid #ddd', padding: '8px' }}>Source</th>
              <th style={{ border: '1px solid #ddd', padding: '8px' }}>DSP Number</th>
              <th style={{ border: '1px solid #ddd', padding: '8px' }}>Status</th>
            </tr>
          </thead>
          <tbody>
            {inventory
              .filter((item) => ['Received', 'Stored'].includes(item.status))
              .map((item) => (
                <tr key={item.identifier || `${item.type}-${item.receivedDate}`}>
                  <td style={{ border: '1px solid #ddd', padding: '8px' }}>{item.identifier || 'N/A'}</td>
                  <td style={{ border: '1px solid #ddd', padding: '8px' }}>{item.type}</td>
                  <td style={{ border: '1px solid #ddd', padding: '8px' }}>{item.description || 'N/A'}</td>
                  <td style={{ border: '1px solid #ddd', padding: '8px' }}>{item.quantity || '0.00'}</td>
                  <td style={{ border: '1px solid #ddd', padding: '8px' }}>{item.unit || 'N/A'}</td>
                  <td style={{ border: '1px solid #ddd', padding: '8px' }}>{item.proof || 'N/A'}</td>
                  <td style={{ border: '1px solid #ddd', padding: '8px' }}>{item.proofGallons || '0.00'}</td>
                  <td style={{ border: '1px solid #ddd', padding: '8px' }}>{item.receivedDate || 'N/A'}</td>
                  <td style={{ border: '1px solid #ddd', padding: '8px' }}>{item.source || 'N/A'}</td>
                  <td style={{ border: '1px solid #ddd', padding: '8px' }}>{item.dspNumber || 'N/A'}</td>
                  <td style={{ border: '1px solid #ddd', padding: '8px' }}>{item.status}</td>
                </tr>
              ))}
          </tbody>
        </table>
      )}
      <h2>Finished Packaged Inventory</h2>
      {inventory.length === 0 ? (
        <p>No packaged inventory items found.</p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ border: '1px solid #ddd', padding: '8px' }}>Identifier</th>
              <th style={{ border: '1px solid #ddd', padding: '8px' }}>Type</th>
              <th style={{ border: '1px solid #ddd', padding: '8px' }}>Quantity (WG)</th>
              <th style={{ border: '1px solid #ddd', padding: '8px' }}>Proof</th>
              <th style={{ border: '1px solid #ddd', padding: '8px' }}>Proof Gallons</th>
              <th style={{ border: '1px solid #ddd', padding: '8px' }}>Date Packaged</th>
              <th style={{ border: '1px solid #ddd', padding: '8px' }}>Source</th>
              <th style={{ border: '1px solid #ddd', padding: '8px' }}>DSP Number</th>
            </tr>
          </thead>
          <tbody>
            {inventory
              .filter((item) => item.account === 'Processing' && item.status === 'Packaged')
              .map((item) => (
                <tr key={item.identifier || `${item.type}-${item.receivedDate}`}>
                  <td style={{ border: '1px solid #ddd', padding: '8px' }}>{item.identifier || 'N/A'}</td>
                  <td style={{ border: '1px solid #ddd', padding: '8px' }}>{item.type}</td>
                  <td style={{ border: '1px solid #ddd', padding: '8px' }}>{item.quantity || '0.00'}</td>
                  <td style={{ border: '1px solid #ddd', padding: '8px' }}>{item.proof || '0.00'}</td>
                  <td style={{ border: '1px solid #ddd', padding: '8px' }}>{item.proofGallons || '0.00'}</td>
                  <td style={{ border: '1px solid #ddd', padding: '8px' }}>{item.receivedDate || 'N/A'}</td>
                  <td style={{ border: '1px solid #ddd', padding: '8px' }}>{item.source || 'N/A'}</td>
                  <td style={{ border: '1px solid #ddd', padding: '8px' }}>{item.dspNumber || 'N/A'}</td>
                </tr>
              ))}
          </tbody>
        </table>
      )}
    </div>
  );
};

export default Inventory;