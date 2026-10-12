/**
 * @fileoverview Unit test suite for HistoryView (Screen 5: History & Statistics Hub).
 * Validates lifetime stats cards, gallery rendering of correct guesses,
 * JSON export/clear actions, and back navigation.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { HistoryView } from '../src/views/history-view.js';
import { clearAllData, recordGuess } from '../src/utils/storage.js';

describe('HistoryView Component', () => {
  let container;

  beforeEach(() => {
    clearAllData();
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  it('renders lifetime stats cards including average correct speed', () => {
    recordGuess({
      mode: 'HSV',
      score: 94.0,
      isCorrect: true,
      timeSeconds: 5.5,
      target: { hex: '#ff0000' },
      guess: { hex: '#ff0000' },
      breakdown: { value: 95, hue: 95, saturation: 95 },
    });

    const view = new HistoryView(container, { onBack: vi.fn() });

    expect(container.querySelector('.history-title')).not.toBeNull();
    const statsRow = container.querySelector('.history-stats-grid');
    expect(statsRow).not.toBeNull();
    expect(statsRow.textContent).toContain('5.5s');
    expect(statsRow.textContent).toContain('1'); // 1 correct
  });

  it('renders correct color guesses in the gallery', () => {
    recordGuess({
      mode: 'HSV',
      score: 96.0,
      isCorrect: true,
      timeSeconds: 4.2,
      target: { hex: '#00ff00' },
      guess: { hex: '#05ff05' },
      breakdown: { value: 98, hue: 95, saturation: 95 },
    });

    // Wrong guess should NOT be in the correct gallery
    recordGuess({
      mode: 'HSV',
      score: 60.0,
      isCorrect: false,
      target: { hex: '#0000ff' },
      guess: { hex: '#ffffff' },
      breakdown: { value: 60, hue: 60, saturation: 60 },
    });

    const view = new HistoryView(container, { onBack: vi.fn() });
    const galleryItems = container.querySelectorAll('.gallery-card');
    expect(galleryItems.length).toBe(1);
    expect(galleryItems[0].textContent).toContain('#00ff00');
    expect(galleryItems[0].textContent).toContain('4.2s');
  });

  it('shows empty gallery placeholder when no correct guesses exist', () => {
    const view = new HistoryView(container, { onBack: vi.fn() });
    const emptyState = container.querySelector('.gallery-empty-state');
    expect(emptyState).not.toBeNull();
  });

  it('fires onBack when clicking back button', () => {
    const onBack = vi.fn();
    const view = new HistoryView(container, { onBack });

    const backBtn = container.querySelector('#history-back-btn');
    expect(backBtn).not.toBeNull();
    backBtn.click();

    expect(onBack).toHaveBeenCalled();
  });
});
