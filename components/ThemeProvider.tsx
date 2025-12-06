'use client';

import { useEffect } from 'react';

export function ThemeProvider() {
  useEffect(() => {
    const applyTheme = () => {
      const stored = localStorage.getItem('padipay-settings');
      
      if (stored) {
        try {
          const settings = JSON.parse(stored);
          const root = document.documentElement;
          const isDark = settings.defaultTheme === 'dark';
          
          root.dataset.theme = settings.defaultTheme || 'dark';
          
          // Explicitly add or remove dark class
          if (isDark) {
            root.classList.add('dark');
          } else {
            root.classList.remove('dark');
          }
          
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
        if (!root.classList.contains('dark')) {
          root.classList.add('dark');
        }
        root.style.setProperty('--brand-primary', '#2563eb');
        root.style.setProperty('--brand-accent', '#10b981');
        root.style.setProperty('--ui-radius', '12px');
      }
    };

    applyTheme();

    // Listen for storage changes
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'padipay-settings') {
        applyTheme();
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  return null;
}
