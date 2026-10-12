/**
 * @fileoverview Unit test suite for SelectorView (Screen 1: Exercise Hub).
 * Validates rendering of exercise cards, coming soon slots, stats badge, and navigation callbacks.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SelectorView } from '../src/views/selector-view.js';

describe('SelectorView Component', () => {
  let container;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  it('renders app branding and exercise cards', () => {
    const view = new SelectorView(container, {
      onSelectExercise: vi.fn(),
      onOpenHistory: vi.fn(),
    });

    expect(container.querySelector('.exercise-hub-title')).not.toBeNull();
    const cards = container.querySelectorAll('.exercise-card');
    expect(cards.length).toBeGreaterThanOrEqual(3);

    // Active exercise
    const activeCard = container.querySelector('.exercise-card.active');
    expect(activeCard).not.toBeNull();
    expect(activeCard.textContent).toContain('Color Matching');

    // Locked exercise slots
    const lockedCards = container.querySelectorAll('.exercise-card.locked');
    expect(lockedCards.length).toBeGreaterThanOrEqual(2);
  });

  it('fires onSelectExercise when clicking an active exercise card', () => {
    const onSelectExercise = vi.fn();
    const view = new SelectorView(container, {
      onSelectExercise,
      onOpenHistory: vi.fn(),
    });

    const activeCard = container.querySelector('.exercise-card.active');
    activeCard.click();

    expect(onSelectExercise).toHaveBeenCalledWith('color-matching');
  });

  it('does not fire onSelectExercise when clicking a locked card', () => {
    const onSelectExercise = vi.fn();
    const view = new SelectorView(container, {
      onSelectExercise,
      onOpenHistory: vi.fn(),
    });

    const lockedCard = container.querySelector('.exercise-card.locked');
    lockedCard.click();

    expect(onSelectExercise).not.toHaveBeenCalled();
  });

  it('fires onOpenHistory when clicking History & Stats button', () => {
    const onOpenHistory = vi.fn();
    const view = new SelectorView(container, {
      onSelectExercise: vi.fn(),
      onOpenHistory,
    });

    const historyBtn = container.querySelector('#hub-history-btn');
    expect(historyBtn).not.toBeNull();
    historyBtn.click();

    expect(onOpenHistory).toHaveBeenCalled();
  });
});
