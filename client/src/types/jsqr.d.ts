// src/types/jsqr.d.ts
declare module 'jsqr' {
  interface Point {
    x: number;
    y: number;
  }

  interface QRCode {
    data: string;
    binaryData: Uint8ClampedArray;
    dataMask: number;
    location: {
      topRightCorner: Point;
      topLeftCorner: Point;
      bottomRightCorner: Point;
      bottomLeftCorner: Point;
      topRightFinderPattern: Point;
      topLeftFinderPattern: Point;
      bottomLeftFinderPattern: Point;
      bottomRightAlignmentPattern?: Point;
    };
  }

  function jsQR(data: Uint8ClampedArray, width: number, height: number, options?: any): QRCode | null;
  export default jsQR;
}