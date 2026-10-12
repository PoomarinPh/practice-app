/**
 * @fileoverview Environment and test setup verification test.
 * Ensures Vitest executes properly with happy-dom globals available.
 */

import { describe, expect, it } from 'vitest';

describe('Test Environment Setup', () => {
  it('should have window and document defined by happy-dom', () => {
    expect(typeof window).toBe('object');
    expect(typeof document).toBe('object');
  });

  it('should support localStorage operations in happy-dom', () => {
    localStorage.setItem('chromasense_test', 'ok');
    expect(localStorage.getItem('chromasense_test')).toBe('ok');
    localStorage.removeItem('chromasense_test');
    expect(localStorage.getItem('chromasense_test')).toBeNull();
  });
});
