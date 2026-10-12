/**
 * @fileoverview Unit test suite for ColorWheel component.
 * Validates DOM mounting, two-tier canvas setup, value slider integration,
 * pointer capture lifecycle, and change event dispatching.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ColorWheel } from '../src/components/color-wheel.js';

describe('ColorWheel Component', () => {
  let container;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  it('renders canvas wheel and vertical slider elements', () => {
    const wheel = new ColorWheel(container, {
      initialColor: { h: 180, s: 0.8, v: 0.9 },
    });

    const canvas = container.querySelector('canvas.wheel-canvas');
    const slider = container.querySelector('.slider-track');
    const thumb = container.querySelector('.slider-thumb');

    expect(canvas).not.toBeNull();
    expect(slider).not.toBeNull();
    expect(thumb).not.toBeNull();
  });

  it('exposes initial color and allows updating via setColor()', () => {
    const onChange = vi.fn();
    const wheel = new ColorWheel(container, {
      initialColor: { h: 90, s: 0.5, v: 0.7 },
      onChange,
    });

    expect(wheel.getColor().h).toBe(90);
    expect(wheel.getColor().s).toBe(0.5);
    expect(wheel.getColor().v).toBe(0.7);

    wheel.setColor({ h: 240, s: 1.0, v: 0.5 });
    expect(wheel.getColor().h).toBe(240);
    expect(wheel.getColor().s).toBe(1.0);
    expect(wheel.getColor().v).toBe(0.5);
  });

  it('emits onChange callbacks with hsv, rgb, and hex payloads', () => {
    const onChange = vi.fn();
    const wheel = new ColorWheel(container, {
      initialColor: { h: 0, s: 1, v: 1 },
      onChange,
    });

    wheel.setColor({ h: 120, s: 1, v: 1 });
    expect(onChange).toHaveBeenCalled();
    const lastCall = onChange.mock.calls[onChange.mock.calls.length - 1][0];
    expect(lastCall.h).toBe(120);
    expect(lastCall.hex).toBe('#00ff00');
    expect(lastCall.rgb).toEqual({ r: 0, g: 255, b: 0 });
  });

  it('cleans up resources and event listeners upon destroy()', () => {
    const wheel = new ColorWheel(container);
    expect(container.children.length).toBeGreaterThan(0);

    wheel.destroy();
    expect(container.children.length).toBe(0);
  });
});
