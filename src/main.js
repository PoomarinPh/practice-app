/**
 * @fileoverview ChromaSense Application Entry Point.
 * Coordinates view mounting and Service Worker lifecycle.
 */

import './style.css';

/**
 * Initializes the ChromaSense application shell.
 */
function initApp() {
  const appContainer = document.querySelector('#app');
  if (appContainer) {
    appContainer.innerHTML = `
      <main style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;text-align:center;">
        <h1 style="font-size:1.75rem;font-weight:700;margin-bottom:0.5rem;letter-spacing:-0.02em;">ChromaSense</h1>
        <p style="color:var(--color-text-secondary);font-size:0.95rem;">Color Observation & Value Trainer</p>
      </main>
    `;
  }

  // Register Service Worker in production builds only
  if ('serviceWorker' in navigator && import.meta.env.PROD) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').catch((err) => {
        console.error('ServiceWorker registration failed: ', err);
      });
    });
  }
}

document.addEventListener('DOMContentLoaded', initApp);

// If DOM is already ready
if (document.readyState === 'complete' || document.readyState === 'interactive') {
  initApp();
}
