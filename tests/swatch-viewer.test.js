/**
 * @fileoverview Unit test suite for SwatchViewer component.
 * Validates dual swatches, split vs side-by-side modes, and grayscale tonal aid.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { SwatchViewer } from '../src/components/swatch-viewer.js';

describe('SwatchViewer Component', () => {
  let container;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  it('renders target and guess swatches with initial colors', () => {
    const viewer = new SwatchViewer(container, {
      target: { h: 0, s: 1, v: 1, hex: '#ff0000' },
      guess: { h: 120, s: 1, v: 1, hex: '#00ff00' },
      viewMode: 'split',
      isGrayscale: false,
    });

    const targetEl = container.querySelector('.swatch-target');
    const guessEl = container.querySelector('.swatch-guess');

    expect(targetEl).not.toBeNull();
    expect(guessEl).not.toBeNull();
    expect(viewer.getViewMode()).toBe('split');
  });

  it('switches between split and side-by-side layout classes', () => {
    const viewer = new SwatchViewer(container, {
      target: { h: 0, s: 1, v: 1, hex: '#ff0000' },
      guess: { h: 0, s: 1, v: 1, hex: '#ff0000' },
      viewMode: 'split',
    });

    const wrapper = container.querySelector('.swatch-viewer');
    expect(wrapper.classList.contains('mode-split')).toBe(true);

    viewer.setViewMode('side-by-side');
    expect(viewer.getViewMode()).toBe('side-by-side');
    expect(wrapper.classList.contains('mode-side-by-side')).toBe(true);
  });

  it('applies grayscale luminance transformation when tonal aid is toggled', () => {
    const viewer = new SwatchViewer(container, {
      target: { h: 0, s: 1, v: 1, hex: '#ff0000' },
      guess: { h: 240, s: 1, v: 1, hex: '#0000ff' },
      isGrayscale: false,
    });

    expect(viewer.isGrayscaleActive()).toBe(false);

    viewer.setGrayscale(true);
    expect(viewer.isGrayscaleActive()).toBe(true);

    const wrapper = container.querySelector('.swatch-viewer');
    expect(wrapper.classList.contains('tonal-grayscale')).toBe(true);
  });

  it('updates swatches dynamically via update() method', () => {
    const viewer = new SwatchViewer(container, {
      target: { h: 0, s: 1, v: 1, hex: '#ff0000' },
      guess: { h: 0, s: 1, v: 1, hex: '#ff0000' },
    });

    viewer.update({
      guess: { h: 60, s: 1, v: 1, hex: '#ffff00' },
    });

    const state = viewer.getState();
    expect(state.guess.h).toBe(60);
    expect(state.guess.hex).toBe('#ffff00');
  });
});
