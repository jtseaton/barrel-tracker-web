import React, { useState, useEffect } from 'react';
import { Stage, Layer, Rect, Circle, Text } from 'react-konva';
import { Site, Location, Equipment, InventoryItem, DesignObject, Batch } from '../types/interfaces';
import '../App.css';

const API_BASE_URL: string = process.env.REACT_APP_API_BASE_URL || 'http://localhost:3000';

interface FacilityViewProps {
  siteId: string;
}

const FacilityView: React.FC<FacilityViewProps> = ({ siteId: initialSiteId }) => {
  const [siteId, setSiteId] = useState<string>(initialSiteId);
  const [sites, setSites] = useState<Site[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [objects, setObjects] = useState<DesignObject[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [selectedLocationId, setSelectedLocationId] = useState<number | null>(null);
  const [selectedEquipmentId, setSelectedEquipmentId] = useState<number | null>(null);
  const [selectedObject, setSelectedObject] = useState<DesignObject | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [sitesData, locationsData, equipmentData, designData] = await Promise.all([
          fetch(`${API_BASE_URL}/api/sites`).then((res) => res.json()),
          siteId ? fetch(`${API_BASE_URL}/api/locations?siteId=${siteId}`).then((res) => res.json()) : Promise.resolve([]),
          siteId ? fetch(`${API_BASE_URL}/api/equipment?siteId=${siteId}`).then((res) => res.json()) : Promise.resolve([]),
          siteId ? fetch(`${API_BASE_URL}/api/facility-design?siteId=${siteId}`).then((res) => res.json()) : Promise.resolve({ objects: [] }),
        ]);
        console.log('FacilityView fetched data:', { sitesData, locationsData, equipmentData, designData });
        setSites(sitesData);
        setLocations(locationsData);
        setEquipment(equipmentData);
        setObjects(designData?.objects && Array.isArray(designData.objects) ? designData.objects : []);
        setError(designData?.error || (designData?.objects && !Array.isArray(designData.objects) ? 'Invalid design data' : null));
      } catch (err: any) {
        console.error('Fetch error:', err);
        setError('Failed to load facility design: ' + err.message);
      }
    };
    fetchData();
  }, [siteId]);

  useEffect(() => {
    if (selectedLocationId) {
      fetch(`${API_BASE_URL}/api/inventory?locationId=${selectedLocationId}&siteId=${encodeURIComponent(siteId)}`)
        .then((res) => {
          if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
          return res.json();
        })
        .then((data: InventoryItem[]) => {
          console.log('Inventory data for locationId:', selectedLocationId, 'siteId:', siteId, data);
          setInventory(data);
        })
        .catch((err) => setError('Failed to load inventory: ' + (err instanceof Error ? err.message : 'Unknown error')));
    } else {
      setInventory([]);
    }
  }, [selectedLocationId, siteId]);

  const handleShapeClick = (obj: DesignObject) => {
    setSelectedLocationId(obj.locationId || null);
    setSelectedEquipmentId(obj.equipmentId || null);
    setSelectedObject(obj);
  };

  return (
    <div className="page-container">
      <h2>Facility View</h2>
      {error && (
        <div style={{ color: 'red', marginBottom: '15px' }}>{error}</div>
      )}
      <div style={{ display: 'flex' }}>
        <div
          style={{
            width: '250px',
            marginRight: '20px',
            backgroundColor: '#fff',
            padding: '20px',
            borderRadius: '8px',
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
          }}
        >
          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', color: '#555' }}>
              Site:
            </label>
            <select
              value={siteId}
              onChange={(e) => setSiteId(e.target.value)}
              style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '4px', fontSize: '16px' }}
            >
              <option value="">Select Site</option>
              {sites.map((site: Site) => (
                <option key={site.siteId} value={site.siteId}>
                  {site.name}
                </option>
              ))}
            </select>
          </div>
          {(selectedLocationId || selectedEquipmentId) && selectedObject && (
            <div>
              <h3 style={{ color: '#555', marginBottom: '10px' }}>
                {selectedLocationId
                  ? `Location: ${locations.find((loc) => loc.locationId === selectedLocationId)?.name || 'Unknown'}`
                  : `Equipment: ${equipment.find((eq) => eq.equipmentId === selectedEquipmentId)?.name || 'Unknown'}`}
              </h3>
              {selectedLocationId && (
                <>
                  <h4 style={{ color: '#555', marginBottom: '10px' }}>Inventory</h4>
                  {inventory.length === 0 ? (
                    <p style={{ color: '#777' }}>No inventory items found</p>
                  ) : (
                    <ul style={{ listStyle: 'none', padding: 0 }}>
                      {inventory.map((item: InventoryItem) => (
                        <li
                          key={item.identifier || `${item.type}-${item.quantity}`}
                          style={{ padding: '10px', borderBottom: '1px solid #eee', color: '#333' }}
                        >
                          {item.identifier || item.description || item.type || 'Unknown Item'}: {item.quantity} {item.unit}
                        </li>
                      ))}
                    </ul>
                  )}
                </>
              )}
              {selectedEquipmentId && (
                <>
                  <h4 style={{ color: '#555', marginBottom: '10px' }}>Batches</h4>
                  {selectedObject?.batches && selectedObject.batches.length > 0 ? (
                    <ul style={{ listStyle: 'none', padding: 0 }}>
                      {selectedObject.batches.map((batch: Batch) => (
                        <li
                          key={batch.batchId}
                          style={{ padding: '10px', borderBottom: '1px solid #eee', color: '#333' }}
                        >
                          Batch {batch.batchId} - Status: {batch.status}, Date: {batch.date}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p style={{ color: '#777' }}>No batches assigned</p>
                  )}
                </>
              )}
            </div>
          )}
        </div>
        <div
          style={{
            flex: 1,
            backgroundColor: '#fff',
            padding: '20px',
            borderRadius: '8px',
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
          }}
        >
          <Stage width={800} height={600}>
            <Layer>
              {objects.length === 0 && (
                <Text
                  x={400}
                  y={300}
                  width={200}
                  text="No design objects found"
                  fontSize={16}
                  fontFamily="Arial"
                  fill="gray"
                  align="center"
                />
              )}
              {objects.map((obj: DesignObject) => (
                <React.Fragment key={obj.id}>
                  {obj.shape === 'circle' ? (
                    <>
                      <Circle
                        x={obj.x}
                        y={obj.y}
                        radius={obj.radius}
                        fill="#90CAF9"
                        stroke="black"
                        onClick={() => handleShapeClick(obj)}
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
                      {obj.batches && obj.batches.length > 0 && (
                        <Text
                          x={obj.x - (obj.radius || 30) / 2}
                          y={obj.y + (obj.radius || 30) + 10}
                          width={obj.radius || 30}
                          text={obj.batches.map((b: Batch) => b.batchId).join(', ')}
                          fontSize={10}
                          fontFamily="Arial"
                          fill="black"
                          align="center"
                          listening={false}
                        />
                      )}
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
                        onClick={() => handleShapeClick(obj)}
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
                      {obj.batches && obj.batches.length > 0 && (
                        <Text
                          x={obj.x}
                          y={obj.y + (obj.height || 60) + 10}
                          width={obj.width || 100}
                          text={obj.batches.map((b: Batch) => b.batchId).join(', ')}
                          fontSize={10}
                          fontFamily="Arial"
                          fill="black"
                          align="center"
                          listening={false}
                        />
                      )}
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