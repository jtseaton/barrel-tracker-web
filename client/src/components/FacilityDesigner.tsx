import React, { useState, useEffect } from 'react';
import { Stage, Layer, Rect, Circle, Transformer, Text } from 'react-konva';
import Konva from 'konva';
import { useNavigate } from 'react-router-dom';
import { Site, Location, Equipment, DesignObject } from '../types/interfaces';
import '../App.css';

interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
}

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:3000';

const FacilityDesigner: React.FC = () => {
  const navigate = useNavigate();
  const [siteId, setSiteId] = useState<string>('DSP-AL-20010');
  const [sites, setSites] = useState<Site[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [objects, setObjects] = useState<DesignObject[]>([]);
  const [selectedObjectId, setSelectedObjectId] = useState<string | null>(null);
  const [tool, setTool] = useState<'Tank' | 'Storage' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const transformerRef = React.useRef<Konva.Transformer | null>(null);

  useEffect(() => {
    fetch(`${API_BASE_URL}/api/sites`)
      .then((res) => res.json())
      .then((data) => setSites(data))
      .catch((err) => setError('Failed to load sites: ' + err.message));
  }, []);

  useEffect(() => {
    if (siteId) {
      Promise.all([
        fetch(`${API_BASE_URL}/api/locations?siteId=${siteId}`).then((res) => res.json()),
        fetch(`${API_BASE_URL}/api/equipment?siteId=${siteId}`).then((res) => res.json()),
        fetch(`${API_BASE_URL}/api/facility-design?siteId=${siteId}`).then((res) => res.json()),
      ])
        .then(([locationsData, equipmentData, designData]) => {
          console.log(`Fetched data for siteId=${siteId}:`, { locationsData, equipmentData, designData });
          setLocations(locationsData);
          setEquipment(equipmentData);
          setObjects(designData?.objects && Array.isArray(designData.objects) ? designData.objects : []); setError(designData?.error || null);        })
        .catch((err) => setError('Failed to load data: ' + err.message));
    } else {
      setLocations([]);
      setEquipment([]);
      setObjects([]);
    }
  }, [siteId]);

  const addObject = (type: 'Tank' | 'Storage') => {
    if (!siteId) {
      setError('Please select a site first');
      return;
    }
    const newObject: DesignObject = {
      id: Date.now().toString(), // String ID
      type,
      shape: type === 'Tank' ? 'circle' : 'rectangle',
      x: 50,
      y: 50,
      width: type === 'Storage' ? 100 : undefined,
      height: type === 'Storage' ? 60 : undefined,
      radius: type === 'Tank' ? 30 : undefined,
      name: '',
      abbreviation: '',
    };
    console.log('Adding new object:', newObject);
    setObjects([...objects, newObject]);
    setSelectedObjectId(newObject.id);
    setTool(null);
  };

  const deleteObject = () => {
    if (selectedObjectId) {
      console.log('Deleting object:', selectedObjectId);
      setObjects(objects.filter((obj) => obj.id !== selectedObjectId));
      setSelectedObjectId(null);
      if (transformerRef.current) {
        transformerRef.current.nodes([]);
        transformerRef.current.getLayer()?.batchDraw();
      }
    }
  };

  const saveDesign = async () => {
    if (!siteId) {
      setError('Please select a site to save the design');
      return;
    }
    if (objects.some((obj) => !obj.locationId && !obj.equipmentId)) {
      setError('All objects must have an assigned Location or Equipment');
      return;
    }
    if (objects.some((obj) => !obj.name || !obj.abbreviation)) {
      setError('All objects must have a name and abbreviation');
      return;
    }
    const payload = { siteId, objects };
    console.log('Saving design:', payload);
    try {
      const response = await fetch(`${API_BASE_URL}/api/facility-design`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to save design: ${errorText}`);
      }
      const data = await response.json();
      console.log('Save response:', data);
      setSuccessMessage(data.message || 'Design saved successfully');
      setTimeout(() => setSuccessMessage(null), 2000);
      setError(null);
    } catch (err: any) {
      console.error('Save design error:', err);
      setError('Failed to save design: ' + err.message);
    }
  };

  const handleDragEnd = (id: string, x: number, y: number) => {
    console.log('Drag end:', { id, x, y });
    setObjects(objects.map((obj) => (obj.id === id ? { ...obj, x, y } : obj)));
  };

  const handleTransform = (id: string, newProps: Partial<DesignObject>) => {
    console.log('Transform:', { id, newProps });
    setObjects(
      objects.map((obj) => (obj.id === id ? { ...obj, ...newProps } : obj))
    );
  };

  const assignLocation = (locationId: number) => {
    if (selectedObjectId) {
      const selectedLocation = locations.find((loc) => loc.locationId === locationId);
      if (!selectedLocation) {
        setError('Selected location not found');
        return;
      }
      console.log('Assigning location:', { selectedObjectId, locationId, name: selectedLocation.name });
      setObjects(
        objects.map((obj) =>
          obj.id === selectedObjectId
            ? {
                ...obj,
                locationId,
                equipmentId: undefined,
                name: selectedLocation.name,
                abbreviation: selectedLocation.abbreviation || selectedLocation.name.slice(0, 3).toUpperCase(),
              }
            : obj
        )
      );
    }
  };

  const assignEquipment = (equipmentId: number) => {
    if (selectedObjectId) {
      const selectedEquipment = equipment.find((eq) => eq.equipmentId === equipmentId);
      if (!selectedEquipment) {
        setError('Selected equipment not found');
        return;
      }
      console.log('Assigning equipment:', { selectedObjectId, equipmentId, name: selectedEquipment.name });
      setObjects(
        objects.map((obj) =>
          obj.id === selectedObjectId
            ? {
                ...obj,
                equipmentId,
                locationId: undefined,
                name: selectedEquipment.name,
                abbreviation: selectedEquipment.abbreviation || selectedEquipment.name.slice(0, 3).toUpperCase(),
              }
            : obj
        )
      );
    }
  };

  const handleSelect = (id: string) => {
    console.log('Selected object:', id);
    setSelectedObjectId(id);
    if (transformerRef.current) {
      const stage = transformerRef.current.getStage();
      const node = stage?.findOne(`#${id}`);
      if (node) {
        transformerRef.current.nodes([node]);
        transformerRef.current.getLayer()?.batchDraw();
      }
    }
  };

  return (
    <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif' }}>
      <div className="page-container">
        <h2 style={{ color: '#333', marginBottom: '20px' }}>Facility Designer</h2>
        {error && (
          <div style={{ color: 'red', marginBottom: '15px' }}>{error}</div>
        )}
        {successMessage && (
          <div style={{ color: 'green', marginBottom: '15px' }}>{successMessage}</div>
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
                {sites.map((site) => (
                  <option key={site.siteId} value={site.siteId}>
                    {site.name}
                  </option>
                ))}
              </select>
            </div>
            <div style={{ marginBottom: '15px' }}>
              <button
                onClick={() => addObject('Tank')}
                style={{
                  width: '100%',
                  padding: '10px',
                  marginBottom: '10px',
                  backgroundColor: '#2196F3',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '16px',
                }}
                onMouseOver={(e) => (e.currentTarget.style.backgroundColor = '#1976D2')}
                onMouseOut={(e) => (e.currentTarget.style.backgroundColor = '#2196F3')}
              >
                Add Tank
              </button>
              <button
                onClick={() => addObject('Storage')}
                style={{
                  width: '100%',
                  padding: '10px',
                  marginBottom: '10px',
                  backgroundColor: '#2196F3',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '16px',
                }}
                onMouseOver={(e) => (e.currentTarget.style.backgroundColor = '#1976D2')}
                onMouseOut={(e) => (e.currentTarget.style.backgroundColor = '#2196F3')}
              >
                Add Storage
              </button>
              <button
                onClick={deleteObject}
                disabled={!selectedObjectId}
                style={{
                  width: '100%',
                  padding: '10px',
                  marginBottom: '10px',
                  backgroundColor: selectedObjectId ? '#F86752' : '#ccc',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: selectedObjectId ? 'pointer' : 'not-allowed',
                  fontSize: '16px',
                }}
                onMouseOver={(e) => {
                  if (selectedObjectId) e.currentTarget.style.backgroundColor = '#D32F2F';
                }}
                onMouseOut={(e) => {
                  if (selectedObjectId) e.currentTarget.style.backgroundColor = '#F86752';
                }}
              >
                Delete Selected
              </button>
            </div>
            {selectedObjectId && (
              <div>
                <h3 style={{ color: '#555', marginBottom: '10px' }}>Assign Location</h3>
                <select
                  value={objects.find((obj) => obj.id === selectedObjectId)?.locationId || ''}
                  onChange={(e) => assignLocation(Number(e.target.value))}
                  style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '4px', fontSize: '16px', marginBottom: '15px' }}
                >
                  <option value="">Select Location</option>
                  {locations.map((loc) => (
                    <option key={loc.locationId} value={loc.locationId}>
                      {loc.name}
                    </option>
                  ))}
                </select>
                <h3 style={{ color: '#555', marginBottom: '10px' }}>Assign Equipment</h3>
                <select
                  value={objects.find((obj) => obj.id === selectedObjectId)?.equipmentId || ''}
                  onChange={(e) => assignEquipment(Number(e.target.value))}
                  style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '4px', fontSize: '16px' }}
                >
                  <option value="">Select Equipment</option>
                  {equipment.map((eq) => (
                    <option key={eq.equipmentId} value={eq.equipmentId}>
                      {eq.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <button
              onClick={saveDesign}
              style={{
                width: '100%',
                padding: '10px',
                marginTop: '20px',
                backgroundColor: '#2196F3',
                color: '#fff',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '16px',
              }}
              onMouseOver={(e) => (e.currentTarget.style.backgroundColor = '#1976D2')}
              onMouseOut={(e) => (e.currentTarget.style.backgroundColor = '#2196F3')}
            >
              Save Design
            </button>
          </div>
          <div style={{ flex: 1, backgroundColor: '#fff', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
            <Stage width={800} height={600}>
              <Layer>
                {objects.map((obj) => (
                  <React.Fragment key={obj.id}>
                    {obj.shape === 'circle' ? (
                      <>
                        <Circle
                          id={obj.id}
                          x={obj.x}
                          y={obj.y}
                          radius={obj.radius}
                          fill="#90CAF9"
                          stroke="black"
                          draggable
                          onDragEnd={(e: Konva.KonvaEventObject<DragEvent>) =>
                            handleDragEnd(obj.id, e.target.x(), e.target.y())
                          }
                          onClick={() => handleSelect(obj.id)}
                          onTransform={(e: Konva.KonvaEventObject<Event>) => {
                            const node = e.target as Konva.Circle;
                            handleTransform(obj.id, { radius: node.radius() });
                          }}
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
                          id={obj.id}
                          x={obj.x}
                          y={obj.y}
                          width={obj.width}
                          height={obj.height}
                          fill="#A5D6A7"
                          stroke="black"
                          draggable
                          onDragEnd={(e: Konva.KonvaEventObject<DragEvent>) =>
                            handleDragEnd(obj.id, e.target.x(), e.target.y())
                          }
                          onClick={() => handleSelect(obj.id)}
                          onTransform={(e: Konva.KonvaEventObject<Event>) => {
                            const node = e.target as Konva.Rect;
                            handleTransform(obj.id, {
                              width: node.width() * node.scaleX(),
                              height: node.height() * node.scaleY(),
                            });
                            node.scaleX(1);
                            node.scaleY(1);
                          }}
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
                <Transformer
                  ref={transformerRef}
                  enabledAnchors={['top-left', 'top-right', 'bottom-left', 'bottom-right']}
                  boundBoxFunc={(oldBox: BoundingBox, newBox: BoundingBox) => {
                    if (newBox.width < 20 || newBox.height < 20) {
                      return oldBox;
                    }
                    return newBox;
                  }}
                />
              </Layer>
            </Stage>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FacilityDesigner;