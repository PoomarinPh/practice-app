/**
 * @fileoverview Unit test suite for color math and conversion utilities.
 * Conforms to Google JavaScript Style Guide and DESIGN.md specifications.
 */

import { describe, expect, it } from 'vitest';
import {
  hexToRgb,
  hsvToHex,
  hsvToRgb,
  relativeLuminance,
  rgbToHex,
  rgbToHsv,
} from '../src/utils/color.js';

describe('Color Math Utilities', () => {
  describe('hsvToRgb()', () => {
    it('converts pure black correctly', () => {
      const rgb = hsvToRgb({ h: 0, s: 0, v: 0 });
      expect(rgb).toEqual({ r: 0, g: 0, b: 0 });
    });

    it('converts pure white correctly', () => {
      const rgb = hsvToRgb({ h: 0, s: 0, v: 1.0 });
      expect(rgb).toEqual({ r: 255, g: 255, b: 255 });
    });

    it('converts neutral medium gray correctly', () => {
      const rgb = hsvToRgb({ h: 0, s: 0, v: 0.5 });
      expect(rgb.r).toBeCloseTo(128, -1);
      expect(rgb.g).toBeCloseTo(128, -1);
      expect(rgb.b).toBeCloseTo(128, -1);
    });

    it('converts primary and secondary pure saturated hues correctly', () => {
      expect(hsvToRgb({ h: 0, s: 1, v: 1 })).toEqual({ r: 255, g: 0, b: 0 });
      expect(hsvToRgb({ h: 60, s: 1, v: 1 })).toEqual({ r: 255, g: 255, b: 0 });
      expect(hsvToRgb({ h: 120, s: 1, v: 1 })).toEqual({ r: 0, g: 255, b: 0 });
      expect(hsvToRgb({ h: 180, s: 1, v: 1 })).toEqual({ r: 0, g: 255, b: 255 });
      expect(hsvToRgb({ h: 240, s: 1, v: 1 })).toEqual({ r: 0, g: 0, b: 255 });
      expect(hsvToRgb({ h: 300, s: 1, v: 1 })).toEqual({ r: 255, g: 0, b: 255 });
    });

    it('wraps 360 degrees to 0 degrees Red', () => {
      expect(hsvToRgb({ h: 360, s: 1, v: 1 })).toEqual({ r: 255, g: 0, b: 0 });
    });
  });

  describe('rgbToHsv()', () => {
    it('converts pure black to zero value', () => {
      const hsv = rgbToHsv({ r: 0, g: 0, b: 0 });
      expect(hsv.v).toBe(0);
      expect(hsv.s).toBe(0);
    });

    it('converts pure white to full value and zero saturation', () => {
      const hsv = rgbToHsv({ r: 255, g: 255, b: 255 });
      expect(hsv.v).toBe(1);
      expect(hsv.s).toBe(0);
    });

    it('converts primary colors accurately', () => {
      expect(rgbToHsv({ r: 255, g: 0, b: 0 })).toEqual({ h: 0, s: 1, v: 1 });
      expect(rgbToHsv({ r: 0, g: 255, b: 0 })).toEqual({ h: 120, s: 1, v: 1 });
      expect(rgbToHsv({ r: 0, g: 0, b: 255 })).toEqual({ h: 240, s: 1, v: 1 });
    });

    it('preserves round-trip consistency with hsvToRgb', () => {
      const samples = [
        { h: 35, s: 0.8, v: 0.9 },
        { h: 145, s: 0.5, v: 0.7 },
        { h: 215, s: 0.65, v: 0.82 },
        { h: 310, s: 0.9, v: 0.4 },
      ];

      for (const sample of samples) {
        const rgb = hsvToRgb(sample);
        const resultHsv = rgbToHsv(rgb);
        expect(resultHsv.h).toBeCloseTo(sample.h, 0);
        expect(resultHsv.s).toBeCloseTo(sample.s, 1);
        expect(resultHsv.v).toBeCloseTo(sample.v, 1);
      }
    });
  });

  describe('relativeLuminance()', () => {
    it('computes 0 for black and 1 for white', () => {
      expect(relativeLuminance({ r: 0, g: 0, b: 0 })).toBe(0);
      expect(relativeLuminance({ r: 255, g: 255, b: 255 })).toBeCloseTo(1.0, 4);
    });

    it('satisfies standard ITU-R BT.709 weight rankings (Green > Red > Blue)', () => {
      const redLum = relativeLuminance({ r: 255, g: 0, b: 0 });
      const greenLum = relativeLuminance({ r: 0, g: 255, b: 0 });
      const blueLum = relativeLuminance({ r: 0, g: 0, b: 255 });

      expect(greenLum).toBeGreaterThan(redLum);
      expect(redLum).toBeGreaterThan(blueLum);
      expect(greenLum).toBeCloseTo(0.7152, 2);
      expect(redLum).toBeCloseTo(0.2126, 2);
      expect(blueLum).toBeCloseTo(0.0722, 2);
    });
  });

  describe('Hex conversion helpers', () => {
    it('converts RGB to hex and vice versa', () => {
      expect(rgbToHex({ r: 255, g: 0, b: 0 })).toBe('#ff0000');
      expect(rgbToHex({ r: 73, g: 140, b: 209 })).toBe('#498cd1');
      expect(hexToRgb('#ff0000')).toEqual({ r: 255, g: 0, b: 0 });
      expect(hexToRgb('#498cd1')).toEqual({ r: 73, g: 140, b: 209 });
    });

    it('handles shorthand hex formats', () => {
      expect(hexToRgb('#fff')).toEqual({ r: 255, g: 255, b: 255 });
      expect(hexToRgb('#f00')).toEqual({ r: 255, g: 0, b: 0 });
    });

    it('converts HSV directly to hex', () => {
      expect(hsvToHex({ h: 0, s: 1, v: 1 })).toBe('#ff0000');
      expect(hsvToHex({ h: 120, s: 1, v: 1 })).toBe('#00ff00');
    });
  });
});
