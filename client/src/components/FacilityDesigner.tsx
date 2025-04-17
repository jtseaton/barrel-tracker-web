// src/components/FacilityDesigner.tsx
import React, { useState, useEffect } from 'react';
import { Stage, Layer, Rect, Circle, Transformer } from 'react-konva';
import Konva from 'konva';
import { useNavigate } from 'react-router-dom';
import { Site, Location } from '../types/interfaces';

interface DesignObject {
  id: string;
  type: 'Tank' | 'Storage';
  shape: 'circle' | 'rectangle';
  x: number;
  y: number;
  width?: number;
  height?: number;
  radius?: number;
  locationId?: number;
}

// Define BoundingBox interface for Transformer boundBoxFunc
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
  const [siteId, setSiteId] = useState<string>('DSP-AL-20010'); // Default to Madison Distillery
  const [sites, setSites] = useState<Site[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [objects, setObjects] = useState<DesignObject[]>([]);
  const [selectedObjectId, setSelectedObjectId] = useState<string | null>(null);
  const [tool, setTool] = useState<'Tank' | 'Storage' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const transformerRef = React.useRef<Konva.Transformer | null>(null);

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

  // Fetch existing design
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

  // Add new object
  const addObject = (type: 'Tank' | 'Storage') => {
    if (!siteId) {
      setError('Please select a site first');
      return;
    }
    const newObject: DesignObject = {
      id: Date.now().toString(),
      type,
      shape: type === 'Tank' ? 'circle' : 'rectangle',
      x: 50,
      y: 50,
      width: type === 'Storage' ? 100 : undefined,
      height: type === 'Storage' ? 60 : undefined,
      radius: type === 'Tank' ? 30 : undefined,
    };
    setObjects([...objects, newObject]);
    setSelectedObjectId(newObject.id);
    setTool(null);
  };

  // Save design
  const saveDesign = () => {
    if (!siteId) {
      setError('Please select a site to save the design');
      return;
    }
    if (objects.some((obj) => !obj.locationId)) {
      setError('All objects must have an assigned location');
      return;
    }
    fetch(`${API_BASE_URL}/api/facility-design`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ siteId, objects }),
    })
      .then((res) => res.json())
      .then((data) => {
        setSuccessMessage(data.message);
        setTimeout(() => setSuccessMessage(null), 2000);
      })
      .catch((err) => setError('Failed to save design: ' + err.message));
  };

  // Handle drag end
  const handleDragEnd = (id: string, x: number, y: number) => {
    setObjects(objects.map((obj) => (obj.id === id ? { ...obj, x, y } : obj)));
  };

  // Handle resize
  const handleTransform = (id: string, newProps: Partial<DesignObject>) => {
    setObjects(
      objects.map((obj) => (obj.id === id ? { ...obj, ...newProps } : obj))
    );
  };

  // Assign location
  const assignLocation = (locationId: number) => {
    if (selectedObjectId) {
      setObjects(
        objects.map((obj) =>
          obj.id === selectedObjectId ? { ...obj, locationId } : obj
        )
      );
    }
  };

  // Select shape
  const handleSelect = (id: string) => {
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
    <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif', maxWidth: '1200px', margin: '0 auto' }}>
      <h2 style={{ color: '#333', marginBottom: '20px', textAlign: 'center' }}>Facility Designer</h2>
      {error && (
        <div style={{ color: 'red', marginBottom: '15px', textAlign: 'center' }}>{error}</div>
      )}
      {successMessage && (
        <div style={{ color: 'green', marginBottom: '15px', textAlign: 'center' }}>{successMessage}</div>
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
          </div>
          {selectedObjectId && (
            <div>
              <h3 style={{ color: '#555', marginBottom: '10px' }}>Assign Location</h3>
              <select
                value={objects.find((obj) => obj.id === selectedObjectId)?.locationId || ''}
                onChange={(e) => assignLocation(Number(e.target.value))}
                style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '4px', fontSize: '16px' }}
              >
                <option value="">Select Location</option>
                {locations.map((loc) => (
                  <option key={loc.locationId} value={loc.locationId}>
                    {loc.name}
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
        {/* Canvas */}
        <div style={{ flex: 1, backgroundColor: '#fff', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
          <Stage width={800} height={600}>
            <Layer>
              {objects.map((obj) => (
                <React.Fragment key={obj.id}>
                  {obj.shape === 'circle' ? (
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
                  ) : (
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
                  )}
                </React.Fragment>
              ))}
              <Transformer
                ref={transformerRef}
                enabledAnchors={['top-left', 'top-right', 'bottom-left', 'bottom-right']}
                boundBoxFunc={(oldBox: BoundingBox, newBox: BoundingBox) => {
                  // Limit minimum size
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
  );
};

export default FacilityDesigner;