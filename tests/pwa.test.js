/**
 * @fileoverview Unit test suite for PWA configuration, Service Worker, and iOS standalone metadata.
 * Validates manifest.webmanifest schema, Apple viewport meta tags, and Service Worker caching directives.
 */

import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

describe('PWA & Mobile Packaging Audit', () => {
  const rootDir = process.cwd();

  describe('Web App Manifest (manifest.webmanifest)', () => {
    it('manifest exists in public/ directory and is valid JSON', () => {
      const manifestPath = path.join(rootDir, 'public', 'manifest.webmanifest');
      expect(fs.existsSync(manifestPath)).toBe(true);

      const content = fs.readFileSync(manifestPath, 'utf-8');
      const manifest = JSON.parse(content);

      expect(manifest.name).toContain('ChromaSense');
      expect(manifest.short_name).toBe('ChromaSense');
      expect(manifest.display).toBe('standalone');
      expect(manifest.orientation).toBe('portrait');
      expect(manifest.background_color).toBe('#0d0e12');
      expect(manifest.theme_color).toBe('#0d0e12');
      expect(Array.isArray(manifest.icons)).toBe(true);
      expect(manifest.icons.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('iOS Safari Meta Tags (index.html)', () => {
    it('index.html includes all required Apple mobile tags and safe-area viewport', () => {
      const htmlPath = path.join(rootDir, 'index.html');
      const html = fs.readFileSync(htmlPath, 'utf-8');

      // Viewport with safe area cover
      expect(html).toContain('viewport-fit=cover');
      expect(html).toContain('user-scalable=no');

      // Apple standalone PWA headers
      expect(html).toContain('name="apple-mobile-web-app-capable" content="yes"');
      expect(html).toContain('name="apple-mobile-web-app-status-bar-style" content="black-translucent"');
      expect(html).toContain('name="apple-mobile-web-app-title" content="ChromaSense"');

      // Icons & Manifest link
      expect(html).toContain('rel="apple-touch-icon"');
      expect(html).toContain('rel="manifest"');
    });
  });

  describe('Service Worker (public/sw.js)', () => {
    it('sw.js exists in public/ directory with cache-first and lifecycle handlers', () => {
      const swPath = path.join(rootDir, 'public', 'sw.js');
      expect(fs.existsSync(swPath)).toBe(true);

      const sw = fs.readFileSync(swPath, 'utf-8');

      // Versioned cache namespace
      expect(sw).toMatch(/CACHE_NAME\s*=\s*['"`]chromasense-v/);

      // Pre-cache list
      expect(sw).toContain("'/index.html'");
      expect(sw).toContain("'/manifest.webmanifest'");

      // Instant activation & claim
      expect(sw).toContain('skipWaiting()');
      expect(sw).toContain('clients.claim()');

      // Event listeners
      expect(sw).toContain("addEventListener('install'");
      expect(sw).toContain("addEventListener('activate'");
      expect(sw).toContain("addEventListener('fetch'");
    });
  });

  describe('GitHub Pages Automated Deployment Workflow', () => {
    it('defines a valid GitHub Actions workflow at .github/workflows/deploy.yml', () => {
      const workflowPath = path.join(rootDir, '.github', 'workflows', 'deploy.yml');
      expect(fs.existsSync(workflowPath)).toBe(true);

      const workflow = fs.readFileSync(workflowPath, 'utf-8');
      expect(workflow).toContain('deploy-pages');
      expect(workflow).toContain('branches:');
      expect(workflow).toContain('main');
      expect(workflow).toContain('npm run build');
    });
  });
});

