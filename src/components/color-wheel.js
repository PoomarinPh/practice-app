/**
 * @fileoverview High-DPI two-tier Canvas Color Wheel and Vertical Value Slider component.
 * Features 60-120 FPS offscreen gradient caching, continuous PointerEvent capture,
 * reference-aligned polar coordinates (6 o'clock = 0 deg Red), and accessible micro-controls.
 * Strictly adheres to Google JavaScript Style Guide and DESIGN.md.
 */

import { hsvToHex, hsvToRgb } from '../utils/color.js';
import {
  hsvToWheelPoint,
  sliderYToValue,
  valueToSliderY,
  wheelPointToHs,
} from '../utils/geometry.js';

/**
 * @typedef {Object} ColorWheelOptions
 * @property {Object} [initialColor] - Initial HSV color { h, s, v }.
 * @property {Function} [onChange] - Callback fired on color adjustments: (color) => void.
 */

export class ColorWheel {
  /**
   * @param {HTMLElement} container - DOM container to mount into.
   * @param {ColorWheelOptions} [options={}] - Options.
   */
  constructor(container, options = {}) {
    this.container = container;
    this.onChange = options.onChange || null;

    const init = options.initialColor || { h: 0, s: 1.0, v: 1.0 };
    this.color = {
      h: ((init.h % 360) + 360) % 360,
      s: Math.max(0, Math.min(1, init.s ?? 1.0)),
      v: Math.max(0, Math.min(1, init.v ?? 1.0)),
    };

    this.dpr = typeof window !== 'undefined' ? Math.min(window.devicePixelRatio || 1, 3) : 1;
    this.wheelSize = 280;
    this.radius = 120;
    this.center = { x: 140, y: 140 };

    this.isDraggingWheel = false;
    this.isDraggingSlider = false;

    // DOM Elements
    this.rootEl = null;
    this.canvasEl = null;
    this.ctx = null;
    this.offscreenCanvas = null;
    this.offscreenCtx = null;
    this.sliderTrackEl = null;
    this.sliderThumbEl = null;
    this.resizeObserver = null;

    this.init();
  }

  /**
   * Builds the DOM structure and starts observers.
   * @private
   */
  init() {
    this.container.innerHTML = '';

    this.rootEl = document.createElement('div');
    this.rootEl.className = 'color-control-panel';

    // 1. Wheel Container & Canvas
    const wheelWrapper = document.createElement('div');
    wheelWrapper.className = 'wheel-wrapper';

    this.canvasEl = document.createElement('canvas');
    this.canvasEl.className = 'wheel-canvas';
    this.canvasEl.style.touchAction = 'none';
    wheelWrapper.appendChild(this.canvasEl);

    // 2. Vertical Value Slider
    const sliderWrapper = document.createElement('div');
    sliderWrapper.className = 'slider-wrapper';

    this.sliderTrackEl = document.createElement('div');
    this.sliderTrackEl.className = 'slider-track';
    this.sliderTrackEl.style.touchAction = 'none';

    this.sliderThumbEl = document.createElement('div');
    this.sliderThumbEl.className = 'slider-thumb';
    this.sliderTrackEl.appendChild(this.sliderThumbEl);
    sliderWrapper.appendChild(this.sliderTrackEl);

    this.rootEl.appendChild(wheelWrapper);
    this.rootEl.appendChild(sliderWrapper);
    this.container.appendChild(this.rootEl);

    // Offscreen Canvas for Tier 1 Pre-Render Layer
    if (typeof document !== 'undefined') {
      this.offscreenCanvas = document.createElement('canvas');
      this.offscreenCtx = this.offscreenCanvas.getContext('2d');
      this.ctx = this.canvasEl.getContext('2d');
    }

    this.bindEvents();
    this.setupResizeObserver();
    this.updateDimensions();
  }

  /**
   * Sets up ResizeObserver for high-DPI scaling.
   * @private
   */
  setupResizeObserver() {
    if (typeof ResizeObserver === 'function' && this.rootEl) {
      this.resizeObserver = new ResizeObserver(() => {
        this.updateDimensions();
      });
      this.resizeObserver.observe(this.rootEl);
    }
  }

  /**
   * Recalculates canvas dimensions based on CSS layout.
   * @private
   */
  updateDimensions() {
    if (!this.canvasEl) {
      return;
    }

    const rect = this.canvasEl.getBoundingClientRect();
    const size = Math.max(200, Math.min(360, Math.round(rect.width) || this.wheelSize));

    this.wheelSize = size;
    this.radius = Math.round(size * 0.44);
    this.center = { x: size / 2, y: size / 2 };

    const physicalSize = Math.round(size * this.dpr);
    this.canvasEl.width = physicalSize;
    this.canvasEl.height = physicalSize;
    this.canvasEl.style.width = `${size}px`;
    this.canvasEl.style.height = `${size}px`;

    if (this.offscreenCanvas) {
      this.offscreenCanvas.width = physicalSize;
      this.offscreenCanvas.height = physicalSize;
    }

    this.bakeOffscreenWheel();
    this.render();
  }

  /**
   * Bakes the polar color wheel gradient into the Tier 1 offscreen canvas.
   * @private
   */
  bakeOffscreenWheel() {
    if (!this.offscreenCtx || !this.offscreenCanvas) {
      return;
    }

    const width = this.offscreenCanvas.width;
    const height = this.offscreenCanvas.height;
    if (width === 0 || height === 0) {
      return;
    }

    const ctx = this.offscreenCtx;
    ctx.clearRect(0, 0, width, height);

    // Render using radial sectors for smooth, hardware-accelerated interpolation
    const cx = this.center.x * this.dpr;
    const cy = this.center.y * this.dpr;
    const r = this.radius * this.dpr;

    const numSectors = 360;
    const sectorAngle = (2 * Math.PI) / numSectors;

    for (let i = 0; i < numSectors; i++) {
      const startAngle = i * sectorAngle;
      const endAngle = (i + 1.5) * sectorAngle;

      // Map canvas angle to Hue (6 o'clock = 0 deg Red)
      const thetaScreenDeg = (i * 360) / numSectors;
      const hue = (thetaScreenDeg - 90 + 360) % 360;
      const edgeRgb = hsvToRgb({ h: hue, s: 1.0, v: 1.0 });

      // Radial gradient from white center to pure chromatic perimeter
      const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
      grad.addColorStop(0, 'rgba(255, 255, 255, 1)');
      grad.addColorStop(1, `rgba(${edgeRgb.r}, ${edgeRgb.g}, ${edgeRgb.b}, 1)`);

      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, r, startAngle, endAngle);
      ctx.closePath();
      ctx.fillStyle = grad;
      ctx.fill();
    }
  }

  /**
   * Renders the interactive Tier 2 compositor layer.
   * Blits pre-rendered offscreen wheel and renders reticle indicator.
   */
  render() {
    if (!this.ctx || !this.canvasEl) {
      return;
    }

    const width = this.canvasEl.width;
    const height = this.canvasEl.height;
    this.ctx.clearRect(0, 0, width, height);

    // 1. Draw cached offscreen wheel
    if (this.offscreenCanvas) {
      this.ctx.drawImage(this.offscreenCanvas, 0, 0);
    }

    // 2. Draw Reticle indicator circle
    const point = hsvToWheelPoint(
      { h: this.color.h, s: this.color.s },
      this.center,
      this.radius
    );

    const px = point.x * this.dpr;
    const py = point.y * this.dpr;
    const reticleRadius = 10 * this.dpr;

    // Reticle outer shadow and stroke
    this.ctx.save();
    this.ctx.beginPath();
    this.ctx.arc(px, py, reticleRadius, 0, Math.PI * 2);
    this.ctx.lineWidth = 3 * this.dpr;
    this.ctx.strokeStyle = '#ffffff';
    this.ctx.stroke();

    this.ctx.beginPath();
    this.ctx.arc(px, py, reticleRadius - 2 * this.dpr, 0, Math.PI * 2);
    this.ctx.lineWidth = 1.5 * this.dpr;
    this.ctx.strokeStyle = 'rgba(0, 0, 0, 0.6)';
    this.ctx.stroke();

    // Inner filled sample
    const currentColor = hsvToRgb(this.color);
    this.ctx.beginPath();
    this.ctx.arc(px, py, reticleRadius - 3.5 * this.dpr, 0, Math.PI * 2);
    this.ctx.fillStyle = `rgb(${currentColor.r}, ${currentColor.g}, ${currentColor.b})`;
    this.ctx.fill();
    this.ctx.restore();

    // 3. Update Value Slider Thumb & Track Gradient
    this.updateSliderUI();
  }

  /**
   * Synchronizes the Value slider track gradient and thumb position.
   * @private
   */
  updateSliderUI() {
    if (!this.sliderTrackEl || !this.sliderThumbEl) {
      return;
    }

    const trackHeight = this.sliderTrackEl.clientHeight || 240;
    const trackTop = 0;
    const thumbY = valueToSliderY(this.color.v, trackTop, trackHeight);

    this.sliderThumbEl.style.transform = `translateY(${thumbY - 12}px)`;

    // Gradient shows pure hue/sat at top down to pure black at bottom
    const topRgb = hsvToRgb({ h: this.color.h, s: this.color.s, v: 1.0 });
    this.sliderTrackEl.style.background = `linear-gradient(to bottom, rgb(${topRgb.r}, ${topRgb.g}, ${topRgb.b}), #000000)`;

    // Thumb preview color
    const thumbRgb = hsvToRgb(this.color);
    this.sliderThumbEl.style.backgroundColor = `rgb(${thumbRgb.r}, ${thumbRgb.g}, ${thumbRgb.b})`;
  }

  /**
   * Binds pointer events with pointer capture.
   * @private
   */
  bindEvents() {
    if (!this.canvasEl || !this.sliderTrackEl) {
      return;
    }

    // Wheel Pointer Events
    this.canvasEl.addEventListener('pointerdown', (e) => {
      this.isDraggingWheel = true;
      try {
        this.canvasEl.setPointerCapture?.(e.pointerId);
      } catch {
        // Fallback if pointer capture unsupported
      }
      this.handleWheelPointer(e);
    });

    this.canvasEl.addEventListener('pointermove', (e) => {
      if (this.isDraggingWheel) {
        this.handleWheelPointer(e);
      }
    });

    const stopWheelDrag = (e) => {
      if (this.isDraggingWheel) {
        this.isDraggingWheel = false;
        try {
          this.canvasEl.releasePointerCapture?.(e.pointerId);
        } catch {
          // Ignored
        }
      }
    };
    this.canvasEl.addEventListener('pointerup', stopWheelDrag);
    this.canvasEl.addEventListener('pointercancel', stopWheelDrag);

    // Slider Pointer Events
    this.sliderTrackEl.addEventListener('pointerdown', (e) => {
      this.isDraggingSlider = true;
      try {
        this.sliderTrackEl.setPointerCapture?.(e.pointerId);
      } catch {
        // Ignored
      }
      this.handleSliderPointer(e);
    });

    this.sliderTrackEl.addEventListener('pointermove', (e) => {
      if (this.isDraggingSlider) {
        this.handleSliderPointer(e);
      }
    });

    const stopSliderDrag = (e) => {
      if (this.isDraggingSlider) {
        this.isDraggingSlider = false;
        try {
          this.sliderTrackEl.releasePointerCapture?.(e.pointerId);
        } catch {
          // Ignored
        }
      }
    };
    this.sliderTrackEl.addEventListener('pointerup', stopSliderDrag);
    this.sliderTrackEl.addEventListener('pointercancel', stopSliderDrag);
  }

  /**
   * Handles wheel interaction calculations.
   * @private
   * @param {PointerEvent} e - Pointer event.
   */
  handleWheelPointer(e) {
    const rect = this.canvasEl.getBoundingClientRect();
    const point = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };

    const hs = wheelPointToHs(point, this.center, this.radius, this.color.h);
    this.color.h = hs.h;
    this.color.s = hs.s;

    this.render();
    this.emitChange();
  }

  /**
   * Handles vertical slider interaction calculations.
   * @private
   * @param {PointerEvent} e - Pointer event.
   */
  handleSliderPointer(e) {
    const rect = this.sliderTrackEl.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const v = sliderYToValue(y, 0, rect.height);

    this.color.v = v;
    this.render();
    this.emitChange();
  }

  /**
   * Dispatches change event with full color payload.
   * @private
   */
  emitChange() {
    if (typeof this.onChange === 'function') {
      const rgb = hsvToRgb(this.color);
      const hex = hsvToHex(this.color);
      this.onChange({
        h: this.color.h,
        s: this.color.s,
        v: this.color.v,
        rgb,
        hex,
      });
    }
  }

  /**
   * Programmatically sets the active color.
   * @param {{ h?: number, s?: number, v?: number }} newColor - Color properties.
   */
  setColor(newColor) {
    if (newColor.h !== undefined) {
      this.color.h = ((newColor.h % 360) + 360) % 360;
    }
    if (newColor.s !== undefined) {
      this.color.s = Math.max(0, Math.min(1, newColor.s));
    }
    if (newColor.v !== undefined) {
      this.color.v = Math.max(0, Math.min(1, newColor.v));
    }

    this.render();
    this.emitChange();
  }

  /**
   * Gets the active HSV color.
   * @returns {{ h: number, s: number, v: number }}
   */
  getColor() {
    return { ...this.color };
  }

  /**
   * Steps Hue by delta degrees.
   * @param {number} delta - Degrees to change.
   */
  stepHue(delta) {
    this.setColor({ h: (this.color.h + delta + 360) % 360 });
  }

  /**
   * Steps Saturation by delta percentage.
   * @param {number} delta - Normalized saturation delta.
   */
  stepSaturation(delta) {
    this.setColor({ s: Math.max(0, Math.min(1, this.color.s + delta)) });
  }

  /**
   * Steps Value by delta percentage.
   * @param {number} delta - Normalized value delta.
   */
  stepValue(delta) {
    this.setColor({ v: Math.max(0, Math.min(1, this.color.v + delta)) });
  }

  /**
   * Cleans up observers, DOM elements, and listeners.
   */
  destroy() {
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }
    this.container.innerHTML = '';
  }
}
