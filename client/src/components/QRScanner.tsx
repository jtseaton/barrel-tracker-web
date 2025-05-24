// src/components/QRScanner.tsx
import React, { useEffect, useRef, useState } from 'react';
import jsQR from 'jsqr';

interface QRScannerProps {
  onScan: (code: string) => void;
  onError: (error: string) => void;
}

const QRScanner: React.FC<QRScannerProps> = ({ onScan, onError }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [manualCode, setManualCode] = useState('');
  const [isManual, setIsManual] = useState(false);

  useEffect(() => {
    let stream: MediaStream | null = null;
    const startCamera = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play();
          scan();
        }
      } catch (err) {
        console.error('QRScanner: Camera access error:', err);
        onError('Failed to access camera. Please allow camera permissions or use manual entry.');
        setIsManual(true);
      }
    };

    const scan = () => {
      if (!videoRef.current || !canvasRef.current) return;
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');
      if (!context) return;

      const scanFrame = () => {
        if (videoRef.current && videoRef.current.readyState === videoRef.current.HAVE_ENOUGH_DATA) {
          canvas.width = videoRef.current.videoWidth;
          canvas.height = videoRef.current.videoHeight;
          context.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
          const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
          const code = jsQR(imageData.data, imageData.width, imageData.height);
          if (code) {
            onScan(code.data);
          }
        }
        requestAnimationFrame(scanFrame);
      };
      scanFrame();
    };

    if (!isManual) {
      startCamera();
    }

    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [isManual, onScan, onError]);

  const handleManualSubmit = () => {
    if (manualCode && /^[A-Z0-9-]+$/.test(manualCode)) {
      onScan(manualCode);
      setManualCode('');
    } else {
      onError('Invalid keg code format');
    }
  };

  return (
    <div style={{ textAlign: 'center' }}>
      {isManual ? (
        <div>
          <input
            type="text"
            value={manualCode}
            onChange={(e) => setManualCode(e.target.value)}
            placeholder="Enter keg code (e.g., KEG-001)"
            style={{ padding: '10px', margin: '10px', width: '200px' }}
          />
          <button
            onClick={handleManualSubmit}
            style={{
              backgroundColor: '#2196F3',
              color: '#fff',
              padding: '10px 20px',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
            }}
          >
            Submit
          </button>
          <button
            onClick={() => setIsManual(false)}
            style={{
              backgroundColor: '#F86752',
              color: '#fff',
              padding: '10px 20px',
              margin: '10px',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
            }}
          >
            Use Camera
          </button>
        </div>
      ) : (
        <div>
          <video ref={videoRef} style={{ width: '100%', maxWidth: '400px' }} />
          <canvas ref={canvasRef} style={{ display: 'none' }} />
          <button
            onClick={() => setIsManual(true)}
            style={{
              backgroundColor: '#F86752',
              color: '#fff',
              padding: '10px 20px',
              margin: '10px',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
            }}
          >
            Manual Entry
          </button>
        </div>
      )}
    </div>
  );
};

export default QRScanner;