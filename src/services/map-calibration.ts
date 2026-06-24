export interface Point {
  x: number;
  y: number;
}

export interface CalibrationResult {
  pixels_per_world_unit: number;
  world_unit: string;
  point_a: Point;
  point_b: Point;
}

export function computeCalibration(pointA: Point, pointB: Point, worldDistance: number, worldUnit: string): CalibrationResult {
  const dx = pointB.x - pointA.x;
  const dy = pointB.y - pointA.y;
  const pixelDistance = Math.sqrt(dx * dx + dy * dy);
  return {
    pixels_per_world_unit: pixelDistance / worldDistance,
    world_unit: worldUnit,
    point_a: pointA,
    point_b: pointB,
  };
}

export function convertPixelsToWorldUnits(pixels: number, calibration: CalibrationResult): number {
  return pixels / calibration.pixels_per_world_unit;
}
