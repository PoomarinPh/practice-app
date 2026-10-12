/**
 * @fileoverview AppRouter - Lightweight client-side view coordinator and state history stack.
 * Manages screen transitions between 'hub', 'config', 'game', and 'history' states.
 * Strictly adheres to Google JavaScript Style Guide and DESIGN.md.
 */

/**
 * @typedef {Object} RouterOptions
 * @property {string} [initialRoute='hub'] - Starting route name.
 * @property {Object} [initialParams={}] - Starting route parameters.
 * @property {Function} [onRouteChange] - Callback fired on every navigation change: (route, params) => void.
 */

export class AppRouter {
  /**
   * @param {RouterOptions} [options={}] - Router configuration.
   */
  constructor(options = {}) {
    this.currentRoute = options.initialRoute || 'hub';
    this.currentParams = options.initialParams ? { ...options.initialParams } : {};
    this.onRouteChange = options.onRouteChange || null;

    /**
     * @private
     * @type {Array<{route: string, params: Object}>}
     */
    this.historyStack = [];
  }

  /**
   * Returns current active route name.
   * @returns {string} Current route.
   */
  getCurrentRoute() {
    return this.currentRoute;
  }

  /**
   * Returns copy of current route parameters.
   * @returns {Object} Route parameters.
   */
  getCurrentParams() {
    return { ...this.currentParams };
  }

  /**
   * Navigates to a target route, pushing the previous route to the history stack.
   * @param {string} route - Target route name.
   * @param {Object} [params={}] - Parameters associated with the new route.
   */
  navigate(route, params = {}) {
    const validRoute = route && typeof route === 'string' ? route.trim() : 'hub';

    // Push current state to history stack
    this.historyStack.push({
      route: this.currentRoute,
      params: { ...this.currentParams },
    });

    this.currentRoute = validRoute;
    this.currentParams = params ? { ...params } : {};

    if (typeof this.onRouteChange === 'function') {
      this.onRouteChange(this.currentRoute, this.currentParams);
    }
  }

  /**
   * Pops the previous route from the history stack and navigates back.
   * @returns {boolean} True if successfully popped back; false if at root of history.
   */
  goBack() {
    if (this.historyStack.length === 0) {
      return false;
    }

    const previous = this.historyStack.pop();
    this.currentRoute = previous.route;
    this.currentParams = previous.params;

    if (typeof this.onRouteChange === 'function') {
      this.onRouteChange(this.currentRoute, this.currentParams);
    }

    return true;
  }
}
