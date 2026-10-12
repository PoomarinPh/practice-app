/**
 * @fileoverview Unit test suite for color wheel and value slider geometry.
 * Validates coordinate mappings, orientation alignment, deadzone handling, and clamping.
 */

import { describe, expect, it } from 'vitest';
import {
  hsvToWheelPoint,
  sliderYToValue,
  valueToSliderY,
  wheelPointToHs,
} from '../src/utils/geometry.js';

describe('Geometry Utilities', () => {
  const center = { x: 150, y: 150 };
  const radius = 100;

  describe('wheelPointToHs()', () => {
    it('maps 6 o clock (straight down) to 0 degrees Red', () => {
      const point = { x: 150, y: 250 }; // y = center.y + radius
      const { h, s } = wheelPointToHs(point, center, radius);
      expect(h).toBeCloseTo(0, 0);
      expect(s).toBeCloseTo(1.0, 2);
    });

    it('maps 8 o clock to 60 degrees Yellow', () => {
      const angleRad = (150 * Math.PI) / 180;
      const point = {
        x: center.x + radius * Math.cos(angleRad),
        y: center.y + radius * Math.sin(angleRad),
      };
      const { h } = wheelPointToHs(point, center, radius);
      expect(h).toBeCloseTo(60, 0);
    });

    it('maps 10 o clock to 120 degrees Green', () => {
      const angleRad = (210 * Math.PI) / 180;
      const point = {
        x: center.x + radius * Math.cos(angleRad),
        y: center.y + radius * Math.sin(angleRad),
      };
      const { h } = wheelPointToHs(point, center, radius);
      expect(h).toBeCloseTo(120, 0);
    });

    it('maps 12 o clock (straight up) to 180 degrees Cyan', () => {
      const point = { x: 150, y: 50 }; // y = center.y - radius
      const { h, s } = wheelPointToHs(point, center, radius);
      expect(h).toBeCloseTo(180, 0);
      expect(s).toBeCloseTo(1.0, 2);
    });

    it('maps 2 o clock to 240 degrees Blue', () => {
      const angleRad = (330 * Math.PI) / 180;
      const point = {
        x: center.x + radius * Math.cos(angleRad),
        y: center.y + radius * Math.sin(angleRad),
      };
      const { h } = wheelPointToHs(point, center, radius);
      expect(h).toBeCloseTo(240, 0);
    });

    it('maps 4 o clock to 300 degrees Magenta', () => {
      const angleRad = (30 * Math.PI) / 180;
      const point = {
        x: center.x + radius * Math.cos(angleRad),
        y: center.y + radius * Math.sin(angleRad),
      };
      const { h } = wheelPointToHs(point, center, radius);
      expect(h).toBeCloseTo(300, 0);
    });

    it('clamps saturation to 1.0 when pointer extends outside wheel radius', () => {
      const point = { x: 150, y: 350 }; // distance = 200 > radius 100
      const { s } = wheelPointToHs(point, center, radius);
      expect(s).toBe(1.0);
    });

    it('preserves previous hue when pointer is in center deadzone (< 2px)', () => {
      const deadCenter = { x: 150.5, y: 150.2 };
      const { h, s } = wheelPointToHs(deadCenter, center, radius, 142);
      expect(h).toBe(142);
      expect(s).toBeLessThan(0.02);
    });
  });

  describe('hsvToWheelPoint() inverse projection', () => {
    it('projects (0 deg, S=1) to 6 o clock (straight down)', () => {
      const pt = hsvToWheelPoint({ h: 0, s: 1.0 }, center, radius);
      expect(pt.x).toBeCloseTo(150, 1);
      expect(pt.y).toBeCloseTo(250, 1);
    });

    it('projects (180 deg, S=1) to 12 o clock (straight up)', () => {
      const pt = hsvToWheelPoint({ h: 180, s: 1.0 }, center, radius);
      expect(pt.x).toBeCloseTo(150, 1);
      expect(pt.y).toBeCloseTo(50, 1);
    });

    it('achieves round-trip projection accuracy', () => {
      const testCases = [
        { h: 45, s: 0.75 },
        { h: 135, s: 0.5 },
        { h: 225, s: 0.9 },
        { h: 315, s: 0.3 },
      ];

      for (const tc of testCases) {
        const pt = hsvToWheelPoint(tc, center, radius);
        const mapped = wheelPointToHs(pt, center, radius);
        expect(mapped.h).toBeCloseTo(tc.h, 0);
        expect(mapped.s).toBeCloseTo(tc.s, 2);
      }
    });
  });

  describe('Vertical Value Slider mappings', () => {
    const trackTop = 20;
    const trackHeight = 200;

    it('maps top of track to Value 1.0 (White)', () => {
      expect(sliderYToValue(trackTop, trackTop, trackHeight)).toBe(1.0);
    });

    it('maps bottom of track to Value 0.0 (Black)', () => {
      expect(sliderYToValue(trackTop + trackHeight, trackTop, trackHeight)).toBe(0.0);
    });

    it('maps midpoint to Value 0.5', () => {
      expect(sliderYToValue(trackTop + trackHeight / 2, trackTop, trackHeight)).toBeCloseTo(0.5, 2);
    });

    it('clamps values when dragged outside slider boundaries', () => {
      expect(sliderYToValue(trackTop - 50, trackTop, trackHeight)).toBe(1.0);
      expect(sliderYToValue(trackTop + trackHeight + 50, trackTop, trackHeight)).toBe(0.0);
    });

    it('maps Value to slider thumb Y coordinate correctly', () => {
      expect(valueToSliderY(1.0, trackTop, trackHeight)).toBeCloseTo(trackTop, 1);
      expect(valueToSliderY(0.0, trackTop, trackHeight)).toBeCloseTo(trackTop + trackHeight, 1);
      expect(valueToSliderY(0.5, trackTop, trackHeight)).toBeCloseTo(trackTop + 100, 1);
    });
  });
});
