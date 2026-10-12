/**
 * @fileoverview Unit test suite for ConfigView (Screen 2: Configuration Landing).
 * Validates question count chips, mode stats cards, average correct speed display,
 * live preview mount, and start round navigation.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ConfigView } from '../src/views/config-view.js';
import { recordGuess, clearAllData } from '../src/utils/storage.js';

describe('ConfigView Component', () => {
  let container;

  beforeEach(() => {
    clearAllData();
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  it('renders question count selector chips and defaults to 5', () => {
    const view = new ConfigView(container, {
      exerciseId: 'color-matching',
      onBack: vi.fn(),
      onStart: vi.fn(),
    });

    const chips = container.querySelectorAll('.question-chip');
    expect(chips.length).toBe(5);

    const activeChip = container.querySelector('.question-chip.active');
    expect(activeChip).not.toBeNull();
    expect(activeChip.textContent.trim()).toBe('5');
    expect(view.getSelectedCount()).toBe(5);
  });

  it('updates selected question count when a chip is clicked', () => {
    const view = new ConfigView(container, {
      exerciseId: 'color-matching',
      onBack: vi.fn(),
      onStart: vi.fn(),
    });

    const chip10 = Array.from(container.querySelectorAll('.question-chip')).find(
      (c) => c.textContent.trim() === '10'
    );
    expect(chip10).toBeDefined();
    chip10.click();

    expect(view.getSelectedCount()).toBe(10);
    expect(chip10.classList.contains('active')).toBe(true);
  });

  it('displays All-Time accuracy and average correct time from storage', () => {
    // Record a correct attempt with time
    recordGuess({
      mode: 'HSV',
      score: 92.0,
      isCorrect: true,
      timeSeconds: 6.8,
      breakdown: { value: 95, hue: 90, saturation: 90 },
    });

    const view = new ConfigView(container, {
      exerciseId: 'color-matching',
    });

    const statsCard = container.querySelector('.mode-performance-card');
    expect(statsCard).not.toBeNull();
    expect(statsCard.textContent).toContain('100%');
    expect(statsCard.textContent).toContain('6.8s');
  });

  it('fires onStart callback with chosen configuration', () => {
    const onStart = vi.fn();
    const view = new ConfigView(container, {
      exerciseId: 'color-matching',
      onStart,
    });

    const startBtn = container.querySelector('#start-exercise-btn');
    expect(startBtn).not.toBeNull();
    startBtn.click();

    expect(onStart).toHaveBeenCalledWith({
      exerciseId: 'color-matching',
      mode: 'HSV',
      questionCount: 5,
    });
  });

  it('fires onBack callback when clicking back breadcrumb', () => {
    const onBack = vi.fn();
    const view = new ConfigView(container, {
      exerciseId: 'color-matching',
      onBack,
    });

    const backBtn = container.querySelector('#config-back-btn');
    expect(backBtn).not.toBeNull();
    backBtn.click();

    expect(onBack).toHaveBeenCalled();
  });
});
