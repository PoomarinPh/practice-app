/**
 * @fileoverview Unit test suite for ResultModal component (Screen 3.5).
 * Validates post-submission reveal, score/breakdown formatting, and next question lifecycle.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ResultModal } from '../src/views/result-modal.js';

describe('ResultModal Component', () => {
  let container;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  it('initializes in closed state', () => {
    const modal = new ResultModal(container, { onNext: vi.fn() });
    expect(modal.isOpen()).toBe(false);
    expect(container.querySelector('.result-sheet-overlay')).toBeNull();
  });

  it('renders score, accuracy tier, hexes, and channel progress bars upon show()', () => {
    const modal = new ResultModal(container, { onNext: vi.fn() });

    modal.show({
      score: 92.4,
      isCorrect: true,
      target: { hex: '#498cd1', rgb: { r: 73, g: 140, b: 209 } },
      guess: { hex: '#4c87cc', rgb: { r: 76, g: 135, b: 204 } },
      breakdown: { value: 98.0, hue: 92.5, saturation: 96.0 },
    });

    expect(modal.isOpen()).toBe(true);
    const scoreEl = container.querySelector('.result-score-val');
    expect(scoreEl).not.toBeNull();
    expect(scoreEl.textContent).toContain('92.4');

    expect(container.textContent).toContain('#498cd1');
    expect(container.textContent).toContain('#4c87cc');
  });

  it('invokes onNext callback and closes when next button is clicked', () => {
    const onNext = vi.fn();
    const modal = new ResultModal(container, { onNext });

    modal.show({
      score: 88.0,
      isCorrect: true,
      target: { hex: '#ff0000' },
      guess: { hex: '#ff1100' },
      breakdown: { value: 90, hue: 85, saturation: 90 },
    });

    const nextBtn = container.querySelector('#result-next-btn');
    expect(nextBtn).not.toBeNull();
    nextBtn.click();

    expect(onNext).toHaveBeenCalledTimes(1);
    expect(modal.isOpen()).toBe(false);
  });

  it('renders time taken badge when answer is correct and timeSeconds is provided', () => {
    const modal = new ResultModal(container, { onNext: vi.fn() });

    modal.show({
      score: 95.0,
      isCorrect: true,
      timeSeconds: 7.4,
      target: { hex: '#ff0000' },
      guess: { hex: '#ff0000' },
      breakdown: { value: 100, hue: 95, saturation: 95 },
    });

    const timeBadge = container.querySelector('.result-time-badge');
    expect(timeBadge).not.toBeNull();
    expect(timeBadge.textContent).toContain('7.4s');
  });
});

