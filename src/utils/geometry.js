/**
 * @fileoverview Polar <-> Cartesian coordinate mappings and slider geometry.
 * Aligns wheel angles to reference orientation (6 o'clock = 0 deg Red).
 * Implements deadzone preservation and boundary clamping.
 * Strictly adheres to Google JavaScript Style Guide and DESIGN.md.
 */

/**
 * @typedef {Object} Point
 * @property {number} x - Horizontal coordinate in pixels.
 * @property {number} y - Vertical coordinate in pixels.
 */

/**
 * @typedef {Object} HueSaturation
 * @property {number} h - Hue in degrees [0, 360).
 * @property {number} s - Saturation normalized [0, 1].
 */

/**
 * Maps a 2D screen coordinate point relative to the wheel center into (Hue, Saturation).
 * @param {Point} point - Screen coordinates of touch or cursor.
 * @param {Point} center - Coordinates of wheel center.
 * @param {number} radius - Active radius of the color wheel.
 * @param {number} [previousHue=0] - Hue to retain if point falls into center deadzone.
 * @returns {HueSaturation} Normalized Hue and Saturation.
 */
export function wheelPointToHs(point, center, radius, previousHue = 0) {
  const deltaX = point.x - center.x;
  const deltaY = point.y - center.y;
  const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

  // Center deadzone handling (< 2px): preserve previous hue
  if (distance < 2) {
    const sDeadzone = Math.max(0, Math.min(1, distance / radius));
    return {
      h: previousHue,
      s: Math.round(sDeadzone * 1000) / 1000,
    };
  }

  // Radial distance to saturation (clamped to 1.0 outside bounds)
  const saturation = Math.min(1.0, distance / radius);

  // Raw angle from atan2 in [-180, 180]
  const thetaRaw = (Math.atan2(deltaY, deltaX) * 180) / Math.PI;
  const thetaScreen = (thetaRaw + 360) % 360;

  // Wheel orientation alignment: 6 o'clock (90 deg screen) = 0 deg Red
  const hue = (thetaScreen - 90 + 360) % 360;

  return {
    h: Math.round(hue * 10) / 10,
    s: Math.round(saturation * 1000) / 1000,
  };
}

/**
 * Inversely projects (Hue, Saturation) coordinates back to screen pixel coordinates.
 * @param {HueSaturation} hs - Hue [0, 360) and Saturation [0, 1].
 * @param {Point} center - Coordinates of wheel center.
 * @param {number} radius - Active radius of the color wheel.
 * @returns {Point} Projected pixel point on the wheel canvas.
 */
export function hsvToWheelPoint({ h, s }, center, radius) {
  const clampedS = Math.max(0, Math.min(1, s));
  const thetaScreen = (h + 90) % 360;
  const thetaRad = (thetaScreen * Math.PI) / 180;

  const x = center.x + (clampedS * radius) * Math.cos(thetaRad);
  const y = center.y + (clampedS * radius) * Math.sin(thetaRad);

  return {
    x: Math.round(x * 10) / 10,
    y: Math.round(y * 10) / 10,
  };
}

/**
 * Maps a vertical slider coordinate Y into a normalized Value [0.0, 1.0].
 * Top of slider = 1.0 (Full Value), bottom = 0.0 (Zero Value).
 * @param {number} y - Current vertical touch coordinate in pixels.
 * @param {number} trackTop - Top coordinate of the slider track.
 * @param {number} trackHeight - Total height of the slider track.
 * @returns {number} Value normalized in range [0, 1].
 */
export function sliderYToValue(y, trackTop, trackHeight) {
  if (trackHeight <= 0) {
    return 1.0;
  }
  const ratio = (y - trackTop) / trackHeight;
  const clampedRatio = Math.max(0, Math.min(1, ratio));
  const value = 1.0 - clampedRatio;
  return Math.round(value * 1000) / 1000;
}

/**
 * Maps a normalized Value [0.0, 1.0] back to a slider thumb Y coordinate.
 * @param {number} value - Normalized value [0, 1].
 * @param {number} trackTop - Top coordinate of the slider track.
 * @param {number} trackHeight - Total height of the slider track.
 * @returns {number} Vertical pixel position of thumb center.
 */
export function valueToSliderY(value, trackTop, trackHeight) {
  const clampedValue = Math.max(0, Math.min(1, value));
  const y = trackTop + (1.0 - clampedValue) * trackHeight;
  return Math.round(y * 10) / 10;
}
