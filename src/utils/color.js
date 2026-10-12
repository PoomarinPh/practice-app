/**
 * @fileoverview Color math, conversion, and relative luminance algorithms.
 * Implements HSV <-> RGB conversions, hex formatting, and perceptual relative luminance.
 * Strictly adheres to Google JavaScript Style Guide and DESIGN.md.
 */

/**
 * @typedef {Object} HSVColor
 * @property {number} h - Hue in degrees [0, 360).
 * @property {number} s - Saturation normalized [0, 1].
 * @property {number} v - Value normalized [0, 1].
 */

/**
 * @typedef {Object} RGBColor
 * @property {number} r - Red channel [0, 255].
 * @property {number} g - Green channel [0, 255].
 * @property {number} b - Blue channel [0, 255].
 */

/**
 * Converts HSV color values to RGB color values.
 * @param {HSVColor} hsv - The HSV color representation.
 * @returns {RGBColor} The equivalent RGB representation [0, 255].
 */
export function hsvToRgb({ h, s, v }) {
  const normalizedH = ((h % 360) + 360) % 360;
  const clampedS = Math.max(0, Math.min(1, s));
  const clampedV = Math.max(0, Math.min(1, v));

  const c = clampedV * clampedS;
  const x = c * (1 - Math.abs(((normalizedH / 60) % 2) - 1));
  const m = clampedV - c;

  let rPrime = 0;
  let gPrime = 0;
  let bPrime = 0;

  const sector = Math.floor(normalizedH / 60);

  switch (sector) {
    case 0:
      rPrime = c;
      gPrime = x;
      bPrime = 0;
      break;
    case 1:
      rPrime = x;
      gPrime = c;
      bPrime = 0;
      break;
    case 2:
      rPrime = 0;
      gPrime = c;
      bPrime = x;
      break;
    case 3:
      rPrime = 0;
      gPrime = x;
      bPrime = c;
      break;
    case 4:
      rPrime = x;
      gPrime = 0;
      bPrime = c;
      break;
    case 5:
    default:
      rPrime = c;
      gPrime = 0;
      bPrime = x;
      break;
  }

  return {
    r: Math.round((rPrime + m) * 255),
    g: Math.round((gPrime + m) * 255),
    b: Math.round((bPrime + m) * 255),
  };
}

/**
 * Converts RGB color values [0, 255] to HSV color values.
 * @param {RGBColor} rgb - The RGB color representation.
 * @returns {HSVColor} The equivalent HSV representation.
 */
export function rgbToHsv({ r, g, b }) {
  const rNorm = Math.max(0, Math.min(255, r)) / 255;
  const gNorm = Math.max(0, Math.min(255, g)) / 255;
  const bNorm = Math.max(0, Math.min(255, b)) / 255;

  const max = Math.max(rNorm, gNorm, bNorm);
  const min = Math.min(rNorm, gNorm, bNorm);
  const delta = max - min;

  let h = 0;
  if (delta !== 0) {
    if (max === rNorm) {
      h = 60 * (((gNorm - bNorm) / delta) % 6);
    } else if (max === gNorm) {
      h = 60 * ((bNorm - rNorm) / delta + 2);
    } else {
      h = 60 * ((rNorm - gNorm) / delta + 4);
    }
  }

  const normalizedH = ((h % 360) + 360) % 360;
  const s = max === 0 ? 0 : delta / max;
  const v = max;

  return {
    h: Math.round(normalizedH * 10) / 10,
    s: Math.round(s * 1000) / 1000,
    v: Math.round(v * 1000) / 1000,
  };
}

/**
 * Computes standard ITU-R BT.709 relative luminance from an RGB color.
 * Used for value/tonal analysis and grayscale contrast matching.
 * @param {RGBColor} rgb - The RGB color object [0, 255].
 * @returns {number} Relative luminance Y in range [0, 1].
 */
export function relativeLuminance({ r, g, b }) {
  const toLinear = (c) => {
    const norm = c / 255;
    return norm <= 0.04045 ? norm / 12.92 : Math.pow((norm + 0.055) / 1.055, 2.4);
  };

  const rLin = toLinear(r);
  const gLin = toLinear(g);
  const bLin = toLinear(b);

  return 0.2126 * rLin + 0.7152 * gLin + 0.0722 * bLin;
}

/**
 * Converts RGB values to a lowercase hexadecimal string (e.g., '#ff0000').
 * @param {RGBColor} rgb - The RGB color.
 * @returns {string} Hex color string starting with '#'.
 */
export function rgbToHex({ r, g, b }) {
  const toHex = (n) => {
    const clamped = Math.max(0, Math.min(255, Math.round(n)));
    return clamped.toString(16).padStart(2, '0');
  };
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/**
 * Parses a hex color string ('#rgb' or '#rrggbb') into an RGBColor object.
 * @param {string} hex - The hex color string.
 * @returns {RGBColor} The parsed RGB values.
 */
export function hexToRgb(hex) {
  let cleanHex = hex.trim().replace(/^#/, '');

  if (cleanHex.length === 3) {
    cleanHex = cleanHex
      .split('')
      .map((c) => c + c)
      .join('');
  }

  if (cleanHex.length !== 6) {
    return { r: 0, g: 0, b: 0 };
  }

  const num = parseInt(cleanHex, 16);
  if (isNaN(num)) {
    return { r: 0, g: 0, b: 0 };
  }

  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255,
  };
}

/**
 * Converts HSV values directly to a lowercase hexadecimal color string.
 * @param {HSVColor} hsv - The HSV color.
 * @returns {string} Hex color string.
 */
export function hsvToHex(hsv) {
  return rgbToHex(hsvToRgb(hsv));
}

/**
 * Converts a hex color string directly to HSV values.
 * @param {string} hex - The hex string.
 * @returns {HSVColor} The parsed HSV color.
 */
export function hexToHsv(hex) {
  return rgbToHsv(hexToRgb(hex));
}
