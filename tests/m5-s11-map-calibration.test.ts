// @vitest-environment node
// E8-S03: Map calibration — two-click scale line, pixels_per_world_unit computation.
// See: https://github.com/Djimon/WorldBrain/issues/77

import { describe, expect, it } from 'vitest';

async function getCalibration() { return import('../src/services/map-calibration'); }

describe('E8-S03 map calibration', () => {
  describe('computeCalibration', () => {
    it('exports computeCalibration function', async () => {
      const mod = await getCalibration();
      expect(typeof mod.computeCalibration).toBe('function');
    });

    it('computes pixels_per_world_unit from two points and a world distance', async () => {
      const { computeCalibration } = await getCalibration();
      // Points 300px apart, world distance = 3 km → 100 px/km
      const result = computeCalibration({ x: 0, y: 0 }, { x: 300, y: 0 }, 3, 'km');
      expect(result.pixels_per_world_unit).toBeCloseTo(100, 1);
    });

    it('computes correctly for diagonal lines', async () => {
      const { computeCalibration } = await getCalibration();
      // 300px diagonal (3-4-5 triangle: 300,400 → 500px), world = 5 miles → 100 px/mile
      const result = computeCalibration({ x: 0, y: 0 }, { x: 300, y: 400 }, 5, 'miles');
      expect(result.pixels_per_world_unit).toBeCloseTo(100, 1);
    });

    it('stores world_unit in the calibration result', async () => {
      const { computeCalibration } = await getCalibration();
      const result = computeCalibration({ x: 0, y: 0 }, { x: 200, y: 0 }, 2, 'ft');
      expect(result.world_unit).toBe('ft');
    });

    it('stores point_a and point_b in the result', async () => {
      const { computeCalibration } = await getCalibration();
      const result = computeCalibration({ x: 10, y: 20 }, { x: 110, y: 20 }, 1, 'km');
      expect(result.point_a).toEqual({ x: 10, y: 20 });
      expect(result.point_b).toEqual({ x: 110, y: 20 });
    });
  });

  describe('convertPixelsToWorldUnits', () => {
    it('exports convertPixelsToWorldUnits function', async () => {
      const mod = await getCalibration();
      expect(typeof mod.convertPixelsToWorldUnits).toBe('function');
    });

    it('converts pixel distance to world units using calibration', async () => {
      const { computeCalibration, convertPixelsToWorldUnits } = await getCalibration();
      const cal = computeCalibration({ x: 0, y: 0 }, { x: 100, y: 0 }, 1, 'km');
      expect(convertPixelsToWorldUnits(200, cal)).toBeCloseTo(2, 1);
    });
  });

  describe('uncalibrated maps', () => {
    it('map functions work without calibration (pixel coordinates only)', async () => {
      // Calibration is optional — no calibration means raw pixel coords
      const { computeCalibration } = await getCalibration();
      expect(() => computeCalibration({ x: 0, y: 0 }, { x: 100, y: 0 }, 1, 'km')).not.toThrow();
    });
  });

  describe('supported world units', () => {
    it('accepts km, m, ft, miles as world units', async () => {
      const { computeCalibration } = await getCalibration();
      ['km', 'm', 'ft', 'miles'].forEach(unit => {
        expect(() => computeCalibration({ x: 0, y: 0 }, { x: 100, y: 0 }, 1, unit)).not.toThrow();
      });
    });
  });
});
