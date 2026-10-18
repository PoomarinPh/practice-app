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

  it('renders Reference swatch on top and Your Match swatch on bottom', () => {
    const viewer = new SwatchViewer(container, {
      target: { h: 0, s: 1, v: 1, hex: '#ff0000' },
      guess: { h: 120, s: 1, v: 1, hex: '#00ff00' },
    });

    const wrapper = container.querySelector('.swatch-viewer');
    const cards = wrapper.querySelectorAll('.swatch-card');
    expect(cards.length).toBe(2);

    // Top card is reference
    expect(cards[0].classList.contains('swatch-target')).toBe(true);
    expect(cards[0].textContent).toContain('Reference');

    // Bottom card is user's match
    expect(cards[1].classList.contains('swatch-guess')).toBe(true);
    expect(cards[1].textContent).toContain('Your Match');
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

  it('renders separated Reference and Guess swatches in distinct DOM containers (top and bottom of screen)', () => {
    const topContainer = document.createElement('div');
    const bottomContainer = document.createElement('div');
    document.body.appendChild(topContainer);
    document.body.appendChild(bottomContainer);

    const viewer = new SwatchViewer(null, {
      targetContainer: topContainer,
      guessContainer: bottomContainer,
      target: { h: 200, s: 0.8, v: 0.9, hex: '#2eb8e6' },
      guess: { h: 100, s: 0.5, v: 0.7, hex: '#77b359' },
    });

    // Top container holds Reference swatch
    const topTargetEl = topContainer.querySelector('.swatch-target');
    const topGuessEl = topContainer.querySelector('.swatch-guess');
    expect(topTargetEl).not.toBeNull();
    expect(topGuessEl).toBeNull();
    expect(topTargetEl.textContent).toContain('Reference');

    // Bottom container holds Guess swatch
    const bottomTargetEl = bottomContainer.querySelector('.swatch-target');
    const bottomGuessEl = bottomContainer.querySelector('.swatch-guess');
    expect(bottomTargetEl).toBeNull();
    expect(bottomGuessEl).not.toBeNull();
    expect(bottomGuessEl.textContent).toContain('Your Match');

    // Update bottom guess without altering top target
    viewer.update({
      guess: { h: 300, s: 0.9, v: 0.8, hex: '#cc14cc' },
    });
    expect(viewer.getState().guess.hex).toBe('#cc14cc');
    expect(viewer.getState().target.hex).toBe('#2eb8e6');

    // Tonal grayscale affects both distinct containers
    viewer.setGrayscale(true);
    expect(topContainer.querySelector('.tonal-grayscale')).not.toBeNull();
    expect(bottomContainer.querySelector('.tonal-grayscale')).not.toBeNull();
  });
});

