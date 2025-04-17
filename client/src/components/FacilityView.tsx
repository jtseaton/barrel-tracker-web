// src/components/FacilityView.tsx
import React, { useState, useEffect } from 'react';
import { Stage, Layer, Rect, Circle, Text } from 'react-konva';
import { Site, Location, InventoryItem, DesignObject } from '../types/interfaces';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:3000';

const FacilityView: React.FC = () => {
  const [siteId, setSiteId] = useState<string>('DSP-AL-20010');
  const [sites, setSites] = useState<Site[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [objects, setObjects] = useState<DesignObject[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [selectedLocationId, setSelectedLocationId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Fetch sites
  useEffect(() => {
    fetch(`${API_BASE_URL}/api/sites`)
      .then((res) => res.json())
      .then((data) => setSites(data))
      .catch((err) => setError('Failed to load sites: ' + err.message));
  }, []);

  // Fetch locations for selected site
  useEffect(() => {
    if (siteId) {
      fetch(`${API_BASE_URL}/api/locations?siteId=${siteId}`)
        .then((res) => res.json())
        .then((data) => setLocations(data))
        .catch((err) => setError('Failed to load locations: ' + err.message));
    } else {
      setLocations([]);
    }
  }, [siteId]);

  // Fetch design
  useEffect(() => {
    if (siteId) {
      fetch(`${API_BASE_URL}/api/facility-design?siteId=${siteId}`)
        .then((res) => res.json())
        .then((data) => setObjects(data?.objects || []))
        .catch((err) => setError('Failed to load design: ' + err.message));
    } else {
      setObjects([]);
    }
  }, [siteId]);

  // Fetch inventory for selected location
  useEffect(() => {
    if (selectedLocationId) {
      fetch(`${API_BASE_URL}/api/inventory?locationId=${selectedLocationId}`)
        .then((res) => res.json())
        .then((data) => setInventory(data))
        .catch((err) => setError('Failed to load inventory: ' + err.message));
    } else {
      setInventory([]);
    }
  }, [selectedLocationId]);

  return (
    <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif', maxWidth: '1200px', margin: '0 auto' }}>
      <h2 style={{ color: '#333', marginBottom: '20px', textAlign: 'center' }}>Facility View</h2>
      {error && (
        <div style={{ color: 'red', marginBottom: '15px', textAlign: 'center' }}>{error}</div>
      )}
      <div style={{ display: 'flex' }}>
        {/* Sidebar */}
        <div style={{
          width: '250px',
          marginRight: '20px',
          backgroundColor: '#fff',
          padding: '20px',
          borderRadius: '8px',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
        }}>
          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', color: '555' }}>
              Site:
            </label>
            <select
              value={siteId}
              onChange={(e) => {
                setSiteId(e.target.value);
                setSelectedLocationId(null);
              }}
              style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '4px', fontSize: '16px' }}
            >
              <option value="">Select Site</option>
              {sites.map((site) => (
                <option key={site.siteId} value={site.siteId}>
                  {site.name}
                </option>
              ))}
            </select>
          </div>
          {selectedLocationId && (
            <div>
              <h3 style={{ color: '#555', marginBottom: '10px' }}>
                Inventory at {locations.find((loc) => loc.locationId === selectedLocationId)?.name || 'Location'}
              </h3>
              {inventory.length > 0 ? (
                <ul style={{ listStyle: 'none', padding: 0 }}>
                  {inventory.map((item) => (
                    <li key={item.identifier} style={{ padding: '5px 0', borderBottom: '1px solid #eee' }}>
                      {item.item}: {item.quantity}
                    </li>
                  ))}
                </ul>
              ) : (
                <p>No inventory found</p>
              )}
            </div>
          )}
        </div>
        {/* Canvas */}
        <div style={{ flex: 1, backgroundColor: '#fff', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
          <Stage width={800} height={600}>
          <Layer>
            {objects.map((obj) => (
                <React.Fragment key={obj.id}>
                {obj.shape === 'circle' ? (
                    <>
                    <Circle
                        x={obj.x}
                        y={obj.y}
                        radius={obj.radius}
                        fill="#90CAF9"
                        stroke="black"
                        onClick={() => setSelectedLocationId(obj.locationId || null)}
                    />
                    <Text
                        x={obj.x - (obj.radius || 30) / 2}
                        y={obj.y - (obj.radius || 30) / 2}
                        width={obj.radius || 30}
                        height={obj.radius || 30}
                        text={obj.abbreviation}
                        fontSize={12}
                        fontFamily="Arial"
                        fill="black"
                        align="center"
                        verticalAlign="middle"
                        listening={false}
                    />
                    </>
                ) : (
                    <>
                    <Rect
                        x={obj.x}
                        y={obj.y}
                        width={obj.width}
                        height={obj.height}
                        fill="#A5D6A7"
                        stroke="black"
                        onClick={() => setSelectedLocationId(obj.locationId || null)}
                    />
                    <Text
                        x={obj.x}
                        y={obj.y + ((obj.height || 60) / 2) - 6}
                        width={obj.width || 100}
                        height={12}
                        text={obj.abbreviation}
                        fontSize={12}
                        fontFamily="Arial"
                        fill="black"
                        align="center"
                        verticalAlign="middle"
                        listening={false}
                    />
                    </>
                )}
                </React.Fragment>
            ))}
            </Layer>
          </Stage>
        </div>
      </div>
    </div>
  );
};

export default FacilityView;