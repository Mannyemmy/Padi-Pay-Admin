'use client';

import { useEffect } from 'react';

export function ThemeProvider() {
  useEffect(() => {
    // Load theme settings from localStorage on app start
    const stored = localStorage.getItem('padipay-settings');
    
    if (stored) {
      try {
        const settings = JSON.parse(stored);
        
        // Apply theme
        const root = document.documentElement;
        root.dataset.theme = settings.defaultTheme || 'dark';
        
        // Apply colors
        if (settings.primaryColor) {
          root.style.setProperty('--brand-primary', settings.primaryColor);
        }
        if (settings.accentColor) {
          root.style.setProperty('--brand-accent', settings.accentColor);
        }
        if (settings.buttonRadius) {
          root.style.setProperty('--ui-radius', `${settings.buttonRadius}px`);
        }
        
        // Apply modes
        root.classList.toggle('ui-compact', settings.compactMode || false);
        root.classList.toggle('ui-no-shadows', !settings.enableShadows);
      } catch (err) {
        console.error('Failed to load theme settings:', err);
      }
    } else {
      // Set default theme to dark
      const root = document.documentElement;
      root.dataset.theme = 'dark';
      root.classList.add('dark');
      root.style.setProperty('--brand-primary', '#2563eb');
      root.style.setProperty('--brand-accent', '#10b981');
      root.style.setProperty('--ui-radius', '12px');
    }
  }, []);

  return null;
}
