/**
 * @fileoverview Unit test suite for AppRouter.
 * Validates route state transitions, param passing, history stack, and navigation callbacks.
 */

import { describe, expect, it, vi } from 'vitest';
import { AppRouter } from '../src/utils/router.js';

describe('AppRouter Unit Test Suite', () => {
  it('initializes with default route "hub" and empty params', () => {
    const router = new AppRouter();
    expect(router.getCurrentRoute()).toBe('hub');
    expect(router.getCurrentParams()).toEqual({});
  });

  it('allows custom initial route and params', () => {
    const router = new AppRouter({
      initialRoute: 'config',
      initialParams: { exerciseId: 'color-matching' },
    });
    expect(router.getCurrentRoute()).toBe('config');
    expect(router.getCurrentParams()).toEqual({ exerciseId: 'color-matching' });
  });

  it('navigates to a new route and updates state', () => {
    const router = new AppRouter();
    router.navigate('config', { exerciseId: 'color-matching' });

    expect(router.getCurrentRoute()).toBe('config');
    expect(router.getCurrentParams()).toEqual({ exerciseId: 'color-matching' });
  });

  it('invokes onRouteChange listener on navigation', () => {
    const onRouteChange = vi.fn();
    const router = new AppRouter({ onRouteChange });

    router.navigate('history');
    expect(onRouteChange).toHaveBeenCalledWith('history', {});

    router.navigate('game', { mode: 'HSV', questionCount: 10 });
    expect(onRouteChange).toHaveBeenCalledWith('game', { mode: 'HSV', questionCount: 10 });
  });

  it('maintains history stack and supports goBack()', () => {
    const router = new AppRouter({ initialRoute: 'hub' });

    router.navigate('config', { exerciseId: 'color-matching' });
    router.navigate('game', { questionCount: 5 });

    expect(router.getCurrentRoute()).toBe('game');

    // Go back to config
    const backedToConfig = router.goBack();
    expect(backedToConfig).toBe(true);
    expect(router.getCurrentRoute()).toBe('config');
    expect(router.getCurrentParams()).toEqual({ exerciseId: 'color-matching' });

    // Go back to hub
    const backedToHub = router.goBack();
    expect(backedToHub).toBe(true);
    expect(router.getCurrentRoute()).toBe('hub');

    // Cannot go back past root
    const backedPastRoot = router.goBack();
    expect(backedPastRoot).toBe(false);
    expect(router.getCurrentRoute()).toBe('hub');
  });

  it('falls back to "hub" when navigating to an invalid or empty route', () => {
    const router = new AppRouter();
    router.navigate('');
    expect(router.getCurrentRoute()).toBe('hub');

    router.navigate(null);
    expect(router.getCurrentRoute()).toBe('hub');
  });
});
