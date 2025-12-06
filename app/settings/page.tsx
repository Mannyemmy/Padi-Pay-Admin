'use client';

import { useEffect, useState } from 'react';
import { Save, Palette, MonitorSmartphone, SlidersHorizontal, Check } from 'lucide-react';
import { Settings as SettingsType } from '@/lib/types';
import { showToast } from '@/components/Toast';

export default function SettingsPage() {
  // Initialize state from localStorage
  const [settings, setSettings] = useState<SettingsType>(() => {
    if (typeof window === 'undefined') {
      return {
        companyName: 'PadiPay',
        supportEmail: 'support@padipay.com',
        supportPhone: '+234 800 123 4567',
        primaryColor: '#2563eb',
        accentColor: '#10b981',
        buttonRadius: 12,
        defaultTheme: 'light',
        compactMode: false,
        enableShadows: true,
      };
    }

    const stored = localStorage.getItem('padipay-settings');
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        // Remove deprecated sidebarColor if it exists
        const { sidebarColor, ...rest } = parsed;
        return rest as SettingsType;
      } catch (err) {
        console.error('Failed to parse stored settings:', err);
      }
    }

    return {
      companyName: 'PadiPay',
      supportEmail: 'support@padipay.com',
      supportPhone: '+234 800 123 4567',
      primaryColor: '#2563eb',
      accentColor: '#10b981',
      buttonRadius: 12,
      defaultTheme: 'light',
      compactMode: false,
      enableShadows: true,
    };
  });

  // Apply settings to DOM
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--brand-primary', settings.primaryColor);
    root.style.setProperty('--brand-accent', settings.accentColor);
    root.style.setProperty('--ui-radius', `${settings.buttonRadius}px`);
    root.dataset.theme = settings.defaultTheme;
    root.classList.toggle('ui-compact', settings.compactMode);
    root.classList.toggle('ui-no-shadows', !settings.enableShadows);
  }, [settings]);

  // Persist to localStorage
  useEffect(() => {
    localStorage.setItem('padipay-settings', JSON.stringify(settings));
  }, [settings]);

  const handleSave = () => {
    // Handle save logic here - update Firestore
    console.log('Saving settings:', settings);
    showToast('success', 'Settings saved!', 'Your changes have been applied and saved to localStorage.');
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Settings</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">Configure platform settings and policies</p>
        </div>
        <button
          onClick={handleSave}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600 transition-all transform hover:-translate-y-0.5"
        >
          <Save className="w-5 h-5" />
          Save Changes
        </button>
      </div>

      {/* Appearance */}
      <div className="card animate-in fade-in">
        <div className="flex items-center gap-2 mb-4">
          <Palette className="w-5 h-5 text-blue-600" />
          <h2 className="text-lg font-semibold text-gray-900">Brand & Colors</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Primary Color</label>
            <p className="text-xs text-gray-500 mb-2">Used for buttons, links, active states</p>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={settings.primaryColor}
                onChange={(e) => setSettings({ ...settings, primaryColor: e.target.value })}
                className="h-10 w-14 rounded border border-gray-200"
              />
              <input
                type="text"
                value={settings.primaryColor}
                onChange={(e) => setSettings({ ...settings, primaryColor: e.target.value })}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Accent Color</label>
            <p className="text-xs text-gray-500 mb-2">Used for success messages, highlights</p>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={settings.accentColor}
                onChange={(e) => setSettings({ ...settings, accentColor: e.target.value })}
                className="h-10 w-14 rounded border border-gray-200"
              />
              <input
                type="text"
                value={settings.accentColor}
                onChange={(e) => setSettings({ ...settings, accentColor: e.target.value })}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>
      </div>

      {/* UI Preferences */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center gap-2 mb-4">
          <MonitorSmartphone className="w-5 h-5 text-blue-600" />
          <h2 className="text-lg font-semibold text-gray-900">UI Preferences</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Default Theme</label>
              <p className="text-xs text-gray-500 mb-2">Light for daytime, Dark for nighttime use</p>
              <select
                value={settings.defaultTheme}
                onChange={(e) => setSettings({ ...settings, defaultTheme: e.target.value as SettingsType['defaultTheme'] })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="light">Light</option>
                <option value="dark">Dark</option>
                <option value="system">System (matches device preference)</option>
              </select>
            </div>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={settings.compactMode}
                onChange={(e) => setSettings({ ...settings, compactMode: e.target.checked })}
                className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
              />
              <div>
                <p className="text-sm font-medium text-gray-900">Compact Mode</p>
                <p className="text-xs text-gray-500">Reduces spacing for more data per screen</p>
              </div>
            </label>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={settings.enableShadows}
                onChange={(e) => setSettings({ ...settings, enableShadows: e.target.checked })}
                className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
              />
              <div>
                <p className="text-sm font-medium text-gray-900">Card Shadows</p>
                <p className="text-xs text-gray-500">Adds depth effect to boxes and cards</p>
              </div>
            </label>
          </div>
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <SlidersHorizontal className="w-4 h-4 text-gray-500" />
              <div className="flex-1">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-medium text-gray-700">Button Corner Radius</p>
                  <span className="text-xs text-gray-500">{settings.buttonRadius}px (roundness)</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={24}
                  value={settings.buttonRadius}
                  onChange={(e) => setSettings({ ...settings, buttonRadius: parseInt(e.target.value) })}
                  className="w-full"
                />
                <p className="text-xs text-gray-500 mt-1">0 = square, 24 = very round (pill-shaped)</p>
              </div>
            </div>
            <div className="border border-gray-200 rounded-lg p-4" style={{
              backgroundColor: settings.defaultTheme === 'dark' ? '#1f2937' : '#f9fafb',
              borderRadius: `${settings.buttonRadius}px`,
              boxShadow: settings.enableShadows ? '0 10px 25px rgba(0,0,0,0.12)' : 'none',
            }}>
              <p className="text-sm font-medium mb-2" style={{ color: settings.defaultTheme === 'dark' ? '#f3f4f6' : '#111827' }}>Live Preview</p>
              <div className="p-3 rounded-lg" style={{
                backgroundColor: settings.defaultTheme === 'dark' ? '#111827' : '#ffffff',
                borderRadius: `${settings.buttonRadius}px`,
                boxShadow: settings.enableShadows ? '0 10px 25px rgba(0,0,0,0.08)' : 'none',
                border: settings.defaultTheme === 'dark' ? '1px solid #374151' : '1px solid #e5e7eb',
              }}>
                <div className="flex items-center gap-2 mb-2">
                  <span className="inline-block w-3 h-3 rounded-full" style={{ backgroundColor: settings.primaryColor }} />
                  <span className="inline-block w-3 h-3 rounded-full" style={{ backgroundColor: settings.accentColor }} />
                </div>
                <div className="flex gap-2">
                  <button
                    className="text-white px-3 py-2 text-xs font-semibold"
                    style={{ backgroundColor: settings.primaryColor, borderRadius: `${settings.buttonRadius}px` }}
                  >
                    Primary
                  </button>
                  <button
                    className="text-white px-3 py-2 text-xs font-semibold"
                    style={{ backgroundColor: settings.accentColor, borderRadius: `${settings.buttonRadius}px` }}
                  >
                    Accent
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Company Information */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Company Information</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Company Name
            </label>
            <input
              type="text"
              value={settings.companyName}
              onChange={(e) =>
                setSettings({ ...settings, companyName: e.target.value })
              }
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Support Email
              </label>
              <input
                type="email"
                value={settings.supportEmail}
                onChange={(e) =>
                  setSettings({ ...settings, supportEmail: e.target.value })
                }
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Support Phone
              </label>
              <input
                type="tel"
                value={settings.supportPhone}
                onChange={(e) =>
                  setSettings({ ...settings, supportPhone: e.target.value })
                }
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Danger Zone */}
      <div className="bg-red-50 border border-red-200 rounded-lg p-6">
        <h2 className="text-lg font-semibold text-red-900 mb-4">Danger Zone</h2>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-red-900">Reset All Settings</p>
              <p className="text-xs text-red-700">
                This will reset all settings to default values
              </p>
            </div>
            <button className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors">
              Reset
            </button>
          </div>
          <div className="flex items-center justify-between pt-4 border-t border-red-200">
            <div>
              <p className="text-sm font-medium text-red-900">Export Configuration</p>
              <p className="text-xs text-red-700">Download current settings as JSON</p>
            </div>
            <button className="px-4 py-2 border border-red-600 text-red-600 rounded-lg hover:bg-red-50 transition-colors">
              Export
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
